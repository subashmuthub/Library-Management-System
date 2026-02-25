/**
 * Transaction Routes
 * Endpoints for book checkout, return, and renewal operations
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transaction.controller');
// const { authenticate } = require('../middleware/auth.middleware');

// Authentication disabled for development
// router.use(authenticate);

/**
 * POST /api/transactions/checkout
 * Checkout a book (regular checkout process)
 * Body: { user_id, book_id, due_date? }
 */
router.post('/checkout', TransactionController.checkoutBook);

/**
 * POST /api/transactions/quick-checkout
 * Quick checkout by scanning (minimal validation)
 * Body: { user_identifier, book_identifier }
 */
router.post('/quick-checkout', TransactionController.quickCheckout);

/**
 * POST /api/transactions/:id/return
 * Return a book
 * Body: { condition?, notes? }
 */
router.post('/:id/return', TransactionController.returnBook);

/**
 * POST /api/transactions/:id/renew
 * Renew a book checkout
 * Body: { extend_days? }
 */
router.post('/:id/renew', TransactionController.renewBook);

/**
 * GET /api/transactions
 * Get all transactions with filtering
 * Query params: status, user_id, book_id, page, limit, date_from, date_to
 */
router.get('/', TransactionController.getAllTransactions);

/**
 * GET /api/transactions/:id
 * Get specific transaction details
 */
router.get('/:id', TransactionController.getTransactionById);

/**
 * GET /api/transactions/user/:userId/active
 * Get active checkouts for a user
 */
router.get('/user/:userId/active', TransactionController.getUserCheckouts);

/**
 * GET /api/transactions/overdue
 * Get all overdue transactions
 * Query params: days_overdue, page, limit
 */
router.get('/overdue', TransactionController.getOverdueBooks);

/**
 * GET /api/transactions/statistics
 * Get transaction statistics for dashboard
 * Query params: period (days)
 */
router.get('/statistics', TransactionController.getTransactionStatistics);

module.exports = router;