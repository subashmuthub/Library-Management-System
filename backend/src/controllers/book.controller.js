/**
 * Book Management Controller
 * Handles all book-related CRUD operations
 */

const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

class BookController {
    // Get all books with search and filtering
    static async getAllBooks(req, res) {
        try {
            const { 
                search, 
                q, // Also support 'q' parameter for search
                category, 
                author, 
                availability,
                page = 1, 
                limit = 20,
                sortBy = 'title',
                sortOrder = 'ASC'
            } = req.query;

            const connection = await pool.getConnection();
            
            // Build WHERE conditions
            let whereConditions = ['1=1'];
            let queryParams = [];

            // Search in title, author, or description
            const searchTerm = search || q;
            if (searchTerm && searchTerm.trim()) {
                whereConditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)');
                const searchParam = `%${searchTerm.trim()}%`;
                queryParams.push(searchParam, searchParam, searchParam);
            }

            // Filter by category/department
            if (category && category.trim()) {
                whereConditions.push('b.category = ?');
                queryParams.push(category.trim());
            }

            // Filter by author
            if (author && author.trim()) {
                whereConditions.push('b.author LIKE ?');
                queryParams.push(`%${author.trim()}%`);
            }

            // Filter by availability
            if (availability === 'available') {
                whereConditions.push('b.is_available = TRUE');
            } else if (availability === 'unavailable') {
                whereConditions.push('b.is_available = FALSE');
            }

            const whereClause = whereConditions.join(' AND ');

            // Main query for books
            let query = `
                SELECT b.*, 
                       'available' as availability_status, 
                       0 as reservation_count 
                FROM books b 
                WHERE ${whereClause}
            `;

            // Add sorting
            const validSortColumns = ['title', 'author', 'category', 'publication_year', 'created_at'];
            const validSortOrders = ['ASC', 'DESC'];
            const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'title';
            const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
            
            query += ` ORDER BY b.${safeSortBy} ${safeSortOrder}`;

            // Add pagination with safe values
            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.max(1, Math.min(200, parseInt(limit) || 20));
            const offset = (pageNum - 1) * limitNum;
            
            query += ` LIMIT ${limitNum} OFFSET ${offset}`;
            
            const [books] = await connection.execute(query, queryParams);

            // Get total count with same WHERE clause
            const countQuery = `SELECT COUNT(*) as total FROM books b WHERE ${whereClause}`;
            const [countResult] = await connection.execute(countQuery, queryParams);
            const total = countResult[0].total;

            connection.release();

            res.json({
                success: true,
                data: {
                    books,
                    pagination: {
                        currentPage: pageNum,
                        totalPages: Math.ceil(total / limitNum),
                        totalBooks: total,
                        limit: limitNum,
                        hasNext: pageNum < Math.ceil(total / limitNum),
                        hasPrev: pageNum > 1
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching books:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching books',
                error: error.message
            });
        }
    }

    // Legacy search method for backward compatibility
    static async searchBooks(req, res) {
        try {
            const { q } = req.query;
            
            if (!q || q.trim().length < 2) {
                return res.status(400).json({ 
                    error: 'Search query must be at least 2 characters' 
                });
            }

            const connection = await pool.getConnection();
            
            const [books] = await connection.execute(`
                SELECT 
                    b.*,
                    cbl.shelf_code,
                    cbl.zone,
                    CASE 
                        WHEN bt.id IS NOT NULL THEN 'checked_out'
                        ELSE 'available'
                    END as status
                FROM books b
                LEFT JOIN current_book_locations cbl ON b.id = cbl.book_id
                LEFT JOIN book_transactions bt ON b.id = bt.book_id AND bt.return_date IS NULL
                WHERE b.title LIKE ?
                   OR b.author LIKE ?
                   OR b.isbn LIKE ?
                ORDER BY b.title ASC
                LIMIT 50
            `, [`%${q}%`, `%${q}%`, `%${q}%`]);

            connection.release();

            res.json({
                total: books.length,
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
                    currentLocation: book.shelf_code ? {
                        shelfCode: book.shelf_code,
                        zone: book.zone
                    } : null
                }))
            });

        } catch (error) {
            console.error('Error searching books:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get book by ID with detailed information
    static async getBookById(req, res) {
        try {
            const { id } = req.params;
            const connection = await pool.getConnection();

            const [books] = await connection.execute(`
                SELECT 
                    b.*,
                    cbl.shelf_code,
                    cbl.zone,
                    cbl.section,
                    cbl.last_scanned,
                    rt.tag_id,
                    CASE 
                        WHEN bt.id IS NOT NULL THEN 'checked_out'
                        WHEN r.id IS NOT NULL THEN 'reserved'
                        ELSE 'available'
                    END as status,
                    bt.user_id as checked_out_by,
                    bt.due_date,
                    CONCAT(u.first_name, ' ', u.last_name) as borrower_name
                FROM books b
                LEFT JOIN current_book_locations cbl ON b.id = cbl.book_id
                LEFT JOIN rfid_tags rt ON b.id = rt.book_id
                LEFT JOIN book_transactions bt ON b.id = bt.book_id AND bt.return_date IS NULL
                LEFT JOIN users u ON bt.user_id = u.id
                LEFT JOIN reservations r ON b.id = r.book_id AND r.status = 'active'
                WHERE b.id = ?
            `, [id]);

            if (books.length === 0) {
                return res.status(404).json({ error: 'Book not found' });
            }

            // Get location history (last 10 movements)
            const [history] = await connection.execute(`
                SELECT 
                    s.shelf_code,
                    blh.timestamp,
                    u.first_name,
                    u.last_name
                FROM book_location_history blh
                INNER JOIN shelves s ON blh.shelf_id = s.id
                LEFT JOIN users u ON blh.scanned_by = u.id
                WHERE blh.book_id = ?
                ORDER BY blh.timestamp DESC
                LIMIT 10
            `, [id]);

            connection.release();

            const book = books[0];
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
                status: book.status,
                currentLocation: book.shelf_code ? {
                    shelfCode: book.shelf_code,
                    zone: book.zone,
                    section: book.section,
                    lastScanned: book.last_scanned
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
            console.error('Error fetching book:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get book location history
    static async getBookLocationHistory(req, res) {
        try {
            const bookId = req.params.id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            const connection = await pool.getConnection();

            const [history] = await connection.execute(`
                SELECT 
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
                LIMIT ? OFFSET ?
            `, [bookId, limit, offset]);

            // Get total count
            const [countResult] = await connection.execute(
                'SELECT COUNT(*) as total FROM book_location_history WHERE book_id = ?',
                [bookId]
            );

            connection.release();

            res.json({
                bookId: parseInt(bookId),
                totalRecords: countResult[0].total,
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
            console.error('Error fetching book location history:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Add new book
    static async addBook(req, res) {
        try {
            const {
                isbn,
                title,
                author,
                publisher,
                publication_year,
                category,
                edition,
                language = 'English',
                pages,
                description,
                cover_image_url,
                total_copies = 1
            } = req.body;

            // Validate required fields
            if (!isbn || !title || !author) {
                return res.status(400).json({ 
                    error: 'ISBN, title, and author are required' 
                });
            }

            const connection = await pool.getConnection();

            // Check if book with same ISBN already exists
            const [existingBooks] = await connection.execute(
                'SELECT id FROM books WHERE isbn = ?',
                [isbn]
            );

            if (existingBooks.length > 0) {
                connection.release();
                return res.status(400).json({ 
                    error: 'Book with this ISBN already exists' 
                });
            }

            // Insert new book
            const [result] = await connection.execute(`
                INSERT INTO books (
                    isbn, title, author, publisher, publication_year,
                    category, edition, language, pages, description, 
                    cover_image_url, total_copies
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                isbn, title, author, publisher, publication_year,
                category, edition, language, pages, description, 
                cover_image_url, total_copies
            ]);

            const bookId = result.insertId;

            // Get the created book
            const [newBook] = await connection.execute(
                'SELECT * FROM books WHERE id = ?',
                [bookId]
            );

            connection.release();

            res.status(201).json({
                message: 'Book added successfully',
                book: newBook[0]
            });

        } catch (error) {
            console.error('Error adding book:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                res.status(400).json({ error: 'Book with this ISBN already exists' });
            } else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    }

    // Update book
    static async updateBook(req, res) {
        try {
            const { id } = req.params;
            const updateFields = req.body;

            // Remove fields that shouldn't be updated directly
            const allowedFields = [
                'title', 'author', 'publisher', 'publication_year',
                'category', 'edition', 'language', 'pages', 
                'description', 'cover_image_url', 'total_copies', 'is_available'
            ];

            const updates = {};
            Object.keys(updateFields).forEach(field => {
                if (allowedFields.includes(field)) {
                    updates[field] = updateFields[field];
                }
            });

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }

            const connection = await pool.getConnection();

            // Build update query
            const setClause = Object.keys(updates).map(field => `${field} = ?`).join(', ');
            const values = Object.values(updates);
            values.push(id);

            const [result] = await connection.execute(
                `UPDATE books SET ${setClause} WHERE id = ?`,
                values
            );

            if (result.affectedRows === 0) {
                connection.release();
                return res.status(404).json({ error: 'Book not found' });
            }

            // Get updated book
            const [updatedBook] = await connection.execute(
                'SELECT * FROM books WHERE id = ?',
                [id]
            );

            connection.release();

            res.json({
                message: 'Book updated successfully',
                book: updatedBook[0]
            });

        } catch (error) {
            console.error('Error updating book:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Delete book
    static async deleteBook(req, res) {
        try {
            const { id } = req.params;
            const connection = await pool.getConnection();

            // Note: Foreign key constraints now have CASCADE delete enabled
            // This will automatically delete related records in:
            // - book_transactions (cancelled automatically)
            // - reservations
            // - book_location_history
            // - rfid_tags
            
            // Delete book (cascading handles all related records)
            const [result] = await connection.execute(
                'DELETE FROM books WHERE id = ?',
                [id]
            );

            connection.release();

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Book not found' });
            }

            res.json({ 
                message: 'Book deleted successfully',
                note: 'All related records (transactions, reservations, history) were also deleted'
            });

        } catch (error) {
            console.error('Error deleting book:', error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    }

    // Get book categories
    static async getCategories(req, res) {
        try {
            const connection = await pool.getConnection();
            
            // Get all categories with counts
            const [categories] = await connection.execute(`
                SELECT 
                    category as name, 
                    COUNT(*) as count
                FROM books
                WHERE category IS NOT NULL AND category != ''
                GROUP BY category
                ORDER BY 
                    CASE category
                        WHEN 'CSE' THEN 1
                        WHEN 'EEE' THEN 2
                        WHEN 'ECE' THEN 3
                        WHEN 'MECH' THEN 4
                        WHEN 'AIDS' THEN 5
                        WHEN 'S&H' THEN 6
                        ELSE 7
                    END,
                    category
            `);

            connection.release();
            res.json(categories);

        } catch (error) {
            console.error('Error fetching categories:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Bulk import books from CSV/Excel
    static async bulkImportBooks(req, res) {
        try {
            const { books } = req.body;

            if (!Array.isArray(books) || books.length === 0) {
                return res.status(400).json({ 
                    error: 'Invalid request. Expected an array of books.' 
                });
            }

            const connection = await pool.getConnection();
            await connection.beginTransaction();

            const results = {
                success: [],
                failed: []
            };

            for (let i = 0; i < books.length; i++) {
                const book = books[i];
                const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

                try {
                    // Note: All validation removed - books can be imported with missing fields
                    // Database now allows NULL for title, author, and ISBN
                    
                    // Note: Removed ISBN uniqueness check to allow duplicate books
                    // If you want to update existing books instead, uncomment the check below:
                    
                    /*
                    // Check if book with same ISBN already exists
                    const [existingBooks] = await connection.execute(
                        'SELECT id, title FROM books WHERE isbn = ?',
                        [book.isbn]
                    );

                    if (existingBooks.length > 0) {
                        // Update copy count instead of creating duplicate
                        const newTotalCopies = (book.total_copies ? parseInt(book.total_copies) : 1);
                        await connection.execute(
                            'UPDATE books SET total_copies = total_copies + ?, available_copies = available_copies + ? WHERE isbn = ?',
                            [newTotalCopies, newTotalCopies, book.isbn]
                        );
                        
                        results.success.push({
                            row: rowNumber,
                            action: 'updated',
                            title: existingBooks[0].title,
                            isbn: book.isbn,
                            addedCopies: newTotalCopies
                        });
                        continue;
                    }
                    */

                    // Insert book with all available fields
                    const totalCopies = book.total_copies ? parseInt(book.total_copies) : 1;
                    const [result] = await connection.execute(`
                        INSERT INTO books (
                            isbn, title, author, publisher, publication_year,
                            category, edition, language, pages, description, 
                            cover_image_url, total_copies, available_copies
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        book.isbn?.trim(),
                        book.title?.trim(),
                        book.author?.trim(),
                        book.publisher?.trim() || null,
                        book.publication_year || null,
                        book.category?.trim() || null,
                        book.edition?.trim() || null,
                        book.language?.trim() || 'English',
                        book.pages ? parseInt(book.pages) : null,
                        book.description?.trim() || null,
                        book.cover_image_url?.trim() || null,
                        totalCopies,
                        totalCopies // available_copies should equal total_copies initially
                    ]);

                    results.success.push({
                        row: rowNumber,
                        bookId: result.insertId,
                        title: book.title,
                        isbn: book.isbn
                    });

                } catch (error) {
                    results.failed.push({
                        row: rowNumber,
                        data: book,
                        error: error.message
                    });
                }
            }

            await connection.commit();
            connection.release();

            res.json({
                message: 'Bulk import completed',
                summary: {
                    total: books.length,
                    success: results.success.length,
                    failed: results.failed.length
                },
                results
            });

        } catch (error) {
            console.error('Error in bulk import:', error);
            res.status(500).json({ 
                error: 'Internal server error during bulk import',
                details: error.message 
            });
        }
    }
}

module.exports = {
    // Class methods
    getAllBooks: BookController.getAllBooks,
    getBookById: BookController.getBookById,
    addBook: BookController.addBook,
    updateBook: BookController.updateBook,
    deleteBook: BookController.deleteBook,
    getCategories: BookController.getCategories,
    getBookLocationHistory: BookController.getBookLocationHistory,
    bulkImportBooks: BookController.bulkImportBooks,
    
    // Legacy methods for backward compatibility
    searchBooks: BookController.searchBooks
};
