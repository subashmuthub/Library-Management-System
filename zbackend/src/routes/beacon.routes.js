/**
 * Beacon Routes
 * 
 * BLE beacon information endpoints.
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const beaconController = require('../controllers/beacon.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// List all beacons
router.get('/', beaconController.listBeacons);

// Get beacon by zone
router.get('/zone/:zone', beaconController.getBeaconByZone);

// Add beacon (admin only)
router.post('/', authenticate, authorize(['admin']), beaconController.createBeacon);

module.exports = router;
