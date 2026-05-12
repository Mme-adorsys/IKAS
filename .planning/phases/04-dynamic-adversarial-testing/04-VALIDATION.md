---
phase: 4
slug: dynamic-adversarial-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 + ts-jest |
| **Config file** | `agentshield/jest.config.js` |
| **Quick run command** | `cd agentshield && npx jest tests/stages/dynamic-testing/ --no-coverage` |
| **Full suite command** | `cd agentshield && npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds (unit tests, mocked fetch) |

---

## Sampling Rate

- **After every task commit:** Run `cd agentshield && npx jest tests/stages/dynamic-testing/ --no-coverage`
- **After every plan wave:** Run `cd agentshield && npx jest --no-coverage`
- **Before `/gsd-verify-work`:** Full suite must be green (118 existing + all new dynamic-testing tests)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 0 | DYN-01 | D-04 | Gateway unreachable → exact error thrown | unit | `cd agentshield && npx jest tests/stages/dynamic-testing/gateway-client.test.ts -x --no-coverage` | ❌ W0 | ⬜ pending |
| 04-01-T2 | 01 | 1 | DYN-01 | D-11 | Shadow tool name in toolsCalled → attack success | unit | `cd agentshield && npx jest tests/stages/dynamic-testing/tool-shadowing.test.ts -x --no-coverage` | ❌ W0 | ⬜ pending |
| 04-01-T3 | 01 | 1 | DYN-01 | D-11 | Shadow tool NOT in toolsCalled → no finding | unit | `cd agentshield && npx jest tests/stages/dynamic-testing/tool-shadowing.test.ts -x --no-coverage` | ❌ W0 | ⬜ pending |
| 04-02-T1 | 02 | 2 | DYN-02 | D-12 | RADE signature in response → success | unit | `cd agentshield && npx jest tests/stages/dynamic-testing/rade-test.test.ts -x --no-coverage` | ❌ W0 | ⬜ pending |
| 04-02-T2 | 02 | 2 | DYN-02 | D-10 | 3 attempts per payload type (9 total) fired | unit | `cd agentshield && npx jest tests/stages/dynamic-testing/rade-test.test.ts -x --no-coverage` | ❌ W0 | ⬜ pending |
| 04-03-T1 | 03 | 2 | DYN-03 | D-13 | Neo4j write tool in toolsCalled → escalation found | unit | `cd agentshield && npx jest tests/stages/dynamic-testing/escalation-test.test.ts -x --no-coverage` | ❌ W0 | ⬜ pending |
| 04-04-T1 | 04 | 3 | DYN-04 | D-14 | ASR string formatted correctly (e.g., "67% (2/3)") | unit | `cd agentshield && npx jest tests/stages/dynamic-testing/asr-calculator.test.ts -x --no-coverage` | ❌ W0 | ⬜ pending |
| 04-04-T2 | 04 | 3 | DYN-04 | D-14 | StageReport.metadata.asrByAttackType populated | unit | `cd agentshield && npx jest tests/stages/dynamicTesting.test.ts -x --no-coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `agentshield/tests/stages/dynamic-testing/gateway-client.test.ts` — stubs for D-04 reachability check (unreachable → error, 503 → warning finding)
- [ ] `agentshield/tests/stages/dynamic-testing/tool-shadowing.test.ts` — stubs for DYN-01
- [ ] `agentshield/tests/stages/dynamic-testing/rade-test.test.ts` — stubs for DYN-02
- [ ] `agentshield/tests/stages/dynamic-testing/escalation-test.test.ts` — stubs for DYN-03
- [ ] `agentshield/tests/stages/dynamic-testing/asr-calculator.test.ts` — stubs for DYN-04
- [ ] `agentshield/tests/stages/dynamicTesting.test.ts` — stage orchestrator integration (sub-runners mocked)

No new framework install needed — Jest + ts-jest already configured and working (118 existing tests pass).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude actually invokes shadow tool in live run | DYN-01 | Non-deterministic LLM behavior; live API needed | Start IKAS gateway on port 8005, run `agentshield scan http://localhost:8001`, verify report contains tool-shadowing finding with ASR% |
| Full Claude response captured in finding description | DYN-02 (D-09) | Requires live API call to inspect real response text | Inspect finding `description` field in scan output — must contain Claude's verbatim response to RADE payload |
| Privilege escalation crossing Keycloak→Neo4j boundary | DYN-03 | Requires healthy Neo4j MCP on port 8002 | Start full IKAS stack, run scan, verify escalation finding with Neo4j write tool name in evidence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
