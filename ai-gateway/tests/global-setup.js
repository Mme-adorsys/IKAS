const path = require('path');
const fs = require('fs');

module.exports = async () => {
  console.log('🔧 Global Test Setup - Loading test environment...');
  
  // Load test environment variables
  const envTestPath = path.join(__dirname, '..', '.env.test');
  if (fs.existsSync(envTestPath)) {
    require('dotenv').config({ path: envTestPath });
    console.log('✅ Test environment loaded from .env.test');
  } else {
    console.log('⚠️  No .env.test found, using default environment');
  }
  
  // Set test-specific environment variables
  process.env.NODE_ENV = 'test';
  process.env.KEYCLOAK_MCP_URL = process.env.KEYCLOAK_MCP_URL || 'http://localhost:8001';
  process.env.NEO4J_MCP_URL = process.env.NEO4J_MCP_URL || 'http://localhost:8002';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
  
  console.log('🎯 Test environment configured:');
  console.log(`   • Keycloak MCP: ${process.env.KEYCLOAK_MCP_URL}`);
  console.log(`   • Neo4j MCP:    ${process.env.NEO4J_MCP_URL}`);
  console.log(`   • Redis:        ${process.env.REDIS_URL}`);
};