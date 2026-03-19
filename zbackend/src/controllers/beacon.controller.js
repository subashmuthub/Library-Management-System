/**
 * Beacon Controller
 * 
 * Handles BLE beacon information for indoor navigation.
 */

const { query } = require('../config/database');

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
};

/**
 * List all beacons
 */
const listBeacons = async (req, res, next) => {
  try {
    const isActive = req.query.isActive;

    let sql = 'SELECT * FROM beacons WHERE 1=1';
    const params = [];

    if (isActive !== undefined) {
      sql += ' AND is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY zone, minor';

    const beacons = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM beacons WHERE 1=1';
    const countParams = [];

    if (isActive !== undefined) {
      countSql += ' AND is_active = ?';
      countParams.push(isActive === 'true' ? 1 : 0);
    }

    const [countResult] = await query(countSql, countParams);

    res.json({
      total: countResult.total,
      beacons: beacons.map(beacon => ({
        id: beacon.id,
        uuid: beacon.beacon_uuid,
        major: beacon.major,
        minor: beacon.minor,
        zone: beacon.zone,
        locationDescription: beacon.location_description,
        isActive: beacon.is_active === 1,
        batteryLevel: beacon.battery_level,
        lastSeen: beacon.last_seen
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get beacon by zone
 */
const getBeaconByZone = async (req, res, next) => {
  try {
    const zone = req.params.zone;

    const beacons = await query(
      'SELECT * FROM beacons WHERE zone = ? AND is_active = TRUE',
      [zone]
    );

    if (beacons.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No active beacon found for this zone'
      });
    }

    const beacon = beacons[0];

    res.json({
      id: beacon.id,
      uuid: beacon.beacon_uuid,
      major: beacon.major,
      minor: beacon.minor,
      zone: beacon.zone,
      locationDescription: beacon.location_description,
      isActive: beacon.is_active === 1,
      batteryLevel: beacon.battery_level,
      lastSeen: beacon.last_seen
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Create beacon (admin)
 */
const createBeacon = async (req, res, next) => {
  try {
    const {
      uuid,
      beacon_uuid,
      major,
      minor,
      zone,
      locationDescription,
      location_description,
      batteryLevel,
      battery_level,
      isActive,
      is_active,
    } = req.body;

    const resolvedUuid = (uuid || beacon_uuid || '').trim();
    const resolvedZone = (zone || '').trim();
    const resolvedMajor = Number.parseInt(major, 10);
    const resolvedMinor = Number.parseInt(minor, 10);

    if (!resolvedUuid || !resolvedZone || Number.isNaN(resolvedMajor) || Number.isNaN(resolvedMinor)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'uuid, major, minor and zone are required'
      });
    }

    const [result] = await query(
      `INSERT INTO beacons (
        beacon_uuid,
        major,
        minor,
        zone,
        location_description,
        battery_level,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        resolvedUuid,
        resolvedMajor,
        resolvedMinor,
        resolvedZone,
        (locationDescription || location_description || null),
        batteryLevel ?? battery_level ?? null,
        parseBoolean(isActive ?? is_active, true) ? 1 : 0,
      ]
    );

    const inserted = await query('SELECT * FROM beacons WHERE id = ?', [result.insertId]);
    const beacon = inserted[0];

    res.status(201).json({
      success: true,
      message: 'Beacon added successfully',
      beacon: {
        id: beacon.id,
        uuid: beacon.beacon_uuid,
        major: beacon.major,
        minor: beacon.minor,
        zone: beacon.zone,
        locationDescription: beacon.location_description,
        isActive: beacon.is_active === 1,
        batteryLevel: beacon.battery_level,
        lastSeen: beacon.last_seen,
      },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Beacon with same UUID/major/minor already exists',
      });
    }
    next(error);
  }
};

module.exports = {
  listBeacons,
  getBeaconByZone,
  createBeacon,
};
