# IKAS Frontend API Reference

Complete reference for WebSocket events, REST endpoints, and service integrations used by the IKAS Frontend.

## 🔌 WebSocket API

### Connection Details

**Endpoint:** `ws://localhost:3001` (development) / `wss://your-domain.com` (production)  
**Transport:** Socket.io with fallback to long-polling  
**Authentication:** Session-based with realm/user identification

### Connection Flow

```typescript
// 1. Initialize connection
const socket = io('ws://localhost:3001', {
  transports: ['websocket', 'polling'],
  timeout: 10000,
  reconnectionAttempts: 5
});

// 2. Authenticate and join room
socket.emit('authenticate', {
  userId: 'dashboard-user',
  realm: 'master',
  sessionId: 'unique-session-id'
});

// 3. Subscribe to events
socket.emit('subscribe', {
  eventTypes: ['voice:command', 'user:created', 'analysis:progress'],
  room: 'master',
  filters: { userId: 'dashboard-user' }
});
```

## 📨 WebSocket Events

### Event Categories

1. **Voice Events** - Voice command processing
2. **User Events** - User management operations
3. **Analysis Events** - Background analysis operations
4. **Compliance Events** - Security and compliance monitoring
5. **Graph Events** - Neo4j graph data updates
6. **System Events** - Connection, health, and error management
7. **Session Events** - User session management

---

## 🎤 Voice Events

### voice:command
**Direction:** Client → Server  
**Description:** Send voice command for processing

```typescript
interface VoiceCommandEvent {
  type: 'voice:command';
  data: {
    command: string;         // Raw voice command text
    transcript: string;      // Full transcript from speech recognition
    confidence: number;      // Recognition confidence (0-1)
    language: 'de-DE';      // Language code
    timestamp: string;       // ISO timestamp
    sessionId: string;       // User session identifier
  };
}

// Example
socket.emit('voice:command', {
  command: "zeige alle Benutzer",
  transcript: "zeige alle Benutzer",
  confidence: 0.95,
  language: "de-DE",
  timestamp: "2024-12-21T10:30:00.000Z",
  sessionId: "sess_123456"
});
```

### voice:response
**Direction:** Server → Client  
**Description:** Response to voice command

```typescript
interface VoiceResponseEvent {
  type: 'voice:response';
  data: {
    originalCommand: string;    // Original voice command
    response: string;           // Text response for TTS
    success: boolean;           // Command execution status
    executionTime: number;      // Processing time in milliseconds
    data?: any;                // Command result data
    error?: string;            // Error message if failed
    suggestions?: string[];     // Alternative commands
  };
}

// Example - Successful user list command
{
  "type": "voice:response",
  "data": {
    "originalCommand": "zeige alle Benutzer",
    "response": "Es wurden 23 Benutzer gefunden. Die Liste wird jetzt angezeigt.",
    "success": true,
    "executionTime": 1250,
    "data": {
      "users": [...], // User array
      "totalCount": 23,
      "realm": "master"
    }
  }
}
```

### voice:error
**Direction:** Server → Client  
**Description:** Voice command processing error

```typescript
interface VoiceErrorEvent {
  type: 'voice:error';
  data: {
    originalCommand?: string;
    error: string;
    errorCode: 'RECOGNITION_FAILED' | 'PROCESSING_ERROR' | 'INVALID_COMMAND' | 'PERMISSION_DENIED';
    details?: string;
    timestamp: string;
  };
}
```

---

## 👥 User Events

### user:created
**Direction:** Server → Client  
**Description:** New user has been created

```typescript
interface UserCreatedEvent {
  type: 'user:created';
  data: {
    user: {
      id: string;
      username: string;
      email: string;
      firstName?: string;
      lastName?: string;
      enabled: boolean;
      realm: string;
      createdTimestamp: number;
      attributes?: Record<string, string[]>;
    };
    createdBy: string;        // Admin who created the user
    timestamp: string;
  };
}
```

### user:updated
**Direction:** Server → Client  
**Description:** User has been modified

```typescript
interface UserUpdatedEvent {
  type: 'user:updated';
  data: {
    user: KeycloakUser;       // Updated user object
    changes: {                // What changed
      [field: string]: {
        oldValue: any;
        newValue: any;
      };
    };
    updatedBy: string;
    timestamp: string;
  };
}
```

### user:deleted
**Direction:** Server → Client  
**Description:** User has been deleted

```typescript
interface UserDeletedEvent {
  type: 'user:deleted';
  data: {
    userId: string;
    username: string;
    realm: string;
    deletedBy: string;
    timestamp: string;
  };
}
```

---

## 📊 Analysis Events

### analysis:started
**Direction:** Server → Client  
**Description:** Background analysis has started

```typescript
interface AnalysisStartedEvent {
  type: 'analysis:started';
  data: {
    analysisId: string;
    analysisType: 'user_patterns' | 'compliance_check' | 'security_audit' | 'usage_statistics';
    estimatedDuration: number;     // Estimated time in milliseconds
    parameters: Record<string, any>; // Analysis parameters
    startedBy: string;
    timestamp: string;
  };
}
```

