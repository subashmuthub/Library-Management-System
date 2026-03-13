/**
 * Authentication Routes
 * 
 * Handles user registration and login.
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validationRules, handleValidationErrors } = require('../middleware/validator.middleware');

// Register new user
router.post(
  '/register',
  validationRules.register,
  handleValidationErrors,
  authController.register
);

// Login
router.post(
  '/login',
  validationRules.login,
  handleValidationErrors,
  authController.login
);

// Logout
router.post('/logout', authController.logout);

// Get current session user (frontend calls this on page load to verify session)
router.get('/me', authController.me);

module.exports = router;
