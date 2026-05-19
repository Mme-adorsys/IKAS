<!-- generated-by: gsd-doc-writer -->
# IKAS API Reference

This document covers the REST API exposed by the AI Gateway (port 8005) and the WebSocket events emitted by the WebSocket Server (port 3001), plus a complete reference for the MCP tools that the AI Gateway orchestrates.

---

## AI Gateway REST API

**Base URL:** `http://localhost:8005`

All endpoints return JSON. Timestamps are ISO 8601 strings. Errors follow a consistent envelope (see [Error Responses](#error-responses)).

---

### Authentication

The AI Gateway does not impose its own authentication layer. Requests are accepted from any caller on the local network. The underlying MCP services (Keycloak MCP, Neo4j MCP) authenticate via their own environment-supplied credentials and are never directly exposed to API consumers.

<!-- VERIFY: production authentication mechanism for the AI Gateway -->

---

### Endpoints Overview

| Method | Path | Description | Notes |
|--------|------|-------------|-------|
| `GET` | `/health` | Full health check including MCP and WebSocket status | Returns 503 when MCP services are down |
| `GET` | `/health/live` | Liveness probe — process is alive | Always 200 while process runs |
| `GET` | `/health/ready` | Readiness probe — dependencies reachable | Returns 503 when MCP services are unreachable |
| `GET` | `/api/status` | Orchestrator status and active session count | |
| `GET` | `/api/tools` | Discover all available MCP tools | Results are cached |
| `POST` | `/api/tools/refresh` | Force-invalidate the MCP tool cache | |
| `POST` | `/api/chat` | Send a message and receive an AI-orchestrated response | Core endpoint |
| `DELETE` | `/api/chat/:sessionId` | Clear a specific chat session's history | |
| `GET` | `/api/models` | List available LLM providers and models | |
| `POST` | `/api/models/switch` | Switch the active LLM provider or model | |
| `POST` | `/api/cleanup` | Trigger manual session cleanup | |

---

### Health Endpoints

#### `GET /health`

Returns system health including MCP service connectivity and WebSocket status. Overall health is determined by MCP service availability only — WebSocket connectivity is reported but does not affect the status code.

**Response — 200 (healthy)**

```json
{
  "status": "healthy",
  "timestamp": "2025-08-24T10:00:00.000Z",
  "uptime": 3600.5,
  "services": {
    "keycloakMcp": {
      "status": "healthy",
      "latency": 12,
      "lastChecked": "2025-08-24T10:00:00.000Z"
    },
    "neo4jMcp": {
      "status": "healthy",
      "latency": 8,
      "lastChecked": "2025-08-24T10:00:00.000Z"
    },
    "websocket": {
      "status": "healthy",
      "lastChecked": "2025-08-24T10:00:00.000Z"
    }
  },
  "version": "1.0.0",
  "environment": "development"
}
```

**Response — 503 (unhealthy)**

Same shape with `"status": "unhealthy"` and one or more services showing `"status": "unhealthy"` with an `"error"` field.

Service status values: `"healthy"` | `"unhealthy"` | `"unknown"`

---

#### `GET /health/live`

Liveness probe. Returns 200 as long as the Node.js process is running.

**Response — 200**

```json
{
  "status": "alive",
  "timestamp": "2025-08-24T10:00:00.000Z",
  "uptime": 3600.5
}
```

---

#### `GET /health/ready`

Readiness probe. Checks that both MCP services are reachable before reporting ready.

**Response — 200 (ready)**

```json
{
  "status": "ready",
  "timestamp": "2025-08-24T10:00:00.000Z",
  "dependencies": {
    "keycloakMcp": "healthy",
    "neo4jMcp": "healthy"
  }
}
```

**Response — 503 (not ready)**

```json
{
  "status": "not-ready",
  "timestamp": "2025-08-24T10:00:00.000Z",
  "dependencies": {
    "keycloakMcp": "unhealthy",
    "neo4jMcp": "healthy"
  }
}
```

---

### Chat

#### `POST /api/chat`

Sends a natural-language message to the configured LLM. The orchestrator selects an execution strategy, calls MCP tools as needed, and returns a complete response.

Before processing, the endpoint checks MCP service health. If either service is unavailable, the request is rejected with 503.

**Request body**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `message` | string | Yes | 1–10 000 characters | The user's natural-language message |
| `sessionId` | string | No | — | Session identifier for conversation continuity. Auto-generated as `session-{timestamp}` if omitted |
| `context` | object | No | — | Optional request context |
| `context.realm` | string | No | — | Keycloak realm to scope the operation |
| `context.userId` | string | No | — | Target user ID |
| `context.preferredLanguage` | string | No | — | Preferred response language |
| `context.priority` | string | No | `"low"` \| `"normal"` \| `"high"` | Request priority hint |

**Request example**

```json
{
  "message": "Show all users in the master realm",
  "sessionId": "session-1724490000000",
  "context": {
    "realm": "master",
    "priority": "normal"
  }
}
```

**Response — 200**

```json
{
  "response": "I found 3 users in the master realm: admin, john.doe, jane.smith.",
  "sessionId": "session-1724490000000",
  "success": true,
  "strategy": "coordinated_multi_mcp",
  "toolsCalled": [
    "keycloak_list-users"
  ],
  "duration": 1240,
  "timestamp": "2025-08-24T10:00:01.240Z",
  "data": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `response` | string | Human-readable answer from the LLM |
| `sessionId` | string | Session ID (echoed back or auto-generated) |
| `success` | boolean | Whether the orchestration completed without errors |
| `strategy` | string | Execution strategy chosen by the orchestrator |
| `toolsCalled` | string[] | Names of MCP tools invoked during the request |
| `duration` | number | Total processing time in milliseconds |
| `timestamp` | string | ISO 8601 completion timestamp |
| `data` | object | Structured data returned by MCP tools (if any) |

**Response — 503 (MCP services unavailable)**

```json
{
  "error": "Service temporarily unavailable",
  "message": "Some backend services are currently unavailable. Please try again later.",
  "serviceStatus": {
    "keycloak": false,
    "neo4j": true,
    "overall": false
  }
}
```

---

#### `DELETE /api/chat/:sessionId`

Clears the conversation history for the given session. Use this before switching LLM providers to avoid context contamination, or to start a fresh conversation.

**Path parameter:** `sessionId` — the session identifier to clear.

**Response — 200**

```json
{
  "message": "Session cleared successfully",
  "sessionId": "session-1724490000000",
  "timestamp": "2025-08-24T10:05:00.000Z"
}
```

---

### Tool Discovery

#### `GET /api/tools`

Returns all tools discovered from connected MCP servers. Results are cached; the `cached` field indicates whether the response came from cache.

**Response — 200**

```json
{
  "tools": {
    "keycloak": [
      {
        "name": "create-user",
        "description": "Create a new user in a specific realm.",
        "inputSchema": {}
      }
    ],
    "neo4j": [
      {
        "name": "get_neo4j_schema",
        "description": "List all nodes, attributes, and relationships in the Neo4j database.",
        "inputSchema": {}
      }
    ]
  },
  "servers": {},
  "summary": {
    "keycloakTools": 8,
    "neo4jTools": 3,
    "totalTools": 11
  },
  "timestamp": "2025-08-24T10:00:00.000Z",
  "cached": true
}
```

---

#### `POST /api/tools/refresh`

Invalidates the MCP tool cache and re-discovers all tools from connected servers.

**Response — 200**

```json
{
  "message": "Tool cache refreshed successfully",
  "tools": {
    "keycloak": 8,
    "neo4j": 3,
    "total": 11
  },
  "timestamp": "2025-08-24T10:00:00.000Z"
}
```

---

### Status

#### `GET /api/status`

Returns the orchestrator's current operational status including active session count and tool cache state.

**Response — 200**

```json
{
  "orchestrator": {
    "activeSessions": 2,
    "toolCache": {}
  },
  "services": {},
  "timestamp": "2025-08-24T10:00:00.000Z"
}
```

---

### Model Management

#### `GET /api/models`

Lists all available LLM providers and models, including which model is currently active.

**Response — 200**

```json
{
  "models": [
    {
      "id": "anthropic-claude-opus-4-1",
      "name": "Claude Opus 4.1",
      "displayName": "Claude Opus 4.1",
      "provider": "Anthropic",
      "model": "claude-opus-4-1-20250805",
      "capabilities": ["text", "tools", "function_calling", "analysis"],
      "description": "Advanced reasoning with superior problem-solving capabilities",
      "speed": "medium",
      "cost": "high",
      "recommended": true,
      "available": true,
      "current": true
    },
    {
      "id": "gemini",
      "name": "Gemini Pro",
      "provider": "Google",
      "model": "gemini-pro",
      "capabilities": ["text", "tools", "function_calling", "analysis"],
      "description": "Fast and efficient language model with strong reasoning",
      "available": true,
      "current": false
    }
  ],
  "current": {
    "provider": "anthropic",
    "model": "claude-opus-4-1-20250805",
    "name": "Claude Models"
  },
  "timestamp": "2025-08-24T10:00:00.000Z"
}
```

---

#### `POST /api/models/switch`

Switches the active LLM provider. At least one of `provider`, `model`, or `modelId` must be supplied. If a `sessionId` is provided, that session's conversation history is cleared so the new model starts with a clean context.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Conditional | Provider name: `"anthropic"` \| `"gemini"` \| `"ollama"` \| `"openai"` |
| `model` | string | Conditional | Specific model ID (e.g. `"claude-opus-4-1-20250805"`) |
| `modelId` | string | Conditional | UI model ID as returned by `GET /api/models` (e.g. `"anthropic-claude-opus-4-1"`) |
| `sessionId` | string | No | If provided, clears this session's history after the switch |

At least one of `provider`, `model`, or `modelId` is required.

**Request example — switch by provider**

```json
{
  "provider": "gemini",
  "sessionId": "session-1724490000000"
}
```

**Request example — switch to a specific Anthropic model**

```json
{
  "model": "claude-opus-4-1-20250805"
}
```

**Response — 200**

```json
{
  "message": "Model switched successfully",
  "provider": "gemini",
  "model": null,
  "modelName": null,
  "sessionCleared": true,
  "timestamp": "2025-08-24T10:00:00.000Z"
}
```

**Response — 400 (provider not configured)**

```json
{
  "error": "Provider not available",
  "message": "The openai provider is not currently available or configured",
  "availableProviders": ["ANTHROPIC", "GEMINI"]
}
```

**Response — 503 (provider unavailable)**

```json
{
  "error": "Provider unavailable",
  "message": "The ollama provider is currently unavailable"
}
```

---

### Maintenance

#### `POST /api/cleanup`

Triggers manual cleanup of expired sessions and stale state. Normally called by an internal scheduler.

**Response — 200**

```json
{
  "message": "Cleanup completed successfully",
  "timestamp": "2025-08-24T10:00:00.000Z"
}
```

---

### Error Responses

All endpoints return errors in one of two standard shapes.

**Validation error — 400**

```json
{
  "error": "Invalid request",
  "message": "Request validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "path": ["message"],
      "message": "Message cannot be empty"
    }
  ]
}
```

**Server error — 500**

```json
{
  "error": "Internal server error",
  "message": "Detailed error message here",
  "timestamp": "2025-08-24T10:00:00.000Z"
}
```

**HTTP status codes used**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Validation failure or provider not configured |
| 500 | Unexpected server error |
| 503 | MCP service(s) unavailable or provider unreachable |

---

## WebSocket Server

**URL:** `http://localhost:3001`  
**Protocol:** Socket.IO (transport: WebSocket with HTTP long-poll fallback)

