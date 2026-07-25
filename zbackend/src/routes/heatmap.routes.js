/**
 * Heatmap Analytics Routes
 * Base: /api/v1/heatmap
 */

const express = require('express');
const router = express.Router();
const HeatmapController = require('../controllers/heatmap.controller');

/**
 * GET /api/v1/heatmap
 * Full heatmap: all shelves with intensity scores.
 * Query: period (days, default 30), category
 */
router.get('/', HeatmapController.getHeatmap);

/**
 * GET /api/v1/heatmap/popular-shelves
 * Top-N most popular shelves.
 * Query: limit, period
 */
router.get('/popular-shelves', HeatmapController.getPopularShelves);

/**
 * GET /api/v1/heatmap/hourly
 * Hour-of-day traffic distribution (last 30 days).
 */
router.get('/hourly', HeatmapController.getHourlyStats);

/**
 * GET /api/v1/heatmap/daily-trend
 * Daily activity trend.
 * Query: period (days)
 */
router.get('/daily-trend', HeatmapController.getDailyTrend);

module.exports = router;
