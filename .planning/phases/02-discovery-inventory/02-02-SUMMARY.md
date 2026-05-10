---
phase: 02-discovery-inventory
plan: "02"
subsystem: agentshield/discovery
tags: [shadow-detection, mcp09, allow-list, tdd, findings]
dependency_graph:
  requires:
    - agentshield/src/types/discovery.ts (DiscoveredServer from 02-01)
    - agentshield/src/stages/discovery.ts (normalizeBaseUrl from 02-01)
    - agentshield/src/types/findings.ts (Finding, SeverityLevel)
    - agentshield/src/types/config.ts (AgentShieldConfig.allowedServers)
  provides:
    - agentshield/src/stages/discovery.ts (classifyShadowServers export)
    - agentshield/src/stages/discovery.ts (DiscoveryStage.run now emits findings)
  affects:
    - agentshield/tests/stages/discovery.test.ts (8 new tests appended)
tech_stack:
  added: []
  patterns:
    - Set-based allow-list lookup with canonicalized URLs
    - randomUUID() for deterministic-free Finding IDs
    - TDD (RED -> GREEN cycle, no refactor needed)
key_files:
  created: []
  modified:
    - agentshield/src/stages/discovery.ts
    - agentshield/tests/stages/discovery.test.ts
decisions:
  - "canonicalizeForAllowList calls normalizeBaseUrl then lowercases; graceful fallback for unparseable URLs avoids throw"
  - "classifyShadowServers uses Set<string> for O(n) allow-list lookups"
  - "Integration tests use URL-based mockImplementation (not sequential mockResolvedValueOnce) to survive parallel port sweep"
  - "IPv6 ::1 normalization documented as known gap (accepted risk T-02-06, v1 scope)"
metrics:
  duration_seconds: 118
  completed_date: "2026-05-10"
  tasks_completed: 1
  files_changed: 2
---

# Phase 02 Plan 02: Shadow Server Detection — SUMMARY

`classifyShadowServers` exported from `DiscoveryStage`, comparing each discovered server's canonical URL against `config.allowedServers` with case+trailing-slash insensitive, 127.0.0.1-to-localhost normalization; unlisted servers emit `Finding{severity:'critical', owaspCategory:'MCP09:2025', score:9.5}` into `StageReport.findings`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing shadow tests | 500b085 | agentshield/tests/stages/discovery.test.ts |
| 1 (GREEN) | Implement classifyShadowServers and wire into DiscoveryStage | e1af242 | agentshield/src/stages/discovery.ts, agentshield/tests/stages/discovery.test.ts |

## Key Implementation Choices

**canonicalizeForAllowList:** Wraps `normalizeBaseUrl` in a try/catch and lowercases the result. The fallback path (trim + lowercase + strip trailing slash) handles malformed URL strings in `allowedServers` without crashing the classifier. This means even entries like `HTTP://LOCALHOST:8001/` resolve to `http://localhost:8001` — the same canonical form produced by `normalizeBaseUrl`.

**Set-based lookup:** `allowedServers` is canonicalized once into a `Set<string>`. Per-server lookup is O(1). This remains efficient even for large allow-lists because the set construction is O(m) where m = allowedServers.length, done once per `classifyShadowServers` call.

**Integration test mock strategy:** The initial implementation used sequential `mockResolvedValueOnce` calls, which failed non-deterministically because `enumerateServers` launches parallel probes for all 11+ sweep ports. Mock responses were consumed by different port probes in an unpredictable order. Fixed by switching to `mockImplementation` with URL-pattern matching — the same approach used in the existing `enumerateServers` test (Rule 1 auto-fix applied during GREEN phase).

**Finding shape compliance:** Each shadow finding matches the exact shape from the plan's `<finding_shape_for_shadows>` — id, title, description, severity='critical', component=baseUrl, score=9.5, owaspCategory='MCP09:2025', remediation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed integration test mock strategy for parallel port sweep**

- **Found during:** Task 1 GREEN phase (first full test run)
- **Issue:** Two integration tests used `mockResolvedValueOnce` chains (3 sequential values + `mockRejectedValue`). `enumerateServers` probes 12+ candidate URLs in parallel via `Promise.allSettled`. Sequential mock values were consumed by probes for other ports (e.g., 8000, 8003) before port 8001 could consume its Keycloak response — causing `findings.length` to be 0 instead of 1.
- **Fix:** Replaced sequential mock chain with `mockImplementation((url) => ...)` that dispatches by URL substring, matching the existing `enumerateServers` test pattern.
- **Files modified:** `agentshield/tests/stages/discovery.test.ts`
- **Commit:** e1af242 (included in Task 1 GREEN commit)

## Test Results

- **New tests:** 8 (6 unit tests in `classifyShadowServers` describe, 2 integration tests in `DiscoveryStage.run (shadow integration)`)
- **Total test suite:** 45 tests across 6 suites — all pass (up from 37 in 02-01)
- **Type-check:** `npx tsc --noEmit` exits 0 (clean)
- **TDD gates:** RED commit `500b085` -> GREEN commit `e1af242`

### New test coverage

| Describe block | Tests |
|----------------|-------|
| classifyShadowServers | 6 |
| DiscoveryStage.run (shadow integration) | 2 |

### Normalization edge cases covered

| Input pair | Expected outcome | Status |
|-----------|-----------------|--------|
| `http://127.0.0.1:8001` vs `http://localhost:8001` | Same after normalizeBaseUrl | Tested + passing |
| `HTTP://LOCALHOST:8001/` vs `http://localhost:8001` | Same after canonicalize (lowercase + normalizeBaseUrl strips trailing /) | Tested + passing |
| Malformed URL in allowedServers | Graceful fallback (no throw) | Covered by canonicalizeForAllowList try/catch |
| IPv6 `::1` | Not normalized — documented gap (T-02-06 accepted risk) | Not tested in v1 |

## Hand-off Notes for Plan 02-03

**For 02-03 (CVE/OWASP cross-reference):**

`DiscoveryStage.run` now returns `StageReport.findings` containing shadow findings. If 02-03 adds CVE-based findings, they should be concatenated into the same `findings` array. The recommended pattern:

```typescript
const shadowFindings = classifyShadowServers(inventoried, config.allowedServers);
const cveFindings = applyCveLookup(inventoried); // 02-03 adds this
return {
  ...
  findings: [...shadowFindings, ...cveFindings],
  ...
};
```

The `inventoried` array (same `DiscoveredServer[]` passed to `classifyShadowServers`) is the right input for CVE matching — it has `transport`, `tools[].name`, and `tools[].annotations`.

## Known Stubs

None — `classifyShadowServers` is fully wired. The `inventoryServer` identity function stub from 02-01 is unchanged (documented in 02-01 SUMMARY; out of scope for this plan).

## Threat Flags

No new network endpoints or auth paths introduced. `classifyShadowServers` is pure in-memory classification — no network calls.

## Self-Check: PASSED

- [x] `agentshield/src/stages/discovery.ts` contains `export function classifyShadowServers`
- [x] `agentshield/src/stages/discovery.ts` contains `MCP09:2025`
- [x] `agentshield/src/stages/discovery.ts` contains `config.allowedServers` (2 occurrences)
- [x] `agentshield/src/stages/discovery.ts` contains `shadowFindings` (2 occurrences)
- [x] `agentshield/tests/stages/discovery.test.ts` contains `describe('classifyShadowServers'`
- [x] RED commit `500b085` exists in git log
- [x] GREEN commit `e1af242` exists in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `npm test` exits 0 with 45 tests passing (no regression)
- [x] `git diff agentshield/package.json` shows no dependency additions
