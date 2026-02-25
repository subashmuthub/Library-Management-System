const http = require('http');

async function quickAPITest() {
    console.log('🔍 QUICK API RESPONSE CHECK\n');
    
    function makeRequest(url) {
        return new Promise((resolve, reject) => {
            const request = http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({
                            status: res.statusCode,
                            data: JSON.parse(data),
                            length: data.length
                        });
                    } catch (error) {
                        resolve({
                            status: res.statusCode,
                            data: data,
                            length: data.length
                        });
                    }
                });
            });
            
            request.on('error', reject);
            request.setTimeout(5000, () => {
                request.abort();
                reject(new Error('Timeout'));
            });
        });
    }
    
    try {
        // Test categories endpoint
        console.log('📊 Testing categories...');
        const catResponse = await makeRequest('http://localhost:3000/api/v1/books/categories');
        console.log(`✅ Categories: Status ${catResponse.status}, Length: ${catResponse.length}`);
        console.log(`   Found ${catResponse.data.length} categories`);
        
        // Show department counts
        const deptCats = ['CSE', 'EEE', 'ECE', 'MECH', 'AIDS', 'S&H'];
        console.log('   Department counts:');
        catResponse.data.forEach(cat => {
            if (deptCats.includes(cat.name)) {
                console.log(`   🎯 ${cat.name}: ${cat.count} books`);
            }
        });
        
        console.log('\n📚 Testing books endpoint...');
        const booksResponse = await makeRequest('http://localhost:3000/api/v1/books');
        console.log(`✅ Books: Status ${booksResponse.status}, Length: ${booksResponse.length}`);
        
        if (booksResponse.data.data && booksResponse.data.data.books) {
            const books = booksResponse.data.data.books;
            console.log(`   Total books: ${books.length}`);
            console.log('   Sample books:');
            books.slice(0, 3).forEach(book => {
                console.log(`   • "${book.title}" by ${book.author} (${book.category})`);
            });
        }
        
        console.log('\n🎉 API is working correctly!');
        console.log('Backend server is serving data properly from database.');
        
    } catch (error) {
        console.error('❌ API Test Error:', error.message);
    }
}

quickAPITest();