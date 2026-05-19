# External Integrations

**Analysis Date:** 2026-04-29

## APIs & External Services

**LLM Services:**
- Google Generative AI (Gemini) - LLM for natural language understanding and function calling
  - SDK: `@google/generative-ai` v0.21.0
  - Auth: `GEMINI_API_KEY` environment variable
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/...`
  - Used in: `ai-gateway/src/llm/gemini-service.ts`
  - Capabilities: Function calling, multi-turn conversations, system prompts, streaming responses
  - Model: `gemini-1.5-flash` or `gemini-1.5-pro` (configurable)

**MCP Services:**
- Keycloak MCP Server - User and realm administration
  - Protocol: HTTP REST wrapper on port 8001
  - Base URL: `http://keycloak-mcp:8001` (internal Docker) / `http://localhost:8001` (local)
  - Tools: 8 available tools (create-user, delete-user, list-users, list-realms, list-admin-events, get-event-details, list-user-events, get-metrics)
  - Used in: `ai-gateway/src/mcp/keycloak-client.ts`
  - Client: Axios HTTP client with timeout configuration
  - Response format: JSON with success/error metadata

- Neo4j MCP Server - Graph database queries and analytics
  - Protocol: HTTP REST wrapper on port 8002
  - Base URL: `http://neo4j-mcp:8002` (internal Docker)
  - Tools: 3 available tools (get_neo4j_schema, query_read, query_write)
  - Used in: `ai-gateway/src/mcp/neo4j-client.ts`
  - Client: Axios HTTP client for Cypher query execution
  - Response format: JSON with query results and metadata

## Data Storage

**Databases:**
- PostgreSQL 15-alpine - Keycloak persistence layer
  - Connection: `jdbc:postgresql://postgres:5432/keycloak` (container mode)
  - Client: JDBC driver (built into Keycloak)
  - Credentials: User `keycloak`, password `keycloak`
  - Container: `ikas-postgres` on port 5432
  - Volume: `postgres_data` for data persistence
  - Health check: pg_isready probes

- Neo4j 5.15 - Graph database for relationship analysis
  - Connection: `bolt://neo4j:7687` (Bolt protocol)
  - Python Client: neo4j driver v5.26.0+
  - Credentials: Username `neo4j`, password `password`
  - Container: `ikas-neo4j` ports 7474 (HTTP), 7687 (Bolt)
  - Volumes: neo4j_data, neo4j_logs, neo4j_plugins for APOC and Graph Data Science
  - Used in: `mcp-neo4j/` for Cypher execution
  - Plugins: APOC, Graph Data Science for advanced analytics

**File Storage:**
- Local filesystem only - No external blob storage
  - Logs stored in: `ai-gateway/logs/` (combined.log, gemini.log, mcp.log)
  - Temporary files in memory (no persistent file uploads)

**Caching:**
- Redis 7.2-alpine - In-memory cache and pub/sub messaging
  - Connection: `redis://redis:6379` (standard Redis protocol)
  - Client: ioredis v5.4.1 (Node.js Redis client)
  - Container: `ikas-redis` on port 6379
  - Command: `redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru`
  - Used in: AI Gateway and WebSocket Server for caching, session storage, pub/sub
  - Volume: `redis_data` for persistence

## Authentication & Identity

**Auth Provider:**
- Keycloak 24.0 - Open-source identity and access management
  - Connection: `http://keycloak:8080` (internal Docker) / `http://localhost:8080` (local)
  - Admin credentials: `admin`/`admin` (default for development)
  - Admin API: Exposed via Keycloak MCP Server
  - Container: `ikas-keycloak` on port 8080
  - Realms: `master` (default for admin operations)
  - Features: User management, role assignment, realm administration
  - Health check: REST endpoints `/health/ready` and `/realms/master`

**Implementation:**
- Keycloak admin client: `@keycloak/keycloak-admin-client` v22.0.5
- Location: `keycloak-mcp-server/src/services/keycloak-client.ts`
- Approach: REST API calls to Keycloak for auth/user operations
- No JWT/session-based auth in frontend (development environment)

## Monitoring & Observability

**Error Tracking:**
- None configured - Development environment only

**Logs:**
- Approach: Winston structured logging
- Location: `ai-gateway/src/utils/logger.ts`
- Output destinations:
  - Console (pretty-printed for development)
  - `ai-gateway/logs/combined.log` - All unified logs
  - `ai-gateway/logs/gemini.log` - Gemini LLM operations
  - `ai-gateway/logs/mcp.log` - MCP service calls
- Request correlation: Unique requestId tracked across components
- Metrics: Component-specific logging with emoji categorization (🎯📊📤✅)

**Metrics:**
- Prometheus client: prom-client v15.1.3
- Metrics exposed at: `http://localhost:8005/metrics` (Prometheus format)
- Tracked metrics: MCP calls count, MCP duration, active sessions
- Labels: server, tool, status tracking

