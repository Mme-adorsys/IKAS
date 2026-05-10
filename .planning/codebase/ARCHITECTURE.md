# Architecture

**Analysis Date:** 2026-04-29

## Pattern Overview

**Overall:** Microservices with intelligent orchestration layer

IKAS uses a distributed architecture where an AI-powered orchestration layer coordinates between multiple specialized services (MCP servers) and a real-time event hub. The system follows a layered pattern with clear separation between frontend presentation, real-time communication, intelligent routing/orchestration, and specialized backend services.

**Key Characteristics:**
- Event-driven real-time communication using Socket.io + Redis pub/sub
- AI-powered decision making (Google Gemini) for MCP tool selection
- Multi-source data synchronization (Keycloak ↔ Neo4j) with freshness checks
- Stateless microservices with session management in Redis
- German language support with voice command processing
- Circuit breaker patterns for service resilience

## Layers

**Presentation Layer (Frontend):**
- Purpose: User-facing interface with voice activation and real-time dashboard
- Location: `frontend/src/`
- Contains: React/Next.js components, voice services, WebSocket client integration
- Depends on: WebSocket Server, stores state in Zustand, communicates via Socket.io
- Used by: End users for voice commands and dashboard interaction

**Real-time Communication Layer (WebSocket Server):**
- Purpose: Central hub for real-time events between frontend, AI gateway, and MCP services
- Location: `websocket-server/src/`
- Contains: Socket.io server, session management, event publishing/subscription, event handlers
- Depends on: Redis (pub/sub), environment configuration
- Used by: Frontend, AI Gateway for real-time event distribution

**Orchestration Layer (AI Gateway):**
- Purpose: Intelligent routing and coordination between LLM and MCP services
- Location: `ai-gateway/src/`
- Contains: Orchestrator, intelligent router, Gemini LLM service, MCP clients, tool discovery
- Depends on: Google Gemini API, Keycloak MCP, Neo4j MCP, WebSocket client
- Used by: Frontend via REST API, WebSocket server for event responses

**MCP Integration Layer:**
- Purpose: HTTP wrappers around external MCP servers
- Location: `ai-gateway/src/mcp/`
- Contains: BaseMCPClient (keycloak-client.ts, neo4j-client.ts)
- Depends on: External MCP servers (Keycloak MCP, Neo4j MCP) running on separate ports
- Used by: Orchestrator for tool execution

**External Services (MCP Servers):**
- Keycloak MCP: `keycloak-mcp-server/src/` (HTTP server on port 8001)
- Neo4j MCP: `mcp-neo4j/` (Python FastAPI on port 8002)

**Shared Types:**
- Purpose: TypeScript interfaces and schemas used across frontend and backend
- Location: `shared-types/src/`
- Contains: Event types, orchestration types, MCP types, validation schemas

## Data Flow

**Voice Command Flow (Primary):**

1. User speaks "Hey Keycloak, zeige alle Benutzer"
2. Frontend (WebSocket client) captures voice, emits `voiceCommand` event
3. WebSocket server receives, creates `VOICE_COMMAND` event, publishes to Redis
4. WebSocket server forwards to AI Gateway via HTTP POST `/api/chat`
5. AI Gateway (Orchestrator):
   - Routes request through IntelligentRouter (determines ExecutionStrategy)
   - Discovers available MCP tools via MCPToolDiscovery
   - Sends request to Gemini with tools
   - Gemini calls Keycloak MCP to list users
   - Orchestrator receives results, formats response
   - Returns response with `voiceResponse` event
6. Frontend receives response, displays users in UI
7. WebSocket broadcasts update to all connected clients

**Data Synchronization Flow:**

1. User requests analysis: "analysiere die Compliance"
2. IntelligentRouter checks Neo4j data freshness
3. If stale, executes SYNC_THEN_ANALYZE strategy:
   - Calls Keycloak MCP: list-users, list-admin-events
   - Calls Neo4j schema query to understand structure
   - Generates Cypher query and writes data to Neo4j
   - Follows sequential steps defined in Gemini systemInstruction
4. Once synced, Gemini calls Neo4j analysis tools
5. Results returned as analysis:completed event

**State Management:**
- Session state: Stored in Redis (SessionManager in WebSocket server)
- Frontend UI state: Zustand store with selectors and devtools
- Tool results cache: In-memory Map in Orchestrator (cleared per session)
- Chat history: Per-session in Gemini service (GeminiMessage[])

## Key Abstractions

**Orchestrator:**
- Purpose: Main orchestration engine coordinating LLM and MCP operations
- Examples: `ai-gateway/src/orchestration/orchestrator.ts`
- Pattern: Stateful class managing tool discovery, function calling loop, error handling
- Responsibility: Process orchestration requests, manage tool execution iterations, aggregate results

