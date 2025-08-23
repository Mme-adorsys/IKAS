const http = require('http');

const data = JSON.stringify({
  message: "I have users from Keycloak. Now call neo4j_get_neo4j_schema to understand the database structure",
  sessionId: "explicit-test-" + Date.now(),
  context: {
    realm: "master"
  }
});

const options = {
  hostname: 'localhost',
  port: 8005,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🎯 Testing explicit function call request...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const response = JSON.parse(body);
    console.log('📊 Response:');
    console.log(`Tools called: ${response.toolsCalled ? response.toolsCalled.length : 0}`);
    if (response.toolsCalled && response.toolsCalled.length > 0) {
      console.log(`Tools used: ${response.toolsCalled.map(t => `${t.server}_${t.tool}`).join(', ')}`);
    }
    console.log(`Response: ${response.response}`);
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
