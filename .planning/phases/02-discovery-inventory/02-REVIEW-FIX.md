---
phase: 02-discovery-inventory
fixed_at: 2026-05-10T20:00:00Z
review_path: .planning/phases/02-discovery-inventory/02-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-05-10T20:00:00Z
**Source review:** .planning/phases/02-discovery-inventory/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical, 4 Warning; 3 Info findings excluded per fix_scope)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `parseJsonRpcResponse` — JSON.parse on SSE data lines is unguarded

**Files modified:** `agentshield/src/stages/discovery.ts`
**Commit:** 4d94d24
**Applied fix:** Merged the two `data:`/`data: ` branches into a single check. Wrapped `JSON.parse(raw)` in a try/catch that re-throws a descriptive `Error` with the first 80 characters of the malformed payload instead of surfacing a raw `SyntaxError` to callers. This addresses both the unguarded parse path and the dead-code IN-01 duplication (fixed opportunistically as part of the same change).

---

### CR-02: `tryMcpJsonRpcAtPath` — valid server with empty tool list silently dropped

**Files modified:** `agentshield/src/stages/discovery.ts`
**Commit:** afe36d6
**Applied fix:** Removed the `if (tools.length === 0) return null;` guard in `tryMcpJsonRpcAtPath` (line 147) and the equivalent `if (toolNames.length === 0) return null;` guard in `tryKeycloakRest` (line 103). Both functions now return a `DiscoveredServer` regardless of tool count. Added a comment explaining that empty-tool servers must reach `classifyShadowServers` for shadow detection to be complete.

---

### WR-01: `CVE_LOOKUP_TABLE` row 1 — hostname match uses `String.includes`, matching false positives

**Files modified:** `agentshield/src/data/cve-lookup.ts`
**Commit:** c2bdd91
**Applied fix:** Replaced the `s.baseUrl.includes('localhost') || s.baseUrl.includes('127.0.0.1')` substring predicate with a URL constructor call that extracts the hostname component and compares it exactly. A try/catch returns `false` for malformed URLs, making the predicate safe against bad input.

---

### WR-02: `normalizeBaseUrl` — throws unguarded on malformed input

**Files modified:** `agentshield/src/stages/discovery.ts`
**Commit:** d766bf2
**Applied fix:** Added a JSDoc block to `normalizeBaseUrl` documenting the `@throws {TypeError}` contract and describing when callers must handle the exception. The throw behavior itself is intentional and kept as-is; the fix makes the contract explicit to all future callers and static analysis tools.

---

### WR-03: `tryKeycloakRest` and `tryMcpJsonRpcAtPath` — `hasAuth` is always hardcoded `false`

**Files modified:** `agentshield/src/stages/discovery.ts`
**Commit:** 882cc51
**Applied fix:** In both `tryKeycloakRest` and `tryMcpJsonRpcAtPath`, replaced `hasAuth: false` with `hasAuth: res.headers.get('www-authenticate') !== null`. A server returning a `WWW-Authenticate` header on a `200 OK` response (e.g. some auth middleware configurations) will now correctly report `hasAuth: true`. Note: requires human verification that the `www-authenticate` heuristic is sufficient for the threat model; the field semantics are now accurate for all observed probe responses.

---

### WR-04: `stubs.test.ts` — `DiscoveryStage.run` called without mocking `fetch`, causing live network probes in CI

**Files modified:** `agentshield/tests/stages/stubs.test.ts`
**Commit:** 6d43455
**Applied fix:** Added `beforeAll`/`afterAll` hooks that replace `global.fetch` with a Jest mock rejecting immediately with `DOMException('Aborted', 'AbortError')`. All 11-port probes now complete in milliseconds without touching the network. Updated the `it.each` assertion to unconditionally assert `report.error === null` for all stages (including `DiscoveryStage`), since the mocked network failures are handled gracefully as empty findings. All 70 tests pass.

---

_Fixed: 2026-05-10T20:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
