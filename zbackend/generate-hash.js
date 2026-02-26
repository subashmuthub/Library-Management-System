const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'password123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Bcrypt hash for "password123":');
  console.log(hash);
  
  // Verify it works
  const isValid = await bcrypt.compare(password, hash);
  console.log('\nVerification:', isValid ? 'SUCCESS' : 'FAILED');
}

generateHash();
