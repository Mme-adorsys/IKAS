const http = require('http');

async function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8006,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🔍 Testing AI Gateway Endpoints...');

  try {
    // Test health endpoint
    console.log('\n🏥 Testing health endpoint...');
    const health = await testEndpoint('/health');
    console.log(`Status: ${health.status}`);
    if (health.status === 200) {
      console.log('✅ Health endpoint working');
    } else {
      console.log('❌ Health endpoint failed:', health.data);
    }

    // Test models endpoint
    console.log('\n📋 Testing models endpoint...');
    const models = await testEndpoint('/api/models');
    console.log(`Status: ${models.status}`);
    if (models.status === 200) {
      console.log('✅ Models endpoint working');
      console.log('Models:', models.data);
    } else {
      console.log('❌ Models endpoint failed:', models.data);
    }

    // Test chat endpoint
    console.log('\n💬 Testing chat endpoint...');
    const chat = await testEndpoint('/api/chat', 'POST', {
      message: 'Hello, test message',
      sessionId: 'test-session-123'
    });
    console.log(`Status: ${chat.status}`);
    if (chat.status === 200) {
      console.log('✅ Chat endpoint working');
    } else {
      console.log('❌ Chat endpoint failed:', chat.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();