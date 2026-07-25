/**
 * Overdue Alert Service
 * Detects overdue books, syncs fine status, and fires notifications.
 *
 * Runs as an in-process scheduler (setInterval, no external cron package).
 * Interval: every 60 minutes.
 */

const { pool } = require('../config/database');

const FINE_RATE_PER_DAY = parseFloat(process.env.FINE_RATE_PER_DAY || '1.00');
const ALERT_INTERVAL_MS = parseInt(process.env.OVERDUE_CHECK_INTERVAL_MS || '3600000', 10); // 1 hour

class OverdueService {

  /** Start the background scheduler */
  static startScheduler() {
    console.log('[OverdueService] Scheduler started — interval:', ALERT_INTERVAL_MS / 60000, 'min');
    // Run immediately on boot, then repeat
    this.runCheck();
    setInterval(() => this.runCheck(), ALERT_INTERVAL_MS);
  }

  /** Main scan — finds all newly overdue transactions and processes them */
  static async runCheck() {
    const connection = await pool.getConnection();
    try {
      // 1. Find active transactions that are overdue and don't yet have an overdue_alert for today
      const [overdueRows] = await connection.execute(`
        SELECT 
          bt.id          AS transaction_id,
          bt.user_id,
          bt.book_id,
          bt.due_date,
          DATEDIFF(CURDATE(), bt.due_date) AS days_overdue,
          DATEDIFF(CURDATE(), bt.due_date) * ? AS calculated_fine,
          b.title        AS book_title,
          CONCAT(u.first_name, ' ', u.last_name) AS user_name,
          u.email
        FROM book_transactions bt
        JOIN books b ON bt.book_id = b.id
        JOIN users u ON bt.user_id = u.id
        WHERE bt.return_date IS NULL
          AND bt.due_date < CURDATE()
          AND bt.status IN ('active', 'overdue')
      `, [FINE_RATE_PER_DAY]);

      if (!overdueRows.length) {
        console.log('[OverdueService] No overdue books found at', new Date().toISOString());
        return { processed: 0 };
      }

      let processed = 0;

      for (const row of overdueRows) {
        try {
          // 2. Update transaction status to overdue
          await connection.execute(
            `UPDATE book_transactions SET status = 'overdue' WHERE id = ? AND status = 'active'`,
            [row.transaction_id]
          );

          // 3. Upsert fine record — only update amount/days if record already exists
          await connection.execute(`
            INSERT INTO fines (user_id, transaction_id, fine_type, amount, days_overdue, fine_rate, status)
            VALUES (?, ?, 'overdue', ?, ?, ?, 'pending')
            ON DUPLICATE KEY UPDATE
              amount       = VALUES(amount),
              days_overdue = VALUES(days_overdue)
          `, [row.user_id, row.transaction_id, row.calculated_fine, row.days_overdue, FINE_RATE_PER_DAY]);

          // 4. Insert notification (deduplicated by checking today's record)
          const [existing] = await connection.execute(
            `SELECT id FROM notification_logs 
             WHERE transaction_id = ? AND DATE(created_at) = CURDATE() AND notification_type = 'overdue_alert'`,
            [row.transaction_id]
          );

          if (!existing.length) {
            await connection.execute(`
              INSERT INTO notification_logs 
                (user_id, transaction_id, notification_type, title, message, fine_amount, days_overdue)
              VALUES (?, ?, 'overdue_alert', ?, ?, ?, ?)
            `, [
              row.user_id,
              row.transaction_id,
              `Overdue: ${row.book_title}`,
              `Your borrowed book "${row.book_title}" is ${row.days_overdue} day(s) overdue. Fine: ₹${row.calculated_fine.toFixed(2)}.`,
              row.calculated_fine,
              row.days_overdue,
            ]);

            // 5. Log alert history
            await connection.execute(`
              INSERT INTO overdue_alert_history (transaction_id, user_id, book_id, days_overdue, fine_snapshot)
              VALUES (?, ?, ?, ?, ?)
            `, [row.transaction_id, row.user_id, row.book_id, row.days_overdue, row.calculated_fine]);
          }

          processed++;
        } catch (rowErr) {
          console.error('[OverdueService] Row error for tx', row.transaction_id, rowErr.message);
        }
      }

      console.log(`[OverdueService] Processed ${processed} overdue records at`, new Date().toISOString());
      return { processed };
    } catch (err) {
      console.error('[OverdueService] runCheck error:', err.message);
      return { processed: 0, error: err.message };
    } finally {
      connection.release();
    }
  }

