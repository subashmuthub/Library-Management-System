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
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No active session. Please log in.'
    });
  }

  // Attach the session user to the request so downstream code can use req.user
  req.user = req.session.user;
  next();
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
