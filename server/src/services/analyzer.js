const { parseAiJson, validateBatch } = require('../schemas/analysis');
const { analyseBatch: defaultAnalyseBatch, AiApiError } = require('./gemini');
const { callWithBackoff, defaultSleep } = require('./retry');

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
async function analyseReviews(reviews, options = {}) {
  const {
    batchSize = 5,
    maxApiRetries = 4,
    baseDelayMs = 1000,
    delayBetweenBatchesMs = Number(process.env.AI_BATCH_DELAY_MS) || 100,
    analyseBatch = defaultAnalyseBatch,
    sleep = defaultSleep,
  } = options;

  const results = new Map();
  const failedHashes = new Set();
  let aiCalls = 0;

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return { results, failedHashes, aiCalls };
  }

  // Helper map from reviewId to original review object
  const reviewById = new Map();
  for (const r of reviews) {
    reviewById.set(r.reviewId, r);
  }

  // Chunk valid unique reviews into sequential batches of batchSize
  const batches = [];
  for (let i = 0; i < reviews.length; i += batchSize) {
    batches.push(reviews.slice(i, i + batchSize));
  }

  const totalBatches = batches.length;

  for (let bIndex = 0; bIndex < totalBatches; bIndex++) {
    const currentBatch = batches[bIndex];
    let batchSucceeded = false;
    let rawAiResponse = null;

    // Retry Mechanism A: Network / API backoff retry
    try {
      rawAiResponse = await callWithBackoff(
        async () => {
          aiCalls++;
          return await analyseBatch(currentBatch);
        },
        {
          maxRetries: maxApiRetries,
          baseDelayMs,
          sleep,
        }
      );
      batchSucceeded = true;
    } catch (apiErr) {
      // If the API keeps erroring after all backoff retries,
      // mark just that batch's reviews as failed and CONTINUE with next batches.
      for (const r of currentBatch) {
        failedHashes.add(r.textHash);
      }
      console.log(
        `[Batch ${bIndex + 1}/${totalBatches}] Size: ${currentBatch.length} | Succeeded: 0 | Failed: ${currentBatch.length} (API error)`
      );
      continue;
    }

    if (!batchSucceeded || !rawAiResponse) {
      continue;
    }

    // Step B1: Parse and validate JSON returned by Gemini
    let parsedArray = [];
    try {
      parsedArray = parseAiJson(rawAiResponse);
    } catch {
      parsedArray = [];
    }

    const expectedBatchIds = currentBatch.map((r) => r.reviewId);
    const { valid = [], invalidIds = [] } = validateBatch(parsedArray, expectedBatchIds);

    // Save good items from the first try
    for (const item of valid) {
      const original = reviewById.get(item.id);
      if (original) {
        results.set(original.textHash, {
          sentiment: item.sentiment,
          topics: item.topics,
          summary: item.summary,
          needsReply: item.needs_reply,
        });
      }
    }

    // Identify reviews that were missing or had schema validation failures
    let retryCandidates = [];
    for (const id of invalidIds) {
      const original = reviewById.get(id);
      if (original) {
        retryCandidates.push(original);
      }
    }

    // Retry Mechanism B: Validation retry (attempted ONCE for invalid items)
    if (retryCandidates.length > 0) {
      let retryRawResponse = null;
      try {
        retryRawResponse = await callWithBackoff(
          async () => {
            aiCalls++;
            return await analyseBatch(retryCandidates);
          },
          {
            maxRetries: maxApiRetries,
            baseDelayMs,
            sleep,
          }
        );
      } catch (retryApiErr) {
        retryRawResponse = null;
      }

      if (retryRawResponse) {
        let retryParsed = [];
        try {
          retryParsed = parseAiJson(retryRawResponse);
        } catch {
          retryParsed = [];
        }

        const retryExpectedIds = retryCandidates.map((r) => r.reviewId);
        const retryValidation = validateBatch(retryParsed, retryExpectedIds);

        // Save items that succeeded on the validation retry
        for (const item of (retryValidation.valid || [])) {
          const original = reviewById.get(item.id);
          if (original) {
            results.set(original.textHash, {
              sentiment: item.sentiment,
              topics: item.topics,
              summary: item.summary,
              needsReply: item.needs_reply,
            });
          }
        }

        // Reviews still invalid after the retry are marked failed
        for (const id of (retryValidation.invalidIds || [])) {
          const original = reviewById.get(id);
          if (original) {
            failedHashes.add(original.textHash);
          }
        }
      } else {
        // If the retry call itself failed completely, mark those items failed
        for (const r of retryCandidates) {
          failedHashes.add(r.textHash);
        }
      }
    }

    // Log a short line per batch (batch number, size, success/failure counts), never the text or key
    const succeededCount = currentBatch.filter((r) => results.has(r.textHash)).length;
    const failedCount = currentBatch.length - succeededCount;
    console.log(
      `[Batch ${bIndex + 1}/${totalBatches}] Size: ${currentBatch.length} | Succeeded: ${succeededCount} | Failed: ${failedCount}`
    );

    // Configurable delay between consecutive batches
    if (bIndex < totalBatches - 1 && delayBetweenBatchesMs > 0) {
      await sleep(delayBetweenBatchesMs);
    }
  }

  return {
    results,
    failedHashes,
    aiCalls,
  };
}

module.exports = {
  callWithBackoff,
  analyseReviews,
  defaultSleep,
};
