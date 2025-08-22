#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8001', 10);

// CORS configuration
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'keycloak-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Initialize Keycloak client
const kcAdminClient = new KcAdminClient({
  baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  realmName: 'master'
});

// Authentication helper
async function authenticate() {
  try {
    await kcAdminClient.auth({
      username: process.env.KEYCLOAK_ADMIN || 'admin',
      password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
      grantType: 'password',
      clientId: 'admin-cli'
    });
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

// Wrapper for authenticated requests
async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  await authenticate();
  return fn();
}

// MCP Tools as REST endpoints
app.get('/tools', (req, res) => {
  res.json({
    tools: [
      'create-user',
      'list-users', 
      'delete-user',
      'get-user',
      'list-realms',
      'list-admin-events',
      'get-event-details',
      'get-metrics'
    ]
  });
});

// Create user
app.post('/tools/create-user', async (req, res) => {
  try {
    const { realm = 'master', ...userData } = req.body;
    
    await withAuth(async () => {
      kcAdminClient.setConfig({ realmName: realm });
      const newUser = await kcAdminClient.users.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        enabled: userData.enabled !== false,
        emailVerified: userData.emailVerified || false,
        credentials: userData.password ? [{
          type: 'password',
          value: userData.password,
          temporary: true
        }] : undefined
      });
      
      res.json({
        success: true,
        userId: newUser.id,
        message: `User '${userData.username}' created successfully`
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List users
app.post('/tools/list-users', async (req, res) => {
  try {
    const { realm = 'master', max = 100, search } = req.body;
    
    const users = await withAuth(async () => {
      kcAdminClient.setConfig({ realmName: realm });
      return await kcAdminClient.users.find({
        max,
        search
      });
    });

    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: user.enabled,
        emailVerified: user.emailVerified,
        createdTimestamp: user.createdTimestamp
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete user
app.post('/tools/delete-user', async (req, res) => {
  try {
    const { realm = 'master', userId } = req.body;
    
    await withAuth(async () => {
      kcAdminClient.setConfig({ realmName: realm });
      await kcAdminClient.users.del({ id: userId });
    });
    
    res.json({
      success: true,
      message: `User ${userId} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user
app.post('/tools/get-user', async (req, res) => {
  try {
    const { realm = 'master', userId } = req.body;
    
    const user = await withAuth(async () => {
      kcAdminClient.setConfig({ realmName: realm });
      return await kcAdminClient.users.findOne({ id: userId });
    });
    
    res.json({
      success: true,
      user: user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: user.enabled,
        emailVerified: user.emailVerified,
        createdTimestamp: user.createdTimestamp
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List realms
app.post('/tools/list-realms', async (req, res) => {
  try {
    const realms = await withAuth(async () => {
      return await kcAdminClient.realms.find();
    });
    
    res.json({
      success: true,
      count: realms.length,
      realms: realms.map(realm => ({
        id: realm.id,
        realm: realm.realm,
        displayName: realm.displayName,
        enabled: realm.enabled
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List admin events (simplified)
app.post('/tools/list-admin-events', async (req, res) => {
  res.json({
    success: true,
    count: 0,
    events: [],
    message: "Admin events API not implemented in this version"
  });
});

// Get event details (simplified)
app.post('/tools/get-event-details', async (req, res) => {
  const { eventId } = req.body;
  res.json({
    success: true,
    message: "Event details not implemented in this version",
    eventId
  });
});

// Get metrics
app.post('/tools/get-metrics', async (req, res) => {
  try {
    const { realm = 'master' } = req.body;
    
    const metrics = await withAuth(async () => {
      kcAdminClient.setConfig({ realmName: realm });
      const allUsers = await kcAdminClient.users.count();
      const allRealms = await kcAdminClient.realms.find();
      
      return {
        totalUsers: allUsers,
        totalRealms: allRealms.length,
        timestamp: new Date().toISOString(),
        realm
      };
    });
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'keycloak-mcp-server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      tools: '/tools',
      toolsCount: 8
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Keycloak MCP Server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Tools endpoint: http://localhost:${PORT}/tools`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});