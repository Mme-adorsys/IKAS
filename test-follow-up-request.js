const http = require('http');

const data = JSON.stringify({
  message: "Please execute the neo4j_get_neo4j_schema function call you mentioned",
  sessionId: "test-sync-session-123", // Same session to continue conversation
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

console.log('🔄 Asking Gemini to execute the schema function...');

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
    console.log(`Tools called: ${response.toolsCalled ? response.toolsCalled.length : 0}`);
    if (response.toolsCalled && response.toolsCalled.length > 0) {
      console.log(`Tools: ${response.toolsCalled.map(t => t.tool).join(', ')}`);
    }
    console.log(`Response: ${response.response}`);
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
