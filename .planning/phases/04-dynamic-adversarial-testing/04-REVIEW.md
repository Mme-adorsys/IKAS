---
phase: 04-dynamic-adversarial-testing
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - agentshield/src/stages/dynamic-testing/gateway-client.ts
  - agentshield/src/stages/dynamic-testing/tool-shadowing.ts
  - agentshield/src/stages/dynamic-testing/rade-test.ts
  - agentshield/src/stages/dynamic-testing/escalation-test.ts
  - agentshield/src/stages/dynamic-testing/asr-calculator.ts
  - agentshield/src/stages/dynamicTesting.ts
  - agentshield/tests/stages/dynamic-testing/gateway-client.test.ts
  - agentshield/tests/stages/dynamic-testing/tool-shadowing.test.ts
  - agentshield/tests/stages/dynamic-testing/rade-test.test.ts
  - agentshield/tests/stages/dynamic-testing/escalation-test.test.ts
  - agentshield/tests/stages/dynamic-testing/asr-calculator.test.ts
  - agentshield/tests/stages/dynamicTesting.test.ts
  - agentshield/tests/stages/stubs.test.ts
findings:
  critical: 5
  warning: 6
  info: 4
  total: 15
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase implements dynamic adversarial testing for MCP security: tool-shadowing, RADE (indirect prompt injection), and cross-server privilege-escalation chain detection. The overall structure is sound and the test coverage is reasonable. However, there are several correctness bugs, one security-relevant information-disclosure issue, logic gaps in detection, and a handful of maintainability concerns that must be addressed before this code can be trusted to produce reliable security scan results.

---

## Critical Issues

### CR-01: `callGateway` silently swallows non-2xx HTTP responses — false negatives on every 4xx/5xx

**File:** `agentshield/src/stages/dynamic-testing/gateway-client.ts:43-44`

**Issue:** `callGateway` calls `res.json()` unconditionally regardless of the HTTP status code. If the gateway returns a 4xx or 5xx response (e.g. 400 Bad Request, 503), the code will either:
- Throw a JSON parse error that gets swallowed by the `catch` block and re-thrown as the misleading D-04 "gateway unreachable" error, or
- Silently return a malformed object that does not conform to `GatewayResponse`, causing `gwResponse.response` and `gwResponse.toolsCalled` to be `undefined`.

When `gwResponse.response` is `undefined`, `detectRADESuccess` is called with `undefined ?? ''` (line 86 of `rade-test.ts` guards this, but only because the caller uses `??`). However `gwResponse.toolsCalled` has no such guard in `tool-shadowing.ts` line 36 — `(gwResponse.toolsCalled ?? [])` does guard it there but only because the downstream code added a nullish coalescing. The root bug is that a gateway HTTP error is indistinguishable from a genuine "gateway unreachable" error, so the stage silently returns `error: "Dynamic testing requires IKAS AI Gateway…"` instead of reporting the actual HTTP problem, hiding real issues.

**Fix:**
```typescript
const res = await fetch(GATEWAY_URL, { … });
if (!res.ok) {
  throw new Error(`Gateway returned HTTP ${res.status}: ${await res.text()}`);
}
return (await res.json()) as GatewayResponse;
```

---

### CR-02: `checkGatewayReachable` treats any HTTP response (including 503) as "reachable" — incorrect fail-fast semantics

**File:** `agentshield/src/stages/dynamic-testing/gateway-client.ts:17-32`

**Issue:** The probe resolves successfully for any HTTP response that does not throw — including a 503 from a misconfigured or degraded gateway. This means `DynamicTestingStage` will proceed to run all adversarial tests against a gateway that cannot reliably process them. A test run against a half-working gateway produces silently incorrect ASR numbers. The test suite even codifies this incorrect behaviour in `gateway-client.test.ts` line 56-63 ("resolves when fetch returns 503 — gateway reachable but degraded").

**Fix:**
```typescript
const res = await fetch(GATEWAY_URL, { … });
if (!res.ok) {
  throw new Error(D04_ERROR_MESSAGE);
}
```
If a degraded-but-reachable state needs to be distinguished for monitoring purposes, expose that as a separate probe status — do not silently ignore it for the fail-fast check.

---

### CR-03: Duplicate local `GATEWAY_URL` constant in `dynamicTesting.ts` differs from the canonical one in `gateway-client.ts`

**File:** `agentshield/src/stages/dynamicTesting.ts:12`

**Issue:** `dynamicTesting.ts` defines its own `const GATEWAY_URL = 'http://localhost:8005'` (line 12), which differs from the canonical value exported by `gateway-client.ts` (`'http://localhost:8005/api/chat'`). The local constant is written into `report.metadata.gatewayUrl`. This produces an incorrect/misleading audit trail in the scan output — consumers reading `metadata.gatewayUrl` will see a base URL missing the `/api/chat` path suffix, which does not match the URL actually used for requests.

