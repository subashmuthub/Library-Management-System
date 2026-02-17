/**
 * User Management Routes
 * Enhanced user operations for library management
 */

const express = require('express');
const router = express.Router();
const UserManagementController = require('../controllers/user-management.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/user-management
 * Get all users with library statistics
 * Query params: role, status, search, page, limit, sort_by, sort_order
 */
router.get('/', UserManagementController.getAllUsers);

/**
 * POST /api/user-management
 * Create new user account (admin/librarian only)
 * Body: { first_name, last_name, email, password, student_id?, phone?, address?, role_id?, status? }
 */
router.post('/', UserManagementController.createUser);

/**
 * GET /api/user-management/statistics
 * Get library usage statistics for all users
 * Query params: period (days)
 */
router.get('/statistics', UserManagementController.getLibraryUsageStatistics);

/**
 * GET /api/user-management/:userId
 * Get user details with full library activity
 */
router.get('/:userId', UserManagementController.getUserDetails);

/**
 * PUT /api/user-management/:userId
 * Update user information
 * Body: { first_name?, last_name?, email?, student_id?, phone?, address?, role_id?, status? }
 */
router.put('/:userId', UserManagementController.updateUser);

/**
 * POST /api/user-management/:userId/toggle-status
 * Activate/deactivate/suspend user account
 * Body: { status, reason? }
 */
router.post('/:userId/toggle-status', UserManagementController.toggleUserStatus);

/**
 * POST /api/user-management/:userId/reset-password
 * Reset user password (admin/librarian only)
 * Body: { new_password, temporary? }
 */
router.post('/:userId/reset-password', UserManagementController.resetUserPassword);

/**
 * GET /api/user-management/:userId/activity-log
 * Get user activity log
 * Query params: limit, page
 */
router.get('/:userId/activity-log', UserManagementController.getUserActivityLog);

module.exports = router;