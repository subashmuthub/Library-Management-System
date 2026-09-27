/**
 * Beacon Routes
 * 
 * BLE beacon information endpoints.
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const beaconController = require('../controllers/beacon.controller');
// const { authenticate } = require('../middleware/auth.middleware');

// List all beacons
router.get('/', beaconController.listBeacons);

// Get beacon by zone
router.get('/zone/:zone', beaconController.getBeaconByZone);

module.exports = router;
