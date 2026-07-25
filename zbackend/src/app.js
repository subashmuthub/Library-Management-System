/**
 * Smart Library Automation System
 * Main Express Application Entry Point
 *
 * This file sets up the Express server with all middleware,
 * routes, and error handling.
 */

const express = require("express");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = express();

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security headers
app.use(
  helmet({
    permissionsPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://accounts.google.com",
          "https://checkout.razorpay.com",
        ],
        "frame-src": [
          "'self'",
          "https://accounts.google.com",
          "https://*.google.com",
          "https://checkout.razorpay.com",
        ],
        "connect-src": [
          "'self'",
          "https://accounts.google.com",
          "https://oauth2.googleapis.com",
          "https://*.googleapis.com",
        ],
      },
    },
  }),
);

const isAllowedLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const hasBuiltFrontend = fs.existsSync(
  path.join(frontendDistPath, "index.html"),
);

// CORS configuration - allow credentials
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedLocalOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  }),
);

if (hasBuiltFrontend) {
  app.use(express.static(frontendDistPath));
}

// Cookie parser middleware
// Server-side session middleware — replaces the old JWT-in-cookie approach.
// The session ID is stored in an httpOnly cookie ("library.sid").
// User data lives on the SERVER (in-memory store), not inside the cookie.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "library-session-secret-fallback",
    resave: false, // do not re-save unchanged sessions
    saveUninitialized: false, // only create a session when something is stored
    name: "library.sid", // custom cookie name instead of "connect.sid"
    cookie: {
      httpOnly: true, // JS cannot read this cookie
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      sameSite: "lax",
      maxAge:
        Number.parseInt(process.env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000,
    },
  }),
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000, // 1 minute
  max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Request logging middleware (development only)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.path.includes("/auth/login")) {
      console.log("Login request body:", req.body);
      console.log("Headers:", req.headers);
    }
    next();
  });
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    mode: process.env.DEMO_MODE === "true" ? "DEMO" : "PRODUCTION",
    environment: process.env.NODE_ENV || "development",
  });
});

// API version 1 routes
const authRoutes = require("./routes/auth.routes");
const {
  requireActiveEntryForStudents,
} = require("./middleware/entry-policy.middleware");

// Role guard: students can read only (GET/HEAD/OPTIONS).
app.use("/api/v1", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Keep auth endpoints open for login/session lifecycle.
  if (req.path.startsWith("/auth")) {
    return next();
  }

  // Students must be able to update entry log.
  if (req.method === "POST" && req.path === "/entry/log") {
    return next();
  }

  const sessionUser = req.session?.user;
  const role = String(
    sessionUser?.role || sessionUser?.role_name || sessionUser?.role?.role_name || "",
  ).toLowerCase();

  // Student exception: allow self-checkout flow.
  if (role === "student" && req.method === "POST" && req.path === "/transactions/checkout") {
    return next();
  }

  if (role === "student") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Students have read-only access",
    });
  }

  return next();
});

app.use("/api/v1/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/api/v1/users", require("./routes/user.routes"));
app.use("/api/v1/user-management", require("./routes/user-management.routes"));
app.use("/api/v1/dashboard", require("./routes/library-dashboard.routes"));
app.use("/api/v1/entry", require("./routes/entry.routes"));
app.use("/api/v1/books", requireActiveEntryForStudents, require("./routes/books.routes"));
app.use("/api/v1/transactions", require("./routes/transaction.routes"));
app.use('/api/v1/navigation', require('./routes/navigation.routes'));
app.use('/api/v1/settings', require('./routes/settings.routes'));

// ── New modules (enhancement sprint) ────────────────────────────────────────
app.use('/api/v1/recommendations', require('./routes/recommendation.routes'));
app.use('/api/v1/overdue',         require('./routes/overdue.routes'));
app.use('/api/v1/shelf-locator',   require('./routes/shelf-locator.routes'));
app.use('/api/v1/heatmap',         require('./routes/heatmap.routes'));
app.use("/api/v1/fines", require("./routes/fine.routes"));
app.use("/api/v1/payments", require("./routes/payment.routes"));
app.use("/api/v1/reservations", requireActiveEntryForStudents, require("./routes/reservation.routes"));
app.use("/api/v1/rfid", require("./routes/rfid.routes"));
app.use("/api/v1/readers", require("./routes/reader.routes"));
app.use("/api/v1/shelves", require("./routes/shelf.routes"));
app.use("/api/v1/beacons", require("./routes/beacon.routes"));

// 404 handler
app.use((req, res) => {
  if (
    hasBuiltFrontend &&
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {
    return res.sendFile(path.join(frontendDistPath, "index.html"));
  }

  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);

  // Default error status and message
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  // Don't expose internal errors in production
  const response = {
    error: err.name || "Error",
    message:
      process.env.NODE_ENV === "production" && status === 500
        ? "An unexpected error occurred"
        : message,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  res.status(status).json(response);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3000;
const googleRedirectUri =
  process.env.GOOGLE_REDIRECT_URI ||
  `http://localhost:${PORT}/api/v1/auth/google/callback`;

// Start overdue alert background scheduler
const OverdueService = require('./services/overdue.service');
const RecommendationService = require('./services/recommendation.service');

const server = app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("  Smart Library Automation System");
  console.log("=".repeat(60));
  console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `  Mode: ${process.env.DEMO_MODE === "true" ? "DEMO (Handheld Reader)" : "PRODUCTION (Fixed Readers)"}`,
  );
  console.log(`  Server: http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  API: http://localhost:${PORT}/api/v1`);
  console.log(`  Google Callback: ${googleRedirectUri}`);
  console.log("=".repeat(60));
  
  // Start background services
  OverdueService.startScheduler();
  RecommendationService.refreshPopularityCache().catch(() => {});
});

server.on("error", (error) => {
  if (error.code !== "EADDRINUSE") {
    console.error("Server startup failed:", error);
    process.exit(1);
  }

  const request = http.get(`http://localhost:${PORT}/health`, (response) => {
    if (response.statusCode === 200) {
      console.log(`✓ Smart Library backend is already running on port ${PORT}`);
      console.log(`✓ Health: http://localhost:${PORT}/health`);
      response.resume();
      process.exit(0);
      return;
    }

    console.error(`✗ Port ${PORT} is already in use by another process`);
    response.resume();
    process.exit(1);
  });

  request.on("error", () => {
    console.error(`✗ Port ${PORT} is already in use by another process`);
    process.exit(1);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

module.exports = app;
