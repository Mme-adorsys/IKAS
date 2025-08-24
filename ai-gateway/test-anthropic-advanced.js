/**
 * Advanced Anthropic Test - Intelligent Data Discovery & Sync
 * 
 * Tests Claude's advanced reasoning capabilities with a complex multi-phase workflow:
 * 1. Discover available Keycloak data sources
 * 2. Analyze Neo4j schema for optimal structure  
 * 3. Plan comprehensive data synchronization strategy
 * 4. Execute intelligent multi-data sync
 */

const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const AI_GATEWAY_URL = 'http://localhost:8007';
const COMPLEX_COMMAND = "check which data you can access from keycloak, then sync all the data you can get to the graph. Check the graph schema before and think about how to structure the data before you write it to the neo4j";

// Test configuration
const TEST_CONFIG = {
  sessionId: `advanced-anthropic-test-${Date.now()}`,
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

function analyzeToolCalls(toolsCalled) {
  const analysis = {
    phases: {
      discovery: [],
      analysis: [],
      planning: [],
      execution: []
    },
    dataTypes: new Set(),
    totalCalls: toolsCalled.length
  };
  
  toolsCalled.forEach((tool, index) => {
    const toolName = `${tool.server}_${tool.tool}`;
    
    // Categorize tool calls by phase
    if (tool.tool.includes('list') || tool.tool.includes('get-metrics') || tool.tool.includes('get-events')) {
      analysis.phases.discovery.push({ index: index + 1, tool: toolName });
    } else if (tool.tool.includes('schema')) {
      analysis.phases.analysis.push({ index: index + 1, tool: toolName });
    } else if (tool.tool.includes('read')) {
      analysis.phases.planning.push({ index: index + 1, tool: toolName });
    } else if (tool.tool.includes('write')) {
      analysis.phases.execution.push({ index: index + 1, tool: toolName });
    }
    
    // Track data types
    if (tool.tool.includes('user')) analysis.dataTypes.add('users');
    if (tool.tool.includes('realm')) analysis.dataTypes.add('realms');
    if (tool.tool.includes('role')) analysis.dataTypes.add('roles');
    if (tool.tool.includes('client')) analysis.dataTypes.add('clients');
    if (tool.tool.includes('event')) analysis.dataTypes.add('events');
    if (tool.tool.includes('metrics')) analysis.dataTypes.add('metrics');
  });
  
  return analysis;
}

async function testAdvancedAnthropicWorkflow() {
  console.log(`${colors.bright}${colors.magenta}
╔═══════════════════════════════════════════════════════════════════════╗
║                  ADVANCED ANTHROPIC INTELLIGENCE TEST                ║
║           Testing Complex Multi-Phase Data Discovery & Sync          ║
║                     With Claude Opus 4.1                            ║
╚═══════════════════════════════════════════════════════════════════════╝${colors.reset}
`);

  colorLog('cyan', '🧠', 'Testing Claude\'s Advanced Reasoning:');
  console.log(`${colors.blue}   Command: "${COMPLEX_COMMAND}"${colors.reset}`);
  console.log(`${colors.blue}   Expected: Multi-phase intelligent discovery and sync${colors.reset}`);
  console.log();
  
  const testResults = {
    timestamp: new Date().toISOString(),
    command: COMPLEX_COMMAND,
    sessionId: TEST_CONFIG.sessionId,
    phases: {
      discovery: { completed: false, duration: 0, tools: [] },
      analysis: { completed: false, duration: 0, tools: [] },
      planning: { completed: false, duration: 0, tools: [] },
      execution: { completed: false, duration: 0, tools: [] }
    },
    success: false,
    intelligence_metrics: {
      reasoning_depth: 0,
      data_types_discovered: 0,
      strategic_planning: false,
      error_recovery: 0
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
    
    // Execute the complex workflow
    colorLog('magenta', '🚀', 'Sending complex command to Claude...');
    colorLog('yellow', '⚠️', 'This may take several minutes as Claude explores and plans...');
    
    const requestStart = Date.now();
    const response = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
      message: COMPLEX_COMMAND,
      sessionId: TEST_CONFIG.sessionId,
      context: TEST_CONFIG.context
    }, {
      timeout: 300000, // 5 minutes for complex operations
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const totalDuration = Date.now() - requestStart;
    testResults.totalDuration = totalDuration;
    testResults.success = response.data.success;
    
    colorLog('green', '✅', `Advanced workflow completed in ${formatDuration(totalDuration)}`);
    console.log();
    
    // Analyze Claude's response
    colorLog('cyan', '🧠', 'Claude\'s Strategic Response:');
    console.log(`${colors.bright}"${response.data.response}"${colors.reset}`);
    console.log();
    
    // Analyze tool execution
    let toolAnalysis = { phases: { discovery: [], analysis: [], planning: [], execution: [] }, dataTypes: new Set(), totalCalls: 0 };
    
    if (response.data.toolsCalled && response.data.toolsCalled.length > 0) {
      toolAnalysis = analyzeToolCalls(response.data.toolsCalled);
      
      colorLog('blue', '📊', 'Workflow Analysis', {
        total_tools_called: toolAnalysis.totalCalls,
        data_types_discovered: Array.from(toolAnalysis.dataTypes),
        execution_phases: {
          discovery: `${toolAnalysis.phases.discovery.length} tools`,
          analysis: `${toolAnalysis.phases.analysis.length} tools`,
          planning: `${toolAnalysis.phases.planning.length} tools`, 
          execution: `${toolAnalysis.phases.execution.length} tools`
        }
      });
      
      // Detailed phase analysis
      colorLog('cyan', '🔍', 'Phase-by-Phase Execution:');
      
      if (toolAnalysis.phases.discovery.length > 0) {
        colorLog('yellow', '1️⃣', `Discovery Phase (${toolAnalysis.phases.discovery.length} tools):`);
        toolAnalysis.phases.discovery.forEach(phase => {
          console.log(`${colors.yellow}      ${phase.index}. ${phase.tool}${colors.reset}`);
        });
      }
      
      if (toolAnalysis.phases.analysis.length > 0) {
        colorLog('blue', '2️⃣', `Analysis Phase (${toolAnalysis.phases.analysis.length} tools):`);
        toolAnalysis.phases.analysis.forEach(phase => {
          console.log(`${colors.blue}      ${phase.index}. ${phase.tool}${colors.reset}`);
        });
      }
      
      if (toolAnalysis.phases.planning.length > 0) {
        colorLog('cyan', '3️⃣', `Planning Phase (${toolAnalysis.phases.planning.length} tools):`);
        toolAnalysis.phases.planning.forEach(phase => {
          console.log(`${colors.cyan}      ${phase.index}. ${phase.tool}${colors.reset}`);
        });
      }
      
      if (toolAnalysis.phases.execution.length > 0) {
        colorLog('green', '4️⃣', `Execution Phase (${toolAnalysis.phases.execution.length} tools):`);
        toolAnalysis.phases.execution.forEach(phase => {
          console.log(`${colors.green}      ${phase.index}. ${phase.tool}${colors.reset}`);
        });
      }
      
      // Intelligence metrics
      testResults.intelligence_metrics = {
        reasoning_depth: toolAnalysis.totalCalls,
        data_types_discovered: toolAnalysis.dataTypes.size,
        strategic_planning: toolAnalysis.phases.analysis.length > 0 && toolAnalysis.phases.planning.length > 0,
        multi_phase_execution: Object.values(toolAnalysis.phases).filter(phase => phase.length > 0).length
      };
      
    } else {
      colorLog('red', '⚠️', 'No tools were called - unexpected for this complex command');
    }
    
    // Token usage analysis
    if (response.data.data?.usage) {
      colorLog('blue', '💰', 'Token Usage Analysis', {
        prompt_tokens: response.data.data.usage.promptTokens,
        completion_tokens: response.data.data.usage.completionTokens,
        total_tokens: response.data.data.usage.totalTokens,
        cost_efficiency: toolAnalysis ? `${(response.data.data.usage.totalTokens / toolAnalysis.totalCalls).toFixed(1)} tokens/tool` : 'N/A'
      });
    }
    
    console.log();
    
    // Final assessment
    const intelligenceScore = calculateIntelligenceScore(testResults.intelligence_metrics, toolAnalysis);
    
    colorLog(intelligenceScore >= 8 ? 'green' : intelligenceScore >= 6 ? 'yellow' : 'red',
             intelligenceScore >= 8 ? '🏆' : intelligenceScore >= 6 ? '🎯' : '📋',
             `Intelligence Score: ${intelligenceScore}/10`, {
      reasoning_depth: intelligenceScore >= 8 ? 'Excellent' : intelligenceScore >= 6 ? 'Good' : 'Basic',
      strategic_thinking: testResults.intelligence_metrics.strategic_planning ? 'Yes' : 'No',
      data_discovery: `${testResults.intelligence_metrics.data_types_discovered} types`,
      execution_phases: testResults.intelligence_metrics.multi_phase_execution
    });
    
    // Save comprehensive results
    const reportPath = `advanced-test-results-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify({
      ...testResults,
      tool_analysis: toolAnalysis,
      intelligence_score: intelligenceScore,
      service_health: healthResults,
      full_response: response.data
    }, null, 2));
    
    colorLog('green', '📄', `Comprehensive test report saved: ${reportPath}`);
    
    return { testResults, toolAnalysis, intelligenceScore };
    
  } catch (error) {
    const duration = Date.now() - overallStart;
    
    colorLog('red', '❌', `Advanced test failed after ${formatDuration(duration)}`);
    
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

function calculateIntelligenceScore(metrics, toolAnalysis) {
  let score = 0;
  
  // Reasoning depth (0-3 points)
  if (metrics.reasoning_depth >= 8) score += 3;
  else if (metrics.reasoning_depth >= 5) score += 2;
  else if (metrics.reasoning_depth >= 3) score += 1;
  
  // Data discovery breadth (0-2 points)
  if (metrics.data_types_discovered >= 4) score += 2;
  else if (metrics.data_types_discovered >= 2) score += 1;
  
  // Strategic planning (0-2 points)
  if (metrics.strategic_planning) score += 2;
  
  // Multi-phase execution (0-2 points)
  if (metrics.multi_phase_execution >= 3) score += 2;
  else if (metrics.multi_phase_execution >= 2) score += 1;
  
  // Execution quality (0-1 point)
  const hasDiscoveryAndExecution = toolAnalysis.phases.discovery.length > 0 && toolAnalysis.phases.execution.length > 0;
  if (hasDiscoveryAndExecution) score += 1;
  
  return Math.min(score, 10);
}

// Main execution
if (require.main === module) {
  testAdvancedAnthropicWorkflow()
    .then((results) => {
      if (results.success !== false) {
        console.log(`${colors.green}${colors.bright}
🎉 ADVANCED ANTHROPIC TEST COMPLETED!

🧠 Claude demonstrated sophisticated reasoning with:
   • ${results.toolAnalysis.totalCalls} strategic tool calls
   • ${results.testResults.intelligence_metrics.data_types_discovered} different data types discovered
   • ${results.testResults.intelligence_metrics.multi_phase_execution} execution phases
   • Intelligence Score: ${results.intelligenceScore}/10

🚀 This demonstrates Claude's advanced capability for:
   ✓ Autonomous data discovery
   ✓ Strategic planning and analysis
   ✓ Complex multi-phase orchestration
   ✓ Intelligent problem-solving${colors.reset}`);
      }
      process.exit(0);
    })
    .catch((error) => {
      colorLog('red', '💥', 'Test suite crashed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { testAdvancedAnthropicWorkflow };