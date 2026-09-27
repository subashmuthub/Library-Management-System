/**
 * Suggestion Routes
 * Endpoints for student book suggestions and librarian approvals
 */

const express = require('express');
const router = express.Router();
const SuggestionController = require('../controllers/suggestion.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Create book suggestion (any authenticated student/staff)
router.post('/', authenticate, SuggestionController.createSuggestion);

// Get suggestions (students get own, admin/librarian get all)
router.get('/', authenticate, SuggestionController.getSuggestions);

// Update suggestion status (admin & librarian only)
router.patch('/:id/status', authenticate, authorize(['admin', 'librarian']), SuggestionController.updateSuggestionStatus);
router.put('/:id/status', authenticate, authorize(['admin', 'librarian']), SuggestionController.updateSuggestionStatus);

module.exports = router;
