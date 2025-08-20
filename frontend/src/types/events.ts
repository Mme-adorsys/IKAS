// IKAS Event Types - matching WebSocket server events
export enum EventType {
  // User Management Events
  USER_CREATED = 'user:created',
  USER_UPDATED = 'user:updated', 
  USER_DELETED = 'user:deleted',
  
  // Graph Analysis Events
  GRAPH_UPDATE = 'graph:update',
  ANALYSIS_STARTED = 'analysis:started',
  ANALYSIS_PROGRESS = 'analysis:progress',
  ANALYSIS_COMPLETED = 'analysis:completed',
  PATTERN_DETECTED = 'pattern:detected',
  
  // Compliance Events
  COMPLIANCE_CHECK = 'compliance:check',
  COMPLIANCE_ALERT = 'compliance:alert',
  COMPLIANCE_REPORT = 'compliance:report',
  
  // System Events
  CONNECTION_STATUS = 'connection:status',
  ERROR_OCCURRED = 'error:occurred',
  HEARTBEAT = 'heartbeat',
  
  // Voice Command Events
  VOICE_COMMAND = 'voice:command',
  VOICE_RESPONSE = 'voice:response',
  VOICE_ERROR = 'voice:error',
  
  // Session Events
  SESSION_STARTED = 'session:started',
  SESSION_ENDED = 'session:ended',
  SESSION_TIMEOUT = 'session:timeout'
}

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: string;
  sessionId: string;
  userId?: string;
  realm?: string;
}

export interface UserEvent extends BaseEvent {
  type: EventType.USER_CREATED | EventType.USER_UPDATED | EventType.USER_DELETED;
  payload: {
    user: {
      id: string;
      username: string;
      email: string;
      firstName?: string;
      lastName?: string;
      enabled: boolean;
      realm: string;
    };
    action: 'created' | 'updated' | 'deleted';
    changes?: Record<string, any>;
  };
}

export interface GraphEvent extends BaseEvent {
  type: EventType.GRAPH_UPDATE | EventType.PATTERN_DETECTED;
  payload: {
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
    pattern?: {
      type: string;
      confidence: number;
      description: string;
      affected: string[];
    };
  };
}

export interface AnalysisEvent extends BaseEvent {
  type: EventType.ANALYSIS_STARTED | EventType.ANALYSIS_PROGRESS | EventType.ANALYSIS_COMPLETED;
  payload: {
    analysisId: string;
    analysisType: 'user_patterns' | 'compliance_check' | 'security_audit' | 'usage_statistics';
    progress?: number;
    status: 'started' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
    estimatedTimeRemaining?: number;
  };
}

export interface ComplianceEvent extends BaseEvent {
  type: EventType.COMPLIANCE_CHECK | EventType.COMPLIANCE_ALERT | EventType.COMPLIANCE_REPORT;
  payload: {
    checkId: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    rule: string;
    description: string;
    affected: Array<{
      type: 'user' | 'role' | 'realm';
      id: string;
      name: string;
    }>;
    recommendation?: string;
    autoFixAvailable?: boolean;
  };
}

export interface VoiceEvent extends BaseEvent {
  type: EventType.VOICE_COMMAND | EventType.VOICE_RESPONSE | EventType.VOICE_ERROR;
  payload: {
    command?: string;
    transcript?: string;
    confidence?: number;
    language?: string;
    response?: string;
    error?: string;
    executionTime?: number;
  };
}

export interface ConnectionEvent extends BaseEvent {
  type: EventType.CONNECTION_STATUS | EventType.HEARTBEAT;
  payload: {
    status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
    clientCount?: number;
    uptime?: number;
    services?: Record<string, {
      status: 'healthy' | 'unhealthy' | 'unknown';
      latency?: number;
      lastChecked?: string;
    }>;
  };
}

export type IKASEvent = 
  | UserEvent
  | GraphEvent
  | AnalysisEvent
  | ComplianceEvent
  | VoiceEvent
  | ConnectionEvent;

// WebSocket message types
export interface SocketMessage {
  type: 'event' | 'connected' | 'error' | 'voiceCommandReceived' | 'subscriptionConfirmed';
  data?: any;
}

export interface VoiceCommand {
  command: string;
  transcript: string;
  confidence: number;
  language: string;
  timestamp: string;
}

export interface Subscription {
  eventTypes: EventType[];
  room?: string;
  filters?: {
    userId?: string;
    realm?: string;
  };
}