Connect using the Socket.IO client library. CORS is configured to allow origins `http://localhost:3000` and `http://localhost:3002` by default (configurable via `CORS_ORIGIN`).

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');
```

---

### WebSocket Health Check

**`GET http://localhost:3001/health`** — standard HTTP endpoint (not a socket event).

**Response — 200**

```json
{
  "status": "healthy",
  "service": "ikas-websocket-server",
  "version": "1.0.0",
  "timestamp": "2025-08-24T10:00:00.000Z",
  "connections": 3
}
```

---

### Event Envelope

All Socket.IO events carry an `IKASEvent` envelope with the following base fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique event identifier |
| `type` | string | Event type constant (see tables below) |
| `timestamp` | string | ISO 8601 event creation time |
| `sessionId` | string | Originating session ID |
| `userId` | string (optional) | Associated user ID |
| `realm` | string (optional) | Associated Keycloak realm |
| `payload` | object | Event-specific payload (see sections below) |

---

### Events: Server Emits to Client

These events are emitted by the server to connected clients.

#### `voice:response`

Sent after a voice command has been processed by the AI Gateway.

```json
{
  "id": "uuid",
  "type": "voice:response",
  "timestamp": "2025-08-24T10:00:01.000Z",
  "sessionId": "session-1724490000000",
  "payload": {
    "response": "I found 3 users in the master realm.",
    "confidence": 0.98,
    "language": "de-DE",
    "executionTime": 1240
  }
}
```

