-- ============================================================================
-- Smart Library Automation System - Database Schema
-- ============================================================================
-- Created: February 5, 2026
-- Database: MySQL 8.0+
--
-- DESIGN PRINCIPLES:
-- 1. Normalized to 3NF (Third Normal Form)
-- 2. Proper indexing for performance
-- 3. Foreign key constraints for data integrity
-- 4. Timestamp tracking for audit trails
-- 5. Enum types for controlled values
-- ============================================================================

-- Drop existing database if exists (use with caution in production!)
DROP DATABASE IF EXISTS smart_library;
CREATE DATABASE smart_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_library;

-- ============================================================================
-- TABLE: user_roles
-- Defines user role types and permissions
-- ============================================================================
CREATE TABLE user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    permissions JSON NULL COMMENT 'Role-specific permissions',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='User roles and permissions';

-- ============================================================================
-- TABLE: users
-- Stores all system users (students, librarians, admins)
-- ============================================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role_id INT NOT NULL DEFAULT 3,
    student_id VARCHAR(50) UNIQUE NULL,
    phone VARCHAR(20) NULL,
    address TEXT NULL,
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    force_password_change BOOLEAN DEFAULT FALSE,
    password_changed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (role_id) REFERENCES user_roles(id),
    INDEX idx_email (email),
    INDEX idx_student_id (student_id),
    INDEX idx_role (role_id),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='System users with role-based access';

-- ============================================================================
-- TABLE: user_activity_log
-- Tracks user activity and administrative actions
-- ============================================================================
CREATE TABLE user_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL COMMENT 'Type of action performed',
    details TEXT NULL COMMENT 'Additional details about the action',
    ip_address VARCHAR(45) NULL COMMENT 'IP address of the action',
    user_agent VARCHAR(500) NULL COMMENT 'User agent string',
    created_by INT NULL COMMENT 'User who performed the action (for admin actions)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_activity (user_id, created_at DESC),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB COMMENT='User activity and administrative action log';

-- ============================================================================
-- TABLE: entry_logs
-- Tracks student entry/exit with confidence scoring
-- WHY: Immutable audit trail of all entry/exit events
-- ============================================================================
CREATE TABLE entry_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    entry_type ENUM('entry', 'exit') NOT NULL,
    
    -- GPS data
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Validation signals
    wifi_ssid VARCHAR(100) NULL COMMENT 'Detected Wi-Fi network',
    speed_kmh DECIMAL(5, 2) NULL COMMENT 'Device speed in km/h',
    
    -- Confidence scoring
    confidence_score TINYINT NOT NULL COMMENT 'Entry confidence (0-100)',
    gps_confidence TINYINT NOT NULL COMMENT 'GPS signal contribution (0-40)',
    wifi_confidence TINYINT NOT NULL COMMENT 'Wi-Fi signal contribution (0-40)',
    motion_confidence TINYINT NOT NULL COMMENT 'Motion signal contribution (0-20)',
    
    -- Entry status
    auto_logged BOOLEAN DEFAULT FALSE COMMENT 'TRUE if confidence >= 80',
    manual_confirmed BOOLEAN DEFAULT FALSE COMMENT 'TRUE if user confirmed manually',
    
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_timestamp (user_id, timestamp),
    INDEX idx_entry_type (entry_type),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB COMMENT='Student entry/exit audit trail with confidence scoring';

-- ============================================================================
-- TABLE: books
-- Library catalog with book metadata
-- ============================================================================
CREATE TABLE books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    isbn VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    publisher VARCHAR(255) NULL,
    publication_year YEAR NULL,
    category VARCHAR(100) NULL,
    edition VARCHAR(50) NULL,
    language VARCHAR(50) DEFAULT 'English',
    pages INT NULL,
    description TEXT NULL,
    cover_image_url VARCHAR(500) NULL,
    total_copies INT DEFAULT 1 COMMENT 'Total number of copies available',
    is_available BOOLEAN DEFAULT TRUE COMMENT 'FALSE if book is checked out',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_isbn (isbn),
    INDEX idx_title (title(255)),
    INDEX idx_author (author),
    INDEX idx_category (category),
    FULLTEXT idx_search (title, author, description)
) ENGINE=InnoDB COMMENT='Library book catalog';

