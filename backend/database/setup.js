/**
 * Database Setup Script
 * 
 * Runs schema.sql and seed.sql to initialize the database.
 * Usage: node database/setup.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  console.log('='.repeat(60));
  console.log('  Database Setup');
  console.log('='.repeat(60));

  try {
    // Connect to MySQL (without database selection)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    console.log('✓ Connected to MySQL server');

    // Read and execute schema.sql
    console.log('\nExecuting schema.sql...');
    const schemaSQL = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // Split by DELIMITER to handle stored procedures separately
    const schemaParts = schemaSQL.split(/DELIMITER\s+\/\//i);
    
    // Execute the main schema (before stored procedures)
    if (schemaParts[0]) {
      await connection.query(schemaParts[0]);
    }
    
    console.log('✓ Schema created successfully (tables, indexes, and constraints)');

    // Read and execute seed.sql
    console.log('\nExecuting seed.sql...');
    const seedSQL = await fs.readFile(path.join(__dirname, 'seed.sql'), 'utf8');
    await connection.query(seedSQL);
    console.log('✓ Sample data inserted successfully');

    // Verify setup
    console.log('\nVerifying database setup...');
    const [users] = await connection.query('SELECT COUNT(*) as count FROM smart_library.users');
    const [books] = await connection.query('SELECT COUNT(*) as count FROM smart_library.books');
    const [shelves] = await connection.query('SELECT COUNT(*) as count FROM smart_library.shelves');

    console.log(`  - Users: ${users[0].count}`);
    console.log(`  - Books: ${books[0].count}`);
    console.log(`  - Shelves: ${shelves[0].count}`);

    await connection.end();

    console.log('\n' + '='.repeat(60));
    console.log('  ✓ Database setup completed successfully!');
    console.log('='.repeat(60));
    console.log('\nYou can now start the server:');
    console.log('  npm start');
    console.log('');

  } catch (error) {
    console.error('\n✗ Database setup failed:', error.message);
    console.error('\nPlease check:');
    console.error('  1. MySQL server is running');
    console.error('  2. Credentials in .env are correct');
    console.error('  3. User has permission to create databases');
    process.exit(1);
  }
}

setupDatabase();
