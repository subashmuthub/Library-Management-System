/**
 * Student Certificate Routes
 * Endpoints for student monthly reading certificates and verification.
 */

const express = require('express');
const router = express.Router();
const StudentCertificateController = require('../controllers/student-certificate.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * GET /api/students/my-certificate
 * Get the current student's monthly top reader certificate (if eligible)
 */
router.get('/my-certificate', authenticate, StudentCertificateController.getMyCertificate);

/**
 * GET /api/students/certificate/verify/:certificateId
 * Public verification endpoint
 */
router.get('/verify/:certificateId', StudentCertificateController.verifyCertificate);

module.exports = router;
