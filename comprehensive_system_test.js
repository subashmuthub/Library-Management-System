const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Helper function to make API calls with error handling
async function apiCall(method, endpoint, data = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            timeout: 10000
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.message, 
            status: error.response?.status || 'Network Error'
        };
    }
}

// Test functions for each page/functionality
async function testDashboard() {
    console.log('\n=== DASHBOARD TESTS ===');
    
    const endpoints = [
        '/api/v1/dashboard/stats',
        '/api/v1/books/count',
        '/api/v1/transactions/count',
        '/api/v1/users/count',
        '/api/v1/fines/stats'
    ];
    
    for (const endpoint of endpoints) {
        const result = await apiCall('GET', endpoint);
        console.log(`${endpoint}: ${result.success ? '✅ Success' : '❌ Failed'} ${result.status}`);
        if (result.success) {
            console.log(`   Data:`, JSON.stringify(result.data, null, 2));
        } else {
            console.log(`   Error:`, result.error);
        }
    }
}

async function testBooks() {
    console.log('\n=== BOOKS TESTS ===');
    
    // Test basic book endpoints
    console.log('\n--- Basic Book Operations ---');
    const result = await apiCall('GET', '/api/v1/books?page=1&limit=5');
    console.log(`GET /api/v1/books: ${result.success ? '✅ Success' : '❌ Failed'} ${result.status}`);
    if (result.success) {
        console.log(`   Found ${result.data.books?.length || 0} books`);
        console.log(`   Total: ${result.data.total || 0}`);
    }
    
    // Test sorting functionality
    console.log('\n--- Sorting Tests ---');
    const sortOptions = [
        { sortBy: 'title', sortOrder: 'ASC' },
        { sortBy: 'title', sortOrder: 'DESC' },
        { sortBy: 'author', sortOrder: 'ASC' },
        { sortBy: 'department', sortOrder: 'ASC' },
        { sortBy: 'publication_year', sortOrder: 'DESC' },
        { sortBy: 'created_at', sortOrder: 'DESC' }
    ];
    
    for (const sort of sortOptions) {
        const url = `/api/v1/books?sortBy=${sort.sortBy}&sortOrder=${sort.sortOrder}&limit=3`;
        const result = await apiCall('GET', url);
        console.log(`Sort by ${sort.sortBy} ${sort.sortOrder}: ${result.success ? '✅' : '❌'}`);
        if (result.success && result.data.books?.[0]) {
            console.log(`   First book: ${result.data.books[0].title} by ${result.data.books[0].author}`);
        }
    }
    
    // Test book categories
    console.log('\n--- Category Tests ---');
    const categories = await apiCall('GET', '/api/v1/books/categories');
    console.log(`GET /api/v1/books/categories: ${categories.success ? '✅ Success' : '❌ Failed'}`);
    if (categories.success) {
        console.log(`   Categories found: ${categories.data.length}`);
        categories.data.forEach(cat => {
            console.log(`   - ${cat.department}: ${cat.count} books`);
        });
    }
}

async function testTransactions() {
    console.log('\n=== TRANSACTIONS TESTS ===');
    
    // Test transaction endpoints
    const endpoints = [
        '/api/v1/transactions',
        '/api/v1/transactions?status=active',
        '/api/v1/transactions?status=returned',
        '/api/v1/transactions?status=overdue'
    ];
    
    for (const endpoint of endpoints) {
        const result = await apiCall('GET', endpoint);
        console.log(`${endpoint}: ${result.success ? '✅ Success' : '❌ Failed'} ${result.status}`);
        if (result.success) {
            console.log(`   Found ${result.data.transactions?.length || result.data.length || 0} transactions`);
        }
    }
    
    // Test checkout functionality (simulate)
    console.log('\n--- Checkout Test (Simulation) ---');
    const checkoutData = {
        user_id: '090',
        book_id: '655',
        loan_days: 14
    };
    
    const checkoutResult = await apiCall('POST', '/api/v1/transactions/checkout', checkoutData);
    console.log(`POST /api/v1/transactions/checkout: ${checkoutResult.success ? '✅ Success' : '❌ Failed'} ${checkoutResult.status}`);
    if (checkoutResult.success) {
        console.log(`   Transaction created: ID ${checkoutResult.data.transaction_id || 'Unknown'}`);
    } else {
        console.log(`   Error: ${checkoutResult.error}`);
    }
}

