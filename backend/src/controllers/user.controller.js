/**
 * User Controller
 * 
 * Handles user profile and management operations.
 */

const { query } = require('../config/database');

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const users = await query(
      `SELECT id, email, first_name, last_name, role, student_id, phone, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      studentId: user.student_id,
      phone: user.phone,
      createdAt: user.created_at
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (admin/librarian only)
 */
const getUserById = async (req, res, next) => {
  try {
    const users = await query(
      `SELECT id, email, first_name, last_name, role, student_id, phone, is_active, created_at
       FROM users WHERE id = ?`,
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      studentId: user.student_id,
      phone: user.phone,
      isActive: user.is_active,
      createdAt: user.created_at
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const updates = [];
    const values = [];

    if (firstName) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (phone) {
      updates.push('phone = ?');
      values.push(phone);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No fields to update'
      });
    }

    values.push(req.user.id);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      message: 'Profile updated successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * List all users (admin only)
 */
const listUsers = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const role = req.query.role;

    let sql = `SELECT id, email, first_name, last_name, role, student_id, is_active, created_at
               FROM users`;
    const params = [];

    if (role) {
      sql += ' WHERE role = ?';
      params.push(role);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM users';
    const countParams = [];
    if (role) {
      countSql += ' WHERE role = ?';
      countParams.push(role);
    }
    const [countResult] = await query(countSql, countParams);

    res.json({
      total: countResult.total,
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        studentId: user.student_id,
        isActive: user.is_active,
        createdAt: user.created_at
      }))
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  getUserById,
  updateProfile,
  listUsers
};