#### `system:status` / `connection:status`

Broadcast periodically and on connection state changes.

```json
{
  "id": "uuid",
  "type": "connection:status",
  "timestamp": "2025-08-24T10:00:00.000Z",
  "sessionId": "system",
  "payload": {
    "status": "connected",
    "clientCount": 3,
    "uptime": 3600,
    "services": {
      "websocket": { "status": "healthy", "lastChecked": "2025-08-24T10:00:00.000Z" },
      "redis": { "status": "healthy", "lastChecked": "2025-08-24T10:00:00.000Z" }
    }
  }
}
```

Status values: `"connected"` | `"disconnected"` | `"reconnecting"` | `"error"`

#### `analysis:progress`

Emitted during long-running analysis operations to report incremental progress.

```json
{
  "id": "uuid",
  "type": "analysis:progress",
  "timestamp": "2025-08-24T10:00:02.000Z",
  "sessionId": "session-1724490000000",
  "payload": {
    "analysisId": "analysis-uuid",
    "analysisType": "compliance_check",
    "progress": 65,
    "status": "running",
    "estimatedTimeRemaining": 3000
  }
}
```

`analysisType` values: `"user_patterns"` | `"compliance_check"` | `"security_audit"` | `"usage_statistics"`

`status` values: `"started"` | `"running"` | `"completed"` | `"failed"`

