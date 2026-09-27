/**
 * Add NEC Admin User
 * 
 * Creates admin account: 2312401@nec.edu.in / Nec@123#
 * Usage: node database/add-nec-admin.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function addNecAdmin() {
  console.log('='.repeat(50));
  console.log('  Adding NEC Admin User');
  console.log('='.repeat(50));

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_library',
  });

  try {
    console.log('✓ Connected to database');

    const email = '2312401@nec.edu.in';
    const plainPassword = 'Nec@123#';

    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    if (existing.length > 0) {
      // Update existing user to admin with new password
      await connection.execute(
        `UPDATE users SET password = ?, role_id = 1, status = 'active',
         first_name = 'NEC', last_name = 'Admin', updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`,
        [passwordHash, email]
      );
      console.log(`✓ Updated existing user ${email} to admin with new password`);
    } else {
      // Insert new admin user
      await connection.execute(
        `INSERT INTO users (email, password, first_name, last_name, role_id, student_id, phone, status)
         VALUES (?, ?, 'NEC', 'Admin', 1, NULL, NULL, 'active')`,
        [email, passwordHash]
      );
      console.log(`✓ Created admin user: ${email}`);
    }

    // Verify
    const [user] = await connection.execute(
      `SELECT u.id, u.email, u.first_name, u.last_name, ur.role_name, u.status
       FROM users u
       JOIN user_roles ur ON u.role_id = ur.id
       WHERE u.email = ?`,
      [email]
    );

    if (user.length > 0) {
      const u = user[0];
      console.log('\n  Admin account details:');
      console.log(`  ID       : ${u.id}`);
      console.log(`  Email    : ${u.email}`);
      console.log(`  Name     : ${u.first_name} ${u.last_name}`);
      console.log(`  Role     : ${u.role_name}`);
      console.log(`  Status   : ${u.status}`);
      console.log(`  Password : Nec@123# (hashed)`);
    }

    console.log('\n✓ Done');
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addNecAdmin();
