/**
 * Entry Service (Enhanced Version)
 * 
 * Implements the upgraded hybrid GPS entry confidence scoring algorithm.
 * 
 * ENHANCEMENTS:
 * - Multi-zone geofencing (inner 20m = 40pts, outer 50m = 20pts)
 * - Entry debounce (ignore entries within 5 minutes)
 * - Time-of-day validation (library hours check)
 * - Improved exit detection (must leave outer zone)
 * - Configuration-driven thresholds
 * 
 * ALGORITHM:
 * - GPS proximity: 40 points max (inner zone full, outer zone partial)
 * - Wi-Fi validation: 40 points max
 * - Motion/speed check: 20 points max
 * - Total: 100 points
 * 
 * Auto-log threshold: >= 80
 * Manual confirmation threshold: >= 50
 */

require('dotenv').config();
const configService = require('./config.service');

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 * Returns distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Check if current time is within library operating hours
 */
const isWithinLibraryHours = async () => {
  const openHour = await configService.getConfig('library_open_hour', 8);
  const closeHour = await configService.getConfig('library_close_hour', 22);
  
  const now = new Date();
  const currentHour = now.getHours();
  
  return currentHour >= openHour && currentHour < closeHour;
};

/**
 * Check if user has a recent entry (debounce check)
 * Returns { hasRecentEntry: boolean, lastEntry: object|null, minutesSince: number }
 */
const checkRecentEntry = async (userId, db) => {
  const debounceMinutes = await configService.getConfig('entry_debounce_minutes', 5);
  
  const recentEntries = await db.query(
    `SELECT id, entry_type, timestamp,
            TIMESTAMPDIFF(MINUTE, timestamp, NOW()) AS minutes_ago
     FROM entry_logs
     WHERE user_id = ?
     ORDER BY timestamp DESC
     LIMIT 1`,
    [userId]
  );

  if (recentEntries.length === 0) {
    return { hasRecentEntry: false, lastEntry: null, minutesSince: null };
  }

  const lastEntry = recentEntries[0];
  const minutesSince = lastEntry.minutes_ago;

  return {
    hasRecentEntry: minutesSince < debounceMinutes,
    lastEntry: {
      id: lastEntry.id,
      entryType: lastEntry.entry_type,
      timestamp: lastEntry.timestamp
    },
    minutesSince,
    debounceWindow: debounceMinutes
  };
};

/**
 * Validate exit based on previous entry location
 * For exit to be valid, user should have moved outside outer zone
 */
const validateExit = async (userId, currentLat, currentLng, db) => {
  // Get last entry
  const lastEntries = await db.query(
    `SELECT entry_type, latitude, longitude
     FROM entry_logs
     WHERE user_id = ?
     ORDER BY timestamp DESC
     LIMIT 1`,
    [userId]
  );

  if (lastEntries.length === 0) {
    return { valid: true, reason: 'no_previous_entry' };
  }

  const lastEntry = lastEntries[0];
  
  // If last entry was exit, allow another exit
  if (lastEntry.entry_type === 'exit') {
    return { valid: true, reason: 'last_was_exit' };
  }

  // Check if user moved outside outer zone
  const libraryCoords = await configService.getLibraryCoordinates();
  const outerZoneRadius = await configService.getConfig('gps_outer_zone_meters', 50);
  
  const distanceKm = calculateDistance(
    currentLat, 
    currentLng, 
    libraryCoords.latitude, 
    libraryCoords.longitude
  );
  const distanceMeters = distanceKm * 1000;

  if (distanceMeters > outerZoneRadius) {
    return { 
      valid: true, 
      reason: 'outside_zone',
      distanceMeters: Math.round(distanceMeters)
    };
  }

  return { 
    valid: false, 
    reason: 'still_in_zone',
    distanceMeters: Math.round(distanceMeters),
    requiredDistance: outerZoneRadius
  };
};

/**
 * Calculate entry confidence based on multiple signals (Enhanced)
 */
const calculateConfidence = async ({ latitude, longitude, wifiSSID, speedKmh }) => {
  // Get configuration from config service (database-driven)
  const libraryCoords = await configService.getLibraryCoordinates();
  const libraryLat = libraryCoords.latitude;
  const libraryLng = libraryCoords.longitude;
  
  const libraryWiFi = await configService.getConfig('library_wifi_ssid', 'LibraryWiFi');
  const innerZoneRadius = await configService.getConfig('gps_inner_zone_meters', 20);
  const outerZoneRadius = await configService.getConfig('gps_outer_zone_meters', 50);
  const speedThreshold = await configService.getConfig('motion_speed_threshold', 5);

  const confidence = {
    gps: 0,
    wifi: 0,
    motion: 0,
    total: 0,
    details: {
      distanceMeters: 0,
      zone: 'outside'
    }
  };

  // GPS Confidence (40 points max) - Multi-zone scoring
  const distanceKm = calculateDistance(latitude, longitude, libraryLat, libraryLng);
  const distanceMeters = distanceKm * 1000;
  confidence.details.distanceMeters = Math.round(distanceMeters);

  if (distanceMeters <= innerZoneRadius) {
    // Inner zone (0-20m) - full points
    confidence.gps = 40;
    confidence.details.zone = 'inner';
  } else if (distanceMeters <= outerZoneRadius) {
    // Outer zone (20-50m) - partial points (scaled)
    const zoneRange = outerZoneRadius - innerZoneRadius;
    const distanceInZone = distanceMeters - innerZoneRadius;
    const zoneProgress = distanceInZone / zoneRange;
    confidence.gps = Math.round(40 - (zoneProgress * 20)); // 40pts at 20m, 20pts at 50m
    confidence.details.zone = 'outer';
  } else {
    // Outside both zones - no points
    confidence.gps = 0;
    confidence.details.zone = 'outside';
  }

  // Wi-Fi Confidence (40 points max)
  if (wifiSSID === libraryWiFi) {
    confidence.wifi = 40;
  }

  // Motion Confidence (20 points max)
  if (speedKmh !== null && speedKmh !== undefined) {
    if (speedKmh < speedThreshold) {
      // Walking speed - full points
      confidence.motion = 20;
    } else {
      // Moving too fast (driving?) - no points
      confidence.motion = 0;
    }
  } else {
    // No speed data - partial credit
    confidence.motion = 10;
  }

  // Calculate total
  confidence.total = confidence.gps + confidence.wifi + confidence.motion;

  return confidence;
};

module.exports = {
  calculateConfidence,
  calculateDistance,
  isWithinLibraryHours,
  checkRecentEntry,
  validateExit
};