async function testFines() {
    console.log('\n=== FINES TESTS ===');
    
    // Test fines endpoints
    const endpoints = [
        '/api/v1/fines',
        '/api/v1/fines?status=pending',
        '/api/v1/fines?status=paid',
        '/api/v1/fines?status=waived',
        '/api/v1/fines/stats'
    ];
    
    for (const endpoint of endpoints) {
        const result = await apiCall('GET', endpoint);
        console.log(`${endpoint}: ${result.success ? '✅ Success' : '❌ Failed'} ${result.status}`);
        if (result.success) {
            if (result.data.fines) {
                console.log(`   Found ${result.data.fines.length} fines`);
                if (result.data.fines.length > 0) {
                    const fine = result.data.fines[0];
                    console.log(`   Sample: $${fine.amount} - ${fine.status} (Reason: ${fine.reason})`);
                }
            } else if (Array.isArray(result.data)) {
                console.log(`   Found ${result.data.length} items`);
            } else {
                console.log(`   Data:`, JSON.stringify(result.data, null, 2));
            }
        }
    }
    
    // Test fine calculation for overdue books
    console.log('\n--- Overdue Fine Calculation ---');
    const overdueCheck = await apiCall('POST', '/api/v1/fines/calculate-overdue');
    console.log(`POST /api/v1/fines/calculate-overdue: ${overdueCheck.success ? '✅ Success' : '❌ Failed'} ${overdueCheck.status}`);
    if (overdueCheck.success) {
        console.log(`   Result:`, JSON.stringify(overdueCheck.data, null, 2));
    }
}

async function testUsers() {
    console.log('\n=== USERS TESTS ===');
    
    // Test user endpoints
    const endpoints = [
        '/api/v1/users',
        '/api/v1/users?page=1&limit=5',
        '/api/v1/users/stats'
    ];
    
    for (const endpoint of endpoints) {
        const result = await apiCall('GET', endpoint);
        console.log(`${endpoint}: ${result.success ? '✅ Success' : '❌ Failed'} ${result.status}`);
        if (result.success) {
            if (result.data.users) {
                console.log(`   Found ${result.data.users.length} users (Total: ${result.data.total})`);
            } else if (Array.isArray(result.data)) {
                console.log(`   Found ${result.data.length} users`);
            } else {
                console.log(`   Data:`, JSON.stringify(result.data, null, 2));
            }
        }
    }
}

async function testReservations() {
    console.log('\n=== RESERVATIONS TESTS ===');
    
    const endpoints = [
        '/api/v1/reservations',
        '/api/v1/reservations?status=active',
        '/api/v1/reservations?status=completed',
        '/api/v1/reservations?status=cancelled'
    ];
    
    for (const endpoint of endpoints) {
        const result = await apiCall('GET', endpoint);
        console.log(`${endpoint}: ${result.success ? '✅ Success' : '❌ Failed'} ${result.status}`);
        if (result.success) {
            const count = result.data.reservations?.length || result.data.length || 0;
            console.log(`   Found ${count} reservations`);
        }
    }
}

async function testEntryLog() {
    console.log('\n=== ENTRY LOG TESTS ===');
    
    const endpoints = [
        '/api/v1/entry',
        '/api/v1/entry?page=1&limit=5',
        '/api/v1/entry/stats'
    ];
    
    for (const endpoint of endpoints) {
        const result = await apiCall('GET', endpoint);
        console.log(`${endpoint}: ${result.success ? '✅ Success' : '❌ Failed'} ${result.status}`);
        if (result.success) {
            const count = result.data.entries?.length || result.data.length || 0;
            console.log(`   Found ${count} entries`);
        }
    }
}

async function testNavigation() {
    console.log('\n=== NAVIGATION TESTS ===');
    
    const result = await apiCall('GET', '/api/v1/navigation');
    console.log(`GET /api/v1/navigation: ${result.success ? '✅ Success' : '❌ Failed'} ${result.status}`);
    if (result.success) {
        console.log(`   Navigation data:`, JSON.stringify(result.data, null, 2));
    }
}

async function testAuth() {
    console.log('\n=== AUTHENTICATION TESTS ===');
    
    // Test login endpoint
    const loginData = {
        username: 'alice',
        password: 'password123'
    };
    
    const loginResult = await apiCall('POST', '/api/v1/auth/login', loginData);
    console.log(`POST /api/v1/auth/login: ${loginResult.success ? '✅ Success' : '❌ Failed'} ${loginResult.status}`);
    
    if (loginResult.success && loginResult.data.token) {
        console.log(`   Login successful, token received`);
        
        // Test protected endpoint with token
        const token = loginResult.data.token;
        const protectedResult = await axios({
            method: 'GET',
            url: `${BASE_URL}/api/v1/users/profile`,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 10000
        }).catch(err => ({ error: err.message }));
        
        if (protectedResult.data) {
            console.log(`   Protected endpoint access: ✅ Success`);
        } else {
            console.log(`   Protected endpoint access: ❌ Failed`);
        }
    }
}

// Main test runner
async function runAllTests() {
    console.log('🔍 COMPREHENSIVE LIBRARY SYSTEM TEST');
    console.log('=====================================');
    
    const startTime = Date.now();
    
    try {
        await testDashboard();
        await testBooks();
        await testTransactions();
        await testFines();
        await testUsers();
        await testReservations();
        await testEntryLog();
        await testNavigation();
        await testAuth();
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log('\n=====================================');
        console.log(`✅ ALL TESTS COMPLETED in ${duration}s`);
        console.log('=====================================');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the tests
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testDashboard,
    testBooks,
    testTransactions,
    testFines,
    testUsers,
    testReservations,
    testEntryLog,
    testNavigation,
    testAuth
};