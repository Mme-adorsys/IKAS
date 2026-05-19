<!-- generated-by: gsd-doc-writer -->
# IKAS Architecture

IKAS (Intelligentes Keycloak Admin System) is an AI-powered Keycloak administration system. Users interact via a voice interface in the browser, which routes commands through a WebSocket server to an AI Gateway. The gateway selects an LLM provider, uses function calling to invoke MCP tool servers (Keycloak MCP and Neo4j MCP), and streams responses back through the same chain. The system follows a layered, event-driven architecture with Redis pub/sub as the backbone for real-time distribution.

---

## System Overview Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           IKAS System Architecture                               │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   Browser / Client  │
│   (Next.js :3002)   │
│                     │
│  • Web Speech API   │
│  • "Hey IKAS"       │
│  • Model selector   │
│  • D3.js graph viz  │
│  • Zustand state    │
└─────────┬───────────┘
          │ Socket.io (bidirectional)
          ▼
┌─────────────────────┐          ┌──────────────────┐
│  WebSocket Server   │          │      Redis        │
│  (Socket.io :3001)  │◄────────►│   (:6379)         │
│                     │  pub/sub │                  │
│  • Session mgmt     │          │  • Event topics   │
│  • Event routing    │          │  • Session data   │
│  • Room management  │          │  • Caching        │
└─────────┬───────────┘          └──────────────────┘
          │ HTTP POST /api/chat
          ▼
┌─────────────────────┐
│    AI Gateway       │
│  (Express :8005)    │
│                     │
│  • LLM Factory      │
│  • Orchestrator     │
│  • IntelligentRouter│
│  • Tool Discovery   │
│  • Winston logging  │
└──────┬──────┬───────┘
       │      │
       │      │ HTTP (tool calls)
       ▼      ▼
┌──────────┐ ┌──────────────┐
│Keycloak  │ │  Neo4j MCP   │
│MCP Server│ │  (FastMCP    │
│(Node.js  │ │   Python     │
│  :8001)  │ │   :8002)     │
│          │ │              │
│8 tools   │ │3 tools       │
└────┬─────┘ └──────┬───────┘
     │               │
     ▼               ▼
┌──────────┐   ┌──────────────┐
│ Keycloak │   │    Neo4j     │
│  :8080   │   │  :7474/7687  │
│(admin/   │   │(neo4j/       │
│ admin)   │   │ password)    │
└──────────┘   └──────────────┘
     │
     ▼
┌──────────┐
│PostgreSQL│
│  :5432   │
│(keycloak/│
│ keycloak)│
└──────────┘

External LLM Providers (called by AI Gateway):
  ┌───────────────┐  ┌───────────┐  ┌────────┐  ┌────────┐
  │ Anthropic API │  │Google API │  │OpenAI  │  │Ollama  │
  │(Claude Opus   │  │(Gemini Pro│  │(GPT-4) │  │(local) │
  │  4.1)         │  │)          │  │        │  │        │
  └───────────────┘  └───────────┘  └────────┘  └────────┘
```

---

## Data Flow

A complete request follows this path from voice utterance to rendered response:

1. **Voice capture** — The browser uses the Web Speech API (`recognition.lang = 'en-US'`) to transcribe speech. Hotword detection matches `"hey ikas"` before passing the command downstream.
2. **Socket.io emission** — The frontend emits a `voiceCommand` or `textCommand` event to the WebSocket Server.
3. **Session lookup** — The WebSocket Server (`websocket-server/src/server.ts`) retrieves the session from Redis via `SessionManager`, then publishes an `IKASEvent` through `EventPublisher`.
4. **HTTP forwarding** — `forwardToAIGateway()` makes an HTTP POST to `http://localhost:8005/api/chat` with the transcribed message and session ID.
5. **Orchestration** — The AI Gateway's `Orchestrator` determines an `ExecutionStrategy` via `IntelligentRouter`, discovers MCP tools, builds an `LLMChatRequest`, and invokes the active LLM service.
6. **LLM function calling** — The LLM returns function call instructions referencing Keycloak or Neo4j tools. The Orchestrator dispatches HTTP calls to the appropriate MCP server.
7. **MCP tool execution** — The Keycloak MCP Server or Neo4j MCP Server executes the tool (e.g., `list-users`, `read_neo4j_cypher`) and returns structured data.
8. **Response chain** — Results flow back: MCP server → AI Gateway (synthesises a natural language response) → WebSocket Server (`VOICE_RESPONSE` event published to Redis) → frontend socket listener → rendered in the dashboard.

