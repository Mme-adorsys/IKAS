---
phase: 01-foundation-cli
plan: "03"
subsystem: agentshield/types
tags: [types, typescript, interface-contract, stage-runner, severity-model]
dependency_graph:
  requires: [agentshield/src/types/config.ts]
  provides:
    - agentshield/src/types/findings.ts (SeverityLevel, Finding, SEVERITY_RANK)
    - agentshield/src/types/report.ts (StageReport, ScanResult, CompositeScore)
    - agentshield/src/stages/stage.interface.ts (StageRunner)
  affects:
    - plan 01-04 (ScanRunner + stubs import these types directly)
    - phases 2-6 (real stage implementations conform to StageRunner)
tech_stack:
  added: []
  patterns:
    - Structural TypeScript interfaces (no class inheritance)
    - Union type severity model with numeric rank mapping
    - TDD: failing test first, then minimal implementation
key_files:
  created:
    - agentshield/src/types/findings.ts
    - agentshield/src/types/report.ts
    - agentshield/src/stages/stage.interface.ts
    - agentshield/tests/types/types.test.ts
  modified: []
decisions:
  - "StageRunner uses structural interface (not abstract class) so any class matching the shape qualifies — avoids inheritance coupling"
  - "SEVERITY_RANK maps severity strings to numeric ranks (critical=5 down to info=1) for Phase 6 score comparisons"
  - "All types self-contained in agentshield/src/types/ (D-10) — no coupling to shared-types/"
  - "No barrel index.ts — direct imports only (anti-pattern per CONTEXT.md)"
  - "readonly name and id on StageRunner prevent mutation of stage identity at runtime"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-30T08:11:52Z"
  tasks_completed: 1
  files_created: 4
---

# Phase 1 Plan 3: Shared Type Contracts and StageRunner Interface Summary

One-liner: Locked TypeScript type contracts for AgentShield's finding severity model, stage reports, scan results, and the StageRunner interface using structural typing with 6 passing tests and zero tsc errors.

## What Was Built

Three TypeScript type files defining the data shape contracts that all downstream plans and phases depend on:

### agentshield/src/types/findings.ts

- `SeverityLevel` union type: `'critical' | 'high' | 'medium' | 'low' | 'info'`
- `SEVERITY_RANK` constant: maps each severity level to a numeric rank (critical=5, info=1) for Phase 6 ranking
- `Finding` interface: id, title, description, severity, component, score (0-10), plus optional remediation and owaspCategory fields

### agentshield/src/types/report.ts

- `CompositeScore` interface: value (0-10) + breakdown record
- `StageReport` interface: stageId, stageName, findings[], duration (ms), error (string|null)
- `ScanResult` interface: target, timestamp (ISO 8601), stages[], compositeScore

### agentshield/src/stages/stage.interface.ts

The locked StageRunner interface contract:

```typescript
export interface StageRunner {
  readonly name: string;
  readonly id: string;
  run(target: string, config: AgentShieldConfig): Promise<StageReport>;
}
```

Key design rationale:
- `run()` is async — all real stage implementations require I/O (HTTP, file system)
- Takes full `AgentShieldConfig` so stages have access to `allowedServers`, `auth`, `outputDir`
- Returns `StageReport` (not void) — the runner aggregates all reports into `ScanResult`
- `readonly name` and `readonly id` prevent mutation of stage identity at runtime
- Structural interface (no `extends`) — any class matching the shape satisfies it

## Test Results

6 tests, 0 failing, 0 skipped:

1. Finding type accepts a fully populated record
2. SEVERITY_RANK orders critical highest, info lowest
3. StageReport accepts empty findings, null error, zero duration
4. ScanResult composes target, timestamp, stages, compositeScore
5. StageRunner interface is satisfied by an async class with id, name, run()
6. SeverityLevel union excludes invalid values at compile time

TypeScript: `npx tsc --noEmit` exits 0, zero type errors.

## Commits

| Hash | Description |
|------|-------------|
| 21fedfa | feat(01-03): define Finding, SeverityLevel, StageReport, ScanResult, CompositeScore, and StageRunner |

## Deviations from Plan

### Auto-added prerequisite scaffold

**Found during:** Task 1 setup

**Issue:** Plan 01-03 runs in parallel with plans 01-01 and 01-02 (Wave 1). At execution time, the agentshield scaffold (package.json, tsconfig.json, jest.config.js) and config.ts from plans 01-01/01-02 did not yet exist in this worktree's branch.

**Fix:** Created the scaffold files (package.json, tsconfig.json, jest.config.js, tests/setup.ts) and config.ts in this worktree by copying from the main repo where plans 01-01/01-02 had already run. Used a symlink to node_modules to avoid re-installing packages.

**Files added:** agentshield/package.json, agentshield/tsconfig.json, agentshield/jest.config.js, agentshield/tests/setup.ts, agentshield/src/types/config.ts

**Impact:** These files are also being created by plans 01-01 and 01-02 in their respective worktrees. The orchestrator will need to merge them — content is identical so no conflicts are expected.

## Known Stubs

None — this plan creates pure type definitions. No runtime stubs with placeholder data.

## Threat Flags

None — this plan creates TypeScript interface declarations only. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check: PASSED

Files exist:
- agentshield/src/types/findings.ts: FOUND
- agentshield/src/types/report.ts: FOUND
- agentshield/src/stages/stage.interface.ts: FOUND
- agentshield/tests/types/types.test.ts: FOUND

Commit 21fedfa: FOUND (git log confirms)