-- ============================================================================
-- TABLE: rfid_tags
-- Maps RFID tag IDs to books (one-to-one relationship)
-- WHY SEPARATE TABLE: Tag can be replaced without changing book record
-- ============================================================================
CREATE TABLE rfid_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tag_id VARCHAR(100) UNIQUE NOT NULL COMMENT 'Unique RFID tag identifier',
    book_id INT UNIQUE NOT NULL COMMENT 'One tag per book',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE COMMENT 'FALSE if tag is damaged/replaced',
    
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_tag_id (tag_id),
    INDEX idx_book_id (book_id)
) ENGINE=InnoDB COMMENT='RFID tag registry';

-- ============================================================================
-- TABLE: shelves
-- Physical shelf locations in the library
-- ============================================================================
CREATE TABLE shelves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shelf_code VARCHAR(20) UNIQUE NOT NULL COMMENT 'Human-readable identifier (e.g., A1, B2)',
    zone VARCHAR(10) NOT NULL COMMENT 'Zone for navigation (e.g., A, B, C)',
    floor INT NOT NULL DEFAULT 1,
    section VARCHAR(100) NULL COMMENT 'Library section (e.g., Fiction, Science)',
    capacity INT DEFAULT 100 COMMENT 'Maximum books',
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_shelf_code (shelf_code),
    INDEX idx_zone (zone)
) ENGINE=InnoDB COMMENT='Physical shelf locations';

-- ============================================================================
-- TABLE: readers
-- RFID reader hardware registry
-- WHY: Abstracts hardware from software logic
-- ============================================================================
CREATE TABLE readers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reader_code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Hardware identifier',
    reader_type ENUM('handheld', 'fixed') NOT NULL,
    shelf_id INT NULL COMMENT 'NULL for handheld, REQUIRED for fixed readers',
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP NULL COMMENT 'Last communication timestamp',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE SET NULL,
    INDEX idx_reader_code (reader_code),
    INDEX idx_shelf_id (shelf_id)
) ENGINE=InnoDB COMMENT='RFID reader hardware registry';

-- ============================================================================
-- TABLE: beacons
-- BLE beacon registry for indoor navigation
-- ============================================================================
CREATE TABLE beacons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    beacon_uuid VARCHAR(36) UNIQUE NOT NULL COMMENT 'Standard UUID format',
    major INT NOT NULL COMMENT 'iBeacon major value',
    minor INT NOT NULL COMMENT 'iBeacon minor value',
    zone VARCHAR(10) NOT NULL COMMENT 'Maps to shelf zone',
    location_description VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    battery_level TINYINT NULL COMMENT 'Percentage (0-100)',
    last_seen TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_beacon (beacon_uuid, major, minor),
    INDEX idx_zone (zone)
) ENGINE=InnoDB COMMENT='BLE beacon registry for indoor positioning';

