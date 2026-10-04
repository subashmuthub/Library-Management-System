/**
 * Verification Test Suite for Admin Modules:
 * 1. Strict Role-Based Access Control (403 Forbidden for Student/Clerk/Librarian, 200 OK for Admin)
 * 2. Active Students Analytics & Aggregation
 * 3. Report Templates Management (CRUD)
 * 4. Dynamic Institutional PDF Document Generation (PDFKit streaming validation)
 * 5. Department Policy Engine Matrix & Circulation Integration
 */

const { pool } = require('./src/config/database');
const AdminController = require('./src/controllers/admin.controller');
const CirculationController = require('./src/controllers/circulation.controller');
const { authorize } = require('./src/middleware/auth.middleware');

const { PassThrough } = require('stream');

function createMockRes() {
  const res = new PassThrough();
  res.statusCode = 200;
  res.headers = {};
  res.data = null;
  const chunks = [];

  res.setHeader = function(name, value) {
    this.headers[name.toLowerCase()] = value;
  };
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.data = data;
    return this;
  };

  res.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  res.waitForFinish = function() {
    return new Promise((resolve) => {
      const done = () => {
        if (!this.data && chunks.length > 0) {
          this.data = Buffer.concat(chunks);
        }
        resolve();
      };
      if (this.writableEnded || this.closed) {
        done();
      } else {
        this.on('finish', done);
        this.on('end', done);
      }
    });
  };

  return res;
}

