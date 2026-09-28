/**
 * Transaction Controller
 * Handles book checkout, return, renew, and related operations
 */

const { pool } = require("../config/database");
const { hasDirectResearchAccess } = require("../utils/access-control.helper");

const getParsedInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const getStatusCondition = (status) => {
  const conditions = {
    active: "bt.return_date IS NULL",
    inuse: "bt.return_date IS NULL",
    in_use: "bt.return_date IS NULL",
    returned: "bt.return_date IS NOT NULL",
    overdue: "bt.return_date IS NULL AND bt.due_date < CURDATE()",
  };
  return conditions[status] || null;
};

const appendTransactionFilters = (baseQuery, filterInput, params) => {
  let queryText = baseQuery;
  const statusCondition = getStatusCondition(filterInput.status);

  if (statusCondition) {
    queryText += ` AND ${statusCondition}`;
  }

  if (filterInput.user_id) {
    queryText += " AND bt.user_id = ?";
    params.push(filterInput.user_id);
  }

  if (filterInput.book_id) {
    queryText += " AND bt.book_id = ?";
    params.push(filterInput.book_id);
  }

  if (filterInput.date_from) {
    queryText += " AND bt.checkout_date >= ?";
    params.push(filterInput.date_from);
  }

  if (filterInput.date_to) {
    queryText += " AND bt.checkout_date <= ?";
    params.push(filterInput.date_to);
  }

  return queryText;
};

const updateRenewalWithCompatibility = async (
  connection,
  dueDateIso,
  transactionId,
) => {
  const statements = [
    `UPDATE book_transactions SET due_date = ?, renewed_count = renewed_count + 1 WHERE id = ?`,
    `UPDATE book_transactions SET due_date = ?, renewal_count = renewal_count + 1 WHERE id = ?`,
    `UPDATE book_transactions SET due_date = ? WHERE id = ?`,
  ];

  let latestError = null;

  for (const statement of statements) {
    try {
      await connection.execute(statement, [dueDateIso, transactionId]);
      return;
    } catch (error_) {
      latestError = error_;
      if (error_.code !== "ER_BAD_FIELD_ERROR") {
        throw error_;
      }
    }
  }

  throw latestError;
};

class TransactionController {
  // Checkout a book
  static async checkoutBook(req, res) {
    try {
      // Accept bookId from either params or body
      const bookId = req.params.bookId || req.body.bookId || req.body.book_id;
      const userId = req.body.userId || req.body.user_id;
      const loanDays = req.body.loanDays || req.body.loan_days || 14;
      // For development without auth: librarian can be null or from body
      const librarianId = req.user?.id || req.body.librarianId || null;

      if (!bookId) {
        return res.status(400).json({ error: "Book ID is required" });
      }

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // Verify borrower account and role
        const [targetUsers] = await connection.execute(
          `SELECT u.id, u.status, u.degree_type, u.department, u.academic_year,
                  LOWER(COALESCE(ur.role_name, CASE u.role_id WHEN 4 THEN 'staff' WHEN 5 THEN 'me_student' WHEN 6 THEN 'research_scholar' ELSE 'student' END)) AS role_name
           FROM users u
           LEFT JOIN user_roles ur ON u.role_id = ur.id
           WHERE u.id = ?`,
          [userId],
        );

        if (targetUsers.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            message: "User not found",
            error: "User not found",
          });
        }

