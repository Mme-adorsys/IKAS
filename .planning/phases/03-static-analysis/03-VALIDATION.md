---
phase: 3
slug: static-analysis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (tsx + ts-jest) |
| **Config file** | `agentshield/jest.config.ts` |
| **Quick run command** | `cd agentshield && npx jest --testPathPattern static-analysis --passWithNoTests` |
| **Full suite command** | `cd agentshield && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd agentshield && npx jest --testPathPattern static-analysis --passWithNoTests`
- **After every plan wave:** Run `cd agentshield && npx jest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-* | 01 | 1 | STAT-01 | — | Prompt injection patterns detected in tool descriptions | unit | `npx jest --testPathPattern prompt-injection` | ❌ W0 | ⬜ pending |
| 03-02-* | 02 | 1 | STAT-02 | — | Tool name squatting and shadow tools flagged | unit | `npx jest --testPathPattern tool-poisoning` | ❌ W0 | ⬜ pending |
| 03-03-* | 03 | 2 | STAT-03 | — | Hardcoded credentials and insecure transport detected | unit | `npx jest --testPathPattern config-auditor` | ❌ W0 | ⬜ pending |
| 03-04-* | 04 | 2 | STAT-04 | — | Tool hashes written on first scan; rug-pull detected on re-scan | unit | `npx jest --testPathPattern tool-hash` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `agentshield/tests/stages/prompt-injection.test.ts` — stubs for STAT-01
- [ ] `agentshield/tests/stages/tool-poisoning.test.ts` — stubs for STAT-02
- [ ] `agentshield/tests/stages/config-auditor.test.ts` — stubs for STAT-03
- [ ] `agentshield/tests/stages/tool-hash.test.ts` — stubs for STAT-04

*Existing jest infrastructure covers all framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IKAS scan detects real credentials in docker-compose.dev.yml | STAT-03 | Requires live file system with real credentials | Run `agentshield scan http://localhost:8001 --config-paths docker/docker-compose.dev.yml` and verify HIGH finding for KEYCLOAK_ADMIN_PASSWORD |
| Rug-pull detection on modified IKAS tool description | STAT-04 | Requires two sequential scans with file modification between them | Run scan, modify a tool description, re-run scan, verify HIGH finding with MCP02:2025 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
