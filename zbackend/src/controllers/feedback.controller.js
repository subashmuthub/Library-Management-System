const { pool } = require('../config/database');

const sessionUser = (req) => req.user || req.session?.user || {};
const userId = (req, fallback) => Number(sessionUser(req).id || fallback || 0);
const role = (req) => String(sessionUser(req).role || sessionUser(req).role_name || '').toLowerCase();
const staff = (req) => ['admin', 'librarian'].includes(role(req));

class FeedbackController {
  static async listReviews(req, res) {
    try {
      const [reviews] = await pool.execute(`
        SELECT br.id, br.book_id, br.user_id, br.rating, br.review_text, br.created_at,
               CONCAT(u.first_name, ' ', u.last_name) AS reviewer_name
        FROM book_reviews br JOIN users u ON u.id = br.user_id
        WHERE br.book_id = ? AND br.status = 'published'
        ORDER BY br.created_at DESC`, [req.params.bookId]);
      const [[summary]] = await pool.execute(`
        SELECT COUNT(*) AS review_count, COALESCE(AVG(rating), 0) AS average_rating
        FROM book_reviews WHERE book_id = ? AND status = 'published'`, [req.params.bookId]);
      res.json({ reviews, summary });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async createReview(req, res) {
    const reviewerId = userId(req, req.body.user_id);
    const rating = Number(req.body.rating);
    const text = String(req.body.review_text || '').trim();
    if (!reviewerId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'A user and a rating from 1 to 5 are required.' });
    }
    try {
      await pool.execute(`
        INSERT INTO book_reviews (book_id, user_id, rating, review_text)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE rating = VALUES(rating), review_text = VALUES(review_text), status = 'published'`,
      [req.params.bookId, reviewerId, rating, text || null]);
      res.status(201).json({ success: true, message: 'Review saved.' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async listSuggestions(req, res) {
    if (!staff(req)) return res.status(403).json({ error: 'Staff access required.' });
    try {
      const [suggestions] = await pool.execute(`
        SELECT ps.*, CONCAT(u.first_name, ' ', u.last_name) AS requester_name
        FROM purchase_suggestions ps JOIN users u ON u.id = ps.requested_by
        ORDER BY FIELD(ps.status, 'pending', 'approved', 'rejected'), ps.created_at DESC`);
      res.json({ suggestions });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async createSuggestion(req, res) {
    const requesterId = userId(req, req.body.requested_by);
    const title = String(req.body.title || '').trim();
    if (!requesterId || !title) return res.status(400).json({ error: 'A requester and title are required.' });
    try {
      const [result] = await pool.execute(`
        INSERT INTO purchase_suggestions (requested_by, title, author, isbn, department, justification)
        VALUES (?, ?, ?, ?, ?, ?)`, [requesterId, title, req.body.author || null, req.body.isbn || null, req.body.department || null, req.body.justification || null]);
      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async updateSuggestion(req, res) {
    if (!staff(req)) return res.status(403).json({ error: 'Staff access required.' });
    const status = ['pending', 'approved', 'rejected'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ error: 'Invalid suggestion status.' });
    try {
      await pool.execute(`UPDATE purchase_suggestions SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ? WHERE id = ?`, [status, userId(req), req.body.review_notes || null, req.params.id]);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async listDisputes(req, res) {
    try {
      const [disputes] = await pool.execute(`
        SELECT td.*, CONCAT(u.first_name, ' ', u.last_name) AS raised_by_name,
               bt.book_id, b.title
        FROM transaction_disputes td
        JOIN users u ON u.id = td.raised_by
        JOIN book_transactions bt ON bt.id = td.transaction_id
        JOIN books b ON b.id = bt.book_id
        ${staff(req) ? '' : 'WHERE td.raised_by = ?'}
        ORDER BY td.created_at DESC`, staff(req) ? [] : [userId(req)]);
      res.json({ disputes });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async createDispute(req, res) {
    const raisedBy = userId(req, req.body.raised_by);
    const reason = String(req.body.reason || '').trim();
    if (!raisedBy || !req.body.transaction_id || !reason) return res.status(400).json({ error: 'Transaction and reason are required.' });
    try {
      const [result] = await pool.execute(`INSERT INTO transaction_disputes (transaction_id, raised_by, reason) VALUES (?, ?, ?)`, [req.body.transaction_id, raisedBy, reason]);
      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async updateDispute(req, res) {
    if (!staff(req)) return res.status(403).json({ error: 'Staff access required.' });
    const status = ['open', 'investigating', 'resolved', 'rejected'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ error: 'Invalid dispute status.' });
    try {
      await pool.execute(`UPDATE transaction_disputes SET status = ?, resolution_notes = ?, resolved_by = ?, resolved_at = IF(? IN ('resolved', 'rejected'), NOW(), NULL) WHERE id = ?`, [status, req.body.resolution_notes || null, userId(req), status, req.params.id]);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }
}

module.exports = FeedbackController;
