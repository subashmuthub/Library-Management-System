/**
 * Book Controller
 * 
 * Handles book search and information retrieval.
 */

const { query } = require('../config/database');

/**
 * Search for books
 * 
 * Supports:
 * - Full-text search on title, author, description
 * - ISBN exact match
 * - Category filter
 * - Pagination
 */
const searchBooks = async (req, res, next) => {
  try {
    const searchQuery = req.query.q;
    const isbn = req.query.isbn;
    const category = req.query.category;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    let sql = `
      SELECT 
        b.id,
        b.isbn,
        b.title,
        b.author,
        b.publisher,
        b.publication_year,
        b.category,
        b.pages,
        b.is_available
      FROM books b
      WHERE 1=1
    `;
    const params = [];

    // Add search conditions
    if (isbn) {
      sql += ' AND b.isbn = ?';
      params.push(isbn);
    } else if (searchQuery) {
      sql += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)';
      const searchPattern = `%${searchQuery}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (category) {
      sql += ' AND b.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY b.title LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const books = await query(sql, params);

    // Get current locations for all books
    const bookIds = books.map(b => b.id);
    let locations = [];

    if (bookIds.length > 0) {
      locations = await query(
        `SELECT 
          blh.book_id,
          s.id as shelf_id,
          s.shelf_code,
          s.zone,
          s.section,
          blh.timestamp as last_scanned
         FROM book_location_history blh
         INNER JOIN shelves s ON blh.shelf_id = s.id
         WHERE blh.book_id IN (${bookIds.join(',')})
         AND blh.timestamp = (
           SELECT MAX(timestamp)
           FROM book_location_history
           WHERE book_id = blh.book_id
         )`
      );
    }

    // Map locations to books
    const locationMap = {};
    locations.forEach(loc => {
      locationMap[loc.book_id] = {
        shelfId: loc.shelf_id,
        shelfCode: loc.shelf_code,
        zone: loc.zone,
        section: loc.section,
        lastScanned: loc.last_scanned
      };
    });

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM books WHERE 1=1';
    const countParams = [];

    if (isbn) {
      countSql += ' AND isbn = ?';
      countParams.push(isbn);
    } else if (searchQuery) {
      countSql += ' AND (title LIKE ? OR author LIKE ? OR description LIKE ?)';
      const searchPattern = `%${searchQuery}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (category) {
      countSql += ' AND category = ?';
      countParams.push(category);
    }

    const [countResult] = await query(countSql, countParams);

    res.json({
      total: countResult.total,
      books: books.map(book => ({
        id: book.id,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        publicationYear: book.publication_year,
        category: book.category,
        pages: book.pages,
        isAvailable: book.is_available === 1,
        currentLocation: locationMap[book.id] || null
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get book by ID with full details
 */
const getBookById = async (req, res, next) => {
  try {
    const bookId = req.params.id;

    // Get book details
    const books = await query(
      `SELECT 
        b.*,
        rt.tag_id
       FROM books b
       LEFT JOIN rfid_tags rt ON b.id = rt.book_id
       WHERE b.id = ?`,
      [bookId]
    );

    if (books.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Book not found'
      });
    }

    const book = books[0];

    // Get current location
    const currentLoc = await query(
      `SELECT 
        s.id as shelf_id,
        s.shelf_code,
        s.zone,
        s.section,
        s.floor,
        blh.timestamp as last_scanned
       FROM book_location_history blh
       INNER JOIN shelves s ON blh.shelf_id = s.id
       WHERE blh.book_id = ?
       ORDER BY blh.timestamp DESC
       LIMIT 1`,
      [bookId]
    );

    // Get location history (last 10 movements)
    const history = await query(
      `SELECT 
        s.shelf_code,
        blh.timestamp,
        u.first_name,
        u.last_name
       FROM book_location_history blh
       INNER JOIN shelves s ON blh.shelf_id = s.id
       LEFT JOIN users u ON blh.scanned_by = u.id
       WHERE blh.book_id = ?
       ORDER BY blh.timestamp DESC
       LIMIT 10`,
      [bookId]
    );

    res.json({
      id: book.id,
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      publicationYear: book.publication_year,
      category: book.category,
      edition: book.edition,
      language: book.language,
      pages: book.pages,
      description: book.description,
      coverImageUrl: book.cover_image_url,
      isAvailable: book.is_available === 1,
      rfidTag: book.tag_id,
      currentLocation: currentLoc.length > 0 ? {
        shelfId: currentLoc[0].shelf_id,
        shelfCode: currentLoc[0].shelf_code,
        zone: currentLoc[0].zone,
        section: currentLoc[0].section,
        floor: currentLoc[0].floor,
        lastScanned: currentLoc[0].last_scanned
      } : null,
      locationHistory: history.map(h => ({
        shelfCode: h.shelf_code,
        timestamp: h.timestamp,
        scannedBy: h.first_name && h.last_name 
          ? `${h.first_name} ${h.last_name}`
          : 'System'
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get book location history
 */
const getBookLocationHistory = async (req, res, next) => {
  try {
    const bookId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const history = await query(
      `SELECT 
        blh.id,
        s.shelf_code,
        s.zone,
        s.section,
        blh.scan_method,
        blh.timestamp,
        u.first_name,
        u.last_name
       FROM book_location_history blh
       INNER JOIN shelves s ON blh.shelf_id = s.id
       LEFT JOIN users u ON blh.scanned_by = u.id
       WHERE blh.book_id = ?
       ORDER BY blh.timestamp DESC
       LIMIT ? OFFSET ?`,
      [bookId, limit, offset]
    );

    // Get total count
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM book_location_history WHERE book_id = ?',
      [bookId]
    );

    res.json({
      bookId: parseInt(bookId),
      totalRecords: countResult.total,
      history: history.map(h => ({
        id: h.id,
        shelfCode: h.shelf_code,
        zone: h.zone,
        section: h.section,
        scanMethod: h.scan_method,
        timestamp: h.timestamp,
        scannedBy: h.first_name && h.last_name 
          ? `${h.first_name} ${h.last_name}`
          : 'System'
      }))
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchBooks,
  getBookById,
  getBookLocationHistory
};
