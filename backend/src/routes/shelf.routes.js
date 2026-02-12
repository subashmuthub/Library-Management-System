/**
 * Shelf Routes
 * 
 * Shelf information and book location endpoints.
 */

const express = require('express');
const router = express.Router();
const shelfController = require('../controllers/shelf.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validationRules, handleValidationErrors } = require('../middleware/validator.middleware');

// List all shelves
router.get('/', authenticate, shelfController.listShelves);

// Get shelf by ID
router.get(
  '/:id',
  authenticate,
  validationRules.idParam,
  handleValidationErrors,
  shelfController.getShelfById
);

// Get books on specific shelf
router.get(
  '/:id/books',
  authenticate,
  validationRules.idParam,
  handleValidationErrors,
  shelfController.getBooksOnShelf
);

module.exports = router;
