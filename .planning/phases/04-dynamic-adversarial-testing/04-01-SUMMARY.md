---
phase: 04-dynamic-adversarial-testing
plan: "01"
subsystem: agentshield/dynamic-testing
tags: [tdd, gateway-client, tool-shadowing, dyn-01, phase4, adversarial-testing]
dependency_graph:
  requires: []
  provides:
    - agentshield/src/stages/dynamic-testing/gateway-client.ts
    - agentshield/src/stages/dynamic-testing/tool-shadowing.ts
    - agentshield/tests/stages/dynamic-testing/gateway-client.test.ts
    - agentshield/tests/stages/dynamic-testing/tool-shadowing.test.ts
    - agentshield/tests/stages/dynamic-testing/rade-test.test.ts
    - agentshield/tests/stages/dynamic-testing/escalation-test.test.ts
    - agentshield/tests/stages/dynamic-testing/asr-calculator.test.ts
    - agentshield/tests/stages/dynamicTesting.test.ts
  affects:
    - agentshield/src/stages/dynamicTesting.ts (Plans 02-04 will implement full orchestrator)
    - Plans 04-02/04-03/04-04 (depend on red-phase tests)
tech_stack:
  added:
    - gateway-client HTTP module with AbortController timeout pattern
    - tool-shadowing sub-runner with injected callGateway parameter
  patterns:
    - TDD red-green cycle (Wave 0 red, Wave 1 green for DYN-01)
    - Injected function parameter for testability (no module-level spying)
    - AbortController + setTimeout for HTTP timeouts (per discovery.ts pattern)
key_files:
  created:
    - agentshield/src/stages/dynamic-testing/gateway-client.ts
    - agentshield/src/stages/dynamic-testing/tool-shadowing.ts
    - agentshield/tests/stages/dynamic-testing/gateway-client.test.ts
    - agentshield/tests/stages/dynamic-testing/tool-shadowing.test.ts
    - agentshield/tests/stages/dynamic-testing/rade-test.test.ts
    - agentshield/tests/stages/dynamic-testing/escalation-test.test.ts
    - agentshield/tests/stages/dynamic-testing/asr-calculator.test.ts
    - agentshield/tests/stages/dynamicTesting.test.ts
  modified: []
decisions:
  - "D-11 one-attempt principle: runToolShadowingTest calls callGateway exactly once per invocation — single measurement, not multiple attempts, per CONTEXT.md"
  - "Injected callGateway parameter: sub-runners receive callGateway as a function parameter (not module import) enabling Jest mock injection without jest.spyOn(module)"
  - "checkGatewayReachable reachability contract: HTTP 200, 400, and 503 all count as reachable (gateway is up even if services degraded); only fetch rejection or AbortError throw D-04"
  - "AbortController probe vs chat timeout: 3s for probe (GATEWAY_PROBE_TIMEOUT_MS), 30s for chat (GATEWAY_TIMEOUT_MS) — fast fail-fast vs generous response time"
  - "Wave 0 red-phase approach: all 6 test files written first in one commit before any implementation — enables Plans 02/03/04 to run in parallel (Wave 2)"
metrics:
  duration_seconds: 280
  completed_date: "2026-05-12"
  tasks_completed: 3
  files_created: 8
  tests_added: 19
---

# Phase 4 Plan 01: TDD Foundation, Gateway Client, and Tool Shadowing (DYN-01) Summary

**One-liner:** JWT-free HTTP gateway client with AbortController timeouts and DYN-01 tool-shadowing sub-runner using single-attempt measurement (D-11) and injected callGateway for testability.

## What Was Built

### Task 1: Wave 0 Red Phase (Commit: 2816f93)

Six test files created for all Phase 4 modules. All import from source modules that did not exist at commit time — confirmed FAIL on all 6 suites.

