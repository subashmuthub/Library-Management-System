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
            
            // Parse and validate pagination parameters
            const parsedPage = Math.max(1, parseInt(page) || 1);
            const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));

            // Check if table has any data first
            const [countCheck] = await pool.query('SELECT COUNT(*) as total FROM fines');
            if (countCheck[0].total === 0) {
                return res.json({
                    fines: [],
                    pagination: {
                        page: parsedPage,
                        limit: parsedLimit,
                        total: 0,
                        totalPages: 0
                    }
                });
            }

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
            const offset = (parsedPage - 1) * parsedLimit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(parsedLimit, offset);

            const [fines] = await pool.query(query, params);

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

            const [countResult] = await pool.query(countQuery, countParams);

            res.json({
                fines,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parsedLimit)
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

            const [fines] = await connection.query(`
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
                payment_gateway,
                amount_paid, 
                payment_reference,
                notes 
            } = req.body;
            const librarianId = req.user?.id || null;

            if (!['cash', 'card', 'online'].includes(payment_method)) {
                return res.status(400).json({ 
                    error: 'Invalid payment method. Must be: cash, card, or online' 
                });
            }

            const connection = await pool.getConnection();

            try {
                await connection.beginTransaction();

                // Get current fine details
                const [fines] = await connection.query(`
                    SELECT f.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
                    FROM fines f
                    JOIN users u ON f.user_id = u.id
                    WHERE f.id = ? AND f.status IN ('pending', 'partial')
                `, [id]);

                if (fines.length === 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(404).json({ 
                        error: 'Fine not found or already processed' 
                    });
                }

                const currentFine = fines[0];
                const amountToPay = parseFloat(amount_paid) || parseFloat(currentFine.amount);
                const totalAmount = parseFloat(currentFine.amount);
                const alreadyPaid = parseFloat(currentFine.amount_paid);
                const remainingAmount = totalAmount - alreadyPaid - amountToPay;

                // Determine new status
                let newStatus;
                if (remainingAmount <= 0) {
                    newStatus = 'paid';
                } else {
                    newStatus = 'partial';
                }

                // Update fine record
                await connection.query(`
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
                    amountToPay, payment_gateway || payment_method, payment_reference || '', id
                ]);

                // Generate receipt ID
                const receiptId = `REC-${Date.now()}-${currentFine.user_id}`;

                // Create payment receipt
                const receiptData = {
                    receipt_id: receiptId,
                    fine_id: currentFine.id,
                    user_id: currentFine.user_id,
                    user_name: currentFine.user_name,
                    transaction_id: currentFine.transaction_id,
                    amount: amountToPay,
                    payment_method: payment_gateway || payment_method,
                    payment_reference: payment_reference,
                    payment_date: new Date().toISOString(),
                    status: 'Success'
                };

                // Insert receipt record
                await connection.query(`
                    INSERT INTO payment_receipts 
                    (receipt_id, fine_id, user_id, transaction_id, amount, payment_method, payment_gateway, payment_reference, receipt_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    receiptId,
                    currentFine.id,
                    currentFine.user_id,
                    currentFine.transaction_id,
                    amountToPay,
                    payment_method,
                    payment_gateway || null,
                    payment_reference || null,
                    JSON.stringify(receiptData)
                ]);

                // Get updated fine details
                const [updatedFine] = await connection.query(`
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

                await connection.commit();
                connection.release();

                res.json({
                    success: true,
                    message: `Payment of $${amountToPay.toFixed(2)} processed successfully`,
                    fine: updatedFine[0],
                    payment: {
                        receipt_id: receiptId,
                        amount: amountToPay,
                        method: payment_method,
                        gateway: payment_gateway,
                        reference: payment_reference,
                        remaining_balance: Math.max(0, remainingAmount),
                        receipt_data: receiptData
                    }
                });

            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }

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
            const librarianId = req.user?.id || null;

            if (!reason || reason.trim().length < 5) {
                return res.status(400).json({ 
                    error: 'Waive reason is required (minimum 5 characters)' 
                });
            }

            const connection = await pool.getConnection();

            // Check if fine exists and is pending
            const [fines] = await connection.query(`
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
            await connection.query(`
                UPDATE fines SET
                    status = 'waived',
                    payment_date = CURDATE(),
                    payment_method = 'waived',
                    processed_by = ?,
                    notes = CONCAT(IFNULL(notes, ''), ' WAIVED: ', ?)
                WHERE id = ?
            `, [librarianId, reason, id]);

            // Get updated fine details
            const [updatedFine] = await connection.query(`
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
            const [transactions] = await connection.query(`
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
            const [existingFines] = await connection.query(`
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
            const [summary] = await connection.query(`
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
            const [recentFines] = await connection.query(`
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
            const [overallStats] = await connection.query(`
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
            const [dailyStats] = await connection.query(`
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
            const [topFineUsers] = await connection.query(`
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
            const librarianId = req.user?.id || null;

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
            const [users] = await connection.query(
                'SELECT id, first_name, last_name FROM users WHERE id = ?',
                [user_id]
            );

            if (users.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'User not found' });
            }

            // Create fine record
            const [result] = await connection.query(`
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
            const [newFine] = await connection.query(`
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

    // Get payment history
    static async getPaymentHistory(req, res) {
        try {
            const { userId, fineId, limit = 50 } = req.query;

            let query = `
                SELECT 
                    pr.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    f.amount as fine_total,
                    f.status as fine_status,
                    b.title as book_title
                FROM payment_receipts pr
                JOIN users u ON pr.user_id = u.id
                JOIN fines f ON pr.fine_id = f.id
                LEFT JOIN book_transactions bt ON pr.transaction_id = bt.id
                LEFT JOIN books b ON bt.book_id = b.id
                WHERE 1=1
            `;

            const params = [];

            if (userId) {
                query += ' AND pr.user_id = ?';
                params.push(userId);
            }

            if (fineId) {
                query += ' AND pr.fine_id = ?';
                params.push(fineId);
            }

            query += ' ORDER BY pr.payment_date DESC LIMIT ?';
            params.push(parseInt(limit));

            const connection = await pool.getConnection();
            const [receipts] = await connection.query(query, params);
            connection.release();

            res.json({
                success: true,
                receipts: receipts.map(receipt => ({
                    ...receipt,
                    receipt_data: typeof receipt.receipt_data === 'string' 
                        ? JSON.parse(receipt.receipt_data) 
                        : receipt.receipt_data
                }))
            });

        } catch (error) {
            console.error('Error fetching payment history:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = FineController;
