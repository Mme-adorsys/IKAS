---
phase: 2
slug: discovery-inventory
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | agentshield/jest.config.js |
| **Quick run command** | `cd agentshield && npm test -- --testPathPattern=discovery` |
| **Full suite command** | `cd agentshield && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd agentshield && npm test -- --testPathPattern=discovery`
- **After every plan wave:** Run `cd agentshield && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | DISC-01 | — | MCP probe returns structured server list | unit | `cd agentshield && npm test -- --testPathPattern=discovery` | ❌ W0 | ⬜ pending |
| 02-01-02 | 02-01 | 1 | DISC-01 | — | Multi-port sweep detects servers on ports 8001 and 8002 | unit | `cd agentshield && npm test -- --testPathPattern=discovery` | ❌ W0 | ⬜ pending |
| 02-01-03 | 02-01 | 1 | DISC-02 | — | Tool list, resource endpoints, transport config parsed from probe response | unit | `cd agentshield && npm test -- --testPathPattern=discovery` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 1 | DISC-03 | — | Server not in allowedServers list flagged HIGH/CRITICAL | unit | `cd agentshield && npm test -- --testPathPattern=shadow` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 2 | DISC-04 | — | CVE-2025-6514 finding generated for unauthenticated server | unit | `cd agentshield && npm test -- --testPathPattern=cve` | ❌ W0 | ⬜ pending |
| 02-03-02 | 02-03 | 2 | DISC-04 | — | OWASP MCP Top 10 category annotated on matched finding | unit | `cd agentshield && npm test -- --testPathPattern=cve` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `agentshield/tests/discovery.test.ts` — stubs for DISC-01, DISC-02
- [ ] `agentshield/tests/shadow.test.ts` — stubs for DISC-03
- [ ] `agentshield/tests/cve.test.ts` — stubs for DISC-04

*Existing jest infrastructure covers all phase requirements. No new framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full scan detects both IKAS MCP servers (ports 8001, 8002) | DISC-01 | Requires running IKAS stack | Start Docker stack, run `agentshield scan http://localhost:8001`, verify both servers appear in output |
| CVE finding appears in final report | DISC-04 | Requires real scan output | Check JSON report for `cveId` field with CVE-2025-6514 or CVE-2025-49596 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
