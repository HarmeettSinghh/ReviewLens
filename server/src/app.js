const express = require('express');
const cors = require('cors');
const multer = require('multer');
const healthRoutes = require('./routes/health');
const uploadRoutes = require('./routes/upload');
const reviewsRoutes = require('./routes/reviews');
const statsRoutes = require('./routes/stats');

const app = express();

// Enable Cross-Origin Resource Sharing so the frontend client can communicate with this API.
app.use(cors());

// Parse incoming JSON request bodies into req.body for handlers to use.
app.use(express.json());

// Mount API routes under the /api path prefix.
app.use('/api', healthRoutes);
app.use('/api', uploadRoutes);
app.use('/api', reviewsRoutes);
app.use('/api', statsRoutes);

// Centralized JSON error-handling middleware.
// Ensures errors never return HTML, stack traces, or leak secrets.
app.use((err, req, res, next) => {
  // Map Multer file size limit to HTTP 413 Payload Too Large
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Maximum allowed size is 2 MB.',
    });
  }

  // General Multer errors -> HTTP 400
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.message,
    });
  }

  // Bad CSV or validation errors -> HTTP 400
  if (err.statusCode === 400 || (err.message && err.message.toLowerCase().includes('csv'))) {
    return res.status(400).json({
      error: err.message,
    });
  }

  // Missing Gemini configuration -> HTTP 500
  if (err.message && (err.message.includes('GEMINI_API_KEY') || err.message.includes('GEMINI_MODEL'))) {
    return res.status(500).json({
      error: err.message,
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.message || 'An unexpected error occurred.',
  });
});

module.exports = app;
