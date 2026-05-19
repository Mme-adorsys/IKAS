---
phase: 02-discovery-inventory
plan: "01"
subsystem: agentshield/discovery
tags: [discovery, mcp, keycloak, neo4j, types, tdd]
dependency_graph:
  requires: []
  provides:
    - agentshield/src/types/discovery.ts (DiscoveredServer, ToolDefinition, TransportConfig)
    - agentshield/src/stages/discovery.ts (enumerateServers, probeMcpServer, parseJsonRpcResponse, inventoryServer, DiscoveryStage)
    - agentshield/src/types/report.ts (StageReport.metadata field)
  affects:
    - agentshield/tests/stages/stubs.test.ts (relaxed DiscoveryStage assertion)
tech_stack:
  added: []
  patterns:
    - AbortController timeout pattern for fetch probes
    - Promise.allSettled for parallel port sweep
    - SSE response parsing (data: line extraction)
    - TDD (RED → GREEN → REFACTOR)
key_files:
  created:
    - agentshield/src/types/discovery.ts
    - agentshield/tests/stages/discovery.test.ts
  modified:
    - agentshield/src/stages/discovery.ts
    - agentshield/src/types/report.ts
    - agentshield/tests/stages/stubs.test.ts
decisions:
  - "normalizeBaseUrl converts 127.0.0.1 to localhost for canonical baseUrl deduplication"
  - "probeMcpServer tries /mcp/ first, then /api/mcp/, then /tools — matching IKAS server order"
  - "SSE parser iterates lines and returns on first data: prefix — handles both 'data: ' and 'data:' variants"
  - "inventoryServer is identity function in Phase 2 — enrichment deferred to later phases"
  - "KEYCLOAK_TOOL_DESCRIPTIONS lookup table bridges missing descriptions from GET /tools (returns names only)"
  - "TypeScript strict mode required explicit return-type annotations on mock headers.get() in tests"
metrics:
  duration_seconds: 158
  completed_date: "2026-05-10"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 01: Discovery & Inventory — SUMMARY

Real HTTP probe logic replacing the Phase 1 DiscoveryStage stub: port sweep (8000-8010) with parallel AbortController-bounded probes supporting both Keycloak REST (`/tools`) and Neo4j MCP JSON-RPC over SSE (`/mcp/`, `/api/mcp/`), producing `DiscoveredServer[]` in `StageReport.metadata`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create discovery types and extend StageReport | 6f1d94a | agentshield/src/types/discovery.ts (NEW), agentshield/src/types/report.ts (MODIFIED) |
| 2 | Implement DiscoveryStage with enumerate + inventory | 7008738 | agentshield/src/stages/discovery.ts (REWRITE), agentshield/tests/stages/discovery.test.ts (NEW), agentshield/tests/stages/stubs.test.ts (MODIFIED) |

## Key Implementation Choices

**Transport detection order:** `probeMcpServer` tries `/mcp/` (POST JSON-RPC) first, then `/api/mcp/` (fallback), then `/tools` (GET REST). This matches the IKAS research findings — Neo4j MCP responds at `/mcp/` before Keycloak REST responds at `/tools`.

**SSE parsing:** `parseJsonRpcResponse` checks `content-type: text/event-stream`, splits body on `\n`, and returns the JSON parsed from the first `data:` prefixed line. Handles both `data: ` (with space) and `data:` (without). Worst case: `JSON.parse` throws, caught by outer try in `tryMcpJsonRpcAtPath`, returns null. No process crash (T-02-05 accepted risk).

**URL normalization:** `normalizeBaseUrl` canonicalizes `127.0.0.1` to `localhost` and always includes the port. Prevents duplicate DiscoveredServer entries when the sweep produces both `localhost:8001` and `http://localhost:8001`.

**Tool descriptions:** Keycloak's `GET /tools` returns an array of tool name strings only — no description, inputSchema, or annotations. `KEYCLOAK_TOOL_DESCRIPTIONS` lookup table provides human-readable descriptions for the 8 known tools.

**Timeout enforcement:** Every `fetch` call is wrapped in `fetchWithTimeout` using `AbortController` with 2000ms timeout. `Promise.allSettled` ensures one slow port cannot block the entire sweep. (T-02-03 mitigation per threat model.)

