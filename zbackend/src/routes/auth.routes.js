/**
 * Authentication Routes
 *
 * Handles user registration and login.
 */

const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const {
  validationRules,
  handleValidationErrors,
} = require("../middleware/validator.middleware");

// Register new user
router.post(
  "/register",
  validationRules.register,
  handleValidationErrors,
  authController.register,
);

// Login
router.post(
  "/login",
  validationRules.login,
  handleValidationErrors,
  authController.login,
);

// Google login (ID-token flow — for programmatic use)
router.post(
  "/google",
  validationRules.googleLogin,
  handleValidationErrors,
  authController.googleLogin,
);

// Verify email OTP
router.post(
  "/verify-otp",
  validationRules.verifyOtp,
  handleValidationErrors,
  authController.verifyOtp,
);

// Resend email OTP
router.post(
  "/resend-otp",
  validationRules.resendOtp,
  handleValidationErrors,
  authController.resendOtp,
);

// Google OAuth redirect flow — works from ANY frontend port, no JS-origin setup needed
// Step 1: browser navigates here → gets redirected to Google consent screen
router.get("/google", authController.googleOAuthStart);
// Step 2: Google redirects back here after user consents
router.get("/google/callback", authController.googleOAuthCallback);

// Logout
router.post("/logout", authController.logout);

// Get current session user (frontend calls this on page load to verify session)
router.get("/me", authController.me);

module.exports = router;
