/**
 * Overdue Alert Routes
 * Base: /api/v1/overdue
 */

const express = require('express');
const router = express.Router();
const OverdueController = require('../controllers/overdue.controller');

/**
 * GET /api/v1/overdue/summary
 * Admin/librarian: aggregate overdue stats (count, highest fine, etc.)
 */
router.get('/summary', OverdueController.getSummary);

/**
 * GET /api/v1/overdue/list
 * Paginated list of all overdue records.
 * Query: page, limit, userId
 */
router.get('/list', OverdueController.getList);

/**
 * POST /api/v1/overdue/run-check
 * Manually trigger the overdue scan (useful for testing).
 */
router.post('/run-check', OverdueController.runCheck);

/**
 * GET /api/v1/overdue/notifications/:userId
 * Get in-app notifications for a specific user.
 * Query: limit, unread_only
 */
router.get('/notifications/:userId', OverdueController.getUserNotifications);

/**
 * PATCH /api/v1/overdue/notifications/:userId/mark-read
 * Mark notifications as read.
 * Body: { ids?: number[] }  — omit ids to mark ALL as read
 */
router.patch('/notifications/:userId/mark-read', OverdueController.markRead);

/**
 * GET /api/v1/overdue/trend/weekly
 * Weekly overdue trend (7-day breakdown).
 */
router.get('/trend/weekly', OverdueController.getWeeklyTrend);

module.exports = router;