### analysis:progress
**Direction:** Server → Client  
**Description:** Analysis progress update

```typescript
interface AnalysisProgressEvent {
  type: 'analysis:progress';
  data: {
    analysisId: string;
    progress: number;               // Progress percentage (0-100)
    currentStep: string;           // Current processing step
    estimatedTimeRemaining: number; // Milliseconds remaining
    intermediateResults?: any;      // Partial results if available
    timestamp: string;
  };
}
```

### analysis:completed
**Direction:** Server → Client  
**Description:** Analysis has finished

```typescript
interface AnalysisCompletedEvent {
  type: 'analysis:completed';
  data: {
    analysisId: string;
    success: boolean;
    duration: number;              // Actual processing time
    result: {
      summary: string;
      data: any;                   // Analysis results
      recommendations?: string[];
      charts?: ChartData[];
      exportUrl?: string;
    };
    error?: string;
    timestamp: string;
  };
}
```

---

## ✅ Compliance Events

### compliance:check
**Direction:** Server → Client  
**Description:** Compliance check initiated or completed

```typescript
interface ComplianceCheckEvent {
  type: 'compliance:check';
  data: {
    checkId: string;
    realm: string;
    checkType: 'password_policy' | 'user_permissions' | 'session_management' | 'audit_trail';
    status: 'started' | 'completed' | 'failed';
    result?: {
      passed: boolean;
      score: number;              // Compliance score (0-100)
      issues: ComplianceIssue[];
      recommendations: string[];
    };
    timestamp: string;
  };
}
```

### compliance:alert
**Direction:** Server → Client  
**Description:** Compliance violation detected

```typescript
interface ComplianceAlertEvent {
  type: 'compliance:alert';
  data: {
    alertId: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    rule: string;                 // Compliance rule that was violated
    description: string;
    affected: Array<{
      type: 'user' | 'role' | 'realm' | 'client';
      id: string;
      name: string;
    }>;
    recommendation?: string;
    autoFixAvailable: boolean;
    timestamp: string;
  };
}
```

### compliance:report
**Direction:** Server → Client  
**Description:** Compliance report generated

```typescript
interface ComplianceReportEvent {
  type: 'compliance:report';
  data: {
    reportId: string;
    reportType: 'daily' | 'weekly' | 'monthly' | 'on_demand';
    realm: string;
    period: {
      start: string;
      end: string;
    };
    summary: {
      totalChecks: number;
      passed: number;
      failed: number;
      overallScore: number;
    };
    downloadUrl: string;
    timestamp: string;
  };
}
```

---

## 🌐 Graph Events

### graph:update
**Direction:** Server → Client  
**Description:** Neo4j graph data has been updated

```typescript
interface GraphUpdateEvent {
  type: 'graph:update';
  data: {
    updateType: 'nodes_added' | 'relationships_added' | 'properties_updated' | 'full_refresh';
    realm: string;
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
    stats: {
      nodesAffected: number;
      relationshipsAffected: number;
    };
    timestamp: string;
  };
}
```

### pattern:detected
**Direction:** Server → Client  
**Description:** Pattern detected in graph analysis

```typescript
interface PatternDetectedEvent {
  type: 'pattern:detected';
  data: {
    patternId: string;
    patternType: 'duplicate_users' | 'permission_anomaly' | 'access_pattern' | 'security_risk';
    confidence: number;           // Pattern confidence (0-1)
    description: string;
    affectedNodes: string[];     // Node IDs involved in pattern
    recommendation?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
  };
}
```

---

## 🔧 System Events

### connection:status
**Direction:** Server → Client  
**Description:** Connection or service status change

```typescript
interface ConnectionStatusEvent {
  type: 'connection:status';
  data: {
    status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
    clientCount: number;
    uptime: number;              // Server uptime in milliseconds
    services: {
      keycloak: ServiceStatus;
      neo4j: ServiceStatus;
      redis: ServiceStatus;
      aiGateway: ServiceStatus;
    };
    timestamp: string;
  };
}

interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;             // Response time in milliseconds
  lastChecked: string;
  error?: string;
}
```

### error:occurred
**Direction:** Server → Client  
**Description:** System error notification

```typescript
interface ErrorEvent {
  type: 'error:occurred';
  data: {
    errorId: string;
    errorType: 'connection_error' | 'processing_error' | 'validation_error' | 'system_error';
    message: string;
    details?: string;
    stack?: string;              // Stack trace (development only)
    userId?: string;
    sessionId?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
  };
}
```

### heartbeat
**Direction:** Server → Client  
**Description:** Regular heartbeat for connection monitoring

```typescript
interface HeartbeatEvent {
  type: 'heartbeat';
  data: {
    serverTime: string;
    clientCount: number;
    memoryUsage?: {
      used: number;
      total: number;
    };
    timestamp: string;
  };
}
```

---

## 👤 Session Events

### session:started
**Direction:** Server → Client  
**Description:** User session initiated

```typescript
interface SessionStartedEvent {
  type: 'session:started';
  data: {
    sessionId: string;
    userId: string;
    realm: string;
    ipAddress: string;
    userAgent: string;
    timestamp: string;
  };
}
```

