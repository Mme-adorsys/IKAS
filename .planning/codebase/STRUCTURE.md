# Codebase Structure

**Analysis Date:** 2026-04-29

## Directory Layout

```
IKAS/
├── frontend/                   # Next.js 15 React application with TypeScript
│   ├── src/
│   │   ├── app/                # Next.js app router (page.tsx, layout.tsx)
│   │   ├── components/         # React components (dashboard, panels, UI)
│   │   ├── services/           # Service layer (websocket.ts, voice.ts)
│   │   ├── store/              # Zustand state management
│   │   └── types/              # TypeScript interfaces (events, speech-recognition)
│   ├── public/                 # Static assets (favicon, images)
│   ├── package.json            # Next.js dependencies
│   ├── tsconfig.json           # TypeScript config
│   ├── next.config.ts          # Next.js configuration
│   └── jest.config.js          # Jest testing configuration
│
├── ai-gateway/                 # Express.js TypeScript orchestration service
│   ├── src/
│   │   ├── main.ts             # Express server entry point
│   │   ├── api/                # Route handlers (orchestration.ts, health.ts)
│   │   ├── orchestration/      # Orchestrator logic (orchestrator.ts, routing.ts, sync.ts)
│   │   ├── llm/                # Gemini integration (gemini-service.ts, tool-discovery.ts)
│   │   ├── mcp/                # MCP client wrappers (client.ts, keycloak-client.ts, neo4j-client.ts)
│   │   ├── websocket/          # WebSocket client (client.ts, index.ts)
│   │   ├── types/              # TypeScript definitions (orchestration.ts, mcp.ts, index.ts)
│   │   ├── utils/              # Utilities (logger.ts, config.ts)
│   │   └── [service]/          # Future service modules
│   ├── tests/
│   │   ├── unit/               # Unit tests (mcp/, orchestration/)
│   │   └── integration/        # Integration tests
│   ├── logs/                   # Log files (combined.log, gemini.log, mcp.log)
│   ├── dist/                   # Compiled JavaScript output
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
│
├── websocket-server/           # Socket.io real-time communication
│   ├── src/
│   │   ├── server.ts           # Socket.io server entry point
│   │   ├── rooms/              # Room management (session-manager.ts)
│   │   ├── redis/              # Redis pub/sub (event-publisher.ts, event-subscriber.ts)
│   │   ├── events/             # Event handling (handlers.ts)
│   │   ├── types/              # TypeScript definitions (session.ts, events.ts)
│   │   └── utils/              # Utilities
│   ├── tests/                  # Test files
│   ├── dist/                   # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
│
├── keycloak-mcp-server/        # Keycloak MCP HTTP server (external)
│   ├── src/
│   │   ├── index.ts            # Main entry point
│   │   ├── tools/              # Tool implementations
│   │   └── types/              # Type definitions
│   ├── dist/                   # Compiled output
│   └── package.json
│
├── mcp-neo4j/                  # Neo4j MCP Python FastAPI server (external)
│   ├── src/
│   │   ├── main.py             # FastAPI server
│   │   ├── tools/              # Tool implementations
│   │   └── schemas/            # Pydantic schemas
│   └── requirements.txt
│
├── shared-types/               # Shared TypeScript type definitions
│   ├── src/
│   │   ├── events.ts           # Event type definitions
│   │   ├── orchestration.ts    # Orchestration types
│   │   ├── mcp.ts              # MCP types
│   │   ├── voice.ts            # Voice-related types
│   │   └── index.ts            # Export all types
│   ├── dist/                   # Compiled JavaScript
│   ├── package.json
│   └── tsconfig.json
│
├── docker/                     # Docker & container configuration
│   ├── docker-compose.dev.yml  # Development services (Keycloak, Neo4j, Redis, PostgreSQL)
│   ├── Dockerfile.ai-gateway   # AI Gateway image
│   ├── Dockerfile.websocket    # WebSocket server image
│   ├── Dockerfile.frontend     # Frontend image
│   ├── Dockerfile.keycloak-mcp # Keycloak MCP image
│   ├── Dockerfile.neo4j-mcp    # Neo4j MCP image
│   ├── health-check.sh         # Service health verification script
│   └── [other docker files]
│
├── docs/                       # Project documentation
│   ├── arc42.md                # System architecture documentation
│   ├── ikas-implementation-plan.md  # Implementation roadmap
│   ├── mcp-tools-reference.md  # Available MCP tools
│   └── [other documentation]
│
├── tests/                      # Integration tests
│   ├── mcp-integration-test.js # MCP server connectivity tests
│   ├── test-logging.js         # Logging verification
│   └── test-*.js               # Other test scripts
│
├── scripts/                    # Development utility scripts
│   ├── start-dev.sh            # Start all services
│   ├── build.sh                # Build all services
│   └── [other scripts]
│
├── .planning/                  # Planning and analysis documents (this directory)
│   └── codebase/               # Codebase analysis documents
│       ├── ARCHITECTURE.md     # Architecture patterns and layers
│       ├── STRUCTURE.md        # This file - directory structure
│       ├── CONVENTIONS.md      # Coding standards and patterns
│       ├── TESTING.md          # Testing strategies and patterns
│       ├── STACK.md            # Technology stack
│       ├── INTEGRATIONS.md     # External integrations
│       └── CONCERNS.md         # Technical debt and issues
│
├── README.md                   # Project overview
├── CLAUDE.md                   # Development guidelines for Claude
├── package.json                # Root package (for shared dependencies)
├── .env.example                # Environment variable template
├── .env                        # Environment variables (NOT committed)
├── .gitignore                  # Git ignore rules
├── docker-compose.yml          # Production docker compose (if applicable)
└── [config files]
```

