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
  critical: 4
  warning: 6
  info: 4
  total: 14
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase implements dynamic adversarial testing — live probe attacks (tool shadowing, RADE indirect prompt injection, and privilege escalation chain) against the running IKAS AI Gateway. The modular structure separating sub-runners is sound and test coverage is reasonable for the happy path. However there are four BLOCKERs: two cause incorrect or inflated security findings (false-negative on HTTP errors, duplicate RADE findings inflating ASR), one causes direct misinformation in the audit trail (duplicate GATEWAY_URL constant with wrong value), and one causes false positives in escalation detection via substring matching. Several warnings address silent failure modes that cause partial test results to be silently discarded.

---

## Critical Issues

### CR-01: `callGateway` does not check `res.ok` — HTTP error responses produce silent false negatives

**File:** `agentshield/src/stages/dynamic-testing/gateway-client.ts:43-44`
**Issue:** `callGateway` calls `res.json()` unconditionally regardless of HTTP status code. If the gateway returns 4xx or 5xx, one of two failure modes occurs: (a) the error body is not valid JSON, causing a JSON parse error that lands in the `catch` block and is re-thrown as the misleading D-04 "gateway unreachable" message — hiding the real server error, or (b) the error body is valid JSON but does not conform to `GatewayResponse`, so `toolsCalled` and `response` are `undefined` at runtime despite the `as GatewayResponse` cast. Downstream callers use `gwResponse.toolsCalled ?? []` and `gwResponse.response ?? ''` as guards, which means a gateway error is silently treated as a benign "no attack succeeded" result — a systematic false negative across every adversarial test.

**Fix:**
```typescript
const res = await fetch(GATEWAY_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId }),
  signal: controller.signal,
});
if (!res.ok) {
  throw new Error(`Gateway returned HTTP ${res.status}: ${await res.text()}`);
}
return (await res.json()) as GatewayResponse;
```

---

### CR-02: RADE test emits one finding per attempt rather than per payload — ASR metric and finding list are inflated

**File:** `agentshield/src/stages/dynamic-testing/rade-test.ts:86-105`
**Issue:** Every individual attempt that matches a signature pushes a new `Finding` entry and increments `totalSuccesses`. For a single RADE payload that succeeds on all 3 attempts, 3 near-identical critical findings are emitted and `totalSuccesses = 3`. The `DynamicTestingStage` concatenates these directly into `report.findings` with no de-duplication. A consumer reading the findings list sees three critical findings for the same root vulnerability, and the ASR numerator counts retries — a payload succeeding 3/3 times shows 3/9 = 33% for that type rather than the intended 1/3 payload-level view. Both the finding list and the ASR metric are factually incorrect.

**Fix:** Emit at most one finding per payload (on first success):
```typescript
if (success) {
  payloadSuccesses += 1;
  totalSuccesses += 1;
  if (payloadSuccesses === 1) {
    // record finding only on the first success per payload
    findings.push({ ... });
  }
}
```

---

### CR-03: `detectEscalationSuccess` uses substring matching — false positives from tool names that contain write-tool strings as substrings

**File:** `agentshield/src/stages/dynamic-testing/escalation-test.ts:20`
**Issue:** `NEO4J_WRITE_TOOLS.some((name) => t.tool.includes(name))` uses `includes` (substring match). A tool named `safe_write_neo4j_cypher_dryrun`, `write_neo4j_cypher_readonly_view`, or any tool whose name contains `write_neo4j_cypher` as a substring would trigger a false-positive critical escalation finding scored at 9.5. For a security scanner, false-positive critical findings destroy trust in the tool's output.

**Fix:**
```typescript
NEO4J_WRITE_TOOLS.some((name) => t.tool === name)
```

---

### CR-04: Duplicate `GATEWAY_URL` constant in `dynamicTesting.ts` has a different value from the canonical one — incorrect audit trail

**File:** `agentshield/src/stages/dynamicTesting.ts:12`
**Issue:** `dynamicTesting.ts` declares `const GATEWAY_URL = 'http://localhost:8005'` (base URL, no path), while `gateway-client.ts` exports `GATEWAY_URL = 'http://localhost:8005/api/chat'` (full path). The local constant is written into `report.metadata.gatewayUrl`. Users and downstream consumers reading the scan report will see `http://localhost:8005` as the gateway URL, which is not the URL actually used for adversarial calls — they would be unable to reproduce or debug a call from that URL alone. If the gateway URL ever changes, the two constants will silently diverge.

