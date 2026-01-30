// Quick test script to verify server is working
const axios = require('axios');

async function testServer() {
  try {
    console.log('Testing server at http://localhost:5000/api/health...');
    const response = await axios.get('http://localhost:5000/api/health');
    console.log('✓ Server is running!');
    console.log('Response:', response.data);
    
    // Test registration endpoint structure
    console.log('\nTesting registration endpoint...');
    try {
      const regResponse = await axios.post('http://localhost:5000/api/auth/register', {
        name: 'Test User',
        phone: '9999999999',
        password: 'test123',
        role: 'passenger'
      });
      console.log('✓ Registration endpoint is working!');
    } catch (regError) {
      if (regError.response) {
        console.log('✓ Registration endpoint is accessible (expected error for duplicate/test user)');
        console.log('Status:', regError.response.status);
        console.log('Error:', regError.response.data.error);
      } else {
        console.log('✗ Cannot connect to registration endpoint');
        console.log('Error:', regError.message);
      }
    }
  } catch (error) {
    console.log('✗ Server is NOT running or not accessible');
    console.log('Error:', error.message);
    console.log('\nMake sure to start the server first:');
    console.log('  npm start');
  }
}

testServer();
