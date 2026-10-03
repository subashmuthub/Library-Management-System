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

module.exports = router;
