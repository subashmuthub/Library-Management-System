const { query } = require('../config/database');
const configService = require('../services/config.service');

/**
 * Reader Management Controller
 * Handles fixed RFID reader registration, shelf mapping, and health monitoring
 * Used in PRODUCTION mode for automatic shelf detection
 */

// Get all readers with health status
const getAllReaders = async (req, res, next) => {
  try {
    const readers = await query(
      `SELECT 
        r.id,
        r.reader_code,
        r.shelf_id,
        r.location_description,
        r.is_active,
        r.last_scan_count,
        r.last_scan_timestamp,
        r.firmware_version,
        r.installation_date,
        r.notes,
        s.shelf_code,
        s.zone,
        s.section,
        CASE
          WHEN r.last_scan_timestamp >= NOW() - INTERVAL 1 HOUR THEN 'HEALTHY'
          WHEN r.last_scan_timestamp >= NOW() - INTERVAL 24 HOUR THEN 'WARNING'
          WHEN r.last_scan_timestamp IS NULL THEN 'NEVER_SCANNED'
          ELSE 'OFFLINE'
        END AS health_status,
        TIMESTAMPDIFF(HOUR, r.last_scan_timestamp, NOW()) AS hours_since_last_scan
       FROM readers r
       LEFT JOIN shelves s ON r.shelf_id = s.id
       ORDER BY r.reader_code`
    );

    const isDemoMode = await configService.isDemoMode();

    res.json({
      success: true,
      count: readers.length,
      mode: isDemoMode ? 'DEMO' : 'PRODUCTION',
      readers: readers.map(r => ({
        id: r.id,
        readerCode: r.reader_code,
        shelfId: r.shelf_id,
        shelfCode: r.shelf_code,
        location: {
          description: r.location_description,
          zone: r.zone,
          section: r.section
        },
        status: {
          isActive: r.is_active === 1,
          health: r.health_status,
          lastScanCount: r.last_scan_count || 0,
          lastScanTimestamp: r.last_scan_timestamp,
          hoursSinceLastScan: r.hours_since_last_scan
        },
        device: {
          firmwareVersion: r.firmware_version,
          installationDate: r.installation_date
        },
        notes: r.notes
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Get single reader details
const getReaderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const readers = await query(
      `SELECT 
        r.*,
        s.shelf_code,
        s.zone,
        s.section,
        COUNT(DISTINCT blh.id) AS total_scans_today
       FROM readers r
       LEFT JOIN shelves s ON r.shelf_id = s.id
       LEFT JOIN book_location_history blh ON blh.reader_id = r.id 
         AND DATE(blh.timestamp) = CURDATE()
       WHERE r.id = ?
       GROUP BY r.id`,
      [id]
    );

    if (readers.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reader not found'
      });
    }

    const reader = readers[0];

    res.json({
      success: true,
      reader: {
        id: reader.id,
        readerCode: reader.reader_code,
        shelfId: reader.shelf_id,
        shelfCode: reader.shelf_code,
        location: {
          description: reader.location_description,
          zone: reader.zone,
          section: reader.section
        },
        status: {
          isActive: reader.is_active === 1,
          lastScanCount: reader.last_scan_count || 0,
          lastScanTimestamp: reader.last_scan_timestamp,
          totalScansToday: reader.total_scans_today
        },
        device: {
          firmwareVersion: reader.firmware_version,
          installationDate: reader.installation_date
        },
        notes: reader.notes
      }
    });
  } catch (error) {
    next(error);
  }
};

// Register new RFID reader
const createReader = async (req, res, next) => {
  try {
    const {
      readerCode,
      shelfId,
      locationDescription,
      firmwareVersion,
      notes
    } = req.body;

    // Validate required fields
    if (!readerCode) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'readerCode is required'
      });
    }

    // Check for duplicate reader code
    const existing = await query(
      'SELECT id FROM readers WHERE reader_code = ?',
      [readerCode]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Reader code already exists',
        existingReaderId: existing[0].id
      });
    }

    // Validate shelf exists (if provided)
    if (shelfId) {
      const shelves = await query(
        'SELECT id FROM shelves WHERE id = ?',
        [shelfId]
      );

      if (shelves.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Shelf not found',
          shelfId
        });
      }
    }

    // Insert new reader
    const result = await query(
      `INSERT INTO readers 
       (reader_code, shelf_id, location_description, firmware_version, 
        installation_date, notes, is_active, last_scan_count)
       VALUES (?, ?, ?, ?, NOW(), ?, TRUE, 0)`,
      [
        readerCode,
        shelfId || null,
        locationDescription || null,
        firmwareVersion || null,
        notes || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Reader registered successfully',
      reader: {
        id: result.insertId,
        readerCode,
        shelfId,
        locationDescription,
        firmwareVersion,
        installationDate: new Date(),
        notes,
        isActive: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update reader (map to shelf, change status, update firmware)
const updateReader = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      shelfId,
      locationDescription,
      isActive,
      firmwareVersion,
      notes
    } = req.body;

    // Check reader exists
    const readers = await query(
      'SELECT id FROM readers WHERE id = ?',
      [id]
    );

    if (readers.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reader not found'
      });
    }

    // Validate shelf exists (if changing)
    if (shelfId !== undefined && shelfId !== null) {
      const shelves = await query(
        'SELECT id FROM shelves WHERE id = ?',
        [shelfId]
      );

      if (shelves.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Shelf not found',
          shelfId
        });
      }
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (shelfId !== undefined) {
      updates.push('shelf_id = ?');
      values.push(shelfId);
    }
    if (locationDescription !== undefined) {
      updates.push('location_description = ?');
      values.push(locationDescription);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive);
    }
    if (firmwareVersion !== undefined) {
      updates.push('firmware_version = ?');
      values.push(firmwareVersion);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No fields to update'
      });
    }

    values.push(id);

    await query(
      `UPDATE readers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Clear cache if shelf mapping changed
    if (shelfId !== undefined) {
      const { readerCache } = require('./rfid.controller');
      if (readerCache) {
        readerCache.delete(parseInt(id));
      }
    }

    res.json({
      success: true,
      message: 'Reader updated successfully',
      readerId: parseInt(id),
      updatedFields: Object.keys(req.body)
    });
  } catch (error) {
    next(error);
  }
};

// Get reader health statistics
const getReaderHealth = async (req, res, next) => {
  try {
    const healthStats = await query(
      `SELECT 
        COUNT(*) AS total_readers,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_readers,
        SUM(CASE 
          WHEN last_scan_timestamp >= NOW() - INTERVAL 1 HOUR THEN 1 
          ELSE 0 
        END) AS healthy_readers,
        SUM(CASE 
          WHEN last_scan_timestamp < NOW() - INTERVAL 1 HOUR 
          AND last_scan_timestamp >= NOW() - INTERVAL 24 HOUR THEN 1 
          ELSE 0 
        END) AS warning_readers,
        SUM(CASE 
          WHEN last_scan_timestamp < NOW() - INTERVAL 24 HOUR 
          OR last_scan_timestamp IS NULL THEN 1 
          ELSE 0 
        END) AS offline_readers,
        SUM(last_scan_count) AS total_scans,
        MAX(last_scan_timestamp) AS most_recent_scan
       FROM readers`
    );

    const stats = healthStats[0];

    const isDemoMode = await configService.isDemoMode();
    const scanDebounce = await configService.getScanDebounceSeconds();

    res.json({
      success: true,
      timestamp: new Date(),
      mode: isDemoMode ? 'DEMO' : 'PRODUCTION',
      configuration: {
        scanDebounceSeconds: scanDebounce
      },
      statistics: {
        totalReaders: stats.total_readers,
        activeReaders: stats.active_readers,
        healthStatus: {
          healthy: stats.healthy_readers,
          warning: stats.warning_readers,
          offline: stats.offline_readers
        },
        performance: {
          totalScans: stats.total_scans,
          mostRecentScan: stats.most_recent_scan
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Reset reader statistics (admin function)
const resetReaderStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const readers = await query(
      'SELECT id, reader_code FROM readers WHERE id = ?',
      [id]
    );

    if (readers.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reader not found'
      });
    }

    await query(
      `UPDATE readers 
       SET last_scan_count = 0,
           last_scan_timestamp = NULL
       WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Reader statistics reset successfully',
      reader: {
        id: readers[0].id,
        readerCode: readers[0].reader_code
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllReaders,
  getReaderById,
  createReader,
  updateReader,
  getReaderHealth,
  resetReaderStats
};
