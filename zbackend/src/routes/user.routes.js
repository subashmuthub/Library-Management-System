/**
 * User Routes
 * 
 * User profile and management endpoints.
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
// const { authenticate, authorize } = require('../middleware/auth.middleware');

// Get current user profile
router.get('/profile', userController.getProfile);

// Update user profile
router.put('/profile', userController.updateProfile);

// List all users (must come before /:id to avoid route collision)
router.get('/', userController.listUsers);

// Get user by ID (must come after / to avoid matching everything)
router.get('/:id', userController.getUserById);

module.exports = router;
