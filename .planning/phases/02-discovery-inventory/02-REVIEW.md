---
phase: 02-discovery-inventory
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - agentshield/src/types/discovery.ts
  - agentshield/src/types/report.ts
  - agentshield/src/types/findings.ts
  - agentshield/src/stages/discovery.ts
  - agentshield/src/data/cve-lookup.ts
  - agentshield/tests/stages/discovery.test.ts
  - agentshield/tests/stages/stubs.test.ts
  - agentshield/tests/data/cve-lookup.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the discovery & inventory stage implementation for AgentShield, covering the type definitions, discovery stage runner, CVE lookup table, and their associated test suites.

The overall structure is sound: types are well-defined, the `DiscoveryStage` correctly integrates shadow classification and CVE lookup, and the test coverage is broad. However, two blockers were identified that can cause runtime crashes or silent data loss under conditions that are reachable in production. Four warnings cover incorrect logic and test reliability. Three info items flag code clarity and edge-case handling.

---

## Critical Issues

### CR-01: `parseJsonRpcResponse` — `JSON.parse` on SSE data lines is unguarded

**File:** `agentshield/src/stages/discovery.ts:73-77`

**Issue:** Inside the `text/event-stream` branch of `parseJsonRpcResponse`, `JSON.parse(line.slice(6))` is called directly without a try/catch. If any MCP server emits a malformed SSE data line (e.g., `data: <html>error page</html>`, or an incomplete JSON fragment during a connection drop), this throws a `SyntaxError`. The only caller, `tryMcpJsonRpcAtPath` (line 135), wraps the whole function in a catch that returns `null`, so the exception is silently swallowed there. However, `parseJsonRpcResponse` is also exported as part of the public API (used directly in tests) and could be called from other future callers that do not catch. More critically, the `throw new Error('No data line in SSE response')` path at line 80 means a partial SSE frame (connection cut after `event:` line but before `data:` line) throws an unhandled error from any caller that does not catch — including future callers of the exported function.

The immediate risk is that a poorly behaved MCP server (or one returning an HTML error page with `Content-Type: text/event-stream`) will surface a raw `SyntaxError` out of `parseJsonRpcResponse` to any caller that is not wrapped in a catch, crashing that call path entirely.

**Fix:**
```typescript
export async function parseJsonRpcResponse(res: Response): Promise<Record<string, unknown>> {
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ') || line.startsWith('data:')) {
        const raw = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
        try {
          return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          throw new Error(`Invalid JSON in SSE data line: ${raw.slice(0, 80)}`);
        }
      }
    }
    throw new Error('No data line in SSE response');
  }
  return (await res.json()) as Record<string, unknown>;
}
```

---

### CR-02: `tryMcpJsonRpcAtPath` — valid server with empty tool list is silently dropped, causing shadow servers to go undetected

**File:** `agentshield/src/stages/discovery.ts:147`

**Issue:** The check `if (tools.length === 0) return null;` causes `tryMcpJsonRpcAtPath` to return `null` for any MCP server that responds correctly to `tools/list` but currently has zero tools registered. Such a server is real, reachable, and unauthenticated — but it will never be added to `found` in `enumerateServers`, never passed to `classifyShadowServers`, and never checked against CVE rules. A shadow server operating in a "bootstrapping" or "minimal" configuration (no tools yet registered) would escape detection entirely. The same issue does not exist in `tryKeycloakRest` (line 103) which has the same check — a Keycloak REST server with no tools listed is also silently dropped.

This is a security gap: the entire purpose of shadow server detection is to find unexpected network listeners. A listener that happens to expose an empty tool list would go undetected.

**Fix:** Return the discovered server even when the tool list is empty; let `classifyShadowServers` decide whether it is interesting:
```typescript
// Remove the zero-tools guard in tryMcpJsonRpcAtPath (line 147) and tryKeycloakRest (line 103)
// Return the constructed DiscoveredServer regardless of tools.length
// If desired, add a low-severity finding for empty tool lists in classifyShadowServers
if (!Array.isArray(toolList)) return null;
const tools: ToolDefinition[] = toolList
  .filter(...)
  .map(...);
// Removed: if (tools.length === 0) return null;
return {
  baseUrl: normalizeBaseUrl(baseUrl),
  transport: 'mcp-jsonrpc',
  endpoint: path,
  tools,          // may be []
  hasAuth: false,
  responseTimeMs: Date.now() - start,
};
```

---

