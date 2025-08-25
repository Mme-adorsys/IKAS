#!/usr/bin/env node

/**
 * Test script for IKAS AI Gateway - Testing voice commands and tool execution
 * Tests various Keycloak administration commands to verify end-to-end functionality
 */

const https = require('http');
const fs = require('fs');

const AI_GATEWAY_URL = 'http://localhost:8005';
const TEST_SESSION_ID = `test-session-${Date.now()}`;

// Test commands to validate different tool categories
const TEST_COMMANDS = [
    // Realm Management Commands
    {
        category: 'realm-management',
        command: 'create a new realm called "test-realm"',
        expectedTools: ['create-realm'],
        description: 'Test realm creation with proper tool selection'
    },
    {
        category: 'realm-management', 
        command: 'list all realms',
        expectedTools: ['list-realms'],
        description: 'Test realm listing'
    },
    {
        category: 'realm-management',
        command: 'show me details about the master realm',
        expectedTools: ['get-realm'],
        description: 'Test realm details retrieval'
    },
    
    // User Management Commands
    {
        category: 'user-management',
        command: 'create a new user named john with email john@example.com',
        expectedTools: ['create-user'],
        description: 'Test user creation with parameters'
    },
    {
        category: 'user-management',
        command: 'list all users in the master realm',
        expectedTools: ['list-users'],
        description: 'Test user listing'
    },
    {
        category: 'user-management',
        command: 'show me user details for admin user',
        expectedTools: ['get-user', 'list-users'],
        description: 'Test user details retrieval'
    },
    
    // Client Management Commands
    {
        category: 'client-management',
        command: 'list all clients in the master realm',
        expectedTools: ['list-clients'],
        description: 'Test client listing'
    },
    {
        category: 'client-management',
        command: 'create a new client called "test-app"',
        expectedTools: ['create-client'],
        description: 'Test client creation'
    },
    
    // Group Management Commands
    {
        category: 'group-management',
        command: 'list all groups',
        expectedTools: ['list-groups'],
        description: 'Test group listing'
    },
    {
        category: 'group-management',
        command: 'create a group called "admins"',
        expectedTools: ['create-group'],
        description: 'Test group creation'
    },
    
    // Role Management Commands
    {
        category: 'role-management',
        command: 'list all roles',
        expectedTools: ['list-roles'],
        description: 'Test role listing'
    },
    {
        category: 'role-management',
        command: 'create a role called "developer"',
        expectedTools: ['create-role'],
        description: 'Test role creation'
    },
    
    // Event and Monitoring Commands
    {
        category: 'monitoring',
        command: 'show me admin events from today',
        expectedTools: ['list-admin-events'],
        description: 'Test admin event retrieval'
    },
    {
        category: 'monitoring',
        command: 'get system metrics and user statistics',
        expectedTools: ['get-metrics'],
        description: 'Test metrics retrieval'
    },
    
    // Complex Multi-step Commands
    {
        category: 'complex',
        command: 'create a user john@test.com then assign him to admin group',
        expectedTools: ['create-user', 'add-user-to-group'],
        description: 'Test multi-step workflow'
    }
];

/**
 * Makes an HTTP request to the AI Gateway
 */
function makeRequest(path, data = {}, method = 'POST') {
    return new Promise((resolve, reject) => {
        const postData = method === 'GET' ? '' : JSON.stringify(data);
        
        const options = {
            hostname: 'localhost',
            port: 8005,
            path: path,
            method: method,
            headers: method === 'GET' ? {} : {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        data: jsonResponse
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData,
                        parseError: e.message
                    });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (method !== 'GET' && postData) {
            req.write(postData);
        }
        req.end();
    });
}

/**
 * Test a single command against the AI Gateway
 */
