/**
 * Reservation Routes
 * Endpoints for book reservations and queue management
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const ReservationController = require('../controllers/reservation.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Enforce authentication across all reservation routes
router.use(authenticate);

/**
 * POST /api/reservations
 * Create a new book reservation
 * Body: { book_id }
 */
router.post('/', ReservationController.reserveBook);

/**
 * GET /api/reservations
 * Get all reservations (admin/librarian view)
 * Query params: status, book_id, page, limit
 */
router.get('/', ReservationController.getAllReservations);

/**
 * GET /api/reservations/statistics
 * Get reservation statistics for dashboard
 * Query params: period (days)
 */
router.get('/statistics', ReservationController.getReservationStatistics);

/**
 * GET /api/reservations/user/:userId?
 * Get reservations for a specific user (or current user if no userId)
 * Query params: status, page, limit
 */
router.get('/user/:userId?', ReservationController.getUserReservations);

/**
 * GET /api/reservations/book/:bookId/queue
 * Get reservation queue for a specific book
 */
router.get('/book/:bookId/queue', ReservationController.getBookReservationQueue);

/**
 * POST /api/reservations/:id/cancel
 * Cancel a reservation
 */
router.post('/:id/cancel', ReservationController.cancelReservation);

/**
 * POST /api/reservations/request
 * Submit an approval request for a restricted research title (Students)
 * Body: { book_id, reason }
 */
router.post('/request', ReservationController.requestAccess);

/**
 * GET /api/reservations/pending
 * Get all pending research title approval requests (Admin/Librarian only)
 */
router.get('/pending', authorize(['admin', 'librarian']), ReservationController.getPendingRequests);

/**
 * PATCH /api/reservations/:id/review
 * Approve or reject an access request (Admin/Librarian only)
 * Body: { status: 'APPROVED' | 'REJECTED', rejection_reason }
 */
router.patch('/:id/review', authorize(['admin', 'librarian']), ReservationController.reviewRequest);

/**
 * GET /api/reservations/my-status/:bookId
 * Check current student's request status for a specific book
 */
router.get('/my-status/:bookId', ReservationController.getMyRequestStatus);

/**
 * POST /api/reservations/:id/fulfill
 * Fulfill reservation (mark as picked up and create checkout)
 * Librarian/Admin only
 */
router.post('/:id/fulfill', authorize(['admin', 'librarian']), ReservationController.fulfillReservation);

module.exports = router;