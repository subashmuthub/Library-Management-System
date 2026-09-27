/**
 * Fix book_transactions table structure
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTable() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'smart_library'
    });

    console.log('✓ Connected to MySQL');

    console.log('\nAdding missing columns to book_transactions table...');
    
    try {
      await connection.query('ALTER TABLE book_transactions ADD COLUMN status VARCHAR(20) DEFAULT "active" AFTER return_date');
      console.log('  ✓ Added status column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`  • status column already exists`);
      } else {
        throw e;
      }
    }

    try {
      await connection.query('ALTER TABLE book_transactions ADD COLUMN return_condition VARCHAR(50) AFTER status');
      console.log('  ✓ Added return_condition column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('  • return_condition column already exists');
      } else {
        throw e;
      }
    }

    try {
      await connection.query('ALTER TABLE book_transactions ADD COLUMN notes TEXT AFTER return_condition');
      console.log('  ✓ Added notes column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('  • notes column already exists');
      } else {
        throw e;
      }
    }

    try {
      await connection.query('ALTER TABLE book_transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
      console.log('  ✓ Added updated_at column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('  • updated_at column already exists');
      } else {
        throw e;
      }
    }

    console.log('\nVerifying table structure...');
    const [fields] = await connection.query('DESCRIBE book_transactions');
    console.log('Table columns:');
    fields.forEach(f => console.log(`  • ${f.Field} (${f.Type})`));

    await connection.end();
    console.log('\n✅ Table structure fixed successfully!');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

fixTable();
