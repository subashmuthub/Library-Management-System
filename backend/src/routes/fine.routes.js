/**
 * Fine Management Routes
 * Endpoints for fine calculations, payments, and management
 */

const express = require('express');
const router = express.Router();
const FineController = require('../controllers/fine.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Apply authentication to all routes
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

module.exports = router;