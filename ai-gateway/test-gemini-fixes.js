#!/usr/bin/env node

const axios = require('axios');

async function testGeminiErrorHandling() {
  console.log('🧪 Testing Gemini error handling and tool calls fixes...\n');

  const baseUrl = 'http://localhost:8000';
  const testCases = [
    {
      name: 'Normal user request with tool calls',
      payload: {
        message: "Liste alle Benutzer aus dem master Realm auf",
        sessionId: "test-session-1",
        context: {
          realm: "master",
          preferredLanguage: "de"
        }
      },
      expectError: false
    },
    {
      name: 'Request with invalid tool parameters',
      payload: {
        message: "Create a user with malformed data",
        sessionId: "test-session-2", 
        context: {
          realm: "master"
        }
      },
      expectError: false // Should handle gracefully
    },
    {
      name: 'Request with complex nested data',
      payload: {
        message: "Analysiere die Benutzer-Compliance und synchronisiere mit Neo4j",
        sessionId: "test-session-3",
        context: {
          realm: "master",
          preferredLanguage: "de"
        }
      },
      expectError: false
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    
    try {
      const startTime = Date.now();
      
      const response = await axios.post(`${baseUrl}/api/chat`, testCase.payload, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const duration = Date.now() - startTime;
      
      if (response.status === 200) {
        const data = response.data;
        
        console.log(`✅ Success (${duration}ms)`);
        console.log(`   Response: ${data.response?.substring(0, 100)}...`);
        console.log(`   Tools called: ${data.toolsCalled?.length || 0}`);
        console.log(`   Strategy: ${data.strategy}`);
        
        if (data.toolsCalled?.length > 0) {
          console.log(`   Tool details: ${data.toolsCalled.map(t => `${t.server}:${t.tool}`).join(', ')}`);
        }
        
        results.push({
          testCase: testCase.name,
          success: true,
          duration,
          toolsCalled: data.toolsCalled?.length || 0,
          hasError: false
        });
      } else {
        console.log(`❌ Unexpected status: ${response.status}`);
        results.push({
          testCase: testCase.name,
          success: false,
          error: `HTTP ${response.status}`,
          hasError: true
        });
      }
      
    } catch (error) {
      const duration = Date.now() - Date.now();
      
      if (error.response) {
        console.log(`❌ HTTP Error ${error.response.status}: ${error.response.statusText}`);
        console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
        
        // Check if it's a 500 error (the original issue)
        if (error.response.status === 500) {
          console.log(`🚨 500 Internal Server Error detected! This was the original issue.`);
        }
        
        results.push({
          testCase: testCase.name,
          success: false,
          httpStatus: error.response.status,
          error: error.response.data?.error || error.response.statusText,
          hasError: true,
          is500Error: error.response.status === 500
        });
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Connection refused - service not running`);
        results.push({
          testCase: testCase.name,
          success: false,
          error: 'Service not running',
          hasError: true
        });
      } else {
        console.log(`❌ Network/Other Error: ${error.message}`);
        results.push({
          testCase: testCase.name,
          success: false,
          error: error.message,
          hasError: true
        });
      }
    }
    
    console.log('');
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const fiveHundredErrors = results.filter(r => r.is500Error);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  console.log(`🚨 500 Errors: ${fiveHundredErrors.length}/${results.length}`);
  
  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + (r.duration || 0), 0) / successful.length;
    console.log(`⏱️  Average response time: ${Math.round(avgDuration)}ms`);
  }
  
  if (fiveHundredErrors.length === 0) {
    console.log('\n🎉 SUCCESS: No 500 Internal Server Errors detected!');
    console.log('The Gemini tool calls processing issue appears to be fixed.');
  } else {
    console.log('\n⚠️  WARNING: 500 errors still occurring:');
    fiveHundredErrors.forEach(result => {
      console.log(`   - ${result.testCase}: ${result.error}`);
    });
  }
  
  // Check logs for any errors
  console.log('\n📋 Check the logs for detailed error information:');
  console.log('   - Combined log: tail -f logs/combined.log');
  console.log('   - Gemini log: tail -f logs/gemini.log');
  console.log('   - Error log: tail -f logs/error.log');
}

// Health check first
async function healthCheck() {
  try {
    const response = await axios.get('http://localhost:8000/health', { timeout: 5000 });
    console.log('✅ Service health check passed');
    return true;
  } catch (error) {
    console.log('❌ Service health check failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Gemini Tool Calls Error Fix Test Suite');
  console.log('==========================================\n');
  
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    console.log('⚠️  Service is not healthy. Please start the AI Gateway first.');
    console.log('Run: cd ai-gateway && export GEMINI_API_KEY="your-key" && npm start');
    process.exit(1);
  }
  
  console.log('');
  await testGeminiErrorHandling();
}

if (require.main === module) {
  main().catch(console.error);
}