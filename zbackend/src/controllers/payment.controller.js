const crypto = require('crypto');
const db = require('../config/database');
const { razorpay, isRazorpayConfigured, keyId, webhookSecret } = require('../config/razorpay');

/**
 * Create a Razorpay payment order for fine payment
 */
const createPaymentOrder = async (req, res) => {
  try {
    const { fineId } = req.params;
    const { paymentMethod } = req.body; // 'upi', 'card', 'netbanking', etc.

    // Check if Razorpay is configured
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Payment gateway not configured. Please set up Razorpay API keys in .env file.',
        demoMode: true
      });
    }

    // Get fine details
    const [fines] = await db.query(
      `SELECT f.*, u.name as user_name, u.email as user_email 
       FROM fines f
       JOIN users u ON f.user_id = u.id
       WHERE f.id = ? AND f.status = 'pending'`,
      [fineId]
    );

    if (fines.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fine not found or already paid'
      });
    }

    const fine = fines[0];

    // Create Razorpay order
    const orderOptions = {
      amount: Math.round(parseFloat(fine.amount) * 100), // Amount in paise (INR)
      currency: 'INR',
      receipt: `fine_${fineId}_${Date.now()}`,
      notes: {
        fine_id: fineId,
        user_id: fine.user_id,
        user_name: fine.user_name,
        transaction_id: fine.transaction_id,
        payment_method: paymentMethod || 'upi'
      }
    };

    // Add payment method specific options
    if (paymentMethod === 'upi') {
      orderOptions.method = 'upi';
    }

    const order = await razorpay.orders.create(orderOptions);

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      keyId: keyId, // Frontend needs this
      fine: {
        id: fine.id,
        amount: fine.amount,
        user_name: fine.user_name,
        transaction_id: fine.transaction_id
      }
    });

  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message
    });
  }
};

/**
 * Verify Razorpay payment signature and update fine status
 */
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      fine_id,
      upi_id
    } = req.body;

    // Check if Razorpay is configured
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Payment gateway not configured'
      });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    // Get fine details
    const [fines] = await db.query(
      `SELECT f.*, u.name as user_name, u.email as user_email 
       FROM fines f
       JOIN users u ON f.user_id = u.id
       WHERE f.id = ?`,
      [fine_id]
    );

    if (fines.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fine not found'
      });
    }

    const fine = fines[0];

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update fine status
      await connection.query(
        `UPDATE fines 
         SET status = 'paid', 
             paid_amount = ?,
             paid_date = NOW(),
             payment_method = 'online',
             payment_reference = ?
         WHERE id = ?`,
        [payment.amount / 100, razorpay_payment_id, fine_id]
      );

      // Create payment receipt
      const receiptId = `RCP-${Date.now()}-${fine_id}`;
      const paymentNotes = upi_id 
        ? `Paid via ${payment.method} (UPI: ${upi_id})`
        : `Paid via ${payment.method}`;

      await connection.query(
        `INSERT INTO payment_receipts 
         (receipt_id, fine_id, transaction_id, user_id, amount, payment_method, 
          payment_reference, payment_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'completed', ?)`,
        [
          receiptId,
          fine_id,
          fine.transaction_id,
          fine.user_id,
          payment.amount / 100,
          payment.method,
          razorpay_payment_id,
          paymentNotes
        ]
      );

      await connection.commit();

      // Get the created receipt
      const [receipts] = await connection.query(
        `SELECT pr.*, u.name as user_name
         FROM payment_receipts pr
         JOIN users u ON pr.user_id = u.id
         WHERE pr.receipt_id = ?`,
        [receiptId]
      );

      res.json({
        success: true,
        message: 'Payment verified successfully',
        payment: {
          id: payment.id,
          amount: payment.amount / 100,
          method: payment.method,
          status: payment.status,
          upi_id: upi_id || null
        },
        receipt: receipts[0]
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

/**
 * Get Razorpay configuration status
 */
const getPaymentGatewayStatus = async (req, res) => {
  try {
    const configured = isRazorpayConfigured();
    
    res.json({
      success: true,
      configured,
      provider: 'Razorpay',
      message: configured 
        ? 'Payment gateway is configured and ready' 
        : 'Payment gateway not configured. Add Razorpay API keys to .env file.',
      setupUrl: 'https://dashboard.razorpay.com/app/website-app-settings/api-keys'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check payment gateway status',
      error: error.message
    });
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getPaymentGatewayStatus
};
