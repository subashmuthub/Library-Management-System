/**
 * Authentication Middleware
 * 
 * Validates JWT tokens and enforces role-based access control.
 */

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = (req, res, next) => {
  try {
    // Extract token from cookie
    const token = req.cookies.auth_token;
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication cookie found'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Session expired'
      });
    }
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid session'
    });
  }
};

/**
 * Authorize based on user role
 * Usage: authorize(['admin', 'librarian'])
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
