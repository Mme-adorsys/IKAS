<!-- generated-by: gsd-doc-writer -->
# @ikas/shared-types

Shared TypeScript interfaces and types used across all IKAS services — the AI Gateway, WebSocket server, frontend, and MCP clients all import from this package to ensure consistent data shapes at every service boundary.

Part of the [IKAS monorepo](../README.md).

## Installation

This package is private and used internally within the IKAS monorepo. Install it as a workspace dependency in any sibling package:

```bash
npm install
```

Or reference it directly in a sibling `package.json`:

```json
{
  "dependencies": {
    "@ikas/shared-types": "*"
  }
}
```

## Build

```bash
npm run build   # Compile TypeScript to dist/
npm run watch   # Watch mode for development
npm run clean   # Remove dist/
```

## Type Modules

All types are re-exported from `dist/index.js` and `dist/index.d.ts`. Import any type directly from the package root:

```typescript
import { MCPToolCall, OrchestrationRequest, VoiceCommand } from '@ikas/shared-types';
```

### `mcp.ts` — MCP Server Communication

Types for the Model Context Protocol layer. Covers both the Keycloak MCP server and the Neo4j MCP server.

Key exports:
- `MCPServerName` — union type `'keycloak' | 'neo4j'`
- `MCPServer` — server registration (URL, transport, version)
- `MCPToolDefinition` — tool name, description, and JSON Schema input spec
- `MCPToolCall` — a single tool invocation with server, tool name, arguments, and session context
- `MCPResponse` — success/error wrapper with optional duration and cache metadata
- `KeycloakUser`, `KeycloakRealm`, `KeycloakAdminEvent` — Keycloak entity shapes
- `Neo4jNode`, `Neo4jRelationship`, `Neo4jQueryResult`, `Neo4jSchema` — Neo4j result shapes

### `orchestration.ts` — AI Orchestration and Routing

Types for the AI Gateway's multi-LLM orchestration layer.

Key exports:
- `ExecutionStrategy` — enum of routing strategies: `KEYCLOAK_FRESH_DATA`, `NEO4J_ANALYSIS_ONLY`, `SYNC_THEN_ANALYZE`, `KEYCLOAK_WRITE_THEN_SYNC`, `COORDINATED_MULTI_MCP`
- `OrchestrationRequest` — user input, session ID, realm context, and optional strategy override
- `OrchestrationResponse` — result message, tool calls made, duration, and optional graph update payload
- `DataFreshnessCheck` — whether Neo4j data needs a re-sync from Keycloak
- `SyncResult` — outcome of a Keycloak-to-Neo4j sync operation
- `LLMToolMapping` — how a raw MCP tool is exposed to the LLM with enhanced descriptions
- `IntentAnalysis` — parsed user intent (fresh data vs. analysis vs. write) with confidence score
- `OrchestrationGraphUpdate` — graph node/relationship changes to propagate to the frontend

### `voice.ts` — Voice Interface

Types for speech recognition and text-to-speech across the frontend and WebSocket server.

Key exports:
- `VoiceCommand` — transcribed text, confidence score, language, and hotword detection flag
- `VoiceResponse` — response text, optional audio URL, and TTS flag
- `SpeechRecognitionConfig` — language, continuous mode, interim results, and hotword list
- `TextToSpeechConfig` — language, voice, rate, pitch, and volume settings
- `VoiceSessionState` — current listening/processing/speaking state with last command and response
- `VoiceMetrics` — aggregate stats: total commands, success rate, average confidence, error rate

### `graph.ts` — Graph Visualization

Types for the D3.js-based Neo4j visualization rendered in the frontend dashboard.

Key exports:
- `GraphNode` — node with label, type (`User | Role | Group | Client | Realm | Policy | Violation`), position, color, and size
- `GraphLink` — directed edge with source, target, type, strength, and animation flag
- `GraphData` — full graph payload with nodes, links, and metadata (timestamp, counts, source)
- `GraphVisualizationConfig` — canvas dimensions, physics settings, color scheme, and node/relationship filters
- `GraphAnalysisResult` — structured output for duplicate users, compliance violations, community detection, and centrality analysis
- `GraphUpdateAnimation` — animation descriptor for adding, removing, updating, or highlighting elements

### `compliance.ts` — Compliance and Security

Types for the automated compliance engine and security monitoring.

Key exports:
- `ComplianceRule` — rule definition with category (`password | mfa | user_management | session | audit`), severity, and the Cypher query used to detect violations
- `ComplianceViolation` — a detected violation linked to a rule, with the affected resource and resolution status
- `ComplianceReport` — full realm audit: overall score (0–100), pass/fail counts, violations list, per-category breakdown, and historical trend data
- `SecurityMetrics` — user, session, and audit metric snapshots (MFA adoption, suspicious sessions, failed actions)
- `SecurityAlert` — real-time alert with type (`suspicious_login | privilege_escalation | bulk_operation | compliance_violation`), severity, affected user, source IP, and investigation status

### `api.ts` — REST API and WebSocket Events

Types for HTTP request/response bodies and the Socket.io event bus shared between the WebSocket server and frontend.

Key exports:
- `ApiResponse<T>` — generic response envelope with `success`, `data`, `error`, `timestamp`, and `requestId`
- `HealthCheckResponse` — per-service health status with response times
- `WebSocketEventType` — enum of all Socket.io event names (voice, graph, system, compliance, user, session)
- `WebSocketEvent<T>` — event envelope with type, data, timestamp, and session ID
- `VoiceCommandEvent`, `CommandResponseEvent`, `GraphUpdateEvent` — specific event payloads
- `ProcessVoiceCommandRequest`, `AnalyzeComplianceRequest`, `SyncDataRequest`, `SearchUsersRequest` — REST request body shapes
- `DashboardMetrics` — aggregate data for the frontend dashboard panel

## Usage Example

```typescript
import {
  MCPToolCall,
  MCPResponse,
  OrchestrationRequest,
  ExecutionStrategy,
  VoiceCommand,
  ApiResponse
} from '@ikas/shared-types';

// Construct a typed MCP tool call
const toolCall: MCPToolCall = {
  server: 'keycloak',
  tool: 'list-users',
  arguments: { realm: 'master' },
  context: {
    sessionId: 'abc123',
    realm: 'master'
  }
};

// Type-safe API response wrapping
function ok<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID()
  };
}

// Orchestration request with explicit strategy
const request: OrchestrationRequest = {
  userInput: 'Show all users in the master realm',
  sessionId: 'abc123',
  context: {
    realm: 'master',
    language: 'en-US',
    timestamp: new Date().toISOString()
  },
  strategy: ExecutionStrategy.KEYCLOAK_FRESH_DATA
};
```

## License

MIT
