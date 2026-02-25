/**
 * Book Routes
 * Complete CRUD operations for book management
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const BookController = require('../controllers/book.controller');
// const { authenticate } = require('../middleware/auth.middleware');

// Get all books with filtering and pagination
router.get('/', BookController.getAllBooks);

// Search books
router.get('/search', BookController.searchBooks);

// Get book categories
router.get('/categories', BookController.getCategories);

// Get specific book by ID
router.get('/:id', BookController.getBookById);

// Add new book (no auth required for now)
router.post('/', BookController.addBook);

// Bulk import books (no auth required for now)
router.post('/bulk-import', BookController.bulkImportBooks);

// Update book (no auth required for now)
router.put('/:id', BookController.updateBook);

// Delete book (no auth required for now) 
router.delete('/:id', BookController.deleteBook);

module.exports = router;