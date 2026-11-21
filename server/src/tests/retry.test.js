const { callWithBackoff, defaultSleep } = require('../services/retry');
const { AiApiError } = require('../services/gemini');

describe('Retry helper (callWithBackoff)', () => {
  let fakeSleep;

  beforeEach(() => {
    fakeSleep = jest.fn(() => Promise.resolve());
  });

  it('returns the result immediately on first successful call without retrying', async () => {
    const fn = jest.fn(async () => 'success_value');

    const result = await callWithBackoff(fn, { sleep: fakeSleep });
    expect(result).toBe('success_value');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fakeSleep).not.toHaveBeenCalled();
  });

  it('retries on retryable error with increasing delays', async () => {
    let callCount = 0;
    const fn = jest.fn(async () => {
      callCount++;
      if (callCount <= 2) {
        throw new AiApiError('Rate limited', 429, true);
      }
      return 'success_after_retry';
    });

    const result = await callWithBackoff(fn, {
      baseDelayMs: 100,
      maxRetries: 3,
      sleep: fakeSleep,
    });

    expect(result).toBe('success_after_retry');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fakeSleep).toHaveBeenCalledTimes(2);

    const firstDelay = fakeSleep.mock.calls[0][0];
    const secondDelay = fakeSleep.mock.calls[1][0];

    // Delays should increase exponentially
    expect(firstDelay).toBeGreaterThanOrEqual(100);
    expect(secondDelay).toBeGreaterThanOrEqual(200);
    expect(secondDelay).toBeGreaterThan(firstDelay);
  });

  it('throws non-retryable errors immediately without retrying', async () => {
    const fn = jest.fn(async () => {
      throw new AiApiError('Bad Request', 400, false);
    });

    await expect(callWithBackoff(fn, { sleep: fakeSleep })).rejects.toThrow('Bad Request');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fakeSleep).not.toHaveBeenCalled();
  });

  it('exhausts maxRetries and throws the last error', async () => {
    const fn = jest.fn(async () => {
      throw new AiApiError('Service Unavailable', 503, true);
    });

    await expect(
      callWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 50,
        sleep: fakeSleep,
      })
    ).rejects.toThrow('Service Unavailable');

    // 1 initial try + 3 retries = 4 total calls
    expect(fn).toHaveBeenCalledTimes(4);
    expect(fakeSleep).toHaveBeenCalledTimes(3);
  });
});
