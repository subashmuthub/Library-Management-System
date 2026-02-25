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

    const email = 'admin@library.edu';
    const password = 'password123';
    
    console.log('Testing login for:', email);
    console.log('Password:', password);
    
    // Find user
    const [users] = await connection.execute(
      `SELECT u.id, u.email, u.password, u.first_name, u.last_name, 
              u.role_id, r.role_name, u.student_id, u.status
       FROM users u
       JOIN user_roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );
    
    console.log('\nQuery results:');
    console.log('Users found:', users.length);
    
    if (users.length === 0) {
      console.log('❌ No user found');
      await connection.end();
      return;
    }
    
    const user = users[0];
    console.log('\nUser data:');
    console.log('- ID:', user.id);
    console.log('- Email:', user.email);
    console.log('- Name:', `${user.first_name} ${user.last_name}`);
    console.log('- Role ID:', user.role_id);
    console.log('- Role Name:', user.role_name);
    console.log('- Status:', user.status);
    console.log('- Password hash:', user.password);
    
    // Check status
    if (user.status !== 'active') {
      console.log('\n❌ Account is not active');
      await connection.end();
      return;
    }
    console.log('\n✓ Account is active');
    
    // Verify password
    console.log('\nTesting password comparison...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password match:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Password does not match');
      await connection.end();
      return;
    }
    
    console.log('\n✅ Login successful!');
    await connection.end();
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
})();
