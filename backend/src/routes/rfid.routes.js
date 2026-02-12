/**
 * RFID Routes
 * 
 * RFID scanning and tag management endpoints.
 */

const express = require('express');
const router = express.Router();
const rfidController = require('../controllers/rfid.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { getModeConfig } = require('../config/mode');

// Scan RFID tag (mode-aware)
router.post(
  '/scan',
  authenticate,
  authorize(['librarian', 'admin']),
  rfidController.scanTag
);

// List all RFID tags
router.get(
  '/tags',
  authenticate,
  authorize(['librarian', 'admin']),
  rfidController.listTags
);

// Get system mode info
router.get('/mode', authenticate, (req, res) => {
  res.json(getModeConfig());
});

module.exports = router;
