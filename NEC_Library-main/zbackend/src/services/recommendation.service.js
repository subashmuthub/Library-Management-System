/**
 * Recommendation Service
 * Rule-based scoring engine for book recommendations.
 *
 * Scoring weights:
 *   Same Category  : +40
 *   Same Author    : +25
 *   Popular (top%) : +20
 *   Recent trend   : +10
 *   Same Publisher : +5
 *
 * Fallback (no history): returns most borrowed books with +15 seed bonus.
 */

const { pool } = require('../config/database');

class RecommendationService {

  /**
   * Main entry point — returns top-10 scored recommendations for a user.
   * @param {number} userId
   * @returns {Promise<Array>}
   */
  static async getRecommendations(userId) {
    const connection = await pool.getConnection();
    try {
      // 1. Get the user's borrow history (categories, authors, publishers)
      const [history] = await connection.execute(
        `SELECT DISTINCT b.category, b.author, b.publisher, b.id AS book_id
         FROM book_transactions bt
         JOIN books b ON bt.book_id = b.id
         WHERE bt.user_id = ?
         LIMIT 50`,
        [userId]
      );


      // 2. Get all available candidate books (exclude already borrowed)
      const borrowedIds = history.map(h => h.book_id);
      const borrowedPlaceholders = borrowedIds.length
        ? borrowedIds.map(() => '?').join(',')
        : '0';

      const [candidates] = await connection.execute(
        `SELECT b.id, b.title, b.author, b.category, b.publisher,
                b.isbn, b.description, b.cover_image_url, b.is_available,
                COALESCE(pb.borrow_count, 0) AS borrow_count
         FROM books b
         LEFT JOIN popular_books_cache pb ON b.id = pb.book_id
         WHERE b.id NOT IN (${borrowedPlaceholders})
           AND b.is_available = TRUE
         LIMIT 200`,
        [...borrowedIds]
      );

      // 3. Get popularity threshold (top 20% of borrow_count)
      const maxBorrows = candidates.reduce((m, c) => Math.max(m, c.borrow_count), 0);
      const popularThreshold = maxBorrows * 0.8;

      // 4. Build user profile sets
      const userCategories  = new Set(history.map(h => h.category).filter(Boolean));
      const userAuthors     = new Set(history.map(h => h.author).filter(Boolean));
      const userPublishers  = new Set(history.map(h => h.publisher).filter(Boolean));
      const hasHistory      = history.length > 0;

      // 5. Score each candidate
      const scored = candidates.map(book => {
        let score = 0;
        const reasons = [];

        if (hasHistory) {
          if (book.category && userCategories.has(book.category)) {
            score += 40;
            reasons.push('Same category as your reads');
          }
          if (book.author && userAuthors.has(book.author)) {
            score += 25;
            reasons.push('Same author you enjoy');
          }
          if (book.borrow_count >= popularThreshold && maxBorrows > 0) {
            score += 20;
            reasons.push('Popular in the library');
          }
          if (book.publisher && userPublishers.has(book.publisher)) {
            score += 5;
            reasons.push('Same publisher');
          }
          // Recent trend boost: borrowed by others in last 7 days
          // (handled via popular_books_cache borrow_count proxy)
          if (book.borrow_count > 5) {
            score += 10;
            reasons.push('Trending this week');
          }
        } else {
          // Fallback for new users: popularity-only
          score = book.borrow_count + 15;
          reasons.push('Most borrowed in the library');
        }

        return {
          bookId      : book.id,
          title       : book.title,
          author      : book.author,
          category    : book.category,
          publisher   : book.publisher,
          isbn        : book.isbn,
          coverImage  : book.cover_image_url,
          isAvailable : Boolean(book.is_available),
          borrowCount : book.borrow_count,
          score,
          reason      : reasons[0] || 'Recommended for you',
          allReasons  : reasons,
        };
      });

      // 6. Sort descending, take top 10
      scored.sort((a, b) => b.score - a.score);
      const top10 = scored.slice(0, 10);

      // 7. Log recommendations (fire-and-forget, non-blocking)
      this._logRecommendations(userId, top10).catch(() => {});

      return top10;
    } finally {
      connection.release();
    }
  }

  /**
   * Refresh the popular_books_cache table.
   * Called on app start and periodically.
   */
  static async refreshPopularityCache() {
    const connection = await pool.getConnection();
    try {
      await connection.execute(`
        INSERT INTO popular_books_cache (book_id, borrow_count, score)
        SELECT 
          bt.book_id,
          COUNT(*) AS borrow_count,
          COUNT(*) * 10 AS score
        FROM book_transactions bt
        WHERE bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        GROUP BY bt.book_id
        ON DUPLICATE KEY UPDATE
          borrow_count = VALUES(borrow_count),
          score        = VALUES(score),
          last_updated = NOW()
      `);
      console.log('[Recommendation] Popularity cache refreshed');
    } catch (err) {
      console.error('[Recommendation] Cache refresh error:', err.message);
    } finally {
      connection.release();
    }
  }

  /**
   * Get popular books (used for dashboard widget / Rule 3 fallback)
   */
  static async getPopularBooks(limit = 10) {
    const safeLimit = parseInt(limit, 10) || 10;
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT b.id, b.title, b.author, b.category, b.is_available,
                COALESCE(pb.borrow_count, 0) AS borrow_count
         FROM popular_books_cache pb
         JOIN books b ON pb.book_id = b.id
         ORDER BY pb.score DESC
         LIMIT ${safeLimit}`
      );
      return rows;
    } finally {
      connection.release();
    }
  }


  /** Log recommendations to DB (non-critical) */
  static async _logRecommendations(userId, books) {
    if (!books.length) return;
    const connection = await pool.getConnection();
    try {
      const values = books.map(b => [userId, b.bookId, b.score, b.reason]);
      await connection.query(
        `INSERT IGNORE INTO recommendation_logs (user_id, book_id, score, reason) VALUES ?`,
        [values]
      );
    } catch (_) {
      // Non-critical: silently ignore
    } finally {
      connection.release();
    }
  }
}

module.exports = RecommendationService;