| Test File | Status at Commit | Target Module |
|-----------|-----------------|---------------|
| `gateway-client.test.ts` | FAIL (no source) | `gateway-client.ts` |
| `tool-shadowing.test.ts` | FAIL (no source) | `tool-shadowing.ts` |
| `rade-test.test.ts` | FAIL (no source) | `rade-test.ts` (Plan 02) |
| `escalation-test.test.ts` | FAIL (no source) | `escalation-test.ts` (Plan 03) |
| `asr-calculator.test.ts` | FAIL (no source) | `asr-calculator.ts` (Plan 04) |
| `dynamicTesting.test.ts` | FAIL (no source + stub signature) | `dynamicTesting.ts` (Plan 04) |

**Red-phase behavior verified:** `npx jest tests/stages/dynamic-testing/ --no-coverage` showed 6 FAIL, 0 PASS.

### Task 2: gateway-client.ts Implementation (Commit: a48b360)

Implements the D-04/D-05 contract gateway HTTP client:
- `GATEWAY_URL = 'http://localhost:8005/api/chat'`
- `GATEWAY_PROBE_TIMEOUT_MS = 3_000` (fast fail-fast probe)
- `GATEWAY_TIMEOUT_MS = 30_000` (generous chat timeout)
- `D04_ERROR_MESSAGE = 'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.'`
- `checkGatewayReachable()`: POST probe with AbortController, throws D04 on any fetch error (including AbortError), resolves on any HTTP status (200/400/503 all count as reachable)
- `callGateway(message, sessionId)`: POST JSON, returns parsed GatewayResponse, throws D04 on fetch failure

**8/8 gateway-client tests GREEN.**

### Task 3: tool-shadowing.ts Implementation (Commit: 7165d52)

Implements DYN-01 (Tool Shadowing Attack via message-embedded fake tool definition):
- `SHADOW_TOOL_NAME = 'shadow-list-users'`
- `TOOL_SHADOWING_OWASP = 'MCP09:2025'` (MCPSecBench taxonomy)
- `TOOL_SHADOWING_LABEL = 'Tool Shadowing Attack'`
- `buildShadowingPrompt(legitimateTools)`: embeds all legitimate tools + adversarial shadow-list-users definition + LEGITIMATE_QUERY
- `runToolShadowingTest(legitimateTools, callGateway)`: one call (D-11), UUID-prefixed session ID, CRITICAL finding on shadow tool invocation with full LLM response captured in description (T-04-03)

**11/11 tool-shadowing tests GREEN.**

## Implementation Choices

### D-11: Single Attempt = Single Measurement
Per CONTEXT.md decision D-11 ("One attempt = one measurement"), `runToolShadowingTest` calls `callGateway` exactly once. The MCPSecBench paper treats each gateway call as one discrete measurement of attack success rate (ASR). Multiple retries would inflate the denominator. This is intentional: `attempts: 1` returned in `ToolShadowingResult`.

### Injected callGateway Parameter
Rather than importing `callGateway` at module level and spying on it, the sub-runners accept it as a function parameter matching the `(message: string, sessionId: string) => Promise<GatewayResponse>` signature. This is the established project pattern from PATTERNS.md ("Inject callGateway via constructor/parameter when testing sub-runners").

### 503 = Reachable
`checkGatewayReachable` does not throw on HTTP 503. Per RESEARCH.md Pattern 1 ("503 gateway reachable contract"), the gateway being reachable but returning 503 (some MCP backend down) is a valid state for running tests. Only ECONNREFUSED/AbortError (fetch rejection) trigger D-04.

