const express = require('express');
const { getAllReviews } = require('../services/store');

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

module.exports = router;