async function runTests() {
  console.log('================================================================');
  console.log('   ADMIN REPORTS & DEPARTMENT POLICIES - VERIFICATION SUITE');
  console.log('================================================================\n');

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
    // ------------------------------------------------------------------------
    // TEST 1: STRICT ACCESS CONTROL ENFORCEMENT
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Role-Based Access Control Gatekeeper (Admin Only) ---');

    const adminAuthCheck = authorize(['admin']);

    // 1.1 Student role -> 403 Forbidden
    let req = { user: { id: 4, role: 'student', email: 'student1@university.edu' } };
    let res = createMockRes();
    let nextCalled = false;
    adminAuthCheck(req, res, () => { nextCalled = true; });
    assert(res.statusCode === 403 && !nextCalled, 'Student role receives 403 Forbidden on Admin endpoint');

    // 1.2 Clerk role -> 403 Forbidden
    req = { user: { id: 13, role: 'clerk', email: 'clerk@library.edu' } };
    res = createMockRes();
    nextCalled = false;
    adminAuthCheck(req, res, () => { nextCalled = true; });
    assert(res.statusCode === 403 && !nextCalled, 'Clerk role receives 403 Forbidden on Admin endpoint');

    // 1.3 Librarian role -> 403 Forbidden
    req = { user: { id: 2, role: 'librarian', email: 'librarian@university.edu' } };
    res = createMockRes();
    nextCalled = false;
    adminAuthCheck(req, res, () => { nextCalled = true; });
    assert(res.statusCode === 403 && !nextCalled, 'Librarian role receives 403 Forbidden on Admin endpoint');

    // 1.4 Admin role -> Next called successfully
    req = { user: { id: 1, role: 'admin', email: 'admin@library.edu' } };
    res = createMockRes();
    nextCalled = false;
    adminAuthCheck(req, res, () => { nextCalled = true; });
    assert(nextCalled === true, 'Admin role authorized successfully');

    // ------------------------------------------------------------------------
    // TEST 2: ACTIVE STUDENTS ANALYTICS AGGREGATION
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Active Students Analytics Engine ---');

    req = { query: { month: 'all', year: '2026', department: 'all', degreeType: 'all' } };
    res = createMockRes();
    await AdminController.getActiveStudentsAnalytics(req, res);

    assert(res.data && res.data.success === true, 'Analytics endpoint returned success');
    assert(typeof res.data.summary.active_borrowers === 'number', 'Summary contains active_borrowers metric');
    assert(typeof res.data.summary.total_issues === 'number', 'Summary contains total_issues count');
    assert(typeof res.data.summary.on_time_return_rate === 'number', 'Summary contains on_time_return_rate percentage');
    assert(Array.isArray(res.data.department_breakdown), 'Department breakdown array returned');
    assert(Array.isArray(res.data.degree_distribution), 'Degree distribution array returned');
    assert(Array.isArray(res.data.top_borrowers), 'Top student borrowers leaderboard returned');

    // ------------------------------------------------------------------------
    // TEST 3: REPORT TEMPLATES MANAGEMENT (CRUD)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Report Templates Management ---');

    // 3.1 Get templates
    res = createMockRes();
    await AdminController.getTemplates({}, res);
    assert(res.data && res.data.templates.length > 0, 'Report templates retrieved from database');

    // 3.2 Create custom template
    res = createMockRes();
    await AdminController.saveTemplate({
      body: {
        template_name: 'NAAC Accreditation Audit Template',
        header_title: 'Central Library - Annual Academic Audit',
        institution_name: 'National Engineering College',
        show_department_breakdown: true,
        show_fine_summary: true,
        custom_footer_notes: 'Verified for Criteria 4.2.4 documentation.'
      }
    }, res);
    assert(res.data && res.data.success === true && res.data.template_id > 0, 'New report template saved to database');
    const createdTemplateId = res.data.template_id;

    // 3.3 Update custom template
    res = createMockRes();
    await AdminController.updateTemplate({
      params: { id: createdTemplateId },
      body: {
        header_title: 'Central Library - Verified NAAC Audit 2026',
        custom_footer_notes: 'Updated verification note.'
      }
    }, res);
    assert(res.data && res.data.success === true, 'Report template updated successfully');

    // ------------------------------------------------------------------------
    // TEST 4: DYNAMIC PDF DOCUMENT STREAMING & VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Institutional PDF Generation & Streaming ---');

    req = {
      body: {
        templateId: createdTemplateId,
        month: 'all',
        year: '2026',
        department: 'all',
        degreeType: 'all'
      }
    };
    res = createMockRes();
    await AdminController.generateActiveStudentsPDF(req, res);
    await res.waitForFinish();

    assert(res.headers['content-type'] === 'application/pdf', 'Response Header Content-Type is application/pdf');
    assert(res.headers['content-disposition'].includes('attachment; filename='), 'Content-Disposition attachment header set');
    assert(Buffer.isBuffer(res.data) && res.data.length > 500, `PDF stream generated successfully (${res.data?.length} bytes)`);

    // Verify PDF header magic bytes "%PDF-"
    const pdfHeader = res.data.slice(0, 5).toString('ascii');
    assert(pdfHeader === '%PDF-', 'Generated document has valid PDF magic header (%PDF-)');

    // ------------------------------------------------------------------------
    // TEST 5: DEPARTMENT POLICY ENGINE & CIRCULATION INTEGRATION
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Department Policy Engine & Circulation Integration ---');

    // 5.1 Fetch department policies
    res = createMockRes();
    await AdminController.getDepartmentPolicies({}, res);
    assert(res.data && res.data.policies.length >= 7, 'All seeded department policies retrieved (DEFAULT, CSE, MECH, etc.)');

    const csePolicy = res.data.policies.find(p => p.department_code === 'CSE');
    assert(csePolicy !== undefined, 'CSE department policy exists in matrix');

    // 5.2 Update CSE policy to custom limits
    res = createMockRes();
    await AdminController.updateDepartmentPolicy({
      params: { department_code: 'CSE' },
      body: {
        max_borrow_limit_ug: 9,
        loan_duration_days_ug: 16,
        allow_direct_thesis_checkout: true,
        daily_fine_rate: 3.50
      }
    }, res);
    assert(res.data && res.data.success === true, 'CSE department policy updated to 9 UG limit, 16 days duration, ₹3.50 fine');

    // 5.3 Verify CirculationController.resolveDepartmentPolicy reflects the new policy
    const testStudentCSE = {
      id: 4,
      department: 'CSE',
      degree_type: 'BE',
      role_name: 'student'
    };
    const resolvedPolicy = await CirculationController.resolveDepartmentPolicy(pool, testStudentCSE);

    assert(resolvedPolicy.department_code === 'CSE', 'Circulation engine resolved CSE department policy');
    assert(resolvedPolicy.max_borrow_limit === 9, 'Circulation engine dynamically resolved UG max_borrow_limit = 9');
    assert(resolvedPolicy.loan_duration_days === 16, 'Circulation engine dynamically resolved loan_duration_days = 16');
    assert(resolvedPolicy.daily_fine_rate === 3.50, 'Circulation engine dynamically resolved daily_fine_rate = ₹3.50');
    assert(resolvedPolicy.allow_direct_thesis_checkout === true, 'Circulation engine allowed direct thesis checkout per updated policy');

    // 5.4 Test studentLookup integration
    res = createMockRes();
    await CirculationController.studentLookup({ params: { query: String(testStudentCSE.id) } }, res);
    assert(res.data && res.data.stats.max_limit === 9, 'studentLookup stats.max_limit dynamically reflects department policy (9)');
    assert(res.data && res.data.stats.default_loan_days === 16, 'studentLookup stats.default_loan_days dynamically reflects department policy (16)');

    // 5.5 Revert CSE policy to standard baseline
    await AdminController.updateDepartmentPolicy({
      params: { department_code: 'CSE' },
      body: {
        max_borrow_limit_ug: 8,
        loan_duration_days_ug: 14,
        allow_direct_thesis_checkout: false,
        daily_fine_rate: 2.00
      }
    }, createMockRes());

    // 5.6 Test creating a new department policy
    res = createMockRes();
    await AdminController.createDepartmentPolicy({
      body: {
        department_code: 'AERO',
        department_name: 'Aerospace Engineering',
        max_borrow_limit_ug: 7,
        loan_duration_days_ug: 21,
        max_borrow_limit_pg: 12,
        loan_duration_days_pg: 60,
        allow_direct_thesis_checkout: false,
        daily_fine_rate: 2.50
      }
    }, res);
    assert(res.data && res.data.success === true, 'New department policy for AERO created successfully');

    // Clean up test department and test template
    await pool.query("DELETE FROM department_policies WHERE department_code = 'AERO'");
    await pool.query("DELETE FROM report_templates WHERE id = ?", [createdTemplateId]);

    console.log('\n================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
