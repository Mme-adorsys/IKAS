#!/usr/bin/env node

/**
 * Advanced Multi-Step Test: Compliance Audit & Remediation
 * Tests complex orchestration between Keycloak and Neo4j MCP servers
 * 
 * Scenario: Comprehensive compliance audit with automated remediation
 * Expected tool calls: 20+ across both MCP servers
 */

import axios from 'axios';
import { randomUUID } from 'crypto';

const AI_GATEWAY_URL = 'http://localhost:8005';
const TEST_REALM = `compliance-test-${Date.now()}`;

class ComplianceTestRunner {
  constructor() {
    this.testResults = [];
    this.sessionId = randomUUID();
    this.startTime = Date.now();
  }

  async log(phase, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      phase,
      message,
      sessionId: this.sessionId,
      ...data
    };
    
    console.log(`\n🔍 [${phase}] ${message}`);
    if (Object.keys(data).length > 0) {
      console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
    }
    
    this.testResults.push(logEntry);
  }

  async sendCommand(command, expectedTools = []) {
    this.log('API_CALL', `Sending command: "${command}"`);
    
    try {
      const response = await axios.post(`${AI_GATEWAY_URL}/api/chat`, {
        message: command,
        sessionId: this.sessionId
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;
      
      this.log('API_RESPONSE', 'Command executed successfully', {
        command,
        responseLength: result.response?.length || 0,
        toolsCalled: result.toolsCalled || [],
        duration: result.processingTime || 'unknown'
      });

      // Validate expected tools were called
      if (expectedTools.length > 0) {
        const calledTools = result.toolsCalled || [];
        const missingTools = expectedTools.filter(tool => 
          !calledTools.some(called => called.includes(tool))
        );
        
        if (missingTools.length > 0) {
          this.log('VALIDATION_WARNING', 'Some expected tools were not called', {
            expected: expectedTools,
            called: calledTools,
            missing: missingTools
          });
        } else {
          this.log('VALIDATION_SUCCESS', 'All expected tools were called', {
            expected: expectedTools,
            called: calledTools
          });
        }
      }

      return result;
      
    } catch (error) {
      this.log('API_ERROR', 'Command failed', {
        command,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  async phase1_EnvironmentSetup() {
    this.log('PHASE_START', 'Phase 1: Environment Setup & Realm Creation');
    
    await this.sendCommand(
      `Create a new realm named "${TEST_REALM}" with the following settings: display name "Compliance Test Realm", enabled true, registration allowed true, login with email true, and require SSL for external requests`,
      ['create-realm']
    );

    await this.sendCommand(
      `In realm "${TEST_REALM}", create a client named "compliance-app" with client ID "compliance-app", client protocol "openid-connect", public access type, and standard flow enabled`,
      ['create-client']
    );

    await this.sendCommand(
      `Create groups in realm "${TEST_REALM}": "Administrators", "Managers", "Employees", and "Contractors"`,
      ['create-group']
    );

    await this.sendCommand(
      `Create roles in realm "${TEST_REALM}": "admin", "user", "auditor", "guest", and "service-account"`,
      ['create-role']
    );

    this.log('PHASE_COMPLETE', 'Phase 1 completed: Environment setup');
  }

  async phase2_UserCreation() {
    this.log('PHASE_START', 'Phase 2: User Population & Role Assignment');
    
    const users = [
      { username: 'admin.user', firstName: 'Admin', lastName: 'User', email: 'admin@company.com', groups: ['Administrators'], roles: ['admin'] },
      { username: 'manager.john', firstName: 'John', lastName: 'Manager', email: 'john@company.com', groups: ['Managers'], roles: ['user'] },
      { username: 'employee.alice', firstName: 'Alice', lastName: 'Employee', email: 'alice@company.com', groups: ['Employees'], roles: ['user'] },
      { username: 'contractor.bob', firstName: 'Bob', lastName: 'Contractor', email: 'bob@external.com', groups: ['Contractors'], roles: ['guest'] },
      { username: 'service.account', firstName: 'Service', lastName: 'Account', email: 'service@company.com', groups: [], roles: ['service-account'] },
      { username: 'inactive.user', firstName: 'Inactive', lastName: 'User', email: 'inactive@company.com', groups: ['Employees'], roles: ['user'], enabled: false }
    ];

    for (const user of users) {
      await this.sendCommand(
        `In realm "${TEST_REALM}", create user with username "${user.username}", first name "${user.firstName}", last name "${user.lastName}", email "${user.email}", enabled ${user.enabled !== false ? 'true' : 'false'}`,
        ['create-user']
      );

      if (user.groups.length > 0) {
        await this.sendCommand(
          `Add user "${user.username}" to groups: ${user.groups.join(', ')} in realm "${TEST_REALM}"`,
          ['add-user-to-group']
        );
      }

      if (user.roles.length > 0) {
        await this.sendCommand(
          `Assign roles ${user.roles.join(', ')} to user "${user.username}" in realm "${TEST_REALM}"`,
          ['assign-role-to-user']
        );
      }
    }

    this.log('PHASE_COMPLETE', 'Phase 2 completed: User population');
  }

  async phase3_DataSynchronization() {
    this.log('PHASE_START', 'Phase 3: Data Synchronization to Neo4j');
    
    await this.sendCommand(
      `Synchronize all users, groups, and roles from Keycloak realm "${TEST_REALM}" to Neo4j graph database. Create comprehensive relationship mappings including user-group memberships, role assignments, and organizational hierarchy`,
      ['list-users', 'list-groups', 'list-roles', 'write_neo4j_cypher']
    );

    await this.sendCommand(
      `Get the current Neo4j schema to understand the data structure after synchronization`,
      ['get_neo4j_schema']
    );

    this.log('PHASE_COMPLETE', 'Phase 3 completed: Data synchronization');
  }

  async phase4_ComplianceAnalysis() {
    this.log('PHASE_START', 'Phase 4: Compliance Analysis & Pattern Detection');
    
    await this.sendCommand(
      `Analyze the synchronized data in Neo4j and identify compliance issues including: users without proper role assignments, orphaned accounts (users not in any groups), privilege escalation risks (users with excessive roles), inactive users with active roles, and external contractors with internal access`,
      ['read_neo4j_cypher']
    );

    await this.sendCommand(
      `Find all users in the Neo4j database who have multiple roles and analyze if this represents a segregation of duties violation`,
      ['read_neo4j_cypher']
    );

    await this.sendCommand(
      `Identify patterns in the graph database: which groups have the most users, which roles are most commonly assigned, and detect any unusual access patterns or potential security risks`,
      ['read_neo4j_cypher']
    );

    await this.sendCommand(
      `Search for any users in the system who have administrative privileges but are marked as external contractors - this represents a high-risk compliance violation`,
      ['read_neo4j_cypher']
    );

    this.log('PHASE_COMPLETE', 'Phase 4 completed: Compliance analysis');
  }

  async phase5_AutomatedRemediation() {
    this.log('PHASE_START', 'Phase 5: Automated Remediation & Verification');
    
    await this.sendCommand(
      `Based on the compliance analysis, disable any inactive users that still have active roles assigned in realm "${TEST_REALM}"`,
      ['update-user']
    );

    await this.sendCommand(
      `Remove excessive role assignments from users who have more than 2 roles assigned, keeping only their primary role in realm "${TEST_REALM}"`,
      ['remove-role-from-user']
    );

    await this.sendCommand(
      `Create an audit trail entry in Neo4j documenting all remediation actions taken, including timestamps, affected users, and compliance violations resolved`,
      ['write_neo4j_cypher']
    );

    await this.sendCommand(
      `Generate a final compliance report by querying both Keycloak and Neo4j to verify that all identified issues have been resolved and document the current state of user access controls`,
      ['list-users', 'get-user-roles', 'read_neo4j_cypher']
    );

    this.log('PHASE_COMPLETE', 'Phase 5 completed: Automated remediation');
  }

  async generateFinalReport() {
    const duration = Date.now() - this.startTime;
    const phases = [...new Set(this.testResults.map(r => r.phase))];
    const apiCalls = this.testResults.filter(r => r.phase === 'API_CALL').length;
    const errors = this.testResults.filter(r => r.phase === 'API_ERROR').length;
    const successes = this.testResults.filter(r => r.phase === 'API_RESPONSE').length;

    const report = {
      testSummary: {
        sessionId: this.sessionId,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        totalDuration: `${Math.round(duration / 1000)}s`,
        testRealm: TEST_REALM
      },
      statistics: {
        totalPhases: phases.length,
        totalApiCalls: apiCalls,
        successfulCalls: successes,
        failedCalls: errors,
        successRate: `${Math.round((successes / apiCalls) * 100)}%`
      },
      phases: phases.filter(p => p.startsWith('PHASE')),
      detailedResults: this.testResults
    };

    console.log('\n' + '='.repeat(80));
    console.log('🎯 ADVANCED COMPLIANCE TEST - FINAL REPORT');
    console.log('='.repeat(80));
    console.log(`Session ID: ${report.testSummary.sessionId}`);
    console.log(`Test Duration: ${report.testSummary.totalDuration}`);
    console.log(`Test Realm: ${report.testSummary.testRealm}`);
    console.log(`Total API Calls: ${report.statistics.totalApiCalls}`);
    console.log(`Success Rate: ${report.statistics.successRate}`);
    console.log(`Phases Completed: ${report.statistics.totalPhases}`);
    
    if (errors > 0) {
      console.log(`\n⚠️ ERRORS ENCOUNTERED: ${errors}`);
      const errorLogs = this.testResults.filter(r => r.phase === 'API_ERROR');
      errorLogs.forEach(error => {
        console.log(`   • ${error.message}: ${error.error}`);
      });
    } else {
      console.log('\n✅ ALL TESTS PASSED - NO ERRORS');
    }

    console.log('\n🔍 PHASES EXECUTED:');
    report.phases.forEach(phase => {
      console.log(`   ✓ ${phase.replace('PHASE_', '').replace('_', ' ')}`);
    });

    console.log('\n' + '='.repeat(80));
    
    return report;
  }

  async runCompleteTest() {
    try {
      console.log('🚀 Starting Advanced Multi-Step Compliance Test');
      console.log(`Session ID: ${this.sessionId}`);
      console.log(`Test Realm: ${TEST_REALM}`);
      console.log(`AI Gateway: ${AI_GATEWAY_URL}`);
      
      await this.phase1_EnvironmentSetup();
      await this.phase2_UserCreation();
      await this.phase3_DataSynchronization();
      await this.phase4_ComplianceAnalysis();
      await this.phase5_AutomatedRemediation();
      
      return await this.generateFinalReport();
      
    } catch (error) {
      this.log('TEST_FAILURE', 'Test execution failed', {
        error: error.message,
        stack: error.stack
      });
      
      console.log('\n❌ TEST EXECUTION FAILED');
      console.log(`Error: ${error.message}`);
      
      return await this.generateFinalReport();
    }
  }
}

// Run the test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ComplianceTestRunner();
  runner.runCompleteTest()
    .then(report => {
      console.log('\n🎯 Test completed. Detailed results available in report.');
      process.exit(report.statistics.failedCalls > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal test error:', error);
      process.exit(1);
    });
}

export { ComplianceTestRunner };