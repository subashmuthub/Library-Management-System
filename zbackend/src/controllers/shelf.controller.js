/**
 * Shelf Controller
 * 
 * Handles shelf information and book location queries.
 */

const { query } = require('../config/database');

/**
 * List all shelves
 */
const listShelves = async (req, res, next) => {
  try {
    const zone = req.query.zone;
    const floor = req.query.floor;

    let sql = 'SELECT * FROM shelves WHERE 1=1';
    const params = [];

    if (zone) {
      sql += ' AND zone = ?';
      params.push(zone);
    }

    if (floor) {
      sql += ' AND floor = ?';
      params.push(parseInt(floor));
    }

    sql += ' ORDER BY shelf_code';

    const shelves = await query(sql, params);

    // Get book count for each shelf (current location)
    const bookCounts = await query(
      `SELECT 
        blh.shelf_id,
        COUNT(DISTINCT blh.book_id) as book_count
       FROM book_location_history blh
       WHERE blh.timestamp IN (
         SELECT MAX(timestamp)
         FROM book_location_history
         GROUP BY book_id
       )
       GROUP BY blh.shelf_id`
    );

    // Map book counts to shelves
    const countMap = {};
    bookCounts.forEach(bc => {
      countMap[bc.shelf_id] = bc.book_count;
    });

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM shelves WHERE 1=1';
    const countParams = [];

    if (zone) {
      countSql += ' AND zone = ?';
      countParams.push(zone);
    }

    if (floor) {
      countSql += ' AND floor = ?';
      countParams.push(parseInt(floor));
    }

    const [countResult] = await query(countSql, countParams);

    res.json({
      total: countResult.total,
      shelves: shelves.map(shelf => ({
        id: shelf.id,
        shelfCode: shelf.shelf_code,
        zone: shelf.zone,
        floor: shelf.floor,
        section: shelf.section,
        capacity: shelf.capacity,
        currentBooks: countMap[shelf.id] || 0,
        description: shelf.description
      }))
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get shelf by ID
 */
const getShelfById = async (req, res, next) => {
  try {
    const shelfId = req.params.id;

    const shelves = await query(
      'SELECT * FROM shelves WHERE id = ?',
      [shelfId]
    );

    if (shelves.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shelf not found'
      });
    }

    const shelf = shelves[0];

    // Get current book count
    const [bookCount] = await query(
      `SELECT COUNT(DISTINCT blh.book_id) as count
       FROM book_location_history blh
       WHERE blh.shelf_id = ?
       AND blh.timestamp IN (
         SELECT MAX(timestamp)
         FROM book_location_history
         GROUP BY book_id
       )`,
      [shelfId]
    );

    res.json({
      id: shelf.id,
      shelfCode: shelf.shelf_code,
      zone: shelf.zone,
      floor: shelf.floor,
      section: shelf.section,
      capacity: shelf.capacity,
      currentBooks: bookCount.count,
      description: shelf.description,
      createdAt: shelf.created_at
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get all books currently on a specific shelf
 */
const getBooksOnShelf = async (req, res, next) => {
  try {
    const shelfId = req.params.id;

    // Verify shelf exists
    const shelves = await query(
      'SELECT * FROM shelves WHERE id = ?',
      [shelfId]
    );

    if (shelves.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shelf not found'
      });
    }

    const shelf = shelves[0];

    // Get all books whose latest location is this shelf
    const books = await query(
      `SELECT 
        b.id,
        b.isbn,
        b.title,
        b.author,
        b.category,
        blh.timestamp as last_scanned
       FROM books b
       INNER JOIN book_location_history blh ON b.id = blh.book_id
       WHERE blh.shelf_id = ?
       AND blh.timestamp = (
         SELECT MAX(timestamp)
         FROM book_location_history
         WHERE book_id = b.id
       )
       ORDER BY b.title`,
      [shelfId]
    );

    res.json({
      shelf: {
        id: shelf.id,
        shelfCode: shelf.shelf_code,
        zone: shelf.zone,
        section: shelf.section,
        floor: shelf.floor
      },
      totalBooks: books.length,
      books: books.map(book => ({
        id: book.id,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        category: book.category,
        lastScanned: book.last_scanned
      }))
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  listShelves,
  getShelfById,
  getBooksOnShelf
};
