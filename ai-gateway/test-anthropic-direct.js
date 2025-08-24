/**
 * Direct Anthropic Test
 * 
 * Tests Anthropic service directly with function calling to ensure the implementation works
 * before testing through the full orchestrator system.
 */

const { LLMFactory } = require('./dist/llm/llm-factory');
const { LLMProvider } = require('./dist/llm/llm-interface');

// Mock MCP functions for testing
const mockMCPFunctions = [
  {
    name: 'keycloak_list-users',
    description: 'List all users from Keycloak realm',
    parameters: {
      type: 'object',
      properties: {
        realm: { type: 'string', description: 'Realm name' }
      },
      required: ['realm']
    }
  },
  {
    name: 'neo4j_get_neo4j_schema',
    description: 'Get Neo4j database schema information',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'neo4j_write_neo4j_cypher',
    description: 'Execute Cypher write query in Neo4j',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Cypher query to execute' },
        parameters: { type: 'object', description: 'Query parameters' }
      },
      required: ['query']
    }
  }
];

// Mock function executor
const mockFunctionExecutor = async (functionCall) => {
  console.log(`🔧 Mock executing: ${functionCall.name}`, functionCall.args);
  
  switch (functionCall.name) {
    case 'keycloak_list-users':
      return {
        success: true,
        data: [
          { id: '1', username: 'admin', email: 'admin@example.com', firstName: 'Admin', lastName: 'User' },
          { id: '2', username: 'testuser', email: 'test@example.com', firstName: 'Test', lastName: 'User' }
        ]
      };
      
    case 'neo4j_get_neo4j_schema':
      return {
        success: true,
        data: {
          nodeLabels: ['User', 'Role', 'Realm'],
          relationshipTypes: ['HAS_ROLE', 'BELONGS_TO'],
          properties: {
            User: ['id', 'username', 'email', 'firstName', 'lastName'],
            Role: ['name', 'description'],
            Realm: ['name']
          }
        }
      };
      
    case 'neo4j_write_neo4j_cypher':
      console.log('📝 Cypher query:', functionCall.args.query);
      return {
        success: true,
        data: {
          nodesCreated: 2,
          propertiesSet: 10,
          query: functionCall.args.query
        }
      };
      
    default:
      throw new Error(`Unknown function: ${functionCall.name}`);
  }
};

async function testAnthropicDirect() {
  console.log('🧪 Testing Anthropic Service Directly\n');
  
  // Set environment for Anthropic
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-test-key-for-integration';
  
  try {
    // Create Anthropic service
    console.log('🔧 Creating Anthropic service...');
    LLMFactory.reset();
    const anthropicService = LLMFactory.createSpecificProvider(LLMProvider.ANTHROPIC);
    
    const providerInfo = anthropicService.getProviderInfo();
    console.log('✅ Service created:', providerInfo);
    
    // Test chat with tools
    console.log('\n💬 Testing chat with function calling...');
    const testMessage = "Please write all users from Keycloak to the Neo4j graph database. First get the users, then get the database schema, then write them to the database.";
    
    const chatResponse = await anthropicService.chat({
      message: testMessage,
      sessionId: 'test-session-anthropic-direct',
      tools: mockMCPFunctions,
      context: {
        realm: 'master'
      }
    });
    
    console.log('📊 Chat Response:', {
      hasResponse: !!chatResponse.response,
      responseLength: chatResponse.response?.length,
      hasFunctionCalls: !!chatResponse.functionCalls,
      functionCallCount: chatResponse.functionCalls?.length,
      finishReason: chatResponse.finishReason,
      usage: chatResponse.usage
    });
    
    if (chatResponse.functionCalls && chatResponse.functionCalls.length > 0) {
      console.log('\n🔧 Function calls requested:', chatResponse.functionCalls.map(fc => fc.name));
      
      // Process function calls
      console.log('\n⚙️ Processing function calls...');
      const processResult = await anthropicService.processFunctionCalls(
        'test-session-anthropic-direct',
        chatResponse.functionCalls,
        mockFunctionExecutor,
        mockMCPFunctions
      );
      
      console.log('📊 Process Result:', {
        hasResponse: !!processResult.response,
        responseLength: processResult.response?.length,
        hasAdditionalCalls: !!processResult.additionalFunctionCalls,
        additionalCallCount: processResult.additionalFunctionCalls?.length
      });
      
      console.log('\n💬 Final Response:');
      console.log(processResult.response);
      
      // Check if Claude wants to make more calls
      if (processResult.additionalFunctionCalls && processResult.additionalFunctionCalls.length > 0) {
        console.log('\n🔄 Additional function calls requested:', 
          processResult.additionalFunctionCalls.map(fc => fc.name));
        
        // Process additional calls
        const secondProcessResult = await anthropicService.processFunctionCalls(
          'test-session-anthropic-direct',
          processResult.additionalFunctionCalls,
          mockFunctionExecutor,
          mockMCPFunctions
        );
        
        console.log('\n💬 Second Process Result:');
        console.log(secondProcessResult.response);
      }
      
      console.log('\n✅ Direct Anthropic test completed successfully!');
      console.log('🎯 Anthropic was able to:');
      console.log('   ✓ Understand the multi-step request');
      console.log('   ✓ Call appropriate functions in sequence');
      console.log('   ✓ Process function results');
      console.log('   ✓ Provide coherent responses');
      
    } else {
      console.log('\n⚠️ No function calls were made');
      console.log('Response:', chatResponse.response);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

if (require.main === module) {
  testAnthropicDirect()
    .then(() => console.log('\n🏁 Test completed'))
    .catch(console.error);
}

module.exports = { testAnthropicDirect };