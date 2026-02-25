/**
 * Comprehensive API Test Script
 * Tests all major endpoints to identify working and broken functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';

const endpoints = [
  { name: 'Health Check', method: 'GET', url: 'http://localhost:3001/health' },
  { name: 'Books - Get All', method: 'GET', url: `${BASE_URL}/books` },
  { name: 'Books - Categories', method: 'GET', url: `${BASE_URL}/books/categories` },
  { name: 'Books - Search', method: 'GET', url: `${BASE_URL}/books/search?q=test` },
  { name: 'Books - Get by ID', method: 'GET', url: `${BASE_URL}/books/3` },
  { name: 'Transactions', method: 'GET', url: `${BASE_URL}/transactions` },
  { name: 'Users', method: 'GET', url: `${BASE_URL}/users` },
  { name: 'Fines', method: 'GET', url: `${BASE_URL}/fines` },
  { name: 'Reservations', method: 'GET', url: `${BASE_URL}/reservations` },
  { name: 'Entry Log', method: 'GET', url: `${BASE_URL}/entry` },
  { name: 'RFID', method: 'GET', url: `${BASE_URL}/rfid` },
  { name: 'Readers', method: 'GET', url: `${BASE_URL}/readers` },
  { name: 'Shelves', method: 'GET', url: `${BASE_URL}/shelves` },
  { name: 'Beacons', method: 'GET', url: `${BASE_URL}/beacons` },
  { name: 'Navigation', method: 'GET', url: `${BASE_URL}/navigation` },
  { name: 'Dashboard', method: 'GET', url: `${BASE_URL}/dashboard` }
];

async function testEndpoints() {
  console.log('================================================================================');
  console.log('                     COMPREHENSIVE API FUNCTIONALITY TEST');
  console.log('================================================================================');
  console.log('');

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: endpoint.url,
        timeout: 5000
      });
      
      results.push({
        name: endpoint.name,
        status: 'SUCCESS',
        code: response.status,
        data: typeof response.data === 'object' ? Object.keys(response.data) : 'string response'
      });
      
      console.log(`✅ ${endpoint.name.padEnd(25)} - Status: ${response.status}`);
    } catch (error) {
      results.push({
        name: endpoint.name,
        status: 'FAILED',
        code: error.response?.status || 'NO_RESPONSE',
        error: error.response?.data?.error || error.message
      });
      
      console.log(`❌ ${endpoint.name.padEnd(25)} - Error: ${error.response?.status || 'NO_RESPONSE'} - ${error.response?.data?.error || error.message}`);
    }
  }

  console.log('');
  console.log('================================================================================');
  console.log('                                SUMMARY');
  console.log('================================================================================');
  
  const working = results.filter(r => r.status === 'SUCCESS').length;
  const broken = results.filter(r => r.status === 'FAILED').length;
  
  console.log(`Total Endpoints: ${results.length}`);
  console.log(`✅ Working: ${working}`);
  console.log(`❌ Broken: ${broken}`);
  
  if (broken > 0) {
    console.log('\n🚨 ISSUES FOUND:');
    results.filter(r => r.status === 'FAILED').forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n📊 WORKING ENDPOINTS:');
  results.filter(r => r.status === 'SUCCESS').forEach(r => {
    console.log(`   - ${r.name}: ${r.code}`);
  });
}

testEndpoints().catch(console.error);