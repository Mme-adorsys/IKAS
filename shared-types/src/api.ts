/**
 * API Types and Interfaces
 * Defines REST API request/response structures and WebSocket events
 */

// Generic API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}

// Health Check Response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Array<{
    name: string;
    status: 'healthy' | 'unhealthy';
    details?: any;
    responseTime?: number;
  }>;
  uptime: number;
  version: string;
}

// WebSocket Event Types
export enum WebSocketEventType {
  // Voice events
  VOICE_COMMAND = 'voice_command',
  COMMAND_RESPONSE = 'command_response',
  
  // Graph events
  GRAPH_UPDATE = 'graph_update',
  GRAPH_ANALYSIS_COMPLETE = 'graph_analysis_complete',
  
  // System events
  SYSTEM_STATUS = 'system_status',
  HEALTH_CHECK = 'health_check',
  
  // Compliance events
  COMPLIANCE_ALERT = 'compliance_alert',
  COMPLIANCE_REPORT_READY = 'compliance_report_ready',
  
  // User events
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  
  // Session events
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended'
}

export interface WebSocketEvent<T = any> {
  type: WebSocketEventType;
  data: T;
  timestamp: string;
  sessionId: string;
  userId?: string;
}

// Specific WebSocket event payloads
export interface VoiceCommandEvent {
  text: string;
  confidence: number;
  language: string;
  context?: Record<string, any>;
}

export interface CommandResponseEvent {
  message: string;
  data?: any;
  speak: boolean;
  graphUpdate?: boolean;
  duration: number;
}

export interface GraphUpdateEvent {
  nodes: Array<{
    id: string;
    action: 'added' | 'updated' | 'removed';
    data?: any;
  }>;
  relationships: Array<{
    id: string;
    action: 'added' | 'updated' | 'removed';
    data?: any;
  }>;
  analysisResult?: any;
}

// REST API Endpoints
export interface ProcessVoiceCommandRequest {
  text: string;
  context: {
    sessionId: string;
    userId?: string;
    realm?: string;
    language?: string;
  };
  options?: {
    skipCache?: boolean;
    forceSync?: boolean;
  };
}

export interface AnalyzeComplianceRequest {
  realm: string;
  ruleIds?: string[];
  generateReport?: boolean;
}

export interface SyncDataRequest {
  realm: string;
  force?: boolean;
  includeRoles?: boolean;
  includeGroups?: boolean;
}

export interface SearchUsersRequest {
  realm: string;
  query?: string;
  filters?: {
    enabled?: boolean;
    emailVerified?: boolean;
    hasRoles?: string[];
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

// Dashboard API Types
export interface DashboardMetrics {
  userStats: {
    total: number;
    active: number;
    inactive: number;
    newToday: number;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastSync: string;
  };
  complianceScore: number;
  recentActivities: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    user?: string;
  }>;
}