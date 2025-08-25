#!/usr/bin/env node

import axios from 'axios';

class ComprehensiveTest {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  async sendCommand(description, command, expectedTools = []) {
    console.log(`\n🔧 ${description}`);
    console.log(`Command: "${command}"`);
    
    try {
      const response = await axios.post('http://localhost:8005/api/chat', {
        message: command,
        sessionId: 'comprehensive-test'
      }, {
        timeout: 45000,
        headers: { 'Content-Type': 'application/json' }
      });

      const result = response.data;
      console.log('✅ Success!');
      console.log(`Response: ${result.response?.substring(0, 150)}...`);
      console.log(`Tools called: ${result.toolsCalled?.length || 0}`);
      
      if (result.toolsCalled) {
        result.toolsCalled.forEach(tool => {
          console.log(`  • ${tool.server}:${tool.tool}`);
        });
      }

      this.testResults.push({
        description,
        success: true,
        toolsCount: result.toolsCalled?.length || 0,
        tools: result.toolsCalled || []
      });

      return result;
      
    } catch (error) {
      console.log('❌ Failed:', error.message);
      this.testResults.push({
        description,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async runTests() {
    console.log('🚀 Starting Comprehensive Multi-Service Test');
    console.log('Testing both Keycloak and Neo4j MCP integration...\n');

    try {
      // Test 1: Keycloak Realm Creation
      await this.sendCommand(
        'Test 1: Create Test Realm',
        'Create a new realm named "advanced-test" with display name "Advanced Test Realm", enabled true, and login with email allowed'
      );

      // Test 2: User Management
      await this.sendCommand(
        'Test 2: Create Test Users',
        'In realm "advanced-test", create three users: "admin.user" (Admin User, admin@test.com), "test.user" (Test User, test@test.com), and "guest.user" (Guest User, guest@test.com)'
      );

      // Test 3: Group and Role Management
      await this.sendCommand(
        'Test 3: Create Groups and Roles',
        'In realm "advanced-test", create groups "Administrators" and "Users", then create roles "admin-role" and "user-role"'
      );

      // Test 4: List Users to Verify
      await this.sendCommand(
        'Test 4: Verify User Creation',
        'List all users in realm "advanced-test" to verify they were created correctly'
      );

      // Test 5: Neo4j Schema Check
      await this.sendCommand(
        'Test 5: Check Neo4j Schema',
        'Get the current Neo4j database schema to understand the structure'
      );

      // Test 6: Data Synchronization
      await this.sendCommand(
        'Test 6: Synchronize to Neo4j',
        'Synchronize all users and groups from Keycloak realm "advanced-test" to the Neo4j graph database with proper relationships'
      );

      // Test 7: Graph Analysis
      await this.sendCommand(
        'Test 7: Analyze User Relationships',
        'Query the Neo4j database to find all users and their relationships, including any patterns or connections between them'
      );

      // Generate final report
      this.generateReport();

    } catch (error) {
      console.log('\n❌ Test suite failed:', error.message);
      this.generateReport();
    }
  }

  generateReport() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    const successful = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;

    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Duration: ${duration}s`);
    console.log(`Tests: ${successful}/${total} passed`);
    console.log(`Success Rate: ${Math.round((successful/total)*100)}%`);

    let totalTools = 0;
    const serverCounts = { keycloak: 0, neo4j: 0 };

    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`\n${index + 1}. ${status} ${result.description}`);
      
      if (result.success) {
        console.log(`   Tools called: ${result.toolsCount}`);
        totalTools += result.toolsCount;
        
        if (result.tools) {
          result.tools.forEach(tool => {
            if (tool.server) {
              serverCounts[tool.server] = (serverCounts[tool.server] || 0) + 1;
            }
          });
        }
      } else {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log(`\n📊 TOOL USAGE STATISTICS:`);
    console.log(`Total tool calls: ${totalTools}`);
    console.log(`Keycloak tools: ${serverCounts.keycloak}`);
    console.log(`Neo4j tools: ${serverCounts.neo4j}`);

    console.log('\n' + '='.repeat(80));
    
    if (successful === total) {
      console.log('🎉 ALL TESTS PASSED - SYSTEM FULLY OPERATIONAL!');
    } else {
      console.log('⚠️ Some tests failed - check logs for details');
    }
  }
}

const test = new ComprehensiveTest();
test.runTests();