**IntelligentRouter:**
- Purpose: Determine execution strategy based on user intent and data freshness
- Examples: `ai-gateway/src/orchestration/routing.ts`
- Pattern: Strategy pattern with keyword-based intent detection
- Strategies: KEYCLOAK_FRESH_DATA, NEO4J_ANALYSIS_ONLY, SYNC_THEN_ANALYZE, KEYCLOAK_WRITE_THEN_SYNC, COORDINATED_MULTI_MCP

**EventPublisher & EventSubscriber:**
- Purpose: Pub/sub abstraction over Redis for event distribution
- Examples: `websocket-server/src/redis/event-publisher.ts`, `event-subscriber.ts`
- Pattern: Observer pattern with Redis channels
- Events: IKASEvent with typed payloads (VOICE_COMMAND, ANALYSIS_STARTED, USER_CREATED, etc.)

**MCP Clients (BaseMCPClient, KeycloakMCPClient, Neo4jMCPClient):**
- Purpose: Type-safe HTTP wrappers around MCP servers
- Examples: `ai-gateway/src/mcp/client.ts`, `keycloak-client.ts`, `neo4j-client.ts`
- Pattern: Template method pattern with subclass-specific tool methods
- Responsibility: Call HTTP endpoints, handle responses, manage timeouts

**GeminiService:**
- Purpose: Encapsulate Google Gemini LLM interactions
- Examples: `ai-gateway/src/llm/gemini-service.ts`
- Pattern: Facade pattern over Google Generative AI SDK
- Features: Function calling, multi-turn conversation, chat history per session

**SessionManager:**
- Purpose: Manage user sessions across WebSocket connections
- Examples: `websocket-server/src/rooms/session-manager.ts`
- Pattern: Registry pattern with Redis persistence
- Data: Session metadata, subscriptions, room memberships

## Entry Points

**Frontend Application:**
- Location: `frontend/src/app/page.tsx`
- Triggers: Browser load or navigation to root path
- Responsibilities: Render IKASDashboard component, initialize services
- Bootstrap: `frontend/src/app/layout.tsx` sets up global styling and providers

**AI Gateway Server:**
- Location: `ai-gateway/src/main.ts`
- Triggers: `npm run dev` or production server startup
- Responsibilities: Initialize Express app, setup middleware, connect to WebSocket server
- Routes: `/health/*` for health checks, `/api/*` for orchestration endpoints
- Port: 8005 (configured via PORT env var)

**WebSocket Server:**
- Location: `websocket-server/src/server.ts`
- Triggers: `npm run dev` or production server startup
- Responsibilities: Initialize Socket.io, setup Redis connection, event distribution
- Events: voiceCommand, subscribe, joinRoom, startAnalysis, disconnect
- Port: 3001 (configured via PORT env var)

**API Endpoints:**
- `POST /api/chat`: Main orchestration endpoint for voice commands and queries
  - Input: `{message, sessionId?, context?}`
  - Output: `{success, response, toolsCalled, duration, strategy}`
- `GET /health`: Health status of AI Gateway
  - Output: `{status, uptime, services: {keycloak, neo4j}}`
- `GET /health/tools`: Available MCP tools
  - Output: `{keycloak: [...], neo4j: [...]}`

## Error Handling

**Strategy:** Layered error handling with graceful fallbacks

**Patterns:**
- Circuit breaker pattern: MCPClient timeout/retry logic, automatic fallback
- Error boundaries: Express middleware for 500 errors, Socket.io error events
- Logging: Winston logger with request ID tracking across services
- User feedback: Error messages sent via voiceError events and HTTP responses

**Error Recovery:**
- MCP service unavailable: Return cached response or informative message
- WebSocket disconnect: Graceful session cleanup, auto-reconnect with exponential backoff
- Gemini API failure: Return error response with available alternatives
- Invalid tool calls: Catch and log, continue with next iteration

## Cross-Cutting Concerns

**Logging:** 
- Framework: Winston with custom formatters
- Patterns: Component-specific loggers (geminiLogger, mcpLogger), request IDs for correlation
- Implementation: `ai-gateway/src/utils/logger.ts` with RequestTracker for tracing

**Validation:** 
- Framework: Zod schemas for runtime validation
- Patterns: Input validation at API boundaries, tool argument schemas
- Examples: `chatRequestSchema` in `ai-gateway/src/api/orchestration.ts`

**Authentication:** 
- Current: Context-based (realm, userId) passed through requests
- Session: Redis-based session IDs for tracking user interactions
- Future: Keycloak integration for actual auth

**Caching:**
- Redis: Session data, event history (via pub/sub)
- In-memory: Tool results (Map in Orchestrator), chat history (per-session)
- TTL: Data-type-specific in IntelligentRouter (user_data: 5min, analysis: 1hour)

**Monitoring:**
- Health checks: Every 30 seconds in WebSocket server
- Metrics: Prometheus client in ai-gateway (prom-client)
- Performance tracking: RequestTracker measures orchestration duration and tool execution times
- Event tracking: All events timestamped and sessionId-tagged

---

*Architecture analysis: 2026-04-29*
