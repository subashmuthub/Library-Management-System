/**
 * User Management Controller
 * Enhanced user operations for library management system
 */

const mysql = require('mysql2/promise');
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const normalizeRoleName = (roleName, roleId) => {
    const normalized = String(roleName || '').toLowerCase();
    if (normalized === 'admin' || Number(roleId) === 1) return 'admin';
    if (normalized === 'librarian' || Number(roleId) === 2) return 'librarian';
    if (normalized === 'clerk' || Number(roleId) === 7) return 'clerk';
    if (normalized === 'me_student' || Number(roleId) === 5) return 'me_student';
    if (normalized === 'research_scholar' || Number(roleId) === 6) return 'research_scholar';
    if (['faculty', 'teacher', 'staff'].includes(normalized) || Number(roleId) === 4) {
        return 'staff';
    }
    return normalized || 'student';
};

class UserManagementController {
    // Get all users with library statistics
    static async getAllUsers(req, res) {
        try {
            const { status } = req.query;

            let whereClause = '';
            const params = [];

            if (status && status !== 'all') {
                whereClause = 'WHERE u.status = ?';
                params.push(status);
            }

            const query = `
                SELECT 
                    u.id,
                    u.email,
                    u.first_name,
                    u.last_name,
                    u.role_id,
                    u.student_id,
                    u.phone,
                    u.status,
                    u.created_at,
                    u.updated_at,
                    r.role_name
                FROM users u
                LEFT JOIN user_roles r ON u.role_id = r.id
                ${whereClause}
                ORDER BY u.created_at DESC
            `;

            const [users] = await pool.execute(query, params);

            // Format users with full name for frontend
            const formattedUsers = users.map(u => ({
                ...u,
                role_name: normalizeRoleName(u.role_name, u.role_id),
                name: `${u.first_name} ${u.last_name}`
            }));

            res.json({
                success: true,
                users: formattedUsers,
                pagination: {
                    total: formattedUsers.length,
                    page: 1,
                    limit: formattedUsers.length,
                    totalPages: 1
                }
            });

        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get user details with full library activity
    static async getUserDetails(req, res) {
        try {
            const { userId } = req.params;
            const connection = await pool.getConnection();

            // Get user basic info
            const [users] = await connection.execute(`
                SELECT 
                    u.*,
                    r.role_name,
                    r.description as role_description
                FROM users u
                LEFT JOIN user_roles r ON u.role_id = r.id
                WHERE u.id = ?
            `, [userId]);

            if (users.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'User not found' });
            }

            const user = {
                ...users[0],
                role_name: normalizeRoleName(users[0].role_name, users[0].role_id)
            };

            // Get active checkouts
            const [activeCheckouts] = await connection.execute(`
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn,
                    DATEDIFF(bt.due_date, CURDATE()) as days_until_due,
                    CASE 
                        WHEN bt.due_date < CURDATE() THEN 'overdue'
                        WHEN DATEDIFF(bt.due_date, CURDATE()) <= 3 THEN 'due_soon'
                        ELSE 'normal'
                    END as status_type
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                WHERE bt.user_id = ? AND bt.return_date IS NULL
                ORDER BY bt.due_date ASC
            `, [userId]);

            // Get recent checkout history
            const [checkoutHistory] = await connection.execute(`
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                WHERE bt.user_id = ? AND bt.return_date IS NOT NULL
                ORDER BY bt.return_date DESC
                LIMIT 10
            `, [userId]);

            // Get active reservations
            const [activeReservations] = await connection.execute(`
                SELECT 
                    r.*,
                    b.title,
                    b.author,
                    b.isbn
                FROM reservations r
                JOIN books b ON r.book_id = b.id
                WHERE r.user_id = ? AND r.status IN ('active', 'ready')
                ORDER BY r.created_at DESC
            `, [userId]);

            // Get pending fines
            const [pendingFines] = await connection.execute(`
                SELECT 
                    f.*,
                    b.title,
                    b.author,
                    bt.checkout_date,
                    bt.due_date
                FROM fines f
                LEFT JOIN book_transactions bt ON f.transaction_id = bt.id
                LEFT JOIN books b ON bt.book_id = b.id
                WHERE f.user_id = ? AND f.status = 'pending'
                ORDER BY f.created_at DESC
            `, [userId]);

            // Get library statistics
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT CASE WHEN bt.return_date IS NULL THEN bt.id END) as active_checkouts,
                    COUNT(DISTINCT bt.id) as total_books_borrowed,
                    COUNT(DISTINCT CASE WHEN bt.return_date > bt.due_date THEN bt.id END) as overdue_returns,
                    COUNT(DISTINCT r.id) as total_reservations,
                    COUNT(DISTINCT f.id) as total_fines,
                    COALESCE(SUM(CASE WHEN f.status = 'pending' THEN f.amount - f.amount_paid END), 0) as outstanding_fines
                FROM book_transactions bt
                LEFT JOIN reservations r ON bt.user_id = r.user_id
                LEFT JOIN fines f ON bt.user_id = f.user_id
                WHERE bt.user_id = ?
            `, [userId]);

            connection.release();

            res.json({
                user,
                active_checkouts: activeCheckouts,
                checkout_history: checkoutHistory,
                active_reservations: activeReservations,
                pending_fines: pendingFines,
                statistics: stats[0]
            });

        } catch (error) {
            console.error('Error fetching user details:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Create new user account
    static async createUser(req, res) {
        try {
            const {
                first_name,
                last_name,
                name,
                email,
                password,
                student_id,
                roll_no,
                phone,
                address,
                department,
                degree_type,
                academic_year,
                role,
                role_id,
                status = 'active'
            } = req.body;

            // Handle name splitting if first_name/last_name not provided directly
            let fName = (first_name || '').trim();
            let lName = (last_name || '').trim();
            if (!fName && name) {
                const parts = name.trim().split(/\s+/);
                fName = parts[0] || 'User';
                lName = parts.slice(1).join(' ') || parts[0] || 'User';
            }

            if (!fName || !email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'First name, last name, email, and password are required',
                    message: 'First name, last name, email, and password are required'
                });
            }

            // Allowed Roles Validation & Mapping
            const allowedRoles = ['admin', 'librarian', 'clerk', 'student', 'ug_student', 'me_student', 'research_scholar', 'staff', 'faculty'];
            const roleToId = {
                admin: 1,
                librarian: 2,
                clerk: 7,
                student: 3,
                ug_student: 3,
                staff: 4,
                faculty: 4,
                me_student: 5,
                research_scholar: 6
            };
            const idToRole = {
                1: 'admin',
                2: 'librarian',
                3: 'student',
                4: 'staff',
                5: 'me_student',
                6: 'research_scholar',
                7: 'clerk'
            };

            let resolvedRoleId = 3;
            let resolvedRoleName = 'student';

            if (role_id && idToRole[Number(role_id)]) {
                resolvedRoleId = Number(role_id);
                resolvedRoleName = idToRole[resolvedRoleId];
            } else if (role) {
                const cleanRole = String(role).toLowerCase().trim();
                if (allowedRoles.includes(cleanRole)) {
                    resolvedRoleId = roleToId[cleanRole] || 3;
                    resolvedRoleName = cleanRole === 'ug_student' ? 'student' : (cleanRole === 'faculty' ? 'staff' : cleanRole);
                }
            }

            // Sensible defaults for optional/nullable fields to never pass undefined to MySQL2
            const effectiveStudentId = (student_id || roll_no || '').trim() || null;
            const effectivePhone = (phone || '').trim() || null;
            const effectiveAddress = (address || '').trim() || null;
            const effectiveDept = department || (['admin', 'administrator'].includes(resolvedRoleName) ? 'Administration' : ['librarian', 'clerk'].includes(resolvedRoleName) ? 'Library' : 'CSE');
            const effectiveDegree = degree_type || (['student', 'ug_student'].includes(resolvedRoleName) ? 'BE' : resolvedRoleName === 'me_student' ? 'ME' : resolvedRoleName === 'research_scholar' ? 'PhD' : null);
            const effectiveYear = academic_year || (['student', 'ug_student', 'me_student', 'research_scholar'].includes(resolvedRoleName) ? '1st Year' : null);

            const connection = await pool.getConnection();

            try {
                // Check if email already exists
                const [existingUsers] = await connection.execute(
                    'SELECT id FROM users WHERE email = ?',
                    [email.trim().toLowerCase()]
                );

                if (existingUsers.length > 0) {
                    connection.release();
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Email already exists',
                        message: 'Email already exists' 
                    });
                }

                // Check if student ID already exists (if provided)
                if (effectiveStudentId) {
                    const [existingStudentId] = await connection.execute(
                        'SELECT id FROM users WHERE student_id = ?',
                        [effectiveStudentId]
                    );

                    if (existingStudentId.length > 0) {
                        connection.release();
                        return res.status(400).json({ 
                            success: false, 
                            error: 'Student/Staff ID already exists',
                            message: 'Student/Staff ID already exists' 
                        });
                    }
                }

                // Hash password safely
                const hashedPassword = await bcrypt.hash(String(password), 10);

                // Create user with explicit nulls (never undefined)
                const [result] = await connection.execute(`
                    INSERT INTO users (
                        first_name, last_name, email, password,
                        role_id, role, student_id, phone, address,
                        department, degree_type, academic_year, status, email_verified
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `, [
                    fName,
                    lName || fName,
                    email.trim().toLowerCase(),
                    hashedPassword,
                    resolvedRoleId,
                    resolvedRoleName,
                    effectiveStudentId,
                    effectivePhone,
                    effectiveAddress,
                    effectiveDept,
                    effectiveDegree,
                    effectiveYear,
                    status
                ]);

                // Get created user with role info
                const [newUser] = await connection.execute(`
                    SELECT 
                        u.id, u.first_name, u.last_name, u.email, u.student_id,
                        u.phone, u.address, u.status, u.role, u.role_id, u.created_at,
                        r.role_name
                    FROM users u
                    LEFT JOIN user_roles r ON u.role_id = r.id
                    WHERE u.id = ?
                `, [result.insertId]);

                connection.release();

                const createdUser = {
                    ...newUser[0],
                    name: `${newUser[0]?.first_name || ''} ${newUser[0]?.last_name || ''}`.trim(),
                    role_name: normalizeRoleName(newUser[0]?.role_name || newUser[0]?.role, resolvedRoleId)
                };

                return res.status(201).json({
                    success: true,
                    message: 'User created successfully',
                    user: createdUser
                });
            } catch (innerError) {
                connection.release();
                throw innerError;
            }

        } catch (error) {
            console.error("Create User Error:", error);
            return res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error',
                message: error.message || 'Internal server error' 
            });
        }
    }

    // Update user information
    static async updateUser(req, res) {
        try {
            const {
                first_name,
                last_name,
                name,
                email,
                student_id,
                roll_no,
                phone,
                address,
                department,
                degree_type,
                academic_year,
                role,
                role_id,
                status
            } = req.body;

            const connection = await pool.getConnection();

            // Check if user exists
            const [users] = await connection.execute(
                'SELECT id, email, student_id FROM users WHERE id = ?',
                [userId]
            );

            if (users.length === 0) {
                connection.release();
                return res.status(404).json({ success: false, error: 'User not found', message: 'User not found' });
            }

            const currentUser = users[0];

            // Check for email conflicts (if email is being changed)
            if (email && email.trim().toLowerCase() !== currentUser.email) {
                const [emailConflict] = await connection.execute(
                    'SELECT id FROM users WHERE email = ? AND id != ?',
                    [email.trim().toLowerCase(), userId]
                );

                if (emailConflict.length > 0) {
                    connection.release();
                    return res.status(400).json({ success: false, error: 'Email already exists', message: 'Email already exists' });
                }
            }

            // Check for student ID conflicts (if student_id is being changed)
            const targetStudentId = student_id !== undefined ? (student_id || roll_no || null) : undefined;
            if (targetStudentId && targetStudentId !== currentUser.student_id) {
                const [studentIdConflict] = await connection.execute(
                    'SELECT id FROM users WHERE student_id = ? AND id != ?',
                    [targetStudentId, userId]
                );

                if (studentIdConflict.length > 0) {
                    connection.release();
                    return res.status(400).json({ success: false, error: 'Student ID already exists', message: 'Student ID already exists' });
                }
            }

            // Build update query dynamically
            const updates = [];
            const values = [];

            if (first_name !== undefined) {
                updates.push('first_name = ?');
                values.push(first_name);
            }
            if (last_name !== undefined) {
                updates.push('last_name = ?');
                values.push(last_name);
            }
            if (name && first_name === undefined && last_name === undefined) {
                const parts = name.trim().split(/\s+/);
                updates.push('first_name = ?');
                values.push(parts[0] || 'User');
                updates.push('last_name = ?');
                values.push(parts.slice(1).join(' ') || parts[0] || 'User');
            }
            if (email !== undefined) {
                updates.push('email = ?');
                values.push(email.trim().toLowerCase());
            }
            if (targetStudentId !== undefined) {
                updates.push('student_id = ?');
                values.push(targetStudentId);
            }
            if (phone !== undefined) {
                updates.push('phone = ?');
                values.push(phone || null);
            }
            if (address !== undefined) {
                updates.push('address = ?');
                values.push(address || null);
            }
            if (department !== undefined) {
                updates.push('department = ?');
                values.push(department || null);
            }
            if (degree_type !== undefined) {
                updates.push('degree_type = ?');
                values.push(degree_type || null);
            }
            if (academic_year !== undefined) {
                updates.push('academic_year = ?');
                values.push(academic_year || null);
            }

            // Role handling
            const roleToId = {
                admin: 1, librarian: 2, clerk: 7, student: 3, ug_student: 3,
                staff: 4, faculty: 4, me_student: 5, research_scholar: 6
            };
            const idToRole = {
                1: 'admin', 2: 'librarian', 3: 'student', 4: 'staff',
                5: 'me_student', 6: 'research_scholar', 7: 'clerk'
            };

            if (role_id !== undefined || role !== undefined) {
                let resolvedRoleId = role_id ? Number(role_id) : undefined;
                let resolvedRoleName = undefined;
                if (role_id && idToRole[Number(role_id)]) {
                    resolvedRoleId = Number(role_id);
                    resolvedRoleName = idToRole[resolvedRoleId];
                } else if (role) {
                    const cleanRole = String(role).toLowerCase().trim();
                    if (roleToId[cleanRole]) {
                        resolvedRoleId = roleToId[cleanRole];
                        resolvedRoleName = cleanRole === 'ug_student' ? 'student' : (cleanRole === 'faculty' ? 'staff' : cleanRole);
                    }
                }
                if (resolvedRoleId !== undefined) {
                    updates.push('role_id = ?');
                    values.push(resolvedRoleId);
                }
                if (resolvedRoleName !== undefined) {
                    updates.push('role = ?');
                    values.push(resolvedRoleName);
                }
            }

            if (status !== undefined) {
                updates.push('status = ?');
                values.push(status);
            }

            if (updates.length === 0) {
                connection.release();
                return res.status(400).json({ success: false, error: 'No valid fields to update', message: 'No valid fields to update' });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(userId);

            // Update user
            await connection.execute(`
                UPDATE users SET ${updates.join(', ')} WHERE id = ?
            `, values);

            // Get updated user details
            const [updatedUser] = await connection.execute(`
                SELECT 
                    u.*,
                    r.role_name
                FROM users u
                LEFT JOIN user_roles r ON u.role_id = r.id
                WHERE u.id = ?
            `, [userId]);

            const normalizedUpdatedUser = {
                ...updatedUser[0],
                role_name: normalizeRoleName(updatedUser[0]?.role_name, updatedUser[0]?.role_id)
            };

            connection.release();

            res.json({
                success: true,
                message: 'User updated successfully',
                user: normalizedUpdatedUser
            });

        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Deactivate/Activate user
    static async toggleUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { status, reason } = req.body;

            if (!['active', 'inactive', 'suspended'].includes(status)) {
                return res.status(400).json({
                    error: 'Invalid status. Must be: active, inactive, or suspended'
                });
            }

            const connection = await pool.getConnection();

            // Check if user exists
            const [users] = await connection.execute(`
                SELECT 
                    u.*,
                    COUNT(bt.id) as active_checkouts
                FROM users u
                LEFT JOIN book_transactions bt ON u.id = bt.user_id 
                    AND bt.return_date IS NULL
                WHERE u.id = ?
                GROUP BY u.id
            `, [userId]);

            if (users.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'User not found' });
            }

            const user = users[0];

            // If deactivating/suspending user with active checkouts, warn
            if (status !== 'active' && user.active_checkouts > 0) {
                return res.status(400).json({
                    error: `Cannot ${status} user with ${user.active_checkouts} active checkouts. Please return all books first.`,
                    active_checkouts: user.active_checkouts
                });
            }

            // Update user status
            await connection.execute(`
                UPDATE users 
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, userId]);

