const http = require('http');

const data = JSON.stringify({
  message: "list all users and sync them to Neo4j for analysis",
  sessionId: "chain-test-" + Date.now(), // Fresh session ID
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

console.log('🧠 Testing complete autonomous function calling chain...');
console.log('⏱️ This may take longer as Gemini calls multiple functions sequentially');

const req = http.request(options, (res) => {
  console.log(`✅ Response status: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const response = JSON.parse(body);
    console.log('📊 Complete chain result:');
    console.log(`Strategy: ${response.strategy}`);
    console.log(`Tools called: ${response.toolsCalled ? response.toolsCalled.length : 0}`);
    if (response.toolsCalled && response.toolsCalled.length > 0) {
      console.log(`Tools used: ${response.toolsCalled.map(t => `${t.server}_${t.tool}`).join(' -> ')}`);
    }
    console.log(`Final response: ${response.response}`);
    console.log('\n🔍 Now check Neo4j for synced data!');
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
