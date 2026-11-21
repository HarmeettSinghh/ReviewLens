const {
  SENTIMENTS,
  TOPICS,
  analysisItemSchema,
  parseAiJson,
  validateBatch,
} = require('../schemas/analysis');

describe('Analysis schema and validation suite', () => {
  // Test 1: valid item passes
  describe('analysisItemSchema', () => {
    it('accepts a fully valid analysis item and deduplicates topics', () => {
      const validItem = {
        id: 'R001',
        sentiment: 'positive',
        topics: ['quality', 'quality', 'support'],
        summary: 'Excellent build quality and great customer service.',
        needs_reply: false,
      };

      const result = analysisItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('R001');
      expect(result.data.sentiment).toBe('positive');
      // Verify deduplication
      expect(result.data.topics).toEqual(['quality', 'support']);
      expect(result.data.needs_reply).toBe(false);
    });

    it('collapses multi-line summary into a single trimmed line', () => {
      const multilineItem = {
        id: 'R002',
        sentiment: 'neutral',
        topics: ['delivery'],
        summary: 'Arrived on time.\nPackaging was intact.\tNo complaints.',
        needs_reply: false,
      };

      const result = analysisItemSchema.safeParse(multilineItem);
      expect(result.success).toBe(true);
      expect(result.data.summary).toBe('Arrived on time. Packaging was intact. No complaints.');
    });

    // Test 2: specific failure cases required by prompt
    it('rejects invalid sentiment "mixed"', () => {
      const item = {
        id: 'R003',
        sentiment: 'mixed',
        topics: ['quality'],
        summary: 'Decent product.',
        needs_reply: false,
      };
      const result = analysisItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('rejects invalid topic "shipping"', () => {
      const item = {
        id: 'R004',
        sentiment: 'negative',
        topics: ['shipping'],
        summary: 'Took too long.',
        needs_reply: true,
      };
      const result = analysisItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('rejects empty topics array', () => {
      const item = {
        id: 'R005',
        sentiment: 'positive',
        topics: [],
        summary: 'Great item.',
        needs_reply: false,
      };
      const result = analysisItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('rejects string "true" for needs_reply without coercing types', () => {
      const item = {
        id: 'R006',
        sentiment: 'negative',
        topics: ['price'],
        summary: 'Too expensive.',
        needs_reply: 'true',
      };
      const result = analysisItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('rejects extra unknown fields in strict mode', () => {
      const item = {
        id: 'R007',
        sentiment: 'positive',
        topics: ['quality'],
        summary: 'Great quality.',
        needs_reply: false,
        extra_key: 'should fail',
      };
      const result = analysisItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });
  });

  // Test 3: parseAiJson
  describe('parseAiJson', () => {
    it('parses raw JSON array directly', () => {
      const raw = '[{"id":"R001"}]';
      expect(parseAiJson(raw)).toEqual([{ id: 'R001' }]);
    });

    it('parses JSON wrapped in markdown code fences (```json ... ```)', () => {
      const fenced = '```json\n[{"id":"R002"}]\n```';
      expect(parseAiJson(fenced)).toEqual([{ id: 'R002' }]);
    });

    it('parses and normalizes an object with { results: [...] } into an array', () => {
      const wrapped = '{"results": [{"id":"R003"}]}';
      expect(parseAiJson(wrapped)).toEqual([{ id: 'R003' }]);
    });

    it('rejects unparseable garbage with a clear error', () => {
      expect(() => parseAiJson('Not JSON at all')).toThrow(/Invalid JSON returned by AI/i);
      expect(() => parseAiJson('')).toThrow(/AI response is empty/i);
    });
  });

  // Test 4: validateBatch
  describe('validateBatch', () => {
    it('handles batch of 3 where 1 is valid, 1 is invalid, and 1 is missing', () => {
      const expectedIds = ['R001', 'R002', 'R003'];

      const parsedArray = [
        {
          id: 'R001',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Great product.',
          needs_reply: false,
        },
        {
          id: 'R002',
          sentiment: 'mixed', // Invalid sentiment
          topics: ['quality'],
          summary: 'Not sure.',
          needs_reply: false,
        },
        // R003 is missing
      ];

      const batchResult = validateBatch(parsedArray, expectedIds);

      // valid has exactly 1 item (R001)
      expect(batchResult.valid).toHaveLength(1);
      expect(batchResult.valid[0].id).toBe('R001');

      // invalidIds has the other 2 IDs (R002 and R003)
      expect(batchResult.invalidIds).toHaveLength(2);
      expect(batchResult.invalidIds).toContain('R002');
      expect(batchResult.invalidIds).toContain('R003');

      // errors list details both failures
      expect(batchResult.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('treats duplicate IDs as invalid', () => {
      const expectedIds = ['R001'];
      const parsedArray = [
        {
          id: 'R001',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Review copy 1',
          needs_reply: false,
        },
        {
          id: 'R001',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Review copy 2',
          needs_reply: false,
        },
      ];

      const batchResult = validateBatch(parsedArray, expectedIds);
      expect(batchResult.valid).toHaveLength(0);
      expect(batchResult.invalidIds).toEqual(['R001']);
    });

    it('ignores items whose id is not in expectedIds', () => {
      const expectedIds = ['R001'];
      const parsedArray = [
        {
          id: 'R001',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Valid review',
          needs_reply: false,
        },
        {
          id: 'R999', // Unknown id
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Unknown review',
          needs_reply: false,
        },
      ];

      const batchResult = validateBatch(parsedArray, expectedIds);
      expect(batchResult.valid).toHaveLength(1);
      expect(batchResult.valid[0].id).toBe('R001');
      expect(batchResult.invalidIds).toEqual([]);
    });
  });
});
