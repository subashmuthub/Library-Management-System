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
  "vendors",
  "library_budgets",
  "purchases",
  "purchase_items",
  "student_certificates",
  "fine_disputes",
  "cash_desk_logs",
  "guest_passes",
  "shift_handovers",
  "report_templates",
  "department_policies",
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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255) NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      address TEXT NULL,
      gst_number VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_vendor_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS library_budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      financial_year VARCHAR(20) NOT NULL UNIQUE,
      allocated_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      spent_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fin_year (financial_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_id INT NOT NULL,
      invoice_no VARCHAR(100) NOT NULL,
      purchase_date DATE NOT NULL,
      total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      allocated_year VARCHAR(20) NOT NULL,
      payment_status ENUM('PENDING', 'PAID', 'PARTIAL', 'CANCELLED') NOT NULL DEFAULT 'PAID',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
      INDEX idx_purchase_vendor (vendor_id),
      INDEX idx_purchase_invoice (invoice_no),
      INDEX idx_purchase_date (purchase_date),
      INDEX idx_purchase_year (allocated_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchase_id INT NOT NULL,
      item_title VARCHAR(500) NOT NULL,
      resource_type VARCHAR(30) NOT NULL DEFAULT 'BOOK',
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      INDEX idx_item_purchase (purchase_id),
      INDEX idx_item_resource (resource_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS student_certificates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      month_year VARCHAR(50) NOT NULL,
      books_read_count INT NOT NULL DEFAULT 0,
      certificate_id VARCHAR(100) NOT NULL UNIQUE,
      issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uk_user_month_cert (user_id, month_year),
      INDEX idx_cert_code (certificate_id),
      INDEX idx_cert_month (month_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS fine_disputes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fine_id INT NOT NULL,
      user_id INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      reason_category VARCHAR(50) NOT NULL,
      reason_text TEXT NULL,
      status ENUM('WAIVED', 'ESCALATED_TO_LIBRARIAN', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'ESCALATED_TO_LIBRARIAN',
      resolved_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (fine_id) REFERENCES fines(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_dispute_status (status),
      INDEX idx_dispute_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS cash_desk_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receipt_no VARCHAR(50) NOT NULL UNIQUE,
      fine_id INT NOT NULL,
      student_id INT NOT NULL,
      amount_received DECIMAL(10, 2) NOT NULL,
      receipt_notes TEXT NULL,
      collected_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fine_id) REFERENCES fines(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_cash_collected_by (collected_by),
      INDEX idx_cash_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS guest_passes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pass_number VARCHAR(50) NOT NULL UNIQUE,
      guest_name VARCHAR(150) NOT NULL,
      guest_type ENUM('ALUMNI', 'RESEARCHER', 'VISITOR') NOT NULL DEFAULT 'VISITOR',
      phone VARCHAR(30) NOT NULL,
      email VARCHAR(150) NULL,
      institution VARCHAR(150) NULL,
      purpose TEXT NULL,
      assigned_rfid_card_id VARCHAR(100) NULL,
      valid_until DATETIME NOT NULL,
      issued_by INT NOT NULL,
      status ENUM('ACTIVE', 'RETURNED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
      returned_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_guest_status (status),
      INDEX idx_guest_valid (valid_until)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS shift_handovers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      clerk_id INT NOT NULL,
      shift_start DATETIME NOT NULL,
      shift_end DATETIME NOT NULL,
      books_issued_count INT NOT NULL DEFAULT 0,
      books_returned_count INT NOT NULL DEFAULT 0,
      cash_collected DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      damaged_books_count INT NOT NULL DEFAULT 0,
      handover_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clerk_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_clerk_shift (clerk_id, shift_start)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS report_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_name VARCHAR(100) NOT NULL,
      header_title VARCHAR(255) NOT NULL,
      institution_name VARCHAR(255) NOT NULL,
      show_department_breakdown BOOLEAN DEFAULT TRUE,
      show_fine_summary BOOLEAN DEFAULT TRUE,
      custom_footer_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    INSERT IGNORE INTO report_templates (id, template_name, header_title, institution_name, show_department_breakdown, show_fine_summary, custom_footer_notes)
    VALUES (
      1,
      'Standard Institutional Report',
      'Central Library - Active Student Circulation & Analytics Report',
      'National Engineering College',
      TRUE,
      TRUE,
      'This official report is generated dynamically by the Central Library Information Management System for institutional review, academic council auditing, and NAAC/NBA criteria documentation.'
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS department_policies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      department_code VARCHAR(30) UNIQUE NOT NULL,
      department_name VARCHAR(100) NULL,
      max_borrow_limit_ug INT DEFAULT 6,
      loan_duration_days_ug INT DEFAULT 14,
      max_borrow_limit_pg INT DEFAULT 10,
      loan_duration_days_pg INT DEFAULT 60,
      allow_direct_thesis_checkout BOOLEAN DEFAULT FALSE,
      daily_fine_rate DECIMAL(5,2) DEFAULT 2.00,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    INSERT INTO department_policies (department_code, department_name, max_borrow_limit_ug, loan_duration_days_ug, max_borrow_limit_pg, loan_duration_days_pg, allow_direct_thesis_checkout, daily_fine_rate)
    VALUES
      ('DEFAULT', 'Standard Institution Default', 6, 14, 10, 60, FALSE, 2.00),
      ('CSE', 'Computer Science & Engineering', 8, 14, 12, 45, FALSE, 2.00),
      ('MECH', 'Mechanical Engineering', 6, 21, 10, 60, FALSE, 2.00),
      ('ECE', 'Electronics & Communication Engineering', 6, 14, 10, 60, FALSE, 2.00),
      ('CIVIL', 'Civil Engineering', 6, 21, 10, 60, FALSE, 2.00),
      ('AIDS', 'Artificial Intelligence & Data Science', 8, 14, 12, 60, TRUE, 2.00),
      ('IT', 'Information Technology', 8, 14, 12, 45, FALSE, 2.00)
    ON DUPLICATE KEY UPDATE
      department_name = VALUES(department_name)
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

  // Ensure academic credential and role columns exist
  const academicColumns = [
    {
      name: "role",
      sql: "ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'student' AFTER role_id",
    },
    {
      name: "degree_type",
      sql: "ALTER TABLE users ADD COLUMN degree_type VARCHAR(30) NULL AFTER student_id",
    },
    {
      name: "department",
      sql: "ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL AFTER degree_type",
    },
    {
      name: "academic_year",
      sql: "ALTER TABLE users ADD COLUMN academic_year VARCHAR(20) NULL AFTER department",
    },
    {
      name: "has_desk_hold",
      sql: "ALTER TABLE users ADD COLUMN has_desk_hold BOOLEAN NOT NULL DEFAULT FALSE AFTER status",
    },
    {
      name: "desk_hold_reason",
      sql: "ALTER TABLE users ADD COLUMN desk_hold_reason TEXT NULL AFTER has_desk_hold",
    },
  ];

  for (const col of academicColumns) {
    const exists = await hasColumn(connection, dbName, "users", col.name);
    if (!exists) {
      await connection.query(col.sql).catch(() => {});
    }
  }

  // Ensure role column is VARCHAR(50) and synchronized with user_roles
  await connection.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'student'").catch(() => {});
  await connection.query("UPDATE users u JOIN user_roles ur ON u.role_id = ur.id SET u.role = ur.role_name").catch(() => {});

  // Ensure optional columns are nullable
  await connection.query("ALTER TABLE users MODIFY COLUMN department VARCHAR(100) NULL DEFAULT NULL").catch(() => {});
  await connection.query("ALTER TABLE users MODIFY COLUMN degree_type VARCHAR(30) NULL DEFAULT 'BE'").catch(() => {});
  await connection.query("ALTER TABLE users MODIFY COLUMN academic_year VARCHAR(20) NULL DEFAULT '3rd Year'").catch(() => {});
  await connection.query("ALTER TABLE users MODIFY COLUMN phone VARCHAR(20) NULL DEFAULT NULL").catch(() => {});
  await connection.query("ALTER TABLE users MODIFY COLUMN address TEXT NULL DEFAULT NULL").catch(() => {});
  await connection.query("ALTER TABLE users MODIFY COLUMN student_id VARCHAR(50) NULL DEFAULT NULL").catch(() => {});

  // Backfill student accounts only
  await connection.query(`
    UPDATE users 
    SET 
      degree_type = COALESCE(degree_type, 'BE'),
      department = COALESCE(department, 'CSE'),
      academic_year = COALESCE(academic_year, '3rd Year')
    WHERE (role_id IN (3, 5, 6) OR role_id IS NULL)
      AND (degree_type IS NULL OR department IS NULL OR academic_year IS NULL)
  `).catch(() => {});

  // Ensure Admin, Librarian, Staff, and Clerk accounts do not hold student degree attributes
  await connection.query(`
    UPDATE users 
    SET degree_type = NULL, academic_year = NULL 
    WHERE role_id IN (1, 2, 4, 7)
  `).catch(() => {});

  await connection.query(`
    UPDATE users 
    SET department = 'Administration' 
    WHERE role_id = 1 AND (department IS NULL OR department = 'CSE')
  `).catch(() => {});

  await connection.query(`
    UPDATE users 
    SET department = 'Library' 
    WHERE role_id IN (2, 7) AND (department IS NULL OR department = 'CSE')
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
      name: "issued_by",
      sql: "ALTER TABLE book_transactions ADD COLUMN issued_by INT NULL AFTER checked_out_by",
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
      await connection.query(column.sql).catch(() => {});
    }
  }

  // Ensure status column in book_transactions can handle active/issued/returned/overdue
  await connection.query("ALTER TABLE book_transactions MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active'").catch(() => {});
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
    {
      name: "resource_type",
      sql: "ALTER TABLE books ADD COLUMN resource_type VARCHAR(30) NOT NULL DEFAULT 'BOOK' AFTER title",
    },
    {
      name: "doi",
      sql: "ALTER TABLE books ADD COLUMN doi VARCHAR(100) NULL AFTER isbn",
    },
    {
      name: "volume_issue",
      sql: "ALTER TABLE books ADD COLUMN volume_issue VARCHAR(50) NULL AFTER edition",
    },
    {
      name: "publication_date",
      sql: "ALTER TABLE books ADD COLUMN publication_date DATE NULL AFTER publication_year",
    },
    {
      name: "accession_no",
      sql: "ALTER TABLE books ADD COLUMN accession_no VARCHAR(50) NULL AFTER isbn",
    },
    {
      name: "barcode",
      sql: "ALTER TABLE books ADD COLUMN barcode VARCHAR(50) NULL AFTER accession_no",
    },
    {
      name: "status",
      sql: "ALTER TABLE books ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' AFTER is_available",
    },
    {
      name: "shelf_id",
      sql: "ALTER TABLE books ADD COLUMN shelf_id INT NULL AFTER is_available",
    },
    {
      name: "available_copies",
      sql: "ALTER TABLE books ADD COLUMN available_copies INT NOT NULL DEFAULT 1 AFTER total_copies",
    },
  ];

  for (const column of procurementColumns) {
    const exists = await hasColumn(connection, dbName, "books", column.name);
    if (!exists) {
      await connection.query(column.sql).catch(() => {});
    }
  }

  // Ensure books status is VARCHAR(30) and initialized
  await connection.query("ALTER TABLE books MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'").catch(() => {});
  await connection.query("UPDATE books SET status = CASE WHEN is_available = FALSE THEN 'CHECKED_OUT' ELSE 'AVAILABLE' END WHERE status IS NULL OR status = ''").catch(() => {});

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
      purchase_invoice_no = COALESCE(NULLIF(TRIM(purchase_invoice_no), ''), CONCAT('INV-', LPAD(id, 5, '0'))),
      resource_type = COALESCE(NULLIF(TRIM(resource_type), ''), CASE 
        WHEN category LIKE '%Journal%' OR category LIKE '%Periodical%' THEN 'JOURNAL'
        WHEN category LIKE '%Research%' OR (doi IS NOT NULL AND doi != '') THEN 'RESEARCH_PAPER'
        ELSE 'BOOK'
      END),
      accession_no = COALESCE(NULLIF(TRIM(accession_no), ''), CONCAT('ACC-', LPAD(id, 5, '0'))),
      barcode = COALESCE(NULLIF(TRIM(barcode), ''), CONCAT('BC-', LPAD(id, 6, '0')))
  `);
}

async function ensureReservationStatusEnum(connection, dbName) {
  try {
    const hasHoldExpiry = await hasColumn(connection, dbName, "reservations", "hold_expiry_date");
    if (!hasHoldExpiry) {
      await connection.query("ALTER TABLE reservations ADD COLUMN hold_expiry_date DATETIME NULL AFTER expiry_date").catch(() => {});
    }
    await connection.query(
      "ALTER TABLE reservations MODIFY COLUMN status ENUM('active','ready','on_hold_shelf','fulfilled','cancelled','expired') DEFAULT 'active'"
    );
  } catch (err) {
    // Ignore if already applied or error occurs
  }
}

async function ensureBookInventoryStatus(connection, dbName) {
  try {
    const hasMisplacedNotes = await hasColumn(connection, dbName, "books", "misplaced_notes");
    if (!hasMisplacedNotes) {
      await connection.query("ALTER TABLE books ADD COLUMN misplaced_notes TEXT NULL AFTER description").catch(() => {});
    }
    await connection.query(
      "ALTER TABLE books MODIFY COLUMN status ENUM('active','available','checked_out','damaged','lost','misplaced','archived') DEFAULT 'active'"
    ).catch(() => {});
  } catch (err) {
    // Ignore if already applied
  }
}

async function ensureFineStatusEnum(connection, dbName) {
  try {
    await connection.query(
      "ALTER TABLE fines MODIFY COLUMN status ENUM('pending','paid','waived','partial','disputed') DEFAULT 'pending'"
    ).catch(() => {});
    await connection.query(
      "ALTER TABLE fines MODIFY COLUMN transaction_id INT(11) NULL DEFAULT NULL"
    ).catch(() => {});
    await connection.query(
      "ALTER TABLE fines MODIFY COLUMN payment_method VARCHAR(30) NULL DEFAULT 'CASH'"
    ).catch(() => {});

    const hasTxRef = await hasColumn(connection, dbName, "fines", "transaction_reference");
    if (!hasTxRef) {
      await connection.query(
        "ALTER TABLE fines ADD COLUMN transaction_reference VARCHAR(100) NULL AFTER payment_method"
      ).catch(() => {});
    }

    const hasGwStatus = await hasColumn(connection, dbName, "fines", "payment_gateway_status");
    if (!hasGwStatus) {
      await connection.query(
        "ALTER TABLE fines ADD COLUMN payment_gateway_status VARCHAR(20) DEFAULT 'COMPLETED' AFTER transaction_reference"
      ).catch(() => {});
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fine_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fine_id INT NOT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
        transaction_reference VARCHAR(100) NULL,
        payment_gateway_status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
        receipt_notes TEXT NULL,
        collected_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fp_fine (fine_id),
        INDEX idx_fp_user (user_id),
        INDEX idx_fp_method (payment_method)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});
  } catch (err) {
    // Ignore
  }
}

async function ensureBookSuggestionsSchema(connection, dbName) {
  try {
    const hasIsbn = await hasColumn(connection, dbName, "book_suggestions", "isbn");
    if (!hasIsbn) {
      await connection.query("ALTER TABLE book_suggestions ADD COLUMN isbn VARCHAR(50) NULL AFTER author").catch(() => {});
    }
    const hasReviewedBy = await hasColumn(connection, dbName, "book_suggestions", "reviewed_by");
    if (!hasReviewedBy) {
      await connection.query("ALTER TABLE book_suggestions ADD COLUMN reviewed_by INT NULL AFTER status").catch(() => {});
    }
    await connection.query(
      "ALTER TABLE book_suggestions MODIFY COLUMN status ENUM('pending','approved','rejected','PENDING','APPROVED','REJECTED') DEFAULT 'PENDING'"
    ).catch(() => {});
  } catch (err) {
    // Ignore
  }
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
      (6, 'research_scholar', 'Doctoral researcher with direct research paper and thesis access', '{"books":["read"],"transactions":["read"],"reservations":["create","read","update"]}'),
      (7, 'clerk', 'Circulation desk clerk with checkout, return, RFID scanner, and visitor log access', '{"transactions":["create","read","update"],"rfid":["read","create"],"entry":["read","create"]}')
    ON DUPLICATE KEY UPDATE
      description = VALUES(description),
      permissions = VALUES(permissions)
  `);
}

async function ensureDefaultUsers(connection) {
  const hash = '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu';
  await connection.query(`
    INSERT INTO users (email, password, first_name, last_name, role_id, role, department, phone, status)
    VALUES
      ('admin@library.edu', '${hash}', 'Alice', 'Admin', 1, 'admin', 'Administration', '555-0001', 'active'),
      ('librarian1@library.edu', '${hash}', 'Bob', 'Librarian', 2, 'librarian', 'Library', '555-0002', 'active'),
      ('clerk@library.edu', '${hash}', 'Charlie', 'Clerk', 7, 'clerk', 'Library', '555-0004', 'active'),
      ('student1@university.edu', '${hash}', 'David', 'Student', 3, 'student', 'CSE', '555-1001', 'active')
    ON DUPLICATE KEY UPDATE
      role_id = VALUES(role_id),
      role = VALUES(role),
      department = VALUES(department),
      status = VALUES(status)
  `).catch(() => {});
}

async function ensureDatabaseReady() {
  const dbName = process.env.DB_NAME || "smart_library";

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
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
    await ensureReservationStatusEnum(connection, dbName);
    await ensureBookInventoryStatus(connection, dbName);
    await ensureFineStatusEnum(connection, dbName);
    await ensureBookSuggestionsSchema(connection, dbName);
    await ensureDefaultRoles(connection);
    await ensureDefaultUsers(connection);

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
  console.error("✗ Failed to validate database readiness:", error.stack || error);
  process.exit(1);
});