---

## Components

### Frontend (`frontend/` — Next.js 15, port 3002)

The single-page application rendered by `src/app/page.tsx` mounts the `IKASDashboard` component. Key responsibilities:

- **Voice interface** — `Web Speech API` with `en-US` locale. Hotword phrases: `hey ikas`, `ikas`. Model-switch phrases map spoken words to provider identifiers (`switch to claude` → `anthropic`, `switch to gemini` → `gemini`).
- **Real-time communication** — Socket.io client connects to the WebSocket Server, emitting `voiceCommand` and `textCommand` events, and listening for `voiceCommandReceived`, `connected`, and graph update events.
- **Model selector** — Dropdown calls `POST /api/models/switch` on the AI Gateway. State is managed with Zustand.
- **Graph visualisation** — D3.js renders Neo4j relationship data. The frontend subscribes to `graph:update` socket events that carry node and edge delta payloads.
- **Component structure** — `src/components/` subdivided into `chat/`, `common/`, `dashboard/`, `prompts/`.

### WebSocket Server (`websocket-server/` — Socket.io/TypeScript, port 3001)

Entry point: `src/server.ts` (`IKASWebSocketServer` class).

- Accepts Socket.io connections over `websocket` and `polling` transports.
- `SessionManager` creates and expires user sessions stored in Redis.
- `EventPublisher` / `EventSubscriber` wrap ioredis for pub/sub. All system events are typed as `IKASEvent` with an `EventType` enum covering `VOICE_COMMAND`, `VOICE_RESPONSE`, and analysis lifecycle states.
- The `handleVoiceCommand` / `handleTextCommand` handlers normalise both input paths to the same `IKASEvent` shape before calling `forwardToAIGateway()`.
- Health endpoint: `GET /health` responds with connection count and service name.
- Configured via environment variables: `PORT` (3001), `REDIS_URL`, `AI_GATEWAY_URL` (http://localhost:8005), `SESSION_TIMEOUT`.

### AI Gateway (`ai-gateway/` — Express.js/TypeScript, port 8005)

Entry point: `src/main.ts`. Mounts two routers:

- `/health` — health checks
- `/api` — orchestration router (`src/api/orchestration.ts`)

**API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Gateway and MCP service health |
| `GET` | `/api/status` | Orchestrator session count and tool cache state |
| `GET` | `/api/tools` | Discover all MCP tools from both servers |
| `POST` | `/api/chat` | Process a user message through LLM + MCP |
| `GET` | `/api/models` | List available LLM providers and current selection |
| `POST` | `/api/models/switch` | Switch the active LLM provider |
| `DELETE` | `/api/chat/:sessionId` | Clear a session's conversation history |
| `POST` | `/api/tools/refresh` | Force a tool cache refresh |
| `POST` | `/api/cleanup` | Trigger session cleanup |

Request validation uses Zod schemas (`chatRequestSchema`, `switchModelSchema`). The 10 MB request body limit is set at the Express layer.

**Key internal modules:**

- `src/orchestration/orchestrator.ts` — `Orchestrator` class: strategy selection, tool filtering, pre-processing, LLM invocation, MCP tool dispatch, and response assembly.
- `src/orchestration/routing.ts` — `IntelligentRouter` class (see Orchestration Strategies section).
- `src/orchestration/sync.ts` — `DataSynchronizer`: syncs Keycloak user data into Neo4j on demand.
- `src/llm/llm-factory.ts` — `LLMFactory` (see LLM Factory Pattern section).
- `src/llm/tool-discovery.ts` — `MCPToolDiscovery`: queries both MCP `/health` endpoints and caches the combined tool list.
- `src/mcp/keycloak-client.ts` / `src/mcp/neo4j-client.ts` — typed HTTP wrappers for each MCP server.
- `src/utils/logger.ts` — Winston logger with component-specific transports (see Logging section).

### Keycloak MCP Server (`keycloak-mcp-server/` — Node.js/TypeScript, port 8001)

An HTTP MCP server built on `@modelcontextprotocol/sdk` and `@keycloak/keycloak-admin-client`.

**Available tools:**

| Tool | Description |
|------|-------------|
| `create-user` | Create a new user in a realm |
| `delete-user` | Delete a user by ID |
| `list-users` | List users in a realm with optional filters |
| `list-realms` | List all Keycloak realms |
| `list-admin-events` | Retrieve administrative audit events |
| `get-event-details` | Retrieve details for a specific event |
| `list-user-events` | Retrieve user-triggered events |
| `get-metrics` | Retrieve Keycloak performance metrics |

Tool handlers are split across files: `src/tools/user-tools.ts`, `src/tools/realm-tools.ts`, `src/tools/event-tools.ts`, `src/tools/metrics-tools.ts`, `src/tools/group-tools.ts`, `src/tools/role-tools.ts`, `src/tools/client-tools.ts`.

Environment: `KEYCLOAK_URL`, `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`.

### Neo4j MCP Server (`mcp-neo4j/` — Python FastMCP, port 8002)

A Python FastMCP server exposing Cypher execution capabilities.

**Available tools:**

| Tool | Description |
|------|-------------|
| `get_neo4j_schema` | Inspect labels, relationship types, and property keys |
| `read_neo4j_cypher` | Execute read-only Cypher queries |
| `write_neo4j_cypher` | Execute write Cypher queries |

Environment: `NEO4J_URI` (bolt://localhost:7687), `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`.

Neo4j is deployed with the APOC and Graph Data Science plugins enabled.

### Shared Types (`shared-types/`)

TypeScript interfaces published as a local package and imported by the AI Gateway. Key files:

- `src/orchestration.ts` — `ExecutionStrategy` enum, `OrchestrationRequest`, `OrchestrationResponse`, `DataFreshnessCheck`, `SyncResult`, `IntentAnalysis`, `OrchestrationGraphUpdate`.
- `src/mcp.ts` — `MCPToolCall`, `MCPResponse`, `ToolDefinition`.
- `src/voice.ts` — Voice event types.
- `src/api.ts` — API request/response shapes.
- `src/graph.ts` — Graph node and edge types for D3 visualisation.
- `src/compliance.ts` — Compliance check result types.

### AgentShield (`agentshield/`)

A security and agent-testing framework with its own CLI (`src/cli.ts`), configuration loader (`src/config/`), test runner (`src/runner/`), and test stage definitions (`src/stages/`). Used for pre-deployment agent safety validation.

---

## LLM Factory Pattern

The AI Gateway uses a singleton factory (`src/llm/llm-factory.ts`) to manage LLM provider instances. All LLM interaction goes through the `LLMService` interface (`src/llm/llm-interface.ts`), making provider switching transparent to the `Orchestrator`.

**Provider enum (`LLMProvider`):** `ANTHROPIC`, `GEMINI`, `OLLAMA`, `OPENAI`.

**Instantiation flow:**

```
LLMFactory.createLLMService(overrideProvider?)
  └─ getProviderConfig()           // reads LLM_PROVIDER, LLM_MODEL env vars
  └─ validateProviderConfiguration // checks API key presence
  └─ instantiateProvider(provider)
       ├─ ANTHROPIC → new AnthropicService()   // Claude Opus 4.1
       ├─ GEMINI    → new GeminiService()       // Gemini Pro
       ├─ OLLAMA    → require('./ollama-service') (dynamic)
       └─ OPENAI    → require('./openai-service') (dynamic)
```

The factory holds a static `instance` and `currentProvider`. Calling `createLLMService` with the same provider returns the cached singleton. Calling `switchProvider(newProvider)` validates availability before replacing the singleton.

**Runtime switching:** `POST /api/models/switch` accepts `provider`, `model`, or `modelId`. The endpoint calls `orchestrator.switchLLMProvider(targetProvider)` which resets the factory and creates a new service instance. An optional `sessionId` parameter clears the session's conversation history so the new provider starts with a clean context window.

**Health check:** `LLMFactory.checkCurrentProviderHealth()` delegates to `instance.isAvailable()` on the active service.

**Configuration environment variables:**

| Variable | Purpose |
|----------|---------|
| `LLM_PROVIDER` | Active provider (`anthropic`, `gemini`, `ollama`, `openai`) |
| `LLM_MODEL` | Model identifier (e.g., `claude-opus-4-1-20250805`) |
| `LLM_TEMPERATURE` | Sampling temperature (default `0.1`) |
| `LLM_MAX_TOKENS` | Max output tokens (default `8192`) |
| `ANTHROPIC_API_KEY` | Required for Anthropic |
| `GEMINI_API_KEY` | Required for Gemini |
| `OPENAI_API_KEY` | Required for OpenAI |
| `OLLAMA_BASE_URL` | Required for Ollama |

---

## MCP Orchestration Strategies

The `IntelligentRouter` (`src/orchestration/routing.ts`) selects an `ExecutionStrategy` by scanning the user input for keyword sets. The strategy is then executed by the `Orchestrator`.

### Keyword-Based Routing

```
Input keyword sets
  writeKeywords:      ['erstelle', 'create', 'lösche', 'delete', 'update', 'ändere', ...]
  freshDataKeywords:  ['aktuell', 'current', 'latest', 'jetzt', 'live', ...]
  analysisKeywords:   ['analysiere', 'analyze', 'finde', 'pattern', 'duplikat', ...]
```

### Strategy Descriptions

| Strategy | Enum Value | When Used | MCP Path |
|----------|-----------|-----------|----------|
| `KEYCLOAK_WRITE_THEN_SYNC` | `keycloak_write_then_sync` | Write keywords detected (create/delete/update) | Keycloak MCP write tool → trigger Neo4j sync |
| `KEYCLOAK_FRESH_DATA` | `keycloak_fresh_data` | Fresh/live data keywords detected | Keycloak MCP read tools only |
| `NEO4J_ANALYSIS_ONLY` | `neo4j_analysis_only` | Analysis keywords + graph data is fresh | Neo4j MCP only |
| `SYNC_THEN_ANALYZE` | `sync_then_analyze` | Analysis keywords + graph data is stale | Keycloak MCP → sync to Neo4j → Neo4j MCP |
| `COORDINATED_MULTI_MCP` | `coordinated_multi_mcp` | Default (no specific keywords matched) | Both MCP servers |

### Data Freshness

Before choosing between `NEO4J_ANALYSIS_ONLY` and `SYNC_THEN_ANALYZE`, `IntelligentRouter.checkGraphDataFreshness()` queries Neo4j for a `Metadata` node carrying `lastUpdated`. If the age exceeds the 30-minute threshold (`freshnessThreshold`), a sync is triggered. If the freshness check itself fails, the router conservatively picks `SYNC_THEN_ANALYZE`.

### Tool Filtering by Intent

The `Orchestrator` maps strategies to intent labels and filters the discovered tool list before passing it to the LLM:

```
intent = 'read'    → exclude tools whose name contains 'create' or 'delete'
intent = 'write'   → include only tools containing 'create', 'delete', or 'write'
intent = 'analyze' → include only tools containing 'get', 'read', or 'query'
intent = 'all'     → pass all discovered tools
```

---

## Logging Architecture

The AI Gateway uses Winston with three output targets configured in `src/utils/logger.ts`:

| File | Content |
|------|---------|
| `logs/combined.log` | All log levels, pretty-printed JSON |
| `logs/error.log` | Error-level events only |
| `logs/gemini.log` | Gemini LLM operations (labelled `GEMINI`) |
| `logs/mcp.log` | MCP service calls (labelled `MCP`) |

A `RequestTracker` utility assigns a UUID `requestId` to each incoming request. The ID is attached to every log entry within that request's lifecycle, enabling cross-component correlation across the combined log.

Development format: `YYYY-MM-DD HH:mm:ss.SSS [LEVEL] [requestId-prefix] message\n{metadata JSON}`.
Production format: structured JSON.

---

## Infrastructure

| Service | Port(s) | Credentials | Notes |
|---------|---------|-------------|-------|
| Keycloak | 8080 | admin / admin | `quay.io/keycloak/keycloak:24.0`, PostgreSQL backend |
| PostgreSQL | 5432 | keycloak / keycloak | `postgres:13-alpine`, Keycloak backend DB |
| Neo4j | 7474 (HTTP), 7687 (Bolt) | neo4j / password | `neo4j:5.15` with APOC and Graph Data Science plugins |
| Redis | 6379 | none | `redis:7.2-alpine`, AOF persistence enabled |

All containers run on the `ikas-network` Docker bridge network. Health checks are defined for each service in `docker/docker-compose.dev.yml`.

---

## Directory Structure

```
IKAS/
├── frontend/              Next.js 15 voice UI and dashboard
├── websocket-server/      Socket.io real-time communication hub
├── ai-gateway/            Express.js LLM orchestration and MCP coordination
│   └── src/
│       ├── api/           Route handlers (orchestration, health)
│       ├── llm/           LLM Factory, service implementations, tool discovery
│       ├── mcp/           HTTP clients for Keycloak and Neo4j MCP servers
│       ├── orchestration/ Orchestrator, IntelligentRouter, DataSynchronizer
│       ├── types/         Local TypeScript types (extends shared-types)
│       └── utils/         Logger (Winston + RequestTracker), config
├── keycloak-mcp-server/   Node.js MCP server with 8 Keycloak admin tools
├── mcp-neo4j/             Python FastMCP server with 3 Cypher tools
├── shared-types/          TypeScript interfaces shared across packages
├── agentshield/           Security and agent-testing framework (CLI, runner, stages)
├── docker/                Docker Compose files and health check scripts
├── scripts/               Development and demo setup scripts
└── tests/                 Integration tests for MCP and system flows
```

---

## Key Design Decisions

1. **MCP as the integration boundary** — Both Keycloak and Neo4j are accessed exclusively through their MCP servers. The AI Gateway never connects to these systems directly. This decouples the LLM orchestration logic from infrastructure-specific client libraries and enables the MCP servers to be replaced or extended independently.

2. **LLM provider abstraction via Factory + Interface** — A single `LLMService` interface means the `Orchestrator` code is unaware of which provider is active. Provider switches at runtime do not require an application restart; the factory replaces its singleton and the next request uses the new provider.

3. **Strategy-driven tool selection** — Rather than exposing all tools to the LLM on every request, the `IntelligentRouter` narrows the tool set by detected intent. This reduces token usage and lowers the probability of the LLM selecting an inappropriate tool.

4. **Redis as the real-time event backbone** — The WebSocket Server does not maintain in-process state for event distribution. All events are published to Redis topics, allowing future horizontal scaling of the WebSocket tier without changing the event contract.

5. **Shared types package** — A dedicated `shared-types/` package enforces a single source of truth for `ExecutionStrategy`, `OrchestrationRequest`, `MCPToolCall`, and related interfaces. Both the AI Gateway and the WebSocket Server import from this package, preventing type drift between services.

6. **Voice and text commands unified** — The WebSocket Server maps both `voiceCommand` and `textCommand` socket events to the same `IKASEvent` structure and processing path. This simplifies the AI Gateway API: it receives a plain `message` string regardless of input modality.
