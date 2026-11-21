const prisma = require('../db');

/**
 * getCachedAnalyses(hashes)
 * Retrieves cached analysis results for a given array of text hashes.
 * Returns a Map<hash, { sentiment, topics: array, summary, needsReply }>.
 * Automatically parses the stored JSON topics text back into a JavaScript array.
 */
async function getCachedAnalyses(hashes = []) {
  if (!Array.isArray(hashes) || hashes.length === 0) {
    return new Map();
  }

  const validHashes = hashes.filter((h) => h && typeof h === 'string');
  if (validHashes.length === 0) {
    return new Map();
  }

  const cachedRows = await prisma.analysisCache.findMany({
    where: {
      textHash: { in: validHashes },
    },
  });

  const cacheMap = new Map();
  for (const row of cachedRows) {
    let parsedTopics = [];
    if (row.topics) {
      try {
        parsedTopics = JSON.parse(row.topics);
      } catch {
        parsedTopics = [];
      }
    }

    cacheMap.set(row.textHash, {
      sentiment: row.sentiment,
      topics: parsedTopics,
      summary: row.summary,
      needsReply: row.needsReply,
    });
  }

  return cacheMap;
}

/**
 * saveCachedAnalyses(entries)
 * Stores successful review analyses in the cache so subsequent CSV uploads
 * avoid unnecessary AI calls. Skips text hashes that are already cached.
 * Failed analyses are NEVER passed here, so re-uploads retry them.
 */
async function saveCachedAnalyses(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const validEntries = entries.filter((e) => e && e.textHash);
  if (validEntries.length === 0) {
    return [];
  }

  // Query existing hashes to guarantee we skip existing rows without triggering constraint errors
  const hashes = validEntries.map((e) => e.textHash);
  const existingRecords = await prisma.analysisCache.findMany({
    where: { textHash: { in: hashes } },
    select: { textHash: true },
  });
  const existingSet = new Set(existingRecords.map((r) => r.textHash));

  const newEntries = validEntries
    .filter((e) => !existingSet.has(e.textHash))
    .map((e) => ({
      textHash: e.textHash,
      sentiment: e.sentiment,
      topics: Array.isArray(e.topics) ? JSON.stringify(e.topics) : (e.topics || '[]'),
      summary: e.summary,
      needsReply: Boolean(e.needsReply),
    }));

  if (newEntries.length > 0) {
    await prisma.analysisCache.createMany({
      data: newEntries,
    });
  }

  return newEntries;
}

/**
 * replaceReviews(rows)
 * Deletes all previous Review rows and inserts new rows within ONE database transaction.
 * Each upload run completely replaces the current dataset, while the analysis cache persists.
 */
async function replaceReviews(rows = []) {
  return await prisma.$transaction(async (tx) => {
    // 1. Delete all existing reviews from the current dataset
    await tx.review.deleteMany({});

    // 2. Insert new reviews if any were provided
    if (Array.isArray(rows) && rows.length > 0) {
      const formattedRows = rows.map((r) => ({
        reviewId: r.reviewId || '',
        product: r.product || '',
        rating: r.rating !== undefined && r.rating !== null ? Number(r.rating) : null,
        date: r.date || null,
        originalText: r.originalText || '',
        cleanText: r.cleanText || '',
        textHash: r.textHash || '',
        status: r.status || 'skipped_empty',
        duplicateOf: r.duplicateOf || null,
        sentiment: r.sentiment || null,
        topics: r.topics
          ? (Array.isArray(r.topics) ? JSON.stringify(r.topics) : String(r.topics))
          : null,
        summary: r.summary || null,
        needsReply: r.needsReply !== undefined && r.needsReply !== null ? Boolean(r.needsReply) : null,
        suggestedReply: r.suggestedReply || null,
      }));

      await tx.review.createMany({
        data: formattedRows,
      });
    }
  });
}

/**
 * saveUploadRun(data)
 * Persists an upload summary record with duration, row counts, and cache metrics.
 */
async function saveUploadRun(data) {
  return await prisma.uploadRun.create({
    data: {
      fileName: data.fileName || 'upload.csv',
      totalRows: data.totalRows || 0,
      analysedCount: data.analysedCount || 0,
      duplicateCount: data.duplicateCount || 0,
      skippedCount: data.skippedCount || 0,
      failedCount: data.failedCount || 0,
      aiCalls: data.aiCalls || 0,
      cacheHits: data.cacheHits || 0,
      durationMs: data.durationMs || 0,
    },
  });
}

/**
 * getAllReviews()
 * Returns all reviews from the current dataset with topics parsed back into JavaScript arrays.
 */
async function getAllReviews() {
  const reviews = await prisma.review.findMany({
    orderBy: { id: 'asc' },
  });

  return reviews.map((review) => {
    let parsedTopics = null;
    if (review.topics) {
      try {
        parsedTopics = JSON.parse(review.topics);
      } catch {
        parsedTopics = [];
      }
    }

    return {
      ...review,
      topics: parsedTopics,
    };
  });
}

/**
 * getLatestUploadRun()
 * Returns the most recent upload run metadata record, or null if none exists.
 */
async function getLatestUploadRun() {
  return await prisma.uploadRun.findFirst({
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  getCachedAnalyses,
  saveCachedAnalyses,
  replaceReviews,
  saveUploadRun,
  getAllReviews,
  getLatestUploadRun,
};
