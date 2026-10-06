/**
 * Procurement Routes (Admin Only)
 * Handles book and journal procurement orders, vendor tracking, and budget accounting.
 */

const express = require('express');
const router = express.Router();
const ProcurementController = require('../controllers/procurement.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Admin & Librarian RBAC
router.use(authenticate, authorize(['admin', 'librarian']));

/**
 * POST /api/procurement/purchases
 * Records purchase order, creates purchase_items, auto-increments library_budgets.spent_budget
 */
router.post('/purchases', ProcurementController.createPurchase);

/**
 * GET /api/procurement/analytics
 * Returns total budget, spent funds, remaining balance, and month/year aggregated reports
 */
router.get('/analytics', ProcurementController.getProcurementAnalytics);

/**
 * GET /api/procurement/vendors
 * Lists all registered procurement vendors
 */
router.get('/vendors', ProcurementController.getVendors);

/**
 * POST /api/procurement/vendors
 * Register a new vendor
 */
router.post('/vendors', ProcurementController.createVendor);

/**
 * PUT /api/procurement/budget
 * Allocate or update budget for a given financial year
 */
router.put('/budget', ProcurementController.updateBudget);

module.exports = router;