#### `graph:update`

Emitted when Neo4j graph data changes (nodes or relationships added/modified).

```json
{
  "id": "uuid",
  "type": "graph:update",
  "timestamp": "2025-08-24T10:00:03.000Z",
  "sessionId": "session-1724490000000",
  "payload": {
    "nodes": [
      {
        "id": "user-123",
        "labels": ["User"],
        "properties": { "username": "john.doe", "realm": "master" }
      }
    ],
    "relationships": [
      {
        "id": "rel-456",
        "type": "HAS_ROLE",
        "startNode": "user-123",
        "endNode": "role-789",
        "properties": {}
      }
    ]
  }
}
```

---

### Events: Client Emits to Server

#### `voice:command`

Send a recognized voice command for processing.

```json
{
  "id": "uuid",
  "type": "voice:command",
  "timestamp": "2025-08-24T10:00:00.500Z",
  "sessionId": "session-1724490000000",
  "payload": {
    "command": "show all users",
    "transcript": "Hey IKAS, show all users",
    "confidence": 0.94,
    "language": "en-US"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | No | Parsed command text |
| `transcript` | string | No | Full speech-to-text transcript |
| `confidence` | number | No | Recognition confidence 0–1. Below 0.7 triggers a clarification response |
| `language` | string | No | BCP-47 language tag. Defaults to `"de-DE"` |

#### `analysis:request`

Request a background analysis operation.

```json
{
  "id": "uuid",
  "type": "analysis:started",
  "timestamp": "2025-08-24T10:00:00.000Z",
  "sessionId": "session-1724490000000",
  "payload": {
    "analysisId": "analysis-uuid",
    "analysisType": "compliance_check",
    "status": "started"
  }
}
```

---

### Additional Event Types

The following event types are defined in the type system and may be emitted in relevant circumstances:

| Event type | Direction | Description |
|------------|-----------|-------------|
| `user:created` | Server → Client | A user was created in Keycloak |
| `user:updated` | Server → Client | A user record was updated |
| `user:deleted` | Server → Client | A user was deleted |
| `analysis:started` | Server → Client | An analysis job began |
| `analysis:completed` | Server → Client | An analysis job finished (includes `result`) |
| `pattern:detected` | Server → Client | A graph pattern was detected during analysis |
| `compliance:check` | Server → Client | Compliance rule evaluated |
| `compliance:alert` | Server → Client | Compliance violation found (critical/error severity also triggers admin notification) |
| `compliance:report` | Server → Client | Full compliance report available |
| `voice:error` | Server → Client | Voice command processing failed |
| `session:started` | Server → Client | A new session was established |
| `session:ended` | Server → Client | A session ended |
| `session:timeout` | Server → Client | A session expired due to inactivity |
| `heartbeat` | Server → Client | Periodic keep-alive signal |
| `error:occurred` | Server → Client | General error notification |

---

## MCP Tool Reference

The AI Gateway orchestrates two MCP servers. Tools are called indirectly via `POST /api/chat` — the LLM selects and invokes them based on the user's message. You can inspect available tools at any time via `GET /api/tools`.

---

### Keycloak MCP Server

**Internal URL:** `http://localhost:8001`  
**Server name:** `keycloak-admin`

#### User Management

##### `create-user`

Create a new user in a Keycloak realm.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `realm` | string | Yes | Target realm name |
| `username` | string | Yes | Username for the new user |
| `email` | string | Yes | Email address (validated) |
| `firstName` | string | Yes | User's first name |
| `lastName` | string | Yes | User's last name |