async function testCommand(testCase) {
    console.log(`\n🧪 Testing: ${testCase.description}`);
    console.log(`   Command: "${testCase.command}"`);
    console.log(`   Expected Tools: ${testCase.expectedTools.join(', ')}`);
    
    const startTime = Date.now();
    
    try {
        const response = await makeRequest('/api/chat', {
            message: testCase.command,
            sessionId: TEST_SESSION_ID,
            context: {
                realm: 'master',
                preferredLanguage: 'en',
                priority: 'normal'
            }
        });
        
        const duration = Date.now() - startTime;
        
        if (response.statusCode === 200) {
            console.log(`   ✅ Success (${duration}ms)`);
            console.log(`   Response: ${response.data.response?.substring(0, 100)}...`);
            
            // Check if expected tools were mentioned or used
            const responseText = JSON.stringify(response.data).toLowerCase();
            const toolsFound = testCase.expectedTools.filter(tool => 
                responseText.includes(tool.replace('-', '')) || responseText.includes(tool)
            );
            
            if (toolsFound.length > 0) {
                console.log(`   🔧 Tools detected: ${toolsFound.join(', ')}`);
            }
            
            return {
                success: true,
                duration,
                toolsUsed: toolsFound,
                response: response.data
            };
            
        } else {
            console.log(`   ❌ Failed (${duration}ms) - Status: ${response.statusCode}`);
            console.log(`   Error: ${JSON.stringify(response.data, null, 2)}`);
            
            return {
                success: false,
                duration,
                error: response.data,
                statusCode: response.statusCode
            };
        }
        
    } catch (error) {
        console.log(`   💥 Request failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get available tools from the AI Gateway
 */
async function getAvailableTools() {
    console.log('🔍 Discovering available tools...');
    
    try {
        const response = await makeRequest('/api/tools', {}, 'GET');
        
        if (response.statusCode === 200) {
            const tools = response.data;
            console.log(`   ✅ Found ${Object.keys(tools).length} tool categories:`);
            
            Object.entries(tools).forEach(([server, serverTools]) => {
                if (Array.isArray(serverTools)) {
                    console.log(`     • ${server}: ${serverTools.length} tools`);
                }
            });
            
            return tools;
        } else {
            console.log(`   ❌ Failed to get tools: ${response.statusCode}`);
            return null;
        }
        
    } catch (error) {
        console.log(`   💥 Error getting tools: ${error.message}`);
        return null;
    }
}

/**
 * Check AI Gateway health
 */
async function checkHealth() {
    console.log('🏥 Checking AI Gateway health...');
    
    try {
        const req = https.request({
            hostname: 'localhost',
            port: 8005,
            path: '/health',
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('   ✅ AI Gateway is healthy');
                } else {
                    console.log(`   ❌ Health check failed: ${res.statusCode}`);
                }
            });
        });
        
        req.on('error', (err) => {
            console.log(`   💥 Health check error: ${err.message}`);
        });
        
        req.end();
        
    } catch (error) {
        console.log(`   💥 Health check failed: ${error.message}`);
    }
}

/**
 * Main test execution
 */
async function runTests() {
    console.log('🚀 IKAS AI Gateway Command Testing Started');
    console.log('==========================================');
    
    // Check health first
    await checkHealth();
    
    // Wait for health check to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get available tools
    const availableTools = await getAvailableTools();
    
    if (!availableTools) {
        console.log('❌ Cannot proceed without tool discovery. Check AI Gateway status.');
        process.exit(1);
    }
    
    // Wait before starting tests
    console.log('\n⏳ Starting command tests in 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Run all test commands
    const results = [];
    
    for (const testCase of TEST_COMMANDS) {
        const result = await testCommand(testCase);
        results.push({
            ...testCase,
            result
        });
        
        // Wait between tests to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Generate summary report
    console.log('\n📊 TEST SUMMARY REPORT');
    console.log('======================');
    
    const successful = results.filter(r => r.result.success);
    const failed = results.filter(r => !r.result.success);
    
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    
    if (failed.length > 0) {
        console.log('\n🔍 Failed Tests:');
        failed.forEach(test => {
            console.log(`   • ${test.description}`);
            if (test.result.error) {
                console.log(`     Error: ${JSON.stringify(test.result.error).substring(0, 100)}...`);
            }
        });
    }
    
    // Category breakdown
    const categories = {};
    results.forEach(test => {
        if (!categories[test.category]) categories[test.category] = { total: 0, success: 0 };
        categories[test.category].total++;
        if (test.result.success) categories[test.category].success++;
    });
    
    console.log('\n📈 Results by Category:');
    Object.entries(categories).forEach(([category, stats]) => {
        const percentage = Math.round((stats.success / stats.total) * 100);
        console.log(`   • ${category}: ${stats.success}/${stats.total} (${percentage}%)`);
    });
    
    // Save detailed results to file
    const reportData = {
        timestamp: new Date().toISOString(),
        sessionId: TEST_SESSION_ID,
        summary: {
            total: results.length,
            successful: successful.length,
            failed: failed.length,
            successRate: Math.round((successful.length / results.length) * 100)
        },
        availableTools,
        testResults: results
    };
    
    fs.writeFileSync('test-results.json', JSON.stringify(reportData, null, 2));
    console.log('\n💾 Detailed results saved to test-results.json');
    
    console.log('\n🎉 Testing completed!');
    
    // Exit with error code if there were failures
    process.exit(failed.length > 0 ? 1 : 0);
}

// Run the tests
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { runTests, testCommand, getAvailableTools };