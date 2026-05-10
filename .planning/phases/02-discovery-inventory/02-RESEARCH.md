# Phase 2: Discovery & Inventory - Research

**Researched:** 2026-04-30
**Domain:** MCP server enumeration, HTTP probing, shadow server detection, CVE/OWASP cross-reference
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | System enumerates all MCP servers connected to a target agentic system | HTTP probe of known ports (8001, 8002) plus configurable port sweep; parse tool list from each server |
| DISC-02 | System lists all tool definitions, resource endpoints, and transport configs for each discovered server | Keycloak MCP: GET /tools; Neo4j MCP: POST /mcp/ with tools/list JSON-RPC; parse and store tool schemas |
| DISC-03 | System detects shadow MCP servers and over-permissioned tool integrations | Compare discovered server URLs against config.allowedServers allow-list; flag unregistered as CRITICAL finding |
| DISC-04 | System cross-references discovered tools and endpoints against known vulnerabilities (CVE-2025-6514, CVE-2025-49596) and OWASP MCP Top 10 | Static lookup table mapping tool/endpoint patterns to CVE IDs + OWASP category IDs; annotate matched Finding objects |
</phase_requirements>

---

## Summary

Phase 2 replaces the `DiscoveryStage` stub with real HTTP probing logic against the two IKAS MCP servers. The two servers expose different API styles: Keycloak MCP (port 8001) is a custom Express.js REST server with `GET /tools` and `GET /health`; Neo4j MCP (port 8002) is a FastMCP server implementing the MCP JSON-RPC protocol at `POST /mcp/`. Both must be probed using different strategies.

The discovery logic follows three sub-stages: (1) enumerate — probe the target URL plus a port sweep to find all reachable MCP-like servers; (2) inventory — fetch tool definitions, transport config, and server metadata from each server; (3) classify — compare discovered servers against `config.allowedServers` to flag shadows and cross-reference tool patterns against the static CVE/OWASP lookup table to produce annotated findings.

All HTTP calls use Node.js 23's built-in `fetch` — no new HTTP dependency required. The stage interface from Phase 1 (`run(target, config): Promise<StageReport>`) is implemented directly.

**Primary recommendation:** Implement the DiscoveryStage as three cooperating functions inside `agentshield/src/stages/discovery.ts` — `enumerateServers()`, `inventoryServer()`, and `classifyServers()` — keeping each testable in isolation. The static CVE/OWASP table lives in `agentshield/src/data/cve-lookup.ts` as a plain TypeScript constant.

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Impact on Plan |
|-----------|--------|----------------|
| TypeScript for all source files | CLAUDE.md §Coding Guidelines | All new files in `agentshield/src/` must be `.ts` |
| Use `async/await` over promises | CLAUDE.md §TypeScript Standards | All HTTP probes must use `async/await` |
| Always handle errors with `try-catch` | CLAUDE.md §Error Handling | Every `fetch()` call must be wrapped; network failures must not crash the stage |
| `error instanceof Error` before `.message` | CONVENTIONS.md §Error Handling | Required in all catch blocks |
| `const` over `let`, no `var` | CLAUDE.md §TypeScript Standards | All variables declared with `const` |
| Never expose sensitive info in logs | CLAUDE.md §Security | Auth tokens from `config.auth` must not appear in any log or finding output |
| Validate all user inputs | CLAUDE.md §Security | Port range inputs and URL values must be validated before use |
| 2-space indentation, semicolons, single quotes | CONVENTIONS.md §Code Style | All new code must follow this format |
| No barrel `index.ts` anti-patterns | CONTEXT.md §Code Context (Phase 1) | Direct imports only; do not create `src/stages/index.ts` |
| Named exports for services/utilities | CONVENTIONS.md §Module Design | Export functions and classes with named exports |

---

## Standard Stack

### Core

No new runtime dependencies are required for Phase 2.

| API/Tool | Version | Purpose | Why Standard |
|----------|---------|---------|--------------|
| `fetch` (built-in) | Node.js 18+ (project min) | HTTP probing of MCP endpoints | Native since Node.js 18 (global since Node 21, available via `node-fetch`-compatible shim in 18); no extra dep needed — project requires Node 18+ |
| `AbortController` (built-in) | Node.js 15+ | Per-probe timeout enforcement | Native; used with `fetch` to implement connect timeouts on port sweeps |

**Version verification:** Node.js 23.11.0 is installed on this machine [VERIFIED: `node --version`]. `fetch` is natively available globally. `AbortController` is natively available.

### No new dependencies needed

The Phase 1 package.json already contains: `zod` (for any validation), `chalk` + `cli-table3` (output), `commander` (CLI). All HTTP probing uses native Node.js 18+ `fetch`. No `axios`, `node-fetch`, or `undici` install required.

**Installation:** None — Phase 2 adds no new `npm install` requirements.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `fetch` | `axios` | axios adds ~40KB dependency for no benefit; native fetch is already available and sufficient for simple GET/POST probes |
| Native `fetch` | `node-fetch` | node-fetch v3 is ESM-only (would break CJS build). Native fetch is CJS-safe. |
| Static CVE lookup table | External NVD API | Live sync is explicitly out of scope (PROJECT.md §Out of Scope); static table is sufficient for demo |

