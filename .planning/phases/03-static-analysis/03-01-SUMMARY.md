---
phase: 03-static-analysis
plan: 01
subsystem: agentshield/runner-foundation
tags: [static-analysis, foundations, config, runner-interface, leven, prompt-injection]
dependency_graph:
  requires: []
  provides:
    - configPaths field on AgentShieldConfig (for Plan 04 config auditor)
    - StageRunner.run() previousReports param (for Plans 02-05 sub-scanners)
    - ScanRunner forwards stageReports to each stage (cross-stage data flow)
    - PROMPT_INJECTION_PATTERNS data table (for Plan 02 prompt injection scanner)
    - leven as direct dependency (for Plan 05 tool hash/similarity scanner)
  affects:
    - agentshield/src/stages/*.ts (all StageRunner implementers — optional param, no changes required)
    - agentshield/src/runner/runner.ts (now passes stageReports on each stage invocation)
tech_stack:
  added:
    - leven@3.1.0 (Levenshtein distance, direct dependency in package.json)
  patterns:
    - Table-driven pattern data (InjectionPattern[]) mirroring cve-lookup.ts shape
    - Optional parameter extension for backward-compatible interface evolution
key_files:
  created:
    - agentshield/src/data/prompt-injection-patterns.ts
  modified:
    - agentshield/src/types/config.ts
    - agentshield/src/stages/stage.interface.ts
    - agentshield/src/runner/runner.ts
    - agentshield/package.json
    - agentshield/package-lock.json
decisions:
  - "Optional parameter on StageRunner.run() chosen over EnrichedStageRunner subtype — all existing implementers remain compatible with zero modifications (Pitfall 2 resolution)"
  - "owaspCategory uniformly MCP06:2025 for all prompt injection patterns per Assumption A2 (Intent Flow Subversion)"
  - "configPaths field is optional with no default — does not break existing configs that omit it"
  - "leven pinned to ^3.1.0 to prevent silent pruning during npm prune (T-03-04 mitigation)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-11"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 5
---

# Phase 03 Plan 01: Static Analysis Foundations Summary

One-liner: Foundational runner-interface extension, leven direct-dep promotion, configPaths on AgentShieldConfig, and 5-entry PROMPT_INJECTION_PATTERNS table enabling Wave 2 sub-scanners to run in parallel.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend AgentShieldConfig + promote leven | ea043d7 | config.ts, package.json, package-lock.json |
| 2 | Extend StageRunner + ScanRunner forwarding | 4aaf900 | stage.interface.ts, runner.ts |
| 3 | Create PROMPT_INJECTION_PATTERNS data file | 4067b9d | src/data/prompt-injection-patterns.ts |

## Exact Line Changes

### agentshield/src/types/config.ts

Added one line after the `stages` field inside `AgentShieldConfigSchema`:

```typescript
// Before (line 27 area):
  stages: z.array(z.enum(STAGE_IDS)).default([...STAGE_IDS]),
});

// After:
  stages: z.array(z.enum(STAGE_IDS)).default([...STAGE_IDS]),
  configPaths: z.array(z.string()).optional(),
});
```

`AgentShieldConfig` type alias (`z.infer<typeof AgentShieldConfigSchema>`) propagates the field automatically.

### agentshield/src/stages/stage.interface.ts

Changed one line in the `StageRunner` interface:

```typescript
// Before:
  run(target: string, config: AgentShieldConfig): Promise<StageReport>;

// After:
  run(target: string, config: AgentShieldConfig, previousReports?: StageReport[]): Promise<StageReport>;
```

Parameter is optional so all existing implementers (DiscoveryStage, StaticAnalysisStage, DynamicTestingStage, RuntimeMonitoringStage, ReportStage) satisfy the contract without any modification.

### agentshield/src/runner/runner.ts

Changed one line in `ScanRunner.run()` (line ~40):

```typescript
// Before:
        const report = await stage.run(target, this.config);

// After:
        const report = await stage.run(target, this.config, stageReports);
```

The `stageReports` array is passed by reference. Stages must treat it as read-only. The array contains all reports from stages that completed before the current one.

### agentshield/package.json

Added one entry to the `dependencies` block (alphabetical order between js-yaml and ora):

```json
    "leven": "^3.1.0",
```

## leven Version Installed

`npm ls leven` output confirms direct dependency at top level:

```
agentshield@0.1.0
├─┬ jest@29.7.0
│ └─┬ @jest/core@29.7.0
│   └─┬ jest-validate@29.7.0
│     └── leven@3.1.0 deduped
└── leven@3.1.0
```

leven@3.1.0 is listed as a top-level entry under `agentshield@0.1.0` (not deduped), confirming it is a direct dependency.

## PROMPT_INJECTION_PATTERNS Count and Tier Breakdown

Total: 5 entries

| ID | Tier | Score | Pattern Type |
|----|------|-------|--------------|
| PI-ROLE-TAKEOVER-01 | CRITICAL (9.0) | Role takeover regex in name/description |
| PI-INSTR-OVERRIDE-01 | HIGH (7.5) | Instruction override regex in name/description |
| PI-LONG-DESC-01 | MEDIUM (4.5) | Description length > 500 chars |
| PI-BASE64-01 | MEDIUM (5.0) | Base64 blob ([A-Za-z0-9+/]{40,}={0,2}) in description |
| PI-UNICODE-ZWC-01 | MEDIUM (5.5) | Unicode zero-width characters in name or description |

All 5 patterns use `owaspCategory: 'MCP06:2025'` (Intent Flow Subversion). No `randomUUID` or Finding construction is present in the data file — Finding IDs are assigned by the scanner (Plan 02).

## Verification Results

- `npx tsc --noEmit`: exits 0
- `npx jest tests/stages/discovery.test.ts --no-coverage`: 21/21 tests pass (no Phase 2 regression)
- `npm ls leven`: leven@3.1.0 confirmed as top-level direct dependency

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks completed without deviation.

## Known Stubs

None. This plan adds foundational wiring and data tables. No UI-facing stubs.

## Threat Flags

No new threat surface beyond what the plan's threat_model already documents (T-03-01 through T-03-04). The `configPaths` field has Zod string validation per T-03-01 (downstream path containment enforcement is deferred to Plan 04 per the threat register). No new network endpoints, auth paths, or trust boundary crossings introduced.

## Self-Check: PASSED

- [x] agentshield/src/data/prompt-injection-patterns.ts exists
- [x] agentshield/src/types/config.ts contains configPaths field
- [x] agentshield/src/stages/stage.interface.ts contains previousReports param
- [x] agentshield/src/runner/runner.ts passes stageReports to stage.run
- [x] agentshield/package.json contains "leven": "^3.1.0"
- [x] Commits ea043d7, 4aaf900, 4067b9d exist in git log