**Fix:** Remove the local constant and import from `gateway-client`:
```typescript
import { checkGatewayReachable, callGateway, GATEWAY_URL } from './dynamic-testing/gateway-client';
// ...
metadata: {
  gatewayUrl: GATEWAY_URL, // 'http://localhost:8005/api/chat'
}
```

---

## Warnings

### WR-01: `buildASRMetadata` is exported but never called — `dynamicTesting.ts` reinvents it inline, losing per-RADE-payload ASR breakdown

**File:** `agentshield/src/stages/dynamic-testing/asr-calculator.ts:39-51`
**Also:** `agentshield/src/stages/dynamicTesting.ts:73-77`
**Issue:** `dynamicTesting.ts` manually assembles `asrByAttackType` (lines 73-77) by calling `formatASR` directly, completely bypassing `buildASRMetadata`. The inline construction only produces an aggregate `rade` ASR figure, whereas `buildASRMetadata` would produce per-payload breakdowns (role-takeover, data-exfiltration, privilege-escalation separately). This is a reporting regression — the granularity exists in the data model but is not surfaced in the output.

**Fix:** Import and use `buildASRMetadata` in `dynamicTesting.ts`:
```typescript
import { buildASRMetadata, MCPSECBENCH_TAXONOMY } from './dynamic-testing/asr-calculator';
// ...
const asrMeta = buildASRMetadata({
  toolShadowing: { successes: shadowResult.successes, attempts: shadowResult.attempts },
  radePerPayload: radeResult.perPayload,
  escalation: { successes: escalationResult.successes, attempts: escalationResult.attempts },
});
```

---

### WR-02: `radeTaxonomyKey` brittle suffix matching will silently fall through to generic label if component string format changes

**File:** `agentshield/src/stages/dynamicTesting.ts:34-39`
**Issue:** `radeTaxonomyKey` uses `component.endsWith(':role-takeover')`, `endsWith(':data-exfiltration-redirect')`, `endsWith(':privilege-escalation-command')` to map finding components to taxonomy keys. The component strings are set deep in `rade-test.ts` as `gateway:rade:${payload.id}`. If the component format is ever changed (e.g. namespaced differently), all three `endsWith` checks silently miss and every RADE finding falls back to the generic `'rade'` key (`'Indirect Prompt Injection'`), losing granular taxonomy labels with no error or warning.

**Fix:** Use a lookup map keyed on full component string:
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

### WR-03: A `callGateway` throw inside the RADE attempt loop causes the entire stage to abort — partial results are silently discarded

**File:** `agentshield/src/stages/dynamic-testing/rade-test.ts:84`
**Issue:** `await callGateway(message, sessionId)` is not wrapped in a try/catch. A single transient timeout or network error on any of the 9 calls causes the exception to propagate out of `runRADETest`, which is caught by `DynamicTestingStage.run`'s outer catch block (line 94) and converts the entire stage into an error report with `findings: []`. All tool-shadowing and escalation results accumulated before the failure are discarded. For a security scanner, partial results with a clear error marker are always preferable to no results.

**Fix:** Wrap each `callGateway` call and treat transient errors as non-successes:
```typescript
let gwResponse: GatewayResponse;
try {
  gwResponse = await callGateway(message, sessionId);
} catch {
  totalAttempts += 1;
  continue; // count as attempt, skip signature check
}
```

---

### WR-04: Same transient-failure propagation exists in `runToolShadowingTest` and `runEscalationChainTest`

**File:** `agentshield/src/stages/dynamic-testing/tool-shadowing.ts:35`
**File:** `agentshield/src/stages/dynamic-testing/escalation-test.ts:43`
**Issue:** Both single-shot runners let `callGateway` throw unhandled. The exception propagates to `DynamicTestingStage.run`'s catch block, causing the entire stage to report error with no findings — even though all other sub-tests may have completed successfully before this call. This conflates "gateway unreachable" (checked upfront by `checkGatewayReachable`) with "transient mid-test failure."

**Fix:** Wrap `callGateway` in each runner and return a zero-success result on error:
```typescript
let gwResponse: GatewayResponse;
try {
  gwResponse = await callGateway(message, sessionId);
} catch {
  return { attempts: 1, successes: 0, findings: [] };
}
```

---

### WR-05: `tagFindingWithTaxonomy` is exported but never called anywhere in the codebase — dead export

**File:** `agentshield/src/stages/dynamic-testing/asr-calculator.ts:54-62`
**Issue:** `tagFindingWithTaxonomy` is exported from `asr-calculator.ts` but `dynamicTesting.ts` does not import or use it — it spreads `mcpSecBenchLabel` manually inline (lines 60-71). The function is dead code that creates a misleading impression of a generic tagging API while the real code duplicates the logic inline.

