const { GoogleGenAI, Type } = require('@google/genai');
const { SENTIMENTS, TOPICS } = require('../schemas/analysis');
const {
  ANALYSIS_SYSTEM_INSTRUCTION,
  buildAnalysisUserContent,
} = require('./prompts');

/**
 * Custom error class for AI API failures.
 * Encapsulates HTTP status codes and retryability decisions so downstream caller
 * code does not need to inspect low-level SDK error internals.
 */
class AiApiError extends Error {
  constructor(message, status = null, retryable = false) {
    super(message);
    this.name = 'AiApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Maps status codes and error conditions to retryability.
 * Retryable: 429 (rate limit), 500, 502, 503, 504 (server errors), and network/timeout errors (null status).
 * Non-retryable: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found).
 */
function isStatusRetryable(status) {
  if (status === null || status === undefined) {
    // Network drops, DNS errors, connection resets, and request timeouts are retryable
    return true;
  }

  const retryableStatuses = [429, 500, 502, 503, 504];
  return retryableStatuses.includes(Number(status));
}

/**
 * Sanitizes and wraps raw SDK errors into an AiApiError.
 * Guarantees that neither API keys nor review contents are leaked into log files or error traces.
 */
function wrapGeminiError(err) {
  let status = null;

  // Extract HTTP status code if present in the SDK error structure
  if (err.status && typeof err.status === 'number') {
    status = err.status;
  } else if (err.statusCode && typeof err.statusCode === 'number') {
    status = err.statusCode;
  } else if (err.response && err.response.status) {
    status = Number(err.response.status);
  }

  const retryable = isStatusRetryable(status);

  // Clean error message: scrub potential key query strings or parameters
  let cleanMessage = (err && err.message) ? String(err.message) : 'Gemini API call failed';
  cleanMessage = cleanMessage.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');

  return new AiApiError(cleanMessage, status, retryable);
}

/**
 * Asserts that the necessary Gemini environment variables are set.
 * Fails fast before attempting to initiate network calls.
 */
function assertGeminiConfigured() {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
    throw new Error('GEMINI_API_KEY is not defined. Please set it in server/.env');
  }
  if (!process.env.GEMINI_MODEL || !process.env.GEMINI_MODEL.trim()) {
    throw new Error('GEMINI_MODEL is not defined. Please set it in server/.env (e.g. gemini-flash-latest)');
  }
}

// JSON response schema mirroring the required fields for Gemini structured output
const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      sentiment: {
        type: Type.STRING,
        enum: SENTIMENTS,
      },
      topics: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
          enum: TOPICS,
        },
      },
      summary: { type: Type.STRING },
      needs_reply: { type: Type.BOOLEAN },
    },
    required: ['id', 'sentiment', 'topics', 'summary', 'needs_reply'],
  },
};

/**
 * analyseBatch(reviews)
 * Sends a batch of reviews to Gemini for classification.
 * Returns ONLY the raw JSON text response from the model.
 * Does not perform validation here (the validation layer in schemas/analysis.js handles that).
 */
async function analyseBatch(reviews) {
  assertGeminiConfigured();

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return '[]';
  }

  const apiVersion = process.env.GEMINI_API_VERSION || 'v1beta';
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    apiVersion,
  });
  const userContent = buildAnalysisUserContent(reviews);
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

  let timeoutTimer;
  try {
    const apiCallPromise = ai.models.generateContent({
      model: process.env.GEMINI_MODEL,
      contents: userContent,
      config: {
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
        temperature: 0, // Deterministic classification
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    // Enforce request timeout to protect batch workers from indefinitely hanging
    const timeoutPromise = new Promise((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new AiApiError(`Gemini request timed out after ${timeoutMs}ms`, null, true));
      }, timeoutMs);
    });

    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    return response.text;
  } catch (err) {
    if (err instanceof AiApiError) {
      throw err;
    }
    throw wrapGeminiError(err);
  } finally {
    // Always clear the timer to prevent orphaned timers or unhandled libuv handle leaks on Windows
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
  }
}

module.exports = {
  AiApiError,
  isStatusRetryable,
  wrapGeminiError,
  assertGeminiConfigured,
  analyseBatch,
};
