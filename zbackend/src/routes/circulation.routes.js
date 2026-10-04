/**
 * Circulation Desk Routes
 * Counter issue, student lookup, and reservation fulfillment.
 * Strictly authorized for Clerks, Librarians, and Administrators.
 */

const express = require('express');
const router = express.Router();
const CirculationController = require('../controllers/circulation.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All circulation desk endpoints require authentication and circulation staff authorization
router.use(authenticate);
router.use(authorize(['admin', 'librarian', 'clerk']));

/**
 * GET /api/circulation/student-lookup/:query
 * Lookup student/patron by Student ID / Roll No, Email, or User ID.
 */
router.get('/student-lookup/:query', CirculationController.studentLookup);

/**
 * POST /api/circulation/issue-reserved
 * Issue a reserved book (standard or approved research paper) to the patron.
 * Body: { reservation_id, source, barcode_or_accession_no, loan_days }
 */
router.post('/issue-reserved', CirculationController.issueReserved);

/**
 * POST /api/circulation/direct-issue
 * Directly issue an on-shelf book via Accession No, Barcode, RFID, or ID.
 * Body: { user_id, identifier, loan_days }
 */
router.post('/direct-issue', CirculationController.directIssue);

/**
 * GET /api/circulation/search-books
 * Quick search books for desk autocomplete.
 */
router.get('/search-books', CirculationController.searchBooks);

/**
 * POST /api/circulation/desk-hold
 * Place or remove circulation desk hold on student account.
 */
router.post('/desk-hold', CirculationController.setDeskHold);

/**
 * POST /api/circulation/manual-return
 * Hardware fallback manual book return with condition inspection & hold shelf routing.
 */
router.post('/manual-return', CirculationController.manualReturn);

/**
 * GET /api/circulation/hold-shelf
 * List items waiting on hold shelf with countdown timers.
 */
router.get('/hold-shelf', CirculationController.getHoldShelf);

/**
 * POST /api/circulation/hold-shelf/expire-check
 * Trigger audit of expired holds and cascade to next queued patrons.
 */
router.post('/hold-shelf/expire-check', CirculationController.expireHoldShelfCheck);

/**
 * POST /api/circulation/fines/cash-collection
 * Cash collection endpoint for circulation desk.
 */
router.post('/fines/cash-collection', CirculationController.collectCash);

/**
 * POST /api/circulation/fines/dispute
 * Fine waiver (<= 50 INR) or escalation (> 50 INR) with mandatory reasons.
 */
router.post('/fines/dispute', CirculationController.disputeFine);

/**
 * GET /api/circulation/fines/disputes
 * List fine disputes and waivers.
 */
router.get('/fines/disputes', CirculationController.getFineDisputes);

/**
 * POST /api/circulation/inventory/report-condition
 * Mark book damaged or lost with optional replacement fee.
 */
router.post('/inventory/report-condition', CirculationController.reportCondition);

/**
 * POST /api/circulation/inventory/flag-misplaced
 * Flag book as misplaced and immediately hide from student search.
 */
router.post('/inventory/flag-misplaced', CirculationController.flagMisplaced);

/**
 * POST /api/circulation/inventory/resolve-misplaced
 * Restore misplaced book to active shelf inventory.
 */
router.post('/inventory/resolve-misplaced', CirculationController.resolveMisplaced);

/**
 * GET /api/circulation/inventory/flagged
 * List damaged, lost, or misplaced books for inventory audit.
 */
router.get('/inventory/flagged', CirculationController.getFlaggedInventory);

/**
 * POST /api/circulation/guest-passes
 * Register temporary day pass for visitor/alumni.
 */
router.post('/guest-passes', CirculationController.issueGuestPass);

/**
 * GET /api/circulation/guest-passes
 * List active and past temporary guest passes.
 */
router.get('/guest-passes', CirculationController.getGuestPasses);

/**
 * POST /api/circulation/guest-passes/:id/return
 * Check in and release returned guest badge.
 */
router.post('/guest-passes/:id/return', CirculationController.returnGuestPass);

/**
 * GET /api/circulation/shift-summary
 * Get live shift statistics for current clerk.
 */
router.get('/shift-summary', CirculationController.getShiftSummary);

/**
 * POST /api/circulation/shift-handover
 * Submit digital shift handover log with notes.
 */
router.post('/shift-handover', CirculationController.submitShiftHandover);

/**
 * GET /api/circulation/shift-handovers
 * List recent shift handovers.
 */
router.get('/shift-handovers', CirculationController.getShiftHandovers);

module.exports = router;
