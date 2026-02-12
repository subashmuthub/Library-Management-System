/**
 * User Routes
 * 
 * User profile and management endpoints.
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Get current user profile
router.get('/profile', authenticate, userController.getProfile);

// Get user by ID (admin/librarian only)
router.get('/:id', authenticate, authorize(['admin', 'librarian']), userController.getUserById);

// Update user profile
router.put('/profile', authenticate, userController.updateProfile);

// List all users (admin only)
router.get('/', authenticate, authorize(['admin']), userController.listUsers);

module.exports = router;
