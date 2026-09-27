/**
 * Library Dashboard Routes
 * Central dashboard endpoints for comprehensive library statistics
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const LibraryDashboardController = require('../controllers/library-dashboard.controller');
// const { authenticate } = require('../middleware/auth.middleware');

// Apply authentication to all routes (disabled for development)
// router.use(authenticate);

/**
 * GET /api/dashboard/stats
 * Get comprehensive dashboard statistics
 * Query params: period (days, default: 30)
 * Returns: today_metrics, overall_statistics, circulation_metrics, fine_statistics, popular_books, activity_trends, system_health
 */
router.get('/stats', LibraryDashboardController.getDashboardStats);

/**
 * GET /api/dashboard/status
 * Get real-time library status
 * Returns: occupancy, circulation, reservations, alerts, recent_activity
 */
router.get('/status', LibraryDashboardController.getLibraryStatus);

/**
 * GET /api/dashboard/book-analytics
 * Get book analytics and insights
 * Query params: period (days, default: 30)
 * Returns: category_analysis, high_demand_books, shelf_utilization
 */
router.get('/book-analytics', LibraryDashboardController.getBookAnalytics);

/**
 * GET /api/dashboard/user-insights
 * Get user behavior insights
 * Query params: period (days, default: 30)
 * Returns: role_insights, hourly_usage_pattern, user_retention
 */
router.get('/user-insights', LibraryDashboardController.getUserBehaviorInsights);

/**
 * GET /api/dashboard/top-students
 * Get top students by visits and borrow points
 * Query params: period (days, default: 30), limit (default: 20)
 */
router.get('/top-students', LibraryDashboardController.getTopStudentActivity);

/**
 * GET /api/dashboard/book-order-details
 * Get book order planning details with agent information
 * Query params: limit (default: 300)
 */
router.get('/book-order-details', LibraryDashboardController.getBookOrderAgentDetails);

/**
 * POST /api/dashboard/top-students/notify
 * Trigger recognition email to top student of selected period
 */
router.post('/top-students/notify', LibraryDashboardController.notifyTopStudentAward);

module.exports = router;