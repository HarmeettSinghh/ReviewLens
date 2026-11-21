const request = require('supertest');

// In-memory mock database of reviews
const mockReviewsDb = new Map();

jest.mock('../services/store', () => ({
  getAllReviews: jest.fn(async () => Array.from(mockReviewsDb.values())),
  getReviewById: jest.fn(async (id) => {
    const numericId = Number(id);
    if (!Number.isNaN(numericId) && mockReviewsDb.has(numericId)) {
      return mockReviewsDb.get(numericId);
    }
    for (const r of mockReviewsDb.values()) {
      if (r.reviewId === String(id)) {
        return r;
      }
    }
    return null;
  }),
  saveSuggestedReply: jest.fn(async (reviewDbId, text) => {
    const numericId = Number(reviewDbId);
    if (mockReviewsDb.has(numericId)) {
      const review = mockReviewsDb.get(numericId);
      review.suggestedReply = text;
      return review;
    }
    for (const r of mockReviewsDb.values()) {
      if (r.reviewId === String(reviewDbId)) {
        r.suggestedReply = text;
        return r;
      }
    }
  }),
}));

const mockGenerateReply = jest.fn();
jest.mock('../services/gemini', () => {
  const actual = jest.requireActual('../services/gemini');
  return {
    ...actual,
    generateReply: (...args) => mockGenerateReply(...args),
  };
});

// Require app AFTER mocking store and gemini
const app = require('../app');

describe('POST /api/reviews/:id/reply endpoints', () => {
  beforeEach(() => {
    mockReviewsDb.clear();
    mockGenerateReply.mockReset();

    // Populate a standard review needing reply
    mockReviewsDb.set(12, {
      id: 12,
      reviewId: 'R012',
      product: 'AeroFit Running Shoes',
      cleanText: 'Sole detached after two runs. Terrible build quality.',
      status: 'analysed',
      needsReply: true,
      suggestedReply: null,
    });

    // Populate a review NOT needing reply
    mockReviewsDb.set(5, {
      id: 5,
      reviewId: 'R005',
      product: 'AeroFit Running Shoes',
      cleanText: 'Best shoes I have ever owned! Highly recommend.',
      status: 'analysed',
      needsReply: false,
      suggestedReply: null,
    });

    // Populate a skipped review
    mockReviewsDb.set(20, {
      id: 20,
      reviewId: 'R020',
      product: 'SoundWave Earbuds',
      cleanText: '',
      status: 'skipped_empty',
      needsReply: null,
      suggestedReply: null,
    });
  });

  it('returns 404 when the review id does not exist', async () => {
    const res = await request(app)
      .post('/api/reviews/999/reply')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
    expect(mockGenerateReply).not.toHaveBeenCalled();
  });

  it('returns 400 when review needsReply is false', async () => {
    const res = await request(app)
      .post('/api/reviews/5/reply')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGenerateReply).not.toHaveBeenCalled();
  });

  it('returns 400 when review status is not "analysed"', async () => {
    const res = await request(app)
      .post('/api/reviews/20/reply')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockGenerateReply).not.toHaveBeenCalled();
  });

  it('generates and saves reply when none exists', async () => {
    mockGenerateReply.mockResolvedValueOnce(
      'We are very sorry to hear about the detached sole. Please contact support@example.com and we will make it right.'
    );

    const res = await request(app)
      .post('/api/reviews/R012/reply')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe(
      'We are very sorry to hear about the detached sole. Please contact support@example.com and we will make it right.'
    );
    expect(mockGenerateReply).toHaveBeenCalledTimes(1);

    // Verify it was saved to the review
    const updatedReview = mockReviewsDb.get(12);
    expect(updatedReview.suggestedReply).toBe(res.body.reply);
  });

  it('returns the previously saved reply without calling the AI again', async () => {
    // Pre-populate saved reply
    mockReviewsDb.get(12).suggestedReply = 'Pre-existing cached reply from earlier.';

    const res = await request(app)
      .post('/api/reviews/12/reply')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Pre-existing cached reply from earlier.');
    // The AI should NOT have been called!
    expect(mockGenerateReply).not.toHaveBeenCalled();
  });

  it('calls the AI again when regenerate is true even if a reply is already saved', async () => {
    mockReviewsDb.get(12).suggestedReply = 'Old reply.';
    mockGenerateReply.mockResolvedValueOnce('Brand new regenerated reply.');

    const res = await request(app)
      .post('/api/reviews/12/reply')
      .send({ regenerate: true });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Brand new regenerated reply.');
    expect(mockGenerateReply).toHaveBeenCalledTimes(1);

    // Verify updated in database
    expect(mockReviewsDb.get(12).suggestedReply).toBe('Brand new regenerated reply.');
  });

  it('returns friendly 502 JSON error when AI generation fails', async () => {
    mockGenerateReply.mockRejectedValueOnce(new Error('AI generation failure'));

    const res = await request(app)
      .post('/api/reviews/12/reply')
      .send({});

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Failed to generate customer support reply. Please try again later.');
  });
});
