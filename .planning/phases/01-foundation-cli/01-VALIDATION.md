---
phase: 1
slug: foundation-cli
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (matching ai-gateway/ and websocket-server/ pattern) |
| **Config file** | `agentshield/jest.config.js` — Wave 0 installs |
| **Quick run command** | `cd agentshield && npm test -- --testPathPattern=types` |
| **Full suite command** | `cd agentshield && npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd agentshield && npm test -- --testPathPattern=types`
- **After every plan wave:** Run `cd agentshield && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFRA-01 | — | CLI scaffold present | integration | `cd agentshield && node src/cli.ts scan --help` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INFRA-02 | — | Config schema validates | unit | `cd agentshield && npm test -- --testPathPattern=config` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | INFRA-03 | — | Types compile without error | unit | `cd agentshield && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 2 | INFRA-01 | — | Runner executes and outputs JSON | integration | `cd agentshield && node src/cli.ts scan http://localhost:8001 2>&1 \| grep findings` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `agentshield/jest.config.js` — Jest config with ts-jest preset (matching ai-gateway pattern)
- [ ] `agentshield/package.json` — includes `jest`, `ts-jest`, `@types/jest` dev dependencies
- [ ] `agentshield/tests/` — test directory stub created

*Framework must be installed before any task tests can run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Human-readable table output format | INFRA-01 | Visual inspection required for color/formatting | Run `cd agentshield && node src/cli.ts scan http://localhost:8001` and visually verify colored severity table appears |
| YAML config file loaded correctly | INFRA-02 | Requires real filesystem config file | Create `agentshield.config.yaml` with target URL and run scan; verify no validation error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