-- ============================================================================
-- TABLE: book_location_history
-- Time-series data tracking book movements
-- WHY HISTORY TABLE: Audit trail + analytics without bloating books table
-- ============================================================================
CREATE TABLE book_location_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    shelf_id INT NOT NULL,
    reader_id INT NULL COMMENT 'NULL for manual entries',
    scanned_by INT NULL COMMENT 'User who performed scan (librarian)',
    scan_method ENUM('rfid', 'manual', 'system') DEFAULT 'rfid',
    
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE CASCADE,
    FOREIGN KEY (reader_id) REFERENCES readers(id) ON DELETE SET NULL,
    FOREIGN KEY (scanned_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_book_timestamp (book_id, timestamp DESC),
    INDEX idx_shelf_timestamp (shelf_id, timestamp),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB COMMENT='Book location audit trail';

-- ============================================================================
-- VIEW: current_book_locations
-- Fast lookup for current book locations (latest scan per book)
-- WHY VIEW: Abstracts complex query, improves performance
-- ============================================================================
CREATE VIEW current_book_locations AS
SELECT 
    blh.book_id,
    b.isbn,
    b.title,
    b.author,
    blh.shelf_id,
    s.shelf_code,
    s.zone,
    s.section,
    blh.timestamp AS last_scanned
FROM book_location_history blh
INNER JOIN books b ON blh.book_id = b.id
INNER JOIN shelves s ON blh.shelf_id = s.id
INNER JOIN (
    SELECT book_id, MAX(timestamp) AS max_timestamp
    FROM book_location_history
    GROUP BY book_id
) latest ON blh.book_id = latest.book_id AND blh.timestamp = latest.max_timestamp;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- These indexes are created above with table definitions, but documented here:
-- 
-- users: email, student_id, role
-- entry_logs: user_id + timestamp (composite), entry_type, timestamp
-- books: isbn, title, author, category, FULLTEXT(title, author, description)
-- rfid_tags: tag_id, book_id
-- shelves: shelf_code, zone
-- readers: reader_code, shelf_id
-- beacons: zone
-- book_location_history: book_id + timestamp DESC (composite), shelf_id + timestamp, timestamp
--
-- WHY THESE INDEXES:
-- - Composite index on (book_id, timestamp DESC) allows fast "latest location" queries
-- - FULLTEXT index on books enables efficient search
-- - Foreign keys are automatically indexed by InnoDB

-- ============================================================================
-- STORED PROCEDURE: get_current_book_location
-- Efficiently retrieves the current location of a book
-- ============================================================================
DELIMITER //
CREATE PROCEDURE get_current_book_location(IN p_book_id INT)
BEGIN
    SELECT 
        blh.book_id,
        b.isbn,
        b.title,
        b.author,
        blh.shelf_id,
        s.shelf_code,
        s.zone,
        s.section,
        blh.timestamp AS last_scanned
    FROM book_location_history blh
    INNER JOIN books b ON blh.book_id = b.id
    INNER JOIN shelves s ON blh.shelf_id = s.id
    WHERE blh.book_id = p_book_id
    ORDER BY blh.timestamp DESC
    LIMIT 1;
END //
DELIMITER ;

-- ============================================================================
-- STORED PROCEDURE: calculate_entry_confidence
-- Implements the hybrid GPS entry confidence algorithm
-- ============================================================================
DELIMITER //
CREATE PROCEDURE calculate_entry_confidence(
    IN p_user_id INT,
    IN p_latitude DECIMAL(10,8),
    IN p_longitude DECIMAL(11,8),
    IN p_wifi_ssid VARCHAR(100),
    IN p_speed_kmh DECIMAL(5,2),
    IN p_manual_confirm BOOLEAN,
    OUT p_confidence_score TINYINT,
    OUT p_gps_confidence TINYINT,
    OUT p_wifi_confidence TINYINT,
    OUT p_motion_confidence TINYINT,
    OUT p_auto_logged BOOLEAN
)
BEGIN
    DECLARE v_library_lat DECIMAL(10,8);
    DECLARE v_library_lng DECIMAL(11,8);
    DECLARE v_library_wifi VARCHAR(100);
    DECLARE v_gps_threshold DECIMAL(10,2);
    DECLARE v_speed_threshold DECIMAL(5,2);
    DECLARE v_distance_km DECIMAL(10,4);
    
    -- Get library configuration (from environment - hardcoded for demo)
    SET v_library_lat = 37.7749;
    SET v_library_lng = -122.4194;
    SET v_library_wifi = 'LibraryWiFi';
    SET v_gps_threshold = 0.05; -- 50 meters in km
    SET v_speed_threshold = 5.0; -- 5 km/h
    
    -- Initialize confidence scores
    SET p_gps_confidence = 0;
    SET p_wifi_confidence = 0;
    SET p_motion_confidence = 0;
    
    -- Calculate GPS distance using Haversine formula (simplified)
    -- In production, use proper geospatial functions
    SET v_distance_km = SQRT(
        POW(69.1 * (p_latitude - v_library_lat), 2) +
        POW(69.1 * (p_longitude - v_library_lng) * COS(v_library_lat / 57.3), 2)
    ) * 1.60934;
    
    -- GPS confidence (40 points max)
    IF v_distance_km < v_gps_threshold THEN
        SET p_gps_confidence = 40;
    ELSEIF v_distance_km < v_gps_threshold * 2 THEN
        SET p_gps_confidence = 20;
    END IF;
    
    -- Wi-Fi confidence (40 points max)
    IF p_wifi_ssid = v_library_wifi THEN
        SET p_wifi_confidence = 40;
    END IF;
    
    -- Motion confidence (20 points max)
    IF p_speed_kmh IS NOT NULL AND p_speed_kmh < v_speed_threshold THEN
        SET p_motion_confidence = 20;
    ELSEIF p_speed_kmh IS NULL THEN
        SET p_motion_confidence = 10; -- Partial credit if no speed data
    END IF;
    
    -- Total confidence
    SET p_confidence_score = p_gps_confidence + p_wifi_confidence + p_motion_confidence;
    
    -- Auto-log decision
    IF p_confidence_score >= 80 THEN
        SET p_auto_logged = TRUE;
    ELSEIF p_confidence_score >= 50 AND p_manual_confirm = TRUE THEN
        SET p_auto_logged = TRUE;
    ELSE
        SET p_auto_logged = FALSE;
    END IF;
END //
DELIMITER ;

-- ============================================================================
-- TABLE: book_transactions
-- Tracks book checkouts and returns with dates
-- ============================================================================
CREATE TABLE book_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    transaction_type ENUM('checkout', 'return', 'renew') NOT NULL,
    checkout_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE NULL,
    renewed_count INT DEFAULT 0 COMMENT 'Number of times renewed',
    status ENUM('active', 'returned', 'overdue', 'lost') DEFAULT 'active',
    issued_by INT NULL COMMENT 'Librarian who issued the book',
    returned_to INT NULL COMMENT 'Librarian who processed return',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (returned_to) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_book_status (book_id, status),
    INDEX idx_due_date (due_date),
    INDEX idx_checkout_date (checkout_date)
) ENGINE=InnoDB COMMENT='Book checkout and return transactions';

