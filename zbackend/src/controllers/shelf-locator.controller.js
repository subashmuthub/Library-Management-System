/**
 * Shelf Locator Controller
 * Provides book-to-shelf lookup with QR payload and SVG map coordinates.
 */

const { pool } = require('../config/database');

class ShelfLocatorController {

  /** GET /api/v1/shelf-locator/book/:bookId */
  static async locateBook(req, res) {
    const bookId = parseInt(req.params.bookId, 10);
    if (!bookId) return res.status(400).json({ error: 'Invalid book ID' });

    const connection = await pool.getConnection();
    try {
      // Try book_location_history → library_shelves_extended mapping
      const [rows] = await connection.execute(`
        SELECT
          b.id AS book_id, b.title, b.author, b.isbn, b.is_available,
          b.category,
          -- Prefer extended shelf data, fall back to basic shelves table
          COALESCE(lse.shelf_code, s.shelf_code) AS shelf_code,
          COALESCE(lse.floor,      s.floor)       AS floor,
          COALESCE(lse.rack,       NULL)           AS rack,
          COALESCE(lse.section,    s.section)      AS section,
          COALESCE(lse.description,'')             AS description,
          COALESCE(lse.coord_x,   20)              AS coord_x,
          COALESCE(lse.coord_y,   20)              AS coord_y
        FROM books b
        LEFT JOIN book_location_history blh ON b.id = blh.book_id
          AND blh.timestamp = (
            SELECT MAX(timestamp) FROM book_location_history WHERE book_id = b.id
          )
        LEFT JOIN shelves s ON blh.shelf_id = s.id
        LEFT JOIN library_shelves_extended lse ON lse.shelf_code = s.shelf_code
        WHERE b.id = ?
        LIMIT 1
      `, [bookId]);

      if (!rows.length) {
        return res.status(404).json({ error: 'Book not found' });
      }

      const row = rows[0];

      // Build QR payload
      const qrPayload = {
        bookId   : row.book_id,
        title    : row.title,
        shelf    : row.shelf_code || 'Unknown',
        floor    : row.floor || 1,
        rack     : row.rack || 'N/A',
        section  : row.section || 'General',
      };

      return res.json({
        success  : true,
        book     : {
          id        : row.book_id,
          title     : row.title,
          author    : row.author,
          isbn      : row.isbn,
          category  : row.category,
          available : Boolean(row.is_available),
        },
        location : {
          shelfCode   : row.shelf_code || 'Not assigned',
          floor       : row.floor || 1,
          rack        : row.rack || 'N/A',
          section     : row.section || 'General',
          description : row.description,
          coordX      : parseFloat(row.coord_x) || 20,
          coordY      : parseFloat(row.coord_y) || 20,
        },
        qr : {
          payload    : JSON.stringify(qrPayload),
          displayText: `Shelf ${row.shelf_code || '?'} · Floor ${row.floor || 1} · Rack ${row.rack || 'N/A'}`,
        },
      });
    } catch (err) {
      console.error('[ShelfLocatorController.locateBook]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    } finally {
      connection.release();
    }
  }

  /** GET /api/v1/shelf-locator/shelves — all shelves for floor map */
  static async getAllShelves(req, res) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT shelf_code, floor, rack, section, description,
               coord_x, coord_y, is_active
        FROM library_shelves_extended
        WHERE is_active = TRUE
        ORDER BY floor, shelf_code
      `);
      return res.json({ success: true, shelves: rows });
    } catch (err) {
      console.error('[ShelfLocatorController.getAllShelves]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    } finally {
      connection.release();
    }
  }

  /** GET /api/v1/shelf-locator/search?q= — search books for locating */
  static async searchBooks(req, res) {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, books: [] });

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT b.id, b.title, b.author, b.category, b.is_available
        FROM books b
        WHERE b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?
        LIMIT 20
      `, [`%${q}%`, `%${q}%`, `%${q}%`]);

      return res.json({ success: true, books: rows });
    } catch (err) {
      console.error('[ShelfLocatorController.searchBooks]', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    } finally {
      connection.release();
    }
  }
}

module.exports = ShelfLocatorController;
