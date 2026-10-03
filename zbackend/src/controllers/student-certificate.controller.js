/**
 * Student Certificate & Gamification Controller
 * Handles monthly top reader certificate generation, eligibility computation,
 * persistence in student_certificates, and public verification.
 */

const crypto = require('node:crypto');
const { pool } = require('../config/database');

class StudentCertificateController {
  /**
   * Helper to format month name & year (e.g. "October 2026")
   */
  static formatMonthYear(month, year) {
    const date = new Date(year, month - 1, 1);
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    return `${monthName} ${year}`;
  }

  /**
   * GET /api/students/my-certificate
   * Returns verified certificate payload for qualified top readers of the month
   */
  static async getMyCertificate(req, res) {
    try {
      const sessionUser = req.user || req.session?.user;
      let targetUserId = sessionUser?.id;

      // Allow admins and librarians to view a specific student's certificate via ?user_id=
      const roleName = String(
        sessionUser?.role || sessionUser?.role_name || sessionUser?.role?.role_name || ''
      ).toLowerCase();
      if ((roleName === 'admin' || roleName === 'librarian') && req.query.user_id) {
        targetUserId = parseInt(req.query.user_id, 10);
      }

      if (!targetUserId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required to retrieve achievement certificate.',
        });
      }

      const now = new Date();
      let month = parseInt(req.query.month, 10) || now.getMonth() + 1;
      let year = parseInt(req.query.year, 10) || now.getFullYear();

      if (month < 1 || month > 12) {
        return res.status(400).json({ error: 'Invalid month (1-12)' });
      }

      const monthYearLabel = StudentCertificateController.formatMonthYear(month, year);