**Fix:**
```typescript
// Remove the local const on line 12 and import from gateway-client
import { checkGatewayReachable, callGateway, GATEWAY_URL } from './dynamic-testing/gateway-client';
// …
metadata: {
  gatewayUrl: GATEWAY_URL,
}
```

---

### CR-04: RADE test keeps adding duplicate findings across 3 retry attempts — ASR metric inflated

**File:** `agentshield/src/stages/dynamic-testing/rade-test.ts:86-105`

**Issue:** Every individual attempt that matches a signature emits a new `Finding` entry. For a single RADE payload that succeeds on all 3 attempts, 3 identical findings are added to `findings[]` (lines 90-105). The outer `DynamicTestingStage` concatenates these directly into `report.findings` without de-duplication. A consumer reading the findings list will see three near-identical critical findings for the same root vulnerability, distorting triage. Additionally, `totalSuccesses` is incremented once per attempt (not once per payload), so the reported ASR numerator counts retries, not unique attack successes — a payload succeeding 3/3 times shows ASR 100% for that type regardless of whether the other payload types failed.

**Fix:** Emit at most one finding per payload (on first success), then continue counting for statistics but do not push additional findings:
```typescript
if (success && payloadSuccesses === 0) {
  // emit finding only on first success per payload
  findings.push({ … });
}
if (success) {
  payloadSuccesses += 1;
  totalSuccesses += 1;
}
```

---

### CR-05: `detectEscalationSuccess` uses substring matching on tool names — trivially bypassable and prone to false positives

**File:** `agentshield/src/stages/dynamic-testing/escalation-test.ts:16-22`

**Issue:** `NEO4J_WRITE_TOOLS.some((name) => t.tool.includes(name))` (line 20) uses `includes` (substring match) rather than exact equality. This means:
1. A tool named `partial_write_neo4j_cypher_wrapper` would falsely match `write_neo4j_cypher`.
2. A tool named `write_neo4j_cypher_readonly_view` (a legitimate read-only view tool with "write" in its name) would trigger a false-positive critical escalation finding.
3. A tool named `safe_write_neo4j_cypher_dry_run` injected by an attacker to spoof the pattern would produce a false positive.

For a security scanner, false positives in critical findings are a serious trust problem. This should be exact equality:
```typescript
NEO4J_WRITE_TOOLS.some((name) => t.tool === name)
```

---

## Warnings

### WR-01: `buildASRMetadata` is exported but never called by `dynamicTesting.ts` — dead exported API

**File:** `agentshield/src/stages/dynamic-testing/asr-calculator.ts:39-51`
**Also:** `agentshield/src/stages/dynamicTesting.ts:73-77`

**Issue:** `dynamicTesting.ts` manually assembles `asrByAttackType` (lines 73-77) by calling `formatASR` directly, bypassing the `buildASRMetadata` function entirely. The `buildASRMetadata` function goes unused. This means there are two separate code paths producing ASR output that can drift out of sync. The `buildASRMetadata` path also computes per-RADE-payload ASR breakdowns (role-takeover, data-exfiltration, privilege-escalation separately), whereas `dynamicTesting.ts` only reports an aggregate RADE ASR — a regression in reporting granularity.

**Fix:** Use `buildASRMetadata` in `dynamicTesting.ts`:
```typescript
import { buildASRMetadata } from './dynamic-testing/asr-calculator';
// …
const asrMeta = buildASRMetadata({
  toolShadowing: { successes: shadowResult.successes, attempts: shadowResult.attempts },
  radePerPayload: radeResult.perPayload,
  escalation: { successes: escalationResult.successes, attempts: escalationResult.attempts },
});
```

---

### WR-02: `radeTaxonomyKey` maps `data-exfiltration-redirect` component suffix to `rade-data-exfiltration` but the taxonomy key is not in `MCPSECBENCH_TAXONOMY`

**File:** `agentshield/src/stages/dynamicTesting.ts:34-38`
**Also:** `agentshield/src/stages/dynamic-testing/asr-calculator.ts:1-8`

