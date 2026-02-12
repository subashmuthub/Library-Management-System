/**
 * API Test Script
 * 
 * Tests all major API endpoints to verify system functionality.
 * Run with: node tests/api-test.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = '';

// Test utilities
const log = (message) => {
  console.log(`\n✓ ${message}`);
};

const logError = (message, error) => {
  console.error(`\n✗ ${message}`);
  if (error.response) {
    console.error(`  Status: ${error.response.status}`);
    console.error(`  Message: ${JSON.stringify(error.response.data, null, 2)}`);
  } else {
    console.error(`  Error: ${error.message}`);
  }
};

// Test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('  Smart Library API Test Suite');
  console.log('='.repeat(60));

  try {
    // Test 1: Health Check
    await testHealthCheck();

    // Test 2: User Registration
    await testRegistration();

    // Test 3: User Login
    await testLogin();

    // Test 4: Get Profile
    await testGetProfile();

    // Test 5: Search Books
    await testSearchBooks();

    // Test 6: Get Book Details
    await testGetBookDetails();

    // Test 7: List Shelves
    await testListShelves();

    // Test 8: Entry Log (High Confidence)
    await testEntryLogHighConfidence();

    // Test 9: Entry Log (Low Confidence)
    await testEntryLogLowConfidence();

    // Test 10: RFID Scan (DEMO MODE)
    await testRFIDScan();

    // Test 11: Navigation
    await testNavigation();

    // Test 12: List Beacons
    await testListBeacons();

    // Test 13: Get Occupancy
    await testGetOccupancy();

    console.log('\n' + '='.repeat(60));
    console.log('  ✓ All tests passed!');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('  1. Try the API endpoints with Postman');
    console.log('  2. Review docs/API_CONTRACTS.md');
    console.log('  3. Test mode switching (set DEMO_MODE=false in .env)');
    console.log('');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('  ✗ Test suite failed');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

// Individual test functions

async function testHealthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.data.status === 'OK') {
      log('Health Check: Server is running');
    } else {
      throw new Error('Health check failed');
    }
  } catch (error) {
    logError('Health Check Failed', error);
    throw error;
  }
}

async function testRegistration() {
  try {
    const response = await axios.post(`${BASE_URL}/api/v1/auth/register`, {
      email: `test${Date.now()}@university.edu`,
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'student',
      studentId: `STU${Date.now()}`
    });

    if (response.status === 201) {
      log('User Registration: New user created');
    } else {
      throw new Error('Registration failed');
    }
  } catch (error) {
    logError('User Registration Failed', error);
    throw error;
  }
}

async function testLogin() {
  try {
    const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      email: 'student1@university.edu',
      password: 'password123'
    });

    if (response.data.token) {
      authToken = response.data.token;
      log('User Login: Token received');
    } else {
      throw new Error('Login failed - no token');
    }
  } catch (error) {
    logError('User Login Failed', error);
    throw error;
  }
}

async function testGetProfile() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/users/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.email) {
      log(`Get Profile: ${response.data.firstName} ${response.data.lastName}`);
    } else {
      throw new Error('Profile fetch failed');
    }
  } catch (error) {
    logError('Get Profile Failed', error);
    throw error;
  }
}

async function testSearchBooks() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/books/search?q=Pride`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.books && response.data.books.length > 0) {
      log(`Search Books: Found ${response.data.books.length} books`);
    } else {
      throw new Error('Search returned no results');
    }
  } catch (error) {
    logError('Search Books Failed', error);
    throw error;
  }
}

async function testGetBookDetails() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/books/1`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.title) {
      log(`Get Book: "${response.data.title}" on shelf ${response.data.currentLocation?.shelfCode || 'unknown'}`);
    } else {
      throw new Error('Book details fetch failed');
    }
  } catch (error) {
    logError('Get Book Details Failed', error);
    throw error;
  }
}

async function testListShelves() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/shelves`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.shelves && response.data.shelves.length > 0) {
      log(`List Shelves: Found ${response.data.shelves.length} shelves`);
    } else {
      throw new Error('Shelves fetch failed');
    }
  } catch (error) {
    logError('List Shelves Failed', error);
    throw error;
  }
}

async function testEntryLogHighConfidence() {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/v1/entry/log`,
      {
        entryType: 'entry',
        latitude: 37.7749,
        longitude: -122.4194,
        wifiSSID: 'LibraryWiFi',
        speedKmh: 2.5,
        manualConfirm: false
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.data.success && response.data.confidence.total === 100) {
      log(`Entry Log (High): Confidence=${response.data.confidence.total}%, Auto-logged`);
    } else {
      throw new Error('Entry log failed');
    }
  } catch (error) {
    logError('Entry Log (High Confidence) Failed', error);
    throw error;
  }
}

async function testEntryLogLowConfidence() {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/v1/entry/log`,
      {
        entryType: 'entry',
        latitude: 37.8,
        longitude: -122.5,
        wifiSSID: 'OtherNetwork',
        speedKmh: 15,
        manualConfirm: false
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    // This should fail due to low confidence
    throw new Error('Low confidence entry should have been rejected');

  } catch (error) {
    if (error.response && error.response.status === 400) {
      log('Entry Log (Low): Correctly rejected low confidence entry');
    } else {
      logError('Entry Log (Low Confidence) Test Failed', error);
      throw error;
    }
  }
}

async function testRFIDScan() {
  try {
    // Login as librarian first
    const loginResponse = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      email: 'librarian1@library.edu',
      password: 'password123'
    });

    const librarianToken = loginResponse.data.token;

    const response = await axios.post(
      `${BASE_URL}/api/v1/rfid/scan`,
      {
        tagId: 'RFID-000001',
        shelfId: 3  // DEMO MODE requires manual shelf selection
      },
      {
        headers: { Authorization: `Bearer ${librarianToken}` }
      }
    );

    if (response.data.success) {
      log(`RFID Scan: ${response.data.book.title} → Shelf ${response.data.location.shelfCode}`);
    } else {
      throw new Error('RFID scan failed');
    }
  } catch (error) {
    logError('RFID Scan Failed', error);
    throw error;
  }
}

async function testNavigation() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/navigation/find/1`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.book && response.data.location) {
      log(`Navigation: ${response.data.book.title} is in Zone ${response.data.location.zone}`);
    } else {
      throw new Error('Navigation failed');
    }
  } catch (error) {
    logError('Navigation Failed', error);
    throw error;
  }
}

async function testListBeacons() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/beacons`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.beacons && response.data.beacons.length > 0) {
      log(`List Beacons: Found ${response.data.beacons.length} beacons`);
    } else {
      throw new Error('Beacons fetch failed');
    }
  } catch (error) {
    logError('List Beacons Failed', error);
    throw error;
  }
}

async function testGetOccupancy() {
  try {
    // Login as librarian
    const loginResponse = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      email: 'librarian1@library.edu',
      password: 'password123'
    });

    const librarianToken = loginResponse.data.token;

    const response = await axios.get(`${BASE_URL}/api/v1/entry/occupancy`, {
      headers: { Authorization: `Bearer ${librarianToken}` }
    });

    if (response.data.currentOccupancy !== undefined) {
      log(`Current Occupancy: ${response.data.currentOccupancy} students in library`);
    } else {
      throw new Error('Occupancy fetch failed');
    }
  } catch (error) {
    logError('Get Occupancy Failed', error);
    throw error;
  }
}

// Run tests
runTests().catch(() => {
  process.exit(1);
});
