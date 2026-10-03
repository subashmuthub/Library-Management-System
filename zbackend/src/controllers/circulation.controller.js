/**
 * Circulation Controller
 * Handles physical book issuance, student lookup, reservation fulfillment,
 * and circulation desk operations for Clerks, Librarians, and Admins.
 */

const { pool } = require('../config/database');
const { hasDirectResearchAccess } = require('../utils/access-control.helper');

class CirculationController {
  /**
   * GET /api/circulation/student-lookup/:query
   * Look up student / patron by student_id, roll number, email, or database ID.
   * Returns profile, current active loans, overdue items, pending fines, and reservations.
   */
  static async studentLookup(req, res) {
    try {
      const rawQuery = String(req.params.query || '').trim();

      if (!rawQuery) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required (Student ID, Roll No, or Email).'
        });
      }

      const connection = await pool.getConnection();

      try {
        // Find user by student_id, email, or numeric ID
        const isNumeric = /^\d+$/.test(rawQuery);
        let userQuery = `
          SELECT 
            u.id, u.first_name, u.last_name, u.email, u.phone, 
            u.student_id, u.degree_type, u.department, u.academic_year, 
            u.status, u.role_id,
            LOWER(COALESCE(ur.role_name, 
              CASE u.role_id 
                WHEN 1 THEN 'admin'
                WHEN 2 THEN 'librarian'
                WHEN 4 THEN 'staff' 
                WHEN 5 THEN 'me_student' 
                WHEN 6 THEN 'research_scholar' 
                WHEN 7 THEN 'clerk'
                ELSE 'student' 
              END
            )) AS role_name
          FROM users u
          LEFT JOIN user_roles ur ON u.role_id = ur.id
          WHERE u.student_id = ? OR u.email = ?
        `;
        const userParams = [rawQuery, rawQuery];

        if (isNumeric) {
          userQuery += ` OR u.id = ?`;
          userParams.push(Number.parseInt(rawQuery, 10));
        }

        userQuery += ` LIMIT 1`;

        const [users] = await connection.execute(userQuery, userParams);

        if (users.length === 0) {
          connection.release();
          return res.status(404).json({
            success: false,
            message: `No patron found matching "${rawQuery}".`
          });
        }

        const student = users[0];
        const studentId = student.id;
        const roleName = student.role_name;
        const normalizedRoleName = ['teacher', 'faculty', 'staff'].includes(roleName) ? 'staff' : roleName;
        const isDirectResearch = hasDirectResearchAccess(student);

        // Max checkout limit based on role and academic program
        const maxLimit = normalizedRoleName === 'staff' ? 10 : (isDirectResearch ? 8 : 6);

        // Active checkouts
        const [activeLoans] = await connection.execute(`
          SELECT 
            bt.id, bt.book_id, bt.checkout_date, bt.due_date, bt.status,
            b.title, b.author, b.isbn, b.accession_no, b.barcode,
            DATEDIFF(CURDATE(), bt.due_date) AS days_overdue
          FROM book_transactions bt
          JOIN books b ON bt.book_id = b.id
          WHERE bt.user_id = ? AND bt.status = 'active'
          ORDER BY bt.due_date ASC
        `, [studentId]);

        const overdueCount = activeLoans.filter(loan => loan.days_overdue > 0).length;

        // Pending fines
        const [fineRows] = await connection.execute(`
          SELECT COALESCE(SUM(amount), 0) AS total_unpaid_fines, COUNT(*) AS unpaid_count
          FROM fines
          WHERE user_id = ? AND status = 'pending'
        `, [studentId]);

        const unpaidFines = Number(fineRows[0]?.total_unpaid_fines || 0);

        // Active Approved / Ready Reservations from `reservations`
        const [standardReservations] = await connection.execute(`
          SELECT 
            r.id AS reservation_id,
            'standard' AS source,
            r.book_id,
            r.status,
            r.queue_position,
            r.created_at,
            b.title,
            b.author,
            b.isbn,
            b.accession_no,
            b.barcode,
            b.total_copies,
            b.available_copies
          FROM reservations r
          JOIN books b ON r.book_id = b.id
          WHERE r.user_id = ? AND r.status IN ('active', 'ready')
          ORDER BY CASE WHEN r.status = 'ready' THEN 1 ELSE 2 END, r.created_at ASC
        `, [studentId]);

        // Approved research/thesis reservations from `book_reservations`
        const [researchReservations] = await connection.execute(`
          SELECT 
            br.id AS reservation_id,
            'research' AS source,
            br.book_id,
            br.status,
            1 AS queue_position,
            br.created_at,
            b.title,
            b.author,
            b.isbn,
            b.accession_no,
            b.barcode,
            b.total_copies,
            b.available_copies
          FROM book_reservations br
          JOIN books b ON br.book_id = b.id
          WHERE br.user_id = ? AND br.status = 'APPROVED'
          ORDER BY br.created_at ASC
        `, [studentId]);

        const allReservations = [...standardReservations, ...researchReservations];

        connection.release();

        const canBorrow = student.status === 'active' &&
          activeLoans.length < maxLimit &&
          overdueCount === 0;

        return res.json({
          success: true,
          student: {
            id: student.id,
            name: `${student.first_name} ${student.last_name}`.trim(),
            first_name: student.first_name,
            last_name: student.last_name,
            email: student.email,
            phone: student.phone,
            student_id: student.student_id,
            degree_type: student.degree_type,
            department: student.department,
            academic_year: student.academic_year,
            role: normalizedRoleName,
            status: student.status
          },
          stats: {
            active_loans_count: activeLoans.length,
            max_limit: maxLimit,
            remaining_quota: Math.max(0, maxLimit - activeLoans.length),
            overdue_count: overdueCount,
            unpaid_fines: unpaidFines,
            can_borrow: canBorrow,
            default_loan_days: normalizedRoleName === 'staff' ? 60 : 14
          },
          active_loans: activeLoans,
          reservations: allReservations
        });
      } catch (err) {
        connection.release();
        throw err;
      }
    } catch (error) {
      console.error('Error in studentLookup:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during student lookup',
        error: error.message
      });
    }
  }

  /**
   * POST /api/circulation/issue-reserved
   * Issue a reserved book physically to the student at the counter.
   * Body: { reservation_id, source: 'standard' | 'research', barcode_or_accession_no, loan_days }
   */
  static async issueReserved(req, res) {
    const connection = await pool.getConnection();

    try {
      const {
        reservation_id,
        source = 'standard',
        barcode_or_accession_no,
        loan_days
      } = req.body;

      const clerkId = req.user?.id || null;
      const clerkName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Circulation Clerk';

      if (!reservation_id) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Reservation ID is required.'
        });
      }

      await connection.beginTransaction();

      let reservation = null;
      let bookId = null;
      let userId = null;

      if (source === 'research') {
        const [rows] = await connection.execute(
          `SELECT * FROM book_reservations WHERE id = ? AND status = 'APPROVED'`,
          [reservation_id]
        );
        if (rows.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            message: 'Active approved research reservation not found.'
          });
        }
        reservation = rows[0];
        bookId = reservation.book_id;
        userId = reservation.user_id;
      } else {
        const [rows] = await connection.execute(
          `SELECT * FROM reservations WHERE id = ? AND status IN ('active', 'ready')`,
          [reservation_id]
        );
        if (rows.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            message: 'Active reservation not found.'
          });
        }
        reservation = rows[0];
        bookId = reservation.book_id;
        userId = reservation.user_id;
      }

      // Fetch student details
      const [students] = await connection.execute(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.student_id, u.department, u.degree_type,
               LOWER(COALESCE(ur.role_name, 'student')) AS role_name
        FROM users u
        LEFT JOIN user_roles ur ON u.role_id = ur.id
        WHERE u.id = ?
      `, [userId]);

      if (students.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Patron user associated with reservation not found.'
        });
      }

      const student = students[0];
      const isStaff = ['teacher', 'faculty', 'staff'].includes(student.role_name);
      const effectiveLoanDays = Number(loan_days) > 0 ? Number(loan_days) : (isStaff ? 60 : 14);

      // Fetch book details
      const [books] = await connection.execute(`
        SELECT id, title, author, isbn, accession_no, barcode, available_copies, total_copies
        FROM books
        WHERE id = ?
      `, [bookId]);

      if (books.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Book not found.'
        });
      }

      const book = books[0];

      // Check if book has available copies
      if (book.available_copies <= 0) {
        // Check active transactions
        const [activeTx] = await connection.execute(
          `SELECT COUNT(*) as count FROM book_transactions WHERE book_id = ? AND status = 'active'`,
          [bookId]
        );
        if (activeTx[0].count >= book.total_copies) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: 'All physical copies of this book are currently checked out.'
          });
        }
      }

      // Create checkout transaction
      const [txResult] = await connection.execute(`
        INSERT INTO book_transactions (
          user_id, book_id, checkout_date, due_date, 
          issued_by, status, transaction_type
        ) VALUES (
          ?, ?, CURDATE(), 
          DATE_ADD(CURDATE(), INTERVAL ? DAY), 
          ?, 'active', 'checkout'
        )
      `, [userId, bookId, effectiveLoanDays, clerkId]);

      const transactionId = txResult.insertId;

      // Update book copies
      await connection.execute(`
        UPDATE books 
        SET available_copies = GREATEST(0, available_copies - 1),
            is_available = CASE WHEN available_copies <= 1 THEN FALSE ELSE TRUE END
        WHERE id = ?
      `, [bookId]);

      // Fulfill the reservation
      if (source === 'research') {
        await connection.execute(`
          UPDATE book_reservations
          SET status = 'FULFILLED', updated_at = NOW()
          WHERE id = ?
        `, [reservation_id]);
      } else {
        await connection.execute(`
          UPDATE reservations
          SET status = 'fulfilled', fulfilled_date = CURDATE(), 
              fulfilled_by = ?, updated_at = NOW()
          WHERE id = ?
        `, [clerkId, reservation_id]);
      }

      // Fetch generated transaction for receipt
      const [txRows] = await connection.execute(`
        SELECT bt.*, DATE_FORMAT(bt.checkout_date, '%Y-%m-%d') as formatted_issue_date,
               DATE_FORMAT(bt.due_date, '%Y-%m-%d') as formatted_due_date
        FROM book_transactions bt
        WHERE bt.id = ?
      `, [transactionId]);

      await connection.commit();
      connection.release();

      const createdTx = txRows[0];

      return res.json({
        success: true,
        message: `Book "${book.title}" successfully issued to ${student.first_name} ${student.last_name}.`,
        receipt: {
          receipt_no: `REC-${String(transactionId).padStart(6, '0')}`,
          transaction_id: transactionId,
          issue_date: createdTx.formatted_issue_date,
          due_date: createdTx.formatted_due_date,
          loan_days: effectiveLoanDays,
          student: {
            id: student.id,
            name: `${student.first_name} ${student.last_name}`.trim(),
            student_id: student.student_id,
            department: student.department,
            degree_type: student.degree_type,
            email: student.email
          },
          book: {
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            accession_no: barcode_or_accession_no || book.accession_no || `ACC-${String(book.id).padStart(5, '0')}`,
            barcode: book.barcode || `BC-${String(book.id).padStart(6, '0')}`
          },
          issuer: {
            id: clerkId,
            name: clerkName,
            role: req.user?.role || 'clerk'
          }
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Error in issueReserved:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while issuing reserved book.',
        error: error.message
      });
    }
  }

  /**
   * POST /api/circulation/direct-issue
   * Direct issuance of a book by accession number, barcode, RFID tag, or book ID.
   * Body: { user_id, identifier, loan_days }
   */
  static async directIssue(req, res) {
    const connection = await pool.getConnection();

    try {
      const { user_id, identifier, loan_days } = req.body;
      const clerkId = req.user?.id || null;
      const clerkName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Circulation Clerk';

      if (!user_id) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Target Patron / Student User ID is required.'
        });
      }

      if (!identifier) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Book identifier (Accession No, Barcode, ISBN, or RFID Tag) is required.'
        });
      }

      await connection.beginTransaction();

      // Verify student / patron
      const [students] = await connection.execute(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.student_id, u.department, u.degree_type, u.status,
               LOWER(COALESCE(ur.role_name, 'student')) AS role_name
        FROM users u
        LEFT JOIN user_roles ur ON u.role_id = ur.id
        WHERE u.id = ?
      `, [user_id]);

      if (students.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Patron user not found.'
        });
      }

      const student = students[0];
      if (student.status !== 'active') {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Patron account is not active.'
        });
      }

      const isStaff = ['teacher', 'faculty', 'staff'].includes(student.role_name);
      const isDirectResearch = hasDirectResearchAccess(student);
      const maxLimit = isStaff ? 10 : (isDirectResearch ? 8 : 6);

      // Check current active checkouts
      const [activeTx] = await connection.execute(
        `SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = 'active'`,
        [student.id]
      );
      if (activeTx[0].count >= maxLimit) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Cannot issue book: Patron has reached their maximum limit of ${maxLimit} borrowed items.`
        });
      }

      // Check overdue books
      const [overdueRows] = await connection.execute(
        `SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = 'active' AND due_date < CURDATE()`,
        [student.id]
      );
      if (overdueRows[0].count > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Cannot issue book: Patron has ${overdueRows[0].count} overdue book(s). Please return them first.`
        });
      }

      // Find book by accession_no, barcode, isbn, id, or rfid tag
      const trimmedId = String(identifier).trim();
      const isNumeric = /^\d+$/.test(trimmedId);

      let bookQuery = `
        SELECT b.id, b.title, b.author, b.isbn, b.accession_no, b.barcode, 
               b.available_copies, b.total_copies, b.is_restricted_research
        FROM books b
        LEFT JOIN rfid_tags rt ON b.id = rt.book_id
        WHERE b.accession_no = ? 
           OR b.barcode = ? 
           OR b.isbn = ?
           OR rt.tag_id = ?
      `;
      const queryParams = [trimmedId, trimmedId, trimmedId, trimmedId];

      if (isNumeric) {
        bookQuery += ` OR b.id = ?`;
        queryParams.push(Number.parseInt(trimmedId, 10));
      }

      bookQuery += ` LIMIT 1`;

      const [books] = await connection.execute(bookQuery, queryParams);

      if (books.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: `No book found matching identifier "${trimmedId}".`
        });
      }

      const book = books[0];

      // Check restricted research access
      if (book.is_restricted_research && !isDirectResearch && !isStaff) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({
          success: false,
          message: 'This title is a restricted research/thesis item. Normal students require prior Librarian approval before issuance.'
        });
      }

      // Check if book has available copies
      const [bookCurrentLoans] = await connection.execute(
        `SELECT COUNT(*) as count FROM book_transactions WHERE book_id = ? AND status = 'active'`,
        [book.id]
      );

      if (bookCurrentLoans[0].count >= book.total_copies) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `All copies of "${book.title}" are currently checked out.`
        });
      }

      // Check if user already has an active copy of this exact book
      const [alreadyHas] = await connection.execute(
        `SELECT id FROM book_transactions WHERE user_id = ? AND book_id = ? AND status = 'active'`,
        [student.id, book.id]
      );
      if (alreadyHas.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Patron already has an active checkout of "${book.title}".`
        });
      }

      const effectiveLoanDays = Number(loan_days) > 0 ? Number(loan_days) : (isStaff ? 60 : 14);

      // Create transaction
      const [txResult] = await connection.execute(`
        INSERT INTO book_transactions (
          user_id, book_id, checkout_date, due_date,
          issued_by, status, transaction_type
        ) VALUES (
          ?, ?, CURDATE(),
          DATE_ADD(CURDATE(), INTERVAL ? DAY),
          ?, 'active', 'checkout'
        )
      `, [student.id, book.id, effectiveLoanDays, clerkId]);

      const transactionId = txResult.insertId;

      // Update book copies
      await connection.execute(`
        UPDATE books 
        SET available_copies = GREATEST(0, available_copies - 1),
            is_available = CASE WHEN available_copies <= 1 THEN FALSE ELSE TRUE END
        WHERE id = ?
      `, [book.id]);

      // If user had an active reservation for this book, mark it fulfilled
      await connection.execute(`
        UPDATE reservations 
        SET status = 'fulfilled', fulfilled_date = CURDATE(), fulfilled_by = ?, updated_at = NOW()
        WHERE user_id = ? AND book_id = ? AND status IN ('active', 'ready')
      `, [clerkId, student.id, book.id]);

      await connection.execute(`
        UPDATE book_reservations
        SET status = 'FULFILLED', updated_at = NOW()
        WHERE user_id = ? AND book_id = ? AND status = 'APPROVED'
      `, [student.id, book.id]);

      // Fetch created transaction
      const [txRows] = await connection.execute(`
        SELECT bt.*, DATE_FORMAT(bt.checkout_date, '%Y-%m-%d') as formatted_issue_date,
               DATE_FORMAT(bt.due_date, '%Y-%m-%d') as formatted_due_date
        FROM book_transactions bt
        WHERE bt.id = ?
      `, [transactionId]);

      await connection.commit();
      connection.release();

      const createdTx = txRows[0];

      return res.json({
        success: true,
        message: `Book "${book.title}" successfully issued to ${student.first_name} ${student.last_name}.`,
        receipt: {
          receipt_no: `REC-${String(transactionId).padStart(6, '0')}`,
          transaction_id: transactionId,
          issue_date: createdTx.formatted_issue_date,
          due_date: createdTx.formatted_due_date,
          loan_days: effectiveLoanDays,
          student: {
            id: student.id,
            name: `${student.first_name} ${student.last_name}`.trim(),
            student_id: student.student_id,
            department: student.department,
            degree_type: student.degree_type,
            email: student.email
          },
          book: {
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            accession_no: book.accession_no || `ACC-${String(book.id).padStart(5, '0')}`,
            barcode: book.barcode || `BC-${String(book.id).padStart(6, '0')}`
          },
          issuer: {
            id: clerkId,
            name: clerkName,
            role: req.user?.role || 'clerk'
          }
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Error in directIssue:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while directly issuing book.',
        error: error.message
      });
    }
  }

  /**
   * GET /api/circulation/search-books
   * Search available books by query for quick autocomplete at counter
   */
  static async searchBooks(req, res) {
    try {
      const q = String(req.query.q || '').trim();
      if (!q || q.length < 2) {
        return res.json({ success: true, books: [] });
      }

      const searchPattern = `%${q}%`;
      const [rows] = await pool.query(`
        SELECT id, title, author, isbn, accession_no, barcode, available_copies, total_copies, is_restricted_research
        FROM books
        WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ? OR accession_no LIKE ? OR barcode LIKE ?
        LIMIT 15
      `, [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]);

      return res.json({ success: true, books: rows });
    } catch (error) {
      console.error('Error in searchBooks:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = CirculationController;
