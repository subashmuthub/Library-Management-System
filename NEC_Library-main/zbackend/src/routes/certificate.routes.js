/**
 * Certificate Routes
 * Endpoints for generating Active Library User of the Month certificates
 */

const express = require('express');
const router = express.Router();
const CertificateController = require('../controllers/certificate.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate, authorize(['admin', 'librarian']));

/**
 * GET /api/v1/certificates/active-user
 * Get the top active library user for a given month/year
 * Query: ?month=8&year=2026
 */
router.get('/active-user', CertificateController.getActiveUser);

/**
 * GET /api/v1/certificates/top-students
 * Get top 10 students for a given month/year (for manual selection)
 * Query: ?month=8&year=2026
 */
router.get('/top-students', CertificateController.getTopStudents);

module.exports = router;
