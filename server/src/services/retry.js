/**
 * retry.js
 * Centralized exponential backoff and retry helper for network/AI calls.
 */

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * callWithBackoff(fn, options)
 * Executes an async function with exponential backoff and jitter for retryable errors.
 * - Retryable errors (e.g. HTTP 429, 5xx, network drops) wait baseDelayMs * 2^attempt + jitter.
 * - Non-retryable errors (e.g. HTTP 400, 401, 403, 404) are thrown immediately.
 * - After maxRetries fail, re-throws the last error.
 *
 * @param {Function} fn Async operation to execute
 * @param {Object} options Configuration { maxRetries, baseDelayMs, sleep }
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

module.exports = {
  callWithBackoff,
  defaultSleep,
};