### Session ID Pattern
Each `runToolShadowingTest` invocation generates `agentshield-shadow-${randomUUID()}`. The `agentshield-shadow-` prefix enables gateway log filtering. The UUID suffix prevents cross-attempt session contamination (T-04-02 threat mitigation).

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | 2816f93 | `test(04-01): red phase — write failing test scaffolding for all Phase 4 modules` |
| GREEN (feat) gateway-client | a48b360 | `feat(04-01): implement gateway-client.ts` |
| GREEN (feat) tool-shadowing | 7165d52 | `feat(04-01): implement tool-shadowing.ts` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error in gateway-client.test.ts**
- **Found during:** Task 2 (first green run)
- **Issue:** `.catch((e: Error) => e)` return type was inferred as `void | Error` because `checkGatewayReachable()` returns `Promise<void>`, causing TS2339 error on `.message` access.
- **Fix:** Added a second mock setup before the second assertion call, used `e: unknown` cast pattern with `e instanceof Error ? e.message : ''`
- **Files modified:** `agentshield/tests/stages/dynamic-testing/gateway-client.test.ts`
- **Commit:** a48b360 (included in Task 2 commit)

## Open Question A1 Status

**Question:** Does Claude actually invoke message-embedded shadow tools (i.e., tools referenced only in the user message text, not in the gateway's configured tool registry)?

**Status:** Cannot verify without a live healthy stack. The test infrastructure (`gateway-client.ts` + `tool-shadowing.ts`) is fully implemented and will correctly measure the answer when run against a live gateway. If Claude invokes `shadow-list-users` (which is NOT in the gateway's tool registry), `gwResponse.toolsCalled` will include it and `runToolShadowingTest` will produce a CRITICAL finding. If Claude ignores the message-embedded tool definition, `result.successes` will be 0.

The CONTEXT.md design note (D-03/D-05) assumes the attack may work because modern LLMs can be confused about the boundary between tool descriptions and user message content. Empirical verification requires the Amsterdam demo stack to be running.

## Known Stubs

None in the implemented modules. The following test files remain RED (intentional red-phase stubs for Plans 02/03/04):
- `rade-test.test.ts` - imports from non-existent `rade-test.ts` (Plan 02)
- `escalation-test.test.ts` - imports from non-existent `escalation-test.ts` (Plan 03)
- `asr-calculator.test.ts` - imports from non-existent `asr-calculator.ts` (Plan 04)
- `dynamicTesting.test.ts` - imports from non-existent sub-modules + stub signature mismatch (Plan 04)

These are intentional red-phase stubs per the Wave 0 design.

## Threat Surface Scan

No new network endpoints introduced. All threat mitigations from the plan's threat model were implemented:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-04-01 (Info Disclosure) | Only typed GatewayResponse fields read; no raw headers logged |
| T-04-02 (Tampering/session reuse) | Fresh `randomUUID()` per `runToolShadowingTest` call |
| T-04-03 (EoP/adversarial text exec) | LLM response stored as plain string in `Finding.description` only |
| T-04-04 (DoS/hanging) | AbortController with 3s probe + 30s chat timeouts |

## Self-Check: PASSED

Files confirmed present:
- agentshield/src/stages/dynamic-testing/gateway-client.ts: FOUND
- agentshield/src/stages/dynamic-testing/tool-shadowing.ts: FOUND
- agentshield/tests/stages/dynamic-testing/gateway-client.test.ts: FOUND
- agentshield/tests/stages/dynamic-testing/tool-shadowing.test.ts: FOUND
- agentshield/tests/stages/dynamic-testing/rade-test.test.ts: FOUND
- agentshield/tests/stages/dynamic-testing/escalation-test.test.ts: FOUND
- agentshield/tests/stages/dynamic-testing/asr-calculator.test.ts: FOUND
- agentshield/tests/stages/dynamicTesting.test.ts: FOUND

Commits confirmed:
- 2816f93 (Task 1 red phase)
- a48b360 (Task 2 gateway-client green)
- 7165d52 (Task 3 tool-shadowing green)

Test results:
- gateway-client.test.ts: 8/8 PASS
- tool-shadowing.test.ts: 11/11 PASS
- Existing 76 tests: all PASS
- rade/escalation/asr/dynamicTesting: all FAIL (expected red phase)

TypeScript: `npx tsc --noEmit` exits 0
