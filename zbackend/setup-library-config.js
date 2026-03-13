/**
 * Apply library_config table directly.
 */

const { query } = require('./src/config/database');

async function run() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS library_config (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value TEXT NOT NULL,
        config_type ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
        description VARCHAR(500) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by INT NULL,
        INDEX idx_config_type (config_type)
    ) ENGINE=InnoDB COMMENT='System-wide configuration parameters'
  `;

  const insertSQL = `
    INSERT INTO library_config (config_key, config_value, config_type, description) VALUES
    ('gps_library_lat', '13.0827', 'number', 'Library latitude coordinate'),
    ('gps_library_lng', '80.2707', 'number', 'Library longitude coordinate'),
    ('gps_inner_zone_meters', '20', 'number', 'Inner geofence radius in meters'),
    ('gps_outer_zone_meters', '50', 'number', 'Outer geofence radius in meters'),
    ('entry_confidence_threshold', '80', 'number', 'Auto-log threshold 0-100'),
    ('entry_manual_threshold', '50', 'number', 'Manual confirmation threshold'),
    ('entry_debounce_minutes', '5', 'number', 'Minimum minutes between entry logs'),
    ('entry_debounce_seconds', '300', 'number', 'Minimum seconds between entry logs'),
    ('library_wifi_ssid', 'LibraryWiFi', 'string', 'Official library WiFi network name'),
    ('library_open_hour', '8', 'number', 'Library opening hour 0-23'),
    ('library_close_hour', '22', 'number', 'Library closing hour 0-23'),
    ('scan_debounce_seconds', '30', 'number', 'Ignore duplicate scans within this window'),
    ('reader_timeout_minutes', '30', 'number', 'Mark reader inactive after no communication'),
    ('demo_mode', 'true', 'boolean', 'Enable demo mode'),
    ('beacon_battery_alert_percent', '20', 'number', 'Alert when beacon battery below this percent')
    ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP
  `;

  try {
    await query(createTableSQL);
    console.log('CREATE TABLE library_config: OK');
  } catch (e) {
    console.error('CREATE TABLE failed:', e.message);
    process.exit(1);
  }

  try {
    await query(insertSQL);
    console.log('INSERT config defaults: OK');
  } catch (e) {
    console.error('INSERT failed:', e.message);
    process.exit(1);
  }

  // Verify
  const rows = await query('SELECT COUNT(*) as n FROM library_config');
  console.log('library_config rows:', rows[0].n);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
