const express = require('express');
const { getAllReviews, getLatestUploadRun } = require('../services/store');
const { computeStats } = require('../services/stats');

const router = express.Router();

/**
 * GET /api/stats
 * Computes dashboard statistics across the current dataset and includes
 * metadata from the latest upload run under `lastRun`.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [reviews, lastRun] = await Promise.all([
      getAllReviews(),
      getLatestUploadRun(),
    ]);

    const stats = computeStats(reviews);

    return res.status(200).json({
      ...stats,
      lastRun: lastRun || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
