/**
 * Test Authentication Flow with Cookies
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

// Create axios instance with cookie support
const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function testAuth() {
  console.log('\n=== Testing Cookie-Based Authentication ===\n');

  try {
    // Test 1: Login with student account
    console.log('1. Testing login with student1@university.edu...');
    const loginResponse = await client.post('/auth/login', {
      email: 'student1@university.edu',
      password: 'password123'
    });

    console.log('✓ Login successful!');
    console.log('Response:', JSON.stringify(loginResponse.data, null, 2));
    console.log('Cookies received:', loginResponse.headers['set-cookie']);

    // Extract cookie for subsequent requests
    const cookies = loginResponse.headers['set-cookie'];
    if (cookies) {
      client.defaults.headers.Cookie = cookies.join('; ');
    }

    // Test 2: Access protected route
    console.log('\n2. Testing protected route (get profile)...');
    const profileResponse = await client.get('/users/profile');
    console.log('✓ Profile retrieved successfully!');
    console.log('Profile:', JSON.stringify(profileResponse.data, null, 2));

    // Test 3: Logout
    console.log('\n3. Testing logout...');
    const logoutResponse = await client.post('/auth/logout');
    console.log('✓ Logout successful!');
    console.log('Response:', JSON.stringify(logoutResponse.data, null, 2));

    // Test 4: Try accessing protected route after logout (should fail)
    console.log('\n4. Testing protected route after logout (should fail)...');
    try {
      await client.get('/users/profile');
      console.log('✗ UNEXPECTED: Should have failed but succeeded');
    } catch (error) {
      console.log('✓ Expected failure:', error.response?.status, error.response?.data?.message);
    }

    console.log('\n=== All tests completed! ===\n');

  } catch (error) {
    console.error('\n✗ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Request:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    console.error('\nFull error:', error);
  }
}

testAuth();