        if (targetUsers[0].status !== "active") {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: "User account is not active",
            error: "User account is not active",
          });
        }

        const roleName = targetUsers[0].role_name;
        const normalizedRoleName = ["teacher", "faculty", "staff"].includes(roleName) ? "staff" : roleName;
        const allowedBorrowRoles = ["student", "staff", "me_student", "research_scholar", "admin", "librarian"];

        if (!allowedBorrowRoles.includes(normalizedRoleName)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: "This account type cannot borrow books",
            error: "This account type cannot borrow books",
          });
        }

        const isDirectResearch = hasDirectResearchAccess(targetUsers[0]);

        // Check if book is available
        const [activeCheckouts] = await connection.execute(
          "SELECT COUNT(*) as count FROM book_transactions WHERE book_id = ? AND status = ?",
          [bookId, "active"],
        );

        if (activeCheckouts[0].count > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: "Book is currently checked out",
            error: "Book is currently checked out",
          });
        }

        // Check user's current checkout count
        const [userCheckouts] = await connection.execute(
          "SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = ?",
          [userId, "active"],
        );

        // Determine limit based on role and academic program: Staff: 10, ME/Research: 8, UG Students: 6
        const maxLimit = normalizedRoleName === "staff" ? 10 : (isDirectResearch ? 8 : 6);

        if (userCheckouts[0].count >= maxLimit) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            message: "Maximum checkout limit reached",
          });
        }

        // Check for overdue books
        const [overdueBooks] = await connection.execute(
          "SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = ? AND due_date < CURDATE()",
          [userId, "active"],
        );

        if (overdueBooks[0].count > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: "Cannot checkout: user has overdue books",
            error: "Cannot checkout: user has overdue books",
          });
        }

        // --------------------------------------------------------------------
        // Restricted Research & ME Thesis Gatekeeper
        // --------------------------------------------------------------------
        try {
          const [bookRows] = await connection.execute(
            "SELECT id, title, is_restricted_research FROM books WHERE id = ?",
            [bookId],
          );
          if (bookRows.length > 0 && Boolean(bookRows[0].is_restricted_research)) {
            const isDirectAccess = hasDirectResearchAccess(targetUsers[0]);

            if (!isDirectAccess) {
              // Regular UG student: check if they have an APPROVED reservation in book_reservations
              const [approvedReservations] = await connection.execute(
                `SELECT id, status FROM book_reservations 
                 WHERE book_id = ? AND user_id = ? AND status = 'APPROVED'
                 ORDER BY created_at DESC LIMIT 1`,
                [bookId, userId],
              );

              if (approvedReservations.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(403).json({
                  success: false,
                  message: "Restricted: This title is reserved for Research Scholars and ME Students. Normal students require prior Librarian approval.",
                });
              }

              // Fulfill the approved reservation
              await connection.execute(
                `UPDATE book_reservations SET status = 'FULFILLED', updated_at = NOW() WHERE id = ?`,
                [approvedReservations[0].id],
              );
            }
          }
        } catch (researchErr) {
          console.warn("Restricted research check warning:", researchErr.message);
        }

        // Calculate loan duration:
        // Staff = 60 days, ME Students / Research Scholars = 30 days, Regular UG Students = 14 days
        const checkoutDate = new Date();
        const defaultLoanDays = normalizedRoleName === "staff" ? 60 : (isDirectResearch ? 30 : 14);
        const requestedLoanDays = req.body.loanDays || req.body.loan_days;
        const effectiveLoanDays = requestedLoanDays ? getParsedInt(requestedLoanDays, defaultLoanDays) : defaultLoanDays;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + effectiveLoanDays);

        // Insert transaction record
        const [result] = await connection.execute(
          `
            INSERT INTO book_transactions (
                user_id, 
                book_id, 
                checked_out_by,
                checkout_date,
                due_date,
                status
            ) VALUES (?, ?, ?, ?, ?, 'active')
          `,
          [userId, bookId, librarianId, checkoutDate, dueDate],
        );

        // Update book availability status
        await connection.execute(
          "UPDATE books SET is_available = FALSE WHERE id = ?",
          [bookId],
        );

        // Keep user account metadata fresh when a checkout happens.
        await connection.execute(
          "UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [userId],
        );

        await connection.commit();

        // Get transaction details
        const [transaction] = await connection.execute(
          `
                    SELECT 
                        bt.*,
                        CONCAT(u.first_name, ' ', u.last_name) as user_name,
                        b.title,
                        b.author
                    FROM book_transactions bt
                    JOIN users u ON bt.user_id = u.id
                    JOIN books b ON bt.book_id = b.id
                    WHERE bt.id = ?
                `,
          [result.insertId],
        );

        connection.release();

        res.json({
          success: true,
          message: "Book checked out successfully",
          transaction: transaction[0],
        });
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error("Error during checkout:", error);
      const payload = {
        error: "Internal server error",
        details: error?.message,
        stack: error?.stack,
      };
      res.status(500).json(payload);
    }
  }

  // Batch Checkout multiple books in a single transaction
  static async checkoutBatch(req, res) {
    let connection;
    try {
      const userId = req.body.userId || req.body.user_id;
      const rawBookIds = req.body.bookIds || req.body.book_ids || (req.body.bookId ? [req.body.bookId] : []);
      const requestedLoanDays = req.body.loanDays || req.body.loan_days;
      const librarianId = req.user?.id || req.body.librarianId || null;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
          message: "User ID is required",
        });
      }

      if (!Array.isArray(rawBookIds) || rawBookIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one Book ID is required",
          message: "Cart is empty. Please add at least one book to checkout.",
        });
      }

      // Filter and deduplicate book IDs
      const bookIds = [...new Set(rawBookIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0))];

      if (bookIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid Book IDs provided",
          message: "Please provide valid numeric Book IDs.",
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // 1. Verify borrower account and role
      const [targetUsers] = await connection.execute(
        `SELECT u.id, u.first_name, u.last_name, u.status, u.degree_type, u.department, u.academic_year,
                LOWER(COALESCE(ur.role_name, CASE u.role_id WHEN 4 THEN 'staff' WHEN 5 THEN 'me_student' WHEN 6 THEN 'research_scholar' ELSE 'student' END)) AS role_name
         FROM users u
         LEFT JOIN user_roles ur ON u.role_id = ur.id
         WHERE u.id = ? OR u.student_id = ? OR u.email = ?`,
        [userId, userId, userId],
      );

      if (targetUsers.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          error: "User not found",
          message: `User '${userId}' not found`,
        });
      }

      const borrower = targetUsers[0];
      const actualUserId = borrower.id;

      if (borrower.status !== "active") {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          error: "User account is not active",
          message: "User account is suspended or inactive.",
        });
      }

      const roleName = borrower.role_name;
      const normalizedRoleName = ["teacher", "faculty", "staff"].includes(roleName) ? "staff" : roleName;
      const allowedBorrowRoles = ["student", "staff", "me_student", "research_scholar", "admin", "librarian"];

      if (!allowedBorrowRoles.includes(normalizedRoleName)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          error: "This account type cannot borrow books",
          message: "This account type cannot borrow books",
        });
      }

      const isDirectResearch = hasDirectResearchAccess(borrower);

      // 2. Check overdue books
      const [overdueRows] = await connection.execute(
        "SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = 'active' AND due_date < CURDATE()",
        [actualUserId],
      );
      if (overdueRows[0].count > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          error: "Cannot checkout: user has overdue books",
          message: `Cannot checkout: ${borrower.first_name} has ${overdueRows[0].count} overdue book(s).`,
        });
      }

      // 3. Check active checkouts count and borrowing limit
      const [activeRows] = await connection.execute(
        "SELECT COUNT(*) as count FROM book_transactions WHERE user_id = ? AND status = 'active'",
        [actualUserId],
      );
      const currentActiveCount = activeRows[0].count;
      const maxLimit = normalizedRoleName === "staff" ? 10 : (isDirectResearch ? 8 : 6);

      if (currentActiveCount + bookIds.length > maxLimit) {
        await connection.rollback();
        connection.release();
        const availableSlots = Math.max(0, maxLimit - currentActiveCount);
        return res.status(400).json({
          success: false,
          error: "Checkout limit exceeded",
          message: `Borrowing limit exceeded: User can only checkout ${availableSlots} more book(s). (Active: ${currentActiveCount}, Selected: ${bookIds.length}, Max allowance: ${maxLimit})`,
        });
      }

      // 4. Calculate loan period and due date
      const defaultLoanDays = normalizedRoleName === "staff" ? 60 : (isDirectResearch ? 30 : 14);
      const effectiveLoanDays = requestedLoanDays ? getParsedInt(requestedLoanDays, defaultLoanDays) : defaultLoanDays;
      const checkoutDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + effectiveLoanDays);

      const insertedTransactions = [];

      for (const bId of bookIds) {
        // Fetch book info
        const [bookRows] = await connection.execute(
          "SELECT id, title, author, is_available, is_restricted_research FROM books WHERE id = ?",
          [bId],
        );

        if (bookRows.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            error: "Book not found",
            message: `Book #${bId} not found in library catalog.`,
          });
        }

        const book = bookRows[0];

        // Check if currently checked out or unavailable
        const [bookActiveCheckouts] = await connection.execute(
          "SELECT COUNT(*) as count FROM book_transactions WHERE book_id = ? AND status = 'active'",
          [bId],
        );

        if (bookActiveCheckouts[0].count > 0 || !book.is_available) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            error: "Book unavailable",
            message: `"${book.title}" (ID: ${bId}) is currently checked out or unavailable.`,
          });
        }

        // Restricted Research & ME Thesis check
        if (Boolean(book.is_restricted_research) && !isDirectResearch) {
          // Regular UG student: check approved reservation
          const [approvedReservations] = await connection.execute(
            `SELECT id, status FROM book_reservations 
             WHERE book_id = ? AND user_id = ? AND status = 'APPROVED'
             ORDER BY created_at DESC LIMIT 1`,
            [bId, actualUserId],
          );

          if (approvedReservations.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({
              success: false,
              error: "Restricted Book",
              message: `Restricted: "${book.title}" is reserved for Research Scholars and ME Students. Normal students require prior Librarian approval.`,
            });
          }

          // Fulfill reservation
          await connection.execute(
            `UPDATE book_reservations SET status = 'FULFILLED', updated_at = NOW() WHERE id = ?`,
            [approvedReservations[0].id],
          );
        }

        // Insert into book_transactions
        const [insertResult] = await connection.execute(
          `INSERT INTO book_transactions (
            user_id, book_id, checked_out_by, checkout_date, due_date, status
          ) VALUES (?, ?, ?, ?, ?, 'active')`,
          [actualUserId, bId, librarianId, checkoutDate, dueDate],
        );

        // Mark book unavailable
        await connection.execute(
          "UPDATE books SET is_available = FALSE WHERE id = ?",
          [bId],
        );

        insertedTransactions.push({
          transaction_id: insertResult.insertId,
          book_id: bId,
          title: book.title,
          author: book.author,
          due_date: dueDate,
        });
      }

      // Update user updated_at
      await connection.execute(
        "UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [actualUserId],
      );

      await connection.commit();
      connection.release();

      return res.status(200).json({
        success: true,
        message: `Successfully checked out ${insertedTransactions.length} book(s) for ${borrower.first_name} ${borrower.last_name}`,
        count: insertedTransactions.length,
        due_date: dueDate,
        loan_days: effectiveLoanDays,
        borrower: {
          id: actualUserId,
          name: `${borrower.first_name} ${borrower.last_name}`,
          role: normalizedRoleName,
        },
        transactions: insertedTransactions,
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
          connection.release();
        } catch (connErr) {
          console.error("Error releasing connection:", connErr);
        }
      }
      console.error("Error during batch checkout:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error?.message,
      });
    }
  }

  // Return a book
  static async returnBook(req, res) {
    try {
      const transactionId = req.params.id;
      const { notes = "" } = req.body;
      const librarianId = req.user?.id || req.body.returned_by || null;

      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // Get transaction details
        const [transactions] = await connection.execute(
          "SELECT * FROM book_transactions WHERE id = ? AND status = ?",
          [transactionId, "active"],
        );

        if (transactions.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            message: "Active transaction not found",
          });
        }

        const transaction = transactions[0];
        const returnDate = new Date();
        const dueDate = new Date(transaction.due_date);

        // Calculate fine if overdue (staff and Book Bank loans are fine-exempt)
        const [borrowers] = await connection.execute(
          `SELECT u.id, LOWER(COALESCE(ur.role_name, 'student')) AS role_name
           FROM users u
           LEFT JOIN user_roles ur ON u.role_id = ur.id
           WHERE u.id = ?`,
          [transaction.user_id],
        );
        const isStaff = borrowers.length > 0 && ["staff", "teacher", "faculty"].includes(borrowers[0].role_name);
        const isFineExempt = isStaff;

        const daysOverdue = Math.max(
          0,
          Math.floor((returnDate - dueDate) / (1000 * 60 * 60 * 24)),
        );
        const finePerDay = 1;
        const fineAmount = isFineExempt ? 0 : daysOverdue * finePerDay;

        // Update transaction
        await connection.execute(
          `
                    UPDATE book_transactions
                    SET 
                        return_date = ?,
                        returned_by = ?,
                        notes = ?,
                        status = 'returned'
                    WHERE id = ?
                `,
          [returnDate, librarianId, notes, transactionId],
        );

        // Update book availability status
        await connection.execute(
          "UPDATE books SET is_available = TRUE WHERE id = ?",
          [transaction.book_id],
        );

        // Reflect return activity in the user account metadata.
        await connection.execute(
          "UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [transaction.user_id],
        );

        // Create fine record if overdue and user is not fine-exempt
        if (daysOverdue > 0 && !isFineExempt) {
          await connection.execute(
            `
                        INSERT INTO fines (
                            user_id,
                            transaction_id,
                            amount,
                            days_overdue,
                            status
                        ) VALUES (?, ?, ?, ?, 'pending')
                    `,
            [transaction.user_id, transactionId, fineAmount, daysOverdue],
          );
        }

        await connection.commit();

        // Get updated transaction details
        const [updatedTransaction] = await connection.execute(
          `
                    SELECT 
                        bt.*,
                        CONCAT(u.first_name, ' ', u.last_name) as user_name,
                        b.title,
                        b.author,
                        f.id as fine_id,
                        f.amount as fine_amount
                    FROM book_transactions bt
                    JOIN users u ON bt.user_id = u.id
                    JOIN books b ON bt.book_id = b.id
                    LEFT JOIN fines f ON bt.id = f.transaction_id AND f.status = 'pending'
                    WHERE bt.id = ?
                `,
          [transactionId],
        );

        connection.release();

        res.json({
          success: true,
          message: "Book returned successfully",
          transaction: updatedTransaction[0],
          fine_amount: fineAmount,
        });

        // Trigger reservation queue — notify next person waiting for this book
        const ReservationController = require("./reservation.controller");
        ReservationController.processReservationQueue(
          transaction.book_id,
        ).catch((err) => {
          console.error("Queue processing error after return:", err);
        });
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error("Error during return:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Quick return by scanning RFID tag, barcode, ISBN, bookId, or transactionId
  static async quickReturn(req, res) {
    let connection;
    try {
      const { identifier, condition = "good", notes = "" } = req.body;
      const librarianId = req.user?.id || null;

      if (!identifier) {
        return res.status(400).json({ error: "Identifier (barcode, RFID tag, ISBN, or transaction ID) is required" });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Find active transaction matching identifier by:
      // 1. Transaction ID
      // 2. Book ID
      // 3. Book ISBN
      // 4. RFID tag
      const [matchedTransactions] = await connection.execute(
        `SELECT bt.*, b.title, b.author, b.isbn,
                u.id as user_id, u.first_name, u.last_name, u.student_id,
                LOWER(COALESCE(ur.role_name, 'student')) as user_role
         FROM book_transactions bt
         JOIN books b ON bt.book_id = b.id
         JOIN users u ON bt.user_id = u.id
         LEFT JOIN user_roles ur ON u.role_id = ur.id
         LEFT JOIN rfid_tags rt ON b.id = rt.book_id
         WHERE bt.status = 'active' AND bt.return_date IS NULL
           AND (
             bt.id = ? 
             OR b.id = ? 
             OR b.isbn = ? 
             OR rt.tag_id = ?
           )
         LIMIT 1`,
        [identifier, identifier, identifier, identifier]
      );

      if (matchedTransactions.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          error: `No active checkout transaction found for: "${identifier}"`,
          message: `No active checkout transaction found for: "${identifier}"`,
        });
      }

      const tx = matchedTransactions[0];
      const returnDate = new Date();
      const dueDate = new Date(tx.due_date);

      // Check if user is staff (staff members are fine-exempt)
      const isStaff = ["staff", "teacher", "faculty"].includes(tx.user_role);
      const isFineExempt = isStaff;

      const daysOverdue = Math.max(0, Math.floor((returnDate - dueDate) / (1000 * 60 * 60 * 24)));
      const finePerDay = 1.0;
      const fineAmount = isFineExempt ? 0 : daysOverdue * finePerDay;

      // Update book transaction
      await connection.execute(
        `UPDATE book_transactions
         SET return_date = ?, returned_by = ?, notes = ?, return_condition = ?, status = 'returned'
         WHERE id = ?`,
        [returnDate, librarianId, notes, condition, tx.id]
      );

      // Mark book available
      await connection.execute(`UPDATE books SET is_available = TRUE WHERE id = ?`, [tx.book_id]);

      // Create fine record if overdue and not exempt
      if (daysOverdue > 0 && !isFineExempt) {
        await connection.execute(
          `INSERT INTO fines (user_id, transaction_id, amount, days_overdue, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [tx.user_id, tx.id, fineAmount, daysOverdue]
        );
      }

      await connection.commit();

      // Trigger reservation queue if someone is waiting
      const ReservationController = require("./reservation.controller");
      ReservationController.processReservationQueue(tx.book_id).catch((err) => {
        console.error("Queue processing error after quick-return:", err);
      });

      connection.release();

      return res.json({
        success: true,
        message: `"${tx.title}" returned successfully`,
        returned_book: {
          transaction_id: tx.id,
          book_id: tx.book_id,
          title: tx.title,
          author: tx.author,
          isbn: tx.isbn,
          borrower_name: `${tx.first_name} ${tx.last_name}`,
          student_id: tx.student_id,
          return_date: returnDate.toISOString(),
          days_overdue: daysOverdue,
          fine_amount: fineAmount,
          is_fine_exempt: isFineExempt
        }
      });
    } catch (error) {
      if (connection) {
        await connection.rollback().catch(() => {});
        connection.release();
      }
      console.error("Error in quickReturn:", error);
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
  }

  // Renew a book
  static async renewBook(req, res) {
    let connection;
    try {
      const transactionId = req.params.id;
      // Accept both renewDays and renew_days for flexibility
      const renewDays =
        req.body.renewDays || req.body.renew_days || req.body.extend_days || 14;
      connection = await pool.getConnection();

      // Check if renewal is allowed
      const [transaction] = await connection.execute(
        `
                SELECT 
                    bt.*,
                    b.title,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                JOIN users u ON bt.user_id = u.id
                WHERE bt.id = ? AND bt.return_date IS NULL
            `,
        [transactionId],
      );

      if (transaction.length === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          error: "Transaction not found or book already returned",
        });
      }

      const currentTransaction = transaction[0];

      // Check renewal limits (handle both renewed_count and renewal_count)
      const maxRenewals = 2; // From library settings
      const renewedCount =
        currentTransaction.renewed_count ||
        currentTransaction.renewal_count ||
        0;
      if (renewedCount >= maxRenewals) {
        connection.release();
        return res.status(400).json({
          success: false,
          error: `Maximum renewal limit (${maxRenewals}) reached`,
        });
      }

      // Check if book is reserved by someone else
      const [reservations] = await connection.execute(
        `
                SELECT COUNT(*) as count
                FROM reservations
                WHERE book_id = ? AND status = 'active' AND user_id != ?
            `,
        [currentTransaction.book_id, currentTransaction.user_id],
      );

      if (reservations[0].count > 0) {
        connection.release();
        return res.status(400).json({
          success: false,
          error: "Cannot renew: Book is reserved by another user",
        });
      }

      // Perform renewal
      const newDueDate = new Date();
      newDueDate.setDate(newDueDate.getDate() + getParsedInt(renewDays, 14));
      await updateRenewalWithCompatibility(
        connection,
        newDueDate.toISOString().split("T")[0],
        transactionId,
      );

      // Get updated transaction
      const [updatedTransaction] = await connection.execute(
        `
                SELECT 
                    bt.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    b.title,
                    b.author
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                JOIN books b ON bt.book_id = b.id
                WHERE bt.id = ?
            `,
        [transactionId],
      );

      connection.release();

      res.json({
        success: true,
        message: "Book renewed successfully",
        transaction: updatedTransaction[0],
        new_due_date: newDueDate.toISOString().split("T")[0],
      });
    } catch (error) {
      if (connection) {
        connection.release();
      }
      console.error("Error during renewal:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
        details: error.code || "Unknown error",
      });
    }
  }

  // Get active checkouts for a user
  static async getUserCheckouts(req, res) {
    try {
      const { userId } = req.params;
      const sessionUser = req.user || req.session?.user;
      const role = String(
        sessionUser?.role || sessionUser?.role_name || sessionUser?.role?.role_name || "",
      ).toLowerCase();

      if (role === "student" && sessionUser?.id && String(sessionUser.id) !== String(userId)) {
        return res.status(403).json({ error: "Access denied to other user's checkouts" });
      }

      const connection = await pool.getConnection();

      const [checkouts] = await connection.execute(
        `
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn,
                    cbl.shelf_code,
                    cbl.zone,
                    CASE 
                        WHEN bt.due_date < CURDATE() THEN 'overdue'
                        WHEN bt.due_date = CURDATE() THEN 'due_today'
                        ELSE 'active'
                    END as checkout_status,
                    DATEDIFF(CURDATE(), bt.due_date) as days_overdue,
                    f.amount as fine_amount
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                LEFT JOIN current_book_locations cbl ON b.id = cbl.book_id
                LEFT JOIN fines f ON bt.id = f.transaction_id AND f.status = 'pending'
                WHERE bt.user_id = ? AND bt.return_date IS NULL
                ORDER BY bt.checkout_date DESC
            `,
        [userId],
      );

      connection.release();

      res.json({
        user_id: getParsedInt(userId, 0),
        active_checkouts: checkouts.length,
        checkouts,
      });
    } catch (error) {
      console.error("Error fetching user checkouts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get overdue books
  static async getOverdueBooks(req, res) {
    try {
      const sessionUser = req.user || req.session?.user;
      const role = String(
        sessionUser?.role || sessionUser?.role_name || sessionUser?.role?.role_name || "",
      ).toLowerCase();
      const isAdminOrLibrarian = ["admin", "librarian"].includes(role);

      const connection = await pool.getConnection();

      let query = `
                SELECT 
                    bt.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    b.title,
                    b.author,
                    b.isbn,
                    DATEDIFF(CURDATE(), bt.due_date) as days_overdue,
                    GREATEST(DATEDIFF(CURDATE(), bt.due_date) * 1.00, 0) as calculated_fine,
                    f.amount as existing_fine,
                    f.status as fine_status
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                JOIN books b ON bt.book_id = b.id
                LEFT JOIN fines f ON bt.id = f.transaction_id
                WHERE bt.return_date IS NULL AND bt.due_date < CURDATE()
      `;
      let params = [];
      if (!isAdminOrLibrarian) {
        if (!sessionUser?.id) {
          connection.release();
          return res.status(401).json({ error: "Authentication required" });
        }
        query += ` AND bt.user_id = ?`;
        params.push(sessionUser.id);
      }
      query += ` ORDER BY bt.due_date ASC, u.last_name, u.first_name`;

      const [overdueBooks] = await connection.execute(query, params);
      connection.release();

      res.json({
        total_overdue: overdueBooks.length,
        overdue_books: overdueBooks,
      });
    } catch (error) {
      console.error("Error fetching overdue books:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get all active transactions
  static async getActiveTransactions(req, res) {
    try {
      const { page = 1, limit = 50, status = "active" } = req.query;
      const connection = await pool.getConnection();

      const parsedPage = getParsedInt(page, 1);
      const parsedLimit = getParsedInt(limit, 50);
      const offset = (parsedPage - 1) * parsedLimit;

      const [transactions] = await connection.execute(
        `
                SELECT 
                    bt.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    b.title,
                    b.author,
                    b.isbn,
                    CASE 
                        WHEN bt.due_date < CURDATE() THEN 'overdue'
                        WHEN bt.due_date = CURDATE() THEN 'due_today'
                        ELSE 'active'
                    END as checkout_status,
                    DATEDIFF(CURDATE(), bt.due_date) as days_overdue
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                JOIN books b ON bt.book_id = b.id
                WHERE (CASE WHEN bt.return_date IS NULL THEN 'active' ELSE 'returned' END) = ?
                ORDER BY bt.checkout_date DESC
                LIMIT ? OFFSET ?
            `,
        [status, parsedLimit, offset],
      );

      // Get total count
      const [countResult] = await connection.execute(
        `
                SELECT COUNT(*) as total
                FROM book_transactions
                WHERE status = ?
            `,
        [status],
      );

      connection.release();

      res.json({
        transactions,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / parsedLimit),
        },
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get transaction history for a book
  static async getBookTransactionHistory(req, res) {
    try {
      const { bookId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const connection = await pool.getConnection();

      const parsedPage = getParsedInt(page, 1);
      const parsedLimit = getParsedInt(limit, 20);
      const offset = (parsedPage - 1) * parsedLimit;

      const [transactions] = await connection.execute(
        `
                SELECT 
                    bt.*,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.student_id,
                    CONCAT(lib.first_name, ' ', lib.last_name) as processed_by
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                LEFT JOIN users lib ON bt.checked_out_by = lib.id
                WHERE bt.book_id = ?
                ORDER BY bt.created_at DESC
                LIMIT ? OFFSET ?
            `,
        [bookId, parsedLimit, offset],
      );

      // Get total count
      const [countResult] = await connection.execute(
        `
                SELECT COUNT(*) as total
                FROM book_transactions
                WHERE book_id = ?
            `,
        [bookId],
      );

      connection.release();

      res.json({
        book_id: getParsedInt(bookId, 0),
        transactions,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / parsedLimit),
        },
      });
    } catch (error) {
      console.error("Error fetching book transaction history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Quick checkout by scanning RFID or barcode
  static async quickCheckout(req, res) {
    try {
      const { tagId, userId, scanMethod = "rfid" } = req.body;
      const librarianId = req.user?.id;

      const connection = await pool.getConnection();

      // Find book by RFID tag or ISBN
      let bookQuery;
      let bookParams;

      if (scanMethod === "rfid") {
        bookQuery = `
                    SELECT b.id, b.title, b.author, b.is_available
                    FROM books b
                    JOIN rfid_tags rt ON b.id = rt.book_id
                    WHERE rt.tag_id = ?
                `;
        bookParams = [tagId];
      } else {
        // Assume barcode is ISBN
        bookQuery = `
                    SELECT b.id, b.title, b.author, b.is_available
                    FROM books b
                    WHERE b.isbn = ?
                `;
        bookParams = [tagId];
      }

      const [books] = await connection.execute(bookQuery, bookParams);

      if (books.length === 0) {
        connection.release();
        return res.status(404).json({
          error: `Book not found with ${scanMethod}: ${tagId}`,
        });
      }

      const book = books[0];

      // Use the existing checkout procedure
      await connection.beginTransaction();

      try {
        await connection.execute(
          `
                    CALL checkout_book(?, ?, ?, 14, @success, @message)
                `,
          [userId, book.id, librarianId],
        );

        const [output] = await connection.execute(
          "SELECT @success as success, @message as message",
        );
        const { success, message } = output[0];

        if (success) {
          await connection.commit();
          res.json({
            success: true,
            message: `"${book.title}" checked out successfully`,
            book: {
              id: book.id,
              title: book.title,
              author: book.author,
            },
            scan_method: scanMethod,
            scanned_id: tagId,
          });
        } else {
          await connection.rollback();
          res.status(400).json({
            success: false,
            message,
            book: {
              title: book.title,
              author: book.author,
            },
          });
        }
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } catch (error) {
      console.error("Error during quick checkout:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get all transactions with filtering
  static async getAllTransactions(req, res) {
    try {
      const {
        status,
        user_id,
        book_id,
        page = 1,
        limit = 20,
        date_from,
        date_to,
        sort_by = "checkout_date",
        sort_order = "DESC",
      } = req.query;

      // Parse and validate pagination parameters
      const parsedPage = Math.max(1, getParsedInt(page, 1));
      const parsedLimit = Math.min(100, Math.max(1, getParsedInt(limit, 20)));

      // Check if table has any data first
      const [countCheck] = await pool.query(
        "SELECT COUNT(*) as total FROM book_transactions",
      );
      if (countCheck[0].total === 0) {
        return res.json({
          transactions: [],
          pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total: 0,
            totalPages: 0,
          },
        });
      }

      const sessionUser = req.user || req.session?.user;
      const role = String(
        sessionUser?.role || sessionUser?.role_name || sessionUser?.role?.role_name || "",
      ).toLowerCase();
      const isAdminOrLibrarian = ["admin", "librarian"].includes(role);

      let effectiveUserId = user_id;
      if (!isAdminOrLibrarian) {
        if (!sessionUser?.id) {
          return res.status(401).json({ error: "Authentication required" });
        }
        effectiveUserId = sessionUser.id;
      }

      const filterInput = { status, user_id: effectiveUserId, book_id, date_from, date_to };

      let query = `
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    CONCAT(checkout_lib.first_name, ' ', checkout_lib.last_name) as issued_by_name,
                    CONCAT(return_lib.first_name, ' ', return_lib.last_name) as returned_by_name,
                    CASE 
                        WHEN bt.return_date IS NULL AND bt.due_date < CURDATE() THEN 'overdue'
                        WHEN bt.return_date IS NULL THEN 'active'
                        ELSE 'returned'
                    END as transaction_status,
                    COALESCE(fine_info.pending_fine, 0) as pending_fine,
                    COALESCE(fine_info.paid_fine, 0) as paid_fine
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                JOIN users u ON bt.user_id = u.id
                LEFT JOIN users checkout_lib ON bt.checked_out_by = checkout_lib.id
                LEFT JOIN users return_lib ON bt.returned_by = return_lib.id
                LEFT JOIN (
                    SELECT 
                        transaction_id,
                        SUM(CASE WHEN status = 'pending' THEN amount - amount_paid ELSE 0 END) as pending_fine,
                        SUM(CASE WHEN status = 'paid' THEN amount ELSE amount_paid END) as paid_fine
                    FROM fines
                    GROUP BY transaction_id
                ) fine_info ON bt.id = fine_info.transaction_id
                WHERE 1=1
            `;

      let params = [];
      query = appendTransactionFilters(query, filterInput, params);

      // Add sorting
      const validSortFields = [
        "checkout_date",
        "due_date",
        "return_date",
        "user_name",
        "title",
      ];
      const sortField = validSortFields.includes(sort_by)
        ? sort_by
        : "checkout_date";
      const sortDirection = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

      if (sort_by === "user_name") {
        query += ` ORDER BY CONCAT(u.first_name, ' ', u.last_name) ${sortDirection}`;
      } else if (sort_by === "title") {
        query += ` ORDER BY b.title ${sortDirection}`;
      } else {
        query += ` ORDER BY bt.${sortField} ${sortDirection}`;
      }

      // Add pagination
      const offset = (parsedPage - 1) * parsedLimit;
      query += ` LIMIT ? OFFSET ?`;
      params.push(parsedLimit, offset);

      const [transactions] = await pool.query(query, params);

      // Get total count
      let countQuery = `
                SELECT COUNT(*) as total
                FROM book_transactions bt
                WHERE 1=1
            `;
      let countParams = [];
      countQuery = appendTransactionFilters(
        countQuery,
        filterInput,
        countParams,
      );

      const [countResult] = await pool.query(countQuery, countParams);

      // Map transaction_status to status for frontend compatibility
      const formattedTransactions = transactions.map((t) => ({
        ...t,
        status:
          t.transaction_status ||
          t.status ||
          (t.return_date ? "returned" : "active"),
      }));

      res.json({
        transactions: formattedTransactions,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / parsedLimit),
        },
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get specific transaction details
  static async getTransactionById(req, res) {
    try {
      const { id } = req.params;
      const connection = await pool.getConnection();

      const [transactions] = await connection.execute(
        `
                SELECT 
                    bt.*,
                    b.title,
                    b.author,
                    b.isbn,
                    b.cover_image_url,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.email,
                    u.student_id,
                    u.phone,
                    CONCAT(checkout_lib.first_name, ' ', checkout_lib.last_name) as checked_out_by_name,
                    CONCAT(return_lib.first_name, ' ', return_lib.last_name) as returned_by_name,
                    CASE 
                        WHEN bt.return_date IS NULL AND bt.due_date < CURDATE() THEN 'overdue'
                        WHEN bt.return_date IS NULL THEN 'active'
                        ELSE 'returned'
                    END as transaction_status,
                    DATEDIFF(bt.due_date, CURDATE()) as days_until_due,
                    CASE WHEN bt.return_date IS NOT NULL THEN
                        DATEDIFF(bt.return_date, bt.checkout_date)
                    ELSE 
                        DATEDIFF(CURDATE(), bt.checkout_date)
                    END as loan_duration
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                JOIN users u ON bt.user_id = u.id
                LEFT JOIN users checkout_lib ON bt.checked_out_by = checkout_lib.id
                LEFT JOIN users return_lib ON bt.returned_by = return_lib.id
                WHERE bt.id = ?
            `,
        [id],
      );

      if (transactions.length === 0) {
        connection.release();
        return res.status(404).json({ error: "Transaction not found" });
      }

      const sessionUser = req.user || req.session?.user;
      const role = String(
        sessionUser?.role || sessionUser?.role_name || sessionUser?.role?.role_name || "",
      ).toLowerCase();
      if (role === "student" && sessionUser?.id && transactions[0].user_id !== sessionUser.id) {
        connection.release();
        return res.status(403).json({ error: "Access denied to transaction details" });
      }

      // Get fines for this transaction if any
      const [fines] = await connection.execute(
        `
                SELECT * FROM fines 
                WHERE transaction_id = ? 
                ORDER BY created_at DESC
            `,
        [id],
      );

      connection.release();

      res.json({
        transaction: transactions[0],
        fines: fines,
      });
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get transaction statistics for dashboard
  static async getTransactionStatistics(req, res) {
    try {
      const { period = "30" } = req.query;
      const connection = await pool.getConnection();

      // Overall transaction statistics
      const [overallStats] = await connection.execute(
        `
                SELECT 
                    COUNT(*) as total_transactions,
                    COUNT(CASE WHEN return_date IS NULL THEN 1 END) as active_checkouts,
                    COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as completed_returns,
                    COUNT(CASE WHEN return_date IS NULL AND due_date < CURDATE() THEN 1 END) as overdue_books,
                    COUNT(CASE WHEN renewal_count > 0 THEN 1 END) as renewed_transactions,
                    AVG(CASE WHEN return_date IS NOT NULL THEN 
                        DATEDIFF(return_date, checkout_date) 
                    END) as avg_loan_duration
                FROM book_transactions
                WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            `,
        [getParsedInt(period, 30)],
      );

      // Daily transaction trends
      const [dailyTrends] = await connection.execute(
        `
                SELECT 
                    DATE(checkout_date) as transaction_date,
                    COUNT(*) as checkouts,
                    COUNT(CASE WHEN return_date IS NOT NULL AND DATE(return_date) = DATE(checkout_date) THEN 1 END) as same_day_returns
                FROM book_transactions
                WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DATE(checkout_date)
                ORDER BY transaction_date DESC
                LIMIT 30
            `,
        [getParsedInt(period, 30)],
      );

      // Most active users
      const [activeUsers] = await connection.execute(
        `
                SELECT 
                    u.id,
                    CONCAT(u.first_name, ' ', u.last_name) as user_name,
                    u.student_id,
                    COUNT(bt.id) as transaction_count,
                    COUNT(CASE WHEN bt.return_date IS NULL THEN bt.id END) as active_checkouts
                FROM book_transactions bt
                JOIN users u ON bt.user_id = u.id
                WHERE bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY u.id
                ORDER BY transaction_count DESC
                LIMIT 10
            `,
        [getParsedInt(period, 30)],
      );

      // Most borrowed books
      const [popularBooks] = await connection.execute(
        `
                SELECT 
                    b.id,
                    b.title,
                    b.author,
                    b.isbn,
                    COUNT(bt.id) as checkout_count
                FROM book_transactions bt
                JOIN books b ON bt.book_id = b.id
                WHERE bt.checkout_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY b.id
                ORDER BY checkout_count DESC
                LIMIT 10
            `,
        [getParsedInt(period, 30)],
      );

      connection.release();

      res.json({
        period_days: getParsedInt(period, 30),
        overall_statistics: overallStats[0],
        daily_trends: dailyTrends,
        active_users: activeUsers,
        popular_books: popularBooks,
      });
    } catch (error) {
      console.error("Error fetching transaction statistics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = TransactionController;
