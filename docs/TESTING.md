<!-- generated-by: gsd-doc-writer -->
# TESTING.md — IKAS Test Guide

This document covers the test strategy, commands, and setup requirements for all services in the IKAS monorepo.

---

## Test Framework and Setup

IKAS uses **Jest** as the primary test framework across all TypeScript services. The frontend uses Jest with `jest-environment-jsdom` via `next/jest`; all backend services use Jest with `ts-jest`.

| Service | Framework | Config File |
|---|---|---|
| `frontend/` | Jest 30 + `@testing-library/react` | `frontend/jest.config.js` |
| `ai-gateway/` | Jest 29 + `ts-jest` | `ai-gateway/jest.config.js` |
| `websocket-server/` | Jest + `ts-jest` | `websocket-server/` (default) |
| `keycloak-mcp-server/` | Jest + `ts-jest` | `keycloak-mcp-server/` (default) |
| `agentshield/` | Jest 29 + `ts-jest` | `agentshield/jest.config.js` |

**Prerequisites before running any tests:**

```bash
# Install dependencies in each service you want to test
cd frontend && npm install
cd ../ai-gateway && npm install
cd ../agentshield && npm install
cd ../websocket-server && npm install
```

---

## Running Tests

### Frontend (`frontend/`)

The frontend has 79 passing tests covering React components and service logic.

```bash
cd frontend

# Run the full test suite
npm run test

# Run in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

Test files are co-located with source under `src/`:

- `src/services/__tests__/websocket.test.ts`
- `src/services/__tests__/voice.test.ts`
- `src/components/dashboard/__tests__/VoicePanel.test.tsx`
- `src/components/dashboard/__tests__/EventsPanel.test.tsx`
- `src/components/dashboard/__tests__/SystemStatus.test.tsx`

### AI Gateway (`ai-gateway/`)

```bash
cd ai-gateway

# Run all unit tests
npm test

# Run only integration tests
npm run test:integration

# Run in watch mode
npm run test:watch

# Run integration tests with live Docker services (see Integration Tests section)
npm run test:with-services
```

Test files are organized under `tests/`:

**Unit tests** (`tests/unit/`):
- `llm/anthropic-service.test.ts`
- `llm/gemini-service.test.ts`
- `llm/llm-factory.test.ts`
- `llm/llm-interface.test.ts`
- `llm/ollama-service.test.ts`
- `llm/tool-discovery.test.ts`
- `mcp/keycloak-client.test.ts`
- `orchestration/orchestrator.test.ts`
- `orchestration/routing.test.ts`
- `api.test.ts`

**Integration tests** (`tests/integration/`):
- `api.test.ts`

The `tests/setup.ts` file sets `NODE_ENV=test`, stubs `GEMINI_API_KEY`, configures MCP URL defaults, suppresses Winston logs, and mocks `axios` globally. The `global-setup.js` loads `.env.test` if present.

### WebSocket Server (`websocket-server/`)

```bash
cd websocket-server

# Run tests
npm run test

# Run in watch mode
npm run test:watch
```

### AgentShield (`agentshield/`)

AgentShield is the MCP security scanner. Tests cover the CLI, config loading, and the scan runner.

```bash
cd agentshield

# Run all tests
npm test

# Run in watch mode
npm run test:watch
```

Test files under `tests/`:

- `tests/runner.test.ts` — `ScanRunner` lifecycle, stage filtering, report output
- `tests/config.test.ts` — config loading and validation
- `tests/cli.test.ts` — CLI argument parsing and `--version` / `--help` output

The `runner.test.ts` tests make real HTTP requests to `http://localhost:8001` (Keycloak MCP). Run with the Keycloak MCP service running, or mock the HTTP layer for offline runs.

---

## Coverage Requirements

No coverage thresholds are configured in any `jest.config.js` file. Coverage collection is enabled for the following source paths:

| Service | Collected From |
|---|---|
| `frontend/` | `src/**/*.{js,jsx,ts,tsx}` (excludes `.d.ts`, `_app.tsx`, `_document.tsx`) |
| `ai-gateway/` | `src/**/*.ts` (excludes `.d.ts`, test files) |
| `agentshield/` | `src/**/*.ts` (excludes `.d.ts`, test files) |

Coverage reports are written to `coverage/` in each service directory and include `text`, `lcov`, and `html` reporters (backend services) and Next.js defaults (frontend).

---

## Integration Tests with Live Services

### `npm run test:integration` (ai-gateway)

Runs only files matching the `integration` path pattern inside `ai-gateway/tests/integration/`. External services are mocked by default via `jest.mock('axios')` in `tests/setup.ts`. To run against real MCP endpoints, override the environment variables before running:

```bash
cd ai-gateway
export KEYCLOAK_MCP_URL=http://localhost:8001
export NEO4J_MCP_URL=http://localhost:8002
export REDIS_URL=redis://localhost:6379
npm run test:integration
```

### `npm run test:with-services` (ai-gateway)

Runs `scripts/test-with-services.sh`, which:

