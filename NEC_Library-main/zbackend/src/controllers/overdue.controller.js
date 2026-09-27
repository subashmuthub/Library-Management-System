/**
 * Overdue Alert Controller
 */

const OverdueService = require('../services/overdue.service');

class OverdueController {

  /** GET /api/v1/overdue/summary */
  static async getSummary(req, res) {
    try {
      const summary = await OverdueService.getSummary();
      return res.json({ success: true, summary });
    } catch (err) {
      console.error('[OverdueController.getSummary]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }

  /** GET /api/v1/overdue/list */
  static async getList(req, res) {
    try {
      const { page = 1, limit = 20, userId } = req.query;
      const result = await OverdueService.getOverdueList({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        userId: userId ? parseInt(userId, 10) : undefined,
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('[OverdueController.getList]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }

  /** POST /api/v1/overdue/run-check */
  static async runCheck(req, res) {
    try {
      const result = await OverdueService.runCheck();
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('[OverdueController.runCheck]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }

  /** GET /api/v1/overdue/notifications/:userId */
  static async getUserNotifications(req, res) {
    try {
      const userId = parseInt(req.params.userId, 10);
      const unreadOnly = req.query.unread_only === 'true';
      const limit = parseInt(req.query.limit, 10) || 20;
      const result = await OverdueService.getUserNotifications(userId, { limit, unreadOnly });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('[OverdueController.getUserNotifications]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }

  /** PATCH /api/v1/overdue/notifications/:userId/mark-read */
  static async markRead(req, res) {
    try {
      const userId = parseInt(req.params.userId, 10);
      const { ids } = req.body; // optional array of notification IDs
      const result = await OverdueService.markRead(userId, ids);
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('[OverdueController.markRead]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }

  /** GET /api/v1/overdue/trend/weekly */
  static async getWeeklyTrend(req, res) {
    try {
      const trend = await OverdueService.getWeeklyTrend();
      return res.json({ success: true, trend });
    } catch (err) {
      console.error('[OverdueController.getWeeklyTrend]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }
}

module.exports = OverdueController;
