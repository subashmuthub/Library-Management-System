/**
 * Library Dashboard Routes
 * Central dashboard endpoints for comprehensive library statistics
 */

const express = require('express');
const router = express.Router();
const LibraryDashboardController = require('../controllers/library-dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Apply authentication to all routes
router.use(authenticate);

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

module.exports = router;