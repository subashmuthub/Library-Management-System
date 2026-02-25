const http = require('http');

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.setTimeout(5000, () => {
            request.abort();
            reject(new Error('Request timeout'));
        });
    });
}

async function testAPI() {
    try {
        console.log('🔍 Testing API endpoints...\n');
        
        // Test categories endpoint
        console.log('📊 Testing categories endpoint: /api/v1/books/categories');
        const categoriesResponse = await makeRequest('http://localhost:3000/api/v1/books/categories');
        console.log('✅ Categories Response:');
        console.log(`Status: ${categoriesResponse.status}`);
        console.log(JSON.stringify(categoriesResponse.data, null, 2));
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Test books endpoint
        console.log('📚 Testing books endpoint: /api/v1/books');
        const booksResponse = await makeRequest('http://localhost:3000/api/v1/books');
        console.log('✅ Books Response:');
        console.log(`Status: ${booksResponse.status}`);
        const books = booksResponse.data.books || booksResponse.data;
        if (Array.isArray(books)) {
            console.log(`Total books: ${books.length}`);
            console.log(JSON.stringify(books.slice(0, 3), null, 2));
        } else {
            console.log(JSON.stringify(booksResponse.data, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error testing API:');
        console.error('Message:', error.message);
    }
}

testAPI();