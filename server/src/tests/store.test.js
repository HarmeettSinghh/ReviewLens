const fs = require('fs');
const path = require('path');

// Configure isolated test database file before db/store is loaded
const devDbPath = path.resolve(__dirname, '../../prisma/dev.db');
const testDbPath = path.resolve(__dirname, '../../prisma/test.db');

process.env.DATABASE_URL = 'file:./test.db';

// Copy the migrated dev.db schema to test.db if test.db does not exist yet
if (fs.existsSync(devDbPath) && !fs.existsSync(testDbPath)) {
  fs.copyFileSync(devDbPath, testDbPath);
}

const prisma = require('../db');
const {
  getCachedAnalyses,
  saveCachedAnalyses,
  replaceReviews,
  saveUploadRun,
  getAllReviews,
  getLatestUploadRun,
} = require('../services/store');

describe('Database Store service tests (using isolated test.db)', () => {
  // Clean all tables between tests to ensure test isolation
  beforeEach(async () => {
    await prisma.analysisCache.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.uploadRun.deleteMany({});
  });

  afterAll(async () => {
    // Disconnect prisma client so Jest can exit cleanly
    await prisma.$disconnect();
    // Clean up test database file if desired
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignored if file lock is held temporarily
      }
    }
  });

  describe('AnalysisCache operations', () => {
    it('saves and fetches cached analysis entries and parses topics back to arrays', async () => {
      const entries = [
        {
          textHash: 'hash123',
          sentiment: 'positive',
          topics: ['quality', 'packaging'],
          summary: 'Great bottle and secure packaging.',
          needsReply: false,
        },
      ];

      await saveCachedAnalyses(entries);

      const cacheMap = await getCachedAnalyses(['hash123', 'nonexistent_hash']);
      expect(cacheMap.size).toBe(1);

      const cachedItem = cacheMap.get('hash123');
      expect(cachedItem).toBeDefined();
      expect(cachedItem.sentiment).toBe('positive');
      expect(cachedItem.topics).toEqual(['quality', 'packaging']);
      expect(cachedItem.summary).toBe('Great bottle and secure packaging.');
      expect(cachedItem.needsReply).toBe(false);
    });

    it('skips existing hashes when saving without throwing unique constraint errors', async () => {
      const entry = {
        textHash: 'hash_dup',
        sentiment: 'neutral',
        topics: ['delivery'],
        summary: 'On time delivery.',
        needsReply: false,
      };

      // Save first time
      await saveCachedAnalyses([entry]);

      // Save same hash second time (should skip)
      const secondSave = await saveCachedAnalyses([entry]);
      expect(secondSave).toEqual([]);

      const cacheMap = await getCachedAnalyses(['hash_dup']);
      expect(cacheMap.size).toBe(1);
    });
  });

  describe('replaceReviews transaction', () => {
    it('completely deletes old reviews and inserts new ones inside ONE transaction', async () => {
      const initialBatch = [
        {
          reviewId: 'R001',
          product: 'Old Product',
          rating: 3,
          originalText: 'Old text',
          cleanText: 'old text',
          textHash: 'hash_old',
          status: 'analysed',
          sentiment: 'neutral',
          topics: ['price'],
          summary: 'Average price.',
        },
      ];

      await replaceReviews(initialBatch);
      let reviews = await getAllReviews();
      expect(reviews).toHaveLength(1);
      expect(reviews[0].reviewId).toBe('R001');

      // Now replace with a completely different batch
      const newBatch = [
        {
          reviewId: 'R002',
          product: 'New Product A',
          rating: 5,
          originalText: 'New text A',
          cleanText: 'new text a',
          textHash: 'hash_new_a',
          status: 'analysed',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Super quality.',
        },
        {
          reviewId: 'R003',
          product: 'New Product B',
          rating: 1,
          originalText: 'New text B',
          cleanText: 'new text b',
          textHash: 'hash_new_b',
          status: 'analysis_failed',
          sentiment: null,
          topics: null,
          summary: null,
        },
      ];

      await replaceReviews(newBatch);
      reviews = await getAllReviews();

      // Old review R001 must be gone; only R002 and R003 should exist
      expect(reviews).toHaveLength(2);
      expect(reviews.map((r) => r.reviewId)).toEqual(['R002', 'R003']);
      expect(reviews[0].topics).toEqual(['quality']);
      expect(reviews[1].topics).toBeNull();
    });
  });

  describe('UploadRun operations', () => {
    it('saves and retrieves the latest upload run metadata', async () => {
      const run1 = await saveUploadRun({
        fileName: 'batch1.csv',
        totalRows: 10,
        analysedCount: 8,
        duplicateCount: 1,
        skippedCount: 1,
        failedCount: 0,
        aiCalls: 8,
        cacheHits: 0,
        durationMs: 1200,
      });

      const run2 = await saveUploadRun({
        fileName: 'batch2.csv',
        totalRows: 30,
        analysedCount: 20,
        duplicateCount: 2,
        skippedCount: 1,
        failedCount: 0,
        aiCalls: 5,
        cacheHits: 15,
        durationMs: 800,
      });

      const latest = await getLatestUploadRun();
      expect(latest).toBeDefined();
      expect(latest.id).toBe(run2.id);
      expect(latest.fileName).toBe('batch2.csv');
      expect(latest.cacheHits).toBe(15);
    });
  });
});