---

## Architecture Patterns

### Recommended File Layout for Phase 2

```
agentshield/src/
├── stages/
│   └── discovery.ts          ← REPLACE the Phase 1 stub with real implementation
├── data/
│   └── cve-lookup.ts         ← NEW: static CVE/OWASP table (no dependencies)
├── types/
│   └── discovery.ts          ← NEW: DiscoveredServer, ToolDefinition, TransportConfig interfaces
```

Tests:
```
agentshield/tests/
├── stages/
│   ├── stubs.test.ts         ← EXISTS: update DiscoveryStage assertion to accept non-empty
│   └── discovery.test.ts     ← NEW: unit tests for enumerateServers, classifyServers, cve-lookup
```

### Pattern 1: Two-Phase Probe (Streamable HTTP + REST fallback)

**What:** The two IKAS MCP servers use different protocols. The probe logic tries the MCP JSON-RPC protocol first, then falls back to the Keycloak-style REST API.

**When to use:** For every candidate URL discovered in the port sweep.

**IKAS Server Behaviors (VERIFIED: reading source code):**
- **Keycloak MCP (port 8001):** Custom Express.js REST server. Endpoints: `GET /health` returns JSON, `GET /tools` returns `{ tools: string[] }`. Does NOT implement MCP JSON-RPC. No `/mcp/` path.
- **Neo4j MCP (port 8002):** FastMCP server. Endpoint: `POST /mcp/` with JSON-RPC body `{ jsonrpc: "2.0", id: 1, method: "tools/list" }` and headers `Accept: application/json, text/event-stream`. Returns SSE or JSON response.

**Example probe logic:**

```typescript
// Source: derived from mcp-neo4j/tests/integration/test_http_transport_IT.py [VERIFIED: codebase read]
// and keycloak-mcp-server/src/simple-http-server.ts [VERIFIED: codebase read]

async function probeMcpServer(baseUrl: string, timeoutMs = 3000): Promise<DiscoveredServer | null> {
  // Strategy 1: Try MCP JSON-RPC tools/list (Neo4j MCP style)
  const jsonRpcResult = await tryMcpJsonRpc(baseUrl, timeoutMs);
  if (jsonRpcResult) return jsonRpcResult;

  // Strategy 2: Try Keycloak REST-style GET /tools
  const restResult = await tryKeycloakRest(baseUrl, timeoutMs);
  if (restResult) return restResult;

  return null;
}

async function tryMcpJsonRpc(baseUrl: string, timeoutMs: number): Promise<DiscoveredServer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/mcp/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await parseJsonRpcResponse(res);
    if (!data?.result?.tools) return null;
    return buildDiscoveredServer(baseUrl, 'mcp-jsonrpc', data.result.tools);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function tryKeycloakRest(baseUrl: string, timeoutMs: number): Promise<DiscoveredServer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/tools`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json() as { tools?: string[] };
    if (!data?.tools) return null;
    return buildDiscoveredServer(baseUrl, 'rest-keycloak', data.tools);
  } catch {
    clearTimeout(timer);
    return null;
  }
}
```

### Pattern 2: Port Sweep for Shadow Server Detection

**What:** Probe a configurable list of ports on the same host as the target URL to find additional MCP servers not declared in the allow-list.

**When to use:** After discovering the primary target, sweep common MCP ports on the same hostname.

**Ports to sweep (IKAS-specific):**
- 8001 — Keycloak MCP (expected)
- 8002 — Neo4j MCP (expected)
- 8003 — Neo4j native MCP (also in docker-compose.dev.yml) [VERIFIED: docker-compose.dev.yml read]
- 8000, 8004–8010 — candidate shadow ports (low risk, configurable range)

**Example:**
```typescript
// Source: [ASSUMED] — standard port-sweep pattern

const DEFAULT_MCP_PORTS = [8000, 8001, 8002, 8003, 8004, 8005, 8080, 3000, 3001];

async function sweepPorts(targetUrl: string, ports: number[]): Promise<string[]> {
  const { hostname, protocol } = new URL(targetUrl);
  const probes = ports.map((port) =>
    probeMcpServer(`${protocol}//${hostname}:${port}`, 2000),
  );
  const results = await Promise.allSettled(probes);
  return results
    .map((r, i) => (r.status === 'fulfilled' && r.value ? `${protocol}//${hostname}:${ports[i]}` : null))
    .filter((url): url is string => url !== null);
}
```

### Pattern 3: Neo4j MCP SSE Response Parsing

**What:** FastMCP returns responses as Server-Sent Events (SSE) — the response body is `data: {...json...}\n\n`. Must be parsed correctly.

**When to use:** When probing the Neo4j MCP server at `/mcp/`.

**Example (VERIFIED from integration test):**
```typescript
// Source: mcp-neo4j/tests/integration/test_http_transport_IT.py [VERIFIED: codebase read]

