import { z } from 'zod';
import { randomUUID } from 'crypto';

// Event Types für IKAS Real-time Communication
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

// Base Event Schema
const BaseEventSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(EventType),
  timestamp: z.string().datetime(),
  sessionId: z.string(),
  userId: z.string().optional(),
  realm: z.string().optional()
});

// User Events
export const UserEventSchema = BaseEventSchema.extend({
  type: z.enum([EventType.USER_CREATED, EventType.USER_UPDATED, EventType.USER_DELETED]),
  payload: z.object({
    user: z.object({
      id: z.string(),
      username: z.string(),
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      enabled: z.boolean(),
      realm: z.string()
    }),
    action: z.enum(['created', 'updated', 'deleted']),
    changes: z.record(z.any()).optional()
  })
});

// Graph Events
export const GraphEventSchema = BaseEventSchema.extend({
  type: z.enum([EventType.GRAPH_UPDATE, EventType.PATTERN_DETECTED]),
  payload: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      labels: z.array(z.string()),
      properties: z.record(z.any())
    })).optional(),
    relationships: z.array(z.object({
      id: z.string(),
      type: z.string(),
      startNode: z.string(),
      endNode: z.string(),
      properties: z.record(z.any())
    })).optional(),
    pattern: z.object({
      type: z.string(),
      confidence: z.number().min(0).max(1),
      description: z.string(),
      affected: z.array(z.string())
    }).optional()
  })
});

// Analysis Events
export const AnalysisEventSchema = BaseEventSchema.extend({
  type: z.enum([EventType.ANALYSIS_STARTED, EventType.ANALYSIS_PROGRESS, EventType.ANALYSIS_COMPLETED]),
  payload: z.object({
    analysisId: z.string(),
    analysisType: z.enum(['user_patterns', 'compliance_check', 'security_audit', 'usage_statistics']),
    progress: z.number().min(0).max(100).optional(),
    status: z.enum(['started', 'running', 'completed', 'failed']),
    result: z.any().optional(),
    error: z.string().optional(),
    estimatedTimeRemaining: z.number().optional()
  })
});

// Compliance Events
export const ComplianceEventSchema = BaseEventSchema.extend({
  type: z.enum([EventType.COMPLIANCE_CHECK, EventType.COMPLIANCE_ALERT, EventType.COMPLIANCE_REPORT]),
  payload: z.object({
    checkId: z.string(),
    severity: z.enum(['info', 'warning', 'error', 'critical']),
    rule: z.string(),
    description: z.string(),
    affected: z.array(z.object({
      type: z.enum(['user', 'role', 'realm']),
      id: z.string(),
      name: z.string()
    })),
    recommendation: z.string().optional(),
    autoFixAvailable: z.boolean().default(false)
  })
});

// Voice Command Events
export const VoiceEventSchema = BaseEventSchema.extend({
  type: z.enum([EventType.VOICE_COMMAND, EventType.VOICE_RESPONSE, EventType.VOICE_ERROR]),
  payload: z.object({
    command: z.string().optional(),
    transcript: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    language: z.string().default('de-DE'),
    response: z.string().optional(),
    error: z.string().optional(),
    executionTime: z.number().optional()
  })
});

// Connection Events
export const ConnectionEventSchema = BaseEventSchema.extend({
  type: z.enum([EventType.CONNECTION_STATUS, EventType.HEARTBEAT]),
  payload: z.object({
    status: z.enum(['connected', 'disconnected', 'reconnecting', 'error']),
    clientCount: z.number().optional(),
    uptime: z.number().optional(),
    services: z.record(z.object({
      status: z.enum(['healthy', 'unhealthy', 'unknown']),
      latency: z.number().optional(),
      lastChecked: z.string().datetime().optional()
    })).optional()
  })
});

// Union type for all events
export type IKASEvent = 
  | z.infer<typeof UserEventSchema>
  | z.infer<typeof GraphEventSchema>
  | z.infer<typeof AnalysisEventSchema>
  | z.infer<typeof ComplianceEventSchema>
  | z.infer<typeof VoiceEventSchema>
  | z.infer<typeof ConnectionEventSchema>;

// Event validation functions
export function validateEvent(event: any): IKASEvent {
  // Try to parse with each schema
  const schemas = [
    UserEventSchema,
    GraphEventSchema,
    AnalysisEventSchema,
    ComplianceEventSchema,
    VoiceEventSchema,
    ConnectionEventSchema
  ];

  for (const schema of schemas) {
    try {
      return schema.parse(event);
    } catch (error) {
      continue;
    }
  }

  throw new Error(`Invalid event format: ${JSON.stringify(event)}`);
}

// Event builder functions
export function createUserEvent(
  sessionId: string,
  action: 'created' | 'updated' | 'deleted',
  user: any,
  changes?: Record<string, any>
): z.infer<typeof UserEventSchema> {
  return {
    id: randomUUID(),
    type: action === 'created' ? EventType.USER_CREATED : 
          action === 'updated' ? EventType.USER_UPDATED : EventType.USER_DELETED,
    timestamp: new Date().toISOString(),
    sessionId,
    userId: user.id,
    realm: user.realm,
    payload: {
      user,
      action,
      changes
    }
  };
}

export function createAnalysisEvent(
  sessionId: string,
  analysisId: string,
  analysisType: 'user_patterns' | 'compliance_check' | 'security_audit' | 'usage_statistics',
  status: 'started' | 'running' | 'completed' | 'failed',
  progress?: number,
  result?: any,
  error?: string
): z.infer<typeof AnalysisEventSchema> {
  return {
    id: randomUUID(),
    type: status === 'started' ? EventType.ANALYSIS_STARTED :
          status === 'completed' || status === 'failed' ? EventType.ANALYSIS_COMPLETED :
          EventType.ANALYSIS_PROGRESS,
    timestamp: new Date().toISOString(),
    sessionId,
    payload: {
      analysisId,
      analysisType,
      progress,
      status,
      result,
      error
    }
  };
}

export function createVoiceEvent(
  sessionId: string,
  type: EventType.VOICE_COMMAND | EventType.VOICE_RESPONSE | EventType.VOICE_ERROR,
  payload: {
    command?: string;
    transcript?: string;
    confidence?: number;
    response?: string;
    error?: string;
    executionTime?: number;
  }
): z.infer<typeof VoiceEventSchema> {
  return {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    sessionId,
    payload: {
      language: 'de-DE',
      ...payload
    }
  };
}