-- ============================================================================
-- TABLE: fines
-- Manages overdue fines and payments
-- ============================================================================
CREATE TABLE fines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    transaction_id INT NOT NULL COMMENT 'Related book transaction',
    fine_type ENUM('overdue', 'damage', 'lost_book', 'other') DEFAULT 'overdue',
    amount DECIMAL(10, 2) NOT NULL,
    days_overdue INT DEFAULT 0,
    fine_rate DECIMAL(5, 2) DEFAULT 1.00 COMMENT 'Fine per day',
    status ENUM('pending', 'paid', 'waived', 'partial') DEFAULT 'pending',
    amount_paid DECIMAL(10, 2) DEFAULT 0.00,
    payment_date DATE NULL,
    payment_method ENUM('cash', 'card', 'online', 'waived') NULL,
    processed_by INT NULL COMMENT 'Librarian who processed payment',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES book_transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='Library fines and payments';

-- ============================================================================
-- TABLE: reservations
-- Book reservation queue system
-- ============================================================================
CREATE TABLE reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    reservation_date DATE NOT NULL,
    expiry_date DATE NOT NULL COMMENT 'Reservation expires after 7 days when book becomes available',
    status ENUM('active', 'fulfilled', 'cancelled', 'expired') DEFAULT 'active',
    queue_position INT DEFAULT 1 COMMENT 'Position in reservation queue',
    notified_date DATE NULL COMMENT 'Date when user was notified book is available',
    fulfilled_date DATE NULL,
    cancelled_by INT NULL COMMENT 'User or librarian who cancelled',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_book_status (book_id, status),
    INDEX idx_queue_position (book_id, queue_position),
    INDEX idx_reservation_date (reservation_date)
) ENGINE=InnoDB COMMENT='Book reservation system';

