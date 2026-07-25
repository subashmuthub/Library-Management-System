/**
 * Heatmap Analytics Controller
 */

const { pool } = require('../config/database');

class HeatmapController {

  /** GET /api/v1/heatmap — shelf activity heatmap data */
  static async getHeatmap(req, res) {
    const { period = '30', category } = req.query;
    const days = Math.min(parseInt(period, 10) || 30, 365);

    const connection = await pool.getConnection();
    try {
      // Aggregate shelf_activity_stats for the requested period
      const params = [days];
      let categoryJoin = '';
      let categoryFilter = '';

      if (category && category.trim()) {
        categoryJoin = `LEFT JOIN books bk ON lse.shelf_code = (
          SELECT lse2.shelf_code FROM library_shelves_extended lse2
          JOIN book_location_history blh2 ON blh2.shelf_id = (
            SELECT id FROM shelves WHERE shelf_code = lse2.shelf_code LIMIT 1
          )
          JOIN books bk2 ON blh2.book_id = bk2.id
          WHERE bk2.category = ? LIMIT 1
        )`;
        categoryFilter = ' AND lse.section = ?';
        params.push(category, category);
      }

      const [rows] = await connection.execute(`
        SELECT
          lse.shelf_code,
          lse.floor,
          lse.rack,
          lse.section,
          lse.coord_x,
          lse.coord_y,
          COALESCE(SUM(sas.scan_count),   0) AS total_scans,
          COALESCE(SUM(sas.borrow_count), 0) AS total_borrows,
          COALESCE(SUM(sas.return_count), 0) AS total_returns,
          COALESCE(SUM(sas.search_count), 0) AS total_searches,
          COALESCE(SUM(sas.popularity_score), 0) AS popularity_score
        FROM library_shelves_extended lse
        LEFT JOIN shelf_activity_stats sas
          ON sas.shelf_code = lse.shelf_code
          AND sas.activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        WHERE lse.is_active = TRUE ${categoryFilter}
        GROUP BY lse.shelf_code, lse.floor, lse.rack, lse.section, lse.coord_x, lse.coord_y
        ORDER BY popularity_score DESC
      `, params.slice(0, category ? 3 : 1));

      // Normalise score to 0-100 intensity
      const maxScore = rows.reduce((m, r) => Math.max(m, r.popularity_score), 1);
      const heatmap = rows.map(r => ({
        ...r,
        intensity: Math.round((r.popularity_score / maxScore) * 100),
        heat_level: HeatmapController._heatLevel(r.popularity_score, maxScore),
      }));

      return res.json({ success: true, period: days, heatmap });
    } catch (err) {
      console.error('[HeatmapController.getHeatmap]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    } finally {
      connection.release();
    }
  }

  /** GET /api/v1/heatmap/popular-shelves */
  static async getPopularShelves(req, res) {
    const { limit = 10, period = 30 } = req.query;
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          shelf_code, section,
          SUM(borrow_count)    AS borrows,
          SUM(scan_count)      AS scans,
          SUM(popularity_score) AS score
        FROM shelf_activity_stats
        WHERE activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY shelf_code, section
        ORDER BY score DESC
        LIMIT ?
      `, [parseInt(period, 10), parseInt(limit, 10)]);
      return res.json({ success: true, shelves: rows });
    } catch (err) {
      console.error('[HeatmapController.getPopularShelves]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    } finally {
      connection.release();
    }
  }

  /** GET /api/v1/heatmap/hourly */
  static async getHourlyStats(req, res) {
    const connection = await pool.getConnection();
    try {
      // Use entry_logs hour-of-day distribution as a proxy for library traffic
      const [rows] = await connection.execute(`
        SELECT
          HOUR(timestamp) AS hour_of_day,
          COUNT(*)        AS activity_count
        FROM book_location_history
        WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY HOUR(timestamp)
        ORDER BY hour_of_day
      `);
      // Fill missing hours with 0
      const hourMap = {};
      rows.forEach(r => { hourMap[r.hour_of_day] = r.activity_count; });
      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hour : h,
        label: `${String(h).padStart(2,'0')}:00`,
        count: hourMap[h] || 0,
      }));
      return res.json({ success: true, hourly });
    } catch (err) {
      console.error('[HeatmapController.getHourlyStats]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    } finally {
      connection.release();
    }
  }

  /** GET /api/v1/heatmap/daily-trend */
  static async getDailyTrend(req, res) {
    const { period = 30 } = req.query;
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT
          activity_date,
          SUM(borrow_count)    AS borrows,
          SUM(return_count)    AS returns,
          SUM(scan_count)      AS scans,
          SUM(popularity_score) AS score
        FROM shelf_activity_stats
        WHERE activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY activity_date
        ORDER BY activity_date ASC
      `, [parseInt(period, 10)]);
      return res.json({ success: true, trend: rows });
    } catch (err) {
      console.error('[HeatmapController.getDailyTrend]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    } finally {
      connection.release();
    }
  }

  /** Determine heat level from intensity */
  static _heatLevel(score, maxScore) {
    if (maxScore === 0) return 'low';
    const pct = score / maxScore;
    if (pct >= 0.75) return 'very_high';
    if (pct >= 0.50) return 'high';
    if (pct >= 0.25) return 'medium';
    return 'low';
  }
}

module.exports = HeatmapController;