## Warnings

### WR-01: `CVE_LOOKUP_TABLE` row 1 — hostname match uses `String.includes`, matching false positives

**File:** `agentshield/src/data/cve-lookup.ts:26`

**Issue:** The CVE-2025-49596 match predicate is:
```typescript
match: (s) => s.baseUrl.includes('localhost') || s.baseUrl.includes('127.0.0.1'),
```
This is a substring check on the full URL string, not on the hostname component. A URL such as `http://notlocalhost.internal:8001` contains the substring `localhost` and would incorrectly match. Similarly `http://proxy-127.0.0.1.nip.io:8001` would match `127.0.0.1`. In a production scanner this causes false-positive CVE findings for external servers whose hostnames happen to embed those strings.

**Fix:** Parse the hostname properly using the `URL` constructor:
```typescript
match: (s) => {
  try {
    const host = new URL(s.baseUrl).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
},
```

---

### WR-02: `normalizeBaseUrl` — throws unguarded on malformed input when called from production paths

**File:** `agentshield/src/stages/discovery.ts:24-29`

**Issue:** `normalizeBaseUrl` calls `new URL(rawUrl)` with no try/catch. It is called in three places:
1. Inside `canonicalizeForAllowList` (line 32) — which has a catch, so safe.
2. Inside `tryKeycloakRest` (line 109) and `tryMcpJsonRpcAtPath` (line 149) on the server's own `baseUrl` argument — these callers do have outer try/catch blocks, so the exception is silently swallowed, returning `null`.
3. Inside `enumerateServers` at line 177: `normalizeBaseUrl(targetUrl)` — this has NO catch. If the caller passes a URL that parses with `new URL()` for the `enumerateServers` path (line 175 does `new URL(targetUrl)` which would also throw first), but `normalizeBaseUrl` is called separately on line 177 after `new URL` succeeds on line 175. If `u.protocol` is unexpectedly empty, the returned string could be `://hostname:port` — not a URL parsing crash, but a subtle malformation.

The more practical issue: `normalizeBaseUrl` is exported and forms part of the module's public surface. Any future caller not wrapping it in try/catch will get an uncaught `TypeError` for bad input.

**Fix:** Add internal error handling or document the throw contract clearly:
```typescript
export function normalizeBaseUrl(rawUrl: string): string {
  // Throws TypeError for invalid URLs — callers must handle
  const u = new URL(rawUrl);
  const host = u.hostname === '127.0.0.1' ? 'localhost' : u.hostname;
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  return `${u.protocol}//${host}:${port}`;
}
```
Or wrap and throw a more descriptive error, and add a JSDoc `@throws` annotation so callers know to handle it.

---

### WR-03: `tryKeycloakRest` and `tryMcpJsonRpcAtPath` — `hasAuth` is always hardcoded `false`

**File:** `agentshield/src/stages/discovery.ts:114` and `155`

**Issue:** Both probe functions unconditionally set `hasAuth: false` on the returned `DiscoveredServer`. The CVE-2025-6514 rule (cve-lookup.ts line 44) fires when `s.transport === 'mcp-jsonrpc' && s.hasAuth === false`. Because `hasAuth` is never set to `true`, this CVE finding fires for every MCP JSON-RPC server discovered, including servers that responded with a `401 Unauthorized` or `WWW-Authenticate` header. The `res.ok` check (line 134) already filters out 401 responses (since `!res.ok` returns `null`), but a server returning `200 OK` with token-based auth in the response body would not be detected either.

More concretely: if a server returns `200 OK` on `tools/list` only when a valid Bearer token is supplied, probing without credentials would receive a `401`, `tryMcpJsonRpcAtPath` would return `null` (correct), but any server that returns `200 OK` without credentials will always produce `hasAuth: false`. While this is accurate for the unauthenticated probe scenario, the field is misleading as a property of `DiscoveredServer` because it implies the scanner has determined authentication status rather than merely observing probe behavior. This leads to guaranteed false-positive CVE-2025-6514 findings for any mcp-jsonrpc server that requires auth (since the probe would have gotten a non-200 and returned null, meaning authenticated servers are never in the result set at all — the only servers in results are those reachable without auth, so `hasAuth: false` is technically always correct, but the model is confusing and fragile).

The actual risk: if `hasAuth` detection is ever extended (e.g., inspecting response headers), the current code structure provides no path to set `hasAuth: true`, making it impossible to represent an authenticated server in discovery output without a refactor.

**Fix:** At minimum, inspect the `WWW-Authenticate` response header to detect auth challenges, or rename the field to `probedWithoutAuth: true` to be honest about what was measured:
```typescript
// After a successful probe:
const wwwAuth = res.headers.get('www-authenticate');
hasAuth: wwwAuth !== null,  // Basic heuristic: server issued an auth challenge
```

---

### WR-04: `stubs.test.ts` — `DiscoveryStage.run` called without mocking `fetch`, causing live network probes in CI

**File:** `agentshield/tests/stages/stubs.test.ts:30-41`

**Issue:** The `it.each(allStages)` loop runs `stage.run('http://localhost:8001', minimalConfig)` for all stages including `DiscoveryStage`. Unlike `discovery.test.ts`, this file does NOT mock `global.fetch`. The comment on line 35 acknowledges "DiscoveryStage performs real network probes" — but that is not acceptable for a unit test in a CI pipeline where `localhost:8001` is not guaranteed to be running. This test will:
- Make 11 × 3 = 33 real HTTP requests (port sweep × 3 probe paths each)
- Fail unpredictably if a port happens to be bound in the test environment
- Always be slow (waiting for 33 connection timeouts of up to 2000ms each)

The test is also structurally inconsistent: it asserts `report.error === null` only for non-discovery stages (line 39), implicitly accepting that `DiscoveryStage` may return an error, which means it cannot reliably verify that discovery works.

**Fix:** Mock `global.fetch` in `beforeAll` to reject immediately for the stubs test, or skip the discovery assertion:
```typescript
beforeAll(() => {
  global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
});

