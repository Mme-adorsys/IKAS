#!/usr/bin/env node

const axios = require('axios');

async function testFunctionCalling() {
  console.log('🧪 Testing Fixed Function Calling Chain...\n');

  const baseUrl = 'http://localhost:8005';
  
  // Test case designed to trigger function calls
  const testPayload = {
    message: "List all users from the master realm",
    sessionId: "test-function-calling-" + Date.now(),
    context: {
      realm: "master",
      preferredLanguage: "en"
    }
  };

  try {
    console.log('📤 Sending test request...');
    console.log(`   Message: "${testPayload.message}"`);
    console.log(`   Session ID: ${testPayload.sessionId}`);
    
    const startTime = Date.now();
    
    const response = await axios.post(`${baseUrl}/api/chat`, testPayload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200) {
      const data = response.data;
      
      console.log(`\n✅ Response received (${duration}ms)`);
      console.log(`   Status: ${data.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   Strategy: ${data.strategy}`);
      console.log(`   Tools called: ${data.toolsCalled?.length || 0}`);
      
      if (data.toolsCalled?.length > 0) {
        console.log('   📋 Tool details:');
        data.toolsCalled.forEach((tool, index) => {
          console.log(`     ${index + 1}. ${tool.server}:${tool.tool}`);
          console.log(`        Args: ${JSON.stringify(tool.arguments, null, 0)}`);
        });
      }
      
      console.log(`   Response: "${data.response?.substring(0, 100)}${data.response?.length > 100 ? '...' : ''}"`);
      
      // Check if function calling is working
      if (data.toolsCalled?.length > 0) {
        console.log('\n🎉 FUNCTION CALLING IS WORKING!');
        console.log('   - Tools were successfully called');
        console.log('   - Response contains execution results');
      } else if (data.response.includes('could not generate')) {
        console.log('\n❌ STILL HAVING ISSUES:');
        console.log('   - No function calls executed');
        console.log('   - Gemini returned generic error response');
      } else {
        console.log('\n⚠️ PARTIAL SUCCESS:');
        console.log('   - No function calls, but got a meaningful response');
        console.log('   - May be improved error handling working');
      }
      
      if (data.data) {
        console.log('\n📊 Response data keys:', Object.keys(data.data));
      }
      
    } else {
      console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    
    if (error.response) {
      console.log(`   HTTP Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   💡 Make sure the AI Gateway is running on port 8005');
    }
  }
}

// Health check first
async function healthCheck() {
  try {
    const response = await axios.get('http://localhost:8005/health', { timeout: 5000 });
    console.log('✅ AI Gateway health check passed');
    return true;
  } catch (error) {
    console.log('❌ AI Gateway health check failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Function Calling Chain Fix Test');
  console.log('=====================================\n');
  
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    console.log('⚠️  Service is not healthy. Please ensure the AI Gateway is running.');
    process.exit(1);
  }
  
  console.log('');
  await testFunctionCalling();
  
  console.log('\n📋 Check the logs for detailed diagnostics:');
  console.log('   - Enhanced function calling logs: tail -f logs/gemini.log | grep "Function call"');
  console.log('   - MCP operations: tail -f logs/mcp.log');
  console.log('   - Combined logs: tail -f logs/combined.log');
}

if (require.main === module) {
  main().catch(console.error);
}