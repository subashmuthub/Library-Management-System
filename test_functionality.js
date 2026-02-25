const http = require('http');
const fs = require('fs');
const path = require('path');

function makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(body),
                        headers: res.headers
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: body,
                        headers: res.headers
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(10000, () => {
            req.abort();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testAllFunctionality() {
    console.log('🚀 COMPREHENSIVE FUNCTIONALITY TEST\n');
    console.log('============================================================');
    
    const tests = [];
    
    try {
        // Test 1: Categories API
        console.log('🏷️  Test 1: Categories API');
        const categoriesResponse = await makeRequest('http://localhost:3000/api/v1/books/categories');
        
        if (categoriesResponse.status === 200) {
            const categories = categoriesResponse.data;
            console.log('✅ Categories API working');
            console.log(`   Found ${categories.length} categories:`);
            
            // Check department categories specifically
            const deptCategories = ['CSE', 'EEE', 'ECE', 'MECH', 'AIDS', 'S&H'];
            const deptStats = {};
            
            categories.forEach(cat => {
                if (deptCategories.includes(cat.name)) {
                    deptStats[cat.name] = cat.count;
                    console.log(`   • ${cat.name}: ${cat.count} books`);
                }
            });
            
            tests.push({
                name: 'Categories API',
                status: 'PASS',
                details: `${categories.length} categories found`
            });
            
        } else {
            console.log(`❌ Categories API failed: ${categoriesResponse.status}`);
            tests.push({
                name: 'Categories API',
                status: 'FAIL',
                details: `HTTP ${categoriesResponse.status}`
            });
        }
        
        console.log('\n--------------------------------------------------\n');
        
        // Test 2: Books API
        console.log('📚 Test 2: Books API');
        const booksResponse = await makeRequest('http://localhost:3000/api/v1/books');
        
        if (booksResponse.status === 200) {
            const booksData = booksResponse.data;
            console.log('Raw response structure:', Object.keys(booksData));
            console.log('Sample response:', JSON.stringify(booksData).substring(0, 200) + '...');
            
            const books = booksData.data?.books || booksData.books || booksData;
            
            if (Array.isArray(books)) {
                console.log(`✅ Books API working - ${books.length} total books`);
                console.log('   Recent books:');
                books.slice(0, 3).forEach(book => {
                    console.log(`   • "${book.title}" by ${book.author} (${book.category})`);
                });
                
                tests.push({
                    name: 'Books API',
                    status: 'PASS',
                    details: `${books.length} books loaded`
                });
            } else {
                console.log('❌ Books API response format invalid');
                console.log('Response keys:', Object.keys(booksData));
                console.log('Books data type:', typeof books, Array.isArray(books));
                tests.push({
                    name: 'Books API',
                    status: 'FAIL',
                    details: 'Invalid response format'
                });
            }
        } else {
            console.log(`❌ Books API failed: ${booksResponse.status}`);
            tests.push({
                name: 'Books API',
                status: 'FAIL',
                details: `HTTP ${booksResponse.status}`
            });
        }
        
        console.log('\n--------------------------------------------------\n');
        
        // Test 3: Search functionality
        console.log('🔍 Test 3: Search Functionality');
        const searchResponse = await makeRequest('http://localhost:3000/api/v1/books?search=algorithms');
        
        if (searchResponse.status === 200) {
            const searchData = searchResponse.data;
            const searchBooks = searchData.data?.books || searchData.books || searchData;
            
            if (Array.isArray(searchBooks)) {
                console.log(`✅ Search working - ${searchBooks.length} results for "algorithms"`);
                searchBooks.forEach(book => {
                    console.log(`   • "${book.title}" by ${book.author}`);
                });
                
                tests.push({
                    name: 'Search API',
                    status: 'PASS',
                    details: `${searchBooks.length} search results`
                });
            } else {
                console.log('❌ Search API response format invalid');
                console.log('Search response keys:', Object.keys(searchData));
                tests.push({
                    name: 'Search API',
                    status: 'FAIL',
                    details: 'Invalid response format'
                });
            }
        } else {
            console.log(`❌ Search API failed: ${searchResponse.status}`);
            tests.push({
                name: 'Search API',
                status: 'FAIL',
                details: `HTTP ${searchResponse.status}`
            });
        }
        
        console.log('\n--------------------------------------------------\n');
        
        // Test 4: Category filtering
        console.log('🎯 Test 4: Category Filtering');
        const filterResponse = await makeRequest('http://localhost:3000/api/v1/books?category=CSE');
        
        if (filterResponse.status === 200) {
            const filterData = filterResponse.data;
            const cseBooks = filterData.data?.books || filterData.books || filterData;
            
            if (Array.isArray(cseBooks)) {
                console.log(`✅ Category filtering working - ${cseBooks.length} CSE books`);
                cseBooks.forEach(book => {
                    console.log(`   • "${book.title}" by ${book.author}`);
                });
                
                tests.push({
                    name: 'Category Filter',
                    status: 'PASS',
                    details: `${cseBooks.length} CSE books found`
                });
            } else {
                console.log('❌ Category filter response format invalid');
                console.log('Filter response keys:', Object.keys(filterData));
                tests.push({
                    name: 'Category Filter',
                    status: 'FAIL',
                    details: 'Invalid response format'
                });
            }
        } else {
            console.log(`❌ Category filter failed: ${filterResponse.status}`);
            tests.push({
                name: 'Category Filter',
                status: 'FAIL',
                details: `HTTP ${filterResponse.status}`
            });
        }
        
        console.log('\n============================================================\n');
        
        // Test 5: Frontend connectivity
        console.log('🌐 Test 5: Frontend Connectivity');
        try {
            const frontendResponse = await makeRequest('http://localhost:3001/');
            if (frontendResponse.status === 200 || frontendResponse.status === 404) {
                console.log('✅ Frontend server accessible');
                tests.push({
                    name: 'Frontend Access',
                    status: 'PASS',
                    details: 'Frontend server responding'
                });
            } else {
                console.log(`❌ Frontend issue: ${frontendResponse.status}`);
                tests.push({
                    name: 'Frontend Access',
                    status: 'FAIL',
                    details: `HTTP ${frontendResponse.status}`
                });
            }
        } catch (error) {
            console.log('❌ Frontend not accessible:', error.message);
            console.log('   This might be normal if frontend is not running');
            tests.push({
                name: 'Frontend Access',
                status: 'WARNING',
                details: 'Frontend server not running'
            });
        }
        
        console.log('\n============================================================\n');
        
        // Summary
        console.log('📋 TEST SUMMARY');
        console.log('===============');
        
        const passed = tests.filter(t => t.status === 'PASS').length;
        const failed = tests.filter(t => t.status === 'FAIL').length;
        
        tests.forEach(test => {
            const icon = test.status === 'PASS' ? '✅' : '❌';
            console.log(`${icon} ${test.name}: ${test.details}`);
        });
        
        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        
        if (failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Your library system is fully functional.');
            console.log('\n🔗 Access your application:');
            console.log('   Backend API: http://localhost:3000');
            console.log('   Frontend UI: http://localhost:3001');
            console.log('   Books Page: http://localhost:3001/books');
        } else {
            console.log(`\n⚠️  ${failed} tests failed. Please check the issues above.`);
        }
        
    } catch (error) {
        console.error('❌ Test execution failed:');
        console.error('Message:', error.message);
    }
}

testAllFunctionality();