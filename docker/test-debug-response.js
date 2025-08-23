const http = require('http');

const data = JSON.stringify({
  message: "list all users and sync them to Neo4j for analysis",
  sessionId: "debug-" + Date.now(),
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

console.log('🔍 Testing with detailed response debugging...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const response = JSON.parse(body);
    console.log('📊 Full Response Structure:');
    console.log('- Success:', response.success);
    console.log('- Strategy:', response.strategy);
    console.log('- Duration:', response.duration);
    console.log('- ToolsCalled present:', !!response.toolsCalled);
    console.log('- ToolsCalled type:', typeof response.toolsCalled);
    console.log('- ToolsCalled length:', response.toolsCalled ? response.toolsCalled.length : 'N/A');
    if (response.toolsCalled && response.toolsCalled.length > 0) {
      console.log('- Tools:', response.toolsCalled.map(t => `${t.server}_${t.tool}`).join(', '));
    }
    console.log('- Data keys:', response.data ? Object.keys(response.data) : 'N/A');
    console.log('- Response preview:', response.response.substring(0, 200) + '...');
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
