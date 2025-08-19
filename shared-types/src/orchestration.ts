/**
 * AI Orchestration Types
 * Defines interfaces for LLM orchestration and intelligent routing
 */

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
  context: {
    userId?: string;
    realm?: string;
    language?: string;
    timestamp: string;
  };
  strategy?: ExecutionStrategy;
}

export interface OrchestrationResponse {
  success: boolean;
  message: string;
  data?: any;
  strategy: ExecutionStrategy;
  toolsCalled: MCPToolCall[];
  duration: number;
  error?: string;
  speak?: boolean; // Whether to use TTS for response
  graphUpdate?: OrchestrationGraphUpdate;
}

export interface DataFreshnessCheck {
  needs_refresh: boolean;
  age_minutes?: number;
  last_updated?: string;
  record_count?: number;
  reason?: string;
}

export interface SyncResult {
  success: boolean;
  records_synced?: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
  duration?: number;
}

export interface LLMToolMapping {
  originalName: string;
  enhancedName: string;
  description: string;
  source: 'keycloak' | 'neo4j';
  inputSchema: any;
  contextHints: string[];
}

export interface IntentAnalysis {
  intent: 'fresh_data' | 'analysis' | 'write_operation' | 'general_query';
  confidence: number;
  keywords: string[];
  entities: {
    realm?: string;
    username?: string;
    email?: string;
  };
}

export interface OrchestrationGraphUpdate {
  type: 'nodes_updated' | 'relationships_updated' | 'schema_changed';
  nodes?: Array<{
    id: string;
    labels: string[];
    properties: Record<string, any>;
  }>;
  relationships?: Array<{
    id: string;
    type: string;
    startNode: string;
    endNode: string;
    properties: Record<string, any>;
  }>;
}