/**
 * Shelf Locator Routes
 * Base: /api/v1/shelf-locator
 */

const express = require('express');
const router = express.Router();
const ShelfLocatorController = require('../controllers/shelf-locator.controller');

/**
 * GET /api/v1/shelf-locator/book/:bookId
 * Locate a specific book — returns shelf, QR payload, and map coordinates.
 */
router.get('/book/:bookId', ShelfLocatorController.locateBook);

/**
 * GET /api/v1/shelf-locator/shelves
 * Return all shelves with coordinates for the SVG floor plan.
 */
router.get('/shelves', ShelfLocatorController.getAllShelves);

/**
 * GET /api/v1/shelf-locator/search
 * Search books by title/author/ISBN for the locator search bar.
 * Query: q
 */
router.get('/search', ShelfLocatorController.searchBooks);

module.exports = router;
