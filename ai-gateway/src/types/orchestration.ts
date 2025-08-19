import { MCPToolCall, MCPResponse } from './mcp';

export enum ExecutionStrategy {
  KEYCLOAK_FRESH_DATA = 'keycloak_fresh_data',
  NEO4J_ANALYSIS_ONLY = 'neo4j_analysis_only', 
  SYNC_THEN_ANALYZE = 'sync_then_analyze',
  KEYCLOAK_WRITE_THEN_SYNC = 'keycloak_write_then_sync',
  COORDINATED_MULTI_MCP = 'coordinated_multi_mcp'
}

export interface OrchestrationRequest {
  userInput: string;
  sessionId: string;
  strategy?: ExecutionStrategy;
  context?: OrchestrationContext;
}

export interface OrchestrationContext {
  realm?: string;
  userId?: string;
  preferredLanguage?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface OrchestrationResponse {
  success: boolean;
  response: string;
  data?: any;
  toolsCalled: MCPToolCall[];
  duration: number;
  strategy: ExecutionStrategy;
  error?: string;
}

export interface SyncResult {
  success?: boolean;
  skipped?: boolean;
  recordsSynced?: number;
  reason?: string;
  error?: string;
}

export interface FreshnessCheck {
  needsRefresh: boolean;
  lastSync?: string;
  ageMinutes?: number;
  reason?: string;
}

export interface RoutingPattern {
  freshDataKeywords: string[];
  analysisKeywords: string[];
  writeKeywords: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  expectedExceptions: (new (...args: any[]) => Error)[];
}

export interface CacheConfig {
  user_data: number;
  compliance_results: number;
  graph_analysis: number;
  system_metrics: number;
}