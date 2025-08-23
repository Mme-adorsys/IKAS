import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8000),
  
  // MCP Service URLs
  KEYCLOAK_MCP_URL: z.string().url().default('http://localhost:8001'),
  NEO4J_MCP_URL: z.string().url().default('http://localhost:8002'),
  
  // LLM Provider Configuration
  LLM_PROVIDER: z.enum(['gemini', 'ollama', 'anthropic', 'openai']).default('gemini'),
  LLM_MODEL: z.string().optional(),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  LLM_MAX_TOKENS: z.coerce.number().min(1).max(200000).default(8192),
  LLM_TOP_P: z.coerce.number().min(0).max(1).default(0.95),
  LLM_TIMEOUT: z.coerce.number().default(30000),
  
  // Provider-specific API Keys (made optional with fallback logic)
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  
  // Ollama Configuration
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_KEEP_ALIVE: z.string().default('5m'),
  OLLAMA_NUM_PREDICT: z.coerce.number().default(8192),
  OLLAMA_STREAM: z.boolean().default(false),
  
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
  
  // Validate provider-specific requirements
  validateProviderConfig(config);
  
} catch (error) {
  console.error('Invalid configuration:', error);
  process.exit(1);
}

/**
 * Validate that the selected LLM provider has the required configuration
 */
function validateProviderConfig(config: Config): void {
  switch (config.LLM_PROVIDER) {
    case 'gemini':
      if (!config.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini');
      }
      break;
      
    case 'anthropic':
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');
      }
      break;
      
    case 'openai':
      if (!config.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
      }
      break;
      
    case 'ollama':
      // No API key required for Ollama, but validate base URL
      if (!config.OLLAMA_BASE_URL) {
        throw new Error('OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama');
      }
      break;
      
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${config.LLM_PROVIDER}`);
  }
}

/**
 * Get provider-specific model defaults
 */
export function getDefaultModel(provider: string): string {
  const modelDefaults: Record<string, string> = {
    'gemini': 'gemini-2.5-pro',
    'ollama': 'llama3',
    'anthropic': 'claude-3-opus-20240229',
    'openai': 'gpt-4-turbo'
  };
  
  return modelDefaults[provider] || 'default';
}

/**
 * Get the configured model for the current provider
 */
export function getConfiguredModel(): string {
  return config.LLM_MODEL || getDefaultModel(config.LLM_PROVIDER);
}

/**
 * Get provider-specific configuration object
 */
export function getProviderConfig() {
  return {
    provider: config.LLM_PROVIDER,
    model: getConfiguredModel(),
    temperature: config.LLM_TEMPERATURE,
    maxTokens: config.LLM_MAX_TOKENS,
    topP: config.LLM_TOP_P,
    timeout: config.LLM_TIMEOUT,
    apiKey: getApiKeyForProvider(config.LLM_PROVIDER),
    baseUrl: config.LLM_PROVIDER === 'ollama' ? config.OLLAMA_BASE_URL : undefined,
    ollamaOptions: config.LLM_PROVIDER === 'ollama' ? {
      keepAlive: config.OLLAMA_KEEP_ALIVE,
      numPredict: config.OLLAMA_NUM_PREDICT,
      stream: config.OLLAMA_STREAM
    } : undefined
  };
}

/**
 * Get API key for the specified provider
 */
function getApiKeyForProvider(provider: string): string | undefined {
  switch (provider) {
    case 'gemini':
      return config.GEMINI_API_KEY;
    case 'anthropic':
      return config.ANTHROPIC_API_KEY;
    case 'openai':
      return config.OPENAI_API_KEY;
    case 'ollama':
      return undefined; // No API key needed for Ollama
    default:
      return undefined;
  }
}

export { config };