  /** Get overdue summary for admin/librarian dashboard */
  static async getSummary() {
    const connection = await pool.getConnection();
    try {
      const [[summary]] = await connection.execute(`
        SELECT
          COUNT(*) AS total_overdue,
          SUM(DATEDIFF(CURDATE(), bt.due_date))        AS total_days_overdue,
          MAX(DATEDIFF(CURDATE(), bt.due_date))        AS max_days_overdue,
          SUM(DATEDIFF(CURDATE(), bt.due_date) * ?)    AS total_fine_accrued,
          MAX(DATEDIFF(CURDATE(), bt.due_date) * ?)    AS highest_fine,
          COUNT(CASE WHEN DATEDIFF(CURDATE(), bt.due_date) >= 14 THEN 1 END) AS critical_count
        FROM book_transactions bt
        WHERE bt.return_date IS NULL
          AND bt.due_date < CURDATE()
      `, [FINE_RATE_PER_DAY, FINE_RATE_PER_DAY]);

      return summary;
    } finally {
      connection.release();
    }
  }

  /** Get all overdue records with user + book details */
  static async getOverdueList({ page = 1, limit = 20, userId } = {}) {
    const offset = (page - 1) * limit;
    const safeLimit  = parseInt(limit,  10) || 20;
    const safeOffset = parseInt(offset, 10) || 0;
    const connection = await pool.getConnection();
    try {
      const params = [FINE_RATE_PER_DAY];
      let userFilter = '';
      if (userId) {
        userFilter = ' AND bt.user_id = ?';
        params.push(userId);
      }

      const [rows] = await connection.execute(`
        SELECT
          bt.id          AS transaction_id,
          bt.user_id,
          bt.book_id,
          bt.checkout_date,
          bt.due_date,
          DATEDIFF(CURDATE(), bt.due_date)       AS days_overdue,
          DATEDIFF(CURDATE(), bt.due_date) * ?   AS fine_amount,
          b.title        AS book_title,
          b.author       AS book_author,
          b.category     AS book_category,
          b.isbn,
          CONCAT(u.first_name, ' ', u.last_name) AS user_name,
          u.email,
          u.student_id,
          u.phone
        FROM book_transactions bt
        JOIN books b  ON bt.book_id = b.id
        JOIN users u  ON bt.user_id = u.id
        WHERE bt.return_date IS NULL
          AND bt.due_date < CURDATE()
          ${userFilter}
        ORDER BY days_overdue DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `, params);

      const [[{ total }]] = await connection.execute(
        `SELECT COUNT(*) AS total FROM book_transactions 
         WHERE return_date IS NULL AND due_date < CURDATE()${userId ? ' AND user_id = ?' : ''}`,
        userId ? [userId] : []
      );

      return { overdue: rows, total, page, limit: safeLimit };
    } finally {
      connection.release();
    }
  }

  /** Get notifications for a specific user */
  static async getUserNotifications(userId, { limit = 20, unreadOnly = false } = {}) {
    const connection = await pool.getConnection();
    try {
      const params = [userId];
      let unreadFilter = '';
      if (unreadOnly) { unreadFilter = ' AND is_read = FALSE'; }
      params.push(limit);

      const [rows] = await connection.execute(`
        SELECT id, notification_type, title, message, is_read,
               fine_amount, days_overdue, created_at
        FROM notification_logs
        WHERE user_id = ? ${unreadFilter}
        ORDER BY created_at DESC
        LIMIT ?
      `, params);

      const [[{ unread_count }]] = await connection.execute(
        `SELECT COUNT(*) AS unread_count FROM notification_logs WHERE user_id = ? AND is_read = FALSE`,
        [userId]
      );

      return { notifications: rows, unread_count };
    } finally {
      connection.release();
    }
  }

  /** Mark notification(s) as read */
  static async markRead(userId, notificationIds) {
    const connection = await pool.getConnection();
    try {
      if (notificationIds && notificationIds.length) {
        const placeholders = notificationIds.map(() => '?').join(',');
        await connection.execute(
          `UPDATE notification_logs SET is_read = TRUE WHERE user_id = ? AND id IN (${placeholders})`,
          [userId, ...notificationIds]
        );
      } else {
        await connection.execute(
          `UPDATE notification_logs SET is_read = TRUE WHERE user_id = ?`,
          [userId]
        );
      }
      return { success: true };
    } finally {
      connection.release();
    }
  }

  /** Weekly trend: overdue count per day for last 7 days */
  static async getWeeklyTrend() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          DATE(due_date) AS due_date,
          COUNT(*)       AS overdue_count
        FROM book_transactions
        WHERE return_date IS NULL
          AND due_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          AND due_date < CURDATE()
        GROUP BY DATE(due_date)
        ORDER BY due_date ASC
      `);
      return rows;
    } finally {
      connection.release();
    }
  }
}

module.exports = OverdueService;
