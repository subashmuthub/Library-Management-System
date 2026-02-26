/**
 * Smart Library Automation System
 * Main Express Application Entry Point
 * 
 * This file sets up the Express server with all middleware,
 * routes, and error handling.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security headers
app.use(helmet());

// CORS configuration - allow credentials
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Cookie parser middleware
app.use(cookieParser());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mode: process.env.DEMO_MODE === 'true' ? 'DEMO' : 'PRODUCTION',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API version 1 routes
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/user-management', require('./routes/user-management.routes'));
app.use('/api/v1/dashboard', require('./routes/library-dashboard.routes'));
app.use('/api/v1/entry', require('./routes/entry.routes'));
app.use('/api/v1/books', require('./routes/books.routes'));
app.use('/api/v1/transactions', require('./routes/transaction.routes'));
app.use('/api/v1/fines', require('./routes/fine.routes'));
app.use('/api/v1/payments', require('./routes/payment.routes'));
app.use('/api/v1/reservations', require('./routes/reservation.routes'));
app.use('/api/v1/rfid', require('./routes/rfid.routes'));
app.use('/api/v1/readers', require('./routes/reader.routes'));
app.use('/api/v1/shelves', require('./routes/shelf.routes'));
app.use('/api/v1/beacons', require('./routes/beacon.routes'));
app.use('/api/v1/navigation', require('./routes/navigation.routes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  // Default error status and message
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Don't expose internal errors in production
  const response = {
    error: err.name || 'Error',
    message: process.env.NODE_ENV === 'production' && status === 500 
      ? 'An unexpected error occurred' 
      : message,
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  Smart Library Automation System');
  console.log('='.repeat(60));
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Mode: ${process.env.DEMO_MODE === 'true' ? 'DEMO (Handheld Reader)' : 'PRODUCTION (Fixed Readers)'}`);
  console.log(`  Server: http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  API: http://localhost:${PORT}/api/v1`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
