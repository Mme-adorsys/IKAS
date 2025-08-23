const http = require('http');

const data = JSON.stringify({
  message: "list all users",
  sessionId: "test-session-123",
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

console.log('🧪 Testing enhanced logging with orchestration request...');

const req = http.request(options, (res) => {
  console.log(`✅ Response status: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('📊 Response received:', body);
    console.log('🔍 Check the logs in Docker container:');
    console.log('   docker exec ikas-ai-gateway cat logs/combined.log');
    console.log('   docker exec ikas-ai-gateway cat logs/gemini.log');
    console.log('   docker exec ikas-ai-gateway cat logs/mcp.log');
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();