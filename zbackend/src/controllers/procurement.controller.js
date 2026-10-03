/**
 * Procurement & Budget Controller
 * Handles vendor management, purchase orders, purchase item ledger,
 * and automated budget tracking with aggregated analytics.
 */

const { pool } = require('../config/database');

class ProcurementController {
  /**
   * Determine current Indian/academic fiscal year (e.g. 2026-2027)
   */
  static getDefaultFinancialYear() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    // Fiscal year starts in April (month 4)
    if (currentMonth >= 4) {
      return `${currentYear}-${currentYear + 1}`;
    }
    return `${currentYear - 1}-${currentYear}`;
  }

  /**
   * POST /api/procurement/purchases
   * Records purchase order, saves line items, and auto-increments library_budgets.spent_budget
   */
  static async createPurchase(req, res) {
    const connection = await pool.getConnection();
    try {
      const {
        vendor_id,
        invoice_no,
        purchase_date,
        allocated_year = ProcurementController.getDefaultFinancialYear(),
        payment_status = 'PAID',
        items = [],
      } = req.body;

      if (!vendor_id || !invoice_no || !purchase_date) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'vendor_id, invoice_no, and purchase_date are required.',
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'At least one purchase item is required.',
        });
      }

      // Calculate totals and validate item schema
      let totalAmount = 0;
      const sanitizedItems = [];

      for (const item of items) {
        const itemTitle = (item.item_title || item.title || '').trim();
        const quantity = parseInt(item.quantity, 10) || 1;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const resourceType = (item.resource_type || 'BOOK').toUpperCase();

        if (!itemTitle) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Each item must have a valid title.',
          });
        }

        const subtotal = parseFloat((quantity * unitPrice).toFixed(2));
        totalAmount += subtotal;

        sanitizedItems.push({
          itemTitle,
          resourceType,
          quantity,
          unitPrice,
          subtotal,
        });
      }

      totalAmount = parseFloat(totalAmount.toFixed(2));

      await connection.beginTransaction();

      // Verify vendor exists
      const [vendors] = await connection.execute(
        'SELECT id, name FROM vendors WHERE id = ?',
        [vendor_id]
      );
      if (vendors.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          error: 'Not Found',
          message: `Vendor with ID ${vendor_id} does not exist.`,
        });
      }

      // 1. Insert Purchase
      const [purchaseResult] = await connection.execute(
        `INSERT INTO purchases (vendor_id, invoice_no, purchase_date, total_amount, allocated_year, payment_status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [vendor_id, invoice_no, purchase_date, totalAmount, allocated_year, payment_status]
      );
      const purchaseId = purchaseResult.insertId;

      // 2. Insert Purchase Line Items
      for (const item of sanitizedItems) {
        await connection.execute(
          `INSERT INTO purchase_items (purchase_id, item_title, resource_type, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            purchaseId,
            item.itemTitle,
            item.resourceType,
            item.quantity,
            item.unitPrice,
            item.subtotal,
          ]
        );
      }

      // 3. Auto-increment library_budgets.spent_budget
      await connection.execute(
        `INSERT INTO library_budgets (financial_year, allocated_budget, spent_budget)
         VALUES (?, 0.00, ?)
         ON DUPLICATE KEY UPDATE spent_budget = spent_budget + VALUES(spent_budget)`,
        [allocated_year, totalAmount]
      );

      // Fetch the updated budget for response
      const [budgetRows] = await connection.execute(
        'SELECT financial_year, allocated_budget, spent_budget FROM library_budgets WHERE financial_year = ?',
        [allocated_year]
      );

      await connection.commit();

      const budget = budgetRows[0] || {
        financial_year: allocated_year,
        allocated_budget: 0,
        spent_budget: totalAmount,
      };

      res.status(201).json({
        success: true,
        message: 'Procurement order recorded successfully.',
        data: {
          purchase_id: purchaseId,
          vendor: vendors[0],
          invoice_no,
          purchase_date,
          allocated_year,
          payment_status,
          total_amount: totalAmount,
          item_count: sanitizedItems.length,
          items: sanitizedItems,
          budget_status: {
            financial_year: budget.financial_year,
            allocated_budget: parseFloat(budget.allocated_budget),
            spent_budget: parseFloat(budget.spent_budget),
            remaining_balance: parseFloat((budget.allocated_budget - budget.spent_budget).toFixed(2)),
          },
        },
      });
    } catch (err) {
      await connection.rollback();
      console.error('Create purchase error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    } finally {
      connection.release();
    }
  }

  /**
   * GET /api/procurement/analytics
   * Returns total budget, spent funds, remaining balance, and month/year aggregated reports.
   */
  static async getProcurementAnalytics(req, res) {
    try {
      const year = req.query.financial_year || ProcurementController.getDefaultFinancialYear();

      // 1. Budget summary
      const [budgetRows] = await pool.execute(
        'SELECT id, financial_year, allocated_budget, spent_budget, updated_at FROM library_budgets WHERE financial_year = ?',
        [year]
      );

      const budget = budgetRows[0] || {
        financial_year: year,
        allocated_budget: 0,
        spent_budget: 0,
      };

      const allocated = parseFloat(budget.allocated_budget) || 0;
      const spent = parseFloat(budget.spent_budget) || 0;
      const remaining = parseFloat((allocated - spent).toFixed(2));
      const utilizationRate = allocated > 0 ? parseFloat(((spent / allocated) * 100).toFixed(1)) : 0;

      // 2. Month-by-month spending aggregation for the selected year
      const [monthlySpend] = await pool.execute(
        `SELECT 
           DATE_FORMAT(purchase_date, '%Y-%m') AS month,
           DATE_FORMAT(purchase_date, '%M %Y') AS month_label,
           COUNT(id) AS purchase_count,
           COALESCE(SUM(total_amount), 0) AS total_spent
         FROM purchases
         WHERE allocated_year = ?
         GROUP BY month, month_label
         ORDER BY month ASC`,
        [year]
      );

      // 3. Spend breakdown by Resource Type (Books, Research Papers, Journals)
      const [resourceTypeSpend] = await pool.execute(
        `SELECT 
           pi.resource_type,
           COUNT(pi.id) AS item_count,
           COALESCE(SUM(pi.quantity), 0) AS total_units,
           COALESCE(SUM(pi.subtotal), 0) AS total_spent
         FROM purchase_items pi
         JOIN purchases p ON pi.purchase_id = p.id
         WHERE p.allocated_year = ?
         GROUP BY pi.resource_type
         ORDER BY total_spent DESC`,
        [year]
      );

      // 4. Spend breakdown by Vendor
      const [vendorSpend] = await pool.execute(
        `SELECT 
           v.id AS vendor_id,
           v.name AS vendor_name,
           v.email AS vendor_email,
           COUNT(p.id) AS order_count,
           COALESCE(SUM(p.total_amount), 0) AS total_spent
         FROM purchases p
         JOIN vendors v ON p.vendor_id = v.id
         WHERE p.allocated_year = ?
         GROUP BY v.id, v.name, v.email
         ORDER BY total_spent DESC`,
        [year]
      );

      // 5. Recent purchases list
      const [recentPurchases] = await pool.execute(
        `SELECT 
           p.id,
           p.invoice_no,
           p.purchase_date,
           p.total_amount,
           p.allocated_year,
           p.payment_status,
           p.created_at,
           v.id AS vendor_id,
           v.name AS vendor_name,
           (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS total_items
         FROM purchases p
         JOIN vendors v ON p.vendor_id = v.id
         WHERE p.allocated_year = ?
         ORDER BY p.purchase_date DESC, p.id DESC
         LIMIT 20`,
        [year]
      );

      res.json({
        success: true,
        financial_year: year,
        budget: {
          allocated_budget: allocated,
          spent_budget: spent,
          remaining_balance: remaining,
          utilization_percentage: utilizationRate,
        },
        monthly_reports: monthlySpend.map((row) => ({
          month: row.month,
          month_label: row.month_label,
          purchase_count: row.purchase_count,
          total_spent: parseFloat(row.total_spent),
        })),
        resource_breakdown: resourceTypeSpend.map((row) => ({
          resource_type: row.resource_type,
          item_count: row.item_count,
          total_units: row.total_units,
          total_spent: parseFloat(row.total_spent),
        })),
        vendor_breakdown: vendorSpend.map((row) => ({
          vendor_id: row.vendor_id,
          vendor_name: row.vendor_name,
          vendor_email: row.vendor_email,
          order_count: row.order_count,
          total_spent: parseFloat(row.total_spent),
        })),
        recent_purchases: recentPurchases.map((p) => ({
          id: p.id,
          invoice_no: p.invoice_no,
          purchase_date: p.purchase_date,
          total_amount: parseFloat(p.total_amount),
          payment_status: p.payment_status,
          vendor_id: p.vendor_id,
          vendor_name: p.vendor_name,
          total_items: p.total_items,
          created_at: p.created_at,
        })),
      });
    } catch (err) {
      console.error('Procurement analytics error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }

  /**
   * GET /api/procurement/vendors
   */
  static async getVendors(req, res) {
    try {
      const [vendors] = await pool.execute(`
        SELECT 
          v.*,
          COUNT(p.id) AS total_orders,
          COALESCE(SUM(p.total_amount), 0) AS total_billed
        FROM vendors v
        LEFT JOIN purchases p ON v.id = p.vendor_id
        GROUP BY v.id
        ORDER BY v.name ASC
      `);

      res.json({
        success: true,
        vendors: vendors.map((v) => ({
          ...v,
          total_billed: parseFloat(v.total_billed),
        })),
      });
    } catch (err) {
      console.error('Get vendors error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }

  /**
   * POST /api/procurement/vendors
   */
  static async createVendor(req, res) {
    try {
      const { name, contact_person, email, phone, address, gst_number } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Vendor name is required' });
      }

      const [result] = await pool.execute(
        `INSERT INTO vendors (name, contact_person, email, phone, address, gst_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name.trim(), contact_person || null, email || null, phone || null, address || null, gst_number || null]
      );

      res.status(201).json({
        success: true,
        message: 'Vendor created successfully.',
        vendor_id: result.insertId,
      });
    } catch (err) {
      console.error('Create vendor error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }

  /**
   * PUT /api/procurement/budget
   * Set or update allocated budget for a financial year
   */
  static async updateBudget(req, res) {
    try {
      const { financial_year, allocated_budget } = req.body;
      if (!financial_year || allocated_budget === undefined) {
        return res.status(400).json({ error: 'financial_year and allocated_budget are required' });
      }

      await pool.execute(
        `INSERT INTO library_budgets (financial_year, allocated_budget, spent_budget)
         VALUES (?, ?, 0.00)
         ON DUPLICATE KEY UPDATE allocated_budget = VALUES(allocated_budget)`,
        [financial_year, parseFloat(allocated_budget) || 0]
      );

      res.json({
        success: true,
        message: `Allocated budget for ${financial_year} updated to ${allocated_budget}.`,
      });
    } catch (err) {
      console.error('Update budget error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }
}

module.exports = ProcurementController;
