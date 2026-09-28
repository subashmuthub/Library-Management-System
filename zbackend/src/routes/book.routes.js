/**
 * Book Routes
 * 
 * Book search and information endpoints.
 */

const express = require('express');
const router = express.Router();
const bookController = require('../controllers/book.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
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
// Create new book
router.post(
  '/',
  authenticate,
  authorize(['admin', 'librarian']),
  bookController.createBook
);

// Update existing book
router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'librarian']),
  validationRules.idParam,
  handleValidationErrors,
  bookController.updateBook
);

// Delete book
router.delete(
  '/:id',
  authenticate,
  authorize(['admin', 'librarian']),
  validationRules.idParam,
  handleValidationErrors,
  bookController.deleteBook
);

module.exports = router;
