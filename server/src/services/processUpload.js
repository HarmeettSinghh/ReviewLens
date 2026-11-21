const { cleanReviews } = require('./csvCleaner');
const store = require('./store');
const { analyseReviews } = require('./analyzer');

const defaultDeps = {
  cleanReviews,
  getCachedAnalyses: store.getCachedAnalyses,
  saveCachedAnalyses: store.saveCachedAnalyses,
  replaceReviews: store.replaceReviews,
  saveUploadRun: store.saveUploadRun,
  analyseReviews,
};

/**
 * processUpload(csvString, fileName, deps)
 * Coordinates the full upload pipeline:
 * 1. Clean and deduplicate CSV rows
 * 2. Look up valid reviews in AnalysisCache (cache hits avoid AI calls)
 * 3. Send only cache misses to the analyzer
 * 4. Cache newly successful analyses (never cache failures)
 * 5. Construct final Review records with statuses:
 *    - "analysed"
 *    - "analysis_failed"
 *    - "skipped_empty"
 *    - "duplicate"
 * 6. Atomically replace active reviews in database & log the UploadRun metrics
 * 7. Return execution summary metrics
 */
async function processUpload(csvString, fileName = 'upload.csv', deps = {}) {
  const {
    cleanReviews: cleanFn,
    getCachedAnalyses,
    saveCachedAnalyses,
    replaceReviews,
    saveUploadRun,
    analyseReviews: analyzeFn,
  } = { ...defaultDeps, ...deps };

  const startTime = Date.now();

  // 1. Clean CSV content; throws a descriptive error if missing required headers
  const cleanedRows = cleanFn(csvString);

  // 2. Separate valid unique reviews from duplicates and skipped rows
  const validRows = cleanedRows.filter((r) => r.status === 'valid');
  const validHashes = Array.from(new Set(validRows.map((r) => r.textHash)));

  // Query database cache for previously analysed reviews
  const cachedAnalyses = await getCachedAnalyses(validHashes);

  // Calculate cache hits: valid reviews already present in cache
  const cacheHits = validRows.filter((r) => cachedAnalyses.has(r.textHash)).length;

  // 3. Send ONLY cache misses to the AI analyzer
  const cacheMisses = validRows.filter((r) => !cachedAnalyses.has(r.textHash));

  let freshResults = new Map();
  let aiCalls = 0;

  if (cacheMisses.length > 0) {
    const analysisOutput = await analyzeFn(cacheMisses);
    freshResults = analysisOutput.results;
    aiCalls = analysisOutput.aiCalls;
  }

  // 4. Save successful new AI analyses to cache (failures are never cached so re-uploads retry them)
  const newCacheEntries = [];
  for (const [textHash, analysis] of freshResults.entries()) {
    newCacheEntries.push({ textHash, ...analysis });
  }

  if (newCacheEntries.length > 0) {
    await saveCachedAnalyses(newCacheEntries);
  }

  // 5. Construct final Review table rows
  const finalReviewRows = cleanedRows.map((row) => {
    if (row.status === 'skipped_empty') {
      return {
        reviewId: row.reviewId,
        product: row.product,
        rating: row.rating,
        date: row.date,
        originalText: row.originalText,
        cleanText: row.cleanText,
        textHash: row.textHash,
        status: 'skipped_empty',
        duplicateOf: null,
        sentiment: null,
        topics: null,
        summary: null,
        needsReply: null,
      };
    }

    if (row.status === 'duplicate') {
      return {
        reviewId: row.reviewId,
        product: row.product,
        rating: row.rating,
        date: row.date,
        originalText: row.originalText,
        cleanText: row.cleanText,
        textHash: row.textHash,
        status: 'duplicate',
        duplicateOf: row.duplicateOf,
        sentiment: null,
        topics: null,
        summary: null,
        needsReply: null,
      };
    }

    // Status is 'valid': check if we obtained an analysis from cache or fresh AI run
    const analysis = cachedAnalyses.get(row.textHash) || freshResults.get(row.textHash);

    if (analysis) {
      return {
        reviewId: row.reviewId,
        product: row.product,
        rating: row.rating,
        date: row.date,
        originalText: row.originalText,
        cleanText: row.cleanText,
        textHash: row.textHash,
        status: 'analysed',
        duplicateOf: null,
        sentiment: analysis.sentiment,
        topics: analysis.topics,
        summary: analysis.summary,
        needsReply: analysis.needsReply !== undefined ? analysis.needsReply : analysis.needs_reply,
      };
    }

    // Analysis failed after all retries
    return {
      reviewId: row.reviewId,
      product: row.product,
      rating: row.rating,
      date: row.date,
      originalText: row.originalText,
      cleanText: row.cleanText,
      textHash: row.textHash,
      status: 'analysis_failed',
      duplicateOf: null,
      sentiment: null,
      topics: null,
      summary: null,
      needsReply: null,
    };
  });

  // Calculate final aggregate counts
  const totalRows = finalReviewRows.length;
  const analysedCount = finalReviewRows.filter((r) => r.status === 'analysed').length;
  const duplicateCount = finalReviewRows.filter((r) => r.status === 'duplicate').length;
  const skippedCount = finalReviewRows.filter((r) => r.status === 'skipped_empty').length;
  const failedCount = finalReviewRows.filter((r) => r.status === 'analysis_failed').length;
  const durationMs = Date.now() - startTime;

  // 6. Replace reviews in database inside a single transaction & persist upload run log
  await replaceReviews(finalReviewRows);

  await saveUploadRun({
    fileName,
    totalRows,
    analysedCount,
    duplicateCount,
    skippedCount,
    failedCount,
    aiCalls,
    cacheHits,
    durationMs,
  });

  // 7. Return summary response
  return {
    totalRows,
    analysedCount,
    duplicateCount,
    skippedCount,
    failedCount,
    aiCalls,
    cacheHits,
    durationMs,
  };
}

module.exports = {
  processUpload,
};
