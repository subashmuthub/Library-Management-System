/**
 * Library Dashboard Controller
 * Provides comprehensive statistics and metrics for the library dashboard
 */

const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

class LibraryDashboardController {
    // Get comprehensive dashboard statistics
    static async getDashboardStats(req, res) {
        try {
            const { period = '30' } = req.query; // days
            const connection = await pool.getConnection();

            // Today's key metrics
            const [todayStats] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT CASE 
                        WHEN el.entry_type = 'entry' AND DATE(el.timestamp) = CURDATE() 
                        THEN el.user_id 
                    END) as todays_entries,
                    COUNT(DISTINCT CASE 
                        WHEN bt.checkout_date = CURDATE() 
                        THEN bt.id 
                    END) as todays_checkouts,
                    COUNT(DISTINCT CASE 
                        WHEN bt.return_date = CURDATE() 
                        THEN bt.id 
                    END) as todays_returns,
                    COUNT(DISTINCT CASE 
                        WHEN r.created_at >= CURDATE() 
                        THEN r.id 
                    END) as todays_reservations
                FROM entry_logs el
                LEFT JOIN book_transactions bt ON 1=1
                LEFT JOIN reservations r ON 1=1
                WHERE el.timestamp >= CURDATE()
                   OR bt.checkout_date >= CURDATE()
                   OR bt.return_date >= CURDATE()
                   OR r.created_at >= CURDATE()
            `);

            // Overall library statistics
            const [overallStats] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT u.id) as total_users,
                    COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) as active_users,
                    COUNT(DISTINCT b.id) as total_books,
                    COUNT(DISTINCT CASE WHEN b.status = 'active' THEN b.id END) as available_books,
                    COUNT(DISTINCT bt_active.id) as current_checkouts,
                    COUNT(DISTINCT r_active.id) as active_reservations,
                    COUNT(DISTINCT f_pending.id) as pending_fines,
                    COALESCE(SUM(CASE WHEN f_pending.status = 'pending' THEN f_pending.amount - f_pending.amount_paid END), 0) as total_outstanding_fines
                FROM users u
                LEFT JOIN books b ON 1=1
                LEFT JOIN book_transactions bt_active ON b.id = bt_active.book_id AND bt_active.return_date IS NULL
                LEFT JOIN reservations r_active ON u.id = r_active.user_id AND r_active.status IN ('active', 'ready')
                LEFT JOIN fines f_pending ON u.id = f_pending.user_id AND f_pending.status = 'pending'
            `);

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
                    DATE(el.timestamp) as activity_date,
                    COUNT(DISTINCT CASE WHEN el.entry_type = 'entry' THEN el.user_id END) as unique_entries,
                    COUNT(DISTINCT bt.user_id) as unique_borrowers,
                    COUNT(bt.id) as daily_checkouts,
                    COUNT(CASE WHEN bt.return_date IS NOT NULL THEN bt.id END) as daily_returns
                FROM entry_logs el
                LEFT JOIN book_transactions bt ON DATE(el.timestamp) = bt.checkout_date
                WHERE el.timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY DATE(el.timestamp)
                ORDER BY activity_date DESC
                LIMIT 7
            `);

            // System health indicators
            const [healthStats] = await connection.execute(`
                SELECT 
                    COUNT(CASE WHEN bt.due_date < CURDATE() AND bt.return_date IS NULL THEN bt.id END) as overdue_count,
                    COUNT(CASE WHEN r.expiry_date < CURDATE() AND r.status = 'ready' THEN r.id END) as expired_reservations,
                    COUNT(CASE WHEN f.amount - f.amount_paid > 50 THEN f.id END) as high_value_fines,
                    COUNT(CASE WHEN u.status = 'suspended' THEN u.id END) as suspended_users
                FROM book_transactions bt
                LEFT JOIN reservations r ON 1=1
                LEFT JOIN fines f ON f.status = 'pending'
                LEFT JOIN users u ON 1=1
            `);

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
                    COUNT(DISTINCT b.id) as total_books,
                    COUNT(bt.id) as checkout_count,
                    COUNT(r.id) as reservation_count,
                    AVG(DATEDIFF(bt.return_date, bt.checkout_date)) as avg_loan_duration
                FROM book_categories bc
                LEFT JOIN books b ON bc.id = b.category_id
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                LEFT JOIN reservations r ON b.id = r.book_id 
                    AND r.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY bc.id, bc.name
                ORDER BY (COUNT(bt.id) + COUNT(r.id)) DESC
            `, [parseInt(period), parseInt(period)]);

            // Books with highest demand but low availability
            const [demandAnalysis] = await connection.execute(`
                SELECT 
                    b.id,
                    b.title,
                    b.author,
                    b.total_copies,
                    COUNT(DISTINCT bt.id) as checkout_count,
                    COUNT(DISTINCT r.id) as reservation_count,
                    (COUNT(DISTINCT bt.id) + COUNT(DISTINCT r.id)) as total_demand,
                    ROUND((COUNT(DISTINCT bt.id) + COUNT(DISTINCT r.id)) / b.total_copies, 2) as demand_ratio
                FROM books b
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                LEFT JOIN reservations r ON b.id = r.book_id 
                    AND r.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                WHERE b.total_copies > 0
                GROUP BY b.id
                HAVING total_demand > 0
                ORDER BY demand_ratio DESC
                LIMIT 10
            `, [parseInt(period)]);

            // Shelf utilization analysis
            const [shelfAnalysis] = await connection.execute(`
                SELECT 
                    s.shelf_number,
                    s.location,
                    s.capacity,
                    COUNT(DISTINCT b.id) as current_books,
                    ROUND((COUNT(DISTINCT b.id) / s.capacity) * 100, 1) as utilization_percent,
                    COUNT(DISTINCT bt.id) as checkout_activity
                FROM shelves s
                LEFT JOIN books b ON s.id = b.shelf_id AND b.status = 'active'
                LEFT JOIN book_transactions bt ON b.id = bt.book_id 
                    AND bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                WHERE s.is_active = TRUE
                GROUP BY s.id
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
                    HOUR(timestamp) as hour_of_day,
                    COUNT(DISTINCT CASE WHEN entry_type = 'entry' THEN user_id END) as entries,
                    COUNT(DISTINCT bt.id) as checkouts
                FROM entry_logs el
                LEFT JOIN book_transactions bt ON DATE(el.timestamp) = bt.checkout_date 
                    AND HOUR(el.timestamp) = HOUR(bt.created_at)
                WHERE el.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY HOUR(timestamp)
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
}

module.exports = LibraryDashboardController;