**Fix:** Either use `tagFindingWithTaxonomy` in `dynamicTesting.ts` to replace the three inline spread patterns, or remove the export.

---

### WR-06: `stubs.test.ts` comment incorrectly attributes what prevents live network calls in `DynamicTestingStage`

**File:** `agentshield/tests/stages/stubs.test.ts:53-58`
**Issue:** The comment on lines 53-54 says "Mock fetch globally so DiscoveryStage never makes live network probes in CI. All probe attempts immediately reject — discovery returns empty findings with no error." This comment implies the `fetch` mock is what prevents `DynamicTestingStage` from making live calls. In reality, `DynamicTestingStage` is protected by the `jest.mock(...)` blocks at lines 10-36 that fully replace `gateway-client`, `tool-shadowing`, `rade-test`, and `escalation-test` modules. If a future developer removes the `jest.mock` blocks thinking the `fetch` mock is sufficient, `DynamicTestingStage` would make live gateway calls during the stub tests.

**Fix:** Update the comment to accurately describe that the `jest.mock` blocks (not the `fetch` mock) prevent live calls from `DynamicTestingStage`, and the `fetch` mock only prevents `DiscoveryStage` network probes.

---

## Info

### IN-01: RADE test hardcodes `9` expected calls rather than deriving from constants — stale on payload count change

**File:** `agentshield/tests/stages/dynamic-testing/rade-test.test.ts:82,89,122`
**Issue:** The assertions `expect(mockCallGateway).toHaveBeenCalledTimes(9)` and `expect(result.attempts).toBe(9)` hardcode `9` (3 payloads × 3 attempts). If `RADE_PAYLOADS` or `RADE_ATTEMPTS_PER_PAYLOAD` changes, these assertions will fail with unhelpful numeric mismatch messages rather than pointing to the constant.

**Fix:**
```typescript
import { RADE_PAYLOADS, RADE_ATTEMPTS_PER_PAYLOAD } from '../../../src/stages/dynamic-testing/rade-test';
// ...
const expectedCalls = RADE_PAYLOADS.length * RADE_ATTEMPTS_PER_PAYLOAD;
expect(mockCallGateway).toHaveBeenCalledTimes(expectedCalls);
```

---

### IN-02: `buildASRMetadata` and its `findPayload` fallback are not tested in `asr-calculator.test.ts`

**File:** `agentshield/tests/stages/dynamic-testing/asr-calculator.test.ts`
**Issue:** `asr-calculator.test.ts` only tests `formatASR` and `MCPSECBENCH_TAXONOMY`. The `buildASRMetadata` function, which contains non-trivial `findPayload` lookup logic (including a fallback to `{ successes: 0, attempts: 0 }` when a payload ID is absent), has no direct unit tests. The `findPayload` fallback is exercised indirectly only when `dynamicTesting.ts` calls `buildASRMetadata` — but `dynamicTesting.ts` does not call it (see WR-01), so this logic is completely untested.

**Fix:** Add tests for `buildASRMetadata` covering: normal case, missing payload ID fallback, and empty `radePerPayload` array.

---

### IN-03: `buildShadowingPrompt` with empty `legitimateTools` branch has no test coverage

**File:** `agentshield/src/stages/dynamic-testing/tool-shadowing.ts:17-19`
**Issue:** The empty-tools branch producing `'- (no legitimate tools discovered)'` is never exercised by the test suite. The `buildShadowingPrompt` tests only cover the non-empty case.

**Fix:**
```typescript
it('uses fallback text when no legitimate tools are provided', () => {
  const prompt = buildShadowingPrompt([]);
  expect(prompt).toContain('(no legitimate tools discovered)');
});
```

---

### IN-04: `dynamicTesting.ts` local `const D04_MSG` duplicate in test file will drift if constant changes

**File:** `agentshield/tests/stages/dynamic-testing/gateway-client.test.ts:9`
**Issue:** The test declares `const D04_MSG = 'Dynamic testing requires IKAS AI Gateway...'` as a local string literal while also importing `D04_ERROR_MESSAGE` from the source. The local `D04_MSG` is used in the assertion on line 44. If the constant's value changes, only the `D04_ERROR_MESSAGE` import assertion (line 123) will catch the drift; the `D04_MSG` comparison at line 44 will silently pass with the old string if the local constant is not updated.

**Fix:** Remove `const D04_MSG` and replace all usages with the imported `D04_ERROR_MESSAGE`.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
