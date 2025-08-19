import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8000),
  
  // MCP Service URLs
  KEYCLOAK_MCP_URL: z.string().url().default('http://localhost:8001'),
  NEO4J_MCP_URL: z.string().url().default('http://localhost:8002'),
  
  // Google Gemini API
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  
  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Health Check Configuration
  HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
  
  // Circuit Breaker Configuration
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT: z.coerce.number().default(30000),
  
  // Cache TTL Configuration (in seconds)
  CACHE_TTL_USER_DATA: z.coerce.number().default(300),
  CACHE_TTL_COMPLIANCE_RESULTS: z.coerce.number().default(1800),
  CACHE_TTL_GRAPH_ANALYSIS: z.coerce.number().default(3600),
  CACHE_TTL_SYSTEM_METRICS: z.coerce.number().default(60),
});

type Config = z.infer<typeof configSchema>;

let config: Config;

try {
  config = configSchema.parse(process.env);
} catch (error) {
  console.error('Invalid configuration:', error);
  process.exit(1);
}

export { config };