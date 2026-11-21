const express = require('express');
const multer = require('multer');
const path = require('path');
const { assertGeminiConfigured } = require('../services/gemini');
const { processUpload } = require('../services/processUpload');

const router = express.Router();

// Configure multer with in-memory buffer storage and 2 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.csv') {
      const err = new Error('Invalid file type. Only .csv files are supported.');
      err.statusCode = 400;
      return cb(err, false);
    }
    cb(null, true);
  },
});

/**
 * POST /api/upload
 * Handles CSV file uploads, parses content, runs cache lookup,
 * coordinates AI batch analysis, and updates the database.
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    // 1. Verify file was provided
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded. Please upload a file with field name "file".',
      });
    }

    // 2. Validate Gemini API credentials before processing (fails fast with 500 if unconfigured)
    assertGeminiConfigured();

    // 3. Process the CSV file string buffer
    const csvString = req.file.buffer.toString('utf8');
    const summary = await processUpload(csvString, req.file.originalname);

    // 4. Return summary JSON
    return res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