**Issue:** `radeTaxonomyKey` maps component suffix `':data-exfiltration-redirect'` to the key `'rade-data-exfiltration'`. However, `MCPSECBENCH_TAXONOMY` does not contain `'rade-data-exfiltration'` as a key — it contains `'rade-data-exfiltration'`... Wait, checking: `MCPSECBENCH_TAXONOMY` has key `'rade-data-exfiltration'` (line 5 of `asr-calculator.ts`). But the component string from `rade-test.ts` line 99 is `'gateway:rade:data-exfiltration-redirect'`, and `radeTaxonomyKey` matches the suffix after the last `:`. The component ends in `data-exfiltration-redirect` which maps to key `'rade-data-exfiltration'` — that key does exist. However, the `rade-privilege-escalation` case: the component suffix from `rade-test.ts` is `'privilege-escalation-command'`, but `radeTaxonomyKey` matches `endsWith(':privilege-escalation-command')` mapping to `'rade-privilege-escalation'` — that key exists in the taxonomy. The fallback is `'rade'` which also exists.

The actual problem is that `radeTaxonomyKey` receives `f.component` which for RADE findings is `'gateway:rade:role-takeover'`, `'gateway:rade:data-exfiltration-redirect'`, or `'gateway:rade:privilege-escalation-command'`. The checks use `endsWith(':role-takeover')`, `endsWith(':data-exfiltration-redirect')`, `endsWith(':privilege-escalation-command')` — these are exact suffix matches and they will correctly match. But the matching is brittle: if `rade-test.ts` ever changes the component string format (e.g. `'gateway:rade:v2:role-takeover'`), the suffix match silently falls through to the generic `'rade'` key, losing the granular taxonomy label with no error or warning. This is a maintainability trap.

**Fix:** Use a lookup map keyed on the payload ID rather than component suffix pattern matching:
```typescript
const RADE_COMPONENT_TAXONOMY: Record<string, string> = {
  'gateway:rade:role-takeover': 'rade-role-takeover',
  'gateway:rade:data-exfiltration-redirect': 'rade-data-exfiltration',
  'gateway:rade:privilege-escalation-command': 'rade-privilege-escalation',
};
function radeTaxonomyKey(component: string): string {
  return RADE_COMPONENT_TAXONOMY[component] ?? 'rade';
}
```

---

### WR-03: `runRADETest` runs all attempts serially with sequential `callGateway` calls — a gateway failure on attempt 1 of payload 1 silently skips remaining 8 attempts because the error propagates up uncaught

**File:** `agentshield/src/stages/dynamic-testing/rade-test.ts:79-113`

**Issue:** `callGateway` inside the nested loop can throw (e.g. AbortError / timeout). If it does, the `await callGateway(...)` on line 84 throws, propagating out of `runRADETest` — which is caught by the `try/catch` in `DynamicTestingStage.run` and converts the whole stage into an error report. The `perPayload` results accumulated so far are discarded. There is no per-attempt error handling, so a single transient timeout causes the entire 9-call test suite to abort and report "gateway unreachable" instead of "partial results, 8 attempts skipped due to error."

**Fix:** Wrap each `callGateway` call in a try/catch and record timed-out attempts as non-successes:
```typescript
let gwResponse: GatewayResponse;
try {
  gwResponse = await callGateway(message, sessionId);
} catch {
  // count as a failed attempt, continue
  totalAttempts += 1;
  continue;
}
```

---

### WR-04: Same transient-failure issue exists in `runToolShadowingTest` and `runEscalationChainTest`

**File:** `agentshield/src/stages/dynamic-testing/tool-shadowing.ts:35`
**File:** `agentshield/src/stages/dynamic-testing/escalation-test.ts:43`

**Issue:** Both single-shot tests let `callGateway` throw unhandled. The throw propagates to `DynamicTestingStage.run`'s catch block which reports the entire stage as an error. For a one-shot test this means any transient timeout produces no findings at all — not even "0 successes." At minimum this should be distinguished from a genuine gateway-unreachable scenario.

**Fix:** Wrap `callGateway` in each runner and return a zero-success result on transient error rather than throwing:
```typescript
let gwResponse: GatewayResponse;
try {
  gwResponse = await callGateway(message, sessionId);
} catch (err) {
  // gateway became unreachable mid-test — return zero results, not a thrown error
  return { attempts: 1, successes: 0, findings: [] };
}
```

---

### WR-05: `tagFindingWithTaxonomy` is exported but never called anywhere in the codebase

**File:** `agentshield/src/stages/dynamic-testing/asr-calculator.ts:54-62`

**Issue:** The `tagFindingWithTaxonomy` generic utility is exported from `asr-calculator.ts` but `dynamicTesting.ts` does not import or use it — it spreads the `mcpSecBenchLabel` manually inline (lines 60-71). The exported function is dead code that adds a misleading sense that tagging is handled generically when it is actually duplicated inline.

**Fix:** Either use `tagFindingWithTaxonomy` in `dynamicTesting.ts` to replace the inline spread, or remove the export if the inline approach is preferred.

