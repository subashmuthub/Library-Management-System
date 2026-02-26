-- ============================================================================
-- MIGRATION: Upgrade from Demo to Final System
-- ============================================================================
-- Date: February 5, 2026
-- Purpose: Add production-ready features while maintaining demo compatibility
-- ============================================================================

USE smart_library;

-- ============================================================================
-- STEP 1: Enhance readers table with monitoring capabilities
-- ============================================================================

-- Add optional monitoring columns (check if exists first)
-- Note: MySQL 8.0 doesn't support IF NOT EXISTS in ALTER TABLE ADD COLUMN
-- These columns will fail silently if they already exist

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_library' AND TABLE_NAME = 'readers' AND COLUMN_NAME = 'last_scan_count');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE readers ADD COLUMN last_scan_count INT DEFAULT 0 COMMENT ''Total scans processed by this reader''', 'SELECT ''Column exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_library' AND TABLE_NAME = 'readers' AND COLUMN_NAME = 'last_scan_timestamp');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE readers ADD COLUMN last_scan_timestamp TIMESTAMP NULL COMMENT ''Last successful scan timestamp''', 'SELECT ''Column exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_library' AND TABLE_NAME = 'readers' AND COLUMN_NAME = 'firmware_version');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE readers ADD COLUMN firmware_version VARCHAR(50) NULL COMMENT ''Reader firmware version''', 'SELECT ''Column exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_library' AND TABLE_NAME = 'readers' AND COLUMN_NAME = 'installation_date');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE readers ADD COLUMN installation_date DATE NULL COMMENT ''Physical installation date''', 'SELECT ''Column exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_library' AND TABLE_NAME = 'readers' AND COLUMN_NAME = 'notes');
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE readers ADD COLUMN notes TEXT NULL COMMENT ''Admin notes about this reader''', 'SELECT ''Column exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- STEP 2: Create library configuration table
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    config_type ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
    description VARCHAR(500) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT NULL,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_config_type (config_type)
) ENGINE=InnoDB COMMENT='System-wide configuration parameters';

-- ============================================================================
-- STEP 3: Seed library configuration with intelligent defaults
-- ============================================================================

INSERT INTO library_config (config_key, config_value, config_type, description) VALUES
-- GPS Entry System
('gps_library_lat', '37.7749', 'number', 'Library latitude coordinate'),
('gps_library_lng', '-122.4194', 'number', 'Library longitude coordinate'),
('gps_inner_zone_meters', '20', 'number', 'Inner geofence radius (high confidence)'),
('gps_outer_zone_meters', '50', 'number', 'Outer geofence radius (medium confidence)'),
('entry_confidence_threshold', '80', 'number', 'Auto-log threshold (0-100)'),
('entry_debounce_seconds', '300', 'number', 'Minimum seconds between entry logs'),
('library_wifi_ssid', 'LibraryWiFi', 'string', 'Official library WiFi network name'),

-- RFID Scanning System  
('scan_debounce_seconds', '300', 'number', 'Ignore duplicate scans within this window'),
('reader_timeout_minutes', '30', 'number', 'Mark reader inactive after no communication'),
('require_reader_validation', 'true', 'boolean', 'Validate reader exists before accepting scan'),

-- Operating Hours (for entry validation)
('library_open_time', '08:00', 'string', 'Library opening time (HH:MM)'),
('library_close_time', '22:00', 'string', 'Library closing time (HH:MM)'),
('allow_entry_outside_hours', 'false', 'boolean', 'Allow entry logging outside operating hours'),

-- System Mode
('demo_mode', 'true', 'boolean', 'Enable demo mode (manual shelf selection)'),
('production_mode_enabled', 'false', 'boolean', 'Enable full production features'),

-- Performance Tuning
('reader_cache_ttl_seconds', '3600', 'number', 'Reader-shelf mapping cache duration'),
('max_concurrent_scans', '100', 'number', 'Maximum simultaneous scan requests'),