-- ============================================================================
-- TABLE: book_categories
-- Normalized book categories for better organization
-- ============================================================================
CREATE TABLE book_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NULL,
    parent_category_id INT NULL COMMENT 'For hierarchical categories',
    dewey_decimal VARCHAR(10) NULL COMMENT 'Dewey Decimal Classification',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_category_id) REFERENCES book_categories(id) ON DELETE SET NULL,
    INDEX idx_name (name),
    INDEX idx_parent (parent_category_id)
) ENGINE=InnoDB COMMENT='Book category hierarchy';

-- ============================================================================
-- TABLE: library_settings
-- System configuration and rules
-- ============================================================================
CREATE TABLE library_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT NULL,
    category ENUM('general', 'fines', 'circulation', 'notifications') DEFAULT 'general',
    data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category (category)
) ENGINE=InnoDB COMMENT='Library system settings and configuration';

-- ============================================================================
-- VIEWS FOR LIBRARY MANAGEMENT
-- ============================================================================

-- Active checkouts with user and book details
CREATE VIEW active_checkouts AS
SELECT 
    bt.id as transaction_id,
    bt.user_id,
    CONCAT(u.first_name, ' ', u.last_name) as user_name,
    u.email,
    u.student_id,
    bt.book_id,
    b.title,
    b.author,
    b.isbn,
    bt.checkout_date,
    bt.due_date,
    bt.renewed_count,
    CASE 
        WHEN bt.due_date < CURDATE() THEN 'overdue'
        WHEN bt.due_date = CURDATE() THEN 'due_today'
        ELSE 'active'
    END as checkout_status,
    DATEDIFF(CURDATE(), bt.due_date) as days_overdue
FROM book_transactions bt
JOIN users u ON bt.user_id = u.id
JOIN books b ON bt.book_id = b.id
WHERE bt.status = 'active';

-- Overdue books with fine calculations
CREATE VIEW overdue_books AS
SELECT 
    ac.*,
    GREATEST(ac.days_overdue * 1.00, 0) as calculated_fine
FROM active_checkouts ac
WHERE ac.checkout_status = 'overdue';

-- Available books (not currently checked out)
CREATE VIEW available_books AS
SELECT 
    b.*,
    cbl.shelf_code,
    cbl.zone,
    cbl.section,
    cbl.last_scanned,
    CASE 
        WHEN r.id IS NOT NULL THEN 'reserved'
        ELSE 'available'
    END as availability_status,
    COUNT(r.id) as reservation_count
FROM books b
LEFT JOIN current_book_locations cbl ON b.id = cbl.book_id
LEFT JOIN book_transactions bt ON b.id = bt.book_id AND bt.status = 'active'
LEFT JOIN reservations r ON b.id = r.book_id AND r.status = 'active'
WHERE bt.id IS NULL AND b.is_available = TRUE
GROUP BY b.id;

-- User library statistics
CREATE VIEW user_library_stats AS
SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.email,
    u.student_id,
    COUNT(DISTINCT CASE WHEN bt.status = 'active' THEN bt.id END) as active_checkouts,
    COUNT(DISTINCT CASE WHEN bt.status = 'returned' THEN bt.id END) as returned_books,
    COUNT(DISTINCT CASE WHEN f.status = 'pending' THEN f.id END) as pending_fines,
    COALESCE(SUM(CASE WHEN f.status = 'pending' THEN f.amount END), 0) as total_fine_amount,
    COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_reservations