      // 1. Fetch Student Details
      const [userRows] = await pool.execute(
        `SELECT id, first_name, last_name, email, student_id, department, academic_year
         FROM users
         WHERE id = ?`,
        [targetUserId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }
      const student = userRows[0];

      // 2. Count Student's checkouts for the selected month
      const [[borrowStats]] = await pool.execute(
        `SELECT 
           COUNT(id) AS total_borrows,
           COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) AS returned_count
         FROM book_transactions
         WHERE user_id = ?
           AND MONTH(checkout_date) = ?
           AND YEAR(checkout_date) = ?`,
        [targetUserId, month, year]
      );

      const totalBorrows = parseInt(borrowStats?.total_borrows, 10) || 0;

      // 3. Compute Monthly Leaderboard to determine rank & top reader qualification
      const [leaderboard] = await pool.execute(
        `SELECT 
           bt.user_id,
           COUNT(bt.id) AS borrow_count
         FROM book_transactions bt
         JOIN users u ON bt.user_id = u.id
         JOIN user_roles r ON u.role_id = r.id
         WHERE (r.role_name = 'student' OR u.role_id = 3)
           AND MONTH(bt.checkout_date) = ?
           AND YEAR(bt.checkout_date) = ?
         GROUP BY bt.user_id
         ORDER BY borrow_count DESC
         LIMIT 20`,
        [month, year]
      );

      const rankIndex = leaderboard.findIndex((entry) => entry.user_id === targetUserId);
      const studentRank = rankIndex !== -1 ? rankIndex + 1 : null;

      // Qualification rule:
      // Student has read >= 3 books in the month OR is within the Top 5 readers with >= 1 book
      const isTopFive = studentRank !== null && studentRank <= 5 && totalBorrows >= 1;
      const hasReachedQuota = totalBorrows >= 3;
      const isEligible = isTopFive || hasReachedQuota;

      if (!isEligible) {
        return res.json({
          success: true,
          eligible: false,
          month_year: monthYearLabel,
          student: {
            id: student.id,
            name: `${student.first_name} ${student.last_name}`,
            student_id: student.student_id || `STU-${student.id}`,
            department: student.department || 'Engineering',
          },
          metrics: {
            books_read_count: totalBorrows,
            target_count: 3,
            books_needed: Math.max(0, 3 - totalBorrows),
            rank: studentRank || 'Unranked',
          },
          message: `You have borrowed ${totalBorrows} book(s) in ${monthYearLabel}. Borrow ${Math.max(1, 3 - totalBorrows)} more to unlock your Top Reader Certificate!`,
        });
      }

      // 4. Check if Certificate already persisted in student_certificates
      const [existingCert] = await pool.execute(
        `SELECT id, certificate_id, issued_at, books_read_count
         FROM student_certificates
         WHERE user_id = ? AND month_year = ?`,
        [targetUserId, monthYearLabel]
      );

      let certificateId;
      let issuedAt;

      if (existingCert.length > 0) {
        certificateId = existingCert[0].certificate_id;
        issuedAt = existingCert[0].issued_at;
        // Optionally update books_read_count if it increased
        if (totalBorrows > existingCert[0].books_read_count) {
          await pool.execute(
            'UPDATE student_certificates SET books_read_count = ? WHERE id = ?',
            [totalBorrows, existingCert[0].id]
          );
        }
      } else {
        // Generate new unique certificate code: e.g. CERT-202610-STU001-9F2B
        const cleanStudentCode = (student.student_id || `STU${student.id}`).replace(/[^a-zA-Z0-9]/g, '');
        const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
        certificateId = `CERT-${year}${String(month).padStart(2, '0')}-${cleanStudentCode}-${randomHex}`;
        issuedAt = new Date();

        await pool.execute(
          `INSERT INTO student_certificates (user_id, month_year, books_read_count, certificate_id, issued_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE books_read_count = VALUES(books_read_count)`,
          [targetUserId, monthYearLabel, totalBorrows, certificateId, issuedAt]
        );
      }

      res.json({
        success: true,
        eligible: true,
        month_year: monthYearLabel,
        certificate: {
          certificate_id: certificateId,
          title: 'Top Active Reader of the Month',
          student_id: student.student_id || `STU-${student.id}`,
          student_name: `${student.first_name} ${student.last_name}`,
          email: student.email,
          department: student.department || 'Computer Science & Engineering',
          academic_year: student.academic_year || 'Undergraduate',
          month_year: monthYearLabel,
          books_read_count: totalBorrows,
          rank: studentRank || 1,
          issued_at: issuedAt,
          issuer: 'Central University Library & Information Centre',
          status: 'VERIFIED',
          verification_url: `/api/v1/certificates/verify/${certificateId}`,
        },
      });
    } catch (err) {
      console.error('Get student certificate error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }

  /**
   * GET /api/certificates/verify/:certificateId
   * Public verification endpoint
   */
  static async verifyCertificate(req, res) {
    try {
      const { certificateId } = req.params;

      const [rows] = await pool.execute(
        `SELECT 
           sc.id,
           sc.certificate_id,
           sc.month_year,
           sc.books_read_count,
           sc.issued_at,
           u.first_name,
           u.last_name,
           u.student_id,
           u.department
         FROM student_certificates sc
         JOIN users u ON sc.user_id = u.id
         WHERE sc.certificate_id = ?`,
        [certificateId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          valid: false,
          error: 'Certificate Not Found',
          message: `Certificate ID "${certificateId}" is not recognized or invalid.`,
        });
      }

      const cert = rows[0];

      res.json({
        valid: true,
        certificate_id: cert.certificate_id,
        recipient_name: `${cert.first_name} ${cert.last_name}`,
        student_id: cert.student_id || 'N/A',
        department: cert.department || 'Academic Department',
        award_title: 'Active Library User of the Month',
        period: cert.month_year,
        books_borrowed: cert.books_read_count,
        issued_date: cert.issued_at,
        issuer: 'Central University Library & Information Centre',
        verification_status: 'AUTHENTIC & VERIFIED',
      });
    } catch (err) {
      console.error('Verify certificate error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }
}

module.exports = StudentCertificateController;
