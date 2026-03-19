/**
 * Fine Management Routes
 * Endpoints for fine calculations, payments, and management
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const FineController = require('../controllers/fine.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

/**
 * GET /api/fines
 * Get all pending fines with pagination
 * Query params: page, limit, userId
 */
router.get('/', FineController.getPendingFines);

/**
 * GET /api/fines/statistics
 * Get fine statistics for dashboard (admin/librarian only)
 * Query params: period (days)
 */
router.get('/statistics', FineController.getFineStatistics);

/**
 * GET /api/fines/:id
 * Get specific fine details by ID
 */
router.get('/:id', FineController.getFineById);

/**
 * POST /api/fines/:id/pay
 * Process payment for a specific fine
 * Body: { payment_method, amount_paid, payment_reference, notes }
 */
router.post('/:id/pay', FineController.payFine);

/**
 * POST /api/fines/:id/waive
 * Waive a fine (librarian/admin only)
 * Body: { reason }
 */
router.post('/:id/waive', FineController.waiveFine);

/**
 * POST /api/fines/:id/waive-request
 * Student request for waive approval
 */
router.post('/:id/waive-request', FineController.requestWaiveFine);

/**
 * POST /api/fines/:id/waive-approve
 * Admin/Librarian approval with optional discount
 * Body: { reason, discount_percent?, discount_amount? }
 */
router.post('/:id/waive-approve', authorize(['admin', 'librarian']), FineController.approveWaiveFine);

/**
 * POST /api/fines/manual
 * Create a manual fine (for damaged books, etc.)
 * Body: { user_id, transaction_id?, fine_type, amount, description, reason }
 */
router.post('/manual', FineController.createManualFine);

/**
 * GET /api/fines/calculate/:transactionId
 * Calculate fine amount for a specific transaction
 * Body: { fine_rate? }
 */
router.get('/calculate/:transactionId', FineController.calculateFine);

/**
 * GET /api/fines/user/:userId/summary
 * Get fine summary for a specific user
 */
router.get('/user/:userId/summary', FineController.getUserFineSummary);

/**
 * GET /api/fines/payments/history
 * Get payment history/receipts
 * Query params: userId, fineId, limit
 */
router.get('/payments/history', FineController.getPaymentHistory);

module.exports = router;