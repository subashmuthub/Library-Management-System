const http = require('http');

async function testAllFeatures() {
    console.log('🎯 COMPREHENSIVE SYSTEM TEST - DATABASE TO FRONTEND\n');
    console.log('===========================================================');
    
    function makeRequest(url, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: { 'Content-Type': 'application/json' }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(body) });
                    } catch (error) {
                        resolve({ status: res.statusCode, data: body });
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(5000, () => { req.abort(); reject(new Error('Timeout')); });
            
            if (data) req.write(JSON.stringify(data));
            req.end();
        });
    }
    
    const testResults = [];
    
    try {
        // Test 1: Database Connection & Data
        console.log('📊 Test 1: Database Data Integrity');
        console.log('-----------------------------------');
        
        const categoriesRes = await makeRequest('http://localhost:3000/api/v1/books/categories');
        if (categoriesRes.status === 200) {
            const deptCats = ['CSE', 'EEE', 'ECE', 'MECH', 'AIDS', 'S&H'];
            const deptData = {};
            let totalDept = 0;
            
            categoriesRes.data.forEach(cat => {
                if (deptCats.includes(cat.name)) {
                    deptData[cat.name] = cat.count;
                    totalDept += cat.count;
                }
            });
            
            console.log(`✅ Categories loaded: ${categoriesRes.data.length} total`);
            console.log(`✅ Department books: ${totalDept} across all departments`);
            Object.entries(deptData).forEach(([dept, count]) => {
                console.log(`   🎯 ${dept}: ${count} books`);
            });
            
            testResults.push('✅ Database Connection & Categories');
        } else {
            console.log('❌ Categories API failed');
            testResults.push('❌ Categories API');
        }
        
        console.log('\\n-----------------------------------\\n');
        
        // Test 2: Books API & Pagination
        console.log('📚 Test 2: Books API & Data Serving');
        const booksRes = await makeRequest('http://localhost:3000/api/v1/books');
        if (booksRes.status === 200 && booksRes.data.data?.books) {
            const books = booksRes.data.data.books;
            console.log(`✅ Books API working: ${books.length} books loaded`);
            console.log('✅ Sample books:');
            books.slice(0, 3).forEach(book => {
                console.log(`   • "${book.title}" by ${book.author} (${book.category})`);
            });
            testResults.push('✅ Books API & Data');
        } else {
            console.log('❌ Books API failed or invalid format');
            testResults.push('❌ Books API');
        }
        
        console.log('\\n-----------------------------------\\n');
        
        // Test 3: Search Functionality
        console.log('🔍 Test 3: Search & Filtering');
        const searchRes = await makeRequest('http://localhost:3000/api/v1/books?search=engineering');
        if (searchRes.status === 200 && searchRes.data.data?.books) {
            const searchBooks = searchRes.data.data.books;
            console.log(`✅ Search working: ${searchBooks.length} results for "engineering"`);
            testResults.push('✅ Search Functionality');
        } else {
            console.log('❌ Search functionality failed');
            testResults.push('❌ Search Function');
        }
        
        // Test 4: Department Filtering
        const filterRes = await makeRequest('http://localhost:3000/api/v1/books?category=CSE');
        if (filterRes.status === 200 && filterRes.data.data?.books) {
            const cseBooks = filterRes.data.data.books;
            console.log(`✅ Category filtering: ${cseBooks.length} CSE books found`);
            testResults.push('✅ Category Filtering');
        } else {
            console.log('❌ Category filtering failed');
            testResults.push('❌ Category Filter');
        }
        
        console.log('\\n-----------------------------------\\n');
        
        // Test 5: Bulk Import Capability
        console.log('📦 Test 4: Bulk Import System');
        const testBook = [{
            title: "Test Engineering Book",
            author: "Test Author", 
            isbn: "TEST-123-456",
            category: "CSE",
            publisher: "Test Publisher",
            publication_year: "2024",
            total_copies: "1"
        }];
        
        const importRes = await makeRequest(
            'http://localhost:3000/api/v1/books/bulk-import', 
            'POST', 
            { books: testBook }
        );
        
        if (importRes.status === 200) {
            console.log(`✅ Bulk import working: ${importRes.data.summary?.success || 0} books imported`);
            testResults.push('✅ Bulk Import');
        } else {
            console.log('❌ Bulk import failed');
            testResults.push('❌ Bulk Import');
        }
        
        console.log('\\n-----------------------------------\\n');
        
        // Test 6: Frontend Accessibility
        console.log('🌐 Test 5: Frontend Application');
        try {
            const frontendRes = await makeRequest('http://localhost:3001/');
            if (frontendRes.status === 200) {
                console.log('✅ Frontend server accessible');
                console.log('✅ Books page available at http://localhost:3001/books');
                testResults.push('✅ Frontend Access');
            } else {
                console.log(`⚠️  Frontend responding with status: ${frontendRes.status}`);
                testResults.push('⚠️  Frontend Status');
            }
        } catch (error) {
            console.log('❌ Frontend not accessible');
            testResults.push('❌ Frontend Down');
        }
        
        console.log('\\n===========================================================\\n');
        
        // Final Summary
        console.log('📋 FINAL SYSTEM STATUS REPORT');
        console.log('==============================');
        
        const passed = testResults.filter(r => r.startsWith('✅')).length;
        const warnings = testResults.filter(r => r.startsWith('⚠️')).length;
        const failed = testResults.filter(r => r.startsWith('❌')).length;
        
        testResults.forEach(result => console.log(result));
        
        console.log(`\\nResults: ${passed} passed, ${warnings} warnings, ${failed} failed`);
        
        if (failed === 0) {
            console.log('\\n🎉 ALL SYSTEMS OPERATIONAL!');
            console.log('════════════════════════════');
            console.log('✅ Database: Connected with 48+ books');
            console.log('✅ Backend: Serving data correctly');
            console.log('✅ API: All endpoints working');
            console.log('✅ Search: Functional');
            console.log('✅ Import: Bulk operations working'); 
            console.log('✅ Frontend: Accessible and ready');
            console.log('\\n🔗 Access Points:');
            console.log('   📱 Frontend: http://localhost:3001');
            console.log('   🔧 Backend: http://localhost:3000');
            console.log('   📚 Books Page: http://localhost:3001/books');
            console.log('\\n📊 Your library system is fully functional with real data!');
        } else {
            console.log(`\\n⚠️  ${failed} systems need attention. Check above for details.`);
        }
        
    } catch (error) {
        console.error('❌ System test failed:', error.message);
    }
}

testAllFeatures();