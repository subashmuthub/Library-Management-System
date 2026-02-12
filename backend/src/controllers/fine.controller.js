/**
 * Fine Management Controller
 * Handles fine calculations, payments, and management
 */

const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

class FineController {
    // Get all pending fines
    static async getPendingFines(req, res) {
        try {
            const { page = 1, limit = 50, userId } = req.query;
            const connection = await pool.getConnection();

            let query = `
                SELECT 
                    f.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    b.title,
                    b.author,
                    b.isbn,
                    bt.checkout_date,
                    bt.due_date,
                    bt.return_date,
                    DATEDIFF(COALESCE(bt.return_date, CURDATE()), bt.due_date) as actual_days_overdue
                FROM fines f
                JOIN users u ON f.user_id = u.id
                JOIN book_transactions bt ON f.transaction_id = bt.id
                JOIN books b ON bt.book_id = b.id
                WHERE f.status = 'pending'
            `;

            let params = [];
            
            if (userId) {
                query += ` AND f.user_id = ?`;
                params.push(userId);
            }

            query += ` ORDER BY f.created_at DESC`;

            // Add pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), offset);

            const [fines] = await connection.execute(query, params);

            // Get total count
            let countQuery = `
                SELECT COUNT(*) as total
                FROM fines f
                WHERE f.status = 'pending'
            `;
            let countParams = [];

            if (userId) {
                countQuery += ` AND f.user_id = ?`;
                countParams.push(userId);
            }

            const [countResult] = await connection.execute(countQuery, countParams);

            connection.release();

            res.json({
                fines,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Error fetching pending fines:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get fine details by ID
    static async getFineById(req, res) {
        try {
            const { id } = req.params;
            const connection = await pool.getConnection();

            const [fines] = await connection.execute(`
                SELECT 
                    f.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    u.phone,
                    b.title,
                    b.author,
                    b.isbn,
                    bt.checkout_date,
                    bt.due_date,
                    bt.return_date,
                    CONCAT(processor.first_name, ' ', processor.last_name) as processed_by_name
                FROM fines f
                JOIN users u ON f.user_id = u.id
                JOIN book_transactions bt ON f.transaction_id = bt.id
                JOIN books b ON bt.book_id = b.id
                LEFT JOIN users processor ON f.processed_by = processor.id
                WHERE f.id = ?
            `, [id]);

            if (fines.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'Fine not found' });
            }

            connection.release();
            res.json(fines[0]);

        } catch (error) {
            console.error('Error fetching fine:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Process fine payment
    static async payFine(req, res) {
        try {
            const { id } = req.params;
            const { 
                payment_method, 
                amount_paid, 
                payment_reference,
                notes 
            } = req.body;
            const librarianId = req.user?.id;

            if (!['cash', 'card', 'online'].includes(payment_method)) {
                return res.status(400).json({ 
                    error: 'Invalid payment method. Must be: cash, card, or online' 
                });
            }

            const connection = await pool.getConnection();

            // Get current fine details
            const [fines] = await connection.execute(`
                SELECT f.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
                FROM fines f
                JOIN users u ON f.user_id = u.id
                WHERE f.id = ? AND f.status = 'pending'
            `, [id]);

            if (fines.length === 0) {
                connection.release();
                return res.status(404).json({ 
                    error: 'Fine not found or already processed' 
                });
            }

            const currentFine = fines[0];
            const amountToPay = parseFloat(amount_paid) || currentFine.amount;
            const remainingAmount = currentFine.amount - currentFine.amount_paid - amountToPay;

            // Determine new status
            let newStatus;
            if (remainingAmount <= 0) {
                newStatus = 'paid';
            } else {
                newStatus = 'partial';
            }

            // Update fine record
            await connection.execute(`
                UPDATE fines SET
                    amount_paid = amount_paid + ?,
                    status = ?,
                    payment_date = CURDATE(),
                    payment_method = ?,
                    processed_by = ?,
                    notes = CONCAT(IFNULL(notes, ''), ' Payment: $', ?, ' via ', ?, IFNULL(CONCAT(' (Ref: ', ?, ')'), ''))
                WHERE id = ?
            `, [
                amountToPay, newStatus, payment_method, librarianId, 
                amountToPay, payment_method, payment_reference || '', id
            ]);

            // Get updated fine details
            const [updatedFine] = await connection.execute(`
                SELECT 
                    f.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    b.title,
                    b.author
                FROM fines f
                JOIN users u ON f.user_id = u.id
                JOIN book_transactions bt ON f.transaction_id = bt.id
                JOIN books b ON bt.book_id = b.id
                WHERE f.id = ?
            `, [id]);

            connection.release();

            res.json({
                success: true,
                message: `Payment of $${amountToPay.toFixed(2)} processed successfully`,
                fine: updatedFine[0],
                payment: {
                    amount: amountToPay,
                    method: payment_method,
                    reference: payment_reference,
                    remaining_balance: Math.max(0, remainingAmount)
                }
            });

        } catch (error) {
            console.error('Error processing payment:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Waive a fine
    static async waiveFine(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const librarianId = req.user?.id;

            if (!reason || reason.trim().length < 5) {
                return res.status(400).json({ 
                    error: 'Waive reason is required (minimum 5 characters)' 
                });
            }

            const connection = await pool.getConnection();

            // Check if fine exists and is pending
            const [fines] = await connection.execute(`
                SELECT f.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
                FROM fines f
                JOIN users u ON f.user_id = u.id
                WHERE f.id = ? AND f.status IN ('pending', 'partial')
            `, [id]);

            if (fines.length === 0) {
                connection.release();
                return res.status(404).json({ 
                    error: 'Fine not found or already processed' 
                });
            }

            // Update fine as waived
            await connection.execute(`
                UPDATE fines SET
                    status = 'waived',
                    payment_date = CURDATE(),
                    payment_method = 'waived',
                    processed_by = ?,
                    notes = CONCAT(IFNULL(notes, ''), ' WAIVED: ', ?)
                WHERE id = ?
            `, [librarianId, reason, id]);

            // Get updated fine details
            const [updatedFine] = await connection.execute(`
                SELECT 
                    f.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    b.title,
                    CONCAT(processor.first_name, ' ', processor.last_name) as processed_by_name
                FROM fines f
                JOIN users u ON f.user_id = u.id
                JOIN book_transactions bt ON f.transaction_id = bt.id
                JOIN books b ON bt.book_id = b.id
                LEFT JOIN users processor ON f.processed_by = processor.id
                WHERE f.id = ?
            `, [id]);

            connection.release();

            res.json({
                success: true,
                message: 'Fine waived successfully',
                fine: updatedFine[0],
                waive_reason: reason
            });

        } catch (error) {
            console.error('Error waiving fine:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Calculate fine for overdue book manually
    static async calculateFine(req, res) {
        try {
            const { transactionId } = req.params;
            const { fine_rate } = req.body;
            const connection = await pool.getConnection();

            // Get transaction details
            const [transactions] = await connection.execute(`
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    DATEDIFF(COALESCE(bt.return_date, CURDATE()), bt.due_date) as days_overdue
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                JOIN users u ON bt.user_id = u.id
                WHERE bt.id = ?
            `, [transactionId]);

            if (transactions.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'Transaction not found' });
            }

            const transaction = transactions[0];
            const daysOverdue = Math.max(0, transaction.days_overdue);
            const ratePerDay = fine_rate ? parseFloat(fine_rate) : 1.00;
            const calculatedFine = daysOverdue * ratePerDay;

            if (daysOverdue <= 0) {
                connection.release();
                return res.json({
                    transaction_id: parseInt(transactionId),
                    days_overdue: daysOverdue,
                    calculated_fine: 0,
                    message: 'No fine required - book not overdue'
                });
            }

            // Check if fine already exists
            const [existingFines] = await connection.execute(`
                SELECT * FROM fines WHERE transaction_id = ?
            `, [transactionId]);

            connection.release();

            res.json({
                transaction_id: parseInt(transactionId),
                book_title: transaction.title,
                user_name: transaction.user_name,
                due_date: transaction.due_date,
                return_date: transaction.return_date,
                days_overdue: daysOverdue,
                fine_rate: ratePerDay,
                calculated_fine: calculatedFine,
                existing_fine: existingFines.length > 0 ? existingFines[0] : null
            });

        } catch (error) {
            console.error('Error calculating fine:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get user fine history/summary
    static async getUserFineSummary(req, res) {
        try {
            const { userId } = req.params;
            const connection = await pool.getConnection();

            // Get fine summary
            const [summary] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_fines,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_fines,
                    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_fines,
                    COUNT(CASE WHEN status = 'waived' THEN 1 END) as waived_fines,
                    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) as total_pending_amount,
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) as total_paid_amount,
                    COALESCE(SUM(amount_paid), 0) as total_amount_paid
                FROM fines 
                WHERE user_id = ?
            `, [userId]);

            // Get recent fine history
            const [recentFines] = await connection.execute(`
                SELECT 
                    f.*,
                    b.title,
                    b.author,
                    bt.checkout_date,
                    bt.due_date,
                    bt.return_date
                FROM fines f
                JOIN book_transactions bt ON f.transaction_id = bt.id
                JOIN books b ON bt.book_id = b.id
                WHERE f.user_id = ?
                ORDER BY f.created_at DESC
                LIMIT 10
            `, [userId]);

            connection.release();

            res.json({
                user_id: parseInt(userId),
                summary: summary[0],
                recent_fines: recentFines
            });

        } catch (error) {
            console.error('Error fetching user fine summary:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get fine statistics for admin dashboard
    static async getFineStatistics(req, res) {
        try {
            const { period = '30' } = req.query; // days
            const connection = await pool.getConnection();

            // Overall statistics
            const [overallStats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_fines,
                    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) as pending_amount,
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) as collected_amount,
                    COALESCE(SUM(CASE WHEN status = 'waived' THEN amount END), 0) as waived_amount,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
                    COUNT(CASE WHEN status = 'waived' THEN 1 END) as waived_count
                FROM fines
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            `, [parseInt(period)]);

            // Daily fine collection over period
            const [dailyStats] = await connection.execute(`
                SELECT 
                    DATE(payment_date) as payment_date,
                    COUNT(*) as fines_processed,
                    SUM(CASE WHEN status = 'paid' THEN amount_paid END) as amount_collected,
                    COUNT(CASE WHEN status = 'waived' THEN 1 END) as fines_waived
                FROM fines
                WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                  AND payment_date IS NOT NULL
                GROUP BY DATE(payment_date)
                ORDER BY payment_date DESC
            `, [parseInt(period)]);

            // Top users with highest outstanding fines
            const [topFineUsers] = await connection.execute(`
                SELECT 
                    u.id,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    COUNT(f.id) as pending_fines_count,
                    SUM(f.amount - f.amount_paid) as total_outstanding
                FROM users u
                JOIN fines f ON u.id = f.user_id
                WHERE f.status = 'pending'
                GROUP BY u.id
                ORDER BY total_outstanding DESC
                LIMIT 10
            `);

            connection.release();

            res.json({
                period_days: parseInt(period),
                overall_statistics: overallStats[0],
                daily_statistics: dailyStats,
                top_outstanding_users: topFineUsers
            });

        } catch (error) {
            console.error('Error fetching fine statistics:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Create manual fine (for damaged books, etc.)
    static async createManualFine(req, res) {
        try {
            const {
                user_id,
                transaction_id,
                fine_type = 'other',
                amount,
                description,
                reason
            } = req.body;
            const librarianId = req.user?.id;

            if (!user_id || !amount || amount <= 0) {
                return res.status(400).json({
                    error: 'User ID and positive amount are required'
                });
            }

            const validTypes = ['overdue', 'damage', 'lost_book', 'other'];
            if (!validTypes.includes(fine_type)) {
                return res.status(400).json({
                    error: 'Invalid fine type. Must be: ' + validTypes.join(', ')
                });
            }

            const connection = await pool.getConnection();

            // Verify user exists
            const [users] = await connection.execute(
                'SELECT id, first_name, last_name FROM users WHERE id = ?',
                [user_id]
            );

            if (users.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'User not found' });
            }

            // Create fine record
            const [result] = await connection.execute(`
                INSERT INTO fines (
                    user_id, transaction_id, fine_type, amount, 
                    days_overdue, fine_rate, status, processed_by, notes
                ) VALUES (?, ?, ?, ?, 0, 0, 'pending', ?, ?)
            `, [
                user_id, transaction_id || null, fine_type, 
                parseFloat(amount), librarianId, 
                description || reason || 'Manual fine'
            ]);

            // Get created fine details
            const [newFine] = await connection.execute(`
                SELECT 
                    f.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name
                FROM fines f
                JOIN users u ON f.user_id = u.id
                LEFT JOIN users creator ON f.processed_by = creator.id
                WHERE f.id = ?
            `, [result.insertId]);

            connection.release();

            res.status(201).json({
                success: true,
                message: 'Manual fine created successfully',
                fine: newFine[0]
            });

        } catch (error) {
            console.error('Error creating manual fine:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = FineController;
