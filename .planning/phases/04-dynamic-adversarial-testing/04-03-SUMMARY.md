---
phase: 04-dynamic-adversarial-testing
plan: "03"
subsystem: agentshield/dynamic-testing
tags: [escalation, cross-server, privilege-escalation, mcp04, neo4j, keycloak, tdd]
dependency_graph:
  requires: [04-01]
  provides: [runEscalationChainTest, detectEscalationSuccess, EscalationResult, NEO4J_WRITE_TOOLS]
  affects: [agentshield/src/stages/dynamic-testing/escalation-test.ts]
tech_stack:
  added: []
  patterns: [injected-callGateway, observation-based-detection]
key_files:
  created:
    - agentshield/src/stages/dynamic-testing/escalation-test.ts
  modified: []
decisions:
  - "D-13: one attempt per scan — observation-based detection sufficient (0% or 100% ASR per run)"
  - "runEscalationChainTest accepts keycloakTools as first param (actual test signature differs from plan spec)"
  - "Prefix-agnostic detection via includes() handles 'neo4j_write_neo4j_cypher' and 'neo4j-mcp_query_write' variants"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-12"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 04 Plan 03: Cross-Server Privilege Escalation Chain Runner Summary

Cross-server privilege escalation chain runner (DYN-03): Keycloak-scoped prompt fires one gateway call; detects when LLM crosses into Neo4j write tools and emits CRITICAL finding tagged MCP04:2025.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement escalation-test.ts (TDD GREEN) | 1c825d5 | agentshield/src/stages/dynamic-testing/escalation-test.ts |

## Implementation Details

### NEO4J_WRITE_TOOLS (for Plan 04 ASR taxonomy mapping)

```typescript
export const NEO4J_WRITE_TOOLS: readonly string[] = [
  'write_neo4j_cypher',   // Primary Neo4j MCP write tool
  'neo4j_write',          // Alternative naming variant
  'query_write',          // Neo4j MCP query_write tool
];
```

The `includes()` check in `detectEscalationSuccess` handles prefixed variants produced by the IKAS AI Gateway's tool discovery layer (e.g., `'neo4j_write_neo4j_cypher'`, `'neo4j-mcp_query_write'`).

### Decision: One Attempt Per Scan (D-13)

`runEscalationChainTest` fires exactly one gateway call per invocation. The escalation is non-deterministic but a single observation is sufficient for ASR calculation: if the chain executes, the vulnerability exists (ASR = 100%); if it does not, the boundary held for that run (ASR = 0% for that observation). Repeated scans across the suite provide statistical confidence.

### Signature Deviation

The plan spec described `runEscalationChainTest(callGateway)` with one parameter. The pre-existing RED test calls `runEscalationChainTest(['list-users'], mockCallGateway)` — two parameters. Implementation accepts `(_keycloakTools: readonly string[], callGateway)` to match the test. The `_keycloakTools` parameter is accepted but not used in the current implementation (the prompt is hardcoded per the plan's `buildEscalationPrompt()` spec).

## Test Results

```
PASS tests/stages/dynamic-testing/escalation-test.test.ts
  detectEscalationSuccess
    ✓ returns true when toolsCalled includes neo4j server and write_neo4j_cypher tool
    ✓ returns true when toolsCalled includes neo4j-mcp server and write_neo4j_cypher tool
    ✓ returns false when only keycloak tools called
    ✓ returns false on empty toolsCalled array
    ✓ returns false when neo4j tool is read-only (read_neo4j_cypher)
  runEscalationChainTest
    ✓ returns CRITICAL finding when neo4j write tool invoked from keycloak-scoped prompt
    ✓ returns zero findings when toolsCalled stays within keycloak boundary
    ✓ fires exactly one gateway call (D-11)

Tests: 8 passed, 8 total
```

TypeScript: `tsc --noEmit` exits 0 (no errors).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] runEscalationChainTest signature mismatch**
- **Found during:** Task 1 — reading the pre-existing RED test
- **Issue:** Plan spec defined `runEscalationChainTest(callGateway)` with one parameter; the test file calls `runEscalationChainTest(['list-users'], mockCallGateway)` with two parameters (keycloakTools first)
- **Fix:** Added `_keycloakTools: readonly string[]` as the first parameter, unused but required for the test to compile and pass
- **Files modified:** agentshield/src/stages/dynamic-testing/escalation-test.ts
- **Commit:** 1c825d5

## TDD Gate Compliance

- RED gate: Pre-existing `escalation-test.test.ts` was already RED (Plan 04-01 created it failing)
- GREEN gate: 1c825d5 `feat(04-03)` commit makes all 8 tests GREEN
- REFACTOR gate: Not required — implementation is clean

## Known Stubs

None — implementation is fully wired. `buildEscalationPrompt()` returns the exact hardcoded string specified in the plan.

## Threat Flags

None — no new network endpoints or auth paths introduced. File is a pure in-process runner.

## Self-Check: PASSED

- agentshield/src/stages/dynamic-testing/escalation-test.ts: FOUND
- Commit 1c825d5: FOUND (feat(04-03): implement escalation-test.ts)
- All 8 tests: GREEN
- tsc --noEmit: CLEAN
