/**
 * Test Anthropic Chain on Localhost
 * 
 * Tests the complete workflow using a locally running AI Gateway with Anthropic
 * configured, against the Docker MCP services.
 */

const axios = require('axios');

const LOCAL_AI_GATEWAY = 'http://localhost:8007';  // Local instance with Anthropic
const DOCKER_AI_GATEWAY = 'http://localhost:8005';  // Docker instance with Gemini

async function testBothGateways() {
  console.log('🧪 Testing Anthropic Chain - Localhost vs Docker Comparison\n');
  
  const testMessage = "write all users to the graph";
  const sessionId = `comparison-test-${Date.now()}`;
  
  const testData = {
    message: testMessage,
    sessionId,
    context: {
      realm: 'master',
      preferredLanguage: 'en'
    }
  };
  
  console.log('📝 Test Message:', testMessage);
  console.log('🆔 Session ID:', sessionId);
  console.log();
  
  // Test localhost (Anthropic)
  console.log('🧠 Testing LOCAL AI Gateway (Anthropic)...');
  try {
    const localStart = Date.now();
    const localResponse = await axios.post(`${LOCAL_AI_GATEWAY}/api/chat`, testData, {
      timeout: 60000
    });
    const localDuration = Date.now() - localStart;
    
    console.log('✅ Local (Anthropic) Response:');
    console.log(`   Duration: ${localDuration}ms`);
    console.log(`   Success: ${localResponse.data.success}`);
    console.log(`   Strategy: ${localResponse.data.strategy}`);
    console.log(`   Tools Called: ${localResponse.data.toolsCalled?.length || 0}`);
    console.log(`   Response: ${localResponse.data.response?.substring(0, 100)}...`);
    
    if (localResponse.data.toolsCalled && localResponse.data.toolsCalled.length > 0) {
      console.log('🔧 Local Tools Called:');
      localResponse.data.toolsCalled.forEach((tool, i) => {
        console.log(`   ${i + 1}. ${tool.server}_${tool.tool}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Local (Anthropic) Failed:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || error.response.statusText}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
  
  console.log();
  
  // Test Docker (Gemini)  
  console.log('🤖 Testing DOCKER AI Gateway (Gemini)...');
  try {
    const dockerStart = Date.now();
    const dockerResponse = await axios.post(`${DOCKER_AI_GATEWAY}/api/chat`, {
      ...testData,
      sessionId: `${sessionId}-docker`
    }, {
      timeout: 60000
    });
    const dockerDuration = Date.now() - dockerStart;
    
    console.log('✅ Docker (Gemini) Response:');
    console.log(`   Duration: ${dockerDuration}ms`);
    console.log(`   Success: ${dockerResponse.data.success}`);
    console.log(`   Strategy: ${dockerResponse.data.strategy}`);
    console.log(`   Tools Called: ${dockerResponse.data.toolsCalled?.length || 0}`);
    console.log(`   Response: ${dockerResponse.data.response?.substring(0, 100)}...`);
    
    if (dockerResponse.data.toolsCalled && dockerResponse.data.toolsCalled.length > 0) {
      console.log('🔧 Docker Tools Called:');
      dockerResponse.data.toolsCalled.forEach((tool, i) => {
        console.log(`   ${i + 1}. ${tool.server}_${tool.tool}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Docker (Gemini) Failed:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || error.response.statusText}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
  
  console.log();
  console.log('🏁 Comparison test completed');
}

if (require.main === module) {
  testBothGateways()
    .then(() => console.log('\n✅ All tests completed'))
    .catch(console.error);
}

module.exports = { testBothGateways };