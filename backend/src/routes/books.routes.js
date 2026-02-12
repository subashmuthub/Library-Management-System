/**
 * Book Routes
 * Complete CRUD operations for book management
 */

const express = require('express');
const router = express.Router();
const BookController = require('../controllers/book.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Get all books with filtering and pagination
router.get('/', BookController.getAllBooks);

// Search books (public endpoint)
router.get('/search', BookController.searchBooks);

// Get book categories
router.get('/categories', BookController.getCategories);

// Get specific book by ID
router.get('/:id', BookController.getBookById);

// Protected routes (require authentication)
router.use(authenticate);

// Add new book (librarian/admin only)
router.post('/', BookController.addBook);

// Update book (librarian/admin only)
router.put('/:id', BookController.updateBook);

// Delete book (admin only) 
router.delete('/:id', BookController.deleteBook);

module.exports = router;