/**
 * System Mode Configuration
 * 
 * Centralizes mode-specific behavior.
 * This module determines whether the system operates in DEMO or PRODUCTION mode.
 * 
 * DEMO MODE:
 * - Handheld RFID reader
 * - Manual shelf selection by librarian
 * - Relaxed validation
 * 
 * PRODUCTION MODE:
 * - Fixed RFID readers at each shelf
 * - Automatic shelf detection from reader ID
 * - Strict validation
 */

require('dotenv').config();

const isDemoMode = () => {
  return process.env.DEMO_MODE === 'true';
};

const isProductionMode = () => {
  return process.env.DEMO_MODE === 'false';
};

const getMode = () => {
  return isDemoMode() ? 'DEMO' : 'PRODUCTION';
};

/**
 * Get configuration based on current mode
 */
const getModeConfig = () => {
  const mode = getMode();
  
  return {
    mode,
    isDemoMode: isDemoMode(),
    isProductionMode: isProductionMode(),
    requireReaderMapping: isProductionMode(), // Only production requires reader-shelf mapping
    allowManualShelfSelection: isDemoMode(), // Only demo allows manual selection
    strictValidation: isProductionMode() // Production has stricter validation
  };
};

module.exports = {
  isDemoMode,
  isProductionMode,
  getMode,
  getModeConfig
};
