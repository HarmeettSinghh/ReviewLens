const express = require('express');
const { getAllReviews, getReviewById, saveSuggestedReply } = require('../services/store');
const { generateReply } = require('../services/gemini');

const router = express.Router();

/**
 * GET /api/reviews
 * Returns all reviews from the currently active dataset in file order (by id)
 * with topics parsed as JavaScript arrays.
 */
router.get('/reviews', async (req, res, next) => {
  try {
    const reviews = await getAllReviews();
    return res.status(200).json(reviews);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reviews/:id/reply
 * Generates or retrieves a suggested customer support reply for a review.
 *
 * Rules:
 * - 404 if the review does not exist.
 * - 400 if review's needsReply is not true or its status is not "analysed".
 * - If suggestedReply is already saved and body does not have { regenerate: true },
 *   returns saved reply without calling the AI.
 * - Otherwise generates via Gemini, saves, and returns { reply }.
 * - On AI failure, returns 502 friendly JSON error.
 */
router.post('/reviews/:id/reply', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { regenerate = false } = req.body || {};

    const review = await getReviewById(id);
    if (!review) {
      return res.status(404).json({ error: `Review ${id} not found.` });
    }

    if (!review.needsReply || review.status !== 'analysed') {
      return res.status(400).json({
        error: 'Only analysed reviews that require customer support attention can have suggested replies generated.',
      });
    }

    // Return previously saved reply if not explicitly asked to regenerate
    if (review.suggestedReply && !regenerate) {
      return res.status(200).json({ reply: review.suggestedReply });
    }

    // Generate fresh reply via Gemini
    try {
      const reply = await generateReply(review);
      await saveSuggestedReply(review.id, reply);
      return res.status(200).json({ reply });
    } catch (aiErr) {
      return res.status(502).json({
        error: 'Failed to generate customer support reply. Please try again later.',
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
