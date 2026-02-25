const bcrypt = require('bcryptjs');

const hash = '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu';
const password = 'password123';

bcrypt.compare(password, hash, (err, result) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('Password "password123" matches hash:', result);
  
  // Also test generating a new hash
  bcrypt.hash('password123', 10, (err2, newHash) => {
    if (err2) {
      console.error('Error generating hash:', err2);
      return;
    }
    console.log('New hash for password123:', newHash);
  });
});
