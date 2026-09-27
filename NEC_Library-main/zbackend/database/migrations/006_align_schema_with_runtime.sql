-- ============================================================================
-- Migration: Align runtime schema expectations with current controllers
-- Date: March 12, 2026
-- Description: Add compatibility columns/tables used by current controllers/pages
-- ============================================================================

USE smart_library;

ALTER TABLE books
ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER is_available;

ALTER TABLE readers
ADD COLUMN last_scan_count INT NOT NULL DEFAULT 0 AFTER last_seen,
ADD COLUMN last_scan_timestamp TIMESTAMP NULL AFTER last_scan_count;

ALTER TABLE book_transactions
ADD COLUMN checked_out_by INT NULL AFTER book_id,
ADD COLUMN returned_by INT NULL AFTER issued_by,
ADD COLUMN renewal_count INT NOT NULL DEFAULT 0 AFTER renewed_count;

ALTER TABLE book_transactions
ADD CONSTRAINT fk_book_transactions_checked_out_by
FOREIGN KEY (checked_out_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE book_transactions
ADD CONSTRAINT fk_book_transactions_returned_by
FOREIGN KEY (returned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reservations
ADD COLUMN scheduled_date DATETIME NULL AFTER reservation_date,
ADD COLUMN pickup_date DATETIME NULL AFTER fulfilled_date,
ADD COLUMN fulfilled_by INT NULL AFTER cancelled_by;

ALTER TABLE reservations
ADD CONSTRAINT fk_reservations_fulfilled_by
FOREIGN KEY (fulfilled_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS payment_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_id VARCHAR(100) UNIQUE NOT NULL,
    fine_id INT NOT NULL,
    user_id INT NOT NULL,
    transaction_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50) NULL,
    payment_reference VARCHAR(255) NULL,
    receipt_data JSON NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fine_id) REFERENCES fines(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES book_transactions(id) ON DELETE CASCADE,
    INDEX idx_fine_id (fine_id),
    INDEX idx_user_id (user_id),
    INDEX idx_receipt_id (receipt_id),
    INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB COMMENT='Payment receipts and history';

UPDATE book_transactions
SET checked_out_by = COALESCE(checked_out_by, issued_by),
    returned_by = COALESCE(returned_by, returned_to),
    renewal_count = COALESCE(NULLIF(renewal_count, 0), renewed_count, 0);