**Threat model compliance:** All JSON parsed from probe responses uses `unknown` cast then narrowed with `Array.isArray`, `typeof === 'string'`, etc. No blind shape assumptions (T-02-01). `new URL(target)` validates the target URL before use (T-02-02). Auth tokens from `config.auth` are never sent in probe headers (T-02-04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript implicit-any errors in test mock headers**

- **Found during:** Task 2 GREEN phase (first test run)
- **Issue:** TypeScript strict mode (`noImplicitAny`) rejected `{ get: () => null }` inside mock response objects because the arrow function lacked an explicit return type. This caused `TS7011` and `TS7023` errors.
- **Fix:** Added explicit `(k: string): string | null =>` type annotation to all `headers.get` mock functions in discovery.test.ts.
- **Files modified:** `agentshield/tests/stages/discovery.test.ts`
- **Commit:** 7008738 (included in Task 2 commit)

## Test Results

- **New tests:** 10 (in `agentshield/tests/stages/discovery.test.ts`)
- **Test suite:** 37 total tests across 6 suites — all pass
- **Type-check:** `npx tsc --noEmit` exits 0 (clean)
- **TDD gates:** RED commit `1937f3c` → GREEN commit `7008738`

### New test coverage

| Describe block | Tests |
|----------------|-------|
| probeMcpServer (Keycloak REST) | 2 |
| probeMcpServer (Neo4j JSON-RPC + SSE) | 3 |
| parseJsonRpcResponse | 2 |
| enumerateServers (port sweep) | 1 |
| DiscoveryStage.run | 2 |

## Hand-off Notes for Plan 02-02 and 02-03

**DiscoveredServer shape** (from `agentshield/src/types/discovery.ts`):

```typescript
interface DiscoveredServer {
  baseUrl: string;           // canonical: 'http://localhost:8001'
  transport: 'mcp-jsonrpc' | 'rest-keycloak' | 'unknown';
  endpoint: string;          // '/tools' or '/mcp/' or '/api/mcp/'
  tools: ToolDefinition[];   // [{name, description?, inputSchema?, annotations?}]
  healthEndpoint?: string;   // '/health' (Keycloak only)
  hasAuth: boolean;          // false in Phase 2 (unauthenticated surface)
  responseTimeMs: number;
}
```

**Where to read it:** `StageReport.metadata.discoveredServers` — the `DiscoveryStage.run()` return value's `metadata` field. Cast as `DiscoveredServer[]`:

```typescript
import { DiscoveredServer } from '../types/discovery';

const discoveryReport = reports.find(r => r.stageId === 'discovery');
const servers = (discoveryReport?.metadata?.discoveredServers ?? []) as DiscoveredServer[];
```

**IKAS endpoint facts confirmed:**
- `http://localhost:8001` → `transport: 'rest-keycloak'`, `endpoint: '/tools'`, 8 tools
- `http://localhost:8002` → `transport: 'mcp-jsonrpc'`, `endpoint: '/mcp/'`, 3 tools (SSE response)

**For 02-02 (Shadow Detection):** Use `servers` array to check `hasAuth`, `tools[].name` for over-permissioned tools, and `healthEndpoint` for unauthenticated health check exposure.

**For 02-03 (CVE Matching):** Use `servers[].transport` to narrow which CVEs apply (`mcp-jsonrpc` vs `rest-keycloak`). Use `tools[].annotations` (when present) for injection surface analysis.

## Known Stubs

- `inventoryServer(server)` is an identity function — returns the input unchanged. Phase 2 discovery already fetches `tools/list`, so inventory is complete for current scope. Future phases may enrich with `version`, `serverName`, resource endpoints.

## Threat Flags

No new network endpoints or auth paths introduced. AgentShield is a probe tool — it only makes outbound HTTP requests to scanned targets. No new attack surface added to IKAS itself.

## Self-Check: PASSED

- [x] `agentshield/src/types/discovery.ts` exists
- [x] `agentshield/src/stages/discovery.ts` exists with all required exports
- [x] `agentshield/tests/stages/discovery.test.ts` exists with 10 tests
- [x] Commits `6f1d94a` and `7008738` exist in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `npm test` exits 0 with 37 tests passing