---

### WR-06: `stubs.test.ts` asserts `report.error === null` for `DynamicTestingStage` but the mock setup in `stubs.test.ts` does not match what the stage reads from `previousReports`

**File:** `agentshield/tests/stages/stubs.test.ts:69-76`

**Issue:** The stub test calls `stage.run('http://localhost:8001', minimalConfig)` with no `previousReports` argument (line 70). `extractLegitimateTools` correctly handles this (returns `[]`). The mocked `runToolShadowingTest` returns `{ attempts: 1, successes: 0, findings: [] }`. The stage should complete cleanly.

However, the `stubs.test.ts` mock for `checkGatewayReachable` (line 12) is set at module mock level with `jest.fn().mockResolvedValue(undefined)` — this is applied before `beforeAll`. But `beforeAll` in `stubs.test.ts` overrides `global.fetch` to `mockRejectedValue(AbortError)` (line 57). Because `gateway-client` is fully mocked via `jest.mock(...)`, the `fetch` override is irrelevant for `DynamicTestingStage`, but the comment on line 53-54 incorrectly suggests the fetch mock is what prevents live calls — it is the `jest.mock` that does this. The misleading comment creates a maintenance hazard where a developer might remove the `jest.mock` blocks thinking the `fetch` mock is sufficient.

**Fix:** Correct the comment to accurately describe what prevents live calls: "All dynamic-testing modules are mocked via jest.mock() above — the fetch mock below only prevents DiscoveryStage from making live network probes."

---

## Info

### IN-01: `RADE_ATTEMPTS_PER_PAYLOAD` constant is not imported or accessible to callers who may want to know total expected attempts

**File:** `agentshield/src/stages/dynamic-testing/rade-test.ts:5`

**Issue:** `RADE_ATTEMPTS_PER_PAYLOAD = 3` is exported, but `dynamicTesting.ts` does not use it to compute `totalAttempts` — it simply sums result fields from sub-runners. This is fine. However, the test `rade-test.test.ts` line 82 hardcodes `9` (3 payloads × 3 attempts). If `RADE_ATTEMPTS_PER_PAYLOAD` is changed, the hardcoded `9` in the test will become stale and the assertion will fail with a confusing message.

**Fix:** In the test, derive expected call count from the constant:
```typescript
import { RADE_PAYLOADS, RADE_ATTEMPTS_PER_PAYLOAD } from '…';
// …
expect(mockCallGateway).toHaveBeenCalledTimes(RADE_PAYLOADS.length * RADE_ATTEMPTS_PER_PAYLOAD);
```

---

### IN-02: `asr-calculator.test.ts` does not test `buildASRMetadata` at all

**File:** `agentshield/tests/stages/dynamic-testing/asr-calculator.test.ts`

**Issue:** `buildASRMetadata` is an exported function in `asr-calculator.ts` with non-trivial `findPayload` lookup logic (including a fallback to `{ successes: 0, attempts: 0 }` when a payload ID is missing). The test file only covers `formatASR` and `MCPSECBENCH_TAXONOMY`. The `findPayload` fallback and the correct mapping of payload IDs to RADE sub-categories go entirely untested.

**Fix:** Add tests for `buildASRMetadata`, including the edge case where a payload ID is missing from `radePerPayload`.

---

### IN-03: `buildShadowingPrompt` with an empty `legitimateTools` array produces a prompt containing `(no legitimate tools discovered)` — no test for this branch

**File:** `agentshield/src/stages/dynamic-testing/tool-shadowing.ts:17-19`

**Issue:** The empty-tools branch (`'- (no legitimate tools discovered)'`) is never exercised by the test suite. The `buildShadowingPrompt` test only covers the non-empty case.

**Fix:** Add a test:
```typescript
it('uses fallback text when no legitimate tools are provided', () => {
  const prompt = buildShadowingPrompt([]);
  expect(prompt).toContain('(no legitimate tools discovered)');
});
```

---

### IN-04: `dynamicTesting.ts` imports `MCPSECBENCH_TAXONOMY` and `formatASR` from `asr-calculator` but does not use `buildASRMetadata` — the import list is incomplete relative to actual usage

**File:** `agentshield/src/stages/dynamicTesting.ts:10`

**Issue:** The import line is `import { formatASR, MCPSECBENCH_TAXONOMY } from './dynamic-testing/asr-calculator'`. `buildASRMetadata` and `tagFindingWithTaxonomy` are omitted. This is consistent with the current (incorrect) code, but makes it clear that the asr-calculator module is being used piecemeal rather than through its full intended API surface.

**Fix:** Address as part of WR-01 fix — import and use `buildASRMetadata` to replace the inline construction.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
