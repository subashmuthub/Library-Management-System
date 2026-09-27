/**
 * Entry policy middleware
 * Enforces mandatory library entry for student-facing actions.
 */

const { query } = require('../config/database');

const ENTRY_SESSION_MINUTES = Number.parseInt(process.env.ENTRY_SESSION_MINUTES || '480', 10);

const getRoleName = (sessionUser) =>
  String(sessionUser?.role || sessionUser?.role_name || sessionUser?.role?.role_name || '').toLowerCase();

const requireActiveEntryForStudents = async (req, res, next) => {
  try {
    const sessionUser = req.session?.user;
    const roleName = getRoleName(sessionUser);

    if (roleName !== 'student') {
      return next();
    }

    const userId = sessionUser?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const logs = await query(
      `SELECT entry_type, timestamp
       FROM entry_logs
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [userId],
    );

    if (!logs.length) {
      return res.status(428).json({
        error: 'Library entry required',
        code: 'ENTRY_REQUIRED',
        message: 'Please log your library entry before using this feature.',
      });
    }

    const lastLog = logs[0];
    const lastType = String(lastLog.entry_type || '').toLowerCase();
    const lastTime = new Date(lastLog.timestamp).getTime();
    const expiryTime = Date.now() - ENTRY_SESSION_MINUTES * 60 * 1000;

    const hasActiveEntry = lastType === 'entry' && lastTime >= expiryTime;

    if (!hasActiveEntry) {
      return res.status(428).json({
        error: 'Active entry session required',
        code: 'ENTRY_REQUIRED',
        message: 'Your library entry session is missing or expired. Please log entry again.',
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  requireActiveEntryForStudents,
};
