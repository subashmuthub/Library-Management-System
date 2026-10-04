/**
 * Circulation Controller
 * Handles physical book issuance, student lookup, reservation fulfillment,
 * and circulation desk operations for Clerks, Librarians, and Admins.
 */

const { pool } = require('../config/database');
const { hasDirectResearchAccess } = require('../utils/access-control.helper');

class CirculationController {
  /**
   * Dynamically resolves department lending policy for a patron.
   * Matches department_policies by student's department and degree type (UG vs PG).
   */
  static async resolveDepartmentPolicy(connectionOrPool, student) {
    const isStaff = ['teacher', 'faculty', 'staff', 'librarian'].includes(
      String(student.role_name || student.role || '').toLowerCase()
    );
    if (isStaff) {
      return {
        department_code: 'STAFF',
        department_name: 'Faculty & Library Staff',
        max_borrow_limit: 10,
        loan_duration_days: 60,
        allow_direct_thesis_checkout: true,
        daily_fine_rate: 2.0,
        is_pg: true,
      };
    }

    const deptRaw = String(student.department || '').toUpperCase().trim();
    const degreeRaw = String(student.degree_type || '').toUpperCase().trim();
    const isPG = ['ME', 'M.E.', 'MTECH', 'M.TECH', 'PHD', 'PH.D', 'RESEARCH', 'RESEARCH_SCHOLAR', 'PG', 'MS'].some(
      d => degreeRaw.includes(d)
    ) || ['me_student', 'research_scholar'].includes(String(student.role_name || student.role || '').toLowerCase());

    let policy = null;
    if (deptRaw) {
      const [matches] = await connectionOrPool.execute(
        `SELECT * FROM department_policies 
         WHERE department_code = ? OR department_code = ? 
         LIMIT 1`,
        [deptRaw, deptRaw.split(/[\s-]+/)[0]]
      );
      if (matches.length > 0) {
        policy = matches[0];
      }
    }

    if (!policy) {
      const [defaults] = await connectionOrPool.execute(
        `SELECT * FROM department_policies WHERE department_code = 'DEFAULT' LIMIT 1`
      );
      if (defaults.length > 0) {
        policy = defaults[0];
      } else {
        policy = {
          department_code: 'DEFAULT',
          department_name: 'Standard Institution Default',
          max_borrow_limit_ug: 6,
          loan_duration_days_ug: 14,
          max_borrow_limit_pg: 10,
          loan_duration_days_pg: 60,
          allow_direct_thesis_checkout: 0,
          daily_fine_rate: 2.0,
        };
      }
    }

    const maxLimit = isPG ? Number(policy.max_borrow_limit_pg) : Number(policy.max_borrow_limit_ug);
    const loanDays = isPG ? Number(policy.loan_duration_days_pg) : Number(policy.loan_duration_days_ug);
    const allowThesis = Boolean(policy.allow_direct_thesis_checkout) || isPG;
    const fineRate = Number(policy.daily_fine_rate) || 2.0;

    return {
      department_code: policy.department_code,
      department_name: policy.department_name,
      max_borrow_limit: maxLimit,
      loan_duration_days: loanDays,
      allow_direct_thesis_checkout: allowThesis,
      daily_fine_rate: fineRate,
      is_pg: isPG,
    };
  }

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
            u.status, u.role_id, u.has_desk_hold, u.desk_hold_reason,
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
        const policy = await CirculationController.resolveDepartmentPolicy(connection, student);
        const maxLimit = policy.max_borrow_limit;

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

        // Fetch detailed pending fines list for desk payment/waiver
        const [pendingFinesList] = await connection.execute(`
          SELECT f.id, f.amount, f.fine_type, 
                 COALESCE(f.notes, f.fine_type) as reason,
                 f.notes, f.status, f.created_at,
                 b.title as book_title
          FROM fines f
          LEFT JOIN book_transactions bt ON f.transaction_id = bt.id
          LEFT JOIN books b ON bt.book_id = b.id
          WHERE f.user_id = ? AND f.status IN ('pending', 'disputed')
          ORDER BY f.created_at DESC
        `, [studentId]);

        connection.release();