### session:ended
**Direction:** Server → Client  
**Description:** User session terminated

```typescript
interface SessionEndedEvent {
  type: 'session:ended';
  data: {
    sessionId: string;
    userId: string;
    reason: 'logout' | 'timeout' | 'admin_action' | 'system_shutdown';
    duration: number;            // Session duration in milliseconds
    timestamp: string;
  };
}
```

---

## 🎯 Client-to-Server Commands

### subscribe
**Description:** Subscribe to specific event types

```typescript
socket.emit('subscribe', {
  eventTypes: EventType[];      // Array of event types to subscribe to
  room?: string;               // Optional room filter (realm name)
  filters?: {                  // Optional event filters
    userId?: string;
    severity?: string;
    analysisType?: string;
  };
});
```

### unsubscribe
**Description:** Unsubscribe from events

```typescript
socket.emit('unsubscribe', {
  eventTypes?: EventType[];    // Specific types, or all if omitted
  room?: string;               // Room to unsubscribe from
});
```

### authenticate
**Description:** Authenticate connection

```typescript
socket.emit('authenticate', {
  userId: string;              // User identifier
  realm: string;               // Keycloak realm
  sessionId: string;           // Session identifier
  token?: string;              // Optional authentication token
});
```

### ping
**Description:** Manual connection test

```typescript
socket.emit('ping', {
  timestamp: Date.now()
});

// Response
socket.on('pong', (data) => {
  const latency = Date.now() - data.timestamp;
});
```

---

## 🔄 Event Subscription Patterns

### Complete Dashboard Subscription

```typescript
const dashboardSubscription = {
  eventTypes: [
    EventType.VOICE_COMMAND,
    EventType.VOICE_RESPONSE,
    EventType.USER_CREATED,
    EventType.USER_UPDATED,
    EventType.USER_DELETED,
    EventType.ANALYSIS_PROGRESS,
    EventType.COMPLIANCE_ALERT,
    EventType.CONNECTION_STATUS,
    EventType.ERROR_OCCURRED
  ],
  room: 'master',
  filters: {
    userId: 'dashboard-user'
  }
};
```

### Voice-Only Subscription

```typescript
const voiceSubscription = {
  eventTypes: [
    EventType.VOICE_COMMAND,
    EventType.VOICE_RESPONSE,
    EventType.VOICE_ERROR
  ],
  room: 'master'
};
```

### Analysis Monitoring

```typescript
const analysisSubscription = {
  eventTypes: [
    EventType.ANALYSIS_STARTED,
    EventType.ANALYSIS_PROGRESS,
    EventType.ANALYSIS_COMPLETED,
    EventType.PATTERN_DETECTED
  ],
  filters: {
    analysisType: 'compliance_check'
  }
};
```

---

## 🚨 Error Handling

### Connection Errors

```typescript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
  // Implement exponential backoff retry logic
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server initiated disconnect - don't reconnect automatically
  } else {
    // Network issue - will auto-reconnect
  }
});
```

### Event Processing Errors

```typescript
socket.on('error:occurred', (errorEvent) => {
  switch (errorEvent.data.severity) {
    case 'critical':
      // Show modal error dialog
      showCriticalError(errorEvent.data.message);
      break;
    case 'high':
      // Show toast notification
      showErrorToast(errorEvent.data.message);
      break;
    default:
      // Log to console
      console.warn('System warning:', errorEvent.data.message);
  }
});
```

---

## 📝 TypeScript Definitions

All event types are defined in `src/types/events.ts`:

```typescript
// Import all event types
import {
  EventType,
  IKASEvent,
  VoiceEvent,
  UserEvent,
  AnalysisEvent,
  ComplianceEvent,
  GraphEvent,
  ConnectionEvent,
  Subscription,
  VoiceCommand
} from '@/types/events';

// Use in components
const handleEvent = (event: IKASEvent) => {
  switch (event.type) {
    case EventType.VOICE_COMMAND:
      // TypeScript knows this is a VoiceEvent
      handleVoiceCommand(event);
      break;
    case EventType.USER_CREATED:
      // TypeScript knows this is a UserEvent
      handleUserCreated(event);
      break;
    // ... other cases
  }
};
```

---

## 🧪 Testing WebSocket Events

### Mock WebSocket for Testing

```typescript
// tests/__mocks__/socket.io-client.ts
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

export default jest.fn(() => mockSocket);
```

### Event Testing Examples

```typescript
// Test voice command handling
test('handles voice command response', () => {
  const mockEvent: VoiceResponseEvent = {
    type: 'voice:response',
    data: {
      originalCommand: 'zeige alle Benutzer',
      response: '23 Benutzer gefunden',
      success: true,
      executionTime: 1200
    }
  };

  const { getByText } = render(<VoicePanel />);
  
  // Simulate WebSocket event
  act(() => {
    mockSocket.on.mock.calls
      .find(([event]) => event === 'voice:response')[1](mockEvent);
  });

  expect(getByText('23 Benutzer gefunden')).toBeInTheDocument();
});
```

---

**Last Updated:** December 2024  
**API Version:** IKAS Frontend v0.1.0  
**WebSocket Server:** Socket.io v4.8+