## Directory Purposes

**frontend/** - User interface and client-side logic
- Purpose: React/Next.js application with voice interface and real-time dashboard
- Contains: Page components, React components for panels, services for API/WebSocket communication
- Key files: `src/app/page.tsx` (entry), `src/components/dashboard/IKASDashboard.tsx` (main UI)

**ai-gateway/** - LLM orchestration and MCP coordination service
- Purpose: Express.js backend that coordinates between Gemini LLM and MCP servers
- Contains: Orchestrator (decision logic), LLM integration, MCP clients, REST API handlers
- Key files: `src/main.ts` (server), `src/orchestration/orchestrator.ts` (core logic)

**websocket-server/** - Real-time communication hub
- Purpose: Socket.io server for real-time events between all components
- Contains: Session management, event pub/sub, connection handlers
- Key files: `src/server.ts` (entry), `src/rooms/session-manager.ts` (sessions)

**keycloak-mcp-server/** - Keycloak administration tools
- Purpose: MCP server exposing Keycloak admin operations as tools
- Status: External service, runs independently
- Key files: `src/index.ts` (server)

**mcp-neo4j/** - Neo4j graph database tools
- Purpose: MCP server for Neo4j queries and analysis
- Status: External service, runs independently
- Key files: `src/main.py` (FastAPI server)

**shared-types/** - Shared TypeScript types
- Purpose: Centralized type definitions used by frontend and backends
- Contains: Event types, schemas, interfaces
- Key files: `src/events.ts`, `src/orchestration.ts`, `src/mcp.ts`

**docker/** - Container orchestration
- Purpose: Docker images and compose files for local development
- Contains: Dockerfiles for all services, docker-compose for infrastructure
- Key files: `docker-compose.dev.yml` (dev environment)

**docs/** - Project documentation
- Purpose: Architecture documentation, implementation plans, tool references
- Key files: `arc42.md` (system architecture), `ikas-implementation-plan.md` (roadmap)

**tests/** - Integration test suite
- Purpose: Test MCP connectivity and system integration
- Key files: `mcp-integration-test.js`, `test-logging.js`

**.planning/codebase/** - Code analysis and mapping documents
- Purpose: Living documentation for architecture, structure, conventions, and quality
- Consumed by: `/gsd-plan-phase` and `/gsd-execute-phase` commands

## Key File Locations

**Entry Points:**
- Frontend: `frontend/src/app/page.tsx` - Next.js page component
- Frontend layout: `frontend/src/app/layout.tsx` - Global layout, styling setup
- AI Gateway: `ai-gateway/src/main.ts` - Express server initialization
- WebSocket: `websocket-server/src/server.ts` - Socket.io server startup

**Configuration:**
- Frontend: `frontend/tsconfig.json`, `frontend/next.config.ts`
- AI Gateway: `ai-gateway/src/utils/config.ts`, `tsconfig.json`
- Environment: `.env` (local), `.env.example` (template)
- Docker: `docker/docker-compose.dev.yml`

**Core Logic:**
- Orchestration: `ai-gateway/src/orchestration/orchestrator.ts` - Main coordination
- Routing: `ai-gateway/src/orchestration/routing.ts` - Strategy determination
- LLM: `ai-gateway/src/llm/gemini-service.ts` - Google Gemini integration
- MCP clients: `ai-gateway/src/mcp/keycloak-client.ts`, `neo4j-client.ts`
- Session mgmt: `websocket-server/src/rooms/session-manager.ts`

**Testing:**
- Frontend tests: `frontend/src/components/dashboard/__tests__/`, `frontend/src/services/__tests__/`
- AI Gateway tests: `ai-gateway/tests/unit/`, `ai-gateway/tests/integration/`
- Integration tests: `tests/mcp-integration-test.js`

**Types & Schemas:**
- Shared types: `shared-types/src/*.ts`
- Orchestration types: `ai-gateway/src/types/orchestration.ts`
- MCP types: `ai-gateway/src/types/mcp.ts`
- Event types: `websocket-server/src/types/events.ts`

## Naming Conventions

**Files:**
- `.ts` files: camelCase with service/class names (e.g., `gemini-service.ts`, `session-manager.ts`)
- `.tsx` files: PascalCase for React components (e.g., `IKASDashboard.tsx`, `VoicePanel.tsx`)
- Test files: `*.test.ts` or `*.spec.ts` suffix (e.g., `websocket.test.ts`)
- Config files: `config.ts` or `.config.ts` or `[name].config.js`

**Directories:**
- Feature directories: plural nouns (e.g., `components/`, `services/`, `utils/`)
- Feature subdirectories: kebab-case or specific category (e.g., `dashboard/`, `orchestration/`)
- Test directories: `__tests__/` (co-located) or `tests/` (separate)

**Exports:**
- Classes: PascalCase (e.g., `class Orchestrator`, `class SessionManager`)
- Functions: camelCase (e.g., `function determineExecutionStrategy()`)
- Constants: UPPER_SNAKE_CASE (e.g., `const WEBSOCKET_TIMEOUT = 5000`)
- Enums: PascalCase (e.g., `enum ExecutionStrategy`)

**Variables & Functions:**
- Private methods/properties: camelCase with underscore prefix (e.g., `_toolResults`, `_setupHandlers()`)
- Public methods/properties: camelCase (e.g., `processRequest()`, `chatHistory`)
- Boolean variables: prefix with `is`, `has`, or `should` (e.g., `isListening`, `hasError`)

## Where to Add New Code

**New Voice Command Feature:**
- Primary logic: `ai-gateway/src/orchestration/routing.ts` (add keywords to RoutingPattern)
- Tool definition: Add new tool to MCP server (keycloak-mcp-server or mcp-neo4j)
- Discovery: `ai-gateway/src/llm/tool-discovery.ts` (maps tools to Gemini functions)
- UI: Add panel in `frontend/src/components/dashboard/` (e.g., `NewFeaturePanel.tsx`)
- Tests: `ai-gateway/tests/unit/orchestration/` or `frontend/src/components/dashboard/__tests__/`

**New Microservice:**
- Create directory: `new-service/` at root level
- Structure: Follow pattern of ai-gateway or websocket-server
- Docker: Add `docker/Dockerfile.new-service` and entry in `docker-compose.dev.yml`
- Types: Add interfaces to `shared-types/src/new-types.ts`
- Integration: Register in main orchestrator or event handlers

**New Component/Module:**
- Component: `frontend/src/components/[feature]/NewComponent.tsx`
- Service: `frontend/src/services/new-service.ts` or `ai-gateway/src/[layer]/new-module.ts`
- Tests: Co-locate as `NewComponent.test.tsx` or `new-service.test.ts`
- Types: Add to relevant `src/types/` file or create new `types/new-types.ts`

**Utilities & Helpers:**
- Frontend utils: `frontend/src/utils/` or feature-specific `services/`
- Backend utils: `ai-gateway/src/utils/` with files like `logger.ts`, `config.ts`, `validators.ts`
- Shared: `shared-types/src/utils/` if used by multiple services

**State Management:**
- Frontend global state: `frontend/src/store/index.ts` (Zustand store)
- Component state: React hooks (useState, useEffect) within component
- Server session state: Redis (SessionManager in websocket-server)
- Transient data: In-memory Map/object (clear on session end)

## Special Directories

**ai-gateway/logs/**
- Purpose: Application logs from AI Gateway service
- Generated: At runtime by Winston logger
- Committed: No (in .gitignore)
- Files: `combined.log`, `gemini.log`, `mcp.log`

**frontend/public/**
- Purpose: Static assets served by Next.js
- Generated: No
- Committed: Yes
- Usage: Favicon, images, static content

**frontend/.next/**
- Purpose: Next.js build artifacts
- Generated: Yes (via `npm run build`)
- Committed: No
- Usage: Production build output

**shared-types/dist/**
- Purpose: Compiled JavaScript from TypeScript in shared-types
- Generated: Yes (via `npm run build`)
- Committed: No
- Usage: CommonJS output consumed by ai-gateway

**ai-gateway/dist/**
- Purpose: Compiled JavaScript from TypeScript in ai-gateway
- Generated: Yes (via `npm run build`)
- Committed: No
- Usage: Production server runtime

**docker/**
- Purpose: Container images and orchestration
- Generated: Docker images from Dockerfiles
- Committed: Yes (code), No (built images)
- Usage: Local development and deployment

**node_modules/**
- Purpose: Installed npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)
- Usage: Runtime dependencies for each service

**.env Files**
- `.env`: Local environment variables (contains secrets, NOT committed)
- `.env.example`: Template showing required variables (committed for reference)
- Usage: Load via dotenv library at service startup

---

*Structure analysis: 2026-04-29*
