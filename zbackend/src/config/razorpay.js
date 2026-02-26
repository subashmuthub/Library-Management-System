const Razorpay = require('razorpay');
require('dotenv').config();

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'your_razorpay_key_id_here',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_key_secret_here',
});

// Check if Razorpay is configured
const isRazorpayConfigured = () => {
  return (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_ID !== 'your_razorpay_key_id_here' &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_KEY_SECRET !== 'your_razorpay_key_secret_here'
  );
};

module.exports = {
  razorpay: razorpayInstance,
  isRazorpayConfigured,
  keyId: process.env.RAZORPAY_KEY_ID,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
};
