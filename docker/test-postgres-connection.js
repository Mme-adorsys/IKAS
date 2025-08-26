#!/usr/bin/env node

/**
 * Test script to verify PostgreSQL connection compatibility with Neo4j ETL
 * This script tests the connection using the same JDBC driver approach
 */

const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'keycloak',
    user: 'keycloak',
    password: 'keycloak',
    // Force MD5 authentication
    ssl: false,
    // Connection timeout
    connectionTimeoutMillis: 5000,
    // Query timeout
    statement_timeout: 10000
  });

  try {
    console.log('🔄 Attempting to connect to PostgreSQL...');
    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL!');
    
    // Test a simple query
    const result = await client.query('SELECT version(), current_user, current_database()');
    console.log('📊 Query result:', result.rows[0]);
    
    // Test authentication method
    const authResult = await client.query(`
      SELECT 
        usename,
        client_addr,
        client_port,
        backend_start,
        state,
        application_name
      FROM pg_stat_activity 
      WHERE usename = 'keycloak'
    `);
    console.log('🔐 Active connections:', authResult.rows);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('🔍 Error details:', error);
    
    if (error.message.includes('authentication type 10')) {
      console.log('\n💡 This is the SCRAM-SHA-256 authentication error.');
      console.log('   The configuration changes should fix this.');
    }
  } finally {
    await client.end();
  }
}

// Run the test
testConnection().catch(console.error);