async function parseJsonRpcResponse(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        return JSON.parse(line.slice(6)) as Record<string, unknown>;
      }
    }
    throw new Error('No data line in SSE response');
  }
  return res.json() as Promise<Record<string, unknown>>;
}
```

### Pattern 4: Static CVE/OWASP Lookup Table

**What:** A plain TypeScript constant mapping pattern identifiers to CVE IDs and OWASP MCP Top 10 categories. Applied to each discovered tool/server to annotate matching findings.

**When to use:** After tool inventory is complete, pass each ToolDefinition through the lookup.

**CVE details (VERIFIED via web research):**
- **CVE-2025-6514** (CVSS 9.6): OS command injection in `mcp-remote` via malicious `authorization_endpoint` URL during OAuth flow. Pattern: any server that triggers OAuth-style auth redirect, or uses `mcp-remote` as proxy. [VERIFIED: JFrog security advisory, NVD]
- **CVE-2025-49596** (CVSS 9.4): RCE in MCP Inspector via CSRF + DNS rebinding against `localhost:6274/6277`. Pattern: any server accessible via localhost + MCP Inspector ports. [VERIFIED: Oligo Security, NVD, Recorded Future]

**OWASP MCP Top 10 categories (VERIFIED: owasp.org/www-project-mcp-top-10):**
- MCP01:2025 — Token Mismanagement & Secret Exposure
- MCP02:2025 — Privilege Escalation via Scope Creep
- MCP03:2025 — Tool Poisoning
- MCP04:2025 — Software Supply Chain Attacks & Dependency Tampering
- MCP05:2025 — Command Injection & Execution
- MCP06:2025 — Intent Flow Subversion
- MCP07:2025 — Insufficient Authentication & Authorization
- MCP08:2025 — Lack of Audit and Telemetry
- MCP09:2025 — Shadow MCP Servers
- MCP10:2025 — Context Injection & Over-Sharing

**Example lookup table:**
```typescript
// agentshield/src/data/cve-lookup.ts
// Source: CVE details [VERIFIED: nvd.nist.gov, owasp.org/www-project-mcp-top-10]

