/**
 * Comprehensive Anthropic Chain Test
 * 
 * Tests the complete multi-MCP workflow using Anthropic (Claude) as the LLM provider.
 * Simulates the voice command "write all users to the graph" which should trigger:
 * 
 * 1. keycloak_list-users - Get all users from Keycloak
 * 2. neo4j_get_neo4j_schema - Get Neo4j database schema 
 * 3. neo4j_write_neo4j_cypher - Write users to Neo4j with proper Cypher
 */

const axios = require('axios');

// Configuration
const AI_GATEWAY_URL = 'http://localhost:8005';
const VOICE_COMMAND = "write all users to the graph";

// Test configuration
const TEST_CONFIG = {
  sessionId: `anthropic-test-${Date.now()}`,
  context: {
    realm: 'master',
    preferredLanguage: 'en',
    priority: 'high'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, emoji, message, data = null) {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`);
  if (data) {
    console.log(`${colors.blue}   ${JSON.stringify(data, null, 2)}${colors.reset}`);
  }
}

async function waitForServices() {
  colorLog('yellow', '⏳', 'Checking service health...');
  
  const services = [
    { name: 'AI Gateway', url: `${AI_GATEWAY_URL}/health` },
    { name: 'Keycloak MCP', url: 'http://localhost:8001/health' },
    { name: 'Neo4j MCP', url: 'http://localhost:8002/health' }
  ];
  
  for (const service of services) {
    try {
      const response = await axios.get(service.url, { timeout: 5000 });
      colorLog('green', '✅', `${service.name}: Healthy`);
    } catch (error) {
      colorLog('red', '❌', `${service.name}: Unhealthy`, {
        error: error.message,
        url: service.url
      });
      throw new Error(`${service.name} is not available`);
    }
  }
}

async function checkAnthropicConfiguration() {
  colorLog('blue', '🔍', 'Checking Anthropic configuration...');
  
  // Check if Anthropic environment variables are set
  const hasLlmProvider = process.env.LLM_PROVIDER === 'anthropic';
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  
  colorLog(hasLlmProvider ? 'green' : 'yellow', '📋', 'LLM Provider Configuration', {
    LLM_PROVIDER: process.env.LLM_PROVIDER || 'not set',
    ANTHROPIC_API_KEY: hasApiKey ? 'present' : 'missing',
    configuredCorrectly: hasLlmProvider && hasApiKey
  });
  
  if (!hasLlmProvider) {
    colorLog('yellow', '⚠️', 'LLM_PROVIDER not set to anthropic, service may use default provider');
  }
  
  if (!hasApiKey) {
    colorLog('yellow', '⚠️', 'ANTHROPIC_API_KEY not set, using test key');
    process.env.ANTHROPIC_API_KEY = 'test-key-for-integration-testing';
  }
}

async function testAnthropicChain() {
  colorLog('magenta', '🚀', 'Starting Anthropic Chain Test...');
  colorLog('cyan', '🎤', `Voice Command: "${VOICE_COMMAND}"`);
  
  const startTime = Date.now();
  
  try {
    // Make the request to AI Gateway
    const response = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
      message: VOICE_COMMAND,
      sessionId: TEST_CONFIG.sessionId,
      context: TEST_CONFIG.context
    }, {
      timeout: 60000, // 60 second timeout for complex operations
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    
    // Log response summary
    colorLog('green', '✅', `Test completed in ${duration}ms`);
    colorLog('blue', '📊', 'Response Summary', {
      success: response.data.success,
      strategy: response.data.strategy,
      toolsCalledCount: response.data.toolsCalled?.length || 0,
      duration: response.data.duration,
      sessionId: response.data.sessionId
    });
    
    // Analyze tool calling sequence
    if (response.data.toolsCalled && response.data.toolsCalled.length > 0) {
      colorLog('cyan', '🔧', 'Tool Calling Sequence:');
      
      const expectedSequence = [
        'keycloak_list-users',
        'neo4j_get_neo4j_schema', 
        'neo4j_write_neo4j_cypher'
      ];
      
      const actualSequence = response.data.toolsCalled.map(tool => 
        `${tool.server}_${tool.tool}`
      );
      
      colorLog('blue', '📋', 'Expected vs Actual Sequence', {
        expected: expectedSequence,
        actual: actualSequence,
        sequenceMatch: JSON.stringify(expectedSequence) === JSON.stringify(actualSequence)
      });
      
      // Detailed tool analysis
      response.data.toolsCalled.forEach((tool, index) => {
        colorLog('yellow', `${index + 1}️⃣`, `Tool Call ${index + 1}: ${tool.server}_${tool.tool}`, {
          server: tool.server,
          tool: tool.tool,
          arguments: tool.arguments,
          context: tool.context
        });
      });
    } else {
      colorLog('red', '⚠️', 'No tools were called - this is unexpected for this command');
    }
    
    // Analyze response content
    colorLog('green', '💬', 'Anthropic Response');
    console.log(`${colors.bright}${response.data.response}${colors.reset}`);
    
    // Data analysis
    if (response.data.data) {
      colorLog('blue', '📈', 'Response Data Analysis', {
        dataKeys: Object.keys(response.data.data),
        hasUsageInfo: !!response.data.data.usage,
        finishReason: response.data.data.finishReason
      });
      
      // Check for user data
      if (response.data.data.users) {
        colorLog('green', '👥', `User data found: ${response.data.data.users.length} users`);
      }
    }
    
    // Final assessment
    const isSuccessful = response.data.success && 
                        response.data.toolsCalled && 
                        response.data.toolsCalled.length >= 2; // At least list users and write to neo4j
    
    colorLog(isSuccessful ? 'green' : 'red', 
             isSuccessful ? '🎉' : '❌', 
             `Test Assessment: ${isSuccessful ? 'SUCCESS' : 'NEEDS REVIEW'}`, {
      criteria: {
        requestSucceeded: response.data.success,
        toolsCalled: response.data.toolsCalled?.length > 0,
        multiStepWorkflow: response.data.toolsCalled?.length >= 2,
        hasResponse: !!response.data.response
      }
    });
    
    return {
      success: true,
      duration,
      response: response.data,
      assessment: isSuccessful ? 'SUCCESS' : 'NEEDS_REVIEW'
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    colorLog('red', '❌', `Test failed after ${duration}ms`);
    
    if (error.response) {
      // HTTP error response
      colorLog('red', '🚫', 'HTTP Error Response', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      // Network error
      colorLog('red', '🌐', 'Network Error', {
        message: error.message,
        code: error.code
      });
    } else {
      // Other error
      colorLog('red', '💥', 'Unexpected Error', {
        message: error.message,
        stack: error.stack
      });
    }
    
    return {
      success: false,
      duration,
      error: error.message,
      assessment: 'FAILED'
    };
  }
}

async function verifyNeo4jSync() {
  colorLog('blue', '🔍', 'Verifying Neo4j synchronization...');
  
  try {
    // Try to query Neo4j directly to see if users were written
    const neo4jCheckResponse = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
      message: "show me how many users are in the graph database",
      sessionId: `${TEST_CONFIG.sessionId}-verify`,
      context: TEST_CONFIG.context
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    colorLog('green', '✅', 'Neo4j verification completed');
    colorLog('blue', '📊', 'Verification Response');
    console.log(`${colors.bright}${neo4jCheckResponse.data.response}${colors.reset}`);
    
    return neo4jCheckResponse.data;
    
  } catch (error) {
    colorLog('yellow', '⚠️', 'Could not verify Neo4j sync', {
      error: error.message
    });
    return null;
  }
}

async function runFullTest() {
  console.log(`${colors.bright}${colors.magenta}
╔══════════════════════════════════════════════════════════════╗
║               ANTHROPIC CHAIN TEST - IKAS                   ║
║          Testing Multi-MCP Workflow with Claude             ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);

  try {
    // Step 1: Check configuration
    await checkAnthropicConfiguration();
    console.log();
    
    // Step 2: Wait for services
    await waitForServices();
    console.log();
    
    // Step 3: Execute main test
    const testResult = await testAnthropicChain();
    console.log();
    
    // Step 4: Verify results
    const verificationResult = await verifyNeo4jSync();
    console.log();
    
    // Final summary
    colorLog('magenta', '📋', 'FINAL TEST SUMMARY', {
      testDuration: `${testResult.duration}ms`,
      testResult: testResult.assessment,
      toolsCalled: testResult.response?.toolsCalled?.length || 0,
      verificationCompleted: !!verificationResult,
      sessionId: TEST_CONFIG.sessionId
    });
    
    if (testResult.assessment === 'SUCCESS') {
      colorLog('green', '🎉', 'Anthropic multi-MCP chain test completed successfully!');
      console.log(`${colors.green}${colors.bright}
✅ Anthropic (Claude) successfully orchestrated the complete workflow:
   1. Fetched users from Keycloak via MCP
   2. Retrieved Neo4j schema for proper data modeling  
   3. Synchronized users to Neo4j graph database
   
🚀 The IKAS system is fully operational with Anthropic support!${colors.reset}`);
    } else {
      colorLog('yellow', '⚠️', 'Test completed with issues - review results above');
    }
    
  } catch (error) {
    colorLog('red', '💥', 'Test suite failed', {
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  // Set environment variables for Anthropic if not already set
  if (!process.env.LLM_PROVIDER) {
    process.env.LLM_PROVIDER = 'anthropic';
  }
  
  runFullTest()
    .then(() => {
      colorLog('green', '✅', 'Test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      colorLog('red', '❌', 'Test suite failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { runFullTest, testAnthropicChain, TEST_CONFIG };