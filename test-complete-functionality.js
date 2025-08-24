// Using built-in fetch API (Node.js 18+)

async function testModelSwitching() {
  console.log('🔄 Testing Model Switching...');
  
  try {
    // Test getting available models
    const modelsResponse = await fetch('http://localhost:8006/api/models', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!modelsResponse.ok) {
      throw new Error(`Models API failed: ${modelsResponse.status}`);
    }
    
    const models = await modelsResponse.json();
    console.log('✅ Available models:', models.map(m => `${m.name} (${m.provider})`));
    
    // Test switching to Anthropic model
    console.log('\n🔄 Switching to Anthropic Claude...');
    const switchResponse = await fetch('http://localhost:8006/api/models/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic' })
    });
    
    if (!switchResponse.ok) {
      throw new Error(`Model switch failed: ${switchResponse.status}`);
    }
    
    const switchResult = await switchResponse.json();
    console.log('✅ Model switched:', switchResult);
    
    return true;
  } catch (error) {
    console.error('❌ Model switching test failed:', error.message);
    return false;
  }
}

async function testTextMessageAPI() {
  console.log('\n💬 Testing Text Message API...');
  
  try {
    const testMessage = 'List all users in the master realm';
    
    console.log(`📤 Sending message: "${testMessage}"`);
    
    const response = await fetch('http://localhost:8006/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        sessionId: `test-session-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      throw new Error(`Chat API failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Text message processed successfully:');
    console.log('📥 Response:', result.response?.substring(0, 200) + '...');
    console.log('⏱️  Execution time:', result.executionTime, 'ms');
    console.log('🎯 Strategy used:', result.strategy);
    console.log('🔧 Tools called:', result.toolResults?.length || 0);
    
    return true;
  } catch (error) {
    console.error('❌ Text message test failed:', error.message);
    return false;
  }
}

async function testGermanVoiceCommand() {
  console.log('\n🎤 Testing German Voice Command API...');
  
  try {
    const germanCommand = 'Hey Keycloak, zeige alle Benutzer';
    
    console.log(`📤 Sending German command: "${germanCommand}"`);
    
    const response = await fetch('http://localhost:8006/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: germanCommand,
        sessionId: `voice-test-${Date.now()}`,
        source: 'voice'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Voice command API failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('✅ German voice command processed:');
    console.log('📥 Response:', result.response?.substring(0, 200) + '...');
    console.log('⏱️  Execution time:', result.executionTime, 'ms');
    
    return true;
  } catch (error) {
    console.error('❌ German voice command test failed:', error.message);
    return false;
  }
}

async function testModelComparison() {
  console.log('\n🆚 Testing Both Models with Same Query...');
  
  const testQuery = 'Show me the current system status';
  
  try {
    // Test with Anthropic
    console.log('🔄 Switching to Anthropic...');
    await fetch('http://localhost:8006/api/models/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic' })
    });
    
    const anthropicResponse = await fetch('http://localhost:8006/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testQuery,
        sessionId: `anthropic-test-${Date.now()}`
      })
    });
    
    const anthropicResult = await anthropicResponse.json();
    console.log('🤖 Anthropic response time:', anthropicResult.executionTime, 'ms');
    
    // Test with Gemini
    console.log('🔄 Switching to Gemini...');
    await fetch('http://localhost:8006/api/models/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini' })
    });
    
    const geminiResponse = await fetch('http://localhost:8006/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testQuery,
        sessionId: `gemini-test-${Date.now()}`
      })
    });
    
    const geminiResult = await geminiResponse.json();
    console.log('🤖 Gemini response time:', geminiResult.executionTime, 'ms');
    
    console.log('✅ Both models processed the query successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Model comparison test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Complete Functionality Test Suite');
  console.log('='.repeat(50));
  
  const results = {
    modelSwitching: await testModelSwitching(),
    textAPI: await testTextMessageAPI(),
    voiceCommand: await testGermanVoiceCommand(),
    modelComparison: await testModelComparison()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(30));
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result === true);
  const passedCount = Object.values(results).filter(result => result === true).length;
  
  console.log('\n🎯 Overall Result:', allPassed ? 'ALL TESTS PASSED' : `${passedCount}/4 TESTS PASSED`);
  
  if (allPassed) {
    console.log('🎉 Complete functionality test suite successful!');
    console.log('✨ Model switching and text input functionality is working end-to-end');
  } else {
    console.log('⚠️  Some tests failed - check the logs above for details');
  }
  
  return allPassed;
}

// Run the test suite
runAllTests().catch(console.error);