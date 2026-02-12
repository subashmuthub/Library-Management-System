require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'MS@muthu130405',
      database: 'smart_library'
    });

    const [rows] = await connection.execute(
      'SELECT id, email, first_name, last_name, role, student_id FROM users'
    );

    console.log('\n=== Users in database ===');
    if (rows.length > 0) {
      rows.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.first_name} ${user.last_name}`);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   Student ID:', user.student_id);
      });
    } else {
      console.log('✗ No users found in database');
    }

    await connection.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
