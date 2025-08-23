const http = require('http');

const data = JSON.stringify({
  message: "I have this user data from Keycloak: {id: 'f94ecd17-ce46-4663-98e4-0137fa8d82ae', username: 'admin', enabled: true}. Use neo4j_write_neo4j_cypher to write this user to Neo4j now.",
  sessionId: "sync-test-" + Date.now(),
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

console.log('🎯 Testing final sync to Neo4j...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const response = JSON.parse(body);
    console.log('📊 Sync attempt result:');
    console.log(`Tools called: ${response.toolsCalled ? response.toolsCalled.length : 0}`);
    if (response.toolsCalled && response.toolsCalled.length > 0) {
      console.log(`Tools used: ${response.toolsCalled.map(t => `${t.server}_${t.tool}`).join(', ')}`);
    }
    console.log(`Response: ${response.response}`);
    console.log('\n🔍 Now check Neo4j for the user data!');
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
