const crypto = require('crypto');
const { parse } = require('csv-parse/sync');

/**
 * 1. parseCsv(csvString)
 * Parses a raw CSV string using csv-parse/sync.
 * Enforces lowercase trimmed header names and verifies that required
 * columns ('review_text' and 'product') exist.
 */
function parseCsv(csvString) {
  if (typeof csvString !== 'string' || !csvString.trim()) {
    throw new Error('CSV parsing failed: File is empty or contains only whitespace.');
  }

  let headers = [];
  let records;

  try {
    records = parse(csvString, {
      // Lowercase and trim all header names to make column detection case/space-insensitive
      columns: (headerList) => {
        headers = headerList.map((header) => (header ? header.trim().toLowerCase() : ''));
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
      bom: true, // Safely handles UTF-8 Byte Order Mark if present
      relax_column_count: true, // Avoids crashing on rows with slightly uneven columns
    });
  } catch (err) {
    throw new Error(`CSV parsing failed: ${err.message}`);
  }

  // Validate that required columns are present in the parsed header list
  const hasReviewText = headers.includes('review_text');
  const hasProduct = headers.includes('product');

  if (!hasReviewText || !hasProduct) {
    const missing = [];
    if (!hasProduct) missing.push('product');
    if (!hasReviewText) missing.push('review_text');
    throw new Error(`CSV missing required column(s): ${missing.join(', ')}`);
  }

  return records;
}

/**
 * 2. cleanText(raw)
 * Sanitizes review text by stripping HTML tags, decoding common entities,
 * collapsing whitespace/newlines into single spaces, and trimming.
 * Preserves Hindi, Devanagari, and emoji characters.
 */
function cleanText(raw) {
  if (raw === null || raw === undefined) {
    return '';
  }

  let text = String(raw);

  // Strip all HTML tags (e.g. <b>, </div>, <p>)
  text = text.replace(/<[^>]*>/g, '');

  // Decode common HTML entities to standard characters
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  // Collapse all whitespace sequences (tabs, newlines, multiple spaces) into a single space
  text = text.replace(/\s+/g, ' ');

  // Trim leading and trailing whitespace
  return text.trim();
}

/**
 * 3. normalizeRating(raw)
 * Normalizes customer ratings into an integer 1-5 or null.
 * Non-numeric words, out-of-range numbers, and empty values return null ("unknown").
 */
function normalizeRating(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }

  const str = String(raw).trim();
  if (str === '') {
    return null;
  }

  const num = Number(str);
  // Reject non-numeric input (e.g. "five") and values outside the 1 to 5 range (e.g. 0, 6, 9)
  if (isNaN(num) || num < 1 || num > 5) {
    return null;
  }

  // Round to nearest integer to guarantee a clean 1-5 integer representation
  return Math.round(num);
}

/**
 * 4. hashText(cleanedText)
 * Generates a SHA-256 hex digest of the text after lowercasing and collapsing whitespace.
 * This guarantees consistent duplicate detection even if trivial case/space differences exist.
 */
function hashText(cleanedText) {
  if (!cleanedText || typeof cleanedText !== 'string') {
    return '';
  }

  // Lowercase and trim to eliminate trivial casing and space variations
  const normalized = cleanedText.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * 5. cleanReviews(csvString)
 * Coordinates parsing, cleaning, rating normalization, deduplication, and status assignment.
 * Returns an array of review objects in the exact file order.
 */
function cleanReviews(csvString) {
  const records = parseCsv(csvString);
  const seenHashes = new Map(); // Tracks textHash -> first reviewId to detect duplicates

  return records.map((row, index) => {
    try {
      // Use existing review identifier or generate a stable fallback like ROW-1, ROW-2
      const rawId = row.review_id || row.reviewid || row.id || row['review id'];
      const reviewId = rawId && String(rawId).trim() ? String(rawId).trim() : `ROW-${index + 1}`;

      const product = row.product ? String(row.product).trim() : '';
      const rating = normalizeRating(row.rating);
      const date = row.date && String(row.date).trim() ? String(row.date).trim() : null;

      const originalText = row.review_text !== undefined && row.review_text !== null
        ? String(row.review_text)
        : '';

      const cleaned = cleanText(originalText);
      const textHash = hashText(cleaned);

      let status = 'valid';
      let duplicateOf = null;

      if (!cleaned) {
        // Empty reviews cannot be analyzed by AI and should not duplicate each other
        status = 'skipped_empty';
      } else if (seenHashes.has(textHash)) {
        // Text hash matches an earlier review: mark as duplicate and reference original reviewId
        status = 'duplicate';
        duplicateOf = seenHashes.get(textHash);
      } else {
        // Unique non-empty review: register in map and mark valid for AI processing
        status = 'valid';
        seenHashes.set(textHash, reviewId);
      }

      return {
        reviewId,
        product,
        rating,
        date,
        originalText,
        cleanText: cleaned,
        textHash,
        status,
        duplicateOf,
      };
    } catch (err) {
      // Individual row parsing error must not fail the rest of the batch
      return {
        reviewId: `ROW-${index + 1}`,
        product: row && row.product ? String(row.product).trim() : '',
        rating: null,
        date: null,
        originalText: '',
        cleanText: '',
        textHash: '',
        status: 'skipped_empty',
        duplicateOf: null,
      };
    }
  });
}

module.exports = {
  parseCsv,
  cleanText,
  normalizeRating,
  hashText,
  cleanReviews,
};
