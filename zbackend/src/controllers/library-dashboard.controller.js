/**
 * Library Dashboard Controller
 * Provides comprehensive statistics and metrics for the library dashboard
 */

const mysql = require('mysql2/promise');
const { pool } = require('../config/database');
const EmailService = require('../services/email.service');

class LibraryDashboardController {
    static buildTopStudentsQuery(usePeriodFilter) {
        return `
            SELECT
                u.id,
                CONCAT(u.first_name, ' ', u.last_name) AS student_name,
                u.email,
                COALESCE(u.student_id, CONCAT('STU-', u.id)) AS student_id,
                COALESCE(e.entry_count, 0) AS visit_count,
                COALESCE(e.active_days, 0) AS active_days,
                COALESCE(b.borrow_count, 0) AS borrow_count,
                COALESCE(b.return_count, 0) AS return_count,
                (COALESCE(e.entry_count, 0) * 2 + COALESCE(b.borrow_count, 0) * 5) AS score_points,
                CASE
                    WHEN COALESCE(e.entry_count, 0) * 2 + COALESCE(b.borrow_count, 0) * 5 >= 120 THEN 'Platinum'
                    WHEN COALESCE(e.entry_count, 0) * 2 + COALESCE(b.borrow_count, 0) * 5 >= 80 THEN 'Gold'
                    WHEN COALESCE(e.entry_count, 0) * 2 + COALESCE(b.borrow_count, 0) * 5 >= 40 THEN 'Silver'
                    ELSE 'Bronze'
                END AS points_tier
            FROM users u
            LEFT JOIN (
                SELECT
                    user_id,
                    SUM(CASE WHEN entry_type = 'entry' THEN 1 ELSE 0 END) AS entry_count,
                    COUNT(DISTINCT DATE(timestamp)) AS active_days
                FROM entry_logs
                ${usePeriodFilter ? "WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)" : ""}
                GROUP BY user_id
            ) e ON u.id = e.user_id
            LEFT JOIN (
                SELECT
                    user_id,
                    COUNT(*) AS borrow_count,
                    SUM(CASE WHEN return_date IS NOT NULL THEN 1 ELSE 0 END) AS return_count
                FROM book_transactions
                ${usePeriodFilter ? "WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)" : ""}
                GROUP BY user_id
            ) b ON u.id = b.user_id
            WHERE u.status = 'active' AND COALESCE(u.role_id, 3) = 3
            HAVING visit_count > 0 OR borrow_count > 0
            ORDER BY score_points DESC, borrow_count DESC, visit_count DESC
            LIMIT ?
        `;
    }

