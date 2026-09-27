/**
 * Library Configuration Service
 * 
 * Centralized access to library_config table parameters.
 * Provides caching and type conversion for configuration values.
 */

const { query } = require('../config/database');

// In-memory cache for configuration
const configCache = new Map();
let cacheTimestamp = null;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Get a single configuration value
 */
async function getConfig(key, defaultValue = null) {
  await refreshCacheIfNeeded();
  
  const value = configCache.get(key);
  return value !== undefined ? value : defaultValue;
}

/**
 * Get multiple configuration values
 */
async function getConfigs(keys) {
  await refreshCacheIfNeeded();
  
  const result = {};
  for (const key of keys) {
    result[key] = configCache.get(key);
  }
  return result;
}

/**
 * Get all configuration values
 */
async function getAllConfigs() {
  await refreshCacheIfNeeded();
  return Object.fromEntries(configCache);
}

/**
 * Update a configuration value
 */
async function setConfig(key, value, updatedBy = null) {
  try {
    await query(
      `UPDATE library_config 
       SET config_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE config_key = ?`,
      [String(value), updatedBy, key]
    );
    
    // Invalidate cache
    cacheTimestamp = null;
    
    return getConfig(key);
  } catch (error) {
    console.warn('Could not update config in database:', error.message);
    // Update in-memory cache only
    configCache.set(key, value);
    return value;
  }
}

/**
 * Refresh cache if expired
 */
async function refreshCacheIfNeeded() {
  const now = Date.now();
  
  if (!cacheTimestamp || (now - cacheTimestamp) > CACHE_TTL) {
    await loadConfigsFromDatabase();
    cacheTimestamp = now;
  }
}

/**
 * Load all configurations from database
 */
async function loadConfigsFromDatabase() {
  try {
    const configs = await query('SELECT config_key, config_value, config_type FROM library_config');
    
    configCache.clear();
    
    for (const config of configs) {
      const { config_key, config_value, config_type } = config;
      
      // Type conversion
      let value;
      switch (config_type) {
        case 'number':
          value = parseFloat(config_value);
          break;
        case 'boolean':
          value = config_value === 'true' || config_value === '1';
          break;
        case 'json':
          try {
            value = JSON.parse(config_value);
          } catch (e) {
            value = config_value;
          }
        break;
      default:
        value = config_value;
    }
    
    configCache.set(config_key, value);
  }
  } catch (error) {
    // If table doesn't exist or any other error, use defaults
    console.warn('Could not load library_config table, using defaults:', error.message);
    configCache.clear();
    // Set default values
    configCache.set('demo_mode', true);
    configCache.set('production_mode_enabled', false);
    configCache.set('scan_debounce_seconds', 300);
    configCache.set('entry_confidence_threshold', 80);
    configCache.set('gps_library_lat', 37.7749);
    configCache.set('gps_library_lng', -122.4194);
    configCache.set('gps_inner_zone_meters', 20);
    configCache.set('gps_outer_zone_meters', 50);
  }
}

/**
 * Force cache refresh
 */
async function refreshCache() {
  cacheTimestamp = null;
  await refreshCacheIfNeeded();
}

/**
 * Check if system is in demo mode
 */
async function isDemoMode() {
  return await getConfig('demo_mode', true);
}

/**
 * Check if production mode is enabled
 */
async function isProductionMode() {
  return await getConfig('production_mode_enabled', false);
}

/**
 * Get scan debounce window in seconds
 */
async function getScanDebounceSeconds() {
  return await getConfig('scan_debounce_seconds', 300);
}

/**
 * Get entry confidence threshold
 */
async function getEntryConfidenceThreshold() {
  return await getConfig('entry_confidence_threshold', 80);
}

/**
 * Get GPS library coordinates
 */
async function getLibraryCoordinates() {
  const lat = await getConfig('gps_library_lat', 37.7749);
  const lng = await getConfig('gps_library_lng', -122.4194);
  return { latitude: lat, longitude: lng };
}

/**
 * Get geofence zones in meters
 */
async function getGeofenceZones() {
  const inner = await getConfig('gps_inner_zone_meters', 20);
  const outer = await getConfig('gps_outer_zone_meters', 50);
  return { inner, outer };
}

module.exports = {
  getConfig,
  getConfigs,
  getAllConfigs,
  setConfig,
  refreshCache,
  isDemoMode,
  isProductionMode,
  getScanDebounceSeconds,
  getEntryConfidenceThreshold,
  getLibraryCoordinates,
  getGeofenceZones
};
