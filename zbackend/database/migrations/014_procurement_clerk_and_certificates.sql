-- ============================================================================
-- Migration 014: Procurement, Clerk RBAC, Resource Types & Student Certificates
-- Non-destructive: Safe to run multiple times without data loss or duplicate errors.
-- ============================================================================

USE smart_library;

-- ── 1. UPDATE EXISTING books TABLE WITH RESOURCE METADATA ───────────────────

-- Add resource_type ('BOOK', 'RESEARCH_PAPER', 'JOURNAL')
SET @sql_resource_type := (SELECT IF(
    NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'resource_type'),
    'ALTER TABLE books ADD COLUMN resource_type VARCHAR(30) NOT NULL DEFAULT \'BOOK\' AFTER title',
    'SELECT 1'
));
PREPARE stmt FROM @sql_resource_type;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add doi
SET @sql_doi := (SELECT IF(
    NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'doi'),
    'ALTER TABLE books ADD COLUMN doi VARCHAR(100) NULL AFTER isbn',
    'SELECT 1'
));
PREPARE stmt FROM @sql_doi;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add volume_issue
SET @sql_volume_issue := (SELECT IF(
    NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'volume_issue'),
    'ALTER TABLE books ADD COLUMN volume_issue VARCHAR(50) NULL AFTER edition',
    'SELECT 1'
));
PREPARE stmt FROM @sql_volume_issue;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add publication_date
SET @sql_pub_date := (SELECT IF(
    NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'publication_date'),
    'ALTER TABLE books ADD COLUMN publication_date DATE NULL AFTER publication_year',
    'SELECT 1'
));
PREPARE stmt FROM @sql_pub_date;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on resource_type if not exists
SET @sql_idx_res_type := (SELECT IF(
    NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND INDEX_NAME = 'idx_books_resource_type'),
    'ALTER TABLE books ADD INDEX idx_books_resource_type (resource_type)',
    'SELECT 1'
));
PREPARE stmt FROM @sql_idx_res_type;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate legacy type values ('journal' -> 'JOURNAL', 'book' -> 'BOOK')
UPDATE books 
SET resource_type = 'JOURNAL' 
WHERE (resource_type IS NULL OR resource_type = 'BOOK') 
  AND (category LIKE '%Journal%' OR category LIKE '%Research%' OR (doi IS NOT NULL AND doi != ''));

-- ── 2. SUPPORT 'clerk' ROLE IN user_roles ───────────────────────────────────

INSERT INTO user_roles (id, role_name, description, permissions)
VALUES (
    7,
    'clerk',
    'Circulation desk clerk with checkout, return, RFID scanner, and visitor log access',
    '{"transactions":["create","read","update"],"rfid":["read","create"],"entry":["read","create"]}'
)
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    permissions = VALUES(permissions);

-- ── 3. CREATE PROCUREMENT TABLES ────────────────────────────────────────────

-- 3a. Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    contact_person  VARCHAR(255) NULL,
    email           VARCHAR(255) NULL,
    phone           VARCHAR(50) NULL,
    address         TEXT NULL,
    gst_number      VARCHAR(50) NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vendor_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Book and journal procurement vendors';

-- 3b. Library Budgets Table
CREATE TABLE IF NOT EXISTS library_budgets (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    financial_year      VARCHAR(20) NOT NULL UNIQUE COMMENT 'Format: 2026-2027 or 2026',
    allocated_budget    DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    spent_budget        DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fin_year (financial_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Annual library procurement budgets';

-- 3c. Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id       INT NOT NULL,
    invoice_no      VARCHAR(100) NOT NULL,
    purchase_date   DATE NOT NULL,
    total_amount    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    allocated_year  VARCHAR(20) NOT NULL,
    payment_status  ENUM('PENDING', 'PAID', 'PARTIAL', 'CANCELLED') NOT NULL DEFAULT 'PAID',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
    INDEX idx_purchase_vendor (vendor_id),
    INDEX idx_purchase_invoice (invoice_no),
    INDEX idx_purchase_date (purchase_date),
    INDEX idx_purchase_year (allocated_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Procurement purchase orders';

-- 3d. Purchase Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id     INT NOT NULL,
    item_title      VARCHAR(500) NOT NULL,
    resource_type   VARCHAR(30) NOT NULL DEFAULT 'BOOK',
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    subtotal        DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    INDEX idx_item_purchase (purchase_id),
    INDEX idx_item_resource (resource_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Individual line items in a procurement order';

-- ── 4. CREATE STUDENT CERTIFICATES TABLE ────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_certificates (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    month_year          VARCHAR(50) NOT NULL COMMENT 'e.g. October 2026',
    books_read_count    INT NOT NULL DEFAULT 0,
    certificate_id      VARCHAR(100) NOT NULL UNIQUE COMMENT 'e.g. CERT-202610-STU001-A9B2',
    issued_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_month_cert (user_id, month_year),
    INDEX idx_cert_code (certificate_id),
    INDEX idx_cert_month (month_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Top reader student monthly achievement certificates';

-- ── 5. SEED INITIAL SAMPLE VENDOR & BUDGET (IDEMPOTENT) ─────────────────────

INSERT IGNORE INTO vendors (id, name, contact_person, email, phone, address, gst_number)
VALUES 
(1, 'Academic Book Distributors Pvt Ltd', 'Rajesh Sharma', 'orders@academicbooks.in', '+91-9840123456', '42 College Road, Chennai 600034', '33AABCA1234F1Z5'),
(2, 'Global Research Press & Periodicals', 'Ananya Roy', 'subscriptions@globalresearch.org', '+91-9884567890', '18 Science Park, Bengaluru 560012', '29AABCG5678G2Z3'),
(3, 'National Book Depot', 'V. Venkatesh', 'contact@nationalbooks.com', '+91-9444098765', '10 Mount Road, Chennai 600002', '33AABCN9012H3Z1');

INSERT INTO library_budgets (financial_year, allocated_budget, spent_budget)
VALUES ('2026-2027', 1500000.00, 0.00)
ON DUPLICATE KEY UPDATE allocated_budget = VALUES(allocated_budget);

COMMIT;
