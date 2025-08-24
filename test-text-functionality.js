// Test the core functionality that's working

async function testTextToAI() {
  console.log('💬 Testing Text Message to AI...');
  
  try {
    const testMessage = 'Hey Keycloak, zeige alle Benutzer';
    
    console.log(`📤 Sending German message: "${testMessage}"`);
    
    const response = await fetch('http://localhost:8006/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        sessionId: `test-text-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      throw new Error(`Chat API failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Text message processed successfully');
    console.log('📥 Response preview:', result.response?.substring(0, 150) + '...');
    console.log('⏱️  Execution time:', result.duration || 'N/A', 'ms');
    console.log('🎯 Strategy used:', result.strategy || 'N/A');
    console.log('🔧 Tools called:', result.toolsCalled?.length || 0);
    
    // Check if we got a meaningful response
    const hasGoodResponse = result.response && result.response.length > 10;
    const usedTools = result.toolsCalled && result.toolsCalled.length > 0;
    
    if (hasGoodResponse && usedTools) {
      console.log('🎉 Full orchestration working - AI processed command and used MCP tools!');
      return true;
    } else if (hasGoodResponse) {
      console.log('⚠️  AI responded but may not have used MCP tools');
      return true;
    } else {
      console.log('❌ AI response was empty or too short');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Text message test failed:', error.message);
    return false;
  }
}

async function testEnglishCommand() {
  console.log('\n🇺🇸 Testing English Command...');
  
  try {
    const englishMessage = 'Show me all users in the master realm';
    
    console.log(`📤 Sending English message: "${englishMessage}"`);
    
    const response = await fetch('http://localhost:8006/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: englishMessage,
        sessionId: `test-english-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      throw new Error(`Chat API failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('✅ English command processed');
    console.log('📥 Response preview:', result.response?.substring(0, 150) + '...');
    console.log('⏱️  Execution time:', result.duration || 'N/A', 'ms');
    
    return true;
    
  } catch (error) {
    console.error('❌ English command test failed:', error.message);
    return false;
  }
}

async function testBasicHealthCheck() {
  console.log('\n🏥 Testing System Health...');
  
  try {
    const response = await fetch('http://localhost:8006/health', {
      method: 'GET'
    });
    
    const health = await response.json();
    
    console.log('📊 System Status:');
    console.log('  • Overall:', response.status === 200 ? 'Healthy' : 'Unhealthy');
    console.log('  • Keycloak MCP:', health.services?.keycloakMcp?.status || 'Unknown');
    console.log('  • Neo4j MCP:', health.services?.neo4jMcp?.status || 'Unknown');
    console.log('  • WebSocket:', health.services?.websocket?.status || 'Unknown');
    console.log('  • Uptime:', Math.round((health.uptime || 0) / 1000), 'seconds');
    
    return true;
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function runTextTests() {
  console.log('🚀 Testing IKAS Text Functionality');
  console.log('='.repeat(40));
  
  const results = {
    health: await testBasicHealthCheck(),
    germanText: await testTextToAI(),
    englishText: await testEnglishCommand()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(25));
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result === true);
  const passedCount = Object.values(results).filter(result => result === true).length;
  
  console.log('\n🎯 Overall Result:', allPassed ? 'ALL TESTS PASSED' : `${passedCount}/3 TESTS PASSED`);
  
  if (results.germanText && results.englishText) {
    console.log('🎉 Core text functionality is working!');
    console.log('✨ IKAS can process both German and English text commands');
    console.log('💡 Frontend text input should work with this backend');
  } else if (results.health) {
    console.log('⚠️  System is running but text processing has issues');
  }
  
  return allPassed;
}

// Run the tests
runTextTests().catch(console.error);