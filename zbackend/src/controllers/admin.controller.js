const PDFDocument = require('pdfkit');
const { pool } = require('../config/database');

class AdminController {
  /**
   * Helper: Build date range from month and year parameters
   */
  static getDateRange(month, year) {
    const currentYear = new Date().getFullYear();
    const targetYear = Number(year) || currentYear;

    if (month && month !== 'all' && Number(month) >= 1 && Number(month) <= 12) {
      const m = Number(month);
      const startDate = `${targetYear}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, m, 0).getDate();
      const endDate = `${targetYear}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return { startDate, endDate, label: `${monthNames[m - 1]} ${targetYear}` };
    }

    const startDate = `${targetYear}-01-01`;
    const endDate = `${targetYear}-12-31 23:59:59`;
    return { startDate, endDate, label: `Academic Year ${targetYear}` };
  }

  /**
   * GET /api/admin/reports/active-students
   * Aggregates active student statistics for selected date/month ranges, departments, and degree programs.
   */
  static async getActiveStudentsAnalytics(req, res) {
    try {
      const { month, year, department, degreeType } = req.query;
      const { startDate, endDate, label: periodLabel } = AdminController.getDateRange(month, year);

      const studentFilters = [];
      const studentParams = [];

      if (department && department !== 'all') {
        studentFilters.push('LOWER(u.department) = LOWER(?)');
        studentParams.push(department.trim());
      }

      if (degreeType && degreeType !== 'all') {
        studentFilters.push('LOWER(COALESCE(u.degree_type, "BE")) = LOWER(?)');
        studentParams.push(degreeType.trim());
      }

      const studentWhereClause = studentFilters.length > 0 ? `AND ${studentFilters.join(' AND ')}` : '';

      // 1. Overall student pool metrics
      const [studentStats] = await pool.query(`
        SELECT 
          COUNT(*) AS total_registered_students,
          SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) AS total_active_status_students,
          SUM(CASE WHEN u.has_desk_hold = 1 THEN 1 ELSE 0 END) AS total_desk_hold_students
        FROM users u
        WHERE (u.role_id IN (3, 5, 6) OR LOWER(u.department) NOT IN ('administration', 'library'))
        ${studentWhereClause}
      `, studentParams);

      // 2. Circulation and active borrowing metrics in the date range
      const [circulationStats] = await pool.query(`
        SELECT
          COUNT(DISTINCT bt.user_id) AS active_borrowers_count,
          COUNT(bt.id) AS total_issues_count,
          SUM(CASE WHEN bt.status = 'returned' THEN 1 ELSE 0 END) AS total_returned_count,
          SUM(CASE WHEN bt.status = 'returned' AND (bt.return_date <= bt.due_date OR DATEDIFF(bt.return_date, bt.due_date) <= 0) THEN 1 ELSE 0 END) AS on_time_returns_count,
          SUM(CASE WHEN bt.status IN ('active', 'overdue') AND bt.due_date < CURDATE() THEN 1 ELSE 0 END) AS current_overdue_count,
          SUM(CASE WHEN bt.status = 'active' THEN 1 ELSE 0 END) AS currently_issued_count
        FROM book_transactions bt
        JOIN users u ON bt.user_id = u.id
        WHERE bt.checkout_date BETWEEN ? AND ?
        ${studentWhereClause}
      `, [startDate, endDate, ...studentParams]);

      const circ = circulationStats[0] || {};
      const totalReturned = Number(circ.total_returned_count || 0);
      const onTimeReturned = Number(circ.on_time_returns_count || 0);
      const onTimeRate = totalReturned > 0 ? Number(((onTimeReturned / totalReturned) * 100).toFixed(1)) : 100.0;

      // 3. Fines metrics in the date range
      const [fineStats] = await pool.query(`
        SELECT
          COALESCE(SUM(f.amount), 0) AS total_fines_assessed,
          COALESCE(SUM(CASE WHEN f.status = 'paid' THEN f.amount_paid ELSE 0 END), 0) AS total_fines_collected,
          COALESCE(SUM(CASE WHEN f.status = 'waived' THEN f.amount ELSE 0 END), 0) AS total_fines_waived,
          COALESCE(SUM(CASE WHEN f.status IN ('pending', 'disputed') THEN f.amount ELSE 0 END), 0) AS pending_fines_amount
        FROM fines f
        JOIN users u ON f.user_id = u.id
        WHERE f.created_at BETWEEN ? AND ?
        ${studentWhereClause}
      `, [startDate, endDate, ...studentParams]);

      // 4. Department-wise breakdown
      const [departmentBreakdown] = await pool.query(`
        SELECT 
          COALESCE(NULLIF(TRIM(u.department), ''), 'Unassigned') AS department,
          COUNT(DISTINCT u.id) AS total_students,
          COUNT(DISTINCT CASE WHEN bt.id IS NOT NULL THEN u.id END) AS active_borrowers,
          COUNT(bt.id) AS total_issues,
          SUM(CASE WHEN bt.status = 'returned' AND (bt.return_date <= bt.due_date OR DATEDIFF(bt.return_date, bt.due_date) <= 0) THEN 1 ELSE 0 END) AS on_time_returns,
          SUM(CASE WHEN bt.status = 'returned' THEN 1 ELSE 0 END) AS total_returns,
          SUM(CASE WHEN bt.status IN ('active', 'overdue') AND bt.due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue_count
        FROM users u
        LEFT JOIN book_transactions bt 
          ON u.id = bt.user_id 
          AND bt.checkout_date BETWEEN ? AND ?
        WHERE (u.role_id IN (3, 5, 6) OR LOWER(u.department) NOT IN ('administration', 'library'))
        ${studentWhereClause}
        GROUP BY COALESCE(NULLIF(TRIM(u.department), ''), 'Unassigned')
        ORDER BY total_issues DESC, active_borrowers DESC
      `, [startDate, endDate, ...studentParams]);

      const formattedDeptBreakdown = departmentBreakdown.map((d) => {
        const ret = Number(d.total_returns || 0);
        const onTime = Number(d.on_time_returns || 0);
        const rate = ret > 0 ? Number(((onTime / ret) * 100).toFixed(1)) : 100.0;
        return {
          department: d.department,
          total_students: Number(d.total_students || 0),
          active_borrowers: Number(d.active_borrowers || 0),
          total_issues: Number(d.total_issues || 0),
          on_time_returns: onTime,
          overdue_count: Number(d.overdue_count || 0),
          on_time_rate: rate,
        };
      });

      // 5. Degree distribution breakdown
      const [degreeDistribution] = await pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(u.degree_type), ''), 'UG') AS degree_type,
          COUNT(DISTINCT u.id) AS student_count,
          COUNT(DISTINCT CASE WHEN bt.id IS NOT NULL THEN u.id END) AS active_borrowers,
          COUNT(bt.id) AS total_issues
        FROM users u
        LEFT JOIN book_transactions bt 
          ON u.id = bt.user_id 
          AND bt.checkout_date BETWEEN ? AND ?
        WHERE (u.role_id IN (3, 5, 6) OR LOWER(u.department) NOT IN ('administration', 'library'))
        ${studentWhereClause}
        GROUP BY COALESCE(NULLIF(TRIM(u.degree_type), ''), 'UG')
        ORDER BY total_issues DESC
      `, [startDate, endDate, ...studentParams]);

      // 6. Top active student borrowers in the period
      const [topBorrowers] = await pool.query(`
        SELECT
          u.id,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
          u.student_id AS roll_number,
          u.email,
          u.department,
          u.degree_type,
          COUNT(bt.id) AS books_borrowed,
          SUM(CASE WHEN bt.status = 'active' THEN 1 ELSE 0 END) AS active_loans
        FROM users u
        JOIN book_transactions bt ON u.id = bt.user_id
        WHERE bt.checkout_date BETWEEN ? AND ?
        ${studentWhereClause}
        GROUP BY u.id, u.first_name, u.last_name, u.student_id, u.email, u.department, u.degree_type
        ORDER BY books_borrowed DESC
        LIMIT 10
      `, [startDate, endDate, ...studentParams]);

      return res.json({
        success: true,
        period: {
          startDate,
          endDate,
          label: periodLabel,
          month: month || 'all',
          year: year || new Date().getFullYear(),
        },
        filters: {
          department: department || 'all',
          degreeType: degreeType || 'all',
        },
        summary: {
          total_registered_students: Number(studentStats[0]?.total_registered_students || 0),
          total_active_students: Number(studentStats[0]?.total_active_status_students || 0),
          active_borrowers: Number(circ.active_borrowers_count || 0),
          total_issues: Number(circ.total_issues_count || 0),
          total_returned: totalReturned,
          on_time_returns: onTimeReturned,
          on_time_return_rate: onTimeRate,
          currently_issued: Number(circ.currently_issued_count || 0),
          overdue_items: Number(circ.current_overdue_count || 0),
          desk_holds_count: Number(studentStats[0]?.total_desk_hold_students || 0),
        },
        financials: {
          fines_assessed: Number(fineStats[0]?.total_fines_assessed || 0),
          fines_collected: Number(fineStats[0]?.total_fines_collected || 0),
          fines_waived: Number(fineStats[0]?.total_fines_waived || 0),
          pending_fines: Number(fineStats[0]?.pending_fines_amount || 0),
        },
        department_breakdown: formattedDeptBreakdown,
        degree_distribution: degreeDistribution.map((d) => ({
          degree_type: d.degree_type,
          student_count: Number(d.student_count || 0),
          active_borrowers: Number(d.active_borrowers || 0),
          total_issues: Number(d.total_issues || 0),
        })),
        top_borrowers: topBorrowers.map((b) => ({
          id: b.id,
          name: b.student_name.trim(),
          roll_number: b.roll_number || `STU-${b.id}`,
          email: b.email,
          department: b.department || 'N/A',
          degree_type: b.degree_type || 'UG',
          books_borrowed: Number(b.books_borrowed || 0),
          active_loans: Number(b.active_loans || 0),
        })),
      });
    } catch (error) {
      console.error('Error in getActiveStudentsAnalytics:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/reports/generate-pdf
   * Accepts { templateId, month, year, department, degreeType }
   * Dynamically renders and streams an institutional PDF document.
   */
  static async generateActiveStudentsPDF(req, res) {
    try {
      const { templateId, month, year, department, degreeType } = req.body || {};
      const { startDate, endDate, label: periodLabel } = AdminController.getDateRange(month, year);

      let template = {
        template_name: 'Standard Institutional Report',
        header_title: 'Central Library - Active Student Circulation & Analytics Report',
        institution_name: 'National Engineering College',
        show_department_breakdown: true,
        show_fine_summary: true,
        custom_footer_notes:
          'This official report is generated dynamically by the Central Library Information Management System for institutional review, academic council auditing, and NAAC/NBA criteria documentation.',
      };

      if (templateId) {
        const [templates] = await pool.query('SELECT * FROM report_templates WHERE id = ?', [templateId]);
        if (templates.length > 0) {
          template = {
            ...template,
            ...templates[0],
            show_department_breakdown: Boolean(templates[0].show_department_breakdown),
            show_fine_summary: Boolean(templates[0].show_fine_summary),
          };
        }
      }

      const mockReq = { query: { month, year, department, degreeType } };
      let analyticsData = null;

      const mockRes = {
        json(data) {
          analyticsData = data;
          return this;
        },
        status() {
          return this;
        },
      };

      await AdminController.getActiveStudentsAnalytics(mockReq, mockRes);
      if (!analyticsData || !analyticsData.success) {
        throw new Error('Failed to compute analytics for PDF generation.');
      }

      const { summary, financials, department_breakdown, top_borrowers } = analyticsData;
      const reportRef = `REF/LIB/${year || new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
      const generatedDate = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `${template.header_title} - ${periodLabel}`,
          Author: template.institution_name,
          Subject: 'Active Student Circulation Analytics',
        },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Active_Students_Report_${(month || 'All').toString()}_${(year || '2026').toString()}.pdf"`
      );
      doc.pipe(res);

      const primaryColor = '#1e3a8a';
      const secondaryColor = '#4338ca';
      const textColor = '#1e293b';
      const mutedColor = '#64748b';
      const borderColor = '#e2e8f0';

      // ── INSTITUTIONAL HEADER ──────────────────────────────────────────
      doc.rect(40, 40, 515, 60).fill('#f8fafc');
      doc.rect(40, 40, 6, 60).fill(primaryColor);

      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
        .text(template.institution_name.toUpperCase(), 56, 48, { characterSpacing: 0.5 });

      doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold')
        .text(template.header_title, 56, 66);

      doc.fillColor(mutedColor).fontSize(8).font('Helvetica')
        .text(`Scope: ${periodLabel} | Filter: Dept: ${department || 'All'}, Degree: ${degreeType || 'All'}`, 56, 82);

      doc.fillColor(mutedColor).fontSize(8).font('Helvetica')
        .text(`Ref: ${reportRef}`, 420, 48, { align: 'right', width: 125 })
        .text(`Date: ${generatedDate}`, 420, 62, { align: 'right', width: 125 });

      doc.y = 115;

      // ── EXECUTIVE KPI METRICS GRID ───────────────────────────────────
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
        .text('EXECUTIVE CIRCULATION SUMMARY', 40, doc.y);

      doc.strokeColor(borderColor).lineWidth(1).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
      doc.y += 12;

      const cardY = doc.y;
      const cardWidth = 122;
      const cardHeight = 48;
      const cards = [
        { label: 'Active Borrowers', val: `${summary.active_borrowers} / ${summary.total_registered_students}` },
        { label: 'Books Circulated', val: String(summary.total_issues) },
        { label: 'On-Time Return Rate', val: `${summary.on_time_return_rate}%` },
        { label: 'Overdue Items', val: String(summary.overdue_items) },
      ];

      cards.forEach((c, idx) => {
        const cx = 40 + idx * (cardWidth + 8);
        doc.rect(cx, cardY, cardWidth, cardHeight).fillAndStroke('#f1f5f9', borderColor);
        doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica-Bold')
          .text(c.label.toUpperCase(), cx + 6, cardY + 8, { width: cardWidth - 12 });
        doc.fillColor(secondaryColor).fontSize(13).font('Helvetica-Bold')
          .text(c.val, cx + 6, cardY + 24, { width: cardWidth - 12 });
      });

      doc.y = cardY + cardHeight + 16;

      // ── DEPARTMENT-WISE BREAKDOWN TABLE ───────────────────────────────
      if (template.show_department_breakdown && department_breakdown.length > 0) {
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
          .text('DEPARTMENT-WISE CIRCULATION BREAKDOWN', 40, doc.y);
        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.y += 10;

        const tableTop = doc.y;
        doc.rect(40, tableTop, 515, 18).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
        doc.text('DEPARTMENT', 46, tableTop + 5, { width: 140 });
        doc.text('TOTAL STUDENTS', 190, tableTop + 5, { width: 80, align: 'right' });
        doc.text('ACTIVE BORROWERS', 275, tableTop + 5, { width: 85, align: 'right' });
        doc.text('BOOKS ISSUED', 365, tableTop + 5, { width: 65, align: 'right' });
        doc.text('ON-TIME %', 435, tableTop + 5, { width: 55, align: 'right' });
        doc.text('OVERDUE', 495, tableTop + 5, { width: 50, align: 'right' });

        let currentY = tableTop + 18;

        department_breakdown.slice(0, 10).forEach((dept, i) => {
          const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, currentY, 515, 16).fill(rowBg);

          doc.fillColor(textColor).fontSize(7.5).font('Helvetica');
          doc.text(dept.department, 46, currentY + 4, { width: 140 });
          doc.text(String(dept.total_students), 190, currentY + 4, { width: 80, align: 'right' });
          doc.text(String(dept.active_borrowers), 275, currentY + 4, { width: 85, align: 'right' });
          doc.text(String(dept.total_issues), 365, currentY + 4, { width: 65, align: 'right' });
          doc.text(`${dept.on_time_rate}%`, 435, currentY + 4, { width: 55, align: 'right' });
          doc.fillColor(dept.overdue_count > 0 ? '#b91c1c' : textColor)
            .text(String(dept.overdue_count), 495, currentY + 4, { width: 50, align: 'right' });

          currentY += 16;
        });

        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, currentY).lineTo(555, currentY).stroke();
        doc.y = currentY + 14;
      }

      // ── FINANCIAL & FINE SUMMARY ──────────────────────────────────────
      if (template.show_fine_summary) {
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
          .text('FINE & FISCAL RECOVERY SUMMARY', 40, doc.y);
        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.y += 10;

        const fineBoxY = doc.y;
        const fineWidth = 122;
        const fineCards = [
          { label: 'Assessed Fines', val: `₹${financials.fines_assessed.toFixed(2)}` },
          { label: 'Cash Collected', val: `₹${financials.fines_collected.toFixed(2)}` },
          { label: 'Directly Waived', val: `₹${financials.fines_waived.toFixed(2)}` },
          { label: 'Pending Balance', val: `₹${financials.pending_fines.toFixed(2)}` },
        ];

        fineCards.forEach((c, idx) => {
          const fx = 40 + idx * (fineWidth + 8);
          doc.rect(fx, fineBoxY, fineWidth, 42).fillAndStroke('#faf5ff', '#e9d5ff');
          doc.fillColor('#6b21a8').fontSize(7).font('Helvetica-Bold')
            .text(c.label.toUpperCase(), fx + 6, fineBoxY + 6, { width: fineWidth - 12 });
          doc.fillColor('#581c87').fontSize(12).font('Helvetica-Bold')
            .text(c.val, fx + 6, fineBoxY + 20, { width: fineWidth - 12 });
        });

        doc.y = fineBoxY + 54;
      }

      // ── TOP ACTIVE BORROWERS ──────────────────────────────────────────
      if (top_borrowers && top_borrowers.length > 0 && doc.y < 650) {
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
          .text('TOP ACTIVE BORROWERS', 40, doc.y);
        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.y += 10;

        const bHeaderY = doc.y;
        doc.rect(40, bHeaderY, 515, 16).fill('#f1f5f9');
        doc.fillColor(textColor).fontSize(7.5).font('Helvetica-Bold');
        doc.text('STUDENT NAME', 46, bHeaderY + 4, { width: 150 });
        doc.text('ROLL NO', 200, bHeaderY + 4, { width: 80 });
        doc.text('DEPARTMENT', 285, bHeaderY + 4, { width: 100 });
        doc.text('DEGREE', 390, bHeaderY + 4, { width: 60 });
        doc.text('ISSUES', 460, bHeaderY + 4, { width: 85, align: 'right' });

        let bRowY = bHeaderY + 16;
        top_borrowers.slice(0, 5).forEach((b) => {
          doc.fillColor(textColor).fontSize(7.5).font('Helvetica');
          doc.text(b.name, 46, bRowY + 3, { width: 150 });
          doc.text(b.roll_number, 200, bRowY + 3, { width: 80 });
          doc.text(b.department, 285, bRowY + 3, { width: 100 });
          doc.text(b.degree_type, 390, bRowY + 3, { width: 60 });
          doc.text(String(b.books_borrowed), 460, bRowY + 3, { width: 85, align: 'right' });
          bRowY += 14;
        });

        doc.y = bRowY + 14;
      }

      if (doc.y > 690) {
        doc.addPage();
      }

      // ── VERIFICATION & SIGNATURE BLOCKS ──────────────────────────────
      const sigY = 720;
      doc.strokeColor('#cbd5e1').lineWidth(1);

      const sigCols = [
        { label: 'Circulation In-Charge\n(Report Prepared By)', x: 40, width: 150 },
        { label: 'Chief Librarian\n(Central Library)', x: 220, width: 150 },
        { label: 'Principal / Dean\n(Approved Authority)', x: 400, width: 155 },
      ];

      sigCols.forEach((sig) => {
        doc.moveTo(sig.x, sigY).lineTo(sig.x + sig.width, sigY).stroke();
        doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica-Bold')
          .text(sig.label, sig.x, sigY + 6, { align: 'center', width: sig.width });
      });

      // ── FOOTER NOTES ─────────────────────────────────────────────────
      if (template.custom_footer_notes) {
        doc.fillColor(mutedColor).fontSize(6.5).font('Helvetica-Oblique')
          .text(template.custom_footer_notes, 40, 770, { width: 515, align: 'center' });
      }

      doc.end();
    } catch (error) {
      console.error('Error generating Active Students PDF:', error);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: error.message });
      }
    }
  }

  /**
   * GET /api/admin/reports/templates
   */
  static async getTemplates(req, res) {
    try {
      const [rows] = await pool.query('SELECT * FROM report_templates ORDER BY id ASC');
      return res.json({
        success: true,
        templates: rows.map((r) => ({
          ...r,
          show_department_breakdown: Boolean(r.show_department_breakdown),
          show_fine_summary: Boolean(r.show_fine_summary),
        })),
      });
    } catch (error) {
      console.error('Error in getTemplates:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/reports/templates
   */
  static async saveTemplate(req, res) {
    try {
      const {
        template_name,
        header_title,
        institution_name,
        show_department_breakdown = true,
        show_fine_summary = true,
        custom_footer_notes,
      } = req.body;

      if (!template_name || !header_title || !institution_name) {
        return res.status(400).json({
          success: false,
          message: 'Template name, header title, and institution name are required.',
        });
      }

      const [result] = await pool.query(
        `INSERT INTO report_templates (template_name, header_title, institution_name, show_department_breakdown, show_fine_summary, custom_footer_notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          template_name.trim(),
          header_title.trim(),
          institution_name.trim(),
          Boolean(show_department_breakdown),
          Boolean(show_fine_summary),
          custom_footer_notes || '',
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Report template created successfully.',
        template_id: result.insertId,
      });
    } catch (error) {
      console.error('Error in saveTemplate:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/admin/reports/templates/:id
   */
  static async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const {
        template_name,
        header_title,
        institution_name,
        show_department_breakdown,
        show_fine_summary,
        custom_footer_notes,
      } = req.body;

      await pool.query(
        `UPDATE report_templates
         SET template_name = COALESCE(?, template_name),
             header_title = COALESCE(?, header_title),
             institution_name = COALESCE(?, institution_name),
             show_department_breakdown = COALESCE(?, show_department_breakdown),
             show_fine_summary = COALESCE(?, show_fine_summary),
             custom_footer_notes = COALESCE(?, custom_footer_notes)
         WHERE id = ?`,
        [
          template_name?.trim() || null,
          header_title?.trim() || null,
          institution_name?.trim() || null,
          show_department_breakdown !== undefined ? Boolean(show_department_breakdown) : null,
          show_fine_summary !== undefined ? Boolean(show_fine_summary) : null,
          custom_footer_notes !== undefined ? custom_footer_notes : null,
          id,
        ]
      );

      return res.json({
        success: true,
        message: 'Report template updated successfully.',
      });
    } catch (error) {
      console.error('Error in updateTemplate:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/admin/department-policies
   * Lists all configured department lending rules.
   */
  static async getDepartmentPolicies(req, res) {
    try {
      const [rows] = await pool.query(`
        SELECT * FROM department_policies
        ORDER BY CASE WHEN department_code = 'DEFAULT' THEN 1 ELSE 2 END, department_code ASC
      `);

      return res.json({
        success: true,
        policies: rows.map((p) => ({
          ...p,
          allow_direct_thesis_checkout: Boolean(p.allow_direct_thesis_checkout),
          daily_fine_rate: Number(p.daily_fine_rate),
        })),
      });
    } catch (error) {
      console.error('Error in getDepartmentPolicies:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/admin/department-policies/:department_code
   * Updates limits, loan durations, thesis permissions, and fine rates.
   */
  static async updateDepartmentPolicy(req, res) {
    try {
      const { department_code } = req.params;
      const {
        department_name,
        max_borrow_limit_ug,
        loan_duration_days_ug,
        max_borrow_limit_pg,
        loan_duration_days_pg,
        allow_direct_thesis_checkout,
        daily_fine_rate,
      } = req.body;

      const code = department_code.toUpperCase().trim();

      const [existing] = await pool.query('SELECT * FROM department_policies WHERE department_code = ?', [code]);
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Department policy "${code}" not found.`,
        });
      }

      await pool.query(
        `UPDATE department_policies
         SET department_name = COALESCE(?, department_name),
             max_borrow_limit_ug = COALESCE(?, max_borrow_limit_ug),
             loan_duration_days_ug = COALESCE(?, loan_duration_days_ug),
             max_borrow_limit_pg = COALESCE(?, max_borrow_limit_pg),
             loan_duration_days_pg = COALESCE(?, loan_duration_days_pg),
             allow_direct_thesis_checkout = COALESCE(?, allow_direct_thesis_checkout),
             daily_fine_rate = COALESCE(?, daily_fine_rate)
         WHERE department_code = ?`,
        [
          department_name?.trim() || null,
          max_borrow_limit_ug !== undefined ? Number(max_borrow_limit_ug) : null,
          loan_duration_days_ug !== undefined ? Number(loan_duration_days_ug) : null,
          max_borrow_limit_pg !== undefined ? Number(max_borrow_limit_pg) : null,
          loan_duration_days_pg !== undefined ? Number(loan_duration_days_pg) : null,
          allow_direct_thesis_checkout !== undefined ? Boolean(allow_direct_thesis_checkout) : null,
          daily_fine_rate !== undefined ? Number(daily_fine_rate) : null,
          code,
        ]
      );

      return res.json({
        success: true,
        message: `Department policy for ${code} updated successfully.`,
      });
    } catch (error) {
      console.error('Error in updateDepartmentPolicy:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/department-policies
   * Adds a new department policy.
   */
  static async createDepartmentPolicy(req, res) {
    try {
      const {
        department_code,
        department_name,
        max_borrow_limit_ug = 6,
        loan_duration_days_ug = 14,
        max_borrow_limit_pg = 10,
        loan_duration_days_pg = 60,
        allow_direct_thesis_checkout = false,
        daily_fine_rate = 2.0,
      } = req.body;

      if (!department_code) {
        return res.status(400).json({
          success: false,
          message: 'Department code is required.',
        });
      }

      const code = department_code.toUpperCase().trim();

      const [existing] = await pool.query('SELECT * FROM department_policies WHERE department_code = ?', [code]);
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Department policy for "${code}" already exists. Use PUT to modify.`,
        });
      }

      const [result] = await pool.query(
        `INSERT INTO department_policies 
         (department_code, department_name, max_borrow_limit_ug, loan_duration_days_ug, max_borrow_limit_pg, loan_duration_days_pg, allow_direct_thesis_checkout, daily_fine_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          department_name?.trim() || code,
          Number(max_borrow_limit_ug),
          Number(loan_duration_days_ug),
          Number(max_borrow_limit_pg),
          Number(loan_duration_days_pg),
          Boolean(allow_direct_thesis_checkout),
          Number(daily_fine_rate),
        ]
      );

      return res.status(201).json({
        success: true,
        message: `Department policy for ${code} created successfully.`,
        policy_id: result.insertId,
      });
    } catch (error) {
      console.error('Error in createDepartmentPolicy:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = AdminController;
