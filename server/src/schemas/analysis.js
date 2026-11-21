const { z } = require('zod');

// 1. Fixed constants for sentiment classifications and topic categories.
// Reusing these constants across prompts, validation schemas, and UI filters guarantees
// a single source of truth across the whole project.
const SENTIMENTS = ['positive', 'neutral', 'negative'];

const TOPICS = [
  'quality',
  'delivery',
  'price',
  'packaging',
  'support',
  'size_fit',
  'other',
];

// 2. Strict Zod schema for individual review analysis output from Gemini.
// Strict mode rejects any unexpected keys from the LLM, and no type coercion is applied
// so invalid types (like string "true" instead of boolean true) immediately fail validation.
const analysisItemSchema = z
  .object({
    id: z.string().trim().min(1, 'id must be a non-empty string'),
    sentiment: z.enum(SENTIMENTS, {
      errorMap: () => ({ message: `sentiment must be one of: ${SENTIMENTS.join(', ')}` }),
    }),
    topics: z
      .array(
        z.enum(TOPICS, {
          errorMap: () => ({ message: `topic must be one of: ${TOPICS.join(', ')}` }),
        })
      )
      .min(1, 'topics array must contain at least one valid topic')
      // Deduplicate topics in case the LLM repeats the same topic tag
      .transform((topics) => Array.from(new Set(topics))),
    summary: z
      .string()
      // Collapse multiline text and extra spaces into a single clean line
      .transform((text) => text.replace(/\s+/g, ' ').trim())
      .pipe(
        z
          .string()
          .min(1, 'summary cannot be empty')
          .max(200, 'summary must be at most 200 characters')
      ),
    needs_reply: z.boolean({
      invalid_type_error: 'needs_reply must be a strict boolean (true/false)',
    }),
  })
  .strict(); // Rejects extra/unknown fields to enforce exact AI contract

// 3. Robust parser for raw model output text.
// LLMs frequently wrap JSON in markdown fences (```json ... ```) or return { results: [...] }.
// This function strips fences if standard JSON.parse fails and normalizes output to an array.
function parseAiJson(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('AI response is empty or not a string.');
  }

  let parsed;

  // First attempt: direct JSON.parse
  try {
    parsed = JSON.parse(rawText);
  } catch (initialErr) {
    // Second attempt: extract JSON from markdown code fences (```json ... ``` or ``` ... ```)
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) {
      try {
        parsed = JSON.parse(fenceMatch[1].trim());
      } catch (fenceErr) {
        throw new Error(`Failed to parse JSON inside markdown code fences: ${fenceErr.message}`);
      }
    } else {
      throw new Error(`Invalid JSON returned by AI: ${initialErr.message}`);
    }
  }

  // Normalize: accept either a top-level array or an object wrapping an array (e.g. { results: [...] })
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.results)) return parsed.results;
    if (Array.isArray(parsed.items)) return parsed.items;
    if (Array.isArray(parsed.data)) return parsed.data;

    // Search object values for the first array property
    const arrayValue = Object.values(parsed).find(Array.isArray);
    if (arrayValue) return arrayValue;
  }

  throw new Error('AI JSON output must be an array or an object containing an array of items.');
}

// 4. Batch validator for validating an entire array of AI outputs against expected review IDs.
// Validates each item independently so that a failure in one review does not reject valid ones.
function validateBatch(parsedArray, expectedIds = []) {
  const expectedSet = new Set(expectedIds);
  const items = Array.isArray(parsedArray) ? parsedArray : [];

  // Count occurrences of each expected ID in the AI response to detect duplicates
  const idOccurrences = new Map();
  for (const item of items) {
    if (item && typeof item === 'object' && item.id !== undefined && item.id !== null) {
      const id = String(item.id);
      if (expectedSet.has(id)) {
        idOccurrences.set(id, (idOccurrences.get(id) || 0) + 1);
      }
    }
  }

  const validItems = [];
  const invalidIdSet = new Set();
  const errors = [];

  // If the same ID appears more than once, flag that ID as invalid
  for (const [id, count] of idOccurrences.entries()) {
    if (count > 1) {
      invalidIdSet.add(id);
      errors.push(`Review ID "${id}" appeared ${count} times in the batch (duplicates are invalid).`);
    }
  }

  // Validate each item individually against the Zod schema
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const id = item.id !== undefined && item.id !== null ? String(item.id) : null;

    // Items whose id is not in expectedIds are ignored
    if (!id || !expectedSet.has(id)) {
      continue;
    }

    // If ID was already marked invalid (e.g. duplicate occurrence), do not add to valid list
    if (invalidIdSet.has(id)) {
      continue;
    }

    const result = analysisItemSchema.safeParse(item);
    if (result.success) {
      validItems.push(result.data);
    } else {
      invalidIdSet.add(id);
      const formattedErrors = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'item'}: ${issue.message}`)
        .join(', ');
      errors.push(`Review ID "${id}" schema validation failed: ${formattedErrors}`);
    }
  }

  // Flag any expected ID that was completely missing from the AI response
  for (const expectedId of expectedIds) {
    const count = idOccurrences.get(expectedId) || 0;
    if (count === 0) {
      invalidIdSet.add(expectedId);
      errors.push(`Expected Review ID "${expectedId}" was missing from the AI response.`);
    }
  }

  return {
    valid: validItems,
    invalidIds: Array.from(invalidIdSet),
    errors,
  };
}

module.exports = {
  SENTIMENTS,
  TOPICS,
  analysisItemSchema,
  parseAiJson,
  validateBatch,
};
