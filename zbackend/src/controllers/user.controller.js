/**
 * User Controller
 * 
 * Handles user profile and management operations.
 */

const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    // For development without auth: accept userId from query params
    const userId = req.user?.id || req.query.userId || req.params.id;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User ID is required (use ?userId=X for testing)'
      });
    }
    
    const users = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, ur.role_name as role, 
       u.student_id, u.phone, u.created_at
       FROM users u
       LEFT JOIN user_roles ur ON u.role_id = ur.id
       WHERE u.id = ?`,
      [userId]
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
      `SELECT u.id, u.email, u.first_name, u.last_name, ur.role_name as role, 
       u.student_id, u.phone, u.status, u.created_at
       FROM users u
       LEFT JOIN user_roles ur ON u.role_id = ur.id
       WHERE u.id = ?`,
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
      status: user.status,
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
    const { first_name, last_name, firstName, lastName, phone, email, student_id, profile_image_url, profileImageUrl } = req.body;
    
    // SECURITY: Role changes are NOT allowed from profile updates
    // Role can only be changed by admins through user management endpoints
    // Explicitly ignore any role/role_id fields sent in request
    
    const updates = [];
    const values = [];

    // Support both camelCase and snake_case
    if (first_name || firstName) {
      updates.push('first_name = ?');
      values.push(first_name || firstName);
    }
    if (last_name || lastName) {
      updates.push('last_name = ?');
      values.push(last_name || lastName);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (student_id !== undefined) {
      updates.push('student_id = ?');
      values.push(student_id);
    }
    if (phone) {
      updates.push('phone = ?');
      values.push(phone);
    }
    // profile image URL support (creates column if needed)
    const profileImageValue = profile_image_url || profileImageUrl;
    if (profileImageValue) {
      // ensure column exists
      const col = await query(
        `SELECT COUNT(*) as total FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'profile_image_url'`
      );
      if (!col[0]?.total) {
        await query(`ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL`);
      }
      updates.push('profile_image_url = ?');
      values.push(profileImageValue);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No fields to update'
      });
    }

    // For development without auth: accept userId from query params
    const userId = req.user?.id || req.query.userId || req.body.userId;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User ID is required (use ?userId=X for testing)'
      });
    }
    
    values.push(userId);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get updated user data
    const users = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, ur.role_name as role, 
       u.student_id, u.phone
       FROM users u
       LEFT JOIN user_roles ur ON u.role_id = ur.id
       WHERE u.id = ?`,
      [userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: users[0].id,
        name: `${users[0].first_name} ${users[0].last_name}`,
        first_name: users[0].first_name,
        last_name: users[0].last_name,
        email: users[0].email,
        role: users[0].role,
        student_id: users[0].student_id,
        phone: users[0].phone,
        profile_image_url: users[0].profile_image_url || null
      }
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

    let sql = `SELECT u.id, u.email, u.first_name, u.last_name, ur.role_name as role, 
               u.student_id, u.status, u.created_at
               FROM users u
               LEFT JOIN user_roles ur ON u.role_id = ur.id`;
    const params = [];

    if (role) {
      sql += ' WHERE ur.role_name = ?';
      params.push(role);
    }

    sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM users u';
    const countParams = [];
    if (role) {
      countSql += ' LEFT JOIN user_roles ur ON u.role_id = ur.id WHERE ur.role_name = ?';
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
        status: user.status,
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
  listUsers,
  uploadAvatar: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded', message: 'Please attach an avatar file under field name "avatar"' });
      }

      const userId = req.session?.user?.id || req.body.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Bad Request', message: 'User ID is required (session or body.userId)' });
      }

      // Ensure profile_image_url column exists
      const col = await query(
        `SELECT COUNT(*) as total FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'profile_image_url'`
      );
      if (!col[0]?.total) {
        await query(`ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL`);
      }

      // Build accessible URL path
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      await query(`UPDATE users SET profile_image_url = ? WHERE id = ?`, [avatarUrl, userId]);

      // Return updated user info
      const users = await query(
        `SELECT id, email, first_name, last_name, student_id, phone, u.updated_at, u.created_at, profile_image_url, ur.role_name as role
         FROM users u LEFT JOIN user_roles ur ON u.role_id = ur.id WHERE u.id = ?`,
        [userId]
      );

      res.json({
        message: 'Avatar uploaded successfully',
        user: {
          id: users[0].id,
          email: users[0].email,
          first_name: users[0].first_name,
          last_name: users[0].last_name,
          student_id: users[0].student_id,
          phone: users[0].phone,
          role: users[0].role,
          profile_image_url: users[0].profile_image_url
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
