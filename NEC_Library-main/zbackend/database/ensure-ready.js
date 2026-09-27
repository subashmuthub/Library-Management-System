/**
 * Database readiness guard.
 *
 * Ensures required runtime tables/columns exist before starting the API.
 * Falls back to setup.js only when core base schema is missing.
 */

/* eslint-disable unicorn/prefer-top-level-await */

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const BASE_REQUIRED_TABLES = ["users", "books", "user_roles", "entry_logs"];

const RUNTIME_TABLES = [
  "book_transactions",
  "fines",
  "reviews",
  "book_suggestions",
  "book_reservations",
];

async function runSetupScript() {
  console.warn("⚠ Running database/setup.js to build base schema...");

  const setupPath = path.join(__dirname, "setup.js");
  const result = spawnSync(process.execPath, [setupPath], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function getExistingTables(connection, dbName, tableNames) {
  const placeholders = tableNames.map(() => "?").join(",");
  const [rows] = await connection.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME IN (${placeholders})`,
    [dbName, ...tableNames],
  );
  return new Set(rows.map((row) => row.TABLE_NAME));
}

async function hasColumn(connection, dbName, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [dbName, tableName, columnName],
  );
  return rows.length > 0;
}

async function ensureRuntimeTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS book_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      book_id INT NOT NULL,
      checked_out_by INT NULL,
      transaction_type ENUM('checkout', 'return', 'renew') NOT NULL DEFAULT 'checkout',
      checkout_date DATE NOT NULL,
      due_date DATE NOT NULL,
      return_date DATE NULL,
      renewed_count INT DEFAULT 0,
      renewal_count INT NOT NULL DEFAULT 0,
      status ENUM('active', 'returned', 'overdue', 'lost') DEFAULT 'active',
      issued_by INT NULL,
      returned_to INT NULL,
      returned_by INT NULL,
      return_condition VARCHAR(50) NULL,
      notes TEXT NULL,
      is_book_bank_loan BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (checked_out_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (returned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (returned_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_user_status (user_id, status),
      INDEX idx_book_status (book_id, status),
      INDEX idx_due_date (due_date),
      INDEX idx_checkout_date (checkout_date)
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS fines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      transaction_id INT NOT NULL,
      fine_type ENUM('overdue', 'damage', 'lost_book', 'other') DEFAULT 'overdue',
      amount DECIMAL(10, 2) NOT NULL,
      days_overdue INT DEFAULT 0,
      fine_rate DECIMAL(5, 2) DEFAULT 1.00,
      status ENUM('pending', 'paid', 'waived', 'partial') DEFAULT 'pending',
      amount_paid DECIMAL(10, 2) DEFAULT 0.00,
      payment_date DATE NULL,
      payment_method ENUM('cash', 'card', 'online', 'waived') NULL,
      processed_by INT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES book_transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_user_status (user_id, status),
      INDEX idx_transaction_id (transaction_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      book_id INT NOT NULL,
      user_id INT NOT NULL,
      rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      review_text TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

      INDEX idx_reviews_book (book_id),
      INDEX idx_reviews_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS book_suggestions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255) NOT NULL,
      isbn VARCHAR(50) NULL,
      reason TEXT NULL,
      status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

      INDEX idx_suggestions_user (user_id),
      INDEX idx_suggestions_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS book_reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      book_id INT NOT NULL,
      user_id INT NOT NULL,
      status ENUM('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
      reason TEXT NOT NULL,
      reviewed_by INT NULL,
      rejection_reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_reservation_book (book_id),
      INDEX idx_reservation_user (user_id),
      INDEX idx_reservation_status (status),
      INDEX idx_reservation_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureUserColumns(connection, dbName) {
  // Completely purge legacy columns if present
  const legacyUserColumns = ["community_category", "is_book_bank_eligible"];
  for (const col of legacyUserColumns) {
    const exists = await hasColumn(connection, dbName, "users", col);
    if (exists) {
      await connection.query(`ALTER TABLE users DROP COLUMN ${col}`).catch(() => {});
    }
  }

  // Ensure academic credential columns exist
  const academicColumns = [
    {
      name: "degree_type",
      sql: "ALTER TABLE users ADD COLUMN degree_type VARCHAR(30) NULL DEFAULT 'BE' AFTER student_id",
    },
    {
      name: "department",
      sql: "ALTER TABLE users ADD COLUMN department VARCHAR(50) NULL DEFAULT 'CSE' AFTER degree_type",
    },
    {
      name: "academic_year",
      sql: "ALTER TABLE users ADD COLUMN academic_year VARCHAR(20) NULL DEFAULT '3rd Year' AFTER department",
    },
  ];

  for (const col of academicColumns) {
    const exists = await hasColumn(connection, dbName, "users", col.name);
    if (!exists) {
      await connection.query(col.sql).catch(() => {});
    }
  }

  // Backfill existing users who have NULL values
  await connection.query(`
    UPDATE users 
    SET 
      degree_type = COALESCE(degree_type, 'BE'),
      department = COALESCE(department, 'CSE'),
      academic_year = COALESCE(academic_year, '3rd Year')
    WHERE degree_type IS NULL OR department IS NULL OR academic_year IS NULL
  `).catch(() => {});
}

async function ensureBookTransactionColumns(connection, dbName) {
  // Purge legacy loan columns if present
  const hasLegacyLoan = await hasColumn(connection, dbName, "book_transactions", "is_book_bank_loan");
  if (hasLegacyLoan) {
    await connection.query("ALTER TABLE book_transactions DROP COLUMN is_book_bank_loan").catch(() => {});
  }

  const addColumnStatements = [
    {
      name: "checked_out_by",
      sql: "ALTER TABLE book_transactions ADD COLUMN checked_out_by INT NULL AFTER book_id",
    },
    {
      name: "returned_by",
      sql: "ALTER TABLE book_transactions ADD COLUMN returned_by INT NULL AFTER issued_by",
    },
    {
      name: "renewal_count",
      sql: "ALTER TABLE book_transactions ADD COLUMN renewal_count INT NOT NULL DEFAULT 0 AFTER renewed_count",
    },
    {
      name: "return_condition",
      sql: "ALTER TABLE book_transactions ADD COLUMN return_condition VARCHAR(50) NULL AFTER returned_by",
    },
  ];

  for (const column of addColumnStatements) {
    const exists = await hasColumn(
      connection,
      dbName,
      "book_transactions",
      column.name,
    );
    if (!exists) {
      await connection.query(column.sql);
    }
  }
}

async function ensureBookProcurementColumns(connection, dbName) {
  const procurementColumns = [
    {
      name: "purchase_source",
      sql: "ALTER TABLE books ADD COLUMN purchase_source VARCHAR(150) NULL AFTER publisher",
    },
    {
      name: "purchase_vendor",
      sql: "ALTER TABLE books ADD COLUMN purchase_vendor VARCHAR(200) NULL AFTER purchase_source",
    },
    {
      name: "vendor_agent_name",
      sql: "ALTER TABLE books ADD COLUMN vendor_agent_name VARCHAR(150) NULL AFTER purchase_vendor",
    },
    {
      name: "vendor_agent_phone",
      sql: "ALTER TABLE books ADD COLUMN vendor_agent_phone VARCHAR(30) NULL AFTER vendor_agent_name",
    },
    {
      name: "purchase_price",
      sql: "ALTER TABLE books ADD COLUMN purchase_price DECIMAL(10,2) NULL AFTER pages",
    },
    {
      name: "purchase_date",
      sql: "ALTER TABLE books ADD COLUMN purchase_date DATE NULL AFTER purchase_price",
    },
    {
      name: "purchase_invoice_no",
      sql: "ALTER TABLE books ADD COLUMN purchase_invoice_no VARCHAR(100) NULL AFTER purchase_date",
    },
    {
      name: "is_restricted_research",
      sql: "ALTER TABLE books ADD COLUMN is_restricted_research BOOLEAN NOT NULL DEFAULT FALSE AFTER pages",
    },
  ];

  for (const column of procurementColumns) {
    const exists = await hasColumn(connection, dbName, "books", column.name);
    if (!exists) {
      await connection.query(column.sql);
    }
  }

  // Migrate legacy is_book_bank if it exists, then purge legacy columns
  const hasLegacyBookBank = await hasColumn(connection, dbName, "books", "is_book_bank");
  if (hasLegacyBookBank) {
    await connection.query("UPDATE books SET is_restricted_research = TRUE WHERE is_book_bank = TRUE").catch(() => {});
    await connection.query("ALTER TABLE books DROP COLUMN is_book_bank").catch(() => {});
  }
  const hasLegacySchemeName = await hasColumn(connection, dbName, "books", "book_bank_scheme_name");
  if (hasLegacySchemeName) {
    await connection.query("ALTER TABLE books DROP COLUMN book_bank_scheme_name").catch(() => {});
  }

  await connection.query(`
    UPDATE books
    SET
      purchase_source = COALESCE(NULLIF(TRIM(purchase_source), ''), 'Campus Book Fair'),
      purchase_vendor = COALESCE(NULLIF(TRIM(purchase_vendor), ''), NULLIF(TRIM(publisher), ''), 'Campus Supply Hub'),
      vendor_agent_name = COALESCE(NULLIF(TRIM(vendor_agent_name), ''), CONCAT('Agent ', id)),
      vendor_agent_phone = COALESCE(NULLIF(TRIM(vendor_agent_phone), ''), CONCAT('+91-9000', LPAD(MOD(id, 10000), 4, '0'))),
      purchase_price = COALESCE(purchase_price, (250 + (MOD(id, 10) * 35))),
      purchase_date = COALESCE(purchase_date, DATE_SUB(CURDATE(), INTERVAL MOD(id, 365) DAY)),
      purchase_invoice_no = COALESCE(NULLIF(TRIM(purchase_invoice_no), ''), CONCAT('INV-', LPAD(id, 5, '0')))
  `);
}

async function ensureDefaultRoles(connection) {
  await connection.query(`
    INSERT IGNORE INTO user_roles (id, role_name, description, permissions)
    VALUES
      (1, 'admin', 'System administrator with full access', '{"users":["create","read","update","delete"],"books":["create","read","update","delete"],"transactions":["create","read","update","delete"],"fines":["create","read","update","delete"]}'),
      (2, 'librarian', 'Library staff with administrative access', '{"users":["read","update"],"books":["create","read","update"],"transactions":["create","read","update"],"fines":["read","update"]}'),
      (3, 'student', 'Student user with basic access', '{"books":["read"],"transactions":["read"],"reservations":["create","read","update"]}'),
      (4, 'staff', 'Faculty and support staff with borrower access', '{"books":["read"],"transactions":["read"],"reservations":["create","read","update"]}'),
      (5, 'me_student', 'Master of Engineering (PG) student with direct research thesis access', '{"books":["read"],"transactions":["read"],"reservations":["create","read","update"]}'),
      (6, 'research_scholar', 'Doctoral researcher with direct research paper and thesis access', '{"books":["read"],"transactions":["read"],"reservations":["create","read","update"]}')
  `);
}

async function ensureDatabaseReady() {
  const dbName = process.env.DB_NAME || "smart_library";

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number.parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  });

  try {
    const [dbRows] = await connection.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [dbName],
    );

    if (dbRows.length === 0) {
      await connection.end();
      await runSetupScript();
      return;
    }

    const existingBaseTables = await getExistingTables(
      connection,
      dbName,
      BASE_REQUIRED_TABLES,
    );
    const missingBaseTables = BASE_REQUIRED_TABLES.filter(
      (table) => !existingBaseTables.has(table),
    );

    if (missingBaseTables.length > 0) {
      await connection.end();
      console.warn(
        `⚠ Base schema incomplete. Missing: ${missingBaseTables.join(", ")}`,
      );
      await runSetupScript();
      return;
    }

    await connection.changeUser({ database: dbName });

    await ensureRuntimeTables(connection);
    await ensureUserColumns(connection, dbName);
    await ensureBookTransactionColumns(connection, dbName);
    await ensureBookProcurementColumns(connection, dbName);
    await ensureDefaultRoles(connection);

    const existingRuntimeTables = await getExistingTables(
      connection,
      dbName,
      RUNTIME_TABLES,
    );
    const missingRuntimeTables = RUNTIME_TABLES.filter(
      (table) => !existingRuntimeTables.has(table),
    );

    if (missingRuntimeTables.length > 0) {
      throw new Error(
        `Failed to create runtime tables: ${missingRuntimeTables.join(", ")}`,
      );
    }

    console.log("✓ Database schema ready");
  } finally {
    await connection.end();
  }
}

ensureDatabaseReady().catch((error) => {
  console.error("✗ Failed to validate database readiness:", error.message);
  process.exit(1);
});
