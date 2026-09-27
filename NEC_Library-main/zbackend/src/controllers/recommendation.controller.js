/**
 * Recommendation Controller
 */

const RecommendationService = require('../services/recommendation.service');

class RecommendationController {

  /** GET /api/v1/recommendations/student/:studentId */
  static async getForStudent(req, res) {
    try {
      const userId = parseInt(req.params.studentId, 10);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid student ID' });
      }
      const recommendations = await RecommendationService.getRecommendations(userId);
      return res.json({ success: true, count: recommendations.length, recommendations });
    } catch (err) {
      console.error('[RecommendationController.getForStudent]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }

  /** GET /api/v1/recommendations/popular */
  static async getPopular(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const books = await RecommendationService.getPopularBooks(limit);
      return res.json({ success: true, count: books.length, books });
    } catch (err) {
      console.error('[RecommendationController.getPopular]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }

  /** POST /api/v1/recommendations/refresh-cache */
  static async refreshCache(req, res) {
    try {
      await RecommendationService.refreshPopularityCache();
      return res.json({ success: true, message: 'Popularity cache refreshed' });
    } catch (err) {
      console.error('[RecommendationController.refreshCache]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }
}

module.exports = RecommendationController;
