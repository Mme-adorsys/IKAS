---
phase: 03-static-analysis
plan: 06
subsystem: agentshield/static-analysis
tags: [static-analysis, orchestrator, stage-runner, integration, tdd]
completed: 2026-05-11
duration: ~8 minutes

dependency-graph:
  requires:
    - 03-01  # StageRunner interface with previousReports
    - 03-02  # prompt-injection sub-scanner
    - 03-03  # tool-poisoning sub-scanner
    - 03-04  # config-auditor sub-scanner
    - 03-05  # tool-hash sub-scanner
  provides:
    - StaticAnalysisStage (full orchestrator, implements StageRunner)
  affects:
    - agentshield/src/stages/staticAnalysis.ts
    - agentshield/tests/stages/staticAnalysis.test.ts

tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle (test-first integration)
    - Orchestrator pattern wiring 4 sub-scanners
    - Error containment via single try/catch
    - Graceful degradation (config-auditor-only mode when no discovery output)

key-files:
  created:
    - agentshield/tests/stages/staticAnalysis.test.ts
  modified:
    - agentshield/src/stages/staticAnalysis.ts

decisions:
  - hashBaselineWritten inferred from presence of INFO-severity findings from STAT-04 (first-scan only emits INFO)
  - extractDiscoveredServers returns null (graceful skip) on absent metadata, throws on malformed array — single try/catch in run() catches both
  - Tool-level findings placed before config-audit findings in output array (stable order for debugging)
  - toolsScanned counts ToolDefinition entries across all servers for Phase 6 metadata
---

# Phase 3 Plan 06: StaticAnalysisStage Orchestrator Summary

StaticAnalysisStage wires all four Phase 3 sub-scanners behind the StageRunner interface, extracting DiscoveredServer[] from Phase 2 previousReports and merging findings from STAT-01 through STAT-04.

## What Was Built

### agentshield/src/stages/staticAnalysis.ts (92 lines)

Replaced the stub (2-param, empty findings) with a full orchestrator:

- `extractDiscoveredServers(previousReports)` — validates metadata: returns `null` when discovery output is absent; throws a typed error when `discoveredServers` is present but not an array (T-03-22 mitigation).
- `StaticAnalysisStage.run(target, config, previousReports?)` — single `try/catch` around all sub-scanner calls (T-03-21 mitigation):
  - Config-auditor always runs.
  - When `servers !== null`: runs `scanPromptInjection`, `detectToolPoisoning`, `recordToolHashes` and merges findings.
  - When `servers === null`: emits a single INFO finding noting STAT-01/02/04 were skipped.
  - `StageReport.metadata` exposes `toolsScanned` and `hashBaselineWritten`.

### agentshield/tests/stages/staticAnalysis.test.ts (191 lines)

Integration test with 3 describe blocks and 5 tests:

1. `happy path — all 4 sub-scanners` (2 tests)
   - Merged findings contain STAT-01 HIGH + STAT-02 shadow; `toolsScanned === 3`; `hashBaselineWritten === true`
   - INFO baseline findings present from STAT-04 first scan
2. `no previousReports` (2 tests)
   - `toolsScanned === 0`; INFO skip finding present — covers both `undefined` and empty metadata
3. `error containment` (1 test)
   - Malformed `discoveredServers` (string) → `StageReport.error` is a non-empty string; `findings === []`; no throw

## Full Jest Output

```
Test Suites: 12 passed, 12 total
Tests:       118 passed, 118 total
Snapshots:   0 total
Time:        5.901 s
```

Full suite (Phase 2 discovery tests + all Phase 3 sub-scanner tests + this integration test) is green.

## Requirements Satisfied

| Requirement | Scanner | Status |
|-------------|---------|--------|
| STAT-01 — Prompt injection detection | scanPromptInjection | Wired + tested |
| STAT-02 — Tool poisoning (shadow + squatting) | detectToolPoisoning | Wired + tested |
| STAT-03 — Config credential/transport audit | auditConfigFiles | Wired + tested |
| STAT-04 — Tool hash baseline / rug-pull | recordToolHashes | Wired + tested |

## TDD Gate Compliance

- RED commit: `a11baf1` — `test(03-06): add failing integration tests for StaticAnalysisStage.run (RED)`
- GREEN commit: `4470cd3` — `feat(03-06): implement StaticAnalysisStage orchestrating all 4 sub-scanners (GREEN)`
- No REFACTOR commit needed — implementation was clean on first pass.

## Deviations from Plan

None — plan executed exactly as written. The code shape in `03-PATTERNS.md` matched the implementation precisely.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All sub-scanner threat mitigations (T-03-21, T-03-22) are in place as designed.

## Known Stubs

None. `StaticAnalysisStage.run` is fully wired; all four sub-scanners are invoked with real inputs.

## Self-Check

### Files created/modified:
- `agentshield/src/stages/staticAnalysis.ts` — FOUND
- `agentshield/tests/stages/staticAnalysis.test.ts` — FOUND

### Commits:
- `a11baf1` (RED) — FOUND
- `4470cd3` (GREEN) — FOUND

## Self-Check: PASSED
