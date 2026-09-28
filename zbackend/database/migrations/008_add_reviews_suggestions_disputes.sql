-- Migration 008: Reviews, purchase suggestions, and transaction disputes

CREATE TABLE IF NOT EXISTS book_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    user_id INT NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    review_text VARCHAR(1000) NULL,
    status ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_book_review_user (book_id, user_id),
    INDEX idx_book_reviews_book (book_id),
    CONSTRAINT fk_book_reviews_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    CONSTRAINT fk_book_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requested_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NULL,
    isbn VARCHAR(30) NULL,
    department VARCHAR(100) NULL,
    justification VARCHAR(1000) NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    review_notes VARCHAR(1000) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_purchase_suggestions_status (status),
    CONSTRAINT fk_purchase_suggestions_requester FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_purchase_suggestions_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transaction_disputes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    raised_by INT NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    status ENUM('open', 'investigating', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
    resolution_notes VARCHAR(1000) NULL,
    resolved_by INT NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_transaction_disputes_status (status),
    CONSTRAINT fk_transaction_disputes_transaction FOREIGN KEY (transaction_id) REFERENCES book_transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_disputes_raiser FOREIGN KEY (raised_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_disputes_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
