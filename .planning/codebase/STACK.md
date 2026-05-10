# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- TypeScript 5.x - Used across all Node.js services (frontend, AI Gateway, WebSocket Server, Keycloak MCP)
- JavaScript ES2020+ - Default for Next.js frontend and Node.js runtime
- Python 3.12.7 - Neo4j MCP server implementation

**Secondary:**
- Bash - Container startup scripts and health checks
- Dockerfile - Multi-stage containerization for all services

## Runtime

**Environment:**
- Node.js 18.0.0+ (required across all Node.js services)
- Python 3.10+ (for Neo4j MCP server)

**Package Manager:**
- npm (v10.x+) - Primary for Node.js services
  - Lockfile: `package-lock.json` present in all Node.js service directories
- uv (Python package manager) - For Neo4j MCP server
  - Lockfile: `uv.lock` for Python dependencies

## Frameworks

**Core UI:**
- Next.js 15.5.0 - React 19.1.0 frontend framework with TypeScript
  - Location: `frontend/`
  - Features: Server-side rendering, API routes, file-based routing

**API/Backend:**
- Express.js 4.19.2 - HTTP server framework for AI Gateway
  - Location: `ai-gateway/src/main.ts`
  - Used for: LLM orchestration endpoints, webhook handlers, health checks
- Socket.io 4.7.5+ - Real-time communication WebSocket framework
  - Location: `websocket-server/src/server.ts`
  - Used for: Bi-directional events, pub/sub messaging with Redis, session management

**LLM & AI:**
- Google Generative AI SDK (@google/generative-ai v0.21.0) - Gemini API integration
  - Location: `ai-gateway/src/llm/gemini-service.ts`
  - Used for: Function calling, multi-turn conversations, prompt processing
- Model Context Protocol SDK (@modelcontextprotocol/sdk v0.5.0) - MCP server framework
  - Location: `keycloak-mcp-server/src/` and `mcp-neo4j/`
  - Used for: Tool definitions, resource management, transport protocols

**Testing:**
- Jest 29.7.0+ - Unit and integration testing framework
  - Config: `jest.config.js` in ai-gateway, websocket-server
  - Used for: TypeScript test suites with ts-jest compiler
- @testing-library/react 16.3.0+ - React component testing utilities
  - Location: Frontend tests in `frontend/src/__tests__/`
  - Used for: DOM queries, user interaction simulation, accessibility testing
- jest-environment-jsdom 30.0.5 - DOM environment for Jest
- supertest 7.1.4 - HTTP assertion library for Express.js testing
  - Location: `ai-gateway/tests/`

**Build/Dev Tools:**
- TypeScript 5.6.2 - Static type checking and compilation
  - Config: `tsconfig.json` in each service
  - All services compile to `dist/` directory with strict mode enabled
- ESLint 8.57.0+ with TypeScript parser - Code linting
  - Config: `eslint.config.mjs` (flat config) in frontend/ai-gateway
  - Plugins: @typescript-eslint/eslint-plugin, eslint-config-next
- Prettier 3.3.3 - Code formatting
  - Config: `.prettierrc` or configured in package.json
- tsx 4.19.0 - TypeScript execution runner for development
  - Used for: `npm run dev` in Node.js services (watches and recompiles)
- Tailwind CSS 4.0 - Utility-first CSS framework
  - Location: Frontend styling in `frontend/src/` components
  - Config: `tailwindcss.config.ts`
- PostCSS 8.x - CSS transformation pipeline for Tailwind
  - Config: `postcss.config.mjs`
- Framer Motion 12.23.12 - Animation library for React
  - Used for: Smooth transitions and interactive UI elements
- D3.js 7.9.0 - Data visualization library
  - Used for: Graph visualization of Neo4j relationships and analytics

## Key Dependencies

**Critical Services:**
- Express.js 4.19.2 - HTTP routing and middleware
- Socket.io 4.7.5+ - WebSocket protocol implementation
- ioredis 5.4.1 - Redis client with pub/sub support
  - Used in: AI Gateway, WebSocket Server
  - Connection: `REDIS_URL` environment variable
- axios 1.11.0 - HTTP client for MCP communication
  - Location: `ai-gateway/src/mcp/client.ts`
  - Used for: Calling Keycloak and Neo4j MCP servers via HTTP

