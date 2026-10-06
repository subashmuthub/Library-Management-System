/**
 * Transaction Routes
 * Endpoints for book checkout, return, and renewal operations
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transaction.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Enforce authentication across all transaction routes
router.use(authenticate);

const { requireActiveEntryForStudents } = require('../middleware/entry-policy.middleware');

/**
 * Operational boundary middleware:
 * Direct self-checkout is forbidden for students. Students can only reserve.
 */
const blockStudentCheckout = (req, res, next) => {
  const roleName = String(req.user?.role || req.user?.role_name || req.user?.role?.role_name || '').toLowerCase();
  if (['student', 'me_student', 'research_scholar'].includes(roleName)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Access Denied: Students can only place reservations. Book issuance must be processed at the counter by a Clerk.'
    });
  }
  next();
};

/**
 * POST /api/transactions/checkout
 * Checkout a book (counter issue process)
 * Body: { user_id, book_id, due_date? }
 */
router.post('/checkout', blockStudentCheckout, authorize(['admin', 'librarian', 'clerk']), TransactionController.checkoutBook);
router.post('/issue', blockStudentCheckout, authorize(['admin', 'librarian', 'clerk']), TransactionController.checkoutBook);

/**
 * POST /api/transactions/checkout-batch
 * Batch checkout multiple books
 * Body: { userId, bookIds, loanDays }
 */
router.post('/checkout-batch', blockStudentCheckout, authorize(['admin', 'librarian', 'clerk']), TransactionController.checkoutBatch);

/**
 * POST /api/transactions/quick-return
 * Bulk / continuous return by barcode, RFID tag, ISBN, or transaction ID
 * Body: { identifier, condition?, notes? }
 */
router.post('/quick-return', authorize(['admin', 'librarian', 'clerk']), TransactionController.quickReturn);

/**
 * POST /api/transactions/:id/return
 * Return a book
 * Body: { condition?, notes? }
 */
router.post('/:id/return', authorize(['admin', 'librarian', 'clerk']), TransactionController.returnBook);

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
 * GET /api/transactions/statistics
 * Get transaction statistics for dashboard
 * Query params: period (days)
 */
router.get('/statistics', authorize(['admin', 'librarian', 'clerk']), TransactionController.getTransactionStatistics);

/**
 * GET /api/transactions/overdue
 * Get all overdue transactions
 * Query params: days_overdue, page, limit
 */
router.get('/overdue', TransactionController.getOverdueBooks);

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

module.exports = router;