const express = require('express');
const router = express.Router();

// GET /api/health
// Simple health check endpoint so the frontend and monitoring tools can verify the server is alive.
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
