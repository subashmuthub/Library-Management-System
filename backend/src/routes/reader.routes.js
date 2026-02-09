const express = require('express');
const router = express.Router();
const readerController = require('../controllers/reader.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * Reader Management Routes
 * All routes require authentication
 * Admin-only routes: create, update, delete, reset stats
 */

// GET /api/v1/readers/health - Get system-wide reader health statistics (MUST be before /:id)
router.get(
  '/health',
  authenticate,
  readerController.getReaderHealth
);

// GET /api/v1/readers - List all readers with health status
router.get(
  '/',
  authenticate,
  readerController.getAllReaders
);

// GET /api/v1/readers/:id - Get single reader details
router.get(
  '/:id',
  authenticate,
  readerController.getReaderById
);

// POST /api/v1/readers - Register new RFID reader (admin only)
router.post(
  '/',
  authenticate,
  authorize('admin'),
  readerController.createReader
);

// PUT /api/v1/readers/:id - Update reader (map to shelf, change status) (admin only)
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  readerController.updateReader
);

// POST /api/v1/readers/:id/reset - Reset reader statistics (admin only)
router.post(
  '/:id/reset',
  authenticate,
  authorize('admin'),
  readerController.resetReaderStats
);

module.exports = router;