FROM users u
LEFT JOIN book_transactions bt ON u.id = bt.user_id
LEFT JOIN fines f ON u.id = f.user_id
LEFT JOIN reservations r ON u.id = r.user_id
WHERE u.role = 'student'
GROUP BY u.id;

-- ============================================================================
-- STORED PROCEDURES FOR LIBRARY OPERATIONS
-- ============================================================================

-- Check out a book
DELIMITER //
CREATE PROCEDURE checkout_book(
    IN p_user_id INT,
    IN p_book_id INT,
    IN p_issued_by INT,
    IN p_loan_days INT DEFAULT 14,
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_is_available BOOLEAN DEFAULT FALSE;
    DECLARE v_user_checkout_count INT DEFAULT 0;
    DECLARE v_max_checkouts INT DEFAULT 5;
    DECLARE v_has_overdue BOOLEAN DEFAULT FALSE;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_success = FALSE;
        SET p_message = 'Database error occurred';
    END;
    
    START TRANSACTION;
    
    -- Check if book is available
    SELECT COUNT(*) = 0 INTO v_is_available
    FROM book_transactions 
    WHERE book_id = p_book_id AND status = 'active';
    
    IF NOT v_is_available THEN
        SET p_success = FALSE;
        SET p_message = 'Book is currently checked out';
        ROLLBACK;
    ELSE
        -- Check user's current checkout count
        SELECT COUNT(*) INTO v_user_checkout_count
        FROM book_transactions 
        WHERE user_id = p_user_id AND status = 'active';
        
        -- Check for overdue books
        SELECT COUNT(*) > 0 INTO v_has_overdue
        FROM book_transactions
        WHERE user_id = p_user_id AND status = 'active' AND due_date < CURDATE();
        
        IF v_user_checkout_count >= v_max_checkouts THEN
            SET p_success = FALSE;
            SET p_message = 'Maximum checkout limit reached';
            ROLLBACK;
        ELSEIF v_has_overdue THEN
            SET p_success = FALSE;
            SET p_message = 'Cannot checkout: You have overdue books';
            ROLLBACK;
        ELSE
            -- Create checkout transaction
            INSERT INTO book_transactions (
                user_id, book_id, transaction_type, checkout_date, due_date, issued_by
            ) VALUES (
                p_user_id, p_book_id, 'checkout', CURDATE(), DATE_ADD(CURDATE(), INTERVAL p_loan_days DAY), p_issued_by
            );
            
            -- Update book availability
            UPDATE books SET is_available = FALSE WHERE id = p_book_id;
            
            SET p_success = TRUE;
            SET p_message = 'Book checked out successfully';
            COMMIT;
        END IF;
    END IF;
END //
DELIMITER ;

-- Return a book
DELIMITER //
CREATE PROCEDURE return_book(
    IN p_transaction_id INT,
    IN p_returned_to INT,
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(255),
    OUT p_fine_amount DECIMAL(10,2)
)
BEGIN
    DECLARE v_book_id INT;
    DECLARE v_user_id INT;
    DECLARE v_due_date DATE;
    DECLARE v_days_overdue INT DEFAULT 0;
    DECLARE v_fine_rate DECIMAL(5,2) DEFAULT 1.00;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_success = FALSE;
        SET p_message = 'Database error occurred';
    END;
    
    START TRANSACTION;
    
    -- Get transaction details
    SELECT book_id, user_id, due_date 
    INTO v_book_id, v_user_id, v_due_date
    FROM book_transactions 
    WHERE id = p_transaction_id AND status = 'active';
    
    IF v_book_id IS NULL THEN
        SET p_success = FALSE;
        SET p_message = 'Invalid transaction or book already returned';
        ROLLBACK;
    ELSE
        -- Calculate overdue days and fine
        SET v_days_overdue = GREATEST(DATEDIFF(CURDATE(), v_due_date), 0);
        SET p_fine_amount = v_days_overdue * v_fine_rate;
        
        -- Update transaction
        UPDATE book_transactions 
        SET status = 'returned', return_date = CURDATE(), returned_to = p_returned_to
        WHERE id = p_transaction_id;
        
        -- Update book availability
        UPDATE books SET is_available = TRUE WHERE id = v_book_id;
        
        -- Create fine if overdue
        IF p_fine_amount > 0 THEN
            INSERT INTO fines (
                user_id, transaction_id, fine_type, amount, days_overdue, fine_rate
            ) VALUES (
                v_user_id, p_transaction_id, 'overdue', p_fine_amount, v_days_overdue, v_fine_rate
            );
        END IF;
        
        SET p_success = TRUE;
        SET p_message = CONCAT('Book returned successfully', 
            CASE WHEN p_fine_amount > 0 THEN CONCAT('. Fine: $', p_fine_amount) ELSE '' END
        );
        COMMIT;
    END IF;
END //
DELIMITER ;

-- ============================================================================
-- INSERT DEFAULT USER ROLES
-- ============================================================================
INSERT INTO user_roles (id, role_name, description, permissions) VALUES
(1, 'admin', 'System administrator with full access', '{"users": ["create", "read", "update", "delete"], "books": ["create", "read", "update", "delete"], "transactions": ["create", "read", "update", "delete"], "fines": ["create", "read", "update", "delete"], "reservations": ["create", "read", "update", "delete"], "reports": ["read"], "settings": ["read", "update"]}'),
(2, 'librarian', 'Library staff with administrative access', '{"users": ["read", "update"], "books": ["create", "read", "update"], "transactions": ["create", "read", "update"], "fines": ["read", "update"], "reservations": ["read", "update"], "reports": ["read"]}'),
(3, 'student', 'Student user with basic access', '{"books": ["read"], "transactions": ["read"], "reservations": ["create", "read", "update"]}');

-- ============================================================================
-- INSERT DEFAULT LIBRARY SETTINGS
-- ============================================================================
INSERT INTO library_settings (setting_key, setting_value, description, category, data_type) VALUES
('max_checkout_limit', '5', 'Maximum number of books a user can checkout', 'circulation', 'number'),
('default_loan_period', '14', 'Default loan period in days', 'circulation', 'number'),
('max_renewal_count', '2', 'Maximum number of times a book can be renewed', 'circulation', 'number'),
('daily_fine_rate', '1.00', 'Fine amount per day for overdue books', 'fines', 'number'),
('max_fine_amount', '50.00', 'Maximum fine amount per book', 'fines', 'number'),
('reservation_hold_days', '7', 'Number of days to hold a reserved book', 'circulation', 'number');

-- ============================================================================
-- INSERT DEFAULT BOOK CATEGORIES
-- ============================================================================
INSERT INTO book_categories (name, description, dewey_decimal) VALUES
('Fiction', 'Novels, stories, and literary works', '800-899'),
('Science Fiction', 'Science fiction and fantasy literature', '813.0876'),
('Mystery & Thriller', 'Mystery, detective, and thriller novels', '813.087'),
('Romance', 'Romance novels and love stories', '813.085'),
('Historical Fiction', 'Historical novels and period fiction', '813.081'),
('Non-Fiction', 'Factual books and reference materials', '000-799'),
('Biography', 'Biographies and autobiographies', '920-929'),
('History', 'Historical texts and documentation', '900-999'),
('Science', 'Scientific texts and research', '500-599'),
('Technology', 'Computer science and technology', '004-006'),
('Mathematics', 'Mathematical texts and reference', '510-519'),
('Business', 'Business and economic texts', '330-339'),
('Self-Help', 'Personal development and self-improvement', '158'),
('Reference', 'Dictionaries, encyclopedias, and reference', '000-099'),
('Children', 'Children\'s books and young adult literature', 'J');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
