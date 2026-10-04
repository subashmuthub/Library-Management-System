/**
 * Automated Verification Script for Advanced Circulation Desk Suite
 * Tests all 5 modules end-to-end:
 * 1. Student Desk Hold blocking entry & reservations
 * 2. Hold Shelf Lifecycle & 72-hr Countdown
 * 3. Cash Desk Collection & ₹50 Fine Waiver / Escalation Threshold
 * 4. Misplaced & Damaged Book Inventory Pipeline
 * 5. Temporary Guest & Alumni Day Passes
 * 6. End-of-Shift Handover Reporting
 */

const { pool } = require('./src/config/database');
const CirculationController = require('./src/controllers/circulation.controller');
const BookController = require('./src/controllers/book.controller');

// Mock response helper
function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('========================================================');
  console.log('   ADVANCED CIRCULATION DESK SUITE - VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // Fetch a student user and clerk user
    const [students] = await pool.query("SELECT * FROM users WHERE role_id = 3 OR email LIKE '%student%' LIMIT 1");
    if (students.length === 0) throw new Error("No student user found in database");
    const testStudent = students[0];

    const [clerks] = await pool.query("SELECT * FROM users WHERE role_id = 7 OR email LIKE '%clerk%' LIMIT 1");
    const testClerk = clerks.length > 0 ? clerks[0] : { id: 1, first_name: 'Circulation', last_name: 'Clerk', role: 'clerk' };

    console.log(`Test Patron: ${testStudent.first_name} ${testStudent.last_name} (ID: ${testStudent.id}, Email: ${testStudent.email})`);
    console.log(`Test Clerk:  ${testClerk.first_name} ${testClerk.last_name} (ID: ${testClerk.id})\n`);

    // ------------------------------------------------------------------------
    // MODULE 4: STUDENT DESK HOLD VERIFICATION
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Desk Hold Gatekeeper Enforcement ---');

    // 1.1 Set Desk Hold
    let res = createMockRes();
    await CirculationController.setDeskHold(
      { body: { user_id: testStudent.id, has_desk_hold: true, reason: 'Pending ID verification at desk' } },
      res
    );
    assert(res.data.success && res.data.has_desk_hold === true, 'Desk hold placed on student account');

    // 1.2 Verify Student Lookup reflects Desk Hold
    res = createMockRes();
    await CirculationController.studentLookup({ params: { query: String(testStudent.id) } }, res);
    assert(res.data.student.has_desk_hold === true, 'Student lookup shows has_desk_hold = true');
    assert(res.data.stats.can_borrow === false, 'Student lookup sets can_borrow = false when on desk hold');

    // 1.3 Verify Direct Issue blocked with exact message
    res = createMockRes();
    await CirculationController.directIssue(
      {
        user: testClerk,
        body: { user_id: testStudent.id, identifier: '1', loan_days: 14 }
      },
      res
    );
    assert(res.statusCode === 403, 'Direct issue returns 403 for student on desk hold');
    assert(res.data.message === 'Account Blocked: Please see the Circulation Desk.', 'Exact error message returned for desk hold block');

    // 1.4 Lift Desk Hold
    res = createMockRes();
    await CirculationController.setDeskHold(
      { body: { user_id: testStudent.id, has_desk_hold: false } },
      res
    );
    assert(res.data.success && res.data.has_desk_hold === false, 'Desk hold lifted from student account');

    // ------------------------------------------------------------------------
    // MODULE 1: HOLD SHELF LIFECYCLE & 72-HR PICKUP COUNTDOWN
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Hold Shelf Lifecycle & 72-Hour Pickup Window ---');

    // Find or pick a book
    const [books] = await pool.query("SELECT * FROM books WHERE status = 'active' LIMIT 1");
    if (books.length === 0) throw new Error("No active book found in database");
    const testBook = books[0];

    // Ensure an active reservation exists for testBook
    await pool.query("DELETE FROM reservations WHERE user_id = ? AND book_id = ?", [testStudent.id, testBook.id]);
    const [resvInsert] = await pool.query(
      "INSERT INTO reservations (book_id, user_id, status, queue_position) VALUES (?, ?, 'active', 1)",
      [testBook.id, testStudent.id]
    );

    // Return the book via manualReturn with condition 'good'
    res = createMockRes();
    await CirculationController.manualReturn(
      {
        user: testClerk,
        body: { identifier: testBook.barcode || testBook.accession_no || testBook.id, condition: 'good' }
      },
      res
    );
    assert(res.data.success === true, 'Manual return completed');
    assert(res.data.on_hold_shelf === true, 'Book auto-routed to Hold Shelf because active reservation was waiting');
    assert(res.data.hold_reservation && res.data.hold_reservation.remaining_hours === 72, '72-hour pickup countdown window initialized');

    // Verify hold shelf endpoint lists this item
    res = createMockRes();
    await CirculationController.getHoldShelf({}, res);
    assert(res.data.success === true && res.data.items.length > 0, 'GET /api/circulation/hold-shelf returns active hold shelf items');
    const holdItem = res.data.items.find(i => i.book_id === testBook.id);
    assert(holdItem && holdItem.status === 'on_hold_shelf', 'Hold item listed with status on_hold_shelf');

    // ------------------------------------------------------------------------
    // MODULE 2: CASH DESK & FINE DISPUTES (₹50 THRESHOLD)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Cash Desk & Fine Disputes / Waivers (₹50 Threshold) ---');

    // 3.1 Direct Waiver for fine <= 50 INR
    const [fineRow1] = await pool.query(
      "INSERT INTO fines (user_id, amount, fine_type, notes, status) VALUES (?, 40.00, 'overdue', 'System glitch delay', 'pending')",
      [testStudent.id]
    );
    const fineId1 = fineRow1.insertId;

    res = createMockRes();
    await CirculationController.disputeFine(
      {
        user: testClerk,
        body: { fine_id: fineId1, reason_category: 'System Error', reason_text: 'Scanner offline at counter' }
      },
      res
    );
    assert(res.data.success === true && res.data.action === 'WAIVED', 'Fine <= ₹50 waived directly by clerk');

    const [fineCheck1] = await pool.query("SELECT status FROM fines WHERE id = ?", [fineId1]);
    assert(fineCheck1[0].status === 'waived', 'Fine record status updated to waived in database');

    // 3.2 Escalation for fine > 50 INR
    const [fineRow2] = await pool.query(
      "INSERT INTO fines (user_id, amount, fine_type, notes, status) VALUES (?, 150.00, 'overdue', 'Late return', 'pending')",
      [testStudent.id]
    );
    const fineId2 = fineRow2.insertId;

    res = createMockRes();
    await CirculationController.disputeFine(
      {
        user: testClerk,
        body: { fine_id: fineId2, reason_category: 'Medical Exemption', reason_text: 'Hospitalization certificate presented' }
      },
      res
    );
    assert(res.data.success === true && res.data.action === 'ESCALATED', 'Fine > ₹50 automatically escalated to Chief Librarian');

    const [disputeRows] = await pool.query("SELECT * FROM fine_disputes WHERE fine_id = ?", [fineId2]);
    assert(disputeRows.length > 0 && disputeRows[0].status === 'ESCALATED_TO_LIBRARIAN', 'Dispute logged in fine_disputes with ESCALATED_TO_LIBRARIAN');

    // 3.3 Offline Cash Collection
    const [fineRow3] = await pool.query(
      "INSERT INTO fines (user_id, amount, fine_type, notes, status) VALUES (?, 50.00, 'overdue', 'Counter overdue', 'pending')",
      [testStudent.id]
    );
    const fineId3 = fineRow3.insertId;

    res = createMockRes();
    await CirculationController.collectCash(
      {
        user: testClerk,
        body: { fine_id: fineId3, student_id: testStudent.id, amount_received: 50.00, receipt_notes: 'Physical cash received at desk' }
      },
      res
    );
    assert(res.data.success === true, 'Cash payment collected successfully');
    assert(res.data.receipt && res.data.receipt.receipt_no.startsWith('CSH-'), 'Printable cash receipt generated with CSH- prefix');

    const [cashLogCheck] = await pool.query("SELECT * FROM cash_desk_logs WHERE fine_id = ?", [fineId3]);
    assert(cashLogCheck.length > 0 && Number(cashLogCheck[0].amount_received) === 50.00, 'Transaction recorded in cash_desk_logs');

    // ------------------------------------------------------------------------
    // MODULE 3: INVENTORY INTEGRITY & MISPLACED BOOKS
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Inventory Misplaced & Damaged Pipeline ---');

    // Flag book as misplaced
    res = createMockRes();
    await CirculationController.flagMisplaced(
      {
        body: { identifier: testBook.id, misplaced_notes: 'Missing from Shelf 3B, checking reading room' }
      },
      res
    );
    assert(res.data.success === true, 'Book flagged as misplaced with locator notes');

    // Verify catalog search hides misplaced book for students
    res = createMockRes();
    await BookController.getAllBooks(
      {
        user: { role: 'student' },
        query: { search: testBook.title }
      },
      res
    );
    const booksList = res.data.data?.books || res.data.books || [];
    const foundInStudentSearch = booksList.some(b => b.id === testBook.id);
    assert(!foundInStudentSearch, 'Misplaced book is hidden from student catalog search');

    // Restore misplaced book after shelf audit
    res = createMockRes();
    await CirculationController.resolveMisplaced(
      { body: { identifier: testBook.id } },
      res
    );
    assert(res.data.success === true, 'Misplaced book restored to active shelf inventory');

    // ------------------------------------------------------------------------
    // MODULE 4: TEMPORARY GUEST PASSES
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Temporary Guest & Alumni Day Passes ---');

    res = createMockRes();
    await CirculationController.issueGuestPass(
      {
        user: testClerk,
        body: {
          guest_name: 'Dr. Vikram Sarabhai',
          guest_type: 'RESEARCHER',
          phone: '+91-9876543210',
          email: 'vikram@isro.res.in',
          institution: 'Space Research Center',
          purpose: 'Archival manuscript consultation',
          assigned_rfid_card_id: 'RFID-GUEST-99',
          valid_hours: 8
        }
      },
      res
    );
    assert(res.data.success === true && res.data.pass.pass_number.startsWith('GP-'), 'Temporary guest pass issued with GP- prefix');
    const guestPassId = res.data.pass.id;

    // Check in badge / return
    res = createMockRes();
    await CirculationController.returnGuestPass({ params: { id: guestPassId } }, res);
    assert(res.data.success === true, 'Guest badge checked in and pass marked RETURNED');

    const [passCheck] = await pool.query("SELECT status, returned_at FROM guest_passes WHERE id = ?", [guestPassId]);
    assert(passCheck[0].status === 'RETURNED' && passCheck[0].returned_at !== null, 'Pass status updated to RETURNED in database');

    // ------------------------------------------------------------------------
    // MODULE 5: SHIFT HANDOVER REPORTING
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: End-of-Shift Handover Reporting ---');

    res = createMockRes();
    await CirculationController.getShiftSummary({ user: testClerk }, res);
    assert(res.data.success === true && res.data.metrics !== undefined, 'Live shift summary metrics aggregated');
    const summaryMetrics = res.data.metrics;

    res = createMockRes();
    await CirculationController.submitShiftHandover(
      {
        user: testClerk,
        body: {
          shift_start: new Date(Date.now() - 8 * 3600000).toISOString(),
          shift_end: new Date().toISOString(),
          books_issued_count: summaryMetrics?.books_issued_count || 1,
          books_returned_count: summaryMetrics?.books_returned_count || 1,
          cash_collected: summaryMetrics?.cash_collected || 50,
          damaged_books_count: 0,
          handover_notes: 'Drawer reconciled. ₹50 physical cash transferred to evening clerk.'
        }
      },
      res
    );
    assert(res.data.success === true && res.data.handover_id > 0, 'Shift handover report saved to shift_handovers');

    // Clean up test reservation and fines created
    await pool.query("DELETE FROM reservations WHERE id = ?", [resvInsert.insertId]);
    await pool.query("DELETE FROM fines WHERE id IN (?, ?, ?)", [fineId1, fineId2, fineId3]);

    console.log('\n========================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
