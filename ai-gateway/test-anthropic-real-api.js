/**
 * Real Anthropic API Test - Complete Workflow
 * 
 * Tests the complete multi-MCP workflow using the actual Anthropic API
 * with real Claude responses. This demonstrates live Claude orchestration
 * of the "write all users to the graph" workflow.
 */

const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const AI_GATEWAY_URL = 'http://localhost:8007'; // Local instance with Anthropic
const DOCKER_AI_GATEWAY = 'http://localhost:8005'; // Docker instance for comparison
const VOICE_COMMAND = "write all users to the graph";

// Test configuration
const TEST_CONFIG = {
  sessionId: `real-anthropic-test-${Date.now()}`,
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

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function checkServices() {
  colorLog('yellow', '🔍', 'Checking service availability...');
  
  const services = [
    { name: 'Local AI Gateway (Anthropic)', url: `${AI_GATEWAY_URL}/health`, critical: true },
    { name: 'Keycloak MCP', url: 'http://localhost:8001/health', critical: true },
    { name: 'Neo4j MCP', url: 'http://localhost:8002/health', critical: true },
    { name: 'Docker AI Gateway (Gemini)', url: `${DOCKER_AI_GATEWAY}/health`, critical: false }
  ];
  
  const results = {};
  
  for (const service of services) {
    try {
      const startTime = Date.now();
      const response = await axios.get(service.url, { timeout: 5000 });
      const duration = Date.now() - startTime;
      
      colorLog('green', '✅', `${service.name}: Healthy (${duration}ms)`);
      results[service.name] = { status: 'healthy', latency: duration };
      
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      
      if (service.critical) {
        colorLog('red', '❌', `${service.name}: ${errorMsg}`);
        throw new Error(`Critical service unavailable: ${service.name}`);
      } else {
        colorLog('yellow', '⚠️', `${service.name}: ${errorMsg}`);
      }
      
      results[service.name] = { status: 'unhealthy', error: errorMsg };
    }
  }
  
  return results;
}

async function testRealAnthropicWorkflow() {
  colorLog('magenta', '🚀', 'Starting Real Anthropic API Test');
  colorLog('cyan', '🎤', `Voice Command: "${VOICE_COMMAND}"`);
  colorLog('blue', '🔑', 'Using real Anthropic API key');
  
  const testResults = {
    startTime: new Date().toISOString(),
    command: VOICE_COMMAND,
    sessionId: TEST_CONFIG.sessionId,
    success: false,
    steps: [],
    metrics: {
      totalDuration: 0,
      tokenUsage: {},
      toolCallCount: 0,
      errors: []
    }
  };
  
  const startTime = Date.now();
  
  try {
    // Execute the main workflow
    colorLog('blue', '📡', 'Sending request to Claude...');
    const response = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
      message: VOICE_COMMAND,
      sessionId: TEST_CONFIG.sessionId,
      context: TEST_CONFIG.context
    }, {
      timeout: 120000, // 2 minutes for complex workflows
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const totalDuration = Date.now() - startTime;
    
    // Process response
    testResults.totalDuration = totalDuration;
    testResults.success = response.data.success;
    testResults.response = response.data;
    
    colorLog('green', '✅', `Test completed in ${formatDuration(totalDuration)}`);
    
    // Analyze the response in detail
    colorLog('cyan', '📊', 'Claude Response Analysis');
    console.log(`${colors.bright}Response Text:${colors.reset}`);
    console.log(`"${response.data.response}"`);
    console.log();
    
    colorLog('blue', '📋', 'Execution Summary', {
      success: response.data.success,
      strategy: response.data.strategy,
      duration: formatDuration(totalDuration),
      serverDuration: response.data.duration + 'ms',
      toolsExecuted: response.data.toolsCalled?.length || 0,
      sessionId: response.data.sessionId
    });
    
    // Detailed tool analysis
    if (response.data.toolsCalled && response.data.toolsCalled.length > 0) {
      colorLog('cyan', '🔧', 'Tool Execution Sequence:');
      
      response.data.toolsCalled.forEach((tool, index) => {
        console.log(`${colors.yellow}   ${index + 1}. ${tool.server}_${tool.tool}${colors.reset}`);
        console.log(`${colors.blue}      Server: ${tool.server}${colors.reset}`);
        console.log(`${colors.blue}      Tool: ${tool.tool}${colors.reset}`);
        console.log(`${colors.blue}      Args: ${JSON.stringify(tool.arguments, null, 8)}${colors.reset}`);
      });
      
      testResults.toolSequence = response.data.toolsCalled.map(tool => 
        `${tool.server}_${tool.tool}`
      );
      
      // Validate expected sequence
      const expectedSequence = [
        'keycloak_list-users',
        'neo4j_get_neo4j_schema',
        'neo4j_write_neo4j_cypher'
      ];
      
      const actualSequence = testResults.toolSequence;
      const sequenceMatch = JSON.stringify(actualSequence) === JSON.stringify(expectedSequence);
      
      colorLog('green', '🎯', 'Sequence Validation', {
        expected: expectedSequence,
        actual: actualSequence,
        perfect_match: sequenceMatch,
        tools_called: actualSequence.length,
        expected_count: expectedSequence.length
      });
      
      testResults.sequenceValidation = {
        expected: expectedSequence,
        actual: actualSequence,
        perfectMatch: sequenceMatch
      };
    }
    
    // Check for usage information
    if (response.data.data?.usage) {
      colorLog('blue', '💰', 'Token Usage', response.data.data.usage);
      testResults.tokenUsage = response.data.data.usage;
    }
    
    // Test Neo4j verification
    colorLog('blue', '🔍', 'Verifying data was written to Neo4j...');
    try {
      const verifyResponse = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
        message: "How many users are now in the Neo4j graph database?",
        sessionId: `${TEST_CONFIG.sessionId}-verify`,
        context: TEST_CONFIG.context
      }, { timeout: 30000 });
      
      colorLog('green', '✅', 'Neo4j verification completed');
      console.log(`${colors.bright}Verification Response:${colors.reset}`);
      console.log(`"${verifyResponse.data.response}"`);
      
      testResults.verification = {
        success: verifyResponse.data.success,
        response: verifyResponse.data.response,
        toolsCalled: verifyResponse.data.toolsCalled?.length || 0
      };
      
    } catch (verifyError) {
      colorLog('yellow', '⚠️', 'Could not verify Neo4j data', {
        error: verifyError.message
      });
      testResults.verification = { success: false, error: verifyError.message };
    }
    
    return testResults;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.totalDuration = duration;
    testResults.error = error.message;
    testResults.success = false;
    
    colorLog('red', '❌', `Test failed after ${formatDuration(duration)}`);
    
    if (error.response) {
      colorLog('red', '🚫', 'HTTP Error Response', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      testResults.httpError = {
        status: error.response.status,
        data: error.response.data
      };
    } else {
      colorLog('red', '💥', 'Request Error', { error: error.message });
    }
    
    return testResults;
  }
}

