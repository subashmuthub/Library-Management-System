/**
 * Book Routes
 * Complete CRUD operations for book management
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const BookController = require('../controllers/book.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Get all books with filtering and pagination
router.get('/', authenticate, BookController.getAllBooks);

// Search books
router.get('/search', authenticate, BookController.searchBooks);

// Get book categories
router.get('/categories', authenticate, BookController.getCategories);

// Get specific book by ID
router.get('/:id', authenticate, BookController.getBookById);

// Get all copies sharing the same ISBN as a given book
router.get('/:id/isbn-copies', authenticate, BookController.getIsbnCopies);

// Get book location history (kept here for the public books routes)
router.get('/:id/history', authenticate, BookController.getBookLocationHistory);

// Get book reviews
router.get('/:id/reviews', authenticate, BookController.getBookReviews);

// Add book review (any authenticated user)
router.post('/:id/reviews', authenticate, BookController.addReview);

// Add new book (admin and librarian only)
router.post('/', authenticate, authorize(['admin', 'librarian']), BookController.addBook);

// Bulk import books (admin and librarian only)
router.post('/bulk-import', authenticate, authorize(['admin', 'librarian']), BookController.bulkImportBooks);

// Update book (admin and librarian only)
router.put('/:id', authenticate, authorize(['admin', 'librarian']), BookController.updateBook);

// Delete book (admin and librarian only) 
router.delete('/:id', authenticate, authorize(['admin', 'librarian']), BookController.deleteBook);

// Checkout book aliases
const TransactionController = require('../controllers/transaction.controller');
router.post('/checkout-batch', authenticate, TransactionController.checkoutBatch);
router.post('/checkout', authenticate, TransactionController.checkoutBook);
router.post('/:bookId/checkout', authenticate, TransactionController.checkoutBook);

module.exports = router;