    // Get comprehensive dashboard statistics
    static async getDashboardStats(req, res) {
        try {
            const { period = '30' } = req.query; // days
            const connection = await pool.getConnection();

            // Today's key metrics
            const [[{ todays_entries }]] = await connection.execute(`
                SELECT COUNT(DISTINCT user_id) as todays_entries
                FROM entry_logs 
                WHERE entry_type = 'entry' AND DATE(timestamp) = CURDATE()
            `);
            
            const [[{ todays_checkouts }]] = await connection.execute(`
                SELECT COUNT(DISTINCT id) as todays_checkouts
                FROM book_transactions 
                WHERE checkout_date = CURDATE()
            `);
            
            const [[{ todays_returns }]] = await connection.execute(`
                SELECT COUNT(DISTINCT id) as todays_returns
                FROM book_transactions 
                WHERE return_date = CURDATE()
            `);
            
            const [[{ todays_reservations }]] = await connection.execute(`
                SELECT COUNT(DISTINCT id) as todays_reservations
                FROM reservations 
                WHERE DATE(created_at) = CURDATE()
            `);
            
            const todayStats = [{ todays_entries, todays_checkouts, todays_returns, todays_reservations }];

            // Overall library statistics
            const [[{ total_users, active_users }]] = await connection.execute(`
                SELECT 
                    COUNT(id) as total_users,
                    COUNT(CASE WHEN status = 'active' THEN id END) as active_users
                FROM users
            `);
            
            const [[{ total_books, available_books }]] = await connection.execute(`
                SELECT 
                    COUNT(id) as total_books,
                    COUNT(CASE WHEN status = 'active' THEN id END) as available_books
                FROM books
            `);
            
            const [[{ current_checkouts }]] = await connection.execute(`
                SELECT COUNT(id) as current_checkouts
                FROM book_transactions
                WHERE return_date IS NULL
            `);
            
            const [[{ active_reservations }]] = await connection.execute(`
                SELECT COUNT(id) as active_reservations
                FROM reservations
                WHERE status IN ('active', 'ready')
            `);
            
            const [[{ pending_fines, total_outstanding_fines }]] = await connection.execute(`
                SELECT 
                    COUNT(id) as pending_fines,
                    COALESCE(SUM(amount - amount_paid), 0) as total_outstanding_fines
                FROM fines
                WHERE status = 'pending'
            `);
            
            const overallStats = [{
                total_users, active_users, total_books, available_books, 
                current_checkouts, active_reservations, pending_fines, total_outstanding_fines
            }];

            // Period-based circulation metrics
            const [circulationStats] = await connection.execute(`
                SELECT 
                    COUNT(bt.id) as total_checkouts,
                    COUNT(CASE WHEN bt.return_date IS NOT NULL THEN bt.id END) as completed_returns,
                    COUNT(CASE WHEN bt.return_date IS NULL AND bt.due_date < CURDATE() THEN bt.id END) as overdue_books,
                    COUNT(CASE WHEN bt.renewal_count > 0 THEN bt.id END) as renewed_books,
                    AVG(DATEDIFF(bt.return_date, bt.checkout_date)) as avg_loan_duration
                FROM book_transactions bt
                WHERE bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            `, [parseInt(period)]);

            // Most popular books in period
            const [popularBooks] = await connection.execute(`
                SELECT 
                    b.id,
                    b.title,
                    b.author,
                    b.isbn,
                    COUNT(bt.id) as checkout_count,
                    COUNT(r.id) as reservation_count,
                    (COUNT(bt.id) + COUNT(r.id)) as total_demand
                FROM books b
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                LEFT JOIN reservations r ON b.id = r.book_id 
                    AND r.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY b.id
                HAVING total_demand > 0
                ORDER BY total_demand DESC
                LIMIT 5
            `, [parseInt(period), parseInt(period)]);

            // Fine collection statistics
            const [fineStats] = await connection.execute(`
                SELECT 
                    COUNT(f.id) as total_fines,
                    SUM(CASE WHEN f.status = 'paid' THEN f.amount_paid END) as collected_amount,
                    SUM(CASE WHEN f.status = 'pending' THEN f.amount - f.amount_paid END) as pending_amount,
                    COUNT(CASE WHEN f.status = 'waived' THEN f.id END) as waived_count,
                    AVG(f.amount) as avg_fine_amount
                FROM fines f
                WHERE f.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            `, [parseInt(period)]);

            // User activity trends (last 7 days)
            const [activityTrends] = await connection.execute(`
                SELECT 
                    dates.activity_date,
                    COALESCE(entries.unique_entries, 0) as unique_entries,
                    COALESCE(checkouts.unique_borrowers, 0) as unique_borrowers,
                    COALESCE(checkouts.daily_checkouts, 0) as daily_checkouts,
                    COALESCE(returns.daily_returns, 0) as daily_returns
                FROM (
                    SELECT DISTINCT DATE(timestamp) as activity_date 
                    FROM entry_logs 
                    WHERE timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                ) dates
                LEFT JOIN (
                    SELECT DATE(timestamp) as d, COUNT(DISTINCT user_id) as unique_entries
                    FROM entry_logs
                    WHERE entry_type = 'entry' AND timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                    GROUP BY DATE(timestamp)
                ) entries ON dates.activity_date = entries.d
                LEFT JOIN (
                    SELECT checkout_date as d, COUNT(DISTINCT user_id) as unique_borrowers, COUNT(id) as daily_checkouts
                    FROM book_transactions
                    WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                    GROUP BY checkout_date
                ) checkouts ON dates.activity_date = checkouts.d
                LEFT JOIN (
                    SELECT return_date as d, COUNT(id) as daily_returns
                    FROM book_transactions
                    WHERE return_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                    GROUP BY return_date
                ) returns ON dates.activity_date = returns.d
                ORDER BY dates.activity_date DESC
                LIMIT 7
            `);

            // System health indicators
            const [[{ overdue_count }]] = await connection.execute(`
                SELECT COUNT(id) as overdue_count FROM book_transactions WHERE due_date < CURDATE() AND return_date IS NULL
            `);
            const [[{ expired_reservations }]] = await connection.execute(`
                SELECT COUNT(id) as expired_reservations FROM reservations WHERE expiry_date < CURDATE() AND status = 'ready'
            `);
            const [[{ high_value_fines }]] = await connection.execute(`
                SELECT COUNT(id) as high_value_fines FROM fines WHERE status = 'pending' AND amount - amount_paid > 50
            `);
            const [[{ suspended_users }]] = await connection.execute(`
                SELECT COUNT(id) as suspended_users FROM users WHERE status = 'suspended'
            `);
            const healthStats = [{ overdue_count, expired_reservations, high_value_fines, suspended_users }];

            connection.release();

            res.json({
                period_days: parseInt(period),
                today_metrics: todayStats[0],
                overall_statistics: overallStats[0],
                circulation_metrics: circulationStats[0],
                fine_statistics: fineStats[0],
                popular_books: popularBooks,
                activity_trends: activityTrends,
                system_health: healthStats[0]
            });

        } catch (error) {
            console.error('Error fetching dashboard statistics:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get real-time library status
    static async getLibraryStatus(req, res) {
        try {
            const connection = await pool.getConnection();

            // Current library occupancy (users currently in library)
            const [occupancyData] = await connection.execute(`
                SELECT 
                    COUNT(*) as current_occupancy,
                    MAX(timestamp) as last_entry_timestamp
                FROM (
                    SELECT 
                        user_id,
                        timestamp,
                        entry_type,
                        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY timestamp DESC) as rn
                    FROM entry_logs
                    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)
                ) latest_entries
                WHERE rn = 1 AND entry_type = 'entry'
            `);

            // Current book circulation status
            const [circulationStatus] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT b.id) as total_books,
                    COUNT(DISTINCT CASE WHEN bt.return_date IS NULL THEN b.id END) as books_checked_out,
                    COUNT(DISTINCT CASE WHEN bt.return_date IS NULL THEN NULL ELSE b.id END) as books_available,
                    COUNT(DISTINCT CASE WHEN bt.due_date < CURDATE() AND bt.return_date IS NULL THEN bt.id END) as overdue_books
                FROM books b
                LEFT JOIN book_transactions bt ON b.id = bt.book_id
                WHERE b.status = 'active'
            `);

            // Active reservation queue status
            const [reservationStatus] = await connection.execute(`
                SELECT 
                    COUNT(r.id) as total_active_reservations,
                    COUNT(CASE WHEN r.status = 'ready' THEN r.id END) as ready_for_pickup,
                    COUNT(CASE WHEN r.status = 'active' THEN r.id END) as waiting_in_queue,
                    COUNT(CASE WHEN r.expiry_date < CURDATE() AND r.status = 'ready' THEN r.id END) as expired_ready
                FROM reservations r
                WHERE r.status IN ('active', 'ready')
            `);

            // Recent alerts and notifications
            const [recentAlerts] = await connection.execute(`
                SELECT 'overdue' as alert_type, 
                       COUNT(*) as count,
                       'Overdue books requiring attention' as message
                FROM book_transactions bt
                WHERE bt.return_date IS NULL AND bt.due_date < CURDATE()
                UNION ALL
                SELECT 'expired_reservations' as alert_type,
                       COUNT(*) as count,
                       'Reservations expired and require action' as message
                FROM reservations r
                WHERE r.status = 'ready' AND r.expiry_date < CURDATE()
                UNION ALL
                SELECT 'high_fines' as alert_type,
                       COUNT(*) as count,
                       'Users with high outstanding fines' as message
                FROM fines f
                WHERE f.status = 'pending' AND (f.amount - f.amount_paid) > 25
            `);

            // Latest system activity (last 10 events)
            const [recentActivity] = await connection.execute(`
                SELECT 
                    'checkout' as activity_type,
                    bt.checkout_date as activity_time,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    b.title as book_title,
                    'Book checked out' as description
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                JOIN books b ON bt.book_id = b.id
                WHERE bt.checkout_date >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
                UNION ALL
                SELECT 
                    'return' as activity_type,
                    bt.return_date as activity_time,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    b.title as book_title,
                    'Book returned' as description
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                JOIN books b ON bt.book_id = b.id
                WHERE bt.return_date >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
                ORDER BY activity_time DESC
                LIMIT 10
            `);

            connection.release();

            res.json({
                timestamp: new Date().toISOString(),
                occupancy: occupancyData[0] || { current_occupancy: 0 },
                circulation: circulationStatus[0],
                reservations: reservationStatus[0],
                alerts: recentAlerts.filter(alert => alert.count > 0),
                recent_activity: recentActivity
            });

        } catch (error) {
            console.error('Error fetching library status:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get book analytics and insights
    static async getBookAnalytics(req, res) {
        try {
            const { period = '30' } = req.query;
            const connection = await pool.getConnection();

            // Category popularity
            const [categoryStats] = await connection.execute(`
                SELECT 
                    bc.name as category_name,
                    COUNT(b.id) as total_books,
                    COALESCE(SUM(tx.checkout_count), 0) as checkout_count,
                    COALESCE(SUM(res.reservation_count), 0) as reservation_count,
                    AVG(tx.avg_duration) as avg_loan_duration
                FROM book_categories bc
                LEFT JOIN books b ON bc.id = b.category_id
                LEFT JOIN (
                    SELECT book_id, COUNT(id) as checkout_count, AVG(DATEDIFF(return_date, checkout_date)) as avg_duration
                    FROM book_transactions
                    WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    GROUP BY book_id
                ) tx ON b.id = tx.book_id
                LEFT JOIN (
                    SELECT book_id, COUNT(id) as reservation_count
                    FROM reservations
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    GROUP BY book_id
                ) res ON b.id = res.book_id
                GROUP BY bc.id, bc.name
                ORDER BY (COALESCE(SUM(tx.checkout_count), 0) + COALESCE(SUM(res.reservation_count), 0)) DESC
            `, [parseInt(period), parseInt(period)]);

            // Books with highest demand but low availability
            const [demandAnalysis] = await connection.execute(`
                SELECT 
                    b.id,
                    b.title,
                    b.author,
                    b.total_copies,
                    COALESCE(tx.checkout_count, 0) as checkout_count,
                    COALESCE(res.reservation_count, 0) as reservation_count,
                    (COALESCE(tx.checkout_count, 0) + COALESCE(res.reservation_count, 0)) as total_demand,
                    ROUND((COALESCE(tx.checkout_count, 0) + COALESCE(res.reservation_count, 0)) / NULLIF(b.total_copies, 0), 2) as demand_ratio
                FROM books b
                LEFT JOIN (
                    SELECT book_id, COUNT(id) as checkout_count
                    FROM book_transactions
                    WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    GROUP BY book_id
                ) tx ON b.id = tx.book_id
                LEFT JOIN (
                    SELECT book_id, COUNT(id) as reservation_count
                    FROM reservations
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    GROUP BY book_id
                ) res ON b.id = res.book_id
                WHERE b.total_copies > 0
                HAVING total_demand > 0
                ORDER BY demand_ratio DESC
                LIMIT 10
            `, [parseInt(period), parseInt(period)]);

            // Shelf utilization analysis aligned with current shelves schema
            const [shelfAnalysis] = await connection.execute(`
                SELECT 
                    s.shelf_code,
                    CONCAT('Zone ', s.zone, ' - Floor ', s.floor, COALESCE(CONCAT(' - ', s.section), '')) as location,
                    s.capacity,
                    COUNT(DISTINCT b.id) as current_books,
                    ROUND((COUNT(DISTINCT b.id) / NULLIF(s.capacity, 0)) * 100, 1) as utilization_percent,
                    COUNT(DISTINCT bt.id) as checkout_activity
                FROM shelves s
                LEFT JOIN books b ON s.id = b.shelf_id AND b.status = 'active'
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY s.id, s.shelf_code, s.zone, s.floor, s.section, s.capacity
                ORDER BY utilization_percent DESC
            `, [parseInt(period)]);

            connection.release();

            res.json({
                period_days: parseInt(period),
                category_analysis: categoryStats,
                high_demand_books: demandAnalysis,
                shelf_utilization: shelfAnalysis
            });

        } catch (error) {
            console.error('Error fetching book analytics:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get user behavior insights
    static async getUserBehaviorInsights(req, res) {
        try {
            const { period = '30' } = req.query;
            const connection = await pool.getConnection();

            // Reading habits by user role
            const [roleInsights] = await connection.execute(`
                SELECT 
                    r.role_name,
                    COUNT(DISTINCT u.id) as active_users,
                    AVG(user_stats.books_borrowed) as avg_books_per_user,
                    AVG(user_stats.avg_loan_duration) as avg_loan_duration,
                    SUM(user_stats.total_fines) as total_fines_by_role
                FROM user_roles r
                LEFT JOIN users u ON r.id = u.role_id AND u.status = 'active'
                LEFT JOIN (
                    SELECT 
                        bt.user_id,
                        COUNT(bt.id) as books_borrowed,
                        AVG(DATEDIFF(bt.return_date, bt.checkout_date)) as avg_loan_duration,
                        COALESCE(SUM(f.amount), 0) as total_fines
                    FROM book_transactions bt
                    LEFT JOIN fines f ON bt.id = f.transaction_id
                    WHERE bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    GROUP BY bt.user_id
                ) user_stats ON u.id = user_stats.user_id
                GROUP BY r.id, r.role_name
                ORDER BY active_users DESC
            `, [parseInt(period)]);

            // Peak usage hours analysis
            const [hourlyUsage] = await connection.execute(`
                SELECT 
                    HOUR(el.timestamp) as hour_of_day,
                    COUNT(DISTINCT CASE WHEN el.entry_type = 'entry' THEN el.user_id END) as entries,
                    COUNT(DISTINCT bt.id) as checkouts
                FROM entry_logs el
                LEFT JOIN book_transactions bt ON DATE(el.timestamp) = bt.checkout_date 
                    AND HOUR(el.timestamp) = HOUR(bt.created_at)
                WHERE el.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY HOUR(el.timestamp)
                ORDER BY hour_of_day
            `, [parseInt(period)]);

            // User retention analysis
            const [retentionData] = await connection.execute(`
                SELECT 
                    CASE 
                        WHEN last_activity >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 'Very Active'
                        WHEN last_activity >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 'Active'
                        WHEN last_activity >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 'Occasional'
                        ELSE 'Inactive'
                    END as user_segment,
                    COUNT(*) as user_count
                FROM (
                    SELECT 
                        u.id,
                        GREATEST(
                            COALESCE(MAX(bt.checkout_date), '1900-01-01'),
                            COALESCE(MAX(r.created_at), '1900-01-01'),
                            COALESCE(MAX(DATE(el.timestamp)), '1900-01-01')
                        ) as last_activity
                    FROM users u
                    LEFT JOIN book_transactions bt ON u.id = bt.user_id
                    LEFT JOIN reservations r ON u.id = r.user_id
                    LEFT JOIN entry_logs el ON u.id = el.user_id
                    WHERE u.status = 'active'
                    GROUP BY u.id
                ) user_activity
                GROUP BY user_segment
                ORDER BY 
                    CASE user_segment
                        WHEN 'Very Active' THEN 1
                        WHEN 'Active' THEN 2
                        WHEN 'Occasional' THEN 3
                        WHEN 'Inactive' THEN 4
                    END
            `);

            connection.release();

            res.json({
                period_days: parseInt(period),
                role_insights: roleInsights,
                hourly_usage_pattern: hourlyUsage,
                user_retention: retentionData
            });

        } catch (error) {
            console.error('Error fetching user behavior insights:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get top students by visits and borrow activity with points leaderboard
    static async getTopStudentActivity(req, res) {
        try {
            const period = Math.max(1, parseInt(req.query.period || '30', 10));
            const limit = Math.max(5, Math.min(100, parseInt(req.query.limit || '20', 10)));
            const connection = await pool.getConnection();

            const [rowsInPeriod] = await connection.query(
                LibraryDashboardController.buildTopStudentsQuery(true),
                [period, period, limit],
            );

            let rows = rowsInPeriod;
            let fallbackApplied = false;
            if (!rows.length) {
                const [allTimeRows] = await connection.query(
                    LibraryDashboardController.buildTopStudentsQuery(false),
                    [limit],
                );
                rows = allTimeRows;
                fallbackApplied = true;
            }

            connection.release();

            const topVisitor = rows.reduce(
                (best, row) => (row.visit_count > (best?.visit_count || 0) ? row : best),
                null,
            );
            const topBorrower = rows.reduce(
                (best, row) => (row.borrow_count > (best?.borrow_count || 0) ? row : best),
                null,
            );

            res.json({
                period_days: period,
                leaderboard: rows,
                highlights: {
                    top_visitor: topVisitor,
                    top_borrower: topBorrower,
                },
                fallback_all_time: fallbackApplied,
            });
        } catch (error) {
            console.error('Error fetching top student activity:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get book order planning list with agent details for all books
    static async getBookOrderAgentDetails(req, res) {
        try {
            const limit = Math.max(20, Math.min(1000, parseInt(req.query.limit || '300', 10)));
            const connection = await pool.getConnection();

            const [summaryRows] = await connection.query(`
                SELECT COUNT(*) AS total_books
                FROM books
            `);

            const [rows] = await connection.query(`
                SELECT
                    b.id,
                    b.title,
                    b.author,
                    b.isbn,
                    COALESCE(NULLIF(TRIM(b.purchase_source), ''), 'Campus Book Fair') AS purchase_source,
                    COALESCE(NULLIF(TRIM(b.purchase_vendor), ''), COALESCE(NULLIF(TRIM(b.publisher), ''), 'Campus Supply Hub')) AS purchase_vendor,
                    COALESCE(b.purchase_price, 250.00) AS purchase_price,
                    b.purchase_date,
                    COALESCE(NULLIF(TRIM(b.purchase_invoice_no), ''), CONCAT('INV-', LPAD(b.id, 5, '0'))) AS purchase_invoice_no,
                    COALESCE(NULLIF(TRIM(b.publisher), ''), 'Campus Supply Hub') AS publisher,
                    COALESCE(b.total_copies, 0) AS total_copies,
                    COALESCE(t.active_loans, 0) AS active_loans,
                    COALESCE(r.active_reservations, 0) AS active_reservations,
                    GREATEST(COALESCE(b.total_copies, 0) - COALESCE(t.active_loans, 0), 0) AS available_now,
                    GREATEST(
                        (COALESCE(t.active_loans, 0) + COALESCE(r.active_reservations, 0)) - COALESCE(b.total_copies, 0) + 2,
                        0
                    ) AS suggested_order_qty,
                    CASE
                        WHEN (COALESCE(t.active_loans, 0) + COALESCE(r.active_reservations, 0)) >= COALESCE(b.total_copies, 0) + 3 THEN 'High'
                        WHEN (COALESCE(t.active_loans, 0) + COALESCE(r.active_reservations, 0)) >= COALESCE(b.total_copies, 0) THEN 'Medium'
                        ELSE 'Low'
                    END AS priority,
                    COALESCE(NULLIF(TRIM(b.vendor_agent_name), ''), CONCAT(COALESCE(NULLIF(TRIM(b.purchase_vendor), ''), 'Campus Supply Hub'), ' Agent')) AS agent_name,
                    CONCAT('agent+', b.id, '@libraryvendor.local') AS agent_email,
                    COALESCE(NULLIF(TRIM(b.vendor_agent_phone), ''), CONCAT('+91-9000', LPAD(MOD(b.id, 10000), 4, '0'))) AS agent_phone,
                    CASE
                        WHEN (COALESCE(t.active_loans, 0) + COALESCE(r.active_reservations, 0)) >= COALESCE(b.total_copies, 0) + 3 THEN 3
                        WHEN (COALESCE(t.active_loans, 0) + COALESCE(r.active_reservations, 0)) >= COALESCE(b.total_copies, 0) THEN 7
                        ELSE 14
                    END AS estimated_delivery_days
                FROM books b
                LEFT JOIN (
                    SELECT book_id, COUNT(*) AS active_loans
                    FROM book_transactions
                    WHERE return_date IS NULL
                    GROUP BY book_id
                ) t ON b.id = t.book_id
                LEFT JOIN (
                    SELECT book_id, COUNT(*) AS active_reservations
                    FROM reservations
                    WHERE status IN ('active', 'ready')
                    GROUP BY book_id
                ) r ON b.id = r.book_id
                ORDER BY
                    CASE
                        WHEN (COALESCE(t.active_loans, 0) + COALESCE(r.active_reservations, 0)) >= COALESCE(b.total_copies, 0) + 3 THEN 1
                        WHEN (COALESCE(t.active_loans, 0) + COALESCE(r.active_reservations, 0)) >= COALESCE(b.total_copies, 0) THEN 2
                        ELSE 3
                    END,
                    suggested_order_qty DESC,
                    b.title ASC
                LIMIT ${limit}
            `);

            connection.release();

            const summary = {
                total_books: Number(summaryRows?.[0]?.total_books || rows.length),
                high_priority: rows.filter((row) => row.priority === 'High').length,
                medium_priority: rows.filter((row) => row.priority === 'Medium').length,
                low_priority: rows.filter((row) => row.priority === 'Low').length,
                total_suggested_qty: rows.reduce((sum, row) => sum + Number(row.suggested_order_qty || 0), 0),
            };

            res.json({
                summary,
                orders: rows,
            });
        } catch (error) {
            console.error('Error fetching book order agent details:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Notify top student via email for active user recognition
    static async notifyTopStudentAward(req, res) {
        try {
            const period = Math.max(1, parseInt(req.body?.period || req.query?.period || '30', 10));
            const connection = await pool.getConnection();

            const [rows] = await connection.query(
                LibraryDashboardController.buildTopStudentsQuery(true),
                [period, period, 1],
            );

            connection.release();

            if (!rows.length) {
                return res.status(404).json({
                    success: false,
                    message: 'No eligible student found for the selected period',
                });
            }

            const winner = rows[0];
            const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
            const result = await EmailService.sendActiveUserAwardEmail(
                winner.email,
                winner.student_name,
                {
                    monthLabel,
                    borrowCount: winner.borrow_count,
                    visitCount: winner.visit_count,
                    rank: 1,
                    studentId: winner.student_id,
                },
            );

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send email notification',
                    error: result.error,
                });
            }

            return res.json({
                success: true,
                message: 'Recognition email sent to top student',
                winner,
            });
        } catch (error) {
            console.error('Error sending top student award email:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = LibraryDashboardController;
