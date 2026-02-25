/**
 * Reservation Controller
 * Handles book reservations and queue management
 */

const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

class ReservationController {
    // Reserve a book
    static async reserveBook(req, res) {
        try {
            const { book_id, user_id } = req.body;
            // For development without auth: accept userId from body or from auth
            const userId = req.user?.id || user_id;

            if (!book_id) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required (include user_id in request body for testing)' });
            }

            const connection = await pool.getConnection();

            // Check if book exists and is available
            const [books] = await connection.execute(`
                SELECT 
                    b.*,
                    COALESCE(b.total_copies - COUNT(bt.id), b.total_copies) as available_copies
                FROM books b
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.return_date IS NULL
                WHERE b.id = ? AND b.status = 'active'
                GROUP BY b.id
            `, [book_id]);

            if (books.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'Book not found or inactive' });
            }

            const book = books[0];

            // Check if user already has this book reserved
            const [existingReservations] = await connection.execute(`
                SELECT * FROM reservations 
                WHERE book_id = ? AND user_id = ? AND status IN ('active', 'ready')
            `, [book_id, userId]);

            if (existingReservations.length > 0) {
                connection.release();
                return res.status(400).json({ 
                    error: 'You already have an active reservation for this book' 
                });
            }

            // Check if user already has this book checked out
            const [currentCheckouts] = await connection.execute(`
                SELECT * FROM book_transactions 
                WHERE book_id = ? AND user_id = ? AND return_date IS NULL
            `, [book_id, userId]);

            if (currentCheckouts.length > 0) {
                connection.release();
                return res.status(400).json({ 
                    error: 'You already have this book checked out' 
                });
            }

            // Check if user has reached reservation limit
            const [userReservations] = await connection.execute(`
                SELECT COUNT(*) as active_reservations 
                FROM reservations 
                WHERE user_id = ? AND status IN ('active', 'ready')
            `, [userId]);

            const maxReservations = 5; // Can be made configurable
            if (userReservations[0].active_reservations >= maxReservations) {
                connection.release();
                return res.status(400).json({ 
                    error: `Maximum ${maxReservations} active reservations allowed` 
                });
            }

            let status, scheduledDate, expiryDate;

            if (book.available_copies > 0) {
                // Book is available, mark as ready
                status = 'ready';
                scheduledDate = new Date();
                expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 3); // 3 days to pick up
            } else {
                // Book is not available, add to queue
                status = 'active';
                scheduledDate = null;
                expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 30); // 30 days max wait
            }

            // Get queue position
            const [queuePosition] = await connection.execute(`
                SELECT COUNT(*) + 1 as position
                FROM reservations 
                WHERE book_id = ? AND status = 'active' AND created_at < NOW()
            `, [book_id]);

            // Create reservation
            const [result] = await connection.execute(`
                INSERT INTO reservations (
                    user_id, book_id, status, scheduled_date, 
                    expiry_date, queue_position
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId, book_id, status, scheduledDate, 
                expiryDate, queuePosition[0].position
            ]);

            // Get created reservation with details
            const [newReservation] = await connection.execute(`
                SELECT 
                    r.*,
                    b.title,
                    b.author,
                    b.isbn,
                    b.total_copies,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id
                FROM reservations r
                JOIN books b ON r.book_id = b.id
                JOIN users u ON r.user_id = u.id
                WHERE r.id = ?
            `, [result.insertId]);

            connection.release();

            const message = status === 'ready' 
                ? 'Book reserved successfully! Ready for pickup.'
                : `Book reserved successfully! You are #${queuePosition[0].position} in queue.`;

            res.status(201).json({
                success: true,
                message,
                reservation: newReservation[0]
            });

        } catch (error) {
            console.error('Error creating reservation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get user's reservations
    static async getUserReservations(req, res) {
        try {
            const userId = req.params.userId || req.user?.id;
            const { status, page = 1, limit = 10 } = req.query;
            
            const connection = await pool.getConnection();

            let query = `
                SELECT 
                    r.*,
                    b.title,
                    b.author,
                    b.isbn,
                    b.cover_image,
                    b.total_copies,
                    COALESCE(b.total_copies - COUNT(bt.id), b.total_copies) as available_copies
                FROM reservations r
                JOIN books b ON r.book_id = b.id
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.return_date IS NULL
                WHERE r.user_id = ?
            `;

            let params = [userId];

            if (status) {
                query += ` AND r.status = ?`;
                params.push(status);
            }

            query += ` GROUP BY r.id ORDER BY r.created_at DESC`;

            // Add pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), offset);

            const [reservations] = await connection.execute(query, params);

            // Get total count
            let countQuery = `SELECT COUNT(*) as total FROM reservations WHERE user_id = ?`;
            let countParams = [userId];
            if (status) {
                countQuery += ` AND status = ?`;
                countParams.push(status);
            }

            const [countResult] = await connection.execute(countQuery, countParams);

            connection.release();

            res.json({
                reservations,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Error fetching user reservations:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get all reservations (admin/librarian view)
    static async getAllReservations(req, res) {
        try {
            const { status, book_id, page = 1, limit = 20 } = req.query;
            
            // Parse and validate pagination parameters
            const parsedPage = Math.max(1, parseInt(page) || 1);
            const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

            // Check if table has any data first
            const [countCheck] = await pool.query('SELECT COUNT(*) as total FROM reservations');
            if (countCheck[0].total === 0) {
                return res.json({
                    reservations: [],
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
                    r.*,
                    b.title,
                    b.author,
                    b.isbn,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    u.phone
                FROM reservations r
                JOIN books b ON r.book_id = b.id
                JOIN users u ON r.user_id = u.id
                WHERE 1=1
            `;

            let params = [];

            if (status) {
                query += ` AND r.status = ?`;
                params.push(status);
            }

            if (book_id) {
                query += ` AND r.book_id = ?`;
                params.push(book_id);
            }

            query += ` ORDER BY 
                CASE WHEN r.status = 'ready' THEN 1 
                     WHEN r.status = 'active' THEN 2 
                     ELSE 3 END,
                r.created_at ASC`;

            // Add pagination
            const offset = (parsedPage - 1) * parsedLimit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(parsedLimit, offset);

            const [reservations] = await pool.query(query, params);

            // Get total count
            let countQuery = `SELECT COUNT(*) as total FROM reservations r WHERE 1=1`;
            let countParams = [];
            if (status) {
                countQuery += ` AND r.status = ?`;
                countParams.push(status);
            }
            if (book_id) {
                countQuery += ` AND r.book_id = ?`;
                countParams.push(book_id);
            }

            const [countResult] = await pool.query(countQuery, countParams);

            res.json({
                reservations,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parsedLimit)
                }
            });

        } catch (error) {
            console.error('Error fetching reservations:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Cancel reservation
    static async cancelReservation(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const userRole = req.user?.role?.role_name;

            const connection = await pool.getConnection();

            // Get reservation details
            const [reservations] = await connection.execute(`
                SELECT 
                    r.*,
                    b.title,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name
                FROM reservations r
                JOIN books b ON r.book_id = b.id
                JOIN users u ON r.user_id = u.id
                WHERE r.id = ?
            `, [id]);

            if (reservations.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'Reservation not found' });
            }

            const reservation = reservations[0];

            // Check permissions - user can cancel their own, librarian/admin can cancel any
            if (reservation.user_id !== userId && 
                !['admin', 'librarian'].includes(userRole)) {
                connection.release();
                return res.status(403).json({ 
                    error: 'You can only cancel your own reservations' 
                });
            }

            if (reservation.status === 'cancelled' || reservation.status === 'fulfilled') {
                connection.release();
                return res.status(400).json({ 
                    error: 'Reservation already cancelled or fulfilled' 
                });
            }

            // Cancel the reservation
            await connection.execute(`
                UPDATE reservations 
                SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [id]);

            // Update queue positions for remaining reservations of the same book
            await connection.execute(`
                UPDATE reservations r1
                JOIN (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as new_position
                    FROM reservations 
                    WHERE book_id = ? AND status = 'active'
                ) r2 ON r1.id = r2.id
                SET r1.queue_position = r2.new_position
            `, [reservation.book_id]);

            // Check if next person in queue can be notified for ready status
            await this.processReservationQueue(reservation.book_id);

            connection.release();

            res.json({
                success: true,
                message: 'Reservation cancelled successfully',
                reservation_id: parseInt(id)
            });

        } catch (error) {
            console.error('Error cancelling reservation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Fulfill reservation (when book is picked up)
    static async fulfillReservation(req, res) {
        try {
            const { id } = req.params;
            const librarianId = req.user?.id;

            const connection = await pool.getConnection();

            // Get reservation details
            const [reservations] = await connection.execute(`
                SELECT 
                    r.*,
                    b.title,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name
                FROM reservations r
                JOIN books b ON r.book_id = b.id
                JOIN users u ON r.user_id = u.id
                WHERE r.id = ? AND r.status = 'ready'
            `, [id]);

            if (reservations.length === 0) {
                connection.release();
                return res.status(404).json({ 
                    error: 'Ready reservation not found' 
                });
            }

            const reservation = reservations[0];

            // Start transaction
            await connection.beginTransaction();

            try {
                // Mark reservation as fulfilled
                await connection.execute(`
                    UPDATE reservations 
                    SET status = 'fulfilled', 
                        pickup_date = CURRENT_TIMESTAMP,
                        fulfilled_by = ?
                    WHERE id = ?
                `, [librarianId, id]);

                // Create book checkout transaction
                const [checkoutResult] = await connection.execute(`
                    INSERT INTO book_transactions (
                        user_id, book_id, checkout_date, due_date, 
                        checked_out_by, reservation_id
                    ) VALUES (
                        ?, ?, CURDATE(), 
                        DATE_ADD(CURDATE(), INTERVAL 14 DAY),
                        ?, ?
                    )
                `, [
                    reservation.user_id, reservation.book_id, 
                    librarianId, reservation.id
                ]);

                await connection.commit();

                // Get the created transaction
                const [newTransaction] = await connection.execute(`
                    SELECT 
                        bt.*,
                        b.title,
                        CONCAT(u.first_name, ' ', u.last_name) as user_name,
                        CONCAT(lib.first_name, ' ', lib.last_name) as librarian_name
                    FROM book_transactions bt
                    JOIN books b ON bt.book_id = b.id
                    JOIN users u ON bt.user_id = u.id
                    LEFT JOIN users lib ON bt.checked_out_by = lib.id
                    WHERE bt.id = ?
                `, [checkoutResult.insertId]);

                connection.release();

                res.json({
                    success: true,
                    message: 'Reservation fulfilled - Book checked out successfully',
                    reservation: {
                        id: reservation.id,
                        status: 'fulfilled'
                    },
                    transaction: newTransaction[0]
                });

            } catch (transactionError) {
                await connection.rollback();
                throw transactionError;
            }

        } catch (error) {
            console.error('Error fulfilling reservation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get reservation queue for a book
    static async getBookReservationQueue(req, res) {
        try {
            const { bookId } = req.params;
            
            const connection = await pool.getConnection();

            const [queueData] = await connection.execute(`
                SELECT 
                    r.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    b.title,
                    b.author,
                    COALESCE(b.total_copies - COUNT(bt.id), b.total_copies) as available_copies
                FROM reservations r
                JOIN users u ON r.user_id = u.id
                JOIN books b ON r.book_id = b.id
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.return_date IS NULL
                WHERE r.book_id = ? AND r.status IN ('active', 'ready')
                GROUP BY r.id
                ORDER BY 
                    CASE WHEN r.status = 'ready' THEN 1 ELSE 2 END,
                    r.queue_position ASC,
                    r.created_at ASC
            `, [bookId]);

            connection.release();

            res.json({
                book_id: parseInt(bookId),
                queue: queueData
            });

        } catch (error) {
            console.error('Error fetching book reservation queue:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Process reservation queue when book becomes available
    static async processReservationQueue(bookId) {
        try {
            const connection = await pool.getConnection();

            // Check available copies
            const [books] = await connection.execute(`
                SELECT 
                    b.*,
                    COALESCE(b.total_copies - COUNT(bt.id), b.total_copies) as available_copies
                FROM books b
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.return_date IS NULL
                WHERE b.id = ?
                GROUP BY b.id
            `, [bookId]);

            if (books.length === 0 || books[0].available_copies <= 0) {
                connection.release();
                return;
            }

            const availableCopies = books[0].available_copies;

            // Get next reservations in queue
            const [nextReservations] = await connection.execute(`
                SELECT * FROM reservations 
                WHERE book_id = ? AND status = 'active'
                ORDER BY queue_position ASC, created_at ASC
                LIMIT ?
            `, [bookId, availableCopies]);

            // Mark them as ready
            for (const reservation of nextReservations) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 3); // 3 days to pick up

                await connection.execute(`
                    UPDATE reservations 
                    SET status = 'ready',
                        scheduled_date = CURRENT_TIMESTAMP,
                        expiry_date = ?
                    WHERE id = ?
                `, [expiryDate, reservation.id]);

                // Here you could also send notification to user
                console.log(`Reservation ${reservation.id} is now ready for pickup`);
            }

            connection.release();

        } catch (error) {
            console.error('Error processing reservation queue:', error);
        }
    }

    // Get reservation statistics
    static async getReservationStatistics(req, res) {
        try {
            const { period = '30' } = req.query;
            const connection = await pool.getConnection();

            // Overall statistics
            const [overallStats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_reservations,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_reservations,
                    COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_reservations,
                    COUNT(CASE WHEN status = 'fulfilled' THEN 1 END) as fulfilled_reservations,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_reservations,
                    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_reservations
                FROM reservations
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            `, [parseInt(period)]);

            // Most reserved books
            const [mostReserved] = await connection.execute(`
                SELECT 
                    b.id,
                    b.title,
                    b.author,
                    COUNT(r.id) as reservation_count
                FROM books b
                JOIN reservations r ON b.id = r.book_id
                WHERE r.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY b.id
                ORDER BY reservation_count DESC
                LIMIT 10
            `, [parseInt(period)]);

            connection.release();

            res.json({
                period_days: parseInt(period),
                overall_statistics: overallStats[0],
                most_reserved_books: mostReserved
            });

        } catch (error) {
            console.error('Error fetching reservation statistics:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = ReservationController;