**Admin/Authentication:**
- @keycloak/keycloak-admin-client 22.0.5 - Keycloak REST API client
  - Location: `keycloak-mcp-server/src/services/keycloak-client.ts`
  - Used for: User CRUD, realm management, event queries

**Data Access:**
- Neo4j JavaScript Driver (included in keycloak-mcp-server dependencies) - Graph DB client
  - Location: `keycloak-mcp-server/` imports
- neo4j Python driver (in mcp-neo4j) - Python Neo4j client
  - Connection: `NEO4J_URI` (bolt://neo4j:7687)
- fastmcp 2.10.5+ - FastAPI-based MCP protocol implementation
  - Location: `mcp-neo4j/` server

**Validation & Type Safety:**
- zod 3.23.8 - TypeScript-first schema validation
  - Used in: AI Gateway, WebSocket Server for config/request validation
  - Location: `ai-gateway/src/utils/config.ts` for env var validation

**Logging & Monitoring:**
- winston 3.14.2 - Structured logging library
  - Config: `ai-gateway/src/utils/logger.ts`
  - Outputs: Console, combined.log, component-specific logs (gemini.log, mcp.log)
- prom-client 15.1.3 - Prometheus metrics client
  - Used in: AI Gateway for performance monitoring
  - Exposes: Metrics endpoint for Prometheus scraping

**UI Components:**
- lucide-react 0.540.0 - Icon library for React
  - Used throughout frontend for consistent iconography
- zustand 5.0.8 - Lightweight state management
  - Location: Frontend state stores (alternative to Redux)

**Utilities:**
- uuid 10.0.0 - UUID generation
  - Used for: Request correlation IDs, session IDs
- cors 2.8.5 - CORS middleware
  - Location: Express.js and Socket.io configuration
- dotenv 16.5.0 - Environment variable loading
  - Used in: All services for config management
- rimraf 5.0.0 - Cross-platform rm -rf
  - Used in: Build scripts for cleanup

**Speech Recognition:**
- Web Speech API (native browser API) - Speech-to-text
  - Used in: Frontend for German voice commands ("Hey Keycloak")
  - Configuration: `recognition.lang = 'de-DE'`

## Configuration

**Environment:**
Each service loads configuration from environment variables via `.env` files:

- `frontend/` - No .env file (Next.js public env only)
  - `NEXT_PUBLIC_API_URL` - AI Gateway URL
  - `NEXT_PUBLIC_WS_URL` - WebSocket Server URL
- `ai-gateway/` - `.env` file with zod validation
  - Required: `GEMINI_API_KEY`, `REDIS_URL`, `KEYCLOAK_MCP_URL`, `NEO4J_MCP_URL`
  - Optional: `NODE_ENV` (default: development), `PORT` (default: 8005)
- `websocket-server/` - `.env` file
  - `REDIS_URL` - Redis connection
  - `AI_GATEWAY_URL` - AI Gateway endpoint
  - `CORS_ORIGIN` - Comma-separated CORS origins
- `keycloak-mcp-server/` - `.env` file
  - `KEYCLOAK_URL`, `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`
  - `PORT` (default: 8001)
- `mcp-neo4j/` - Environment variables for Docker
  - `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`

**Build Configuration:**
- TypeScript: `tsconfig.json` with strict mode, lib ES2020, module commonjs (Node.js) or esnext (browser)
- Next.js: `next.config.ts` with Turbopack bundler enabled
- Jest: `jest.config.js` with ts-jest preset and jsdom environment
- ESLint: `eslint.config.mjs` using flat config format
- Tailwind: `tailwindcss.config.ts` with content paths and custom theme
- PostCSS: `postcss.config.mjs` with tailwindcss plugin

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- Python 3.10+ (for Neo4j MCP server)
- Docker & Docker Compose (for containerized development)
- npm or pnpm (modern package manager)

**Production:**
- Container runtime (Docker/Kubernetes)
- PostgreSQL 15+ (for Keycloak persistence)
- Neo4j 5.15+ (graph database)
- Redis 7.2+ (caching and pub/sub)
- Keycloak 24.0 (identity provider)

**Services Architecture:**
- 8 containerized services orchestrated via Docker Compose
- Network: `ikas-network` (Docker bridge network)
- Health checks: All services include liveness/readiness probes

---

*Stack analysis: 2026-04-29*
