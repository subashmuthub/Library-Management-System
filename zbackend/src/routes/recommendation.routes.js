/**
 * Recommendation Routes
 * Base: /api/v1/recommendations
 */

const express = require('express');
const router = express.Router();
const RecommendationController = require('../controllers/recommendation.controller');

/**
 * GET /api/v1/recommendations/student/:studentId
 * Returns top-10 scored recommendations for a student.
 */
router.get('/student/:studentId', RecommendationController.getForStudent);

/**
 * GET /api/v1/recommendations/popular
 * Returns most borrowed books (global, no personalisation).
 * Query: limit
 */
router.get('/popular', RecommendationController.getPopular);

/**
 * POST /api/v1/recommendations/refresh-cache
 * Manually trigger a popularity cache refresh.
 */
router.post('/refresh-cache', RecommendationController.refreshCache);

module.exports = router;
