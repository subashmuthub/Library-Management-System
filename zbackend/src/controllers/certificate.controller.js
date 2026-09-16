/**
 * Certificate Controller
 * Computes the "Active Library User of the Month" dynamically
 * based on transaction (borrow + return) activity for the given month/year.
 * Gracefully handles missing optional columns in the users table.
 */

const { pool } = require('../config/database');

// Cache the optional columns check (reset on each server start)
let _optionalCols = null;

async function getOptionalCols() {
  if (_optionalCols) return _optionalCols;
  const optionalFields = ['profile_image_url', 'year_of_study', 'department'];
  const [rows] = await pool.execute(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users'
     AND column_name IN (${optionalFields.map(() => '?').join(',')})`,
    optionalFields
  );
  const found = new Set(rows.map(r => r.column_name));
  _optionalCols = {
    hasProfileImage: found.has('profile_image_url'),
    hasYearOfStudy:  found.has('year_of_study'),
    hasDepartment:   found.has('department'),
  };
  return _optionalCols;
}

function buildSelectFields(cols) {
  const fields = [];
  if (cols.hasProfileImage) fields.push('u.profile_image_url');
  if (cols.hasDepartment)   fields.push('u.department');
  if (cols.hasYearOfStudy)  fields.push('u.year_of_study');
  return fields.length ? fields.join(',\n            ') + ',' : '';
}

function buildGroupByFields(cols) {
  const fields = [];
  if (cols.hasProfileImage) fields.push('u.profile_image_url');
  if (cols.hasDepartment)   fields.push('u.department');
  if (cols.hasYearOfStudy)  fields.push('u.year_of_study');
  return fields.length ? ', ' + fields.join(', ') : '';
}

class CertificateController {
  /**
   * GET /api/v1/certificates/active-user
   * Query params: month (1-12), year (YYYY), user_id (optional override)
   */
  static async getActiveUser(req, res) {
    try {
      let { month, year, user_id } = req.query;
      const now = new Date();
      month = parseInt(month, 10) || now.getMonth() + 1;
      year  = parseInt(year,  10) || now.getFullYear();

      if (month < 1 || month > 12) {
        return res.status(400).json({ error: 'Invalid month (1-12)' });
      }

      const cols = await getOptionalCols();
      const selectExtra  = buildSelectFields(cols);
      const groupByExtra = buildGroupByFields(cols);

      let query, queryParams;

      if (user_id) {
        query = `
          SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.student_id,
            u.email,
            ${selectExtra}
            COUNT(bt.id)                                                      AS total_transactions,
            SUM(CASE WHEN bt.checkout_date IS NOT NULL THEN 1 ELSE 0 END)     AS total_borrowed,
            SUM(CASE WHEN bt.return_date  IS NOT NULL THEN 1 ELSE 0 END)      AS total_returned,
            SUM(CASE WHEN bt.return_date  IS NULL     THEN 1 ELSE 0 END)      AS currently_borrowed
          FROM book_transactions bt
          JOIN users u ON bt.user_id = u.id
          WHERE u.id = ?
          GROUP BY u.id, u.first_name, u.last_name, u.student_id, u.email${groupByExtra}
          LIMIT 1
        `;
        queryParams = [user_id];
      } else {
        query = `
          SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.student_id,
            u.email,
            ${selectExtra}
            COUNT(bt.id)                                                        AS total_transactions,
            SUM(CASE WHEN bt.checkout_date IS NOT NULL THEN 1 ELSE 0 END)       AS total_borrowed,
            SUM(CASE WHEN bt.return_date  IS NOT NULL THEN 1 ELSE 0 END)        AS total_returned,
            SUM(CASE WHEN bt.return_date  IS NULL     THEN 1 ELSE 0 END)        AS currently_borrowed
          FROM book_transactions bt
          JOIN users u ON bt.user_id = u.id
          JOIN user_roles r ON u.role_id = r.id
          WHERE
            r.role_name = 'student'
            AND (
              (MONTH(bt.checkout_date) = ? AND YEAR(bt.checkout_date) = ?)
              OR
              (bt.return_date IS NOT NULL AND MONTH(bt.return_date) = ? AND YEAR(bt.return_date) = ?)
            )
          GROUP BY u.id, u.first_name, u.last_name, u.student_id, u.email${groupByExtra}
          ORDER BY total_transactions DESC, total_returned DESC
          LIMIT 1
        `;
        queryParams = [month, year, month, year];
      }

      const [rows] = await pool.execute(query, queryParams);

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'No active student found',
          message: `No student activity found for ${month}/${year}`
        });
      }

      const student = rows[0];
      const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
      const prefix = CertificateController.genderPrefix(student.first_name);

      res.json({
        success: true,
        month,
        year,
        monthLabel: `${monthName} ${year}`,
        student: {
          id:               student.id,
          name:             `${student.first_name} ${student.last_name}`,
          displayName:      `${prefix}.${student.first_name} ${student.last_name}`,
          rollNo:           student.student_id || 'N/A',
          email:            student.email,
          department:       student.department || 'Engineering',
          yearOfStudy:      student.year_of_study || 'II Year',
          profileImageUrl:  student.profile_image_url || null,
          totalTransactions: student.total_transactions,
          totalBorrowed:    student.total_borrowed,
          totalReturned:    student.total_returned,
          currentlyBorrowed: student.currently_borrowed,
        }
      });

    } catch (err) {
      console.error('Certificate controller error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }

  /**
   * GET /api/v1/certificates/top-students
   * Returns top 10 students for a given month/year
   */
  static async getTopStudents(req, res) {
    try {
      let { month, year } = req.query;
      const now = new Date();
      month = parseInt(month, 10) || now.getMonth() + 1;
      year  = parseInt(year,  10) || now.getFullYear();

      const cols = await getOptionalCols();
      const selectExtra  = buildSelectFields(cols);
      const groupByExtra = buildGroupByFields(cols);

      const [rows] = await pool.execute(`
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.student_id,
          ${selectExtra}
          COUNT(bt.id)                                                        AS total_transactions,
          SUM(CASE WHEN bt.checkout_date IS NOT NULL THEN 1 ELSE 0 END)       AS total_borrowed,
          SUM(CASE WHEN bt.return_date  IS NOT NULL THEN 1 ELSE 0 END)        AS total_returned,
          SUM(CASE WHEN bt.return_date  IS NULL     THEN 1 ELSE 0 END)        AS currently_borrowed
        FROM book_transactions bt
        JOIN users u ON bt.user_id = u.id
        JOIN user_roles r ON u.role_id = r.id
        WHERE
          r.role_name = 'student'
          AND (
            (MONTH(bt.checkout_date) = ? AND YEAR(bt.checkout_date) = ?)
            OR
            (bt.return_date IS NOT NULL AND MONTH(bt.return_date) = ? AND YEAR(bt.return_date) = ?)
          )
        GROUP BY u.id, u.first_name, u.last_name, u.student_id${groupByExtra}
        ORDER BY total_transactions DESC, total_returned DESC
        LIMIT 10
      `, [month, year, month, year]);

      const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });

      res.json({
        success: true,
        monthLabel: `${monthName} ${year}`,
        students: rows.map((s, i) => ({
          rank:              i + 1,
          id:                s.id,
          name:              `${s.first_name} ${s.last_name}`,
          rollNo:            s.student_id || 'N/A',
          department:        s.department || 'Engineering',
          yearOfStudy:       s.year_of_study || 'II Year',
          profileImageUrl:   s.profile_image_url || null,
          totalTransactions: s.total_transactions,
          totalBorrowed:     s.total_borrowed,
          totalReturned:     s.total_returned,
          currentlyBorrowed: s.currently_borrowed,
        }))
      });

    } catch (err) {
      console.error('Top students error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }

  // Simple gender prefix heuristic based on common names
  static genderPrefix(firstName = '') {
    const femaleNames = [
      'karthika', 'priya', 'kavya', 'anitha', 'rekha', 'sunitha', 'deepa',
      'meena', 'nithya', 'lavanya', 'divya', 'sindhu', 'uma', 'janaki',
      'saranya', 'mythili', 'abinaya', 'soundarya', 'lakshmi', 'vaishnavi',
      'harini', 'dharani', 'bhavani', 'sathya', 'mahalakshmi', 'sangeetha',
      'pooja', 'sneha', 'swathi', 'anusha', 'nandini', 'indhumathi',
    ];
    const lower = firstName.toLowerCase();
    return femaleNames.some(n => lower.startsWith(n) || lower === n) ? 'Ms' : 'Mr';
  }
}

module.exports = CertificateController;
