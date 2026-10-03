const BASE = 'http://localhost:3001';

async function testCirculationBoundary() {
  console.log('--- Testing Student Restriction & Clerk Circulation Boundary ---');

  // 1. Login as Student
  const studentLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@university.edu', password: 'password123' })
  });
  const studentCookie = studentLoginRes.headers.get('set-cookie');
  const studentData = await studentLoginRes.json();
  const studentToken = studentData.token;
  console.log('Student Login:', studentData.user?.role || studentData.user?.role_name, 'ID:', studentData.user?.id);

  // 2. Attempt student checkout on /api/transactions/checkout
  const studentCheckoutRes = await fetch(`${BASE}/api/transactions/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': studentCookie || '',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      user_id: studentData.user.id,
      book_id: 1,
      loan_days: 14
    })
  });
  const studentCheckoutData = await studentCheckoutRes.json();
  console.log('Student Checkout HTTP Status:', studentCheckoutRes.status);
  console.log('Student Checkout Response:', studentCheckoutData);

  // 3. Attempt student checkout on /api/books/checkout
  const studentBookCheckoutRes = await fetch(`${BASE}/api/books/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': studentCookie || '',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      user_id: studentData.user.id,
      book_id: 1,
      loan_days: 14
    })
  });
  const studentBookCheckoutData = await studentBookCheckoutRes.json();
  console.log('Student Book Checkout HTTP Status:', studentBookCheckoutRes.status);
  console.log('Student Book Checkout Response:', studentBookCheckoutData);

  // 4. Student places reservation for book 1
  const reserveRes = await fetch(`${BASE}/api/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': studentCookie || '',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      book_id: 1
    })
  });
  const reserveData = await reserveRes.json();
  console.log('Student Reservation HTTP Status:', reserveRes.status);
  console.log('Student Reservation Message:', reserveData.message || reserveData.error);

  // 5. Login as Clerk
  const clerkLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'clerk@library.edu', password: 'password123' })
  });
  const clerkCookie = clerkLoginRes.headers.get('set-cookie');
  const clerkData = await clerkLoginRes.json();
  const clerkToken = clerkData.token;
  console.log('Clerk Login:', clerkData.user?.role || clerkData.user?.role_name, 'ID:', clerkData.user?.id);

  // 6. Clerk looks up student STU001
  const lookupRes = await fetch(`${BASE}/api/circulation/student-lookup/STU001`, {
    method: 'GET',
    headers: {
      'Cookie': clerkCookie || '',
      'Authorization': `Bearer ${clerkToken}`
    }
  });
  const lookupData = await lookupRes.json();
  console.log('Clerk Student Lookup Status:', lookupRes.status);
  console.log('Patron Found:', lookupData.student?.name, 'Reservations count:', lookupData.reservations?.length);

  // 7. If reservation exists, Clerk fulfills it at desk
  if (lookupData.reservations && lookupData.reservations.length > 0) {
    const resv = lookupData.reservations[0];
    console.log('Fulfilling reservation ID:', resv.reservation_id, 'Book:', resv.title);
    const issueRes = await fetch(`${BASE}/api/circulation/issue-reserved`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': clerkCookie || '',
        'Authorization': `Bearer ${clerkToken}`
      },
      body: JSON.stringify({
        reservation_id: resv.reservation_id,
        source: resv.source,
        barcode_or_accession_no: resv.accession_no || 'ACC-00001',
        loan_days: 14
      })
    });
    const issueData = await issueRes.json();
    console.log('Issue Reserved HTTP Status:', issueRes.status);
    console.log('Receipt Generated:', issueData.receipt ? issueData.receipt.receipt_no : null);
    console.log('Due Date:', issueData.receipt ? issueData.receipt.due_date : null);
  }

  process.exit(0);
}

testCirculationBoundary().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
