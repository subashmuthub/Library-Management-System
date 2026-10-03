/**
 * Authentication Middleware
 *
 * Checks that an active server-side session exists and attaches the stored
 * user object to the request. No JWT verification needed — the session store
 * holds the authoritative user data.
 */

/**
 * Verify session and attach user to request
 */
const authenticate = (req, res, next) => {
  if (req.user) {
    return next();
  }

  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }

  // Fallback to Bearer token if provided
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded;
      return next();
    } catch {
      // Continue to unauthorized response
    }
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'No active session. Please log in.'
  });
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

    const roleName = String(req.user.role || req.user.role_name || req.user.role?.role_name || '').toLowerCase();
    const normalizedRoles = allowedRoles.map((r) => String(r).toLowerCase());

    if (!normalizedRoles.includes(roleName)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Authorized roles: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
