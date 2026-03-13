/**
 * Book Routes
 * 
 * Book search and information endpoints.
 */

const express = require('express');
const router = express.Router();
const bookController = require('../controllers/book.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validationRules, handleValidationErrors } = require('../middleware/validator.middleware');

// Search books
router.get(
  '/search',
  authenticate,
  validationRules.bookSearch,
  handleValidationErrors,
  bookController.searchBooks
);

// Get book by ID
router.get(
  '/:id',
  authenticate,
  validationRules.idParam,
  handleValidationErrors,
  bookController.getBookById
);

// Get book location history
router.get(
  '/:id/history',
  authenticate,
  validationRules.idParam,
  handleValidationErrors,
  bookController.getBookLocationHistory
);

module.exports = router;
