/**
 * Install Stored Procedures
 * This script installs all the stored procedures that use DELIMITER
 */

const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config();

async function installProcedures() {
  console.log('Installing stored procedures using mysql CLI...');

  try {
    const password = process.env.DB_PASSWORD || '';
    const user = process.env.DB_USER || 'root';
    const host = process.env.DB_HOST || 'localhost';
    const database = 'smart_library';

    // Use mysql CLI to execute the schema file which handles DELIMITER properly
    const passwordArg = password ? `-p${password}` : '';
    const command = `mysql -u ${user} ${passwordArg} -h ${host} ${database} -e "source database/schema.sql"`;
    
    console.log('Executing schema with procedures...');
    
    const { stdout, stderr } = await execPromise(command, {
      cwd: __dirname + '/..'
    });

    if (stderr && !stderr.includes('Warning')) {
      console.error('Errors:', stderr);
    }

    console.log('✓ Procedures installed');

    // Verify using Node.js connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'smart_library'
    });

    console.log('\nVerifying procedures...');
    const [procs] = await connection.query(`
      SELECT ROUTINE_NAME 
      FROM information_schema.ROUTINES 
      WHERE ROUTINE_SCHEMA = 'smart_library' 
      AND ROUTINE_TYPE = 'PROCEDURE'
    `);
    
    console.log(`  - Found ${procs.length} procedures:`);
    procs.forEach(proc => console.log(`    • ${proc.ROUTINE_NAME}`));

    await connection.end();

    console.log('\n✓ Stored procedures installed successfully!');

  } catch (error) {
    console.error('\n✗ Failed to install procedures:', error.message);
    console.log('\nTrying alternative method...');
    
    // Alternative: Use manual procedure creation
    await installManually();
  }
}

async function installManually() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'smart_library'
    });

    console.log('\nDropping existing procedures...');
    await connection.query('DROP PROCEDURE IF EXISTS checkout_book');
    await connection.query('DROP PROCEDURE IF EXISTS return_book');
    await connection.query('DROP PROCEDURE IF EXISTS calculate_entry_confidence');

    // Since procedures are complex, user should run: mysql -u root -p smart_library < database/schema.sql
    console.log('\n⚠ Please run the following command manually:');
    console.log('  mysql -u root -p smart_library < database/schema.sql');
    console.log('\nOr from PowerShell:');
    console.log('  Get-Content backend\\database\\schema.sql | mysql -u root -p smart_library');

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

installProcedures();
