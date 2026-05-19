---
phase: 04-dynamic-adversarial-testing
fixed_at: 2026-05-13T00:00:00Z
review_path: .planning/phases/04-dynamic-adversarial-testing/04-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-05-13T00:00:00Z
**Source review:** .planning/phases/04-dynamic-adversarial-testing/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (4 Critical, 6 Warning)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: `callGateway` does not check `res.ok` — HTTP error responses produce silent false negatives

**Files modified:** `agentshield/src/stages/dynamic-testing/gateway-client.ts`, `agentshield/tests/stages/dynamic-testing/gateway-client.test.ts`
**Commit:** f48814d
**Applied fix:** Added `if (!res.ok) { throw new Error(...) }` guard between the `fetch` call and `res.json()` in `callGateway`. Also updated the two test mocks that provided `{ status: 200, json }` without `ok: true` — these needed `ok: true` to pass the new guard.

---

### CR-02: RADE test emits one finding per attempt rather than per payload — ASR metric and finding list are inflated

**Files modified:** `agentshield/src/stages/dynamic-testing/rade-test.ts`
**Commit:** 739b3ea
**Applied fix:** Added `if (payloadSuccesses === 1)` guard around the `findings.push(...)` call so that a finding is recorded only on the first successful attempt for each payload. Subsequent successes on the same payload still increment counters but do not emit duplicate findings.

---

### CR-03: `detectEscalationSuccess` uses substring matching — false positives from tool names that contain write-tool strings as substrings

**Files modified:** `agentshield/src/stages/dynamic-testing/escalation-test.ts`
**Commit:** 716fab0
**Applied fix:** Changed `t.tool.includes(name)` to `t.tool === name` in the `NEO4J_WRITE_TOOLS.some(...)` predicate to require exact equality instead of substring containment.

---

### CR-04: Duplicate `GATEWAY_URL` constant in `dynamicTesting.ts` has a different value from the canonical one — incorrect audit trail

**Files modified:** `agentshield/src/stages/dynamicTesting.ts`
**Commit:** 8339353
**Applied fix:** Removed the local `const GATEWAY_URL = 'http://localhost:8005'` declaration and added `GATEWAY_URL` to the import from `./dynamic-testing/gateway-client`. The `metadata.gatewayUrl` field now reports `'http://localhost:8005/api/chat'` — the actual URL used for adversarial calls.

---

### WR-01: `buildASRMetadata` is exported but never called — `dynamicTesting.ts` reinvents it inline, losing per-RADE-payload ASR breakdown

**Files modified:** `agentshield/src/stages/dynamicTesting.ts`, `agentshield/tests/stages/dynamicTesting.test.ts`
**Commit:** 24b30ac
**Applied fix:** Replaced the inline `asrByAttackType` construction (three `formatASR` calls) with a call to `buildASRMetadata(...)`, passing `radeResult.perPayload` for per-payload granularity. Updated the test mock to replace `formatASR` mock with `buildASRMetadata` mock, and added `perPayload` to all RADE mock return values.

---

### WR-02: `radeTaxonomyKey` brittle suffix matching will silently fall through to generic label if component string format changes

**Files modified:** `agentshield/src/stages/dynamicTesting.ts`
**Commit:** e4abddb
**Applied fix:** Replaced the three `endsWith` if-chain with a `RADE_COMPONENT_TAXONOMY` constant (keyed on full component strings) and a single `return RADE_COMPONENT_TAXONOMY[component] ?? 'rade'` lookup. Unknown components still fall back to `'rade'` but now only when the key is genuinely absent, not when the format silently changes.

---

### WR-03: A `callGateway` throw inside the RADE attempt loop causes the entire stage to abort — partial results are silently discarded

**Files modified:** `agentshield/src/stages/dynamic-testing/rade-test.ts`
**Commit:** f65d245
**Applied fix:** Wrapped `await callGateway(message, sessionId)` in a `try/catch` block inside the attempt loop. On catch, `totalAttempts` is incremented and execution continues to the next attempt via `continue`. Transient errors are counted as attempts but do not trigger a signature check.

---

### WR-04: Same transient-failure propagation exists in `runToolShadowingTest` and `runEscalationChainTest`

**Files modified:** `agentshield/src/stages/dynamic-testing/tool-shadowing.ts`, `agentshield/src/stages/dynamic-testing/escalation-test.ts`
**Commit:** f433e8d
**Applied fix:** Wrapped `await callGateway(...)` in both single-shot runners with a `try/catch` that returns `{ attempts: 1, successes: 0, findings: [] }` on error. This allows the orchestrator stage to continue reporting results from other sub-tests even when one runner encounters a transient failure.

---

### WR-05: `tagFindingWithTaxonomy` is exported but never called anywhere in the codebase — dead export

**Files modified:** `agentshield/src/stages/dynamic-testing/asr-calculator.ts`
**Commit:** 63d5a20
**Applied fix:** Removed the `tagFindingWithTaxonomy` function entirely from `asr-calculator.ts`. The inline spread patterns in `dynamicTesting.ts` are clear and consistent; no callers exist anywhere in the codebase.

---

### WR-06: `stubs.test.ts` comment incorrectly attributes what prevents live network calls in `DynamicTestingStage`

**Files modified:** `agentshield/tests/stages/stubs.test.ts`
**Commit:** 27c218c
**Applied fix:** Expanded the `beforeAll` comment to clearly distinguish that the `fetch` mock only prevents `DiscoveryStage` probes, while `DynamicTestingStage` isolation depends on the `jest.mock()` blocks at the top of the file. Also added `perPayload` to the `runRADETest` mock return value to fix a pre-existing test failure caused by the WR-01 `buildASRMetadata` change requiring `perPayload`.

---

_Fixed: 2026-05-13T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
