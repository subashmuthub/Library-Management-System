/**
 * Beacon Controller
 * 
 * Handles BLE beacon information for indoor navigation.
 */

const { query } = require('../config/database');

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

module.exports = {
  listBeacons,
  getBeaconByZone
};