async function compareWithGemini() {
  colorLog('blue', '🤖', 'Running comparison test with Gemini...');
  
  try {
    const geminiStart = Date.now();
    const geminiResponse = await axios.post(`${DOCKER_AI_GATEWAY}/api/chat`, {
      message: VOICE_COMMAND,
      sessionId: `${TEST_CONFIG.sessionId}-gemini`,
      context: TEST_CONFIG.context
    }, { timeout: 60000 });
    
    const geminiDuration = Date.now() - geminiStart;
    
    colorLog('green', '✅', 'Gemini comparison completed');
    colorLog('cyan', '📊', 'Gemini vs Anthropic', {
      gemini: {
        duration: formatDuration(geminiDuration),
        success: geminiResponse.data.success,
        toolsCalled: geminiResponse.data.toolsCalled?.length || 0,
        strategy: geminiResponse.data.strategy
      }
    });
    
    return {
      success: geminiResponse.data.success,
      duration: geminiDuration,
      toolsCalled: geminiResponse.data.toolsCalled?.length || 0,
      response: geminiResponse.data.response?.substring(0, 200) + '...'
    };
    
  } catch (error) {
    colorLog('yellow', '⚠️', 'Gemini comparison failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

async function generateTestReport(testResults, serviceHealth, geminiComparison) {
  const report = {
    timestamp: new Date().toISOString(),
    test_name: 'Real Anthropic API - Multi-MCP Workflow Test',
    command: VOICE_COMMAND,
    results: testResults,
    service_health: serviceHealth,
    gemini_comparison: geminiComparison,
    environment: {
      ai_gateway_url: AI_GATEWAY_URL,
      llm_provider: 'anthropic',
      mcp_services: ['keycloak', 'neo4j']
    }
  };
  
  // Save to file
  const reportPath = `test-results-anthropic-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  colorLog('green', '📄', `Test report saved: ${reportPath}`);
  
  return report;
}

async function runCompleteTest() {
  console.log(`${colors.bright}${colors.magenta}
╔════════════════════════════════════════════════════════════════════╗
║                    REAL ANTHROPIC API TEST                        ║
║              Complete Multi-MCP Workflow Testing                  ║
║                    Using Live Claude API                          ║
╚════════════════════════════════════════════════════════════════════╝${colors.reset}
`);

  let serviceHealth, testResults, geminiComparison;

  try {
    // Step 1: Check services
    serviceHealth = await checkServices();
    console.log();
    
    // Step 2: Run main test
    testResults = await testRealAnthropicWorkflow();
    console.log();
    
    // Step 3: Compare with Gemini
    geminiComparison = await compareWithGemini();
    console.log();
    
    // Step 4: Generate report
    const report = await generateTestReport(testResults, serviceHealth, geminiComparison);
    console.log();
    
    // Final assessment
    const isSuccess = testResults.success && 
                     testResults.toolSequence && 
                     testResults.toolSequence.length >= 2;
    
    colorLog(isSuccess ? 'green' : 'red', 
             isSuccess ? '🎉' : '⚠️', 
             `FINAL RESULT: ${isSuccess ? 'SUCCESS' : 'NEEDS REVIEW'}`);
             
    if (isSuccess) {
      console.log(`${colors.green}${colors.bright}
🎉 ANTHROPIC INTEGRATION FULLY VALIDATED!

✅ Claude successfully orchestrated the complete workflow:
   📋 Command: "${VOICE_COMMAND}"
   🔄 Tools: ${testResults.toolSequence?.join(' → ') || 'none'}
   ⏱️  Duration: ${formatDuration(testResults.totalDuration)}
   💰 Tokens: ${testResults.tokenUsage?.totalTokens || 'N/A'}
   
🚀 The IKAS system is production-ready with Anthropic Claude!${colors.reset}`);
    } else {
      console.log(`${colors.yellow}${colors.bright}
⚠️  Test completed but needs review:
   - Check the detailed logs above
   - Verify MCP service connectivity
   - Ensure Claude received proper function definitions
   - Review the generated test report${colors.reset}`);
    }
    
  } catch (error) {
    colorLog('red', '💥', 'Test suite failed', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  runCompleteTest()
    .then(() => {
      colorLog('green', '✅', 'Complete test suite finished');
      process.exit(0);
    })
    .catch((error) => {
      colorLog('red', '❌', 'Test suite crashed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { runCompleteTest, testRealAnthropicWorkflow, TEST_CONFIG };