-- ============================================================================
-- Migration 004: New Modules — Recommendations, Overdue Alerts, QR Locator, Heatmap
-- Safe to run on existing smart_library schema.
-- Uses IF NOT EXISTS / safe ALTER patterns to never break existing tables.
-- ============================================================================

USE smart_library;

-- ── 1. RECOMMENDATION ENGINE ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recommendation_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    book_id         INT NOT NULL,
    score           INT NOT NULL DEFAULT 0,
    reason          VARCHAR(255) NULL,
    was_borrowed    BOOLEAN DEFAULT FALSE COMMENT 'Did user borrow after recommendation?',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_user_id   (user_id),
    INDEX idx_created   (created_at)
) ENGINE=InnoDB COMMENT='Tracks which books were recommended and if borrowed';

CREATE TABLE IF NOT EXISTS popular_books_cache (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    book_id         INT NOT NULL UNIQUE,
    borrow_count    INT DEFAULT 0,
    score           INT DEFAULT 0,
    last_updated    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_score (score DESC)
) ENGINE=InnoDB COMMENT='Cached popularity scores refreshed periodically';

-- ── 2. OVERDUE ALERT SYSTEM ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_logs (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    transaction_id      INT NULL,
    notification_type   ENUM('overdue_alert','due_soon','fine_added','system') DEFAULT 'overdue_alert',
    title               VARCHAR(255) NOT NULL,
    message             TEXT NOT NULL,
    is_read             BOOLEAN DEFAULT FALSE,
    fine_amount         DECIMAL(10,2) DEFAULT 0.00,
    days_overdue        INT DEFAULT 0,
    sent_via_email      BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES book_transactions(id) ON DELETE SET NULL,
    INDEX idx_user_unread   (user_id, is_read),
    INDEX idx_created       (created_at DESC)
) ENGINE=InnoDB COMMENT='In-app and email notification log';

CREATE TABLE IF NOT EXISTS overdue_alert_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id  INT NOT NULL,
    user_id         INT NOT NULL,
    book_id         INT NOT NULL,
    days_overdue    INT NOT NULL,
    fine_snapshot   DECIMAL(10,2) DEFAULT 0.00,
    alert_sent_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES book_transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_transaction   (transaction_id),
    INDEX idx_alert_date    (alert_sent_at DESC)
) ENGINE=InnoDB COMMENT='History of every overdue alert fired';

-- ── 3. QR SHELF LOCATOR ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS library_shelves_extended (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    shelf_code      VARCHAR(20) NOT NULL UNIQUE,
    floor           TINYINT NOT NULL DEFAULT 1,
    rack            VARCHAR(20) NULL,
    section         VARCHAR(100) NULL,
    description     TEXT NULL,
    qr_value        VARCHAR(500) NULL COMMENT 'Encoded QR payload (JSON string)',
    coord_x         DECIMAL(5,2) NULL COMMENT 'SVG map X position (0-100)',
    coord_y         DECIMAL(5,2) NULL COMMENT 'SVG map Y position (0-100)',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shelf_code (shelf_code),
    INDEX idx_floor      (floor)
) ENGINE=InnoDB COMMENT='Extended shelf metadata for QR Locator';

-- Seed demo shelves if table is fresh
INSERT IGNORE INTO library_shelves_extended (shelf_code, floor, rack, section, description, coord_x, coord_y) VALUES
('A1', 1, 'R1', 'Computer Science',  'CS fundamentals, programming basics',  15, 20),
('A2', 1, 'R2', 'Computer Science',  'Data structures & algorithms',         30, 20),
('A3', 1, 'R3', 'Computer Science',  'Networking & OS',                      45, 20),
('B1', 1, 'R4', 'Mathematics',       'Calculus, linear algebra',             15, 45),
('B2', 1, 'R5', 'Mathematics',       'Statistics & probability',             30, 45),
('B3', 1, 'R6', 'Physics',           'Mechanics & thermodynamics',           45, 45),
('C1', 1, 'R7', 'Fiction',           'Classic novels',                       15, 70),
('C2', 1, 'R8', 'Self-Help',         'Personal development',                 30, 70),
('C3', 1, 'R9', 'History',           'World history & biographies',          45, 70),
('D1', 2, 'R1', 'Reference',         'Encyclopedias & dictionaries',         15, 20),
('D2', 2, 'R2', 'Research',          'Journals & research papers',           30, 20),
('D3', 2, 'R3', 'Technology',        'AI, ML, Data Science',                 45, 20);

-- ── 4. HEATMAP ANALYTICS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shelf_activity_stats (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    shelf_code      VARCHAR(20) NOT NULL,
    activity_date   DATE NOT NULL,
    scan_count      INT DEFAULT 0,
    borrow_count    INT DEFAULT 0,
    return_count    INT DEFAULT 0,
    search_count    INT DEFAULT 0,
    popularity_score INT GENERATED ALWAYS AS (
        (scan_count * 2) + (borrow_count * 5) + (return_count * 3) + (search_count * 1)
    ) STORED,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_shelf_date (shelf_code, activity_date),
    INDEX idx_date       (activity_date DESC),
    INDEX idx_score      (popularity_score DESC)
) ENGINE=InnoDB COMMENT='Daily heatmap statistics per shelf';

-- Seed 30 days of demo heatmap data
INSERT IGNORE INTO shelf_activity_stats (shelf_code, activity_date, scan_count, borrow_count, return_count, search_count)
SELECT 
    s.shelf_code,
    DATE_SUB(CURDATE(), INTERVAL n.n DAY) AS activity_date,
    FLOOR(RAND() * 40 + 5)  AS scan_count,
    FLOOR(RAND() * 25 + 2)  AS borrow_count,
    FLOOR(RAND() * 20 + 1)  AS return_count,
    FLOOR(RAND() * 60 + 10) AS search_count
FROM library_shelves_extended s
CROSS JOIN (
    SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
    UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
    UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
    UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
    UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
) n;
