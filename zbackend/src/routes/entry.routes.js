/**
 * Entry Routes
 * 
 * Student entry/exit logging endpoints.
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const entryController = require('../controllers/entry.controller');
// const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validationRules, handleValidationErrors } = require('../middleware/validator.middleware');

// Log entry or exit
router.post(
  '/log',
  // authenticate,
  validationRules.entryLog,
  handleValidationErrors,
  entryController.logEntry
);

// Get entry history for current user
router.get('/history', entryController.getMyHistory);

// Get entry history for specific user (librarian/admin)
router.get(
  '/history/:userId',
  // authenticate,
  // authorize(['librarian', 'admin']),
  entryController.getUserHistory
);

// Get current occupancy (who's inside)
router.get(
  '/occupancy',
  // authenticate,
  // authorize(['librarian', 'admin']),
  entryController.getCurrentOccupancy
);

module.exports = router;
