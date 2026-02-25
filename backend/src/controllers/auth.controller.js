/**
 * Authentication Controller
 * 
 * Handles user registration and login logic.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { email, password, name, role, student_id, phone } = req.body;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        error: 'Registration Error',
        message: 'Email already registered'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Split name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || nameParts[0];

    // Insert new user
    const result = await query(
      `INSERT INTO users (email, password, first_name, last_name, role_id, student_id, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, firstName, lastName, role || 3, student_id, phone]
    );

    // Generate session token
    const token = jwt.sign(
      { id: result.insertId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return user data without token
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.insertId,
        name: name,
        email,
        role,
        student_id
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Login user and generate JWT
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const users = await query(
      `SELECT u.id, u.email, u.password, u.first_name, u.last_name, 
              u.role_id, r.role_name, u.student_id, u.status
       FROM users u
       JOIN user_roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Invalid email or password'
      });
    }

    const user = users[0];
    
    console.log('Login attempt:', { email, passwordLength: password.length });
    console.log('User found:', { email: user.email, status: user.status, hasPassword: !!user.password });

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Authentication Error',
        message: 'Account is inactive or suspended'
      });
    }

    // Verify password
    console.log('Comparing passwords...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Invalid email or password'
      });
    }

    // Generate session token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return user data without token
    res.json({
      success: true,
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: {
          id: user.role_id,
          role_name: user.role_name
        },
        student_id: user.student_id
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 */
const logout = async (req, res, next) => {
  try {
    // Clear the auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout
};
