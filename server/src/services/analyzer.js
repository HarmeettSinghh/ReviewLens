const { parseAiJson, validateBatch } = require('../schemas/analysis');
const { analyseBatch: defaultAnalyseBatch, AiApiError } = require('./gemini');

/**
 * Default sleep implementation using setTimeout.
 */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * callWithBackoff(fn, options)
 * Executes an async function with exponential backoff and jitter for retryable errors.
 * - Retryable errors (e.g. HTTP 429, 5xx, network drops) wait baseDelayMs * 2^attempt + jitter.
 * - Non-retryable errors (e.g. HTTP 400, 401, 403, 404) are thrown immediately.
 * - After maxRetries fail, re-throws the last error.
 */
async function callWithBackoff(fn, options = {}) {
  const {
    maxRetries = 4,
    baseDelayMs = 1000,
    sleep = defaultSleep,
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = Boolean(err && err.retryable === true);

      // Immediately fail for non-retryable errors or once retry attempts are exhausted
      if (!isRetryable || attempt >= maxRetries) {
        throw err;
      }

      // Exponential backoff: baseDelayMs * 2^attempt with small random jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * (baseDelayMs * 0.1));
      const totalDelay = exponentialDelay + jitter;

      await sleep(totalDelay);
      attempt++;
    }
  }
}

/**
 * analyseReviews(reviews, options)
 * Orchestrates batching, AI calls, backoff, and validation retries.
 *
 * @param {Array} reviews Array of valid unique reviews: [{ reviewId, textHash, cleanText }]
 * @param {Object} options Configuration & dependency-injection parameters:
 *   - batchSize (default: 5)
 *   - maxApiRetries (default: 4)
 *   - baseDelayMs (default: 1000)
 *   - delayBetweenBatchesMs (default: env AI_BATCH_DELAY_MS or 100)
 *   - analyseBatch (default: gemini.js analyseBatch)
 *   - sleep (default: setTimeout promise)
 *
 * @returns {Promise<{ results: Map, failedHashes: Set, aiCalls: number }>}
 */
async function analyseReviews(reviews = [], options = {}) {
  const {
    batchSize = 5,
    maxApiRetries = 4,
    baseDelayMs = 1000,
    delayBetweenBatchesMs = options.delayBetweenBatchesMs !== undefined
      ? options.delayBetweenBatchesMs
      : (Number(process.env.AI_BATCH_DELAY_MS) || 100),
    analyseBatch = defaultAnalyseBatch,
    sleep = defaultSleep,
  } = options;

  const results = new Map();
  const failedHashes = new Set();
  let aiCalls = 0;

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return { results, failedHashes, aiCalls };
  }

  // Wrapper tracking every individual invocation made to the AI function
  const callAi = async (batchToAnalyze) => {
    aiCalls++;
    return await analyseBatch(batchToAnalyze);
  };

  // Helper to safely parse and validate an AI response string against target review IDs
  const validateResponse = (rawText, targetIds) => {
    let parsed;
    try {
      parsed = parseAiJson(rawText);
    } catch (parseErr) {
      // If raw JSON parsing fails completely, mark all target review IDs as invalid
      return { valid: [], invalidIds: targetIds, errors: [parseErr.message] };
    }
    return validateBatch(parsed, targetIds);
  };

  // Divide reviews into sequential batches of batchSize
  const totalBatches = Math.ceil(reviews.length / batchSize);

  for (let b = 0; b < totalBatches; b++) {
    const batch = reviews.slice(b * batchSize, (b + 1) * batchSize);
    const idToReview = new Map(batch.map((r) => [r.reviewId, r]));
    const expectedIds = batch.map((r) => r.reviewId);

    let rawText;
    let batchApiFailed = false;

    // Step A: Call Gemini with exponential backoff
    try {
      rawText = await callWithBackoff(
        () => callAi(batch),
        { maxRetries: maxApiRetries, baseDelayMs, sleep }
      );
    } catch (apiErr) {
      // If the API keeps failing after all retries, mark this batch as failed and continue to next
      batchApiFailed = true;
      for (const r of batch) {
        failedHashes.add(r.textHash);
      }
    }

    if (!batchApiFailed) {
      // Step B: Validate the response
      const firstValidation = validateResponse(rawText, expectedIds);

      // Save all reviews that validated successfully on the first try
      for (const item of firstValidation.valid) {
        const rev = idToReview.get(item.id);
        if (rev) {
          results.set(rev.textHash, {
            sentiment: item.sentiment,
            topics: item.topics,
            summary: item.summary,
            needsReply: item.needs_reply !== undefined ? item.needs_reply : item.needsReply,
          });
        }
      }

      // Collect any reviews that failed validation or were missing from the AI response
      const reviewsToRetry = batch.filter((r) => firstValidation.invalidIds.includes(r.reviewId));

      // Validation Retry: Retry invalid/missing reviews ONCE as a smaller batch
      if (reviewsToRetry.length > 0) {
        const retryExpectedIds = reviewsToRetry.map((r) => r.reviewId);
        let retryRawText;
        let retryApiFailed = false;

        try {
          retryRawText = await callWithBackoff(
            () => callAi(reviewsToRetry),
            { maxRetries: maxApiRetries, baseDelayMs, sleep }
          );
        } catch (retryErr) {
          retryApiFailed = true;
          for (const r of reviewsToRetry) {
            failedHashes.add(r.textHash);
          }
        }

        if (!retryApiFailed) {
          const secondValidation = validateResponse(retryRawText, retryExpectedIds);

          // Save reviews that became valid after the retry
          for (const item of secondValidation.valid) {
            const rev = idToReview.get(item.id);
            if (rev) {
              results.set(rev.textHash, {
                sentiment: item.sentiment,
                topics: item.topics,
                summary: item.summary,
                needsReply: item.needs_reply !== undefined ? item.needs_reply : item.needsReply,
              });
            }
          }

          // Any review still invalid after the second attempt is marked as failed
          for (const failedId of secondValidation.invalidIds) {
            const rev = idToReview.get(failedId);
            if (rev) {
              failedHashes.add(rev.textHash);
            }
          }
        }
      }
    }

    // Short summary log per batch: size, succeeded, failed (never prints review text or key)
    const succeededCount = batch.filter((r) => results.has(r.textHash)).length;
    const batchFailedCount = batch.length - succeededCount;
    console.log(`[Batch ${b + 1}/${totalBatches}] Size: ${batch.length} | Succeeded: ${succeededCount} | Failed: ${batchFailedCount}`);

    // Pause between batches to avoid tripping rate limits on sequential calls
    if (b < totalBatches - 1 && delayBetweenBatchesMs > 0) {
      await sleep(delayBetweenBatchesMs);
    }
  }

  return { results, failedHashes, aiCalls };
}

module.exports = {
  callWithBackoff,
  analyseReviews,
  defaultSleep,
};
