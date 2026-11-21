const { analyseReviews, callWithBackoff } = require('../services/analyzer');
const { AiApiError } = require('../services/gemini');

describe('Analyzer Service tests (with fake dependencies)', () => {
  let fakeSleep;

  beforeEach(() => {
    fakeSleep = jest.fn(() => Promise.resolve());
  });

  // Test 1: Batching: 12 reviews with batchSize 5 -> exactly 3 AI calls
  it('processes 12 reviews with batchSize 5 resulting in exactly 3 AI calls', async () => {
    const reviews = Array.from({ length: 12 }, (_, i) => ({
      reviewId: `R00${i + 1}`,
      textHash: `hash_${i + 1}`,
      cleanText: `Review content ${i + 1}`,
    }));

    const fakeAnalyseBatch = jest.fn(async (batch) => {
      const output = batch.map((r) => ({
        id: r.reviewId,
        sentiment: 'positive',
        topics: ['quality'],
        summary: `Summary of ${r.reviewId}`,
        needs_reply: false,
      }));
      return JSON.stringify(output);
    });

    const result = await analyseReviews(reviews, {
      batchSize: 5,
      delayBetweenBatchesMs: 0,
      analyseBatch: fakeAnalyseBatch,
      sleep: fakeSleep,
    });

    // 12 items / batchSize 5 = 3 batches (5 + 5 + 2)
    expect(result.aiCalls).toBe(3);
    expect(fakeAnalyseBatch).toHaveBeenCalledTimes(3);
    expect(result.results.size).toBe(12);
    expect(result.failedHashes.size).toBe(0);
  });

  // Test 2: Exponential backoff on 429
  it('retries on 429 (retryable) twice then succeeds with increasing delays', async () => {
    const reviews = [
      { reviewId: 'R001', textHash: 'hash_1', cleanText: 'Great product.' },
    ];

    let callCount = 0;
    const fakeAnalyseBatch = jest.fn(async () => {
      callCount++;
      if (callCount <= 2) {
        throw new AiApiError('Rate limit exceeded', 429, true);
      }
      return JSON.stringify([
        {
          id: 'R001',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Great product.',
          needs_reply: false,
        },
      ]);
    });

    const result = await analyseReviews(reviews, {
      batchSize: 5,
      baseDelayMs: 1000,
      maxApiRetries: 4,
      delayBetweenBatchesMs: 0,
      analyseBatch: fakeAnalyseBatch,
      sleep: fakeSleep,
    });

    expect(result.aiCalls).toBe(3);
    expect(result.results.size).toBe(1);
    expect(result.results.get('hash_1')).toBeDefined();

    // Sleep should be called at least twice for backoff
    expect(fakeSleep).toHaveBeenCalledTimes(2);

    const firstDelay = fakeSleep.mock.calls[0][0];
    const secondDelay = fakeSleep.mock.calls[1][0];

    // Delays should increase exponentially: first ~1000ms, second ~2000ms
    expect(firstDelay).toBeGreaterThanOrEqual(1000);
    expect(firstDelay).toBeLessThan(1200);

    expect(secondDelay).toBeGreaterThanOrEqual(2000);
    expect(secondDelay).toBeLessThan(2300);

    expect(secondDelay).toBeGreaterThan(firstDelay);
  });

  // Test 3: Retryable error forever -> gives up after maxApiRetries, other batches still processed
  it('gives up after maxApiRetries on continuous errors, marks reviews failed, and continues next batch', async () => {
    const reviews = [
      { reviewId: 'R001', textHash: 'hash_1', cleanText: 'Review 1' },
      { reviewId: 'R002', textHash: 'hash_2', cleanText: 'Review 2' },
    ];

    const fakeAnalyseBatch = jest.fn(async (batch) => {
      // First batch (R001) constantly errors
      if (batch[0].reviewId === 'R001') {
        throw new AiApiError('Service Unavailable', 503, true);
      }
      // Second batch (R002) succeeds
      return JSON.stringify([
        {
          id: 'R002',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Review 2 summary.',
          needs_reply: false,
        },
      ]);
    });

    const result = await analyseReviews(reviews, {
      batchSize: 1, // 2 separate batches
      baseDelayMs: 50,
      maxApiRetries: 3,
      delayBetweenBatchesMs: 0,
      analyseBatch: fakeAnalyseBatch,
      sleep: fakeSleep,
    });

    // Batch 1: 1 initial call + 3 retries = 4 calls
    // Batch 2: 1 initial call = 1 call
    // Total = 5 calls
    expect(result.aiCalls).toBe(5);

    // R001 failed, R002 succeeded
    expect(result.failedHashes.has('hash_1')).toBe(true);
    expect(result.results.has('hash_2')).toBe(true);
    expect(result.results.size).toBe(1);
  });

  // Test 4: Non-retryable error (401) -> no retries
  it('does not retry when a non-retryable error (401) occurs', async () => {
    const reviews = [
      { reviewId: 'R001', textHash: 'hash_1', cleanText: 'Review 1' },
    ];

    const fakeAnalyseBatch = jest.fn(async () => {
      throw new AiApiError('Invalid API Key', 401, false);
    });

    const result = await analyseReviews(reviews, {
      batchSize: 5,
      maxApiRetries: 4,
      delayBetweenBatchesMs: 0,
      analyseBatch: fakeAnalyseBatch,
      sleep: fakeSleep,
    });

    expect(result.aiCalls).toBe(1);
    expect(fakeSleep).not.toHaveBeenCalled();
    expect(result.failedHashes.has('hash_1')).toBe(true);
    expect(result.results.size).toBe(0);
  });

  // Test 5: Invalid JSON first, valid second -> succeeds with 2 calls
  it('retries once if output JSON is invalid and succeeds with 2 calls', async () => {
    const reviews = [
      { reviewId: 'R001', textHash: 'hash_1', cleanText: 'Review 1' },
    ];

    let callCount = 0;
    const fakeAnalyseBatch = jest.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return 'Not valid JSON at all';
      }
      return JSON.stringify([
        {
          id: 'R001',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Fixed on second try.',
          needs_reply: false,
        },
      ]);
    });

    const result = await analyseReviews(reviews, {
      batchSize: 5,
      delayBetweenBatchesMs: 0,
      analyseBatch: fakeAnalyseBatch,
      sleep: fakeSleep,
    });

    expect(result.aiCalls).toBe(2);
    expect(result.results.has('hash_1')).toBe(true);
    expect(result.failedHashes.size).toBe(0);
  });

  // Test 6: Invalid twice -> the reviews are in failedHashes
  it('marks reviews as failed if output remains invalid after the validation retry', async () => {
    const reviews = [
      { reviewId: 'R001', textHash: 'hash_1', cleanText: 'Review 1' },
    ];

    const fakeAnalyseBatch = jest.fn(async () => {
      return 'Malformed JSON response';
    });

    const result = await analyseReviews(reviews, {
      batchSize: 5,
      delayBetweenBatchesMs: 0,
      analyseBatch: fakeAnalyseBatch,
      sleep: fakeSleep,
    });

    expect(result.aiCalls).toBe(2); // 1 initial + 1 validation retry
    expect(result.results.size).toBe(0);
    expect(result.failedHashes.has('hash_1')).toBe(true);
  });

  // Test 7: One bad item in a batch -> only that one is retried, the good ones are kept
  it('retries ONLY the bad item in a batch and keeps the good ones', async () => {
    const reviews = [
      { reviewId: 'R001', textHash: 'hash_1', cleanText: 'Good review' },
      { reviewId: 'R002', textHash: 'hash_2', cleanText: 'Bad review initially' },
    ];

    let callCount = 0;
    let secondCallBatchArg;

    const fakeAnalyseBatch = jest.fn(async (batch) => {
      callCount++;
      if (callCount === 1) {
        // R001 is valid, R002 has an invalid sentiment
        return JSON.stringify([
          {
            id: 'R001',
            sentiment: 'positive',
            topics: ['quality'],
            summary: 'Good review.',
            needs_reply: false,
          },
          {
            id: 'R002',
            sentiment: 'invalid_sentiment',
            topics: ['price'],
            summary: 'Bad item.',
            needs_reply: true,
          },
        ]);
      }

      // Record which reviews were passed on the second (retry) call
      secondCallBatchArg = batch;
      return JSON.stringify([
        {
          id: 'R002',
          sentiment: 'neutral',
          topics: ['price'],
          summary: 'Corrected on retry.',
          needs_reply: false,
        },
      ]);
    });

    const result = await analyseReviews(reviews, {
      batchSize: 5,
      delayBetweenBatchesMs: 0,
      analyseBatch: fakeAnalyseBatch,
      sleep: fakeSleep,
    });

    expect(result.aiCalls).toBe(2);

    // Verify that the second call was invoked with ONLY R002
    expect(secondCallBatchArg).toHaveLength(1);
    expect(secondCallBatchArg[0].reviewId).toBe('R002');

    // Both reviews should be in results
    expect(result.results.size).toBe(2);
    expect(result.results.get('hash_1')).toEqual({
      sentiment: 'positive',
      topics: ['quality'],
      summary: 'Good review.',
      needsReply: false,
    });
    expect(result.results.get('hash_2')).toEqual({
      sentiment: 'neutral',
      topics: ['price'],
      summary: 'Corrected on retry.',
      needsReply: false,
    });
    expect(result.failedHashes.size).toBe(0);
  });
});
