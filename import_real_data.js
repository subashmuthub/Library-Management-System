const fs = require('fs');
const path = require('path');

// Read the real books data
const realBooksData = JSON.parse(fs.readFileSync(path.join(__dirname, 'real_books_data.json'), 'utf8'));

// Create the request body
const requestBody = {
  books: realBooksData
};

// Import real books data
async function importRealBooksData() {
  try {
    console.log('Importing realistic books data for all departments...');
    console.log(`Total books to import: ${realBooksData.length}`);
    
    // Show breakdown by department
    const deptCount = {};
    realBooksData.forEach(book => {
      deptCount[book.category] = (deptCount[book.category] || 0) + 1;
    });
    
    console.log('\nBooks by Department:');
    Object.entries(deptCount).forEach(([dept, count]) => {
      console.log(`${dept}: ${count} books`);
    });
    
    const response = await fetch('http://localhost:3000/api/v1/books/bulk-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    
    console.log('\n=== IMPORT STATUS ===');
    console.log(`Response Status: ${response.status}`);
    
    if (result.summary) {
      console.log('\n=== IMPORT SUMMARY ===');
      console.log(`Total: ${result.summary.total}`);
      console.log(`Success: ${result.summary.success}`);
      console.log(`Failed: ${result.summary.failed}`);

      if (result.results.failed.length > 0) {
        console.log('\n=== FAILED RECORDS ===');
        result.results.failed.forEach(fail => {
          console.log(`❌ Row ${fail.row}: ${fail.data?.title || 'Unknown'} - ${fail.error}`);
        });
      }

      if (result.results.success.length > 0) {
        console.log('\n=== SUCCESSFUL RECORDS ===');
        result.results.success.forEach(success => {
          console.log(`✓ ${success.title} (${realBooksData[success.row-2]?.category}) - ID: ${success.bookId}`);
        });
      }
    }

    // Test the updated categories endpoint
    console.log('\n=== UPDATED DEPARTMENT STATISTICS ===');
    const categoriesResponse = await fetch('http://localhost:3000/api/v1/books/categories');
    const categories = await categoriesResponse.json();
    
    categories.forEach(cat => {
      const deptNames = {
        'CSE': 'Computer Science & Engineering',
        'EEE': 'Electrical & Electronics Engineering', 
        'ECE': 'Electronics & Communication Engineering',
        'MECH': 'Mechanical Engineering',
        'AIDS': 'Artificial Intelligence & Data Science',
        'S&H': 'Science & Humanities'
      };
      
      if (deptNames[cat.name]) {
        console.log(`📚 ${cat.name}: ${cat.count} books - ${deptNames[cat.name]}`);
      } else {
        console.log(`📖 ${cat.name}: ${cat.count} books`);
      }
    });

    console.log('\n✅ Real books data import completed!');
    console.log('📱 Check the Books page at http://localhost:3002/books to see the updated data.');

  } catch (error) {
    console.error('❌ Error importing real books data:', error.message);
  }
}

// Check if fetch is available in Node.js
if (typeof fetch === 'undefined') {
  try {
    const { default: fetch } = require('node-fetch');
    global.fetch = fetch;
    importRealBooksData();
  } catch (e) {
    console.log('Please install node-fetch: npm install node-fetch');
    console.log('Or use Node.js 18+ which has built-in fetch');
  }
} else {
  importRealBooksData();
}