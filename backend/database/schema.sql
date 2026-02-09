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
-- TABLE: users
-- Stores all system users (students, librarians, admins)
-- ============================================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('student', 'librarian', 'admin') NOT NULL DEFAULT 'student',
    student_id VARCHAR(50) UNIQUE NULL,
    phone VARCHAR(20) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_student_id (student_id),
    INDEX idx_role (role)
) ENGINE=InnoDB COMMENT='System users with role-based access';

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
    isbn VARCHAR(13) UNIQUE NOT NULL,
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
-- SAMPLE CONFIGURATION DATA
-- ============================================================================
-- This will be populated by seed.sql

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
