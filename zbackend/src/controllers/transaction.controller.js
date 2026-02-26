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
            // Accept bookId from either params or body
            const bookId = req.params.bookId || req.body.bookId || req.body.book_id;
            const userId = req.body.userId || req.body.user_id;
            const loanDays = req.body.loanDays || req.body.loan_days || 14;
            // For development without auth: librarian can be null or from body
            const librarianId = req.user?.id || req.body.librarianId || null;
            
            if (!bookId) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const connection = await pool.getConnection();
            
            try {
                await connection.beginTransaction();

                // Check if book is available
                const [activeCheckouts] = await connection.execute(
                    'SELECT COUNT(*) as count FROM book_transactions WHERE book_id = ? AND status = ?',
                    [bookId, 'active']
                );

                if (activeCheckouts[0].count > 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        success: false,
                        message: 'Book is currently checked out'
                    });
                }

                // Check user's current checkout count
                const [userCheckouts] = await connection.execute(
                    'SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = ?',
                    [userId, 'active']
                );

                if (userCheckouts[0].count >= 5) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        success: false,
                        message: 'Maximum checkout limit (5) reached'
                    });
                }

                // Check for overdue books
                const [overdueBooks] = await connection.execute(
                    'SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = ? AND due_date < CURDATE()',
                    [userId, 'active']
                );

                if (overdueBooks[0].count > 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot checkout: user has overdue books'
                    });
                }

                // Create checkout transaction
                const checkoutDate = new Date();
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + parseInt(loanDays));

                const [result] = await connection.execute(`
                    INSERT INTO book_transactions (
                        user_id, 
                        book_id, 
                        checked_out_by,
                        checkout_date,
                        due_date,
                        transaction_type,
                        status
                    ) VALUES (?, ?, ?, ?, ?, 'checkout', 'active')
                `, [userId, bookId, librarianId, checkoutDate, dueDate]);

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
                    WHERE bt.id = ?
                `, [result.insertId]);

                connection.release();

                res.json({
                    success: true,
                    message: 'Book checked out successfully',
                    transaction: transaction[0]
                });

            } catch (error) {
                await connection.rollback();
                connection.release();
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
            const transactionId = req.params.id;
            const { condition = 'good', notes = '' } = req.body;
            const librarianId = req.user?.id || req.body.returned_by || null;

            const connection = await pool.getConnection();

            try {
                await connection.beginTransaction();

                // Get transaction details
                const [transactions] = await connection.execute(
                    'SELECT * FROM book_transactions WHERE id = ? AND status = ?',
                    [transactionId, 'active']
                );

                if (transactions.length === 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(404).json({
                        success: false,
                        message: 'Active transaction not found'
                    });
                }

                const transaction = transactions[0];
                const returnDate = new Date();
                const dueDate = new Date(transaction.due_date);
                
                // Calculate fine if overdue
                const daysOverdue = Math.max(0, Math.floor((returnDate - dueDate) / (1000 * 60 * 60 * 24)));
                const finePerDay = 1.00; // $1 per day
                const fineAmount = daysOverdue * finePerDay;

                // Update transaction
                await connection.execute(`
                    UPDATE book_transactions
                    SET 
                        return_date = ?,
                        returned_by = ?,
                        notes = ?,
                        status = 'returned'
                    WHERE id = ?
                `, [returnDate, librarianId, notes, transactionId]);

                let fineId = null;

                // Create fine record if overdue
                if (daysOverdue > 0) {
                    const [fineResult] = await connection.execute(`
                        INSERT INTO fines (
                            user_id,
                            transaction_id,
                            amount,
                            days_overdue,
                            status
                        ) VALUES (?, ?, ?, ?, 'pending')
                    `, [transaction.user_id, transactionId, fineAmount, daysOverdue]);
                    
                    fineId = fineResult.insertId;
                }

                await connection.commit();

                // Get updated transaction details
                const [updatedTransaction] = await connection.execute(`
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

                connection.release();

                res.json({
                    success: true,
                    message: 'Book returned successfully',
                    transaction: updatedTransaction[0],
                    fine_amount: fineAmount
                });

            } catch (error) {
                await connection.rollback();
                connection.release();
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
            const transactionId = req.params.id;
            // Accept both renewDays and renew_days for flexibility
            const renewDays = req.body.renewDays || req.body.renew_days || req.body.extend_days || 14;
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

            // Check renewal limits (handle both renewed_count and renewal_count)
            const maxRenewals = 2; // From library settings
            const renewedCount = currentTransaction.renewed_count || currentTransaction.renewal_count || 0;
            if (renewedCount >= maxRenewals) {
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

            // Update due date (try different column name variations)
            let updateSuccess = false;
            const updateErrors = [];
            
            // Try renewed_count first
            try {
                await connection.execute(`
                    UPDATE book_transactions 
                    SET due_date = ?, renewed_count = renewed_count + 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [newDueDate.toISOString().split('T')[0], transactionId]);
                updateSuccess = true;
            } catch (err) {
                updateErrors.push(err.code);
                // Try renewal_count
                try {
                    await connection.execute(`
                        UPDATE book_transactions 
                        SET due_date = ?, renewal_count = renewal_count + 1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [newDueDate.toISOString().split('T')[0], transactionId]);
                    updateSuccess = true;
                } catch (err2) {
                    updateErrors.push(err2.code);
                    // Just update due_date without renewal count
                    await connection.execute(`
                        UPDATE book_transactions 
                        SET due_date = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [newDueDate.toISOString().split('T')[0], transactionId]);
                    updateSuccess = true;
                }
            }

            // Create renewal record (handle both checked_out_by and issued_by column names)
            try {
                // Try with checked_out_by first (from add-library-tables.js)
                await connection.execute(`
                    INSERT INTO book_transactions (
                        user_id, book_id, transaction_type, checkout_date, due_date, checked_out_by
                    ) VALUES (?, ?, 'renew', CURDATE(), ?, ?)
                `, [currentTransaction.user_id, currentTransaction.book_id, newDueDate.toISOString().split('T')[0], librarianId]);
            } catch (err) {
                if (err.code === 'ER_BAD_FIELD_ERROR') {
                    // Try with issued_by (from schema.sql)
                    try {
                        await connection.execute(`
                            INSERT INTO book_transactions (
                                user_id, book_id, transaction_type, checkout_date, due_date, issued_by
                            ) VALUES (?, ?, 'renew', CURDATE(), ?, ?)
                        `, [currentTransaction.user_id, currentTransaction.book_id, newDueDate.toISOString().split('T')[0], librarianId]);
                    } catch (err2) {
                        if (err2.code === 'ER_BAD_FIELD_ERROR') {
                            // Neither column exists, insert without it
                            await connection.execute(`
                                INSERT INTO book_transactions (
                                    user_id, book_id, transaction_type, checkout_date, due_date
                                ) VALUES (?, ?, 'renew', CURDATE(), ?)
                            `, [currentTransaction.user_id, currentTransaction.book_id, newDueDate.toISOString().split('T')[0]]);
                        } else {
                            throw err2;
                        }
                    }
                } else {
                    throw err;
                }
            }

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
                LEFT JOIN users lib ON bt.checked_out_by = lib.id
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
            
            // Parse and validate pagination parameters
            const parsedPage = Math.max(1, parseInt(page) || 1);
            const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

            // Check if table has any data first
            const [countCheck] = await pool.query('SELECT COUNT(*) as total FROM book_transactions');
            if (countCheck[0].total === 0) {
                return res.json({
                    transactions: [],
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
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    CONCAT(checkout_lib.first_name, ' ', checkout_lib.last_name) as issued_by_name,
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
            const offset = (parsedPage - 1) * parsedLimit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(parsedLimit, offset);

            const [transactions] = await pool.query(query, params);

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

            const [countResult] = await pool.query(countQuery, countParams);

            // Map transaction_status to status for frontend compatibility
            const formattedTransactions = transactions.map(t => ({
                ...t,
                status: t.transaction_status || t.status || (t.return_date ? 'returned' : 'active')
            }));

            res.json({
                transactions: formattedTransactions,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parsedLimit)
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
                    b.cover_image_url,
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
