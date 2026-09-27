/**
 * User Routes
 * 
 * User profile and management endpoints.
 * Authentication disabled for development
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const multer = require('multer');
const path = require('path');

// Multer setup for avatar uploads
const avatarsDir = path.resolve(__dirname, '../../uploads/avatars');
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, avatarsDir);
	},
	filename: function (req, file, cb) {
		const ext = path.extname(file.originalname) || '.jpg';
		const id = req.session?.user?.id || req.body.userId || 'anon';
		cb(null, `avatar_${id}_${Date.now()}${ext}`);
	}
});
const upload = multer({ storage });
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Get current user profile
router.get('/profile', authenticate, userController.getProfile);

// Update user profile
router.put('/profile', authenticate, userController.updateProfile);

// Upload profile avatar
router.post('/profile/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);

// List all users (admin & librarian only)
router.get('/', authenticate, authorize(['admin', 'librarian']), userController.listUsers);

// Get user by ID (must come after / to avoid matching everything)
router.get('/:id', authenticate, userController.getUserById);

module.exports = router;
