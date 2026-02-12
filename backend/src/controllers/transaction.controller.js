/**
 * Transaction Controller
 * Handles book checkout, return, renew, and related operations
 */

const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

class TransactionController {
    // Checkout a book
    static async checkoutBook(req, res) {
        try {
            const { bookId } = req.params;
            const { userId, loanDays = 14 } = req.body;
            const librarianId = req.user?.id; // Assuming auth middleware sets req.user

            const connection = await pool.getConnection();
            
            try {
                // Use stored procedure for checkout validation
                await connection.beginTransaction();

                const [result] = await connection.execute(`
                    CALL checkout_book(?, ?, ?, ?, @success, @message)
                `, [userId, bookId, librarianId, loanDays]);

                const [output] = await connection.execute('SELECT @success as success, @message as message');
                const { success, message } = output[0];

                if (success) {
                    await connection.commit();
                    
                    // Get transaction details
                    const [transaction] = await connection.execute(`
                        SELECT 
                            bt.*,
                            CONCAT(u.first_name, ' ', u.last_name) as user_name,
                            b.title,
                            b.author
                        FROM book_transactions bt
                        JOIN users u ON bt.user_id = u.id
                        JOIN books b ON bt.book_id = b.id
                        WHERE bt.user_id = ? AND bt.book_id = ? AND bt.return_date IS NULL
                        ORDER BY bt.created_at DESC
                        LIMIT 1
                    `, [userId, bookId]);

                    res.json({
                        success: true,
                        message,
                        transaction: transaction[0]
                    });
                } else {
                    await connection.rollback();
                    res.status(400).json({
                        success: false,
                        message
                    });
                }

            } catch (error) {
                await connection.rollback();
                throw error;
            }

        } catch (error) {
            console.error('Error during checkout:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Return a book
    static async returnBook(req, res) {
        try {
            const { transactionId } = req.params;
            const librarianId = req.user?.id;

            const connection = await pool.getConnection();

            try {
                await connection.beginTransaction();

                const [result] = await connection.execute(`
                    CALL return_book(?, ?, @success, @message, @fine_amount)
                `, [transactionId, librarianId]);

                const [output] = await connection.execute(
                    'SELECT @success as success, @message as message, @fine_amount as fine_amount'
                );
                const { success, message, fine_amount } = output[0];

                if (success) {
                    await connection.commit();

                    // Get updated transaction details
                    const [transaction] = await connection.execute(`
                        SELECT 
                            bt.*,
                            CONCAT(u.first_name, ' ', u.last_name) as user_name,
                            b.title,
                            b.author,
                            f.id as fine_id,
                            f.amount as fine_amount
                        FROM book_transactions bt
                        JOIN users u ON bt.user_id = u.id
                        JOIN books b ON bt.book_id = b.id
                        LEFT JOIN fines f ON bt.id = f.transaction_id AND f.status = 'pending'
                        WHERE bt.id = ?
                    `, [transactionId]);

                    res.json({
                        success: true,
                        message,
                        transaction: transaction[0],
                        fine_amount: parseFloat(fine_amount) || 0
                    });
                } else {
                    await connection.rollback();
                    res.status(400).json({
                        success: false,
                        message
                    });
                }

            } catch (error) {
                await connection.rollback();
                throw error;
            }

        } catch (error) {
            console.error('Error during return:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Renew a book
    static async renewBook(req, res) {
        try {
            const { transactionId } = req.params;
            const { renewDays = 14 } = req.body;
            const librarianId = req.user?.id;

            const connection = await pool.getConnection();

            // Check if renewal is allowed
            const [transaction] = await connection.execute(`
                SELECT 
                    bt.*,
                    b.title,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                JOIN users u ON bt.user_id = u.id
                WHERE bt.id = ? AND bt.return_date IS NULL
            `, [transactionId]);

            if (transaction.length === 0) {
                connection.release();
                return res.status(404).json({
                    error: 'Transaction not found or book already returned'
                });
            }

            const currentTransaction = transaction[0];

            // Check renewal limits
            const maxRenewals = 2; // From library settings
            if (currentTransaction.renewed_count >= maxRenewals) {
                connection.release();
                return res.status(400).json({
                    error: `Maximum renewal limit (${maxRenewals}) reached`
                });
            }

            // Check if book is reserved by someone else
            const [reservations] = await connection.execute(`
                SELECT COUNT(*) as count
                FROM reservations
                WHERE book_id = ? AND status = 'active' AND user_id != ?
            `, [currentTransaction.book_id, currentTransaction.user_id]);

            if (reservations[0].count > 0) {
                connection.release();
                return res.status(400).json({
                    error: 'Cannot renew: Book is reserved by another user'
                });
            }

            // Perform renewal
            const newDueDate = new Date();
            newDueDate.setDate(newDueDate.getDate() + renewDays);

            await connection.execute(`
                UPDATE book_transactions 
                SET due_date = ?, renewed_count = renewed_count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [newDueDate.toISOString().split('T')[0], transactionId]);

            // Create renewal record
            await connection.execute(`
                INSERT INTO book_transactions (
                    user_id, book_id, transaction_type, checkout_date, due_date, issued_by
                ) VALUES (?, ?, 'renew', CURDATE(), ?, ?)
            `, [currentTransaction.user_id, currentTransaction.book_id, newDueDate.toISOString().split('T')[0], librarianId]);

            // Get updated transaction
            const [updatedTransaction] = await connection.execute(`
                SELECT 
                    bt.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    b.title,
                    b.author
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                JOIN books b ON bt.book_id = b.id
                WHERE bt.id = ?
            `, [transactionId]);

            connection.release();

            res.json({
                success: true,
                message: 'Book renewed successfully',
                transaction: updatedTransaction[0],
                new_due_date: newDueDate.toISOString().split('T')[0]
            });

        } catch (error) {
            console.error('Error during renewal:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get active checkouts for a user
    static async getUserCheckouts(req, res) {
        try {
            const { userId } = req.params;
            const connection = await pool.getConnection();

            const [checkouts] = await connection.execute(`
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn,
                    cbl.shelf_code,
                    cbl.zone,
                    CASE 
                        WHEN bt.due_date < CURDATE() THEN 'overdue'
                        WHEN bt.due_date = CURDATE() THEN 'due_today'
                        ELSE 'active'
                    END as checkout_status,
                    DATEDIFF(CURDATE(), bt.due_date) as days_overdue,
                    f.amount as fine_amount
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                LEFT JOIN current_book_locations cbl ON b.id = cbl.book_id
                LEFT JOIN fines f ON bt.id = f.transaction_id AND f.status = 'pending'
                WHERE bt.user_id = ? AND bt.return_date IS NULL
                ORDER BY bt.checkout_date DESC
            `, [userId]);

            connection.release();

            res.json({
                user_id: parseInt(userId),
                active_checkouts: checkouts.length,
                checkouts
            });

        } catch (error) {
            console.error('Error fetching user checkouts:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get overdue books
    static async getOverdueBooks(req, res) {
        try {
            const connection = await pool.getConnection();

            const [overdueBooks] = await connection.execute(`
                SELECT 
                    bt.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    b.title,
                    b.author,
                    b.isbn,
                    DATEDIFF(CURDATE(), bt.due_date) as days_overdue,
                    GREATEST(DATEDIFF(CURDATE(), bt.due_date) * 1.00, 0) as calculated_fine,
                    f.amount as existing_fine,
                    f.status as fine_status
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                JOIN books b ON bt.book_id = b.id
                LEFT JOIN fines f ON bt.id = f.transaction_id
                WHERE bt.return_date IS NULL AND bt.due_date < CURDATE()
                ORDER BY bt.due_date ASC, u.last_name, u.first_name
            `);

            connection.release();

            res.json({
                total_overdue: overdueBooks.length,
                overdue_books: overdueBooks
            });

        } catch (error) {
            console.error('Error fetching overdue books:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get all active transactions
    static async getActiveTransactions(req, res) {
        try {
            const { page = 1, limit = 50, status = 'active' } = req.query;
            const connection = await pool.getConnection();

            const offset = (parseInt(page) - 1) * parseInt(limit);

            const [transactions] = await connection.execute(`
                SELECT 
                    bt.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    b.title,
                    b.author,
                    b.isbn,
                    CASE 
                        WHEN bt.due_date < CURDATE() THEN 'overdue'
                        WHEN bt.due_date = CURDATE() THEN 'due_today'
                        ELSE 'active'
                    END as checkout_status,
                    DATEDIFF(CURDATE(), bt.due_date) as days_overdue
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                JOIN books b ON bt.book_id = b.id
                WHERE (CASE WHEN bt.return_date IS NULL THEN 'active' ELSE 'returned' END) = ?
                ORDER BY bt.checkout_date DESC
                LIMIT ? OFFSET ?
            `, [status, parseInt(limit), offset]);

            // Get total count
            const [countResult] = await connection.execute(`
                SELECT COUNT(*) as total
                FROM book_transactions
                WHERE status = ?
            `, [status]);

            connection.release();

            res.json({
                transactions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Error fetching transactions:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get transaction history for a book
    static async getBookTransactionHistory(req, res) {
        try {
            const { bookId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const connection = await pool.getConnection();

            const offset = (parseInt(page) - 1) * parseInt(limit);

            const [transactions] = await connection.execute(`
                SELECT 
                    bt.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.student_id,
                    CONCAT(lib.first_name, ' ', lib.last_name) as processed_by
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                LEFT JOIN users lib ON bt.issued_by = lib.id
                WHERE bt.book_id = ?
                ORDER BY bt.created_at DESC
                LIMIT ? OFFSET ?
            `, [bookId, parseInt(limit), offset]);

            // Get total count
            const [countResult] = await connection.execute(`
                SELECT COUNT(*) as total
                FROM book_transactions
                WHERE book_id = ?
            `, [bookId]);

            connection.release();

            res.json({
                book_id: parseInt(bookId),
                transactions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Error fetching book transaction history:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Quick checkout by scanning RFID or barcode
    static async quickCheckout(req, res) {
        try {
            const { tagId, userId, scanMethod = 'rfid' } = req.body;
            const librarianId = req.user?.id;

            const connection = await pool.getConnection();

            // Find book by RFID tag or ISBN
            let bookQuery;
            let bookParams;

            if (scanMethod === 'rfid') {
                bookQuery = `
                    SELECT b.id, b.title, b.author, b.is_available
                    FROM books b
                    JOIN rfid_tags rt ON b.id = rt.book_id
                    WHERE rt.tag_id = ?
                `;
                bookParams = [tagId];
            } else {
                // Assume barcode is ISBN
                bookQuery = `
                    SELECT b.id, b.title, b.author, b.is_available
                    FROM books b
                    WHERE b.isbn = ?
                `;
                bookParams = [tagId];
            }

            const [books] = await connection.execute(bookQuery, bookParams);

            if (books.length === 0) {
                connection.release();
                return res.status(404).json({
                    error: `Book not found with ${scanMethod}: ${tagId}`
                });
            }

            const book = books[0];

            // Use the existing checkout procedure
            await connection.beginTransaction();

            try {
                const [result] = await connection.execute(`
                    CALL checkout_book(?, ?, ?, 14, @success, @message)
                `, [userId, book.id, librarianId]);

                const [output] = await connection.execute('SELECT @success as success, @message as message');
                const { success, message } = output[0];

                if (success) {
                    await connection.commit();
                    res.json({
                        success: true,
                        message: `"${book.title}" checked out successfully`,
                        book: {
                            id: book.id,
                            title: book.title,
                            author: book.author
                        },
                        scan_method: scanMethod,
                        scanned_id: tagId
                    });
                } else {
                    await connection.rollback();
                    res.status(400).json({
                        success: false,
                        message,
                        book: {
                            title: book.title,
                            author: book.author
                        }
                    });
                }

            } catch (error) {
                await connection.rollback();
                throw error;
            }

        } catch (error) {
            console.error('Error during quick checkout:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get all transactions with filtering
    static async getAllTransactions(req, res) {
        try {
            const { 
                status, user_id, book_id, page = 1, limit = 20,
                date_from, date_to, sort_by = 'checkout_date', sort_order = 'DESC' 
            } = req.query;
            
            const connection = await pool.getConnection();

            let query = `
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    CONCAT(checkout_lib.first_name, ' ', checkout_lib.last_name) as checked_out_by_name,
                    CONCAT(return_lib.first_name, ' ', return_lib.last_name) as returned_by_name,
                    CASE 
                        WHEN bt.return_date IS NULL AND bt.due_date < CURDATE() THEN 'overdue'
                        WHEN bt.return_date IS NULL THEN 'active'
                        ELSE 'returned'
                    END as transaction_status
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                JOIN users u ON bt.user_id = u.id
                LEFT JOIN users checkout_lib ON bt.checked_out_by = checkout_lib.id
                LEFT JOIN users return_lib ON bt.returned_by = return_lib.id
                WHERE 1=1
            `;

            let params = [];

            if (status) {
                if (status === 'active') {
                    query += ` AND bt.return_date IS NULL`;
                } else if (status === 'returned') {
                    query += ` AND bt.return_date IS NOT NULL`;
                } else if (status === 'overdue') {
                    query += ` AND bt.return_date IS NULL AND bt.due_date < CURDATE()`;
                }
            }

            if (user_id) {
                query += ` AND bt.user_id = ?`;
                params.push(user_id);
            }

            if (book_id) {
                query += ` AND bt.book_id = ?`;
                params.push(book_id);
            }

            if (date_from) {
                query += ` AND bt.checkout_date >= ?`;
                params.push(date_from);
            }

            if (date_to) {
                query += ` AND bt.checkout_date <= ?`;
                params.push(date_to);
            }

            // Add sorting
            const validSortFields = ['checkout_date', 'due_date', 'return_date', 'user_name', 'title'];
            const sortField = validSortFields.includes(sort_by) ? sort_by : 'checkout_date';
            const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
            
            if (sort_by === 'user_name') {
                query += ` ORDER BY CONCAT(u.first_name, ' ', u.last_name) ${sortDirection}`;
            } else if (sort_by === 'title') {
                query += ` ORDER BY b.title ${sortDirection}`;
            } else {
                query += ` ORDER BY bt.${sortField} ${sortDirection}`;
            }

            // Add pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), offset);

            const [transactions] = await connection.execute(query, params);

            // Get total count
            let countQuery = `
                SELECT COUNT(*) as total
                FROM book_transactions bt
                WHERE 1=1
            `;
            let countParams = [];

            if (status) {
                if (status === 'active') {
                    countQuery += ` AND bt.return_date IS NULL`;
                } else if (status === 'returned') {
                    countQuery += ` AND bt.return_date IS NOT NULL`;
                } else if (status === 'overdue') {
                    countQuery += ` AND bt.return_date IS NULL AND bt.due_date < CURDATE()`;
                }
            }

            if (user_id) {
                countQuery += ` AND bt.user_id = ?`;
                countParams.push(user_id);
            }

            if (book_id) {
                countQuery += ` AND bt.book_id = ?`;
                countParams.push(book_id);
            }

            if (date_from) {
                countQuery += ` AND bt.checkout_date >= ?`;
                countParams.push(date_from);
            }

            if (date_to) {
                countQuery += ` AND bt.checkout_date <= ?`;
                countParams.push(date_to);
            }

            const [countResult] = await connection.execute(countQuery, countParams);

            connection.release();

            res.json({
                transactions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Error fetching transactions:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get specific transaction details
    static async getTransactionById(req, res) {
        try {
            const { id } = req.params;
            const connection = await pool.getConnection();

            const [transactions] = await connection.execute(`
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn,
                    b.cover_image,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    u.phone,
                    CONCAT(checkout_lib.first_name, ' ', checkout_lib.last_name) as checked_out_by_name,
                    CONCAT(return_lib.first_name, ' ', return_lib.last_name) as returned_by_name,
                    CASE 
                        WHEN bt.return_date IS NULL AND bt.due_date < CURDATE() THEN 'overdue'
                        WHEN bt.return_date IS NULL THEN 'active'
                        ELSE 'returned'
                    END as transaction_status,
                    DATEDIFF(bt.due_date, CURDATE()) as days_until_due,
                    CASE WHEN bt.return_date IS NOT NULL THEN
                        DATEDIFF(bt.return_date, bt.checkout_date)
                    ELSE 
                        DATEDIFF(CURDATE(), bt.checkout_date)
                    END as loan_duration
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                JOIN users u ON bt.user_id = u.id
                LEFT JOIN users checkout_lib ON bt.checked_out_by = checkout_lib.id
                LEFT JOIN users return_lib ON bt.returned_by = return_lib.id
                WHERE bt.id = ?
            `, [id]);

            if (transactions.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'Transaction not found' });
            }

            // Get fines for this transaction if any
            const [fines] = await connection.execute(`
                SELECT * FROM fines 
                WHERE transaction_id = ? 
                ORDER BY created_at DESC
            `, [id]);

            connection.release();

            res.json({
                transaction: transactions[0],
                fines: fines
            });

        } catch (error) {
            console.error('Error fetching transaction:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get transaction statistics for dashboard
    static async getTransactionStatistics(req, res) {
        try {
            const { period = '30' } = req.query;
            const connection = await pool.getConnection();

            // Overall transaction statistics
            const [overallStats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_transactions,
                    COUNT(CASE WHEN return_date IS NULL THEN 1 END) as active_checkouts,
                    COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as completed_returns,
                    COUNT(CASE WHEN return_date IS NULL AND due_date < CURDATE() THEN 1 END) as overdue_books,
                    COUNT(CASE WHEN renewal_count > 0 THEN 1 END) as renewed_transactions,
                    AVG(CASE WHEN return_date IS NOT NULL THEN 
                        DATEDIFF(return_date, checkout_date) 
                    END) as avg_loan_duration
                FROM book_transactions
                WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            `, [parseInt(period)]);

            // Daily transaction trends
            const [dailyTrends] = await connection.execute(`
                SELECT 
                    DATE(checkout_date) as transaction_date,
                    COUNT(*) as checkouts,
                    COUNT(CASE WHEN return_date IS NOT NULL AND DATE(return_date) = DATE(checkout_date) THEN 1 END) as same_day_returns
                FROM book_transactions
                WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DATE(checkout_date)
                ORDER BY transaction_date DESC
                LIMIT 30
            `, [parseInt(period)]);

            // Most active users
            const [activeUsers] = await connection.execute(`
                SELECT 
                    u.id,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.student_id,
                    COUNT(bt.id) as transaction_count,
                    COUNT(CASE WHEN bt.return_date IS NULL THEN bt.id END) as active_checkouts
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                WHERE bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY u.id
                ORDER BY transaction_count DESC
                LIMIT 10
            `, [parseInt(period)]);

            // Most borrowed books
            const [popularBooks] = await connection.execute(`
                SELECT 
                    b.id,
                    b.title,
                    b.author,
                    b.isbn,
                    COUNT(bt.id) as checkout_count
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                WHERE bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY b.id
                ORDER BY checkout_count DESC
                LIMIT 10
            `, [parseInt(period)]);

            connection.release();

            res.json({
                period_days: parseInt(period),
                overall_statistics: overallStats[0],
                daily_trends: dailyTrends,
                active_users: activeUsers,
                popular_books: popularBooks
            });

        } catch (error) {
            console.error('Error fetching transaction statistics:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = TransactionController;
