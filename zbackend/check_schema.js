const mysql = require('mysql2/promise');

async function checkSchema() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'MS@muthu130405',
    database: 'smart_library'
  });

  const [cols] = await conn.query('SHOW COLUMNS FROM book_transactions');
  
  console.log('\n📋 book_transactions table columns:\n');
  cols.forEach(c => {
    console.log(`  ✓ ${c.Field.padEnd(20)} ${c.Type}`);
  });
  
  await conn.end();
}

checkSchema().catch(console.error);
