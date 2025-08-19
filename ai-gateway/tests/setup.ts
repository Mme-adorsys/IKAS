// Jest setup file
import { logger } from '../src/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-key-not-real';
process.env.KEYCLOAK_MCP_URL = 'http://localhost:8001';
process.env.NEO4J_MCP_URL = 'http://localhost:8002';

// Suppress logs during tests unless explicitly enabled
if (!process.env.TEST_VERBOSE) {
  logger.silent = true;
}

// Global test timeout
jest.setTimeout(30000);

// Mock external services by default
jest.mock('axios');

beforeEach(() => {
  jest.clearAllMocks();
});