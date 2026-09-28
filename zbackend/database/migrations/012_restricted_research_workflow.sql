-- ============================================================================
-- Migration: 012_restricted_research_workflow.sql
-- Description: Purge legacy caste/SC-ST schemes and implement Restricted Research & ME Thesis Access
-- ============================================================================

-- 1. Add research restriction flag to books
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS is_restricted_research BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrate any previously flagged titles
UPDATE books 
SET is_restricted_research = TRUE 
WHERE is_book_bank = TRUE;

-- Safely drop legacy columns from books
SET @drop_book_bank := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'is_book_bank'),
    'ALTER TABLE books DROP COLUMN is_book_bank',
    'SELECT 1'
));
PREPARE stmt FROM @drop_book_bank;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @drop_scheme_name := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'book_bank_scheme_name'),
    'ALTER TABLE books DROP COLUMN book_bank_scheme_name',
    'SELECT 1'
));
PREPARE stmt FROM @drop_scheme_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Safely drop legacy columns from users
SET @drop_community_category := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'community_category'),
    'ALTER TABLE users DROP COLUMN community_category',
    'SELECT 1'
));
PREPARE stmt FROM @drop_community_category;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @drop_bb_eligible := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_book_bank_eligible'),
    'ALTER TABLE users DROP COLUMN is_book_bank_eligible',
    'SELECT 1'
));
PREPARE stmt FROM @drop_bb_eligible;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Safely drop legacy columns from book_transactions
SET @drop_bb_loan := (SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_transactions' AND COLUMN_NAME = 'is_book_bank_loan'),
    'ALTER TABLE book_transactions DROP COLUMN is_book_bank_loan',
    'SELECT 1'
));
PREPARE stmt FROM @drop_bb_loan;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Create book_reservations table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Expand default roles with ME Students and Research Scholars
INSERT IGNORE INTO user_roles (id, role_name, description, permissions)
VALUES
    (5, 'me_student', 'Master of Engineering (PG) student with direct research thesis access', '{"books":["read"],"transactions":["read"],"reservations":["create","read","update"]}'),
    (6, 'research_scholar', 'Doctoral researcher with direct research paper and thesis access', '{"books":["read"],"transactions":["read"],"reservations":["create","read","update"]}');