```json
{
  "realm": "master",
  "username": "john.doe",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

---

##### `delete-user`

Delete a user from a Keycloak realm.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `realm` | string | Yes | Target realm name |
| `userId` | string | Yes | Keycloak internal user UUID |

---

##### `list-users`

List users in a Keycloak realm.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `realm` | string | Yes | Target realm name |

---

#### Realm Management

##### `list-realms`

List all available Keycloak realms. No parameters required.

---

#### Event Monitoring

##### `list-admin-events`

List Keycloak admin audit events with filtering and sorting.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `realm` | string | Yes | Target realm name |
| `fromDate` | string | No | ISO 8601 start date/time |
| `toDate` | string | No | ISO 8601 end date/time |
| `eventType` | string | No | Filter by event type |
| `resourceType` | string | No | Filter by resource type |
| `resourcePath` | string | No | Filter by resource path |
| `clientId` | string | No | Filter by client ID |
| `userId` | string | No | Filter by user ID |
| `ipAddress` | string | No | Filter by IP address |
| `success` | boolean | No | Filter by success/failure |
| `sortBy` | string | No | `"time"` \| `"eventType"` \| `"resourceType"` \| `"clientId"` |
| `sortOrder` | string | No | `"asc"` \| `"desc"` |
| `first` | number | No | Pagination offset |
| `max` | number | No | Maximum results to return |

---

##### `get-event-details`

Get detailed information about a specific Keycloak event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `realm` | string | Yes | Target realm name |
| `eventId` | string | Yes | Event UUID |

---

##### `list-user-events`

List user-facing Keycloak events (logins, password changes, etc.) with filtering.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `realm` | string | Yes | Target realm name |
| `fromDate` | string | No | ISO 8601 start date/time |
| `toDate` | string | No | ISO 8601 end date/time |
| `clientId` | string | No | Filter by client ID |
| `userId` | string | No | Filter by user ID |
| `ipAddress` | string | No | Filter by IP address |
| `type` | string | No | Filter by event type |
| `sortBy` | string | No | `"time"` \| `"type"` \| `"clientId"` \| `"userId"` \| `"ipAddress"` |
| `sortOrder` | string | No | `"asc"` \| `"desc"` |
| `first` | number | No | Pagination offset |
| `max` | number | No | Maximum results to return |

---

#### System Monitoring

##### `get-metrics`

Retrieve Keycloak server metrics in Prometheus exposition format. No parameters required.

---

### Neo4j MCP Server

**Internal URL:** `http://localhost:8002`  
**Server name:** `mcp-neo4j-cypher`

#### Schema

##### `get_neo4j_schema`

Returns all node labels, their properties, and relationship types present in the database. Requires the APOC plugin. No parameters required. Read-only, idempotent.

**Example response**

```json
{
  "User": {
    "type": "node",
    "count": 150,
    "properties": {
      "id": { "type": "String", "indexed": true },
      "username": { "type": "String" },
      "email": { "type": "String", "indexed": true }
    },
    "relationships": {
      "HAS_ROLE": { "direction": "OUT", "labels": ["Role"] }
    }
  }
}
```

---

#### Query Execution

##### `read_neo4j_cypher`

Execute a read-only Cypher query. Use for pattern analysis, relationship traversal, and reporting.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Cypher `MATCH`/`RETURN` query |
| `parameters` | object | No | Named query parameters |

```json
{
  "query": "MATCH (u:User) WHERE u.enabled = $enabled RETURN u.username, u.email LIMIT $limit",
  "parameters": { "enabled": true, "limit": 10 }
}
```

---

##### `write_neo4j_cypher`

Execute a write Cypher query (`CREATE`, `MERGE`, `SET`, `DELETE`). Use for data synchronization and graph updates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Cypher write query |
| `parameters` | object | No | Named query parameters |

```json
{
  "query": "MERGE (u:User {id: $userId}) SET u.username = $username, u.lastSync = datetime()",
  "parameters": { "userId": "user-123", "username": "john.doe" }
}
```

---

### Orchestration Strategies

The AI Gateway selects one of the following strategies based on the user's message intent:

| Strategy | When used | Tools invoked |
|----------|-----------|---------------|
| `keycloak_fresh_data` | Message contains "current", "latest", "live", "now" | Keycloak tools only |
| `neo4j_analysis_only` | Analytical intent with fresh graph data | Neo4j read tools only |
| `sync_then_analyze` | Analytical intent with stale graph data | Keycloak fetch → Neo4j write (sync) → Neo4j read (analyze) |
| `keycloak_write_then_sync` | Write intent ("create", "delete", "update") | Keycloak write tool → Neo4j sync |
| `coordinated_multi_mcp` | General queries or ambiguous intent | Both MCP servers as needed |

---

## Rate Limits

<!-- VERIFY: rate limiting configuration — no rate-limit middleware detected in source files -->

No rate limiting middleware was found in the current source. If the service is deployed behind a reverse proxy or API gateway, rate limits may be applied at the infrastructure level.
