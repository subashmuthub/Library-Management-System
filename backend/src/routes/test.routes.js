/**
 * Test Routes
 * Simple test routes to verify server functionality
 */

const express = require('express');
const router = express.Router();

// Simple test endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Library Management System API is running',
        timestamp: new Date().toISOString()
    });
});

// Test database connection
router.get('/db-test', async (req, res) => {
    try {
        const { pool } = require('../config/database');
        const [result] = await pool.execute('SELECT 1 as test');
        
        res.json({
            status: 'OK',
            message: 'Database connection successful',
            result: result[0]
        });
    } catch (err) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: err.message
        });
    }
});

module.exports = router;