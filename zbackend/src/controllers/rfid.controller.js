/**
 * RFID Controller
 * 
 * Handles RFID scanning with MODE-AWARE context resolution.
 * 
 * KEY DESIGN: The same endpoint works in both DEMO and PRODUCTION modes.
 * - DEMO: Librarian manually selects shelf, then scans
 * - PRODUCTION: Fixed reader location is automatically used
 */

const { query } = require('../config/database');
const { getModeConfig } = require('../config/mode');
const configService = require('../services/config.service');

// Reader-shelf mapping cache (production optimization)
const readerCache = new Map();
const READER_CACHE_TTL = 3600000; // 1 hour

/**
 * Scan RFID tag (mode-aware)
 * 
 * ALGORITHM: Context-Aware Book Location Update
 * 1. Receive tag ID from RFID reader
 * 2. Look up tag ID → book ID
 * 3. Determine shelf context:
 *    - DEMO MODE: Use provided shelfId (manual selection)
 *    - PRODUCTION MODE: Look up readerId → shelfId (automatic)
 * 4. Record location in book_location_history
 * 5. Return updated location
 */
const scanTag = async (req, res, next) => {
  try {
    const { tagId, shelfId, readerId } = req.body;
    const scannedBy = req.user ? req.user.id : 1; // Default to user 1 for development
    
    // Get configuration from service
    const isDemoMode = await configService.isDemoMode();
    const debounceSeconds = await configService.getScanDebounceSeconds();
    const modeConfig = getModeConfig();

    // Validate request based on mode
    if (isDemoMode && !shelfId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'DEMO MODE: shelfId is required',
        mode: 'DEMO'
      });
    }

    if (!isDemoMode && !readerId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'PRODUCTION MODE: readerId is required',
        mode: 'PRODUCTION'
      });
    }

    // Step 1: Look up tag ID → book ID
    const tags = await query(
      `SELECT rt.book_id, b.title, b.author, b.isbn
       FROM rfid_tags rt
       INNER JOIN books b ON rt.book_id = b.id
       WHERE rt.tag_id = ? AND rt.is_active = TRUE`,
      [tagId]
    );

    if (tags.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'RFID tag not found or inactive',
        tagId
      });
    }

    const tag = tags[0];
    const bookId = tag.book_id;

    // Step 2: Check for duplicate scan (debounce logic)
    const lastScans = await query(
      `SELECT timestamp, reader_id, shelf_id
       FROM book_location_history
       WHERE book_id = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [bookId]
    );

    if (lastScans.length > 0) {
      const lastScan = lastScans[0];
      const secondsSinceLastScan = Math.floor(
        (Date.now() - new Date(lastScan.timestamp).getTime()) / 1000
      );

      // Same reader within debounce window = duplicate
      if (
        lastScan.reader_id === readerId &&
        secondsSinceLastScan < debounceSeconds
      ) {
        return res.json({
          success: true,
          isDuplicate: true,
          message: 'Duplicate scan ignored (within debounce window)',
          book: {
            id: bookId,
            title: tag.title,
            author: tag.author,
            isbn: tag.isbn
          },
          debounceInfo: {
            secondsSinceLastScan,
            debounceWindow: debounceSeconds,
            lastScanTime: lastScan.timestamp
          }
        });
      }
    }

    // Step 3: Determine shelf context based on mode
    let resolvedShelfId;
    let shelfInfo;

    if (isDemoMode) {
      // DEMO MODE: Use provided shelf ID
      resolvedShelfId = shelfId;

      const shelves = await query(
        'SELECT id, shelf_code, zone, section FROM shelves WHERE id = ?',
        [shelfId]
      );

      if (shelves.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Shelf not found',
          shelfId
        });
      }

      shelfInfo = shelves[0];

    } else {
      // PRODUCTION MODE: Look up reader ID → shelf ID (with caching)
      let readerData = readerCache.get(readerId);
      
      if (!readerData || (Date.now() - readerData.timestamp) > READER_CACHE_TTL) {
        const readers = await query(
          `SELECT r.id, r.shelf_id, r.reader_code, s.shelf_code, s.zone, s.section
           FROM readers r
           INNER JOIN shelves s ON r.shelf_id = s.id
           WHERE r.id = ? AND r.is_active = TRUE`,
          [readerId]
        );

        if (readers.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Reader not found or inactive',
            readerId
          });
        }

        readerData = {
          ...readers[0],
          timestamp: Date.now()
        };
        readerCache.set(readerId, readerData);
      }

      resolvedShelfId = readerData.shelf_id;
      shelfInfo = {
        shelf_code: readerData.shelf_code,
        zone: readerData.zone,
        section: readerData.section
      };
    }

    // Step 4: Record location in history
    await query(
      `INSERT INTO book_location_history 
       (book_id, shelf_id, reader_id, scanned_by, scan_method, timestamp)
       VALUES (?, ?, ?, ?, 'rfid', NOW())`,
      [
        bookId,
        resolvedShelfId,
        !isDemoMode ? readerId : null,
        scannedBy
      ]
    );
    
    // Step 5: Update reader statistics (production mode only)
    if (!isDemoMode && readerId) {
      await query(
        `UPDATE readers 
         SET last_scan_count = last_scan_count + 1,
             last_scan_timestamp = NOW()
         WHERE id = ?`,
        [readerId]
      );
    }

    // Step 6: Return success response
    res.json({
      success: true,
      isDuplicate: false,
      book: {
        id: bookId,
        title: tag.title,
        author: tag.author,
        isbn: tag.isbn
      },
      location: {
        shelfId: resolvedShelfId,
        shelfCode: shelfInfo.shelf_code,
        zone: shelfInfo.zone,
        section: shelfInfo.section
      },
      scanInfo: {
        mode: isDemoMode ? 'DEMO' : 'PRODUCTION',
        tagId,
        readerId: !isDemoMode ? readerId : null,
        timestamp: new Date(),
        scannedBy: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim()
      },
      message: 'Book location updated successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * List all RFID tags
 */
const listTags = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const isActive = req.query.isActive;

    let sql = `
      SELECT 
        rt.id,
        rt.tag_id,
        rt.book_id,
        b.title as book_title,
        b.isbn,
        rt.is_active,
        rt.assigned_at
      FROM rfid_tags rt
      INNER JOIN books b ON rt.book_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (isActive !== undefined) {
      sql += ' AND rt.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY rt.assigned_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const tags = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM rfid_tags WHERE 1=1';
    const countParams = [];

    if (isActive !== undefined) {
      countSql += ' AND is_active = ?';
      countParams.push(isActive === 'true' ? 1 : 0);
    }

    const [countResult] = await query(countSql, countParams);

    res.json({
      total: countResult.total,
      tags: tags.map(tag => ({
        id: tag.id,
        tagId: tag.tag_id,
        bookId: tag.book_id,
        bookTitle: tag.book_title,
        isbn: tag.isbn,
        isActive: tag.is_active === 1,
        assignedAt: tag.assigned_at
      }))
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  scanTag,
  listTags,
  readerCache // Export cache for reader controller to clear on updates
};
