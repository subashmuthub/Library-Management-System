/**
 * Reservation Routes
 * Endpoints for book reservations and queue management
 */

const express = require('express');
const router = express.Router();
const ReservationController = require('../controllers/reservation.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Apply authentication to all routes
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
 * POST /api/reservations/:id/fulfill
 * Fulfill reservation (mark as picked up and create checkout)
 * Librarian/Admin only
 */
router.post('/:id/fulfill', ReservationController.fulfillReservation);

module.exports = router;