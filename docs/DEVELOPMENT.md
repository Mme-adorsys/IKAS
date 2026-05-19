<!-- generated-by: gsd-doc-writer -->
# IKAS Development Guide

This guide covers local setup, per-service development workflows, hot-reload configuration, extending the system with new LLM providers and MCP tools, coding conventions, and git workflow.

---

## Prerequisites

- **Node.js** >= 18.0.0 (required by all TypeScript services)
- **Python** >= 3.10 (required by `mcp-neo4j`)
- **uv** (recommended Python package manager) or pip
- **Docker** and Docker Compose v2 (for infrastructure services)
- API key for at least one LLM provider (`ANTHROPIC_API_KEY` or `GEMINI_API_KEY`)

---

## Local Setup

### 1. Clone and prepare the repository

```bash
git clone <repository-url>
cd IKAS
```

### 2. Copy environment configuration

```bash
cp .env.example .env   # if an example file exists; otherwise create .env manually
```

Minimum required variables:

```bash
# LLM Provider (choose one or both)
ANTHROPIC_API_KEY=your-anthropic-key
GEMINI_API_KEY=your-google-gemini-key
LLM_PROVIDER=anthropic          # anthropic | gemini | ollama | openai

# Infrastructure (defaults work with Docker Compose)
REDIS_URL=redis://localhost:6379
KEYCLOAK_MCP_URL=http://localhost:8001
NEO4J_MCP_URL=http://localhost:8002
```

### 3. Start infrastructure services

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d keycloak postgres neo4j redis
```

Keycloak takes ~90 seconds to initialise on first run. Use the health check script to confirm readiness:

```bash
./docker/health-check.sh
```

### 4. Install dependencies per service

Each service manages its own `node_modules`. Install in parallel from the project root:

```bash
cd frontend && npm install && cd ..
cd ai-gateway && npm install && cd ..
cd websocket-server && npm install && cd ..
cd keycloak-mcp-server && npm install && cd ..
cd shared-types && npm install && cd ..
```

For the Python MCP service:

```bash
cd mcp-neo4j && uv sync && cd ..
# or: pip install -r requirements.txt
```

---

## Per-Service Development Commands

### Frontend — `frontend/` (Next.js 15, port 3000)

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack (hot-reload) |
| `npm run build` | Production build with Turbopack |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Jest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

```bash
cd frontend
npm run dev
# Application available at http://localhost:3000
```

### AI Gateway — `ai-gateway/` (Express.js + TypeScript, port 8005)

| Command | Description |
|---|---|
| `npm run dev` | Start with `tsx watch` (hot-reload via file watching) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled output |
| `npm run lint` | ESLint on `src/` |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier on `src/**/*.ts` |
| `npm run type-check` | `tsc --noEmit` (no output, type errors only) |
| `npm test` | Run Jest unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run docker:dev` | Start hot-reload Docker container (hot-reload profile) |
| `npm run docker:dev:logs` | Tail logs from hot-reload container |
| `npm run docker:dev:down` | Stop hot-reload container |

```bash
cd ai-gateway
export ANTHROPIC_API_KEY=your-key
export LLM_PROVIDER=anthropic
npm run dev
# API available at http://localhost:8005
```

### WebSocket Server — `websocket-server/` (Socket.io + TypeScript, port 3001)