1. Starts a dedicated Docker Compose stack (`docker/docker-compose.test.yml`) with isolated port mappings to avoid conflicts with the development stack:

   | Service | Test Port |
   |---|---|
   | PostgreSQL | 5433 |
   | Redis | 6380 |
   | Neo4j (HTTP) | 7475 |
   | Neo4j (Bolt) | 7688 |
   | Keycloak | 8081 |
   | Keycloak MCP | 8001 |
   | Neo4j MCP | 8002 |

2. Waits for all containers to report a `healthy` status via Docker health checks.
3. Runs `npm test -- --testPathPattern=integration --verbose --detectOpenHandles`.
4. Tears down all containers on exit (even on failure or Ctrl-C).

**Requirements:** Docker and Docker Compose must be installed. Building the MCP images requires the `keycloak-mcp-server/Dockerfile` and `mcp-neo4j/Dockerfile` to be present.

```bash
cd ai-gateway
npm run test:with-services

# Keep services running after tests for manual inspection
KEEP_SERVICES=true npm run test:with-services
```

### `tests/mcp-integration-test.js` (root-level)

A standalone Node.js script that spawns the MCP server processes directly and tests tool connectivity. Requires the compiled MCP server artifacts to exist:

```bash
# Build keycloak-mcp-server first
cd keycloak-mcp-server && npm run build && cd ..

# Run the integration test (requires Keycloak on port 8080)
node tests/mcp-integration-test.js
```

---

## Writing New Tests

### File Naming Conventions

| Pattern | Used In |
|---|---|
| `**/*.test.ts` | All backend services (`ai-gateway`, `agentshield`, `websocket-server`) |
| `**/*.spec.ts` | Accepted but not currently used |
| `src/**/__tests__/*.test.ts(x)` | Frontend components and services |

### Test Helpers and Setup Files

- `ai-gateway/tests/setup.ts` — Jest `setupFilesAfterEnv` for the gateway: sets env vars, stubs logger, mocks axios, resets mocks in `beforeEach`.
- `ai-gateway/tests/global-setup.js` / `global-teardown.js` — Jest `globalSetup`/`globalTeardown` hooks; load `.env.test` and set default URLs.
- `agentshield/tests/setup.ts` — Minimal setup; add global hooks here as needed.
- `frontend/jest.setup.js` — Loaded via `setupFilesAfterEnv`; configures `@testing-library/jest-dom` matchers.
- `frontend/src` module alias `@/` maps to `src/` for imports in tests.

### Adding Tests for a New ai-gateway Module

1. Create the test file in `ai-gateway/tests/unit/<category>/your-module.test.ts`.
2. Existing mocks (`axios`, `ioredis`) are already set up globally. Add service-specific mocks with `jest.mock('../../../src/path/to/module')`.
3. For integration-style tests that should run with live services, place the file under `ai-gateway/tests/integration/` — it will be included by `npm run test:integration` automatically.

---

## Manual Smoke Tests (Root-Level Scripts)

The project root contains a set of Node.js scripts for end-to-end smoke testing against a running stack. All scripts target `http://localhost:8005` (AI Gateway) or `http://localhost:3001` (WebSocket Server) by default.

**Prerequisite:** All services must be running. Start them with:

```bash
cd docker && docker-compose -f docker-compose.dev.yml up -d
```

| Script | Purpose |
|---|---|
| `quick-test.js` | Sends a single chat request to `/api/chat` and prints the response |
| `comprehensive-test.js` | Runs a multi-command test suite covering user management and analysis flows |
| `advanced-compliance-test.js` | Tests compliance analysis commands end-to-end |
| `demo-readiness-check.js` | Validates AI Gateway health, Anthropic integration, and model switching |
| `final-demo-test.js` | Full demo scenario validation |
| `test-ai-gateway-commands.js` | Tests specific chat command patterns |
| `test-ai-gateway-health.js` | Checks the AI Gateway health endpoint (`localhost:8006/health` in some versions) |
| `test-complete-functionality.js` | Broad functional coverage across all API endpoints |
| `test-follow-up-request.js` | Tests multi-turn conversation continuity |
| `test-keycloak-tools.js` | Tests all 58 Keycloak MCP tools via the AI Gateway |
| `test-logging.js` | Verifies enhanced logging output from a live chat request |
| `test-sync-request.js` | Validates the Keycloak-to-Neo4j sync workflow |
| `test-text-functionality.js` | Tests text processing and response formatting |
| `test-websocket-health.js` | Checks the WebSocket server health endpoint at `localhost:3001/health` |

Run any script directly with Node:

```bash
node quick-test.js
node test-keycloak-tools.js
node demo-readiness-check.js
```

Note: Several scripts use ES module `import` syntax. If you see a syntax error, run them with the `--input-type=module` flag or ensure your Node.js version is >= 18 with ES module support:

```bash
node --input-type=module < quick-test.js
```

---

## CI Integration

No CI workflow files (`.github/workflows/`) were detected in the repository. Test commands must be run manually or wired into a CI pipeline. The recommended pipeline steps per service are:

```bash
# Frontend
cd frontend && npm ci && npm run test

# AI Gateway (unit only, no Docker required)
cd ai-gateway && npm ci && npm test

# AgentShield
cd agentshield && npm ci && npm test

# AI Gateway integration (requires Docker)
cd ai-gateway && npm run test:with-services
```
