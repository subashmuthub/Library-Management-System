const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// GET all settings
router.get('/', authenticate, authorize(['admin', 'librarian']), settingsController.getAllSettings);

// GET setting by category
router.get('/category/:category', authenticate, authorize(['admin', 'librarian']), settingsController.getSettingsByCategory);

// PUT update multiple settings
router.put('/', authenticate, authorize(['admin', 'librarian']), settingsController.updateSettings);

// GET public settings (e.g., logo, library name, without admin auth)
router.get('/public', settingsController.getPublicSettings);

module.exports = router;
