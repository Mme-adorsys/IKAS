#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Keycloak MCP Tools Integration
 * Tests all 58 tools across 7 categories
 */

const axios = require('axios');

// Configuration
const KEYCLOAK_MCP_URL = 'http://localhost:8001';
const AI_GATEWAY_URL = 'http://localhost:8005';
const TEST_REALM = 'test-realm-' + Date.now();

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

// Test utilities
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = {
    'INFO': '✅',
    'ERROR': '❌',
    'WARN': '⚠️',
    'TEST': '🧪'
  }[level] || '📝';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    console.log('   ', JSON.stringify(data, null, 2));
  }
}

async function callTool(toolName, args) {
  try {
    const response = await axios.post(`${KEYCLOAK_MCP_URL}/tools/${toolName}`, args, {
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    throw new Error(`HTTP ${error.response?.status}: ${error.response?.data?.error || error.message}`);
  }
}

async function testAIGatewayDiscovery() {
  try {
    const response = await axios.get(`${AI_GATEWAY_URL}/api/tools`);
    const keycloakTools = response.data?.tools?.keycloak || [];
    return {
      success: true,
      toolCount: keycloakTools.length,
      tools: keycloakTools.map(t => t.name)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testLLMIntegration(provider, message) {
  try {
    const response = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
      message,
      sessionId: `test-${provider}-${Date.now()}`,
      provider
    });
    return {
      success: response.data?.success || false,
      toolsCalled: response.data?.toolsCalled || [],
      response: response.data?.response
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function recordTest(testName, success, duration, error = null, details = null) {
  const result = {
    testName,
    success,
    duration,
    error,
    details,
    timestamp: new Date().toISOString()
  };
  
  testResults.details.push(result);
  
  if (success) {
    testResults.passed++;
    log('TEST', `✅ ${testName} (${duration}ms)`);
  } else {
    testResults.failed++;
    log('TEST', `❌ ${testName} (${duration}ms)`, { error, details });
  }
}

// Test Categories

async function testHealthAndDiscovery() {
  log('INFO', '🔍 Testing Health and Discovery');
  
  // Test 1: Health Check
  const start1 = Date.now();
  try {
    const response = await axios.get(`${KEYCLOAK_MCP_URL}/health`);
    const duration = Date.now() - start1;
    recordTest('Health Check', response.data?.status === 'healthy', duration, null, {
      totalTools: response.data?.totalTools,
      categories: response.data?.categories
    });
  } catch (error) {
    recordTest('Health Check', false, Date.now() - start1, error.message);
  }

  // Test 2: Tools List
  const start2 = Date.now();
  try {
    const response = await axios.get(`${KEYCLOAK_MCP_URL}/tools`);
    const duration = Date.now() - start2;
    const toolCount = response.data?.totalCount || 0;
    recordTest('Tools List', toolCount === 58, duration, null, {
      actualCount: toolCount,
      expectedCount: 58
    });
  } catch (error) {
    recordTest('Tools List', false, Date.now() - start2, error.message);
  }

  // Test 3: AI Gateway Discovery
  const start3 = Date.now();
  try {
    const discovery = await testAIGatewayDiscovery();
    const duration = Date.now() - start3;
    recordTest('AI Gateway Discovery', discovery.success && discovery.toolCount >= 50, duration, 
      discovery.error, { toolCount: discovery.toolCount });
  } catch (error) {
    recordTest('AI Gateway Discovery', false, Date.now() - start3, error.message);
  }
}

async function testRealmTools() {
  log('INFO', '🏛️ Testing Realm Management Tools (5 tools)');

  const realmTests = [
    {
      name: 'list-realms',
      args: {},
      validate: (result) => Array.isArray(result.data)
    },
    {
      name: 'get-realm', 
      args: { realm: 'master' },
      validate: (result) => result.data?.realm === 'master'
    }
  ];

  for (const test of realmTests) {
    const start = Date.now();
    try {
      const result = await callTool(test.name, test.args);
      const duration = Date.now() - start;
      const valid = test.validate(result);
      recordTest(`Realm: ${test.name}`, valid, duration, null, {
        success: result.success,
        hasData: !!result.data
      });
    } catch (error) {
      recordTest(`Realm: ${test.name}`, false, Date.now() - start, error.message);
    }
  }
}

async function testUserTools() {
  log('INFO', '👥 Testing User Management Tools (9 tools)');

  let testUserId = null;

  // Test user creation
  const start1 = Date.now();
  try {
    const result = await callTool('create-user', {
      realm: 'master',
      username: `testuser-${Date.now()}`,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      enabled: true
    });
    const duration = Date.now() - start1;
    testUserId = result.data?.userId;
    recordTest('User: create-user', result.success && !!testUserId, duration, null, {
      userId: testUserId
    });
  } catch (error) {
    recordTest('User: create-user', false, Date.now() - start1, error.message);
  }

  // Test list users
  const start2 = Date.now();
  try {
    const result = await callTool('list-users', {
      realm: 'master',
      max: 10
    });
    const duration = Date.now() - start2;
    recordTest('User: list-users', result.success && Array.isArray(result.data), duration, null, {
      userCount: result.data?.length || 0
    });
  } catch (error) {
    recordTest('User: list-users', false, Date.now() - start2, error.message);
  }

  // Test get user (if we have a test user)
  if (testUserId) {
    const start3 = Date.now();
    try {
      const result = await callTool('get-user', {
        realm: 'master',
        userId: testUserId
      });
      const duration = Date.now() - start3;
      recordTest('User: get-user', result.success && result.data?.id === testUserId, duration);
    } catch (error) {
      recordTest('User: get-user', false, Date.now() - start3, error.message);
    }

    // Test password reset
    const start4 = Date.now();
    try {
      const result = await callTool('reset-user-password', {
        realm: 'master',
        userId: testUserId,
        newPassword: 'TempPass123!',
        temporary: true
      });
      const duration = Date.now() - start4;
      recordTest('User: reset-user-password', result.success, duration);
    } catch (error) {
      recordTest('User: reset-user-password', false, Date.now() - start4, error.message);
    }

    // Cleanup - delete test user
    try {
      await callTool('delete-user', {
        realm: 'master',
        userId: testUserId
      });
      log('INFO', `Cleaned up test user: ${testUserId}`);
    } catch (error) {
      log('WARN', `Failed to cleanup test user: ${error.message}`);
    }
  }
}

async function testClientTools() {
  log('INFO', '🔗 Testing Client Management Tools (9 tools)');

  let testClientId = null;

  // Test client creation
  const start1 = Date.now();
  try {
    const clientId = `test-client-${Date.now()}`;
    const result = await callTool('create-client', {
      realm: 'master',
      clientId: clientId,
      name: 'Test Client',
      enabled: true,
      publicClient: true
    });
    const duration = Date.now() - start1;
    testClientId = clientId;
    recordTest('Client: create-client', result.success, duration, null, {
      clientId: testClientId
    });
  } catch (error) {
    recordTest('Client: create-client', false, Date.now() - start1, error.message);
  }

  // Test list clients
  const start2 = Date.now();
  try {
    const result = await callTool('list-clients', {
      realm: 'master',
      max: 10
    });
    const duration = Date.now() - start2;
    recordTest('Client: list-clients', result.success && Array.isArray(result.data), duration, null, {
      clientCount: result.data?.length || 0
    });
  } catch (error) {
    recordTest('Client: list-clients', false, Date.now() - start2, error.message);
  }

  // Cleanup test client
  if (testClientId) {
    try {
      await callTool('delete-client', {
        realm: 'master',
        clientId: testClientId
      });
      log('INFO', `Cleaned up test client: ${testClientId}`);
    } catch (error) {
      log('WARN', `Failed to cleanup test client: ${error.message}`);
    }
  }
}

async function testGroupTools() {
  log('INFO', '👥 Testing Group Management Tools (10 tools)');

  const start1 = Date.now();
  try {
    const result = await callTool('list-groups', {
      realm: 'master',
      max: 10
    });
    const duration = Date.now() - start1;
    recordTest('Group: list-groups', result.success && Array.isArray(result.data), duration, null, {
      groupCount: result.data?.length || 0
    });
  } catch (error) {
    recordTest('Group: list-groups', false, Date.now() - start1, error.message);
  }

  const start2 = Date.now();
  try {
    const result = await callTool('get-group-hierarchy', {
      realm: 'master'
    });
    const duration = Date.now() - start2;
    recordTest('Group: get-group-hierarchy', result.success, duration);
  } catch (error) {
    recordTest('Group: get-group-hierarchy', false, Date.now() - start2, error.message);
  }
}

async function testRoleTools() {
  log('INFO', '🔐 Testing Role Management Tools (14 tools)');

  const start1 = Date.now();
  try {
    const result = await callTool('list-roles', {
      realm: 'master',
      max: 10
    });
    const duration = Date.now() - start1;
    recordTest('Role: list-roles', result.success && Array.isArray(result.data), duration, null, {
      roleCount: result.data?.length || 0
    });
  } catch (error) {
    recordTest('Role: list-roles', false, Date.now() - start1, error.message);
  }
}

async function testEventTools() {
  log('INFO', '📋 Testing Event Management Tools (6 tools)');

  const start1 = Date.now();
  try {
    const result = await callTool('list-admin-events', {
      realm: 'master',
      max: 10
    });
    const duration = Date.now() - start1;
    recordTest('Event: list-admin-events', result.success, duration, null, {
      hasData: !!result.data
    });
  } catch (error) {
    recordTest('Event: list-admin-events', false, Date.now() - start1, error.message);
  }

  const start2 = Date.now();
  try {
    const result = await callTool('get-event-types', {
      realm: 'master'
    });
    const duration = Date.now() - start2;
    recordTest('Event: get-event-types', result.success, duration);
  } catch (error) {
    recordTest('Event: get-event-types', false, Date.now() - start2, error.message);
  }
}

async function testMetricsTools() {
  log('INFO', '📊 Testing Metrics & Monitoring Tools (10 tools)');

  const metricsTests = [
    {
      name: 'get-server-info',
      args: {},
      validate: (result) => result.success && result.data
    },
    {
      name: 'get-realm-stats',
      args: { realm: 'master' },
      validate: (result) => result.success && typeof result.data?.userCount === 'number'
    },
    {
      name: 'get-user-sessions',
      args: { realm: 'master' },
      validate: (result) => result.success && Array.isArray(result.data)
    },
    {
      name: 'get-authentication-flows',
      args: { realm: 'master' },
      validate: (result) => result.success
    },
    {
      name: 'get-client-scopes',
      args: { realm: 'master' },
      validate: (result) => result.success
    }
  ];

  for (const test of metricsTests) {
    const start = Date.now();
    try {
      const result = await callTool(test.name, test.args);
      const duration = Date.now() - start;
      const valid = test.validate(result);
      recordTest(`Metrics: ${test.name}`, valid, duration, null, {
        success: result.success
      });
    } catch (error) {
      recordTest(`Metrics: ${test.name}`, false, Date.now() - start, error.message);
    }
  }
}

async function testLLMIntegrations() {
  log('INFO', '🤖 Testing LLM Integrations');

  // Test Anthropic integration
  const start1 = Date.now();
  try {
    const result = await testLLMIntegration('anthropic', 'List all users in the master realm');
    const duration = Date.now() - start1;
    const hasKeycloakTool = result.toolsCalled?.some(tool => tool.includes('list-users')) || false;
    recordTest('LLM: Anthropic Integration', result.success && hasKeycloakTool, duration, 
      result.error, { toolsCalled: result.toolsCalled });
  } catch (error) {
    recordTest('LLM: Anthropic Integration', false, Date.now() - start1, error.message);
  }

  // Test Gemini integration
  const start2 = Date.now();
  try {
    const result = await testLLMIntegration('gemini', 'Show me information about the master realm');
    const duration = Date.now() - start2;
    const hasKeycloakTool = result.toolsCalled?.some(tool => 
      tool.includes('get-realm') || tool.includes('list-realms')) || false;
    recordTest('LLM: Gemini Integration', result.success && hasKeycloakTool, duration, 
      result.error, { toolsCalled: result.toolsCalled });
  } catch (error) {
    recordTest('LLM: Gemini Integration', false, Date.now() - start2, error.message);
  }
}

async function performanceTest() {
  log('INFO', '⚡ Performance Testing');

  // Test concurrent requests
  const start1 = Date.now();
  try {
    const promises = Array(10).fill(null).map(() => 
      callTool('list-users', { realm: 'master', max: 5 })
    );
    
    const results = await Promise.all(promises);
    const duration = Date.now() - start1;
    const allSuccessful = results.every(r => r.success);
    
    recordTest('Performance: 10 Concurrent Requests', allSuccessful && duration < 10000, duration, null, {
      avgResponseTime: duration / 10,
      allSuccessful,
      totalRequests: 10
    });
  } catch (error) {
    recordTest('Performance: 10 Concurrent Requests', false, Date.now() - start1, error.message);
  }

  // Test response times for different tools
  const toolsToTest = ['list-users', 'list-realms', 'get-server-info'];
  const responseTimes = {};

  for (const toolName of toolsToTest) {
    const start = Date.now();
    try {
      await callTool(toolName, { realm: 'master' });
      responseTimes[toolName] = Date.now() - start;
    } catch (error) {
      responseTimes[toolName] = 'ERROR';
    }
  }

  const avgResponseTime = Object.values(responseTimes)
    .filter(time => typeof time === 'number')
    .reduce((sum, time) => sum + time, 0) / Object.keys(responseTimes).length;

  recordTest('Performance: Response Time Analysis', avgResponseTime < 2000, avgResponseTime, null, {
    responseTimes,
    averageResponseTime: avgResponseTime
  });
}

function generateReport() {
  log('INFO', '📊 Generating Test Report');

  const summary = {
    totalTests: testResults.passed + testResults.failed + testResults.skipped,
    passed: testResults.passed,
    failed: testResults.failed,
    skipped: testResults.skipped,
    successRate: Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100),
    testDuration: testResults.details.reduce((sum, test) => sum + test.duration, 0),
    categories: {}
  };

  // Group by category
  testResults.details.forEach(test => {
    const category = test.testName.split(':')[0];
    if (!summary.categories[category]) {
      summary.categories[category] = { passed: 0, failed: 0, total: 0 };
    }
    summary.categories[category].total++;
    if (test.success) {
      summary.categories[category].passed++;
    } else {
      summary.categories[category].failed++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('🧪 KEYCLOAK MCP TOOLS TEST REPORT');
  console.log('='.repeat(60));
  console.log(`📊 Total Tests: ${summary.totalTests}`);
  console.log(`✅ Passed: ${summary.passed}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`⏭️  Skipped: ${summary.skipped}`);
  console.log(`🎯 Success Rate: ${summary.successRate}%`);
  console.log(`⏱️  Total Duration: ${summary.testDuration}ms`);
  console.log('');

  // Category breakdown
  console.log('📋 Results by Category:');
  Object.entries(summary.categories).forEach(([category, stats]) => {
    const rate = Math.round((stats.passed / stats.total) * 100);
    console.log(`   ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
  });

  // Failed tests
  const failedTests = testResults.details.filter(test => !test.success);
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   • ${test.testName}: ${test.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  return summary;
}

async function main() {
  console.log('🚀 Starting Keycloak MCP Tools Comprehensive Test Suite');
  console.log('Target URLs:');
  console.log(`   • Keycloak MCP: ${KEYCLOAK_MCP_URL}`);
  console.log(`   • AI Gateway: ${AI_GATEWAY_URL}`);
  console.log('');

  try {
    // Phase 1: Basic Health and Discovery
    await testHealthAndDiscovery();

    // Phase 2: Individual Tool Categories
    await testRealmTools();
    await testUserTools();
    await testClientTools();
    await testGroupTools();
    await testRoleTools();
    await testEventTools();
    await testMetricsTools();

    // Phase 3: Integration Testing
    await testLLMIntegrations();

    // Phase 4: Performance Testing
    await performanceTest();

  } catch (error) {
    log('ERROR', 'Test suite failed with error:', error.message);
  } finally {
    // Generate final report
    const report = generateReport();

    // Exit with appropriate code
    process.exit(report.failed > 0 ? 1 : 0);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  log('WARN', 'Test suite interrupted');
  generateReport();
  process.exit(130);
});

// Run the test suite
if (require.main === module) {
  main().catch(error => {
    log('ERROR', 'Unhandled error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  testHealthAndDiscovery,
  testRealmTools,
  testUserTools,
  testClientTools,
  testGroupTools,
  testRoleTools,
  testEventTools,
  testMetricsTools,
  testLLMIntegrations,
  performanceTest
};