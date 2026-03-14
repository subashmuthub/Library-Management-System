#!/usr/bin/env node
/**
 * Smart Library - One-Command Setup
 *
 * Run: node setup.js
 *
 * This script will:
 *  1. Install all backend & frontend dependencies
 *  2. Create the database schema + seed data (fresh setup)
 *  3. Fix user roles
 */

const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = __dirname;
const zbackend = path.join(root, "zbackend");
const frontend = path.join(root, "frontend");

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}  (in ${path.relative(root, cwd) || "."})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function checkEnv() {
  const envPath = path.join(zbackend, ".env");
  const examplePath = path.join(zbackend, ".env.example");

  if (fs.existsSync(envPath)) {
    console.log("✅  zbackend/.env exists");
    return;
  }

  console.log("\n⚠️  No .env found in zbackend/. Copying from .env.example...");
  fs.copyFileSync(examplePath, envPath);
  console.log(
    "✅  Created zbackend/.env – please update DB_PASSWORD before continuing.\n",
  );
  process.exit(0);
}

function checkFrontendEnv() {
  const envPath = path.join(frontend, ".env");
  const examplePath = path.join(frontend, ".env.example");

  if (fs.existsSync(envPath)) {
    console.log("✅  frontend/.env exists");
    return;
  }

  console.log("\n⚠️  No .env found in frontend/. Copying from .env.example...");
  fs.copyFileSync(examplePath, envPath);
  console.log("✅  Created frontend/.env");
}

function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  Smart Library Automation System - Setup");
  console.log("=".repeat(60));

  // Step 1 – env files
  checkEnv();
  checkFrontendEnv();

  // Step 2 – install dependencies
  console.log("\n📦  Installing backend dependencies...");
  run("npm install", zbackend);

  console.log("\n📦  Installing frontend dependencies...");
  run("npm install", frontend);

  // Step 3 – create/refresh database
  console.log("\n🗄️   Setting up database (schema + seed data)...");
  run("node database/setup.js", zbackend);

  // Step 4 – fix roles (safe to run even if already correct)
  console.log("\n🔧  Ensuring user_roles are set...");
  run("node fix-roles.js", zbackend);

  console.log("\n" + "=".repeat(60));
  console.log("  ✅  Setup complete!");
  console.log("=".repeat(60));
  console.log("\n  To start the application open TWO terminals:\n");
  console.log("  Terminal 1 (Backend):");
  console.log("    cd backend && npm start\n");
  console.log("  Terminal 2 (Frontend):");
  console.log("    cd frontend && npm run dev\n");
  console.log("  Then open: http://localhost:5173");
  console.log("\n  Demo credentials:");
  console.log("    Student  : student1@university.edu / password123");
  console.log("    Librarian: librarian1@library.edu  / password123");
  console.log("    Admin    : admin@library.edu        / password123");
  console.log("=".repeat(60) + "\n");
}

try {
  main();
} catch (err) {
  console.error("\n❌  Setup failed:", err.message);
  process.exit(1);
}
