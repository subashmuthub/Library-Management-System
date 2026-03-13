-- Add payment_receipts table for storing payment history

CREATE TABLE IF NOT EXISTS payment_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_id VARCHAR(100) UNIQUE NOT NULL,
    fine_id INT NOT NULL,
    user_id INT NOT NULL,
    transaction_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50) NULL COMMENT 'GPay, PhonePe, Paytm, etc',
    payment_reference VARCHAR(255) NULL,
    receipt_data JSON NULL COMMENT 'Complete receipt information',
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
