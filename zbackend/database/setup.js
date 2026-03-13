/**
 * Database Setup Script
 *
 * Runs schema.sql and seed.sql to initialize the database.
 * Usage: node database/setup.js
 */

const mysql = require("mysql2/promise");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

async function runMigrations(connection) {
  const migrationsDir = path.join(__dirname, "migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => /^00[4-9]_/.test(file) || /^0[1-9][0-9]_/.test(file))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    return;
  }

  console.log("\nExecuting migrations...");

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    if (/DELIMITER\s+\/\//i.test(sql)) {
      const sections = sql.split(/DELIMITER\s+\/\//i);

      if (sections[0].trim()) {
        await connection.query(sections[0]);
      }

      for (let index = 1; index < sections.length; index += 1) {
        const section = sections[index];
        const afterDelimiter = section.split(/DELIMITER\s+;/i);
        const procBody = afterDelimiter[0].replace(/\/\/\s*$/, "").trim();

        if (procBody) {
          await connection.query(procBody);
        }

        if (afterDelimiter[1] && afterDelimiter[1].trim()) {
          await connection.query(afterDelimiter[1]);
        }
      }
    } else {
      await connection.query(sql);
    }
    console.log(`✓ Applied migration: ${file}`);
  }
}

async function setupDatabase() {
  console.log("=".repeat(60));
  console.log("  Database Setup");
  console.log("=".repeat(60));

  try {
    // Connect to MySQL (without database selection)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      multipleStatements: true,
    });

    console.log("✓ Connected to MySQL server");

    // Read and execute schema.sql
    console.log("\nExecuting schema.sql...");
    const schemaSQL = await fs.readFile(
      path.join(__dirname, "schema.sql"),
      "utf8",
    );

    // PROBLEM THIS FIXES:
    // schema.sql uses "DELIMITER //" to define stored procedures.
    // Standard MySQL splitting on "DELIMITER //" would skip everything
    // AFTER the stored procedures (including INSERT INTO user_roles, etc.)
    //
    // SOLUTION:
    // 1. Execute everything BEFORE the first DELIMITER block normally
    // 2. Execute each stored procedure individually (stripped of DELIMITER)
    // 3. Execute everything AFTER the last DELIMITER block (the INSERTs)

    // Split into sections: [before_procs, proc1, proc1_body, proc2, proc2_body, ...]
    const delimiterSections = schemaSQL.split(/DELIMITER\s+\/\//i);
    const beforeProcs = delimiterSections[0]; // Tables, views, and everything before procedures

    // Execute tables and views
    if (beforeProcs.trim()) {
      await connection.query(beforeProcs);
    }

    // Each subsequent section alternates: procedure body // ... DELIMITER ;  remainder
    for (let i = 1; i < delimiterSections.length; i++) {
      const section = delimiterSections[i];

      // Split on "DELIMITER ;" to separate the procedure from what comes after it
      const afterDelimiter = section.split(/DELIMITER\s+;/i);
      const procBody = afterDelimiter[0]; // The stored procedure itself (ends with //)

      // Strip the trailing "//" from the procedure body, then execute
      const cleanProc = procBody.replace(/\/\/\s*$/, "").trim();
      if (cleanProc) {
        try {
          await connection.query(cleanProc);
        } catch (procError) {
          // Procedures might already exist on re-run, non-fatal
          if (!procError.message.includes("already exists")) {
            console.warn(`  ⚠ Procedure warning: ${procError.message}`);
          }
        }
      }

      // Execute anything AFTER the "DELIMITER ;" (the INSERT statements, etc.)
      if (afterDelimiter[1] && afterDelimiter[1].trim()) {
        await connection.query(afterDelimiter[1]);
      }
    }

    console.log(
      "✓ Schema created successfully (tables, indexes, constraints, and seed data)",
    );

    // Read and execute seed.sql
    console.log("\nExecuting seed.sql...");
    const seedSQL = await fs.readFile(path.join(__dirname, "seed.sql"), "utf8");
    await connection.query(seedSQL);
    console.log("✓ Sample data inserted successfully");

    await runMigrations(connection);

    // Verify setup
    console.log("\nVerifying database setup...");
    const [users] = await connection.query(
      "SELECT COUNT(*) as count FROM smart_library.users",
    );
    const [books] = await connection.query(
      "SELECT COUNT(*) as count FROM smart_library.books",
    );
    const [shelves] = await connection.query(
      "SELECT COUNT(*) as count FROM smart_library.shelves",
    );
    const [transactions] = await connection.query(
      "SELECT COUNT(*) as count FROM smart_library.book_transactions",
    );

    console.log(`  - Users: ${users[0].count}`);
    console.log(`  - Books: ${books[0].count}`);
    console.log(`  - Shelves: ${shelves[0].count}`);
    console.log(`  - Transactions: ${transactions[0].count}`);

    await connection.end();

    console.log("\n" + "=".repeat(60));
    console.log("  ✓ Database setup completed successfully!");
    console.log("=".repeat(60));
    console.log("\nYou can now start the server:");
    console.log("  npm start");
    console.log("");
  } catch (error) {
    console.error("\n✗ Database setup failed:", error.message);
    console.error("\nPlease check:");
    console.error("  1. MySQL server is running");
    console.error("  2. Credentials in .env are correct");
    console.error("  3. User has permission to create databases");
    process.exit(1);
  }
}

setupDatabase();