| Command | Description |
|---|---|
| `npm run dev` | Start with `tsx watch` (hot-reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled output |
| `npm run lint` | ESLint on `src/` |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Jest in watch mode |

```bash
cd websocket-server
npm run dev
# Server available at http://localhost:3001
```

### Keycloak MCP Server — `keycloak-mcp-server/` (port 8001)

```bash
cd keycloak-mcp-server
npm install && npm run build
npm run start:http
# HTTP server on port 8001
```

To watch for changes during development:

```bash
npm run watch   # tsc --watch
```

### Neo4j MCP Server — `mcp-neo4j/` (Python FastMCP, port 8002)

```bash
cd mcp-neo4j
uv sync
# Run with the provided entry point
uv run mcp-neo4j-cypher
```

Refer to `mcp-neo4j/README.md` for transport options (stdio / http / sse).

### Shared Types — `shared-types/`

```bash
cd shared-types
npm install
npm run build     # compile interfaces
npm run watch     # watch mode during active development
```

---

## Hot-Reload Setup

### Local hot-reload (no Docker)

Both `ai-gateway` and `websocket-server` use `tsx watch`, which re-executes the TypeScript entry point on any `src/` file change. No separate configuration is needed — `npm run dev` in each service enables this automatically.

The `frontend` uses Next.js with Turbopack (`next dev --turbopack`), which provides instant module-level hot-reload in the browser.

### Docker hot-reload (AI Gateway)

The Docker Compose dev file includes a `hot-reload` profile that mounts `ai-gateway/src/` into the container:

```bash
# Start the hot-reload container
cd ai-gateway
npm run docker:dev

# Or directly via Docker Compose
cd docker
docker compose -f docker-compose.dev.yml --profile hot-reload up ai-gateway-hot
```

The `ai-gateway-hot` container mounts:
- `../ai-gateway/src` → `/app/src` (source changes trigger restart)
- `../ai-gateway/logs` → `/app/logs` (log files visible on host)

View live logs:

```bash
npm run docker:dev:logs
# or
docker exec ikas-ai-gateway-hot tail -f logs/combined.log
docker exec ikas-ai-gateway-hot tail -f logs/gemini.log
docker exec ikas-ai-gateway-hot tail -f logs/mcp.log
```

---

## Adding a New LLM Provider

The AI Gateway uses a factory pattern defined in `ai-gateway/src/llm/`. Follow these steps:

### Step 1 — Add the provider enum value

Open `ai-gateway/src/llm/llm-interface.ts` and add the new provider to the `LLMProvider` enum:

```typescript
export enum LLMProvider {
  GEMINI = 'gemini',
  OLLAMA = 'ollama',
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  MYPROVIDER = 'myprovider',   // new entry
}
```

Also add capabilities to `PROVIDER_CAPABILITIES` in the same file.

### Step 2 — Implement the service class

Create `ai-gateway/src/llm/myprovider-service.ts`. Extend `LLMService` and implement all abstract methods:

```typescript
import { LLMService, LLMProvider, LLMChatRequest, LLMChatResponse,
         LLMFunctionProcessingResult, LLMFunction, LLMFunctionCall } from './llm-interface';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class MyProviderService extends LLMService {
  public readonly provider = LLMProvider.MYPROVIDER;
  public readonly model: string;

  constructor() {
    super();
    // validate required config
    if (!config.MYPROVIDER_API_KEY) {
      throw new Error('MYPROVIDER_API_KEY is required');
    }
    this.model = 'my-model-id';
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> { /* ... */ }
  async processFunctionCalls(...): Promise<LLMFunctionProcessingResult> { /* ... */ }
  clearChatHistory(sessionId: string): void { /* ... */ }
  async isAvailable(): Promise<boolean> { /* ... */ }
  getActiveSessions(): string[] { /* ... */ }
}
```

### Step 3 — Register in the factory

Open `ai-gateway/src/llm/llm-factory.ts` and add the import and case:

```typescript
import { MyProviderService } from './myprovider-service';

// Inside instantiateProvider():
case LLMProvider.MYPROVIDER:
  return new MyProviderService();
```

Also add the API key validation to `validateProviderConfiguration()`.

### Step 4 — Add config schema entry

Open `ai-gateway/src/utils/config.ts` and add the new key to the Zod schema:

```typescript
MYPROVIDER_API_KEY: z.string().optional(),
```

Add the enum value to the `LLM_PROVIDER` field:

```typescript
LLM_PROVIDER: z.enum(['gemini', 'ollama', 'anthropic', 'openai', 'myprovider']).default('gemini'),
```

### Step 5 — Export from the index

Add the export to `ai-gateway/src/llm/index.ts`:

```typescript
export { MyProviderService } from './myprovider-service';
```

### Step 6 — Write tests

Add a unit test file at `ai-gateway/tests/llm/myprovider-service.test.ts` following the pattern of `anthropic-service.test.ts` or `gemini-service.test.ts`.

---

## Adding a New MCP Tool

MCP tools are exposed by the `keycloak-mcp-server` or `mcp-neo4j` service and automatically discovered by the AI Gateway's `MCPToolDiscovery` class. There are two scenarios:

### A. Adding a tool to an existing MCP server

**Keycloak MCP Server** (`keycloak-mcp-server/src/`): Follow the `@modelcontextprotocol/sdk` tool registration pattern already in the source. Rebuild the server after changes:

```bash
cd keycloak-mcp-server
npm run build
npm run start:http
```

**Neo4j MCP Server** (`mcp-neo4j/src/`): Uses FastMCP. Add the new tool using `@mcp.tool()` decorator in the relevant source file. Restart with `uv run mcp-neo4j-cypher`.

### B. Adding a typed client method in the AI Gateway

The `BaseMCPClient` subclasses (`KeycloakMCPClient`, `Neo4jMCPClient`) in `ai-gateway/src/mcp/` wrap HTTP calls to the MCP servers. Add a typed method for each new tool call:

```typescript
// ai-gateway/src/mcp/keycloak-client.ts
async myNewTool(params: MyParams): Promise<MCPResponse<MyResult>> {
  return this.callTool('my-new-tool', params);
}
```

### C. Updating tool discovery descriptions

The `MCPToolDiscovery` class in `ai-gateway/src/llm/tool-discovery.ts` can enhance tool descriptions to guide the LLM. Add an entry in the `enhanceToolDescription` method if the default description needs clarification for function-calling context.

After any MCP server change, the tool discovery cache (5-minute TTL) will refresh automatically on the next request cycle.

---

## Coding Conventions

### TypeScript

- Use TypeScript strict mode — `tsconfig.json` in each service enables `strict: true`
- Prefer `const` over `let`; avoid `var`
- Use `async/await` over raw Promises
- Write JSDoc comments for all public classes, methods, and interfaces
- Use Zod for runtime schema validation (config, API request bodies)

### Naming

- Files: `kebab-case.ts`
- Classes and interfaces: `PascalCase`
- Functions and variables: `camelCase`
- Constants and enum values: `UPPER_SNAKE_CASE`
- React components: `PascalCase` with file name matching component name

### Error handling

- Always use `try/catch` and surface meaningful error messages
- Use the typed error classes from `ai-gateway/src/types/llm.ts` (`LLMError`, `LLMUnavailableError`, `LLMAuthError`, `LLMRateLimitError`)
- Never swallow exceptions silently — log at minimum with `logger.error`

### Logging

The AI Gateway provides component-specific Winston loggers in `ai-gateway/src/utils/logger.ts`:

```typescript
import { logger, geminiLogger, mcpLogger, RequestTracker } from '../utils/logger';

// Standard logger
logger.info('Operation completed', { sessionId, duration });

// Gemini-specific logger (writes to logs/gemini.log)
geminiLogger.info('LLM response received', { requestId, tokens });

// MCP-specific logger (writes to logs/mcp.log)
mcpLogger.info('Tool call completed', { tool, server, durationMs });
```

Always include a `requestId` correlation field (obtained from `RequestTracker`) on log lines related to a specific request. This enables end-to-end trace reconstruction across services.

### Imports

Organise imports in three groups, separated by blank lines:
1. External packages (e.g., `express`, `winston`)
2. Internal project imports (e.g., `../utils/logger`)
3. Type-only imports (`import type { ... }`)

---

## Build Commands Summary

### AI Gateway (`ai-gateway/`)

| Command | Description |
|---|---|
| `npm run build` | `tsc` — compile to `dist/` |
| `npm run type-check` | `tsc --noEmit` — type errors only |
| `npm run lint` | `eslint src --ext .ts` |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier on `src/**/*.ts` |
| `npm test` | Jest unit tests |
| `npm run test:integration` | Jest integration tests |

### Frontend (`frontend/`)

| Command | Description |
|---|---|
| `npm run build` | Next.js production build |
| `npm run lint` | ESLint via `eslint` |
| `npm run test` | Jest + React Testing Library |
| `npm run test:coverage` | Jest with coverage |

### WebSocket Server (`websocket-server/`)

| Command | Description |
|---|---|
| `npm run build` | `tsc` — compile to `dist/` |
| `npm run lint` | `eslint src --ext .ts` |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm test` | Jest unit tests |

---

## Code Style

### TypeScript services (ai-gateway, websocket-server, keycloak-mcp-server)

- **Linter**: ESLint with `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`
- **Config**: `.eslintrc.*` (or `eslint.config.*`) in each service root
- **Run**: `npm run lint` / `npm run lint:fix`

### Frontend

- **Linter**: ESLint with `eslint-config-next`
- **Config**: `frontend/eslint.config.mjs`
- **Run**: `npm run lint`

There is no project-wide Prettier config at the root; the `ai-gateway` service includes `prettier.config` and a `format` script. Run formatting in that service before committing gateway changes.

---

## Git Workflow

### Branch naming

```
feature/IKAS-<feature-name>
fix/IKAS-<fix-description>
chore/IKAS-<chore-description>
```

Example: `feature/IKAS-openai-provider`

### Commit message format

IKAS uses Conventional Commits with the project scope:

```
feat(IKAS): <component> - <description>
fix(IKAS): <component> - <description>
chore(IKAS): <component> - <description>
docs(IKAS): <component> - <description>
test(IKAS): <component> - <description>
refactor(IKAS): <component> - <description>
```

Examples:

```
feat(IKAS): ai-gateway - add OpenAI provider service
fix(IKAS): websocket-server - resolve session cleanup on disconnect
test(IKAS): ai-gateway - add integration tests for LLM factory
```

### Atomic commits

Each commit should:
- Cover a single logical change
- Leave the codebase in a working state
- Include relevant tests for the change

### Preferred workflow

```bash
# 1. Create feature branch
git checkout -b feature/IKAS-my-feature

# 2. Make changes with incremental commits
git add ai-gateway/src/llm/myprovider-service.ts
git commit -m "feat(IKAS): ai-gateway - implement MyProvider LLM service"

git add ai-gateway/src/llm/llm-factory.ts
git commit -m "feat(IKAS): ai-gateway - register MyProvider in LLM factory"

git add ai-gateway/tests/llm/myprovider-service.test.ts
git commit -m "test(IKAS): ai-gateway - add MyProvider service unit tests"

# 3. Push and open a pull request
git push origin feature/IKAS-my-feature
```

---

## Service Port Reference

| Service | Port | Notes |
|---|---|---|
| Frontend (Next.js) | 3000 / 3002 | 3002 when running alongside other services |
| WebSocket Server | 3001 | Socket.io + health endpoint |
| AI Gateway | 8005 | REST API + health endpoint |
| Keycloak MCP Server | 8001 | HTTP MCP transport |
| Neo4j MCP Server | 8002 | FastMCP HTTP transport |
| Keycloak | 8080 | Admin console: `admin` / `admin` |
| Neo4j Browser | 7474 | Bolt: 7687 — credentials: `neo4j` / `password` |
| Redis | 6379 | |
| PostgreSQL | 5432 | Keycloak backing store |

---

## Next Steps

- See `docs/ARCHITECTURE.md` for system design and component relationships.
- See `docs/CONFIGURATION.md` for the full environment variable reference.
- See `docs/TESTING.md` (if present) for test strategy and coverage requirements.
