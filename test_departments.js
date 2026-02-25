const fs = require('fs');
const path = require('path');

// Department test data
const testData = [
  {
    "title": "Data Structures and Algorithms",
    "author": "Cormen, Leiserson, Rivest",
    "isbn": "978-0-262-03384-1",
    "category": "CSE",
    "publisher": "MIT Press",
    "publication_year": "2009",
    "total_copies": "5"
  },
  {
    "title": "Digital Electronics",
    "author": "M. Morris Mano",
    "isbn": "978-0-13-277227-1",
    "category": "ECE", 
    "publisher": "Pearson",
    "publication_year": "2013",
    "total_copies": "3"
  },
  {
    "title": "Electric Machinery",
    "author": "A.E. Fitzgerald",
    "isbn": "978-0-07-366618-2",
    "category": "EEE",
    "publisher": "McGraw-Hill",
    "publication_year": "2003",
    "total_copies": "4"
  },
  {
    "title": "Machine Learning Yearning",
    "author": "Andrew Ng",
    "isbn": "978-1-234-56789-3",
    "category": "AIDS",
    "publisher": "deeplearning.ai",
    "publication_year": "2018",
    "total_copies": "2"
  },
  {
    "title": "Mechanics of Materials",
    "author": "Russell C. Hibbeler",
    "isbn": "978-0-13-451543-4",
    "category": "MECH",
    "publisher": "Pearson",
    "publication_year": "2017",
    "total_copies": "6"
  },
  {
    "title": "Calculus: Early Transcendentals",
    "author": "James Stewart",
    "isbn": "978-1-285-74155-0",
    "category": "S&H",
    "publisher": "Cengage Learning",
    "publication_year": "2015",
    "total_copies": "8"
  }
];

// Create the request body
const requestBody = {
  books: testData
};

// Test the bulk import endpoint
async function testDepartmentImport() {
  try {
    console.log('Testing department import with', testData.length, 'books...');
    
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

      if (result.results.success.length > 0) {
        console.log('\n=== SUCCESSFUL RECORDS ===');
        result.results.success.forEach(success => {
          console.log(`✓ ${success.title} (ID: ${success.bookId})`);
        });
      }
    }

    // Now test the categories endpoint
    console.log('\n=== TESTING CATEGORIES ENDPOINT ===');
    const categoriesResponse = await fetch('http://localhost:3000/api/v1/books/categories');
    const categories = await categoriesResponse.json();
    
    console.log('Categories with counts:');
    categories.forEach(cat => {
      console.log(`${cat.name}: ${cat.count} books - ${cat.full_name}`);
    });

  } catch (error) {
    console.error('Error testing department import:', error.message);
  }
}

// Check if fetch is available in Node.js
if (typeof fetch === 'undefined') {
  const { default: fetch } = require('node-fetch');
  global.fetch = fetch;
}

testDepartmentImport();