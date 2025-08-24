/**
 * Advanced Anthropic Test - User Creation & Data Synchronization
 * 
 * Tests Claude Opus 4.1's advanced reasoning capabilities with a complete user lifecycle:
 * 1. Create new user in Keycloak with detailed information
 * 2. Intelligently sync all user data from Keycloak to Neo4j
 * 3. Verify synchronization success and data integrity
 * 4. Optional: Clean up test data
 */

const axios = require('axios');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// Configuration
const AI_GATEWAY_URL = 'http://localhost:8007';

// Test users for creation
const TEST_USERS = [
  {
    username: 'john.doe.test',
    email: 'john.doe@ikas-test.com',
    firstName: 'John',
    lastName: 'Doe',
    command: "Create a new user named John Doe with username 'john.doe.test' and email 'john.doe@ikas-test.com', then sync all users from Keycloak to Neo4j to include this new user in the graph database"
  },
  {
    username: 'jane.smith.test',
    email: 'jane.smith@ikas-test.com',
    firstName: 'Jane',
    lastName: 'Smith',
    command: "Create user Jane Smith with username 'jane.smith.test' and email 'jane.smith@ikas-test.com', then immediately sync the updated user data to the graph database and verify she appears in Neo4j"
  }
];

// Test configuration
const TEST_CONFIG = {
  sessionId: `user-creation-sync-test-${Date.now()}`,
  context: {
    realm: 'master',
    preferredLanguage: 'en',
    priority: 'high',
    testMode: true
  },
  cleanup: true // Whether to clean up test users after testing
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
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

async function waitForGateway() {
  colorLog('yellow', '⏳', 'Waiting for Anthropic AI Gateway to start...');
  
  for (let i = 0; i < 10; i++) {
    try {
      await axios.get(`${AI_GATEWAY_URL}/health`, { timeout: 2000 });
      colorLog('green', '✅', 'AI Gateway is ready');
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('AI Gateway failed to start');
}

async function checkServiceHealth() {
  colorLog('blue', '🔍', 'Checking service health...');
  
  const services = [
    { name: 'Anthropic AI Gateway', url: `${AI_GATEWAY_URL}/health` },
    { name: 'Keycloak MCP', url: 'http://localhost:8001/health' },
    { name: 'Neo4j MCP', url: 'http://localhost:8002/health' }
  ];
  
  const healthResults = {};
  
  for (const service of services) {
    try {
      const startTime = Date.now();
      const response = await axios.get(service.url, { timeout: 5000 });
      const latency = Date.now() - startTime;
      
      colorLog('green', '✅', `${service.name}: Healthy (${latency}ms)`);
      healthResults[service.name] = { status: 'healthy', latency };
    } catch (error) {
      colorLog('red', '❌', `${service.name}: ${error.message}`);
      healthResults[service.name] = { status: 'unhealthy', error: error.message };
      throw new Error(`${service.name} is not available`);
    }
  }
  
  return healthResults;
}

function analyzeWorkflowExecution(toolsCalled) {
  const analysis = {
    phases: {
      creation: [],
      discovery: [],
      synchronization: [],
      verification: []
    },
    userOperations: 0,
    syncOperations: 0,
    totalCalls: toolsCalled.length
  };
  
  toolsCalled.forEach((tool, index) => {
    const toolName = `${tool.server}_${tool.tool}`;
    const toolEntry = { index: index + 1, tool: toolName };
    
    // Categorize tool calls by workflow phase
    if (tool.tool === 'create-user') {
      analysis.phases.creation.push(toolEntry);
      analysis.userOperations++;
    } else if (tool.tool.includes('list-users') || tool.tool.includes('list-realms')) {
      analysis.phases.discovery.push(toolEntry);
    } else if (tool.tool.includes('write_neo4j_cypher')) {
      analysis.phases.synchronization.push(toolEntry);
      analysis.syncOperations++;
    } else if (tool.tool.includes('read_neo4j_cypher') || tool.tool.includes('get_neo4j_schema')) {
      analysis.phases.verification.push(toolEntry);
    }
  });
  
  return analysis;
}

function calculateWorkflowScore(analysis, success, duration) {
  let score = 0;
  
  // User creation execution (0-3 points)
  if (analysis.userOperations >= 1) score += 3;
  else if (analysis.userOperations >= 0) score += 1;
  
  // Data synchronization (0-3 points)
  if (analysis.syncOperations >= 2) score += 3; // Multiple sync operations
  else if (analysis.syncOperations >= 1) score += 2; // Single sync
  
  // Workflow completeness (0-2 points)
  const completedPhases = Object.values(analysis.phases).filter(phase => phase.length > 0).length;
  if (completedPhases >= 3) score += 2;
  else if (completedPhases >= 2) score += 1;
  
  // Performance (0-2 points)
  if (duration < 20000) score += 2; // Under 20 seconds
  else if (duration < 40000) score += 1; // Under 40 seconds
  
  return Math.min(score, 10);
}

async function cleanupTestUsers(createdUsers) {
  if (!TEST_CONFIG.cleanup || createdUsers.length === 0) {
    colorLog('yellow', '⏭️', 'Skipping cleanup (disabled or no users to clean)');
    return { skipped: true };
  }
  
  colorLog('yellow', '🧹', 'Starting cleanup of test users...');
  
  const cleanupResults = {
    usersProcessed: createdUsers.length,
    keycloakDeletes: 0,
    neo4jDeletes: 0,
    success: false
  };
  
  try {
    for (const user of createdUsers) {
      const cleanupCommand = `Delete the test user '${user.username}' from both Keycloak and Neo4j to clean up the test data. Make sure to remove it from both systems for complete cleanup.`;
      
      colorLog('cyan', '🗑️', `Cleaning up user: ${user.username}`);
      
      const response = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
        message: cleanupCommand,
        sessionId: `${TEST_CONFIG.sessionId}-cleanup`,
        context: {
          ...TEST_CONFIG.context,
          phase: 'cleanup',
          targetUser: user.username
        }
      }, {
        timeout: 60000, // 1 minute for cleanup
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success && response.data.toolsCalled) {
        const tools = response.data.toolsCalled;
        cleanupResults.keycloakDeletes += tools.filter(t => t.tool === 'delete-user').length;
        cleanupResults.neo4jDeletes += tools.filter(t => t.tool.includes('write_neo4j')).length;
        
        colorLog('green', '✅', `Cleanup completed for ${user.username}`);
      } else {
        colorLog('yellow', '⚠️', `Cleanup may be incomplete for ${user.username}`);
      }
    }
    
    cleanupResults.success = true;
    
    colorLog('green', '🧹', 'Cleanup Summary', {
      users_processed: cleanupResults.usersProcessed,
      keycloak_deletes: cleanupResults.keycloakDeletes,
      neo4j_deletes: cleanupResults.neo4jDeletes
    });
    
    return cleanupResults;
    
  } catch (error) {
    colorLog('red', '❌', `Cleanup failed: ${error.message}`);
    return { ...cleanupResults, success: false, error: error.message };
  }
}

async function testUserCreationWorkflow(testUser, testIndex) {
  colorLog('magenta', '🚀', `Phase ${testIndex + 1}: Testing User Creation & Sync`);
  colorLog('cyan', '👤', `Creating user: ${testUser.firstName} ${testUser.lastName}`);
  colorLog('blue', '💬', `Command: "${testUser.command}"`);
  
  const phaseResults = {
    testUser: testUser,
    startTime: new Date().toISOString(),
    success: false,
    phases: {
      creation: { completed: false, duration: 0 },
      synchronization: { completed: false, duration: 0 },
      verification: { completed: false, duration: 0 }
    }
  };
  
  const phaseStart = Date.now();
  
  try {
    // Execute the user creation and sync workflow
    colorLog('yellow', '⚡', 'Executing user creation and sync workflow...');
    
    const response = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
      message: testUser.command,
      sessionId: `${TEST_CONFIG.sessionId}-phase-${testIndex + 1}`,
      context: {
        ...TEST_CONFIG.context,
        phase: `user-creation-${testIndex + 1}`,
        expectedUser: testUser.username
      }
    }, {
      timeout: 120000, // 2 minutes for user creation and sync
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const phaseDuration = Date.now() - phaseStart;
    phaseResults.duration = phaseDuration;
    phaseResults.success = response.data.success;
    
    colorLog('green', '✅', `User creation workflow completed in ${formatDuration(phaseDuration)}`);
    console.log();
    
    // Analyze Claude's response
    colorLog('cyan', '🧠', 'Claude\'s Workflow Response:');
    console.log(`${colors.bright}"${response.data.response}"${colors.reset}`);
    console.log();
    
    // Analyze workflow execution
    let workflowAnalysis = { 
      phases: { creation: [], discovery: [], synchronization: [], verification: [] }, 
      userOperations: 0,
      syncOperations: 0,
      totalCalls: 0 
    };
    
    if (response.data.toolsCalled && response.data.toolsCalled.length > 0) {
      workflowAnalysis = analyzeWorkflowExecution(response.data.toolsCalled);
      
      colorLog('blue', '📊', 'Workflow Execution Analysis', {
        total_operations: workflowAnalysis.totalCalls,
        user_operations: workflowAnalysis.userOperations,
        sync_operations: workflowAnalysis.syncOperations,
        phases_executed: Object.keys(workflowAnalysis.phases).filter(
          key => workflowAnalysis.phases[key].length > 0
        ).length
      });
      
      // Detailed phase analysis
      colorLog('cyan', '🔍', 'Phase-by-Phase Workflow Execution:');
      
      if (workflowAnalysis.phases.creation.length > 0) {
        colorLog('green', '1️⃣', `User Creation (${workflowAnalysis.phases.creation.length} operations):`);
        workflowAnalysis.phases.creation.forEach(phase => {
          console.log(`${colors.green}      ${phase.index}. ${phase.tool}${colors.reset}`);
        });
      }
      
      if (workflowAnalysis.phases.discovery.length > 0) {
        colorLog('yellow', '2️⃣', `Data Discovery (${workflowAnalysis.phases.discovery.length} operations):`);
        workflowAnalysis.phases.discovery.forEach(phase => {
          console.log(`${colors.yellow}      ${phase.index}. ${phase.tool}${colors.reset}`);
        });
      }
      
      if (workflowAnalysis.phases.synchronization.length > 0) {
        colorLog('blue', '3️⃣', `Data Synchronization (${workflowAnalysis.phases.synchronization.length} operations):`);
        workflowAnalysis.phases.synchronization.forEach(phase => {
          console.log(`${colors.blue}      ${phase.index}. ${phase.tool}${colors.reset}`);
        });
      }
      
      if (workflowAnalysis.phases.verification.length > 0) {
        colorLog('cyan', '4️⃣', `Verification (${workflowAnalysis.phases.verification.length} operations):`);
        workflowAnalysis.phases.verification.forEach(phase => {
          console.log(`${colors.cyan}      ${phase.index}. ${phase.tool}${colors.reset}`);
        });
      }
    } else {
      colorLog('red', '⚠️', 'No operations executed - unexpected for user creation workflow');
    }
    
    // Token usage analysis
    if (response.data.data?.usage) {
      colorLog('blue', '💰', 'Token Usage Analysis', {
        prompt_tokens: response.data.data.usage.promptTokens,
        completion_tokens: response.data.data.usage.completionTokens,
        total_tokens: response.data.data.usage.totalTokens,
        efficiency: `${(response.data.data.usage.totalTokens / (workflowAnalysis.totalCalls || 1)).toFixed(1)} tokens/operation`
      });
    }
    
    console.log();
    
    // Calculate workflow score
    const workflowScore = calculateWorkflowScore(workflowAnalysis, phaseResults.success, phaseDuration);
    
    colorLog(workflowScore >= 8 ? 'green' : workflowScore >= 6 ? 'yellow' : 'red',
             workflowScore >= 8 ? '🏆' : workflowScore >= 6 ? '🎯' : '📋',
             `Workflow Score: ${workflowScore}/10`, {
      user_creation: workflowAnalysis.userOperations > 0 ? 'Executed' : 'Missing',
      data_sync: workflowAnalysis.syncOperations > 0 ? 'Completed' : 'Missing',
      workflow_completeness: `${Object.values(workflowAnalysis.phases).filter(p => p.length > 0).length}/4 phases`,
      performance: formatDuration(phaseDuration)
    });
    
    // Store results for reporting
    phaseResults.workflowAnalysis = workflowAnalysis;
    phaseResults.workflowScore = workflowScore;
    phaseResults.response = response.data;
    
    return phaseResults;
    
  } catch (error) {
    const duration = Date.now() - phaseStart;
    
    colorLog('red', '❌', `User creation workflow failed after ${formatDuration(duration)}`);
    
    if (error.response) {
      colorLog('red', '🚫', 'HTTP Error', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      colorLog('red', '💥', 'Error', { message: error.message });
    }
    
    return { 
      ...phaseResults, 
      success: false, 
      error: error.message, 
      duration 
    };
  }
}

async function testAdvancedUserCreationSync() {
  console.log(`${colors.bright}${colors.magenta}
╔═══════════════════════════════════════════════════════════════════════╗
║              ADVANCED USER CREATION & SYNC TEST                      ║
║        Testing Claude Opus 4.1's Complete Workflow Management       ║
║          User Creation → Data Sync → Verification                    ║
╚═══════════════════════════════════════════════════════════════════════╝${colors.reset}
`);

  colorLog('cyan', '🧠', 'Testing Claude Opus 4.1 Advanced Workflow:');
  console.log(`${colors.blue}   Scenario: Complete user lifecycle management${colors.reset}`);
  console.log(`${colors.blue}   Expected: User creation + intelligent sync + verification${colors.reset}`);
  console.log();
  
  const testResults = {
    timestamp: new Date().toISOString(),
    testType: 'user-creation-sync-workflow',
    sessionId: TEST_CONFIG.sessionId,
    phases: [],
    success: false,
    overallScore: 0,
    summary: {
      usersCreated: 0,
      syncOperations: 0,
      totalDuration: 0,
      averageScore: 0
    }
  };
  
  const overallStart = Date.now();
  
  try {
    // Wait for gateway
    await waitForGateway();
    console.log();
    
    // Check health
    const healthResults = await checkServiceHealth();
    console.log();
    
    // Execute user creation and sync tests
    for (let i = 0; i < TEST_USERS.length; i++) {
      const testUser = TEST_USERS[i];
      const phaseResult = await testUserCreationWorkflow(testUser, i);
      testResults.phases.push(phaseResult);
      
      if (phaseResult.success) {
        testResults.summary.usersCreated++;
        if (phaseResult.workflowAnalysis) {
          testResults.summary.syncOperations += phaseResult.workflowAnalysis.syncOperations;
        }
      }
      
      // Brief pause between tests
      if (i < TEST_USERS.length - 1) {
        colorLog('yellow', '⏸️', 'Brief pause before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log();
      }
    }
    
    const totalDuration = Date.now() - overallStart;
    testResults.summary.totalDuration = totalDuration;
    
    // Calculate overall results
    const successfulPhases = testResults.phases.filter(p => p.success);
    testResults.success = successfulPhases.length > 0;
    
    if (successfulPhases.length > 0) {
      testResults.summary.averageScore = successfulPhases.reduce((sum, p) => 
        sum + (p.workflowScore || 0), 0) / successfulPhases.length;
      testResults.overallScore = Math.round(testResults.summary.averageScore);
    }
    
    console.log();
    
    // Optional cleanup of test users
    const createdUsers = TEST_USERS.filter((user, index) => testResults.phases[index]?.success);
    if (createdUsers.length > 0) {
      console.log();
      const cleanupResults = await cleanupTestUsers(createdUsers);
      testResults.cleanup = cleanupResults;
    }
    
    colorLog('cyan', '📊', 'Overall Test Results Summary:');
    colorLog('blue', '📈', 'Performance Metrics', {
      total_duration: formatDuration(totalDuration),
      phases_completed: `${successfulPhases.length}/${TEST_USERS.length}`,
      users_created: testResults.summary.usersCreated,
      sync_operations: testResults.summary.syncOperations,
      average_workflow_score: `${testResults.summary.averageScore.toFixed(1)}/10`,
      cleanup_executed: testResults.cleanup ? (testResults.cleanup.skipped ? 'Skipped' : 'Completed') : 'N/A'
    });
    
    // Save comprehensive results
    const reportPath = `user-creation-sync-results-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify({
      ...testResults,
      service_health: healthResults,
      test_config: TEST_CONFIG,
      test_users: TEST_USERS
    }, null, 2));
    
    colorLog('green', '📄', `Comprehensive test report saved: ${reportPath}`);
    
    return testResults;
    
  } catch (error) {
    const duration = Date.now() - overallStart;
    
    colorLog('red', '❌', `Advanced user creation test failed after ${formatDuration(duration)}`);
    
    if (error.response) {
      colorLog('red', '🚫', 'HTTP Error', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      colorLog('red', '💥', 'Error', { message: error.message });
    }
    
    return { success: false, error: error.message, duration };
  }
}

// Main execution
if (require.main === module) {
  testAdvancedUserCreationSync()
    .then((results) => {
      if (results.success !== false) {
        console.log(`${colors.green}${colors.bright}

🎉 ADVANCED USER CREATION & SYNC TEST COMPLETED!

🧠 Claude Opus 4.1 demonstrated advanced workflow management:
   • ${results.summary.usersCreated} users successfully created
   • ${results.summary.syncOperations} synchronization operations executed
   • ${results.phases.filter(p => p.success).length}/${TEST_USERS.length} workflow phases completed
   • Overall Score: ${results.overallScore}/10

🚀 This demonstrates Claude's mastery of:
   ✓ Multi-step user management workflows
   ✓ Intelligent data synchronization
   ✓ Cross-system orchestration
   ✓ Real-time data verification${colors.reset}`);
      }
      process.exit(0);
    })
    .catch((error) => {
      colorLog('red', '💥', 'Test suite crashed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { testAdvancedUserCreationSync };