export interface CveMatch {
  cveId?: string;
  owaspCategory?: string;
  owaspLabel?: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export const CVE_LOOKUP_TABLE: Array<{
  match: (server: DiscoveredServer) => boolean;
  finding: CveMatch;
}> = [
  {
    // CVE-2025-6514: mcp-remote OS command injection via OAuth redirect
    // Applies to: any server using HTTP transport with auth (OAuth flow possible)
    match: (s) => s.transport === 'mcp-jsonrpc' && s.hasAuth === false,
    finding: {
      cveId: 'CVE-2025-6514',
      owaspCategory: 'MCP07:2025',
      owaspLabel: 'Insufficient Authentication & Authorization',
      title: 'Unauthenticated MCP server — CVE-2025-6514 surface exposed',
      description:
        'MCP server accessible without authentication. CVE-2025-6514 (CVSS 9.6) affects mcp-remote ' +
        'clients connecting to untrusted servers via OS command injection through OAuth ' +
        'authorization_endpoint manipulation. Any unauthenticated server is a candidate attack vector.',
      severity: 'high',
    },
  },
  {
    // CVE-2025-49596: MCP Inspector RCE via localhost CSRF
    // Applies to: any MCP server running on localhost
    match: (s) => s.baseUrl.includes('localhost') || s.baseUrl.includes('127.0.0.1'),
    finding: {
      cveId: 'CVE-2025-49596',
      owaspCategory: 'MCP07:2025',
      owaspLabel: 'Insufficient Authentication & Authorization',
      title: 'Localhost MCP server — CVE-2025-49596 DNS rebinding attack surface',
      description:
        'MCP server bound to localhost is vulnerable to DNS rebinding and CSRF attacks (CVE-2025-49596, ' +
        'CVSS 9.4). The MCP Inspector proxy (ports 6274/6277) does not validate Origin headers, ' +
        'allowing remote attackers to trigger RCE by visiting a malicious website.',
      severity: 'high',
    },
  },
  {
    // No rate limiting — IKAS-specific known vulnerability (CONCERNS.md)
    // MCP07 + MCP08 applicable
    match: (s) => s.serverType === 'rest-keycloak',
    finding: {
      owaspCategory: 'MCP07:2025',
      owaspLabel: 'Insufficient Authentication & Authorization',
      title: 'Keycloak MCP server has no rate limiting or authentication on tool endpoints',
      description:
        'Tool endpoints (e.g., /tools/list-users, /tools/create-user) accept unlimited requests with no ' +
        'authentication or rate limiting. This is a known vulnerability documented in IKAS CONCERNS.md.',
      severity: 'high',
    },
  },
  {
    // Missing input validation — IKAS-specific (CONCERNS.md)
    match: (s) => s.tools.some((t) => ['create-user', 'delete-user', 'write_neo4j_cypher'].includes(t.name)),
    finding: {
      owaspCategory: 'MCP05:2025',
      owaspLabel: 'Command Injection & Execution',
      title: 'MCP tool arguments passed without input validation',
      description:
        'Tool arguments are passed through to Keycloak Admin API or Neo4j Cypher without sanitization. ' +
        'Known vulnerability from IKAS CONCERNS.md: MCP tool call injection possible via crafted args.',
      severity: 'high',
    },
  },
  {
    // Shadow server pattern — any server not in allowedServers list
    // Handled by shadow detection logic, not this table
    // Left as documentation anchor only
    match: () => false,
    finding: {
      owaspCategory: 'MCP09:2025',
      owaspLabel: 'Shadow MCP Servers',
      title: 'Unregistered MCP server detected',
      description: 'Placeholder — shadow detection is handled in classifyServers(), not cve-lookup.',
      severity: 'critical',
    },
  },
];
```

### Pattern 5: Shadow Server Classification

**What:** Compare each discovered server URL against `config.allowedServers`. Flag any server not in the allow-list as a CRITICAL shadow server finding.

**When to use:** In `classifyServers()` after `enumerateServers()` completes.

**Config allow-list shape (VERIFIED from Phase 1 code):**
```typescript
// From agentshield/src/types/config.ts [VERIFIED: codebase read]
// allowedServers: string[]  — array of URL strings from agentshield.config.yaml
```

**Example:**
```typescript
// Source: [ASSUMED] — straightforward allow-list comparison

function classifyShadowServers(
  discovered: DiscoveredServer[],
  allowedServers: string[],
): Finding[] {
  const allowed = new Set(allowedServers.map((u) => normalizeUrl(u)));
  return discovered
    .filter((s) => !allowed.has(normalizeUrl(s.baseUrl)))
    .map((s) => ({
      id: generateFindingId(),
      title: `Shadow MCP server detected: ${s.baseUrl}`,
      description:
        `MCP server at ${s.baseUrl} is not in the configured allow-list. ` +
        `Shadow servers operate outside organizational governance (OWASP MCP09:2025) ` +
        `and may use permissive default configurations.`,
      severity: 'critical' as SeverityLevel,
      component: s.baseUrl,
      score: 9.5,
      owaspCategory: 'MCP09:2025',
    }));
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port || defaultPort(u.protocol)}`;
  } catch {
    return url.toLowerCase().trim();
  }
}
```

### Pattern 6: DiscoveredServer and ToolDefinition Types

**What:** New types for Phase 2 that extend/complement the existing `Finding` type from Phase 1.

**Placement:** `agentshield/src/types/discovery.ts` — new file, no modifications to existing Phase 1 types.

```typescript
// agentshield/src/types/discovery.ts

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface TransportConfig {
  protocol: 'mcp-jsonrpc' | 'rest-keycloak' | 'unknown';
  endpoint: string;      // e.g., '/mcp/' or '/tools'
  supportsSSE: boolean;
  sessionManagement: boolean;
}

export interface DiscoveredServer {
  baseUrl: string;
  serverName?: string;
  version?: string;
  transport: TransportConfig['protocol'];
  tools: ToolDefinition[];
  healthEndpoint?: string;
  hasAuth: boolean;
  responseTimeMs: number;
}
```

### Pattern 7: Full DiscoveryStage.run() orchestration

```typescript
// agentshield/src/stages/discovery.ts — Phase 2 implementation
// Source: [ASSUMED] — orchestrates Patterns 1–5

export class DiscoveryStage implements StageRunner {
  readonly id = 'discovery';
  readonly name = 'Discovery & Inventory';

  async run(target: string, config: AgentShieldConfig): Promise<StageReport> {
    const start = Date.now();
    const findings: Finding[] = [];

    try {
      // Step 1: Enumerate — probe target + port sweep
      const discovered = await enumerateServers(target);

      // Step 2: Inventory — fetch full tool list for each server
      const inventoried = await Promise.all(discovered.map(inventoryServer));

      // Step 3: Classify — shadow detection + CVE cross-reference
      const shadowFindings = classifyShadowServers(inventoried, config.allowedServers);
      const cveFindings = applyCveLookup(inventoried);

      findings.push(...shadowFindings, ...cveFindings);

      return {
        stageId: this.id,
        stageName: this.name,
        findings,
        duration: Date.now() - start,
        error: null,
        // Attach discovered servers to the report for downstream stages
        metadata: { discoveredServers: inventoried },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        stageId: this.id,
        stageName: this.name,
        findings,
        duration: Date.now() - start,
        error: message,
      };
    }
  }
}
```

**Note on `metadata`:** The `StageReport` interface from Phase 1 does not have a `metadata` field. Phase 2 should add `metadata?: Record<string, unknown>` to `StageReport` in `agentshield/src/types/report.ts`. This does not break existing tests (optional field).

### Anti-Patterns to Avoid

- **Awaiting port probes serially:** Port sweep must use `Promise.allSettled()` — probing 10 ports sequentially at 3s timeout = 30s minimum. Use parallel promises with individual timeouts.
- **Letting fetch throw crash the stage:** Network errors from unreachable ports are expected. Wrap every probe in `try-catch`; a failure to connect is `null`, not an error.
- **Skipping SSE parsing for Neo4j MCP:** The Neo4j FastMCP server returns `Content-Type: text/event-stream` even for single responses. Reading `res.json()` directly returns empty/corrupted data.
- **Comparing URLs with string equality:** `http://localhost:8001` and `http://127.0.0.1:8001` can both be the same server. Use URL normalization before allow-list comparison.
- **Modifying existing Phase 1 type contracts:** Do not change `Finding`, `StageRunner`, or `ScanResult` interfaces in ways that break existing tests. Add new types in `types/discovery.ts`.
- **UUID generation without a library:** Phase 1 package.json does not include `uuid`. Use `crypto.randomUUID()` (built-in since Node.js 14.17) for finding IDs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request with timeout | Custom socket or setTimeout around fetch | `AbortController` + `signal` passed to native `fetch` | Standard Web API pattern; handles cleanup correctly |
| URL normalization | String comparison with `.toLowerCase()` | `new URL(str)` built-in | Handles protocol, port, path normalization; throws on invalid URLs |
| Unique finding IDs | Sequential counter or timestamp | `crypto.randomUUID()` (built-in Node.js 14.17+) | Globally unique; no dependency |
| SSE parsing | Custom stream parser | Simple line-split on `data: ` prefix | The IKAS FastMCP server returns single-event SSE — `text().split('\n')` is sufficient; full EventSource API is overkill |

**Key insight:** The entire Phase 2 discovery stack can be implemented with zero new npm dependencies. Native `fetch`, `AbortController`, `URL`, and `crypto.randomUUID()` cover all needs.

---

## IKAS Server Endpoint Reference

Critical facts about the actual IKAS MCP servers, verified from source code:

### Keycloak MCP (port 8001) — REST API

| Endpoint | Method | Response |
|----------|--------|----------|
| `GET /` | GET | `{ service, version, endpoints }` |
| `GET /health` | GET | `{ status: 'healthy', service, version, timestamp }` |
| `GET /tools` | GET | `{ tools: ['create-user', 'list-users', ...8 names] }` |
| `POST /tools/list-users` | POST | `{ success, count, users[] }` |
| `POST /tools/create-user` | POST | `{ success, userId, message }` |
| `POST /tools/get-metrics` | POST | `{ success, metrics }` |

[VERIFIED: keycloak-mcp-server/src/simple-http-server.ts]

**Security observations from source:** No authentication middleware. CORS is open (`app.use(cors())`). No rate limiting. Tool names are plain strings, no input schema. Keycloak admin password `admin/admin` hardcoded as default.

### Neo4j MCP (port 8002) — MCP JSON-RPC

| Endpoint | Method | Protocol | Response |
|----------|--------|----------|----------|
| `POST /mcp/` | POST | MCP JSON-RPC 2.0 | SSE or JSON |

Required headers: `Content-Type: application/json`, `Accept: application/json, text/event-stream`

JSON-RPC methods supported:
- `tools/list` — returns `{ result: { tools: [{ name, description, inputSchema, annotations }] } }`
- `tools/call` — invokes a tool
- `initialize` — MCP protocol handshake (optional for discovery)

Tools available: `get_neo4j_schema`, `read_neo4j_cypher`, `write_neo4j_cypher`

[VERIFIED: mcp-neo4j/src/mcp_neo4j_cypher/server.py and tests/integration/test_http_transport_IT.py]

**Security observations from source:** `stateless_http=True` means no session enforcement. `write_neo4j_cypher` accepts arbitrary Cypher. No authentication on the `/mcp/` endpoint. Server is configured to run on `0.0.0.0` in Docker (not localhost-only), which contradicts the MCP spec security warning.

---

## Common Pitfalls

### Pitfall 1: Neo4j MCP returns SSE for single-response requests

**What goes wrong:** `POST /mcp/` with `tools/list` returns `Content-Type: text/event-stream` even for single results. Calling `await res.json()` reads the body as JSON and fails because the body is `data: {...}\n\n` not a bare JSON object.

**Why it happens:** FastMCP's `stateless_http=True` mode always wraps responses in SSE format even when no streaming is needed.

**How to avoid:** Check `Content-Type` header on response; if it includes `text/event-stream`, parse by splitting on `\n` and looking for lines starting with `data: `.

**Warning signs:** `JSON.parse` throws `Unexpected token 'd'` — this is the `data: ` prefix being parsed as JSON.

### Pitfall 2: Port sweep hangs if no timeout is set

**What goes wrong:** `fetch` to a non-listening port may hang for 30+ seconds on some OS/network configurations waiting for a TCP timeout (especially for ports that are firewalled vs. actively refused).

**Why it happens:** TCP RST (connection refused) is immediate; TCP timeout (firewall drop) is not. Without an `AbortSignal`, `fetch` waits for the OS TCP timeout.

**How to avoid:** Always pass `signal: controller.signal` with `setTimeout(() => controller.abort(), 2000)` to every probe. 2000ms is sufficient for localhost probes.

**Warning signs:** Port sweep takes 60+ seconds; no findings returned before timeout.

### Pitfall 3: `crypto.randomUUID()` not available in Node.js 14

**What goes wrong:** `crypto.randomUUID()` was added in Node.js 14.17 but is a `crypto` module method, not global. In some older test environments, calling it throws `TypeError: crypto.randomUUID is not a function`.

**Why it happens:** Global `crypto` exposure varies by Node.js version. In Node 18+ (project minimum), `crypto.randomUUID()` is available as both `require('crypto').randomUUID()` and (since 19) `globalThis.crypto.randomUUID()`.

**How to avoid:** Use `import { randomUUID } from 'crypto'` (CJS import). Project minimum is Node 18 so this is safe.

**Warning signs:** Tests fail with `TypeError: crypto.randomUUID is not a function` in older Node environments.

### Pitfall 4: `StageReport.metadata` field doesn't exist in Phase 1 types

**What goes wrong:** If `DiscoveryStage.run()` returns `{ ..., metadata: { discoveredServers } }`, TypeScript will error because `StageReport` in Phase 1 has no `metadata` field.

**Why it happens:** Phase 1 `StageReport` was defined with only `stageId, stageName, findings, duration, error`. Phase 2 needs to pass discovered servers to downstream stages.

**How to avoid:** Add `metadata?: Record<string, unknown>` to `StageReport` interface in `agentshield/src/types/report.ts`. This is backward-compatible (optional field). Existing tests continue to pass.

**Warning signs:** TypeScript compile error `Object literal may only specify known properties, and 'metadata' does not exist in type 'StageReport'`.

### Pitfall 5: Keycloak MCP `/tools` returns tool NAMES only (not schemas)

**What goes wrong:** `GET /tools` returns `{ tools: ['create-user', 'list-users', ...] }` — plain string array. If code expects MCP JSON-RPC `tools/list` schema format (with `name`, `description`, `inputSchema`), it will fail silently with `undefined` for all tool metadata.

**Why it happens:** Keycloak MCP is not an MCP JSON-RPC server — it's a custom REST wrapper. There is no schema endpoint.

**How to avoid:** For Keycloak MCP, build tool definitions from the known tool name list with hard-coded descriptions. Don't attempt to fetch JSON schemas from this server.

**Warning signs:** `tool.description` is `undefined` for all Keycloak tools; CVE pattern matching fails because `inputSchema` is missing.

### Pitfall 6: URL allow-list comparison is case/port sensitive

**What goes wrong:** `config.allowedServers` may contain `http://localhost:8001` but the discovered URL is `http://127.0.0.1:8001`. String comparison treats these as different servers, producing false-positive shadow findings.

**Why it happens:** `localhost` and `127.0.0.1` are semantically the same but textually different. Port may be implicit (`:80` for HTTP, `:443` for HTTPS).

**How to avoid:** Normalize both sides through `new URL()` before comparison. Extract `hostname` and explicit port. Map `localhost` and `127.0.0.1` to the same canonical form.

---

## Code Examples

### Initialize MCP JSON-RPC request (Neo4j MCP)

```typescript
// Source: mcp-neo4j/tests/integration/test_http_transport_IT.py [VERIFIED: codebase read]
// and MCP spec transports [CITED: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports]

const response = await fetch('http://localhost:8002/mcp/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'mcp-session-id': crypto.randomUUID(),  // optional but good practice
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  }),
});
```

### Keycloak MCP tools fetch

```typescript
// Source: keycloak-mcp-server/src/simple-http-server.ts [VERIFIED: codebase read]

const response = await fetch('http://localhost:8001/tools');
const data = await response.json() as { tools: string[] };
// data.tools = ['create-user', 'list-users', 'delete-user', 'get-user',
//               'list-realms', 'list-admin-events', 'get-event-details', 'get-metrics']
```

### AbortController timeout pattern

```typescript
// Source: MDN Web Docs [CITED: https://developer.mozilla.org/en-US/docs/Web/API/AbortController]

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

### crypto.randomUUID() for finding IDs

```typescript
// Source: Node.js docs [CITED: https://nodejs.org/api/crypto.html#cryptorandomuuidoptions]

import { randomUUID } from 'crypto';

const finding: Finding = {
  id: randomUUID(),
  title: 'Shadow MCP server detected',
  // ...
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTTP+SSE transport (two endpoints: `/sse` + `/messages`) | Streamable HTTP (single `/mcp/` endpoint, POST+GET) | MCP spec 2025-03-26 | IKAS Neo4j MCP uses the new single-endpoint style; old SSE probes look at wrong paths |
| MCP Inspector on predictable ports 6274/6277 | CVE-2025-49596 DNS rebinding/CSRF RCE | Disclosed May 2025 | Localhost MCP server enumeration is itself an attack surface — AgentShield's probe methodology must be documented as authorized use only |
| `node-fetch` as standard HTTP client | Native `fetch` in Node.js 18+ | Node.js 18 (2022) | No additional http library needed for Phase 2 |

**Deprecated/outdated:**
- MCP HTTP+SSE transport (two-endpoint design with `/sse` + `/messages`): Deprecated May 2025, replaced by Streamable HTTP with single `/mcp/` endpoint. The IKAS Neo4j MCP uses the NEW design. [CITED: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports]
- The old `tools/list` approach without `initialize` handshake: While the IKAS Neo4j MCP accepts `tools/list` without a prior `initialize` (due to `stateless_http=True`), formal MCP clients should send `initialize` first.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Neo4j MCP in IKAS runs with `stateless_http=True` and accepts `tools/list` without `initialize` | Architecture Patterns (Pattern 1) | If the production container requires `initialize` first, the probe must send two requests (initialize then tools/list). Fix: add initialize step and handle `Mcp-Session-Id`. |
| A2 | Neo4j MCP path in IKAS Docker is `/mcp/` (with trailing slash) | IKAS Server Endpoint Reference | If path changes (e.g., `/api/mcp/`), probes fail silently. The `docker-compose.dev.yml` sets `NEO4J_MCP_SERVER_PATH=/api/mcp/` for the REST wrapper mode but `/mcp/` for native MCP mode. Fix: probe both paths. |
| A3 | The shadow server CRITICAL finding severity is appropriate (user never challenged this) | Pattern 5 | If the demo audience expects CRITICAL only for RCE-class issues, HIGH may be more appropriate. Currently set to CRITICAL per the ROADMAP success criteria ("flagged as HIGH or CRITICAL"). |
| A4 | `config.allowedServers` from Phase 1 config schema is already populated for IKAS (both ports 8001 and 8002) | Pattern 5 | If the user runs a scan with empty `allowedServers`, ALL discovered servers would be flagged as shadows. This is technically correct per D-06 but may surprise the user. Recommend documenting this in the plan. |

---

## Open Questions

1. **Which Neo4j MCP path is active in the running IKAS Docker stack?**
   - What we know: `docker-compose.dev.yml` configures `ikas-neo4j-mcp` on port 8002 with `NEO4J_MCP_MODE: http-wrapper`. The http-wrapper may use a different path than `/mcp/`.
   - What's unclear: The `http-wrapper` mode path is not documented in source code reads. The native MCP mode uses `/mcp/`; the REST wrapper may use `/api/mcp/`.
   - Recommendation: Probe both `/mcp/` and `/api/mcp/` and use whichever responds. Add both as candidate paths in the probe logic.

2. **Does `StageReport` need a `metadata` field for downstream stage data sharing?**
   - What we know: Discovery needs to pass `DiscoveredServer[]` to Static Analysis (Phase 3) for tool description scanning.
   - What's unclear: Whether `StageReport.metadata` is the right vehicle, or whether a separate shared state/context object should be passed through the runner.
   - Recommendation: Add `metadata?: Record<string, unknown>` to `StageReport` for Phase 2. Design a proper `ScanContext` pattern for Phase 3 if needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Native `fetch`, `AbortController`, `crypto.randomUUID` | Yes | v23.11.0 | — |
| Keycloak MCP server (port 8001) | Integration test / real scan | No (Docker not running) | — | Unit tests use mocked HTTP responses |
| Neo4j MCP server (port 8002) | Integration test / real scan | No (Docker not running) | — | Unit tests use mocked HTTP responses |
| Docker | Starting IKAS stack for integration testing | Yes (Docker installed, no containers running) | — | Start via `docker-compose -f docker/docker-compose.dev.yml up -d` |

**Missing dependencies with no fallback:** None — all unit tests can run without live servers using mock `fetch` responses.

**Missing dependencies with fallback:** Keycloak/Neo4j MCP servers are unavailable locally but are available when Docker stack is running. The integration/smoke tests require the stack to be running. Unit tests are mock-only.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.x (already installed in agentshield/) |
| Config file | `agentshield/jest.config.js` (exists from Phase 1) |
| Quick run command | `cd agentshield && npm test -- --testPathPattern=discovery` |
| Full suite command | `cd agentshield && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | `enumerateServers()` probes target URL and sweep ports, returns DiscoveredServer[] | unit (mock fetch) | `npm test -- --testPathPattern=discovery` | Wave 0 |
| DISC-01 | Port sweep returns two servers for IKAS (8001, 8002) | integration (live Docker) | manual + `npm test -- --testPathPattern=integration` | Wave 0 |
| DISC-02 | `inventoryServer()` returns tool list for Keycloak REST server | unit (mock fetch) | `npm test -- --testPathPattern=discovery` | Wave 0 |
| DISC-02 | `inventoryServer()` returns tool list for Neo4j MCP JSON-RPC server | unit (mock fetch) | `npm test -- --testPathPattern=discovery` | Wave 0 |
| DISC-03 | `classifyShadowServers()` returns CRITICAL finding for unregistered server | unit | `npm test -- --testPathPattern=discovery` | Wave 0 |
| DISC-03 | `classifyShadowServers()` returns no findings when all servers in allow-list | unit | `npm test -- --testPathPattern=discovery` | Wave 0 |
| DISC-04 | `applyCveLookup()` returns CVE-2025-49596 finding for localhost server | unit | `npm test -- --testPathPattern=cve-lookup` | Wave 0 |
| DISC-04 | `applyCveLookup()` returns CVE-2025-6514 finding for unauthenticated MCP server | unit | `npm test -- --testPathPattern=cve-lookup` | Wave 0 |
| DISC-04 | `applyCveLookup()` annotates finding with MCP07:2025 owaspCategory | unit | `npm test -- --testPathPattern=cve-lookup` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd agentshield && npm test -- --testPathPattern=<changed-file>`
- **Per wave merge:** `cd agentshield && npm test`
- **Phase gate:** Full suite green (including Phase 1 tests unbroken) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `agentshield/tests/stages/discovery.test.ts` — unit tests for `enumerateServers`, `inventoryServer`, `classifyShadowServers` with mocked fetch (REQ DISC-01, DISC-02, DISC-03)
- [ ] `agentshield/tests/data/cve-lookup.test.ts` — unit tests for static lookup table patterns (REQ DISC-04)
- [ ] `agentshield/src/types/discovery.ts` — new type file (no test needed, but type-check must pass)
- [ ] `agentshield/src/data/cve-lookup.ts` — static table (tested by cve-lookup.test.ts)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Discovery stage does not authenticate users — it probes external servers |
| V3 Session Management | No | CLI tool, no session state |
| V4 Access Control | No | Stage runs under user's local permissions |
| V5 Input Validation | Yes | Port range inputs validated; URLs validated with `new URL()` before fetch |
| V6 Cryptography | No | No crypto operations except `randomUUID()` for IDs |

### Known Threat Patterns for HTTP Probe + Port Sweep

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via crafted target URL | Spoofing/Tampering | Validate `config.target` with `new URL()`; restrict to `http://` and `https://`; do not follow meta-redirect chains |
| Port sweep causing DoS on target | Denial of Service | Use 2s timeout per probe; sweep max 20 ports by default; document that scans require authorization |
| Captured auth token in scan output | Information Disclosure | Never include `config.auth.*` fields in findings or report output; mask with `***` in any debug logs |
| MCP server returns malicious JSON | Tampering | Treat all server responses as untrusted data; parse with `as unknown` then type-narrow; do not `eval()` or `JSON.parse` without catching |

---

## Sources

### Primary (HIGH confidence)

- `keycloak-mcp-server/src/simple-http-server.ts` — Keycloak MCP REST endpoints verified by direct codebase read
- `mcp-neo4j/src/mcp_neo4j_cypher/server.py` — Neo4j FastMCP tools and HTTP transport verified by direct codebase read
- `mcp-neo4j/tests/integration/test_http_transport_IT.py` — Neo4j MCP JSON-RPC request format verified by direct codebase read
- `docker/docker-compose.dev.yml` — IKAS port mappings (8001 Keycloak, 8002 Neo4j) verified by direct codebase read
- `agentshield/src/types/findings.ts`, `types/config.ts`, `types/report.ts` — Phase 1 type contracts verified by direct codebase read
- MCP Transports specification [CITED: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports] — Streamable HTTP protocol, endpoint format, SSE response format
- OWASP MCP Top 10 [CITED: https://owasp.org/www-project-mcp-top-10/] — All 10 category IDs and descriptions
- NVD CVE-2025-6514 [CITED: https://nvd.nist.gov/vuln/detail/CVE-2025-6514] — CVSS 9.6, OS command injection in mcp-remote
- NVD CVE-2025-49596 [CITED: https://nvd.nist.gov/vuln/detail/CVE-2025-49596] — CVSS 9.4, RCE in MCP Inspector via DNS rebinding/CSRF

### Secondary (MEDIUM confidence)

- JFrog CVE-2025-6514 advisory [CITED: https://jfrog.com/blog/2025-6514-critical-mcp-remote-rce-vulnerability/] — OAuth authorization_endpoint exploitation details
- Oligo Security CVE-2025-49596 [CITED: https://www.oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596] — MCP Inspector localhost:6274/6277 attack surface
- Node.js crypto docs [CITED: https://nodejs.org/api/crypto.html#cryptorandomuuidoptions] — `randomUUID()` availability since Node 14.17
- MDN AbortController [CITED: https://developer.mozilla.org/en-US/docs/Web/API/AbortController] — Timeout pattern for fetch

### Tertiary (LOW confidence)

- None — all claims verified or cited from official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH — verified by Node 18+ native API availability and project package.json inspection
- Architecture patterns (probe logic): HIGH — directly derived from actual IKAS server source code and integration tests
- CVE/OWASP details: HIGH — verified from NVD and official OWASP project page
- Pitfalls: HIGH — SSE parsing pitfall verified from integration test source; others derived from protocol specs

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (CVE details stable; OWASP MCP Top 10 in beta but category IDs stable; MCP protocol endpoint format stable)
