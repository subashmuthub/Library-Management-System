const http = require('http');

const BASE = 'http://localhost:3001/api/v1';
const results = [];

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function pass(name, detail) { results.push({ Test: name, Status: 'PASS', Detail: detail }); }
function fail(name, detail) { results.push({ Test: name, Status: 'FAIL', Detail: detail }); }

async function run() {
  let r;

  // 1. Entry log (use manualConfirm=true to bypass debounce)
  r = await request('POST', '/entry/log', { entryType: 'entry', latitude: 13.0827, longitude: 80.2707, wifiSSID: 'LibraryWiFi', speedKmh: 2.1, userId: 1, manualConfirm: true });
  if (r.body.success) pass('Entry log create', 'confidence=' + r.body.confidence?.total);
  else fail('Entry log create', JSON.stringify(r.body).substring(0, 120));

  // 2. Entry history
  r = await request('GET', '/entry/history?user_id=1');
  if (r.body.total >= 1 || r.body.entries?.length >= 1) pass('Entry history', 'entries=' + r.body.total);
  else fail('Entry history', JSON.stringify(r.body).substring(0, 120));

  // 3. RFID scan
  r = await request('POST', '/rfid/scan', { tagId: 'RFID-000001', shelfId: 1 });
  if (r.body.success) pass('RFID scan', 'shelf=' + r.body.location?.shelfCode);
  else fail('RFID scan', JSON.stringify(r.body).substring(0, 120));

  // 4. Book search
  r = await request('GET', '/books/search?q=1984');
  if (r.body.books?.length >= 1) pass('Book search', 'books=' + r.body.books.length);
  else fail('Book search', JSON.stringify(r.body).substring(0, 120));

  // 5. Fine statistics
  r = await request('GET', '/fines/statistics');
  if (r.status < 400) pass('Fine statistics', 'ok');
  else fail('Fine statistics', JSON.stringify(r.body).substring(0, 120));

  // 6. Payment history
  r = await request('GET', '/fines/payments/history?limit=5');
  if (r.body.receipts !== undefined) pass('Payment history', 'receipts=' + r.body.receipts.length);
  else fail('Payment history', JSON.stringify(r.body).substring(0, 120));

  // 7. Reservations
  r = await request('GET', '/reservations');
  if (r.body.reservations !== undefined) pass('Reservations list', 'n=' + r.body.reservations.length);
  else fail('Reservations list', JSON.stringify(r.body).substring(0, 120));

  // 8. User management
  r = await request('GET', '/user-management');
  if (r.body.users?.length >= 1) pass('User management', 'users=' + r.body.users.length);
  else fail('User management', JSON.stringify(r.body).substring(0, 120));

  // 9. Navigation
  r = await request('GET', '/navigation/find/1');
  if (r.body.navigation) pass('Navigation', 'beacon_zone=' + r.body.navigation.beacon?.zone);
  else fail('Navigation', JSON.stringify(r.body).substring(0, 120));

  // 10. Transactions
  r = await request('GET', '/transactions');
  if (r.body.transactions !== undefined) pass('Transactions list', 'n=' + r.body.transactions.length);
  else fail('Transactions list', JSON.stringify(r.body).substring(0, 120));

  // 11. Shelves
  r = await request('GET', '/shelves');
  if (r.body.shelves?.length >= 1) pass('Shelves list', 'shelves=' + r.body.shelves.length);
  else fail('Shelves list', JSON.stringify(r.body).substring(0, 120));

  // Print results
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n' + pad('Test', 28) + pad('Status', 8) + 'Detail');
  console.log('-'.repeat(70));
  for (const row of results) {
    console.log(pad(row.Test, 28) + pad(row.Status, 8) + row.Detail);
  }
  const fails = results.filter(r => r.Status === 'FAIL').length;
  console.log('\nTotal: ' + results.length + ' | Pass: ' + (results.length - fails) + ' | Fail: ' + fails);
  process.exit(fails > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