-- Navigation & Beacons
('beacon_battery_alert_percent', '20', 'number', 'Alert when beacon battery below this %'),
('navigation_update_interval_seconds', '5', 'number', 'Real-time location update frequency')

ON DUPLICATE KEY UPDATE 
  config_value = VALUES(config_value),
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- STEP 4: Add index for book location queries (performance optimization)
-- ============================================================================

-- Optimize "find book current location" query
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = 'smart_library' AND TABLE_NAME = 'book_location_history' AND INDEX_NAME = 'idx_book_reader_timestamp');
SET @sqlstmt := IF(@exist = 0, 'CREATE INDEX idx_book_reader_timestamp ON book_location_history(book_id, reader_id, timestamp DESC)', 'SELECT ''Index exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Optimize "reader activity" query
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = 'smart_library' AND TABLE_NAME = 'book_location_history' AND INDEX_NAME = 'idx_reader_timestamp');
SET @sqlstmt := IF(@exist = 0, 'CREATE INDEX idx_reader_timestamp ON book_location_history(reader_id, timestamp DESC)', 'SELECT ''Index exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- STEP 5: Create view for reader health monitoring
-- ============================================================================

CREATE OR REPLACE VIEW reader_health_status AS
SELECT 
    r.id,
    r.reader_code,
    r.reader_type,
    r.shelf_id,
    s.shelf_code,
    s.zone,
    r.is_active,
    r.last_scan_count,
    r.last_scan_timestamp,
    r.firmware_version,
    r.installation_date,
    TIMESTAMPDIFF(MINUTE, r.last_scan_timestamp, NOW()) AS minutes_since_last_scan,
    CASE 
        WHEN r.is_active = FALSE THEN 'Disabled'
        WHEN r.last_scan_timestamp IS NULL THEN 'Never Scanned'
        WHEN TIMESTAMPDIFF(MINUTE, r.last_scan_timestamp, NOW()) > 30 THEN 'Offline'
        WHEN TIMESTAMPDIFF(MINUTE, r.last_scan_timestamp, NOW()) > 10 THEN 'Warning'
        ELSE 'Online'
    END AS health_status
FROM readers r
LEFT JOIN shelves s ON r.shelf_id = s.id
ORDER BY r.reader_type, r.reader_code;

-- ============================================================================
-- STEP 6: Create view for scan statistics
-- ============================================================================

CREATE OR REPLACE VIEW scan_statistics AS
SELECT 
    DATE(timestamp) AS scan_date,
    reader_id,
    r.reader_code,
    r.reader_type,
    COUNT(*) AS total_scans,
    COUNT(DISTINCT book_id) AS unique_books,
    MIN(timestamp) AS first_scan,
    MAX(timestamp) AS last_scan
FROM book_location_history blh
INNER JOIN readers r ON blh.reader_id = r.id
GROUP BY DATE(timestamp), reader_id, r.reader_code, r.reader_type
ORDER BY scan_date DESC, total_scans DESC;

-- ============================================================================
-- STEP 7: Add stored procedure for mode-aware scanning
-- ============================================================================

DELIMITER //

DROP PROCEDURE IF EXISTS process_rfid_scan//

CREATE PROCEDURE process_rfid_scan(
    IN p_tag_id VARCHAR(100),
    IN p_reader_id INT,
    IN p_manual_shelf_id INT,
    IN p_scanned_by INT,
    OUT p_book_id INT,
    OUT p_final_shelf_id INT,
    OUT p_is_duplicate BOOLEAN,
    OUT p_error_message VARCHAR(500)
)
process_rfid_scan_label: BEGIN
    DECLARE v_demo_mode BOOLEAN;
    DECLARE v_reader_shelf_id INT;
    DECLARE v_reader_type VARCHAR(20);
    DECLARE v_last_scan_timestamp TIMESTAMP;
    DECLARE v_last_scan_reader_id INT;
    DECLARE v_debounce_seconds INT;
    DECLARE v_seconds_since_last BIGINT;
    
    -- Initialize outputs
    SET p_book_id = NULL;
    SET p_final_shelf_id = NULL;
    SET p_is_duplicate = FALSE;
    SET p_error_message = NULL;
    
    -- Get system mode
    SELECT CAST(config_value AS UNSIGNED) INTO v_demo_mode
    FROM library_config WHERE config_key = 'demo_mode';
    
    -- Get debounce window
    SELECT CAST(config_value AS UNSIGNED) INTO v_debounce_seconds
    FROM library_config WHERE config_key = 'scan_debounce_seconds';
    
    -- Step 1: Lookup book by tag ID
    SELECT book_id INTO p_book_id
    FROM rfid_tags
    WHERE tag_id = p_tag_id AND is_active = TRUE;
    
    IF p_book_id IS NULL THEN
        SET p_error_message = 'RFID tag not found or inactive';
        LEAVE process_rfid_scan_label;
    END IF;
    
    -- Step 2: Get reader information
    SELECT shelf_id, reader_type INTO v_reader_shelf_id, v_reader_type
    FROM readers
    WHERE id = p_reader_id AND is_active = TRUE;
    
    IF v_reader_shelf_id IS NULL AND v_reader_type IS NULL THEN
        SET p_error_message = 'Reader not found or inactive';
        LEAVE process_rfid_scan_label;
    END IF;
    
    -- Step 3: Determine final shelf (MODE-AWARE LOGIC)
    IF v_demo_mode = TRUE AND p_manual_shelf_id IS NOT NULL THEN
        -- DEMO MODE: Trust manual input
        SET p_final_shelf_id = p_manual_shelf_id;
    ELSEIF v_reader_shelf_id IS NOT NULL THEN
        -- FINAL MODE: Infer from reader
        SET p_final_shelf_id = v_reader_shelf_id;
    ELSE
        SET p_error_message = 'Cannot determine shelf: reader not mapped and no manual input provided';
        LEAVE process_rfid_scan_label;
    END IF;
    
    -- Step 4: Check for duplicate scan (debounce logic)
    SELECT timestamp, reader_id
    INTO v_last_scan_timestamp, v_last_scan_reader_id
    FROM book_location_history
    WHERE book_id = p_book_id
    ORDER BY timestamp DESC
    LIMIT 1;
    
    IF v_last_scan_timestamp IS NOT NULL THEN
        SET v_seconds_since_last = TIMESTAMPDIFF(SECOND, v_last_scan_timestamp, NOW());
        
        -- Same reader + within debounce window = duplicate
        IF v_last_scan_reader_id = p_reader_id AND v_seconds_since_last < v_debounce_seconds THEN
            SET p_is_duplicate = TRUE;
            -- Don't record, but not an error
            LEAVE process_rfid_scan_label;
        END IF;
    END IF;
    
    -- Step 5: Record the scan
    INSERT INTO book_location_history (book_id, shelf_id, reader_id, scanned_by, scan_method, timestamp)
    VALUES (p_book_id, p_final_shelf_id, p_reader_id, p_scanned_by, 'rfid', NOW());
    
    -- Step 6: Update reader statistics
    UPDATE readers 
    SET last_scan_count = last_scan_count + 1,
        last_scan_timestamp = NOW()
    WHERE id = p_reader_id;
    
END//

DELIMITER ;

-- ============================================================================
-- STEP 8: Add function to get current book location
-- ============================================================================

DELIMITER //

DROP FUNCTION IF EXISTS get_book_current_shelf//

CREATE FUNCTION get_book_current_shelf(p_book_id INT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_shelf_id INT;
    
    SELECT shelf_id INTO v_shelf_id
    FROM book_location_history
    WHERE book_id = p_book_id
    ORDER BY timestamp DESC
    LIMIT 1;
    
    RETURN v_shelf_id;
END//

DELIMITER ;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
SELECT 'Migration completed successfully!' AS status,
       (SELECT COUNT(*) FROM readers) AS total_readers,
       (SELECT COUNT(*) FROM library_config) AS config_entries,
       (SELECT COUNT(*) FROM books) AS total_books;

