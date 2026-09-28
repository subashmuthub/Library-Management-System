const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/feedback.controller');

router.get('/books/:bookId/reviews', FeedbackController.listReviews);
router.post('/books/:bookId/reviews', FeedbackController.createReview);
router.get('/purchase-suggestions', FeedbackController.listSuggestions);
router.post('/purchase-suggestions', FeedbackController.createSuggestion);
router.patch('/purchase-suggestions/:id', FeedbackController.updateSuggestion);
router.get('/disputes', FeedbackController.listDisputes);
router.post('/disputes', FeedbackController.createDispute);
router.patch('/disputes/:id', FeedbackController.updateDispute);

module.exports = router;
