const axios = require('axios');

async function testRoutes() {
  const routes = [
    '/api/v1/dashboard/statistics',
    '/api/v1/transactions/statistics',
    '/api/v1/books',
    '/api/v1/users',
    '/api/v1/transactions',
    '/api/v1/fines',
    '/api/v1/reservations',
    '/api/v1/settings',
  ];

  for (const route of routes) {
    try {
      const res = await axios.get(`http://localhost:3001${route}`);
      console.log(`✅ [200] ${route}`);
    } catch (error) {
      if (error.response) {
        console.log(`⚠️ [${error.response.status}] ${route} - ${JSON.stringify(error.response.data)}`);
      } else {
        console.log(`❌ [ERROR] ${route} - ${error.message}`);
      }
    }
  }
}

testRoutes();
