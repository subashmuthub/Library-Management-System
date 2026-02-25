const http = require('http');

function testConnection() {
    return new Promise((resolve, reject) => {
        const request = http.get('http://localhost:3000/', (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    data: data
                });
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.setTimeout(3000, () => {
            request.abort();
            reject(new Error('Connection timeout'));
        });
    });
}

async function testServer() {
    try {
        console.log('🔍 Testing server connection at http://localhost:3000...\n');
        
        const response = await testConnection();
        console.log('✅ Server Response:');
        console.log(`Status: ${response.status}`);
        console.log('Data:', response.data);
        
    } catch (error) {
        console.error('❌ Error connecting to server:');
        console.error('Message:', error.message);
        console.log('\n💡 The backend server might not be running on port 3000');
        console.log('   Try starting it with: cd backend && npm start');
    }
}

testServer();