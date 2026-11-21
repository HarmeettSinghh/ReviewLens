const fs = require('fs');
const path = require('path');
const {
  parseCsv,
  cleanText,
  normalizeRating,
  hashText,
  cleanReviews,
} = require('../services/csvCleaner');

describe('csvCleaner service unit and integration tests', () => {
  // Test 1: cleanText
  describe('cleanText', () => {
    it('strips <b>tags</b>, collapses multi-line text, and keeps Hindi + emoji', () => {
      const raw = '<b>Great product!</b>\n\nयह बहुत अच्छा है!   \t Line 2 😊 &amp; &quot;quoted&quot;';
      const cleaned = cleanText(raw);

      // Verify HTML tags were stripped
      expect(cleaned).not.toContain('<b>');
      expect(cleaned).not.toContain('</b>');
      expect(cleaned).toContain('Great product!');

      // Verify Hindi characters and emoji are kept intact
      expect(cleaned).toContain('यह बहुत अच्छा है!');
      expect(cleaned).toContain('😊');

      // Verify entities are decoded
      expect(cleaned).toContain('&');
      expect(cleaned).toContain('"quoted"');

      // Verify newlines and extra spaces are collapsed into single spaces
      expect(cleaned).not.toMatch(/\s{2,}/);
      expect(cleaned).not.toContain('\n');
    });

    it('returns empty string for null, undefined, or empty values', () => {
      expect(cleanText(null)).toBe('');
      expect(cleanText(undefined)).toBe('');
      expect(cleanText('   ')).toBe('');
      expect(cleanText('<p></p>')).toBe('');
    });
  });

  // Test 2: normalizeRating
  describe('normalizeRating', () => {
    it('normalizes ratings correctly: "5" -> 5, "" -> null, "five" -> null, "9" -> null', () => {
      expect(normalizeRating('5')).toBe(5);
      expect(normalizeRating(5)).toBe(5);
      expect(normalizeRating('')).toBeNull();
      expect(normalizeRating(null)).toBeNull();
      expect(normalizeRating('five')).toBeNull();
      expect(normalizeRating('9')).toBeNull();
      expect(normalizeRating(0)).toBeNull();
      expect(normalizeRating(6)).toBeNull();
    });
  });

  // Test 3: duplicate detection
  describe('duplicate detection and empty skipping', () => {
    it('marks identical text in two rows as duplicate with correct duplicateOf', () => {
      const csv = `product,review_text\nWidget A,Super battery life!\nWidget A,  super battery life!  `;
      const results = cleanReviews(csv);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('valid');
      expect(results[0].duplicateOf).toBeNull();

      expect(results[1].status).toBe('duplicate');
      expect(results[1].duplicateOf).toBe(results[0].reviewId);
    });

    it('marks empty review text as skipped_empty and does not treat empty rows as duplicates', () => {
      const csv = `product,review_text\nProduct 1,   <br>  \nProduct 2,   `;
      const results = cleanReviews(csv);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('skipped_empty');
      expect(results[0].duplicateOf).toBeNull();

      expect(results[1].status).toBe('skipped_empty');
      expect(results[1].duplicateOf).toBeNull();
    });
  });

  // Test 4: parseCsv validation
  describe('parseCsv validation', () => {
    it('throws a user-friendly error when required columns are missing', () => {
      const invalidCsv = `id,rating\n1,5`;
      expect(() => parseCsv(invalidCsv)).toThrow(/missing required column/i);
    });
  });

  // Test 5: Integration test with reviews.csv
  describe('Integration test reading reviews.csv', () => {
    it('expects 30 rows total, exactly 1 skipped_empty (R005), exactly 1 duplicate (R015 duplicate of R012), 28 valid, and rating null for R010 and R022', () => {
      // Find reviews.csv in repo root (or fallback to server directory)
      const rootPath = path.resolve(__dirname, '../../../reviews.csv');
      const serverPath = path.resolve(__dirname, '../../reviews.csv');
      const csvPath = fs.existsSync(rootPath) ? rootPath : serverPath;

      expect(fs.existsSync(csvPath)).toBe(true);

      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const reviews = cleanReviews(csvContent);

      // 1. Total rows = 30
      expect(reviews).toHaveLength(30);

      // 2. Exactly 1 skipped_empty (R005)
      const skipped = reviews.filter((r) => r.status === 'skipped_empty');
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reviewId).toBe('R005');

      // 3. Exactly 1 duplicate (R015, duplicateOf R012)
      const duplicates = reviews.filter((r) => r.status === 'duplicate');
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].reviewId).toBe('R015');
      expect(duplicates[0].duplicateOf).toBe('R012');

      // 4. Exactly 28 valid reviews
      const valid = reviews.filter((r) => r.status === 'valid');
      expect(valid).toHaveLength(28);

      // 5. Rating null for R010 and R022
      const r010 = reviews.find((r) => r.reviewId === 'R010');
      const r022 = reviews.find((r) => r.reviewId === 'R022');

      expect(r010).toBeDefined();
      expect(r010.rating).toBeNull();

      expect(r022).toBeDefined();
      expect(r022.rating).toBeNull();
    });
  });
});
