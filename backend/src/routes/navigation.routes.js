/**
 * Navigation Routes
 * 
 * Indoor navigation and book finding endpoints.
 */

const express = require('express');
const router = express.Router();
const navigationController = require('../controllers/navigation.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validationRules, handleValidationErrors } = require('../middleware/validator.middleware');

// Find a book (get navigation guidance)
router.get(
  '/find/:bookId',
  authenticate,
  validationRules.idParam,
  handleValidationErrors,
  navigationController.findBook
);

module.exports = router;
