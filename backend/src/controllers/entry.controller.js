/**
 * Entry Controller (Enhanced Version)
 * 
 * Handles student entry/exit logging with upgraded hybrid GPS confidence scoring.
 * 
 * NEW FEATURES:
 * - Entry debounce (prevents duplicate entries within 5 minutes)
 * - Time-of-day validation (library hours check)
 * - Exit validation (must be outside outer zone)
 * - Multi-zone GPS scoring
 */

const { query } = require('../config/database');
const entryService = require('../services/entry.service');
const configService = require('../services/config.service');

/**
 * Log entry or exit (Enhanced)
 * 
 * ALGORITHM: Enhanced Hybrid GPS Entry Confidence Scoring
 * 1. Check time-of-day (library hours)
 * 2. Check for recent entry (debounce)
 * 3. Validate exit conditions (if exit type)
 * 4. Calculate GPS confidence with multi-zone scoring (40 points max)
 * 5. Calculate Wi-Fi confidence (40 points max)
 * 6. Calculate motion confidence (20 points max)
 * 7. Total confidence = sum of all three
 * 8. Auto-log if confidence >= 80
 * 9. Request manual confirmation if 50 <= confidence < 80
 * 10. Reject if confidence < 50 (unless manually confirmed)
 */
const logEntry = async (req, res, next) => {
  try {
    const {
      entryType,
      latitude,
      longitude,
      wifiSSID,
      speedKmh,
      manualConfirm
    } = req.body;

    const userId = req.user.id;

    // Step 1: Check library hours (warning only, not blocking)
    const withinHours = await entryService.isWithinLibraryHours();
    const libraryHoursWarning = !withinHours;

    // Step 2: Check for recent entry (debounce)
    const recentCheck = await entryService.checkRecentEntry(userId, { query });
    if (recentCheck.hasRecentEntry && !manualConfirm) {
      return res.status(400).json({
        error: 'Recent Entry Detected',
        message: `You logged an entry ${recentCheck.minutesSince} minutes ago. Please wait ${recentCheck.debounceWindow} minutes between entries.`,
        lastEntry: recentCheck.lastEntry,
        requiresConfirmation: true,
        debounceInfo: {
          minutesSince: recentCheck.minutesSince,
          debounceWindow: recentCheck.debounceWindow
        }
      });
    }

    // Step 3: Validate exit conditions
    if (entryType === 'exit') {
      const exitValidation = await entryService.validateExit(userId, latitude, longitude, { query });
      if (!exitValidation.valid && !manualConfirm) {
        return res.status(400).json({
          error: 'Invalid Exit',
          message: exitValidation.reason === 'still_in_zone'
            ? `You are still within ${exitValidation.requiredDistance}m of the library (current distance: ${exitValidation.distanceMeters}m). Move further away to auto-log exit.`
            : 'Cannot validate exit location',
          requiresConfirmation: true,
          exitValidation
        });
      }
    }

    // Step 4-6: Calculate confidence scores using the enhanced algorithm
    const confidence = await entryService.calculateConfidence({
      latitude,
      longitude,
      wifiSSID,
      speedKmh
    });

    // Get threshold from config
    const autoLogThreshold = await configService.getConfig('entry_confidence_threshold', 80);
    const manualConfirmThreshold = await configService.getConfig('entry_manual_threshold', 50);

    // Determine if entry should be auto-logged
    let autoLogged = false;
    let shouldLog = false;

    if (confidence.total >= autoLogThreshold) {
      // High confidence - auto-log
      autoLogged = true;
      shouldLog = true;
    } else if (confidence.total >= manualConfirmThreshold && manualConfirm) {
      // Medium confidence with manual confirmation
      autoLogged = false;
      shouldLog = true;
    } else if (confidence.total < manualConfirmThreshold && !manualConfirm) {
      // Low confidence without confirmation - reject
      return res.status(400).json({
        error: 'Confidence Too Low',
        message: `Entry confidence (${confidence.total}) is below threshold (${manualConfirmThreshold}). Manual confirmation required.`,
        confidence: {
          total: confidence.total,
          gps: confidence.gps,
          wifi: confidence.wifi,
          motion: confidence.motion,
          details: confidence.details
        },
        requiresConfirmation: true,
        thresholds: {
          autoLog: autoLogThreshold,
          manualConfirm: manualConfirmThreshold
        }
      });
    } else if (manualConfirm) {
      // Low confidence but manually confirmed
      autoLogged = false;
      shouldLog = true;
    }

    if (!shouldLog) {
      return res.status(400).json({
        error: 'Entry Rejected',
        message: 'Cannot log entry with current parameters'
      });
    }

    // Insert entry log with enhanced data
    const result = await query(
      `INSERT INTO entry_logs (
        user_id, entry_type, latitude, longitude, wifi_ssid, speed_kmh,
        confidence_score, gps_confidence, wifi_confidence, motion_confidence,
        auto_logged, manual_confirmed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        entryType,
        latitude,
        longitude,
        wifiSSID,
        speedKmh,
        confidence.total,
        confidence.gps,
        confidence.wifi,
        confidence.motion,
        autoLogged,
        manualConfirm || false
      ]
    );

    res.json({
      success: true,
      entryLog: {
        id: result.insertId,
        userId,
        entryType,
        confidenceScore: confidence.total,
        autoLogged,
        timestamp: new Date()
      },
      confidence: {
        total: confidence.total,
        gps: confidence.gps,
        wifi: confidence.wifi,
        motion: confidence.motion,
        details: confidence.details
      },
      warnings: libraryHoursWarning ? ['Entry logged outside library hours'] : [],
      message: autoLogged
        ? 'Entry logged automatically (high confidence)'
        : 'Entry logged with manual confirmation'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get entry history for current user
 */
const getMyHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const entries = await query(
      `SELECT id, entry_type, latitude, longitude, wifi_ssid, speed_kmh,
              confidence_score, auto_logged, manual_confirmed, timestamp
       FROM entry_logs
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Get total count
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM entry_logs WHERE user_id = ?',
      [userId]
    );

    res.json({
      userId,
      totalEntries: countResult.total,
      entries: entries.map(entry => ({
        id: entry.id,
        entryType: entry.entry_type,
        latitude: parseFloat(entry.latitude),
        longitude: parseFloat(entry.longitude),
        wifiSSID: entry.wifi_ssid,
        speedKmh: entry.speed_kmh ? parseFloat(entry.speed_kmh) : null,
        confidenceScore: entry.confidence_score,
        autoLogged: entry.auto_logged === 1,
        manualConfirmed: entry.manual_confirmed === 1,
        timestamp: entry.timestamp
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get entry history for specific user (librarian/admin)
 */
const getUserHistory = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const entries = await query(
      `SELECT id, entry_type, latitude, longitude, wifi_ssid, speed_kmh,
              confidence_score, auto_logged, manual_confirmed, timestamp
       FROM entry_logs
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Get total count
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM entry_logs WHERE user_id = ?',
      [userId]
    );

    res.json({
      userId: parseInt(userId),
      totalEntries: countResult.total,
      entries: entries.map(entry => ({
        id: entry.id,
        entryType: entry.entry_type,
        latitude: parseFloat(entry.latitude),
        longitude: parseFloat(entry.longitude),
        wifiSSID: entry.wifi_ssid,
        speedKmh: entry.speed_kmh ? parseFloat(entry.speed_kmh) : null,
        confidenceScore: entry.confidence_score,
        autoLogged: entry.auto_logged === 1,
        manualConfirmed: entry.manual_confirmed === 1,
        timestamp: entry.timestamp
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get current occupancy (who's currently in the library)
 */
const getCurrentOccupancy = async (req, res, next) => {
  try {
    // Find users whose last entry was 'entry' (not 'exit')
    const occupants = await query(
      `SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.student_id,
        el.timestamp as entry_time
       FROM users u
       INNER JOIN entry_logs el ON u.id = el.user_id
       WHERE el.id IN (
         SELECT MAX(id)
         FROM entry_logs
         GROUP BY user_id
       )
       AND el.entry_type = 'entry'
       ORDER BY el.timestamp DESC`
    );

    res.json({
      currentOccupancy: occupants.length,
      occupants: occupants.map(occ => ({
        id: occ.id,
        email: occ.email,
        firstName: occ.first_name,
        lastName: occ.last_name,
        studentId: occ.student_id,
        entryTime: occ.entry_time
      }))
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  logEntry,
  getMyHistory,
  getUserHistory,
  getCurrentOccupancy
};
