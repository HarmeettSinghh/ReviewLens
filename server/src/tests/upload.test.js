const request = require('supertest');
const path = require('path');
const fs = require('fs');

// In-memory fake database state (prefixed with 'mock' so Jest allows access inside jest.mock)
const mockInMemoryCache = new Map();
const mockInMemoryReviews = [];
let mockUploadRunLog = null;

// Mock store service (in-memory)
jest.mock('../services/store', () => ({
  getCachedAnalyses: jest.fn(async (hashes) => {
    const res = new Map();
    for (const h of hashes) {
      if (mockInMemoryCache.has(h)) {
        res.set(h, mockInMemoryCache.get(h));
      }
    }
    return res;
  }),
  saveCachedAnalyses: jest.fn(async (entries) => {
    for (const e of entries) {
      mockInMemoryCache.set(e.textHash, e);
    }
  }),
  replaceReviews: jest.fn(async (rows) => {
    mockInMemoryReviews.length = 0;
    mockInMemoryReviews.push(...rows);
  }),
  saveUploadRun: jest.fn(async (data) => {
    mockUploadRunLog = data;
    return data;
  }),
  getAllReviews: jest.fn(async () => mockInMemoryReviews),
  getLatestUploadRun: jest.fn(async () => mockUploadRunLog),
}));

// Mock gemini configuration check
jest.mock('../services/gemini', () => {
  const actual = jest.requireActual('../services/gemini');
  return {
    ...actual,
    assertGeminiConfigured: jest.fn(), // Pass by default
  };
});

// Mock analyzer service
jest.mock('../services/analyzer', () => ({
  analyseReviews: jest.fn(async (reviews) => {
    const results = new Map();
    for (const r of reviews) {
      results.set(r.textHash, {
        sentiment: 'positive',
        topics: ['quality'],
        summary: `Analyzed summary for ${r.reviewId}`,
        needsReply: false,
      });
    }
    return {
      results,
      failedHashes: new Set(),
      aiCalls: Math.ceil(reviews.length / 5),
    };
  }),
}));

const app = require('../app');
const { analyseReviews } = require('../services/analyzer');

describe('Upload API endpoint tests (POST /api/upload)', () => {
  const csvPath = path.resolve(__dirname, '../../../reviews.csv');

  beforeEach(() => {
    mockInMemoryCache.clear();
    mockInMemoryReviews.length = 0;
    mockUploadRunLog = null;
    jest.clearAllMocks();
  });

  // Test 1: Uploading real reviews.csv returns expected counts
  it('processes reviews.csv and returns expected counts (28 valid, 1 skipped, 1 duplicate)', async () => {
    expect(fs.existsSync(csvPath)).toBe(true);

    const res = await request(app)
      .post('/api/upload')
      .attach('file', csvPath);

    expect(res.status).toBe(200);
    expect(res.body.totalRows).toBe(30);
    expect(res.body.analysedCount).toBe(28);
    expect(res.body.duplicateCount).toBe(1);
    expect(res.body.skippedCount).toBe(1);
    expect(res.body.failedCount).toBe(0);
    expect(res.body.cacheHits).toBe(0);
    expect(res.body.aiCalls).toBeGreaterThan(0);
  });

  // Test 2: Uploading the same file a second time gives aiCalls = 0 and cacheHits = 28
  it('serves reviews from cache on second upload with aiCalls = 0 and cacheHits = 28', async () => {
    // First upload: populates inMemoryCache
    const firstRes = await request(app)
      .post('/api/upload')
      .attach('file', csvPath);

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.cacheHits).toBe(0);
    expect(firstRes.body.aiCalls).toBeGreaterThan(0);

    // Second upload: all 28 valid reviews should hit the cache
    const secondRes = await request(app)
      .post('/api/upload')
      .attach('file', csvPath);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.totalRows).toBe(30);
    expect(secondRes.body.analysedCount).toBe(28);
    expect(secondRes.body.duplicateCount).toBe(1);
    expect(secondRes.body.skippedCount).toBe(1);
    expect(secondRes.body.failedCount).toBe(0);
    expect(secondRes.body.cacheHits).toBe(28);
    expect(secondRes.body.aiCalls).toBe(0);
  });

  // Test 3: Validation: No file -> 400. Non-CSV file -> 400.
  it('returns 400 when no file is uploaded', async () => {
    const res = await request(app).post('/api/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error).toContain('No file uploaded');
  });

  it('returns 400 when a non-CSV file is uploaded', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('not a csv file'), 'notes.txt');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error).toContain('Only .csv files');
  });

  // Test 4: Fake analyzer that fails one hash -> review ends as analysis_failed, response is 200
  it('marks review as analysis_failed when analyzer fails one hash and returns HTTP 200', async () => {
    // Override analyzer to omit R001 from results and mark its hash failed
    analyseReviews.mockImplementationOnce(async (reviews) => {
      const results = new Map();
      const failedHashes = new Set();

      reviews.forEach((r, idx) => {
        if (idx === 0) {
          failedHashes.add(r.textHash);
        } else {
          results.set(r.textHash, {
            sentiment: 'positive',
            topics: ['quality'],
            summary: `Summary of ${r.reviewId}`,
            needsReply: false,
          });
        }
      });

      return {
        results,
        failedHashes,
        aiCalls: 6,
      };
    });

    const res = await request(app)
      .post('/api/upload')
      .attach('file', csvPath);

    expect(res.status).toBe(200);
    expect(res.body.totalRows).toBe(30);
    expect(res.body.analysedCount).toBe(27);
    expect(res.body.failedCount).toBe(1);

    // Verify stored review row has status 'analysis_failed'
    const failedReview = mockInMemoryReviews.find((r) => r.status === 'analysis_failed');
    expect(failedReview).toBeDefined();
    expect(failedReview.reviewId).toBe('R001');
  });
});
