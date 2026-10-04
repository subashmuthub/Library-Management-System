const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Strict Admin Gatekeeper: Only users with role === 'admin' can access these endpoints
router.use(authenticate);
router.use(authorize(['admin']));

// Module 1: Dynamic Reports & PDF Generator
router.get('/reports/active-students', AdminController.getActiveStudentsAnalytics);
router.post('/reports/generate-pdf', AdminController.generateActiveStudentsPDF);
router.get('/reports/templates', AdminController.getTemplates);
router.post('/reports/templates', AdminController.saveTemplate);
router.put('/reports/templates/:id', AdminController.updateTemplate);

// Module 2: Department Policy & Compatibility Settings
router.get('/department-policies', AdminController.getDepartmentPolicies);
router.put('/department-policies/:department_code', AdminController.updateDepartmentPolicy);
router.post('/department-policies', AdminController.createDepartmentPolicy);

module.exports = router;
