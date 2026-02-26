/**
 * Request Validation Middleware
 * 
 * Provides common validation functions for API requests.
 */

const { validationResult, body, param, query } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array()
    });
  }
  
  next();
};

/**
 * Validation rules for different endpoints
 */
const validationRules = {
  // User registration
  register: [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name required'),
    body('student_id').notEmpty().withMessage('Student ID required'),
    body('role').isIn(['student', 'librarian', 'admin']).withMessage('Invalid role')
  ],

  // User login
  login: [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
  ],

  // Entry log
  entryLog: [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('wifiSSID').optional().isString(),
    body('speed').optional().isFloat({ min: 0 }),
    body('manualConfirm').optional().isBoolean()
  ],

  // RFID scan (DEMO MODE)
  rfidScanDemo: [
    body('tagId').notEmpty().withMessage('Tag ID required'),
    body('shelfId').isInt({ min: 1 }).withMessage('Valid shelf ID required')
  ],

  // RFID scan (PRODUCTION MODE)
  rfidScanProduction: [
    body('tagId').notEmpty().withMessage('Tag ID required'),
    body('readerId').isInt({ min: 1 }).withMessage('Valid reader ID required')
  ],

  // Book search
  bookSearch: [
    query('q').optional().isString().isLength({ min: 1 }),
    query('isbn').optional().isString(),
    query('category').optional().isString()
  ],

  // Generic ID parameter
  idParam: [
    param('id').isInt({ min: 1 }).withMessage('Valid ID required')
  ]
};

module.exports = {
  handleValidationErrors,
  validationRules
};