        const hasDeskHold = Boolean(student.has_desk_hold);
        const canBorrow = student.status === 'active' &&
          !hasDeskHold &&
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
            status: student.status,
            has_desk_hold: hasDeskHold,
            desk_hold_reason: student.desk_hold_reason || null
          },
          stats: {
            active_loans_count: activeLoans.length,
            max_limit: maxLimit,
            remaining_quota: Math.max(0, maxLimit - activeLoans.length),
            overdue_count: overdueCount,
            unpaid_fines: unpaidFines,
            can_borrow: canBorrow,
            default_loan_days: policy.loan_duration_days,
            department_policy: policy
          },
          active_loans: activeLoans,
          reservations: allReservations,
          pending_fines: pendingFinesList
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
               u.has_desk_hold, u.desk_hold_reason,
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
      if (student.has_desk_hold) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({
          success: false,
          error: 'Account Blocked',
          message: 'Account Blocked: Please see the Circulation Desk.',
          reason: student.desk_hold_reason || 'Please see the Circulation Desk.'
        });
      }

      const policy = await CirculationController.resolveDepartmentPolicy(connection, student);
      const isStaff = ['teacher', 'faculty', 'staff'].includes(student.role_name);
      const effectiveLoanDays = Number(loan_days) > 0 ? Number(loan_days) : policy.loan_duration_days;

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
               u.has_desk_hold, u.desk_hold_reason,
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
      if (student.has_desk_hold) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({
          success: false,
          error: 'Account Blocked',
          message: 'Account Blocked: Please see the Circulation Desk.',
          reason: student.desk_hold_reason || 'Please see the Circulation Desk.'
        });
      }

      if (student.status !== 'active') {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Patron account is not active.'
        });
      }

      const policy = await CirculationController.resolveDepartmentPolicy(connection, student);
      const isStaff = ['teacher', 'faculty', 'staff'].includes(student.role_name);
      const isDirectResearch = hasDirectResearchAccess(student) || policy.allow_direct_thesis_checkout;
      const maxLimit = policy.max_borrow_limit;

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

      const effectiveLoanDays = Number(loan_days) > 0 ? Number(loan_days) : policy.loan_duration_days;

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

  /**
   * POST /api/circulation/desk-hold
   * Place or lift a circulation desk hold on a student account.
   * Body: { user_id, has_desk_hold, reason }
   */
  static async setDeskHold(req, res) {
    try {
      const { user_id, has_desk_hold, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, message: 'User ID is required.' });
      }

      await pool.query(
        'UPDATE users SET has_desk_hold = ?, desk_hold_reason = ? WHERE id = ?',
        [has_desk_hold ? 1 : 0, has_desk_hold ? (reason || 'Account blocked by circulation desk') : null, user_id]
      );

      return res.json({
        success: true,
        message: has_desk_hold
          ? 'Desk hold applied to student account. Entry and reservations blocked.'
          : 'Desk hold lifted from student account.',
        user_id,
        has_desk_hold: Boolean(has_desk_hold),
        desk_hold_reason: has_desk_hold ? reason : null
      });
    } catch (error) {
      console.error('Error in setDeskHold:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/manual-return
   * Manual hardware fallback mode for book returns (Barcode, Accession No, ISBN, Book ID).
   * Checks condition, applies optional replacement fee, and auto-routes to Hold Shelf if reserved.
   * Body: { identifier, condition, notes, apply_replacement_fee, fee_amount }
   */
  static async manualReturn(req, res) {
    const connection = await pool.getConnection();
    try {
      const {
        identifier,
        condition = 'good',
        notes = '',
        apply_replacement_fee = false,
        fee_amount = 0
      } = req.body;

      const clerkId = req.user?.id || null;

      if (!identifier) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Book identifier (Barcode, Accession No, ISBN, or Book ID) is required.'
        });
      }

      await connection.beginTransaction();

      const trimmed = String(identifier).trim();
      const isNumeric = /^\d+$/.test(trimmed);

      // Locate book
      let bookSql = `
        SELECT b.id, b.title, b.author, b.isbn, b.accession_no, b.barcode,
               b.available_copies, b.total_copies, b.purchase_price, b.status
        FROM books b
        LEFT JOIN rfid_tags rt ON b.id = rt.book_id
        WHERE b.accession_no = ? OR b.barcode = ? OR b.isbn = ? OR rt.tag_id = ?
      `;
      const bookParams = [trimmed, trimmed, trimmed, trimmed];
      if (isNumeric) {
        bookSql += ` OR b.id = ?`;
        bookParams.push(parseInt(trimmed, 10));
      }
      bookSql += ` LIMIT 1`;

      const [books] = await connection.execute(bookSql, bookParams);
      if (books.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: `No book found matching "${trimmed}".`
        });
      }

      const book = books[0];

      // Find active loan transaction
      const [loans] = await connection.execute(`
        SELECT bt.*, u.id as patron_id, u.first_name, u.last_name, u.student_id, u.email,
               DATEDIFF(CURDATE(), bt.due_date) as days_overdue
        FROM book_transactions bt
        JOIN users u ON bt.user_id = u.id
        WHERE bt.book_id = ? AND bt.status = 'active'
        ORDER BY bt.checkout_date DESC
        LIMIT 1
      `, [book.id]);

      let transaction = null;
      let fineCreated = null;

      if (loans.length > 0) {
        transaction = loans[0];

        // Close loan transaction
        await connection.execute(`
          UPDATE book_transactions
          SET status = 'returned', return_date = CURDATE(), returned_by = ?, return_condition = ?
          WHERE id = ?
        `, [clerkId, condition, transaction.id]);

        // Overdue fine calculation using department policy daily_fine_rate
        if (transaction.days_overdue > 0) {
          const [patronData] = await connection.execute(
            `SELECT u.*, ur.role_name FROM users u LEFT JOIN user_roles ur ON u.role_id = ur.id WHERE u.id = ?`,
            [transaction.patron_id]
          );
          const patronPolicy = patronData.length > 0 
            ? await CirculationController.resolveDepartmentPolicy(connection, patronData[0]) 
            : { daily_fine_rate: 2.0 };
          const fineRate = patronPolicy.daily_fine_rate || 2.0;
          const fineAmount = Number((transaction.days_overdue * fineRate).toFixed(2));
          const [fineInsert] = await connection.execute(`
            INSERT INTO fines (user_id, transaction_id, amount, days_overdue, fine_rate, fine_type, notes, status)
            VALUES (?, ?, ?, ?, ?, 'overdue', ?, 'pending')
          `, [transaction.patron_id, transaction.id, fineAmount, transaction.days_overdue, fineRate, `Overdue by ${transaction.days_overdue} day(s) (@ ₹${fineRate}/day)`]);
          fineCreated = { id: fineInsert.insertId, amount: fineAmount, type: 'overdue' };
        }

        // Damage / replacement fee if applicable
        if (apply_replacement_fee && Number(fee_amount) > 0) {
          const fineType = condition === 'lost' ? 'lost_book' : (condition === 'damaged' ? 'damage' : 'other');
          const [dmgFine] = await connection.execute(`
            INSERT INTO fines (user_id, transaction_id, amount, fine_type, notes, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
          `, [transaction.patron_id, transaction.id, Number(fee_amount), fineType, notes || `Book returned in ${condition} condition`]);
          fineCreated = { id: dmgFine.insertId, amount: Number(fee_amount), type: fineType };
        }
      }

      let onHoldShelf = false;
      let holdReservation = null;

      // Handle book inventory status
      if (condition === 'damaged' || condition === 'lost') {
        await connection.execute(
          `UPDATE books SET status = ?, is_available = FALSE WHERE id = ?`,
          [condition, book.id]
        );
      } else {
        // Condition is good / normal - check reservation hold shelf lifecycle
        const [queuedRes] = await connection.execute(`
          SELECT r.*, u.first_name, u.last_name, u.email, u.student_id, u.phone
          FROM reservations r
          JOIN users u ON r.user_id = u.id
          WHERE r.book_id = ? AND r.status = 'active'
          ORDER BY r.queue_position ASC, r.created_at ASC
          LIMIT 1
        `, [book.id]);

        if (queuedRes.length > 0) {
          const resRow = queuedRes[0];
          // Put on Hold Shelf with 3-day (72 hr) pickup window
          await connection.execute(`
            UPDATE reservations
            SET status = 'on_hold_shelf',
                hold_expiry_date = DATE_ADD(NOW(), INTERVAL 3 DAY),
                queue_position = 0,
                updated_at = NOW()
            WHERE id = ?
          `, [resRow.id]);

          await connection.execute(`
            UPDATE books SET status = 'active', is_available = TRUE WHERE id = ?
          `, [book.id]);

          onHoldShelf = true;
          holdReservation = {
            id: resRow.id,
            patron_name: `${resRow.first_name} ${resRow.last_name}`.trim(),
            student_id: resRow.student_id,
            hold_expiry_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            remaining_hours: 72
          };
        } else {
          // No reservation waiting - return to general circulation shelf
          await connection.execute(`
            UPDATE books 
            SET available_copies = LEAST(total_copies, available_copies + 1),
                is_available = TRUE,
                status = 'active'
            WHERE id = ?
          `, [book.id]);
        }
      }

      await connection.commit();
      connection.release();

      return res.json({
        success: true,
        message: onHoldShelf
          ? `Book returned and placed on HOLD SHELF for ${holdReservation.patron_name}. (Pickup window: 72 hours).`
          : (condition === 'damaged' || condition === 'lost'
              ? `Book returned and flagged as ${condition.toUpperCase()}. Hidden from search.`
              : `Book "${book.title}" successfully returned and restored to shelf.`),
        book: {
          id: book.id,
          title: book.title,
          accession_no: book.accession_no,
          barcode: book.barcode,
          condition
        },
        transaction: transaction ? {
          id: transaction.id,
          patron_name: `${transaction.first_name} ${transaction.last_name}`.trim(),
          student_id: transaction.student_id,
          days_overdue: transaction.days_overdue
        } : null,
        on_hold_shelf: onHoldShelf,
        hold_reservation: holdReservation,
        fine_created: fineCreated
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Error in manualReturn:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/circulation/hold-shelf
   * Get all books awaiting pickup on the hold shelf.
   */
  static async getHoldShelf(req, res) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          r.id AS reservation_id,
          r.book_id,
          r.user_id,
          r.status,
          r.created_at,
          r.expiry_date,
          COALESCE(r.hold_expiry_date, DATE_ADD(r.created_at, INTERVAL 3 DAY)) AS hold_expiry_date,
          TIMESTAMPDIFF(HOUR, NOW(), COALESCE(r.hold_expiry_date, DATE_ADD(r.created_at, INTERVAL 3 DAY))) AS remaining_hours,
          b.title,
          b.author,
          b.isbn,
          b.accession_no,
          b.barcode,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS patron_name,
          u.student_id AS patron_student_id,
          u.email AS patron_email,
          u.phone AS patron_phone
        FROM reservations r
        JOIN books b ON r.book_id = b.id
        JOIN users u ON r.user_id = u.id
        WHERE r.status IN ('ready', 'on_hold_shelf')
        ORDER BY COALESCE(r.hold_expiry_date, r.expiry_date) ASC
      `);

      return res.json({
        success: true,
        count: rows.length,
        items: rows.map(item => ({
          ...item,
          remaining_hours: Math.max(0, item.remaining_hours || 0),
          is_expired: (item.remaining_hours || 0) <= 0
        }))
      });
    } catch (error) {
      console.error('Error in getHoldShelf:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/hold-shelf/expire-check
   * Automatically check and expire holds past their 3-day window, promoting next reservation.
   */
  static async expireHoldShelfCheck(req, res) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Find expired holds
      const [expiredHolds] = await connection.execute(`
        SELECT r.id, r.book_id, r.user_id
        FROM reservations r
        WHERE r.status IN ('ready', 'on_hold_shelf')
          AND COALESCE(r.hold_expiry_date, r.expiry_date, DATE_ADD(r.created_at, INTERVAL 3 DAY)) < NOW()
      `);

      let expiredCount = 0;
      let promotedCount = 0;

      for (const hold of expiredHolds) {
        // Mark hold expired
        await connection.execute(`
          UPDATE reservations SET status = 'expired', updated_at = NOW() WHERE id = ?
        `, [hold.id]);
        expiredCount++;

        // Check if there is another queued student for this book
        const [nextQueue] = await connection.execute(`
          SELECT id, user_id FROM reservations
          WHERE book_id = ? AND status = 'active'
          ORDER BY queue_position ASC, created_at ASC
          LIMIT 1
        `, [hold.book_id]);

        if (nextQueue.length > 0) {
          // Promote next student to Hold Shelf
          await connection.execute(`
            UPDATE reservations
            SET status = 'on_hold_shelf',
                hold_expiry_date = DATE_ADD(NOW(), INTERVAL 3 DAY),
                queue_position = 0,
                updated_at = NOW()
            WHERE id = ?
          `, [nextQueue[0].id]);
          promotedCount++;
        } else {
          // Restore book to general copies
          await connection.execute(`
            UPDATE books
            SET available_copies = LEAST(total_copies, available_copies + 1),
                is_available = TRUE,
                status = 'active'
            WHERE id = ?
          `, [hold.book_id]);
        }
      }

      await connection.commit();
      connection.release();

      return res.json({
        success: true,
        message: `Hold shelf audit complete. ${expiredCount} expired hold(s) processed, ${promotedCount} next student(s) promoted in queue.`,
        expired_count: expiredCount,
        promoted_count: promotedCount
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Error in expireHoldShelfCheck:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/fines/cash-collection
   * Offline cash collection at Circulation Desk with printable receipt generation.
   * Body: { fine_id, student_id, amount_received, receipt_notes }
   */
  static async collectCash(req, res) {
    const connection = await pool.getConnection();
    try {
      const { fine_id, student_id, amount_received, receipt_notes } = req.body;
      const clerkId = req.user?.id || 1;
      const clerkName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Circulation Clerk';

      if (!fine_id) {
        connection.release();
        return res.status(400).json({ success: false, message: 'Fine ID is required.' });
      }

      await connection.beginTransaction();

      // Locate fine
      const [fines] = await connection.execute(`
        SELECT f.*, u.first_name, u.last_name, u.student_id as student_roll, u.email
        FROM fines f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = ?
      `, [fine_id]);

      if (fines.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Fine record not found.' });
      }

      const fine = fines[0];
      const effectiveStudentId = student_id || fine.user_id;
      const effectiveAmount = Number(amount_received) > 0 ? Number(amount_received) : Number(fine.amount);

      const receiptNo = `CSH-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Insert log into cash_desk_logs
      await connection.execute(`
        INSERT INTO cash_desk_logs (receipt_no, fine_id, student_id, amount_received, receipt_notes, collected_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [receiptNo, fine_id, effectiveStudentId, effectiveAmount, receipt_notes || 'Cash Desk Collection', clerkId]);

      // Update fine status
      await connection.execute(`
        UPDATE fines
        SET status = 'paid',
            amount_paid = ?,
            payment_date = CURDATE(),
            payment_method = 'cash',
            processed_by = ?,
            notes = CONCAT(COALESCE(notes, ''), ' [Receipt: ', ?, ']')
        WHERE id = ?
      `, [effectiveAmount, clerkId, receiptNo, fine_id]);

      await connection.commit();
      connection.release();

      return res.json({
        success: true,
        message: `Cash payment of ₹${effectiveAmount} collected and recorded.`,
        receipt: {
          receipt_no: receiptNo,
          fine_id: fine.id,
          amount_received: effectiveAmount,
          payment_method: 'CASH',
          student: {
            id: effectiveStudentId,
            name: `${fine.first_name} ${fine.last_name}`.trim(),
            student_id: fine.student_roll,
            email: fine.email
          },
          collector: {
            id: clerkId,
            name: clerkName,
            role: req.user?.role || 'clerk'
          },
          collected_at: new Date().toISOString(),
          receipt_notes: receipt_notes || ''
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Error in collectCash:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/fines/dispute
   * Fine waiver / dispute workflow.
   * If fine <= 50 INR: direct waiver with mandatory reason category.
   * If fine > 50 INR: automatic escalation to Chief Librarian.
   * Body: { fine_id, reason_category, reason_text }
   */
  static async disputeFine(req, res) {
    const connection = await pool.getConnection();
    try {
      const { fine_id, reason_category, reason_text } = req.body;
      const clerkId = req.user?.id || 1;

      const validCategories = ['System Error', 'Medical Exemption', 'Desk Discretion'];
      if (!reason_category || !validCategories.includes(reason_category)) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Mandatory reason category must be one of: ${validCategories.join(', ')}`
        });
      }

      await connection.beginTransaction();

      const [fines] = await connection.execute(
        `SELECT * FROM fines WHERE id = ?`,
        [fine_id]
      );

      if (fines.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Fine record not found.' });
      }

      const fine = fines[0];
      const amount = Number(fine.amount);

      let action = '';
      let message = '';

      if (amount <= 50) {
        // Direct Clerk Waiver
        await connection.execute(`
          UPDATE fines SET status = 'waived', updated_at = NOW() WHERE id = ?
        `, [fine_id]);

        const [disputeResult] = await connection.execute(`
          INSERT INTO fine_disputes (fine_id, user_id, amount, reason_category, reason_text, status, resolved_by)
          VALUES (?, ?, ?, ?, ?, 'WAIVED', ?)
        `, [fine_id, fine.user_id, amount, reason_category, reason_text || '', clerkId]);

        action = 'WAIVED';
        message = `Fine of ₹${amount} waived directly under desk discretion (${reason_category}).`;

        await connection.commit();
        connection.release();

        return res.json({
          success: true,
          action,
          message,
          dispute_id: disputeResult.insertId,
          amount
        });
      } else {
        // Escalation to Chief Librarian
        await connection.execute(`
          UPDATE fines SET status = 'disputed', updated_at = NOW() WHERE id = ?
        `, [fine_id]);

        const [disputeResult] = await connection.execute(`
          INSERT INTO fine_disputes (fine_id, user_id, amount, reason_category, reason_text, status, resolved_by)
          VALUES (?, ?, ?, ?, ?, 'ESCALATED_TO_LIBRARIAN', NULL)
        `, [fine_id, fine.user_id, amount, reason_category, reason_text || '']);

        action = 'ESCALATED';
        message = `Fine of ₹${amount} exceeds ₹50 clerk waiver limit. Escalated to Chief Librarian for review.`;

        await connection.commit();
        connection.release();

        return res.json({
          success: true,
          action,
          message,
          dispute_id: disputeResult.insertId,
          amount
        });
      }
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Error in disputeFine:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/circulation/fines/disputes
   * Get all fine disputes and waivers.
   */
  static async getFineDisputes(req, res) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          fd.*,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS patron_name,
          u.student_id AS patron_student_id,
          u.email AS patron_email,
          CONCAT(COALESCE(r.first_name, ''), ' ', COALESCE(r.last_name, '')) AS resolver_name,
          b.title AS book_title
        FROM fine_disputes fd
        JOIN users u ON fd.user_id = u.id
        LEFT JOIN users r ON fd.resolved_by = r.id
        LEFT JOIN fines f ON fd.fine_id = f.id
        LEFT JOIN book_transactions bt ON f.transaction_id = bt.id
        LEFT JOIN books b ON bt.book_id = b.id
        ORDER BY fd.created_at DESC
      `);

      return res.json({ success: true, disputes: rows });
    } catch (error) {
      console.error('Error in getFineDisputes:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/inventory/report-condition
   * Damaged / Lost book pipeline with optional replacement fine.
   * Body: { identifier, condition: 'damaged' | 'lost', notes, apply_replacement_fee, fee_amount, user_id }
   */
  static async reportCondition(req, res) {
    const connection = await pool.getConnection();
    try {
      const {
        identifier,
        condition = 'damaged',
        notes = '',
        apply_replacement_fee = false,
        fee_amount = 0,
        user_id = null
      } = req.body;

      if (!identifier) {
        connection.release();
        return res.status(400).json({ success: false, message: 'Book identifier is required.' });
      }

      await connection.beginTransaction();

      const trimmed = String(identifier).trim();
      const isNumeric = /^\d+$/.test(trimmed);

      let bookSql = `
        SELECT id, title, author, barcode, accession_no, purchase_price, available_copies, total_copies
        FROM books
        WHERE accession_no = ? OR barcode = ? OR isbn = ?
      `;
      const params = [trimmed, trimmed, trimmed];
      if (isNumeric) {
        bookSql += ` OR id = ?`;
        params.push(parseInt(trimmed, 10));
      }
      bookSql += ` LIMIT 1`;

      const [books] = await connection.execute(bookSql, params);
      if (books.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Book not found.' });
      }

      const book = books[0];
      const validCondition = condition === 'lost' ? 'lost' : 'damaged';

      // Update book status and hide from search
      await connection.execute(`
        UPDATE books 
        SET status = ?, is_available = FALSE, available_copies = GREATEST(0, available_copies - 1)
        WHERE id = ?
      `, [validCondition, book.id]);

      // If replacement fee requested
      let feeId = null;
      if (apply_replacement_fee && Number(fee_amount) > 0 && user_id) {
        const fineType = validCondition === 'lost' ? 'lost_book' : 'damage';
        const [fineRes] = await connection.execute(`
          INSERT INTO fines (user_id, amount, fine_type, notes, status)
          VALUES (?, ?, ?, ?, 'pending')
        `, [user_id, Number(fee_amount), fineType, notes ? `${notes} (Book: ${book.title})` : `Book flagged as ${validCondition}: ${book.title}`]);
        feeId = fineRes.insertId;
      }

      await connection.commit();
      connection.release();

      return res.json({
        success: true,
        message: `Book "${book.title}" flagged as ${validCondition.toUpperCase()} and removed from active circulation.`,
        book_id: book.id,
        condition: validCondition,
        replacement_fine_id: feeId
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Error in reportCondition:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/inventory/flag-misplaced
   * Flag misplaced book with shelf locator notes and hide immediately from student search.
   * Body: { identifier, misplaced_notes }
   */
  static async flagMisplaced(req, res) {
    try {
      const { identifier, misplaced_notes = '' } = req.body;
      if (!identifier) {
        return res.status(400).json({ success: false, message: 'Book identifier is required.' });
      }

      const trimmed = String(identifier).trim();
      const isNumeric = /^\d+$/.test(trimmed);

      let bookSql = `SELECT id, title FROM books WHERE accession_no = ? OR barcode = ? OR isbn = ?`;
      const params = [trimmed, trimmed, trimmed];
      if (isNumeric) {
        bookSql += ` OR id = ?`;
        params.push(parseInt(trimmed, 10));
      }
      bookSql += ` LIMIT 1`;

      const [books] = await pool.query(bookSql, params);
      if (books.length === 0) {
        return res.status(404).json({ success: false, message: 'Book not found.' });
      }

      const book = books[0];

      await pool.query(`
        UPDATE books
        SET status = 'misplaced', misplaced_notes = ?, is_available = FALSE
        WHERE id = ?
      `, [misplaced_notes || 'Reported misplaced during shelf check', book.id]);

      return res.json({
        success: true,
        message: `Book "${book.title}" flagged as MISPLACED with notes and hidden from student search.`,
        book_id: book.id,
        misplaced_notes
      });
    } catch (error) {
      console.error('Error in flagMisplaced:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/inventory/resolve-misplaced
   * Restore misplaced book to active shelf inventory after audit.
   * Body: { identifier }
   */
  static async resolveMisplaced(req, res) {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ success: false, message: 'Book identifier is required.' });
      }

      const trimmed = String(identifier).trim();
      const isNumeric = /^\d+$/.test(trimmed);

      let bookSql = `SELECT id, title FROM books WHERE accession_no = ? OR barcode = ? OR isbn = ?`;
      const params = [trimmed, trimmed, trimmed];
      if (isNumeric) {
        bookSql += ` OR id = ?`;
        params.push(parseInt(trimmed, 10));
      }
      bookSql += ` LIMIT 1`;

      const [books] = await pool.query(bookSql, params);
      if (books.length === 0) {
        return res.status(404).json({ success: false, message: 'Book not found.' });
      }

      const book = books[0];

      await pool.query(`
        UPDATE books
        SET status = 'active', misplaced_notes = NULL, is_available = TRUE
        WHERE id = ?
      `, [book.id]);

      return res.json({
        success: true,
        message: `Book "${book.title}" successfully restored to active catalog and shelf inventory.`,
        book_id: book.id
      });
    } catch (error) {
      console.error('Error in resolveMisplaced:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/circulation/inventory/flagged
   * Get all damaged, lost, and misplaced books for audit.
   */
  static async getFlaggedInventory(req, res) {
    try {
      const [rows] = await pool.query(`
        SELECT id, title, author, isbn, accession_no, barcode, status, misplaced_notes,
               available_copies, total_copies, updated_at
        FROM books
        WHERE status IN ('damaged', 'lost', 'misplaced')
        ORDER BY updated_at DESC
      `);

      return res.json({ success: true, items: rows });
    } catch (error) {
      console.error('Error in getFlaggedInventory:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/guest-passes
   * Issue a temporary day pass for visitor, alumni, or external researcher.
   * Body: { guest_name, guest_type, phone, email, institution, purpose, assigned_rfid_card_id, valid_hours }
   */
  static async issueGuestPass(req, res) {
    try {
      const {
        guest_name,
        guest_type = 'VISITOR',
        phone,
        email = '',
        institution = '',
        purpose = '',
        assigned_rfid_card_id = '',
        valid_hours = 12
      } = req.body;

      const clerkId = req.user?.id || 1;

      if (!guest_name || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Guest name and phone number are required.'
        });
      }

      const passNumber = `GP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const hours = Number(valid_hours) > 0 ? Number(valid_hours) : 12;

      const [result] = await pool.query(`
        INSERT INTO guest_passes (
          pass_number, guest_name, guest_type, phone, email, institution,
          purpose, assigned_rfid_card_id, valid_until, issued_by, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, 'ACTIVE'
        )
      `, [
        passNumber, guest_name, guest_type, phone, email, institution,
        purpose, assigned_rfid_card_id || null, hours, clerkId
      ]);

      const [rows] = await pool.query(
        `SELECT * FROM guest_passes WHERE id = ?`,
        [result.insertId]
      );

      return res.json({
        success: true,
        message: `Guest pass ${passNumber} issued successfully for ${guest_name}.`,
        pass: rows[0]
      });
    } catch (error) {
      console.error('Error in issueGuestPass:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/circulation/guest-passes
   * List all temporary guest passes.
   */
  static async getGuestPasses(req, res) {
    try {
      const [rows] = await pool.query(`
        SELECT gp.*, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS issuer_name
        FROM guest_passes gp
        LEFT JOIN users u ON gp.issued_by = u.id
        ORDER BY gp.created_at DESC
        LIMIT 50
      `);

      return res.json({ success: true, passes: rows });
    } catch (error) {
      console.error('Error in getGuestPasses:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/guest-passes/:id/return
   * Check in and return guest pass badge.
   */
  static async returnGuestPass(req, res) {
    try {
      const passId = req.params.id;
      await pool.query(`
        UPDATE guest_passes
        SET status = 'RETURNED', returned_at = NOW()
        WHERE id = ?
      `, [passId]);

      return res.json({
        success: true,
        message: 'Guest pass returned and badge checked in.'
      });
    } catch (error) {
      console.error('Error in returnGuestPass:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/circulation/shift-summary
   * Aggregated shift statistics for the logged-in clerk.
   */
  static async getShiftSummary(req, res) {
    try {
      const clerkId = req.user?.id || 1;
      const clerkName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Circulation Clerk';

      // Books issued today by this clerk
      const [issueRows] = await pool.query(`
        SELECT COUNT(*) AS count
        FROM book_transactions
        WHERE issued_by = ? AND DATE(checkout_date) = CURDATE()
      `, [clerkId]);

      // Books returned today by this clerk
      const [returnRows] = await pool.query(`
        SELECT COUNT(*) AS count
        FROM book_transactions
        WHERE returned_by = ? AND DATE(return_date) = CURDATE()
      `, [clerkId]);

      // Cash collected today by this clerk
      const [cashRows] = await pool.query(`
        SELECT COALESCE(SUM(amount_received), 0) AS total_cash, COUNT(*) AS count
        FROM cash_desk_logs
        WHERE collected_by = ? AND DATE(created_at) = CURDATE()
      `, [clerkId]);

      // Damaged/Lost books logged today
      const [dmgRows] = await pool.query(`
        SELECT COUNT(*) AS count
        FROM books
        WHERE status IN ('damaged', 'lost') AND DATE(updated_at) = CURDATE()
      `);

      // Guest passes issued today
      const [passRows] = await pool.query(`
        SELECT COUNT(*) AS count
        FROM guest_passes
        WHERE issued_by = ? AND DATE(created_at) = CURDATE()
      `, [clerkId]);

      // Disputes handled today
      const [disputeRows] = await pool.query(`
        SELECT COUNT(*) AS count
        FROM fine_disputes
        WHERE resolved_by = ? AND DATE(created_at) = CURDATE()
      `, [clerkId]);

      return res.json({
        success: true,
        clerk: {
          id: clerkId,
          name: clerkName,
          role: req.user?.role || 'clerk'
        },
        shift_start: '09:00 AM',
        current_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        metrics: {
          books_issued_count: Number(issueRows[0]?.count || 0),
          books_returned_count: Number(returnRows[0]?.count || 0),
          cash_collected: Number(cashRows[0]?.total_cash || 0),
          cash_transactions_count: Number(cashRows[0]?.count || 0),
          damaged_books_count: Number(dmgRows[0]?.count || 0),
          guest_passes_count: Number(passRows[0]?.count || 0),
          disputes_count: Number(disputeRows[0]?.count || 0)
        }
      });
    } catch (error) {
      console.error('Error in getShiftSummary:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/circulation/shift-handover
   * Log digital shift handover report with notes.
   */
  static async submitShiftHandover(req, res) {
    try {
      const clerkId = req.user?.id || 1;
      const {
        shift_start,
        shift_end,
        books_issued_count = 0,
        books_returned_count = 0,
        cash_collected = 0,
        damaged_books_count = 0,
        handover_notes = ''
      } = req.body;

      const [result] = await pool.query(`
        INSERT INTO shift_handovers (
          clerk_id, shift_start, shift_end, books_issued_count,
          books_returned_count, cash_collected, damaged_books_count, handover_notes
        ) VALUES (
          ?, COALESCE(?, NOW()), COALESCE(?, NOW()), ?,
          ?, ?, ?, ?
        )
      `, [
        clerkId,
        shift_start || new Date(),
        shift_end || new Date(),
        books_issued_count,
        books_returned_count,
        cash_collected,
        damaged_books_count,
        handover_notes || 'Shift completed successfully without operational anomalies.'
      ]);

      return res.json({
        success: true,
        message: 'Shift handover report recorded successfully.',
        handover_id: result.insertId,
        submitted_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in submitShiftHandover:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/circulation/shift-handovers
   * List past shift handovers.
   */
  static async getShiftHandovers(req, res) {
    try {
      const [rows] = await pool.query(`
        SELECT sh.*, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS clerk_name
        FROM shift_handovers sh
        JOIN users u ON sh.clerk_id = u.id
        ORDER BY sh.created_at DESC
        LIMIT 20
      `);

      return res.json({ success: true, handovers: rows });
    } catch (error) {
      console.error('Error in getShiftHandovers:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = CirculationController;