afterAll(() => {
  (global.fetch as jest.Mock).mockRestore?.();
});
```

---

## Info

### IN-01: `parseJsonRpcResponse` — second `data:` branch is dead code for well-formed SSE

**File:** `agentshield/src/stages/discovery.ts:76-78`

**Issue:** The loop checks `line.startsWith('data: ')` first (line 73), and `line.startsWith('data:')` second (line 76). Any line starting with `data: ` (space after colon, the standard SSE format per RFC) satisfies both conditions, but the first branch fires and returns immediately. The second branch only activates for `data:payload` (no space), which is technically valid SSE but non-standard. The second branch is present for robustness, but this logic is not commented, making it look like an oversight or a duplicate to a reader.

**Fix:** Merge the two branches with a single check:
```typescript
if (line.startsWith('data:')) {
  const raw = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
  return JSON.parse(raw) as Record<string, unknown>;
}
```

---

### IN-02: `enumerateServers` — `DEFAULT_SWEEP_PORTS` includes port 8000-8010 but default target is 8001, creating redundant candidate

**File:** `agentshield/src/stages/discovery.ts:10` and `174-179`

**Issue:** `enumerateServers` calls `candidates.add(normalizeBaseUrl(targetUrl))` first (which adds `http://localhost:8001`), then iterates `DEFAULT_SWEEP_PORTS` and adds `http://localhost:8001` again (since 8001 is in the range 8000–8010). The `Set` deduplicates this correctly, so there is no behavioral bug. However, the port `80` is also implicit in the target URL when port is omitted, and the sweep range doesn't include 80 at all, so the design is slightly inconsistent. This is purely a clarity issue.

**Fix:** Consider removing the initial `candidates.add(normalizeBaseUrl(targetUrl))` and relying solely on the port sweep, or document why the target URL is added separately.

---

### IN-03: `KEYCLOAK_TOOL_DESCRIPTIONS` — undocumented coupling to external MCP server's tool naming convention

**File:** `agentshield/src/stages/discovery.ts:13-22`

**Issue:** The `KEYCLOAK_TOOL_DESCRIPTIONS` constant hard-codes tool names from the Keycloak MCP server (e.g., `'list-users'`, `'create-user'`). This works because the same tool names are defined in `keycloak-mcp-server/`. If the Keycloak MCP server ever renames a tool, `tryKeycloakRest` will silently populate `description: undefined` for that tool instead of surfacing an error. There is no test that verifies the description map stays in sync with the actual Keycloak MCP tool definitions.

**Fix:** Export the canonical tool-name constants from `keycloak-mcp-server/` shared types and import them here, or add a comment documenting the dependency and a test asserting that all keys in `KEYCLOAK_TOOL_DESCRIPTIONS` match the known Keycloak tool list.

---

_Reviewed: 2026-05-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
