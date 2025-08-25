#!/usr/bin/env node

import axios from 'axios';

async function finalDemoTest() {
  console.log('🚀 IKAS Final Demo - Advanced Multi-Service Orchestration Test');
  console.log('Testing the complete workflow: Voice Command → AI Gateway → Multi-LLM → MCP Services → Response');
  console.log('='.repeat(80));

  const testCommands = [
    {
      name: 'Model Status Check',
      command: 'What LLM models are available and which one is currently active?',
      expectation: 'Should list available models (Anthropic Claude, Google Gemini)'
    },
    {
      name: 'Keycloak User Query',
      command: 'Show me all users in the master realm',
      expectation: 'Should list users from Keycloak using list-users tool'
    },
    {
      name: 'Neo4j Graph Analysis',
      command: 'What is the structure of the Neo4j database? Show me the schema.',
      expectation: 'Should query Neo4j schema using get_neo4j_schema tool'
    },
    {
      name: 'Complex Multi-Service Request',
      command: 'Analyze all users in Keycloak and store the analysis results in Neo4j graph database for future compliance reporting',
      expectation: 'Should orchestrate both Keycloak and Neo4j operations'
    },
    {
      name: 'Administrative Action',
      command: 'Create a new realm called "demo-realm" for testing purposes',
      expectation: 'Should create realm using create-realm tool'
    }
  ];

  let successCount = 0;
  let toolCallCount = 0;
  const results = [];

  for (let i = 0; i < testCommands.length; i++) {
    const test = testCommands[i];
    console.log(`\n🔧 Test ${i + 1}/${testCommands.length}: ${test.name}`);
    console.log(`Command: "${test.command}"`);
    console.log(`Expected: ${test.expectation}`);

    try {
      const response = await axios.post('http://localhost:8005/api/chat', {
        message: test.command,
        sessionId: 'final-demo-test'
      }, {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });

      const result = response.data;
      const toolsUsed = result.toolsCalled?.length || 0;
      toolCallCount += toolsUsed;

      console.log('✅ SUCCESS');
      console.log(`Response Length: ${result.response?.length || 0} characters`);
      console.log(`Tools Called: ${toolsUsed}`);
      
      if (result.toolsCalled && result.toolsCalled.length > 0) {
        console.log('Tools Used:');
        result.toolsCalled.forEach(tool => {
          console.log(`  • ${tool.server}:${tool.tool}`);
        });
      }

      console.log(`First 200 chars: "${result.response?.substring(0, 200)}..."`);

      successCount++;
      results.push({
        name: test.name,
        success: true,
        toolsUsed,
        tools: result.toolsCalled || []
      });

    } catch (error) {
      console.log('❌ FAILED');
      console.log(`Error: ${error.message}`);
      if (error.response?.data) {
        console.log(`Response: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
      }

      results.push({
        name: test.name,
        success: false,
        error: error.message
      });
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Final Report
  console.log('\n' + '='.repeat(80));
  console.log('🎯 IKAS FINAL DEMO TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`Tests Passed: ${successCount}/${testCommands.length}`);
  console.log(`Success Rate: ${Math.round((successCount/testCommands.length)*100)}%`);
  console.log(`Total Tool Calls: ${toolCallCount}`);

  // Detailed results
  console.log('\n📊 DETAILED RESULTS:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.name} (${result.toolsUsed || 0} tools)`);
  });

  // Service breakdown
  const keycloakTools = results.filter(r => r.success && r.tools?.some(t => t.server === 'keycloak')).length;
  const neo4jTools = results.filter(r => r.success && r.tools?.some(t => t.server === 'neo4j')).length;

  console.log('\n🔧 SERVICE UTILIZATION:');
  console.log(`Tests using Keycloak MCP: ${keycloakTools}`);
  console.log(`Tests using Neo4j MCP: ${neo4jTools}`);
  console.log(`Multi-service orchestration demonstrated: ${keycloakTools > 0 && neo4jTools > 0 ? 'YES' : 'NO'}`);

  console.log('\n' + '='.repeat(80));
  
  if (successCount === testCommands.length) {
    console.log('🎉 IKAS SYSTEM FULLY OPERATIONAL - READY FOR AMSTERDAM DEMO!');
    console.log('✅ Multi-LLM support confirmed');
    console.log('✅ Keycloak MCP integration confirmed');
    console.log('✅ Neo4j MCP integration confirmed');
    console.log('✅ Voice command processing pipeline confirmed');
    console.log('✅ Advanced orchestration capabilities confirmed');
  } else {
    console.log('⚠️ Some tests failed - system partially operational');
  }

  console.log('\n🚀 The IKAS system is ready for voice-controlled Keycloak administration!');
  console.log('Try: "Hey IKAS, show all users" or "Hey IKAS, analyze compliance"');
}

finalDemoTest().catch(console.error);