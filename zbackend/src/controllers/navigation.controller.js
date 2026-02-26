/**
 * Navigation Controller
 * 
 * Provides indoor navigation guidance using BLE beacons.
 */

const { query } = require('../config/database');

/**
 * Find a book and provide navigation guidance
 * 
 * ALGORITHM: Zone-Based Indoor Navigation
 * 1. Look up book → current shelf location
 * 2. Get shelf → zone mapping
 * 3. Find beacon for that zone
 * 4. Return beacon UUID for mobile app to scan
 * 5. Provide human-readable directions
 */
const findBook = async (req, res, next) => {
  try {
    const bookId = req.params.bookId;

    // Step 1 & 2: Get book and current location
    const bookInfo = await query(
      `SELECT 
        b.id,
        b.title,
        b.author,
        b.isbn,
        s.id as shelf_id,
        s.shelf_code,
        s.zone,
        s.floor,
        s.section,
        blh.timestamp as last_scanned
       FROM books b
       LEFT JOIN book_location_history blh ON b.id = blh.book_id
       LEFT JOIN shelves s ON blh.shelf_id = s.id
       WHERE b.id = ?
       AND (blh.timestamp IS NULL OR blh.timestamp = (
         SELECT MAX(timestamp)
         FROM book_location_history
         WHERE book_id = b.id
       ))`,
      [bookId]
    );

    if (bookInfo.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Book not found'
      });
    }

    const book = bookInfo[0];

    if (!book.shelf_id) {
      return res.status(404).json({
        error: 'Location Unknown',
        message: 'This book has not been scanned yet. Location is unknown.',
        book: {
          id: book.id,
          title: book.title,
          author: book.author
        }
      });
    }

    // Step 3: Find beacon for the zone
    const beacons = await query(
      'SELECT * FROM beacons WHERE zone = ? AND is_active = TRUE',
      [book.zone]
    );

    if (beacons.length === 0) {
      // Beacon not configured, still provide basic directions
      return res.json({
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          isbn: book.isbn
        },
        location: {
          shelfCode: book.shelf_code,
          zone: book.zone,
          floor: book.floor,
          section: book.section,
          lastScanned: book.last_scanned
        },
        navigation: {
          beacon: null,
          instructions: `Go to Zone ${book.zone} on Floor ${book.floor}. Look for shelf ${book.shelf_code} in the ${book.section} section.`,
          note: 'BLE beacon not configured for this zone. Manual navigation required.'
        }
      });
    }

    const beacon = beacons[0];

    // Step 4 & 5: Return navigation guidance
    res.json({
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn
      },
      location: {
        shelfCode: book.shelf_code,
        zone: book.zone,
        floor: book.floor,
        section: book.section,
        lastScanned: book.last_scanned
      },
      navigation: {
        beacon: {
          uuid: beacon.beacon_uuid,
          major: beacon.major,
          minor: beacon.minor,
          zone: beacon.zone
        },
        instructions: `Go to Zone ${book.zone} on Floor ${book.floor}. Look for shelf ${book.shelf_code} in the ${book.section} section. Use your mobile app to detect the BLE beacon and get turn-by-turn guidance.`,
        beaconDescription: beacon.location_description
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  findBook
};