**Health Checks:**
- AI Gateway: `GET /health` - Returns JSON status
- WebSocket Server: `GET /health` - Returns JSON status
- Keycloak MCP: `GET /health` - Returns JSON status
- Docker health checks: All services configured with probes

## CI/CD & Deployment

**Hosting:**
- Docker Compose - Local development orchestration
  - File: `docker/docker-compose.dev.yml`
  - Services: 9 containers (Keycloak, PostgreSQL, Neo4j, Redis, MCP servers, AI Gateway, WebSocket Server, Frontend)
  - Network: `ikas-network` (custom bridge)
  - Environment: Development mode with all services exposed

**Container Images:**
- Pre-built: Keycloak (quay.io), PostgreSQL, Neo4j, Redis (Docker Hub)
- Custom-built:
  - `ikas-keycloak-mcp:latest` - Node.js MCP server
  - `ikas-neo4j-mcp:latest` - Python FastMCP server
  - `ikas-ai-gateway:latest` - Express.js TypeScript service
  - `ikas-websocket-server:latest` - Socket.io TypeScript service
  - `ikas-frontend:latest` - Next.js React application

**CI Pipeline:**
- Not configured - Manual build/deploy via Docker Compose
- Scripts available: `./scripts/start-dev.sh`, `./docker/health-check.sh`
- No external CI/CD service (GitHub Actions, GitLab CI, etc.)

## Environment Configuration

**Required Environment Variables:**

AI Gateway (`ai-gateway/.env`):
```
GEMINI_API_KEY=<google-gemini-api-key>
REDIS_URL=redis://redis:6379
KEYCLOAK_MCP_URL=http://keycloak-mcp:8001
NEO4J_MCP_URL=http://neo4j-mcp:8002
NODE_ENV=development
PORT=8005
```

WebSocket Server (`websocket-server/.env`):
```
REDIS_URL=redis://redis:6379
AI_GATEWAY_URL=http://ai-gateway:8005
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8080
```

Keycloak (`docker/docker-compose.dev.yml`):
```
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KC_DB=postgres
KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=keycloak
```

Neo4j (`docker/docker-compose.dev.yml`):
```
NEO4J_AUTH=neo4j/password
NEO4J_PLUGINS=["apoc", "graph-data-science"]
```

**Secrets Location:**
- `.env` files (gitignored) - Local development
- Docker Compose environment section - Container configuration
- `.env.example` - Template with default values (no secrets)
- No external vault service (Vault, AWS Secrets Manager, etc.)

## Webhooks & Callbacks

**Incoming:**
- WebSocket events from frontend: `voice:command`, `voice:response`, `system:status`, `analysis:progress`
  - Endpoint: WebSocket Server on port 3001
  - Protocol: Socket.io with real-time bidirectional communication
  - Redis pub/sub for multi-instance support

- HTTP endpoints in AI Gateway:
  - `POST /api/chat` - Process user messages/voice commands
  - `GET /health` - Health check
  - `POST /metrics` - Prometheus metrics endpoint

**Outgoing:**
- WebSocket events from backend to frontend: JSON-RPC style events
- Keycloak events: Captured via MCP `list-admin-events`, `list-user-events` tools
- Neo4j change notifications: Not currently implemented (could use triggers)

## Real-time Communication

**WebSocket (Socket.io):**
- Server: `websocket-server/src/server.ts` on port 3001
- Client: `frontend/src/services/websocket.ts` with socket.io-client v4.8.1
- Protocol: HTTP long-polling with WebSocket upgrade
- Pub/Sub: Redis-backed for multi-instance horizontal scaling
- Events: Command streams, response events, system status, progress updates
- Session management: Tracked in Redis with requestId correlation

**Message Format:**
- Type: JSON events
- Structure: `{ type: string, data: any, metadata?: { requestId, timestamp } }`
- Example: `voice:command` with transcribed German text

## API Rate Limiting

- Not configured - Development environment
- Keycloak API: No rate limits (admin API)
- Gemini API: Dependent on Google Cloud plan/quotas
- No request throttling or circuit breaker configured (but architecture supports adding)

## Data Synchronization

**Keycloak ↔ Neo4j Sync:**
- Manual trigger: MCP tool `sync-data-keycloak-to-neo4j` (proposed)
- Strategy: `coordinated_multi_mcp` execution with data freshness checks
- TTL: Configurable via cache keys (user_data: 5min, analysis: 1hour)
- Batch size: No limits enforced (depends on dataset)

## External Service Dependencies Summary

| Service | Type | Required | Port | Health | Fallback |
|---------|------|----------|------|--------|----------|
| Google Gemini | LLM API | Yes | External | API key valid | None |
| Keycloak | Identity | Yes | 8080 | HTTP probe | None |
| PostgreSQL | Database | Yes | 5432 | pg_isready | None |
| Neo4j | Database | Yes | 7687 | Cypher probe | None |
| Redis | Cache | Yes | 6379 | PING probe | None |
| Keycloak MCP | Service | Yes | 8001 | HTTP /health | None |
| Neo4j MCP | Service | Yes | 8002 | None | None |

---

*Integration audit: 2026-04-29*
