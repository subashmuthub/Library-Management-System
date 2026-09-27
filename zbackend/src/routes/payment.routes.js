const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  createPaymentOrder,
  verifyPayment,
  getPaymentGatewayStatus
} = require('../controllers/payment.controller');

/**
 * @route   GET /api/v1/payments/status
 * @desc    Check if payment gateway is configured
 * @access  Public
 */
router.get('/status', getPaymentGatewayStatus);

/**
 * @route   POST /api/v1/payments/order/:fineId
 * @desc    Create a Razorpay payment order for a fine
 * @access  Private (authenticated users)
 */
router.post('/order/:fineId', authenticate, createPaymentOrder);

/**
 * @route   POST /api/v1/payments/verify
 * @desc    Verify Razorpay payment and update fine status
 * @access  Private (authenticated users)
 */
router.post('/verify', authenticate, verifyPayment);

module.exports = router;
