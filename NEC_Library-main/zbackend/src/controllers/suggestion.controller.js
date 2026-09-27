/**
 * Book Suggestion Controller
 * Handles student book suggestions and librarian/admin approval workflow
 */

const { pool } = require('../config/database');

class SuggestionController {
    /**
     * Submit a new book suggestion
     * Accessible by authenticated users (primarily students/staff)
     */
    static async createSuggestion(req, res) {
        try {
            const { title, author, isbn, reason } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (!title || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Book title is required'
                });
            }

            if (!author || !author.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Author name is required'
                });
            }

            const connection = await pool.getConnection();

            const [result] = await connection.execute(`
                INSERT INTO book_suggestions (user_id, title, author, isbn, reason, status)
                VALUES (?, ?, ?, ?, ?, 'PENDING')
            `, [
                userId,
                title.trim(),
                author.trim(),
                isbn ? isbn.trim() : null,
                reason ? reason.trim() : null
            ]);

            const suggestionId = result.insertId;

            const [rows] = await connection.execute(`
                SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) AS requester_name, u.email AS requester_email, u.student_id
                FROM book_suggestions s
                JOIN users u ON s.user_id = u.id
                WHERE s.id = ?
            `, [suggestionId]);

            connection.release();

            return res.status(201).json({
                success: true,
                message: 'Book suggestion submitted successfully',
                data: rows[0]
            });
        } catch (error) {
            console.error('Error creating book suggestion:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to submit book suggestion',
                error: error.message
            });
        }
    }

    /**
     * Get suggestions
     * - Students/Staff: only get their own suggestions
     * - Admin/Librarian: get all suggestions across the library
     */
    static async getSuggestions(req, res) {
        try {
            const sessionUser = req.user || req.session?.user;
            if (!sessionUser) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const role = String(
                sessionUser.role || sessionUser.role_name || sessionUser.role?.role_name || ''
            ).toLowerCase();
            const isStaffOrAdmin = ['admin', 'librarian'].includes(role);

            const { status, page = 1, limit = 50 } = req.query;

            const connection = await pool.getConnection();

            let whereConditions = [];
            let queryParams = [];

            if (!isStaffOrAdmin) {
                whereConditions.push('s.user_id = ?');
                queryParams.push(sessionUser.id);
            }

            if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
                whereConditions.push('s.status = ?');
                queryParams.push(status.toUpperCase());
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
            const offset = (pageNum - 1) * limitNum;

            const [suggestions] = await connection.execute(`
                SELECT 
                    s.id,
                    s.user_id,
                    s.title,
                    s.author,
                    s.isbn,
                    s.reason,
                    s.status,
                    s.created_at,
                    s.updated_at,
                    CONCAT(u.first_name, ' ', u.last_name) AS requester_name,
                    u.email AS requester_email,
                    u.student_id
                FROM book_suggestions s
                JOIN users u ON s.user_id = u.id
                ${whereClause}
                ORDER BY s.created_at DESC
                LIMIT ${limitNum} OFFSET ${offset}
            `, queryParams);

            const [countResult] = await connection.execute(`
                SELECT COUNT(*) as total
                FROM book_suggestions s
                ${whereClause}
            `, queryParams);

            connection.release();

            const total = countResult[0]?.total || 0;

            return res.json({
                success: true,
                data: {
                    suggestions,
                    pagination: {
                        currentPage: pageNum,
                        totalPages: Math.ceil(total / limitNum),
                        total,
                        limit: limitNum
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching book suggestions:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch book suggestions',
                error: error.message
            });
        }
    }

    /**
     * Update suggestion status (APPROVED | REJECTED)
     * Admin and Librarian only
     */
    static async updateSuggestionStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
            if (!status || !validStatuses.includes(status.toUpperCase())) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const normalizedStatus = status.toUpperCase();
            const connection = await pool.getConnection();

            const [existing] = await connection.execute(
                'SELECT * FROM book_suggestions WHERE id = ?',
                [id]
            );

            if (existing.length === 0) {
                connection.release();
                return res.status(404).json({
                    success: false,
                    message: 'Book suggestion not found'
                });
            }

            await connection.execute(
                'UPDATE book_suggestions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [normalizedStatus, id]
            );

            const [updated] = await connection.execute(`
                SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) AS requester_name, u.email AS requester_email, u.student_id
                FROM book_suggestions s
                JOIN users u ON s.user_id = u.id
                WHERE s.id = ?
            `, [id]);

            connection.release();

            return res.json({
                success: true,
                message: `Book suggestion marked as ${normalizedStatus}`,
                data: updated[0]
            });
        } catch (error) {
            console.error('Error updating suggestion status:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update suggestion status',
                error: error.message
            });
        }
    }
}

module.exports = SuggestionController;
