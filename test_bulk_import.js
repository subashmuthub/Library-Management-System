const fs = require('fs');
const path = require('path');

// Read the test data
const testData = JSON.parse(fs.readFileSync(path.join(__dirname, 'test_import.json'), 'utf8'));

// Create the request body
const requestBody = {
  books: testData
};

// Test the bulk import endpoint
async function testBulkImport() {
  try {
    console.log('Testing bulk import with', testData.length, 'books...');
    
    const response = await fetch('http://localhost:3000/api/v1/books/bulk-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    
    console.log('\nResponse Status:', response.status);
    console.log('\nResponse Data:');
    console.log(JSON.stringify(result, null, 2));

    if (result.summary) {
      console.log('\n=== IMPORT SUMMARY ===');
      console.log(`Total: ${result.summary.total}`);
      console.log(`Success: ${result.summary.success}`);
      console.log(`Failed: ${result.summary.failed}`);

      if (result.results.failed.length > 0) {
        console.log('\n=== FAILED RECORDS ===');
        result.results.failed.forEach(fail => {
          console.log(`Row ${fail.row}: ${fail.error}`);
        });
      }

      if (result.results.success.length > 0) {
        console.log('\n=== SUCCESSFUL RECORDS ===');
        result.results.success.forEach(success => {
          console.log(`✓ ${success.title} (ID: ${success.bookId})`);
        });
      }
    }
  } catch (error) {
    console.error('Error testing bulk import:', error.message);
  }
}

// Check if fetch is available in Node.js
if (typeof fetch === 'undefined') {
  // For older Node.js versions, use node-fetch
  try {
    const { default: fetch } = require('node-fetch');
    global.fetch = fetch;
    testBulkImport();
  } catch (e) {
    console.log('Please install node-fetch: npm install node-fetch');
    console.log('Or use Node.js 18+ which has built-in fetch');
  }
} else {
  testBulkImport();
}