            // Log the status change if reason provided
            if (reason) {
                await connection.execute(`
                    INSERT INTO user_activity_log (user_id, action, details, created_by)
                    VALUES (?, 'status_change', ?, ?)
                `, [userId, `Status changed to ${status}: ${reason}`, req.user?.id || null]);
            }

            connection.release();

            res.json({
                success: true,
                message: `User ${status} successfully`,
                user_id: parseInt(userId),
                new_status: status
            });

        } catch (error) {
            console.error('Error toggling user status:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Reset user password
    static async resetUserPassword(req, res) {
        try {
            const { userId } = req.params;
            const { new_password, temporary = false } = req.body;

            if (!new_password || new_password.length < 6) {
                return res.status(400).json({
                    error: 'New password is required and must be at least 6 characters'
                });
            }

            const connection = await pool.getConnection();

            // Check if user exists
            const [users] = await connection.execute(
                'SELECT id, first_name, last_name, email FROM users WHERE id = ?',
                [userId]
            );

            if (users.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'User not found' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(new_password, 12);

            // Update password
            await connection.execute(`
                UPDATE users 
                SET password = ?, 
                    password_changed_at = CURRENT_TIMESTAMP,
                    force_password_change = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [hashedPassword, temporary, userId]);

            // Log password reset
            await connection.execute(`
                INSERT INTO user_activity_log (user_id, action, details, created_by)
                VALUES (?, 'password_reset', 'Password reset by administrator', ?)
            `, [userId, req.user?.id || null]);

            connection.release();

            res.json({
                success: true,
                message: 'Password reset successfully',
                user_id: parseInt(userId),
                temporary_password: temporary
            });

        } catch (error) {
            console.error('Error resetting password:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get user activity log
    static async getUserActivityLog(req, res) {
        try {
            const { userId } = req.params;
            const { limit = 20, page = 1 } = req.query;

            const connection = await pool.getConnection();

            const offset = (parseInt(page) - 1) * parseInt(limit);

            const [activities] = await connection.execute(`
                SELECT 
                    ual.*,
                    CONCAT(admin.first_name, ' ', admin.last_name) as created_by_name
                FROM user_activity_log ual
                LEFT JOIN users admin ON ual.created_by = admin.id
                WHERE ual.user_id = ?
                ORDER BY ual.created_at DESC
                LIMIT ? OFFSET ?
            `, [userId, parseInt(limit), offset]);

            // Get total count
            const [countResult] = await connection.execute(`
                SELECT COUNT(*) as total FROM user_activity_log WHERE user_id = ?
            `, [userId]);

            connection.release();

            res.json({
                activities,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Error fetching user activity log:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get library usage statistics for all users
    static async getLibraryUsageStatistics(req, res) {
        try {
            const { period = '30' } = req.query;
            const connection = await pool.getConnection();

            // Most active users by checkout count
            const [mostActiveUsers] = await connection.execute(`
                SELECT 
                    u.id,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    r.role_name,
                    COUNT(bt.id) as checkout_count,
                    COUNT(CASE WHEN bt.return_date IS NULL THEN bt.id END) as current_checkouts
                FROM users u
                LEFT JOIN user_roles r ON u.role_id = r.id
                LEFT JOIN book_transactions bt ON u.id = bt.user_id 
                    AND bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                WHERE u.status = 'active'
                GROUP BY u.id
                HAVING checkout_count > 0
                ORDER BY checkout_count DESC
                LIMIT 10
            `, [parseInt(period)]);

            // Users with most fines
            const [mostFines] = await connection.execute(`
                SELECT 
                    u.id,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.student_id,
                    COUNT(f.id) as fine_count,
                    SUM(f.amount) as total_fines,
                    SUM(CASE WHEN f.status = 'pending' THEN f.amount - f.amount_paid END) as outstanding_fines
                FROM users u
                JOIN fines f ON u.id = f.user_id
                WHERE f.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY u.id
                ORDER BY total_fines DESC
                LIMIT 10
            `, [parseInt(period)]);

            // Overall statistics
            const [overallStats] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT u.id) as total_active_users,
                    COUNT(DISTINCT bt.user_id) as users_with_checkouts,
                    COUNT(DISTINCT r.user_id) as users_with_reservations,
                    COUNT(DISTINCT f.user_id) as users_with_fines,
                    AVG(user_stats.checkout_count) as avg_checkouts_per_user
                FROM users u
                LEFT JOIN (
                    SELECT user_id, COUNT(*) as checkout_count
                    FROM book_transactions
                    WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    GROUP BY user_id
                ) user_stats ON u.id = user_stats.user_id
                LEFT JOIN book_transactions bt ON u.id = bt.user_id
                LEFT JOIN reservations r ON u.id = r.user_id
                LEFT JOIN fines f ON u.id = f.user_id
                WHERE u.status = 'active'
            `, [parseInt(period)]);

            connection.release();

            res.json({
                period_days: parseInt(period),
                most_active_users: mostActiveUsers,
                users_with_most_fines: mostFines,
                overall_statistics: overallStats[0]
            });

        } catch (error) {
            console.error('Error fetching library usage statistics:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = UserManagementController;
