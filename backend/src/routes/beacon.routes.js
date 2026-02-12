/**
 * Beacon Routes
 * 
 * BLE beacon information endpoints.
 */

const express = require('express');
const router = express.Router();
const beaconController = require('../controllers/beacon.controller');
const { authenticate } = require('../middleware/auth.middleware');

// List all beacons
router.get('/', authenticate, beaconController.listBeacons);

// Get beacon by zone
router.get('/zone/:zone', authenticate, beaconController.getBeaconByZone);

module.exports = router;
