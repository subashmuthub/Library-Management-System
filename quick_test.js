const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testEndpoint(endpoint, method = 'GET', data = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            timeout: 5000
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        console.log(`✅ ${method} ${endpoint} - ${response.status}`);
        
        // Show a preview of the data
        if (response.data) {
            if (response.data.books) {
                console.log(`   Books returned: ${response.data.books.length} (Total: ${response.data.total})`);
                if (response.data.books[0]) {
                    console.log(`   Sample book: "${response.data.books[0].title}" by ${response.data.books[0].author}`);
                }
            } else if (response.data.fines) {
                console.log(`   Fines returned: ${response.data.fines.length}`);
                if (response.data.fines[0]) {
                    console.log(`   Sample fine: $${response.data.fines[0].amount} - ${response.data.fines[0].status}`);
                }
            } else if (response.data.transactions) {
                console.log(`   Transactions returned: ${response.data.transactions.length}`);
            } else if (Array.isArray(response.data)) {
                console.log(`   Array returned with ${response.data.length} items`);
            } else {
                console.log(`   Data:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
            }
        }
        return true;
    } catch (error) {
        console.log(`❌ ${method} ${endpoint} - ${error.response?.status || 'Network Error'}: ${error.message}`);
        return false;
    }
}

async function runQuickTests() {
    console.log('🔍 QUICK FUNCTIONALITY TEST');
    console.log('============================');
    
    // Core functionality tests
    console.log('\n📚 BOOKS:');
    await testEndpoint('/api/v1/books?limit=5');
    await testEndpoint('/api/v1/books/categories');
    await testEndpoint('/api/v1/books?sortBy=title&sortOrder=ASC&limit=3');
    
    console.log('\n👥 USERS:');
    await testEndpoint('/api/v1/users?limit=3');
    
    console.log('\n📋 TRANSACTIONS:');
    await testEndpoint('/api/v1/transactions?limit=3');
    await testEndpoint('/api/v1/transactions?status=active&limit=3');
    
    console.log('\n💰 FINES:');
    await testEndpoint('/api/v1/fines');
    await testEndpoint('/api/v1/fines?status=pending');
    await testEndpoint('/api/v1/fines/stats');
    
    console.log('\n📝 RESERVATIONS:');
    await testEndpoint('/api/v1/reservations?limit=3');
    
    console.log('\n🚪 ENTRY LOG:');
    await testEndpoint('/api/v1/entry?limit=3');
    
    console.log('\n🗺️ NAVIGATION:');
    await testEndpoint('/api/v1/navigation');
    
    console.log('\n🔐 AUTHENTICATION:');
    await testEndpoint('/api/v1/auth/login', 'POST', {
        username: 'alice',
        password: 'password123'
    });
    
    console.log('\n✅ Tests completed!');
}

runQuickTests();