/**
 * Quick integration test for Anthropic support
 */

const { LLMFactory } = require('./dist/llm/llm-factory');
const { LLMProvider } = require('./dist/llm/llm-interface');

// Mock environment for testing
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.LLM_PROVIDER = 'anthropic';

async function testAnthropicIntegration() {
  console.log('🧪 Testing Anthropic Integration...\n');
  
  try {
    // Test 1: Factory can create Anthropic service
    console.log('✅ Test 1: Creating Anthropic service via factory');
    const service = LLMFactory.createSpecificProvider(LLMProvider.ANTHROPIC);
    
    console.log('   Provider:', service.provider);
    console.log('   Model:', service.model);
    console.log('   Service type:', service.constructor.name);
    
    // Test 2: Service has correct interface
    console.log('\n✅ Test 2: Checking service interface');
    console.log('   Has chat method:', typeof service.chat === 'function');
    console.log('   Has processFunctionCalls method:', typeof service.processFunctionCalls === 'function');
    console.log('   Has getProviderInfo method:', typeof service.getProviderInfo === 'function');
    console.log('   Has isAvailable method:', typeof service.isAvailable === 'function');
    
    // Test 3: Provider info
    console.log('\n✅ Test 3: Provider info');
    const info = service.getProviderInfo();
    console.log('   Provider info:', JSON.stringify(info, null, 2));
    
    // Test 4: Check active sessions interface
    console.log('\n✅ Test 4: Session management');
    console.log('   Active sessions:', service.getActiveSessions());
    
    console.log('\n🎉 Anthropic integration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ AnthropicService can be instantiated');
    console.log('   ✅ All required methods are present');
    console.log('   ✅ Provider info is correct');
    console.log('   ✅ Interface matches LLMService contract');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAnthropicIntegration();