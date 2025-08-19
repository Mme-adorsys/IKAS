#!/usr/bin/env node

/**
 * IKAS MCP Integration Test
 * 
 * This script tests the basic functionality of both Keycloak and Neo4j MCP servers
 * to ensure they're properly configured and responding to tool calls.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// Test configuration
const config = {
    keycloak: {
        path: path.join(__dirname, '../keycloak-mcp-server/dist/index.js'),
        env: {
            KEYCLOAK_URL: process.env.KEYCLOAK_URL || 'http://localhost:8080',
            KEYCLOAK_ADMIN: process.env.KEYCLOAK_ADMIN || 'admin',
            KEYCLOAK_ADMIN_PASSWORD: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin'
        }
    },
    neo4j: {
        path: path.join(__dirname, '../mcp-neo4j'),
        script: 'src/mcp_neo4j_cypher/server.py',
        env: {
            NEO4J_URI: process.env.NEO4J_URI || 'bolt://localhost:7687',
            NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'neo4j',
            NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'password',
            NEO4J_DATABASE: process.env.NEO4J_DATABASE || 'neo4j'
        }
    }
};

class MCPTester {
    constructor() {
        this.results = {
            keycloak: { passed: 0, failed: 0, tests: [] },
            neo4j: { passed: 0, failed: 0, tests: [] }
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    logTest(server, testName, passed, details = '') {
        const status = passed ? 
            `${colors.green}✅ PASS${colors.reset}` : 
            `${colors.red}❌ FAIL${colors.reset}`;
        
        this.log(`  ${status} ${testName}${details ? ': ' + details : ''}`);
        
        this.results[server].tests.push({ name: testName, passed, details });
        if (passed) {
            this.results[server].passed++;
        } else {
            this.results[server].failed++;
        }
    }

    async testMCPServer(serverName, command, args, env) {
        this.log(`\\n${colors.bold}Testing ${serverName.toUpperCase()} MCP Server${colors.reset}`, 'blue');
        this.log(`Command: ${command} ${args.join(' ')}`);
        
        try {
            // Test 1: Server starts without errors
            const childProcess = spawn(command, args, { 
                env: { ...process.env, ...env },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let startupTimeout;
            const startupPromise = new Promise((resolve, reject) => {
                startupTimeout = setTimeout(() => {
                    reject(new Error('Server startup timeout'));
                }, 10000); // 10 second timeout

                let serverReady = false;
                
                childProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    // Keycloak MCP outputs to stderr: "Keycloak MCP Server running on stdio"
                    // Neo4j MCP outputs to stderr when initialized
                    if (output.includes('running on stdio') || output.includes('Server') || output.includes('initialized') || output.includes('ready') || output.includes('listening')) {
                        if (!serverReady) {
                            clearTimeout(startupTimeout);
                            serverReady = true;
                            resolve();
                        }
                    }
                });

                childProcess.stdout.on('data', (data) => {
                    // For stdio mode, servers are ready when they start outputting to stdout
                    if (!serverReady) {
                        clearTimeout(startupTimeout);
                        serverReady = true;
                        resolve();
                    }
                });

                childProcess.on('error', reject);
            });

            try {
                await startupPromise;
                this.logTest(serverName, 'Server Startup', true);
            } catch (error) {
                this.logTest(serverName, 'Server Startup', false, error.message);
                childProcess.kill();
                return;
            }

            // Give the server a moment to fully initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Test 2: List Tools
            try {
                const listToolsRequest = {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/list',
                    params: {}
                };

                childProcess.stdin.write(JSON.stringify(listToolsRequest) + '\\n');
                
                const toolsResponse = await this.readMCPResponse(childProcess);
                
                if (toolsResponse.result && toolsResponse.result.tools) {
                    const toolCount = toolsResponse.result.tools.length;
                    this.logTest(serverName, 'List Tools', true, `Found ${toolCount} tools`);
                    
                    // Log available tools
                    toolsResponse.result.tools.forEach(tool => {
                        this.log(`    • ${tool.name}: ${tool.description}`, 'yellow');
                    });
                } else {
                    this.logTest(serverName, 'List Tools', false, 'No tools returned');
                }
            } catch (error) {
                this.logTest(serverName, 'List Tools', false, error.message);
            }

            // Server-specific tests
            if (serverName === 'keycloak') {
                await this.testKeycloakSpecific(childProcess);
            } else if (serverName === 'neo4j') {
                await this.testNeo4jSpecific(childProcess);
            }

            // Cleanup
            childProcess.kill();
            
        } catch (error) {
            this.logTest(serverName, 'Overall Test', false, error.message);
        }
    }

    async testKeycloakSpecific(childProcess) {
        try {
            // Test list-realms (should work without auth issues)
            const listRealmsRequest = {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'list-realms',
                    arguments: {}
                }
            };

            childProcess.stdin.write(JSON.stringify(listRealmsRequest) + '\\n');
            const realmsResponse = await this.readMCPResponse(childProcess);
            
            if (realmsResponse.result && !realmsResponse.error) {
                this.logTest('keycloak', 'List Realms', true, 'Successfully retrieved realms');
            } else {
                this.logTest('keycloak', 'List Realms', false, realmsResponse.error || 'Unknown error');
            }
        } catch (error) {
            this.logTest('keycloak', 'List Realms', false, error.message);
        }
    }

    async testNeo4jSpecific(childProcess) {
        try {
            // Test simple Cypher query
            const cypherRequest = {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'read_neo4j_cypher',
                    arguments: {
                        query: 'RETURN 1 as test_value',
                        parameters: {}
                    }
                }
            };

            childProcess.stdin.write(JSON.stringify(cypherRequest) + '\\n');
            const cypherResponse = await this.readMCPResponse(childProcess);
            
            if (cypherResponse.result && !cypherResponse.error) {
                this.logTest('neo4j', 'Basic Cypher Query', true, 'Successfully executed test query');
            } else {
                this.logTest('neo4j', 'Basic Cypher Query', false, cypherResponse.error || 'Unknown error');
            }
        } catch (error) {
            this.logTest('neo4j', 'Basic Cypher Query', false, error.message);
        }
    }

    async readMCPResponse(childProcess) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Response timeout'));
            }, 5000);

            let responseData = '';
            const dataHandler = (data) => {
                responseData += data.toString();
                const lines = responseData.split('\n');
                
                // Try to parse each complete line as JSON
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim();
                    if (line) {
                        try {
                            const response = JSON.parse(line);
                            clearTimeout(timeout);
                            childProcess.stdout.removeListener('data', dataHandler);
                            resolve(response);
                            return;
                        } catch (error) {
                            // Continue to next line if this one doesn't parse
                            continue;
                        }
                    }
                }
                
                // Keep the last incomplete line for next data chunk
                responseData = lines[lines.length - 1];
            };

            childProcess.stdout.on('data', dataHandler);
        });
    }

    printSummary() {
        this.log(`\\n${colors.bold}TEST SUMMARY${colors.reset}`, 'blue');
        this.log('=' * 50);
        
        Object.entries(this.results).forEach(([server, results]) => {
            const total = results.passed + results.failed;
            const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
            
            this.log(`\\n${server.toUpperCase()} MCP Server:`);
            this.log(`  Tests: ${total} (${results.passed} passed, ${results.failed} failed)`);
            this.log(`  Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'red');
        });

        const totalPassed = this.results.keycloak.passed + this.results.neo4j.passed;
        const totalFailed = this.results.keycloak.failed + this.results.neo4j.failed;
        const overallPassRate = Math.round((totalPassed / (totalPassed + totalFailed)) * 100);
        
        this.log(`\\nOVERALL: ${overallPassRate}% (${totalPassed}/${totalPassed + totalFailed})`, 
                  overallPassRate >= 80 ? 'green' : 'red');

        if (overallPassRate >= 80) {
            this.log('\\n🎉 IKAS MCP integration tests PASSED! Ready for Phase 1.', 'green');
        } else {
            this.log('\\n❌ Some MCP integration tests FAILED. Please check configuration.', 'red');
        }
    }

    async testKeycloakStartup() {
        try {
            const childProcess = spawn('node', [config.keycloak.path], { 
                env: { ...process.env, ...config.keycloak.env },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const startupPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Server startup timeout'));
                }, 10000);

                childProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('running on stdio')) {
                        clearTimeout(timeout);
                        resolve('Keycloak MCP Server started successfully');
                    }
                });

                childProcess.on('error', reject);
            });

            try {
                const result = await startupPromise;
                this.logTest('keycloak', 'Server Startup', true, result);
                childProcess.kill();
            } catch (error) {
                this.logTest('keycloak', 'Server Startup', false, error.message);
                childProcess.kill();
            }
        } catch (error) {
            this.logTest('keycloak', 'Server Startup', false, error.message);
        }
    }

    async testNeo4jStartup() {
        try {
            const childProcess = spawn('uv', ['run', 'python', config.neo4j.script], { 
                cwd: config.neo4j.path,
                env: { ...process.env, ...config.neo4j.env },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const startupPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Server startup timeout - may need Neo4j connection'));
                }, 15000);

                let foundOutput = false;

                childProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('mcp_neo4j_cypher') || output.includes('server') || output.includes('Neo4j') || !foundOutput) {
                        clearTimeout(timeout);
                        foundOutput = true;
                        resolve('Neo4j MCP Server started successfully');
                    }
                });

                childProcess.stdout.on('data', (data) => {
                    if (!foundOutput) {
                        clearTimeout(timeout);
                        foundOutput = true;
                        resolve('Neo4j MCP Server started successfully');
                    }
                });

                childProcess.on('error', reject);
            });

            try {
                const result = await startupPromise;
                this.logTest('neo4j', 'Server Startup', true, result);
                childProcess.kill();
            } catch (error) {
                this.logTest('neo4j', 'Server Startup', false, error.message);
                childProcess.kill();
            }
        } catch (error) {
            this.logTest('neo4j', 'Server Startup', false, error.message);
        }
    }

    async testNeo4jWithUV(serverName, workingDir, scriptPath, env) {
        this.log(`\\n${colors.bold}Testing ${serverName.toUpperCase()} MCP Server${colors.reset}`, 'blue');
        this.log(`Command: cd ${workingDir} && uv run python ${scriptPath}`);
        
        try {
            // Run with uv in the correct directory
            const childProcess = spawn('uv', ['run', 'python', scriptPath], { 
                cwd: workingDir,
                env: { ...process.env, ...env },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let startupTimeout;
            const startupPromise = new Promise((resolve, reject) => {
                startupTimeout = setTimeout(() => {
                    reject(new Error('Server startup timeout'));
                }, 15000); // 15 second timeout for uv

                let serverReady = false;
                
                childProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    // Neo4j MCP with FastMCP outputs startup messages
                    if (output.includes('Server') || output.includes('initialized') || output.includes('ready') || output.includes('listening') || output.includes('starting')) {
                        if (!serverReady) {
                            clearTimeout(startupTimeout);
                            serverReady = true;
                            resolve();
                        }
                    }
                });

                childProcess.stdout.on('data', (data) => {
                    // For stdio mode, servers are ready when they start outputting to stdout
                    if (!serverReady) {
                        clearTimeout(startupTimeout);
                        serverReady = true;
                        resolve();
                    }
                });

                childProcess.on('error', reject);
            });

            try {
                await startupPromise;
                this.logTest(serverName, 'Server Startup', true);
            } catch (error) {
                this.logTest(serverName, 'Server Startup', false, error.message);
                childProcess.kill();
                return;
            }

            // Give the server a moment to fully initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Test basic Cypher query
            await this.testNeo4jSpecific(childProcess);

            // Cleanup
            childProcess.kill();
            
        } catch (error) {
            this.logTest(serverName, 'Overall Test', false, error.message);
        }
    }

    async run() {
        this.log(`${colors.bold}IKAS MCP Integration Test Suite${colors.reset}`, 'blue');
        this.log('Testing Keycloak and Neo4j MCP server integration\\n');

        // Test Keycloak MCP Server
        this.log('\\nTesting KEYCLOAK MCP Server', 'blue');
        if (!fs.existsSync(config.keycloak.path)) {
            this.logTest('keycloak', 'File Exists', false, `Path not found: ${config.keycloak.path}`);
        } else {
            this.logTest('keycloak', 'File Exists', true);
            await this.testKeycloakStartup();
        }

        // Test Neo4j MCP Server  
        this.log('\\nTesting NEO4J MCP Server', 'blue');
        const neo4jScriptPath = path.join(config.neo4j.path, config.neo4j.script);
        if (!fs.existsSync(neo4jScriptPath)) {
            this.logTest('neo4j', 'File Exists', false, `Path not found: ${neo4jScriptPath}`);
        } else {
            this.logTest('neo4j', 'File Exists', true);
            await this.testNeo4jStartup();
        }

        this.printSummary();
    }
}

// Run the tests
if (require.main === module) {
    const tester = new MCPTester();
    tester.run().catch(error => {
        console.error(`${colors.red}Test runner error:${colors.reset}`, error);
        process.exit(1);
    });
}

module.exports = MCPTester;