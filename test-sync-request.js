const http = require('http');

const data = JSON.stringify({
  message: "list all users and sync them to Neo4j for analysis",
  sessionId: "test-sync-session-123",
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

console.log('🧠 Testing Gemini intelligence with sync request...');

const req = http.request(options, (res) => {
  console.log(`✅ Response status: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const response = JSON.parse(body);
    console.log('📊 Response received:');
    console.log(`Strategy: ${response.strategy}`);
    console.log(`Tools called: ${response.toolsCalled}`);
    console.log(`Response: ${response.response}`);
    console.log('\n🔍 Check Neo4j now for synced data!');
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
