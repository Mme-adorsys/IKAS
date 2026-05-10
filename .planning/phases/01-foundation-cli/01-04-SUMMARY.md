---
phase: 01-foundation-cli
plan: "04"
status: complete
completed: 2026-05-10
subsystem: agentshield-runner
tags: [runner, stages, cli-pipeline, sequential, tdd, chalk, cli-table3]
dependency_graph:
  requires:
    - agentshield/package.json (plan 01-01)
    - agentshield/src/config/loader.ts (plan 01-02)
    - agentshield/src/types/config.ts (plan 01-03)
    - agentshield/src/types/findings.ts (plan 01-03)
    - agentshield/src/types/report.ts (plan 01-03)
    - agentshield/src/stages/stage.interface.ts (plan 01-03)
  provides:
    - agentshield/src/stages/discovery.ts
    - agentshield/src/stages/staticAnalysis.ts
    - agentshield/src/stages/dynamicTesting.ts
    - agentshield/src/stages/runtimeMonitoring.ts
    - agentshield/src/stages/report.ts
    - agentshield/src/runner/runner.ts
    - agentshield/src/runner/table.ts
    - agentshield/src/runner/score.ts
    - agentshield/src/cli.ts (updated — wired to ScanRunner)
    - agentshield/tests/stages/stubs.test.ts
    - agentshield/tests/runner.test.ts
    - agentshield/tests/fixtures/runner-config.yaml
  affects:
    - Phase 2 (discovery-inventory) — ScanRunner is the execution engine all stage implementations plug into
key-files:
  created:
    - agentshield/src/runner/runner.ts
    - agentshield/src/runner/table.ts
    - agentshield/src/runner/score.ts
    - agentshield/src/stages/discovery.ts
    - agentshield/src/stages/staticAnalysis.ts
    - agentshield/src/stages/dynamicTesting.ts
    - agentshield/src/stages/runtimeMonitoring.ts
    - agentshield/src/stages/report.ts
  modified:
    - agentshield/src/cli.ts
---

# Plan 01-04 Summary: CLI Pipeline Wire-Up

## What Was Built

Completed the full Phase 1 CLI pipeline by implementing 5 stage stubs, the ScanRunner orchestrator, a chalk+cli-table3 table renderer, a composite score stub, and updating cli.ts to wire everything together end-to-end.

## Architecture Decisions

**Sequential execution (not Promise.all):** Stages run in a `for...of` loop via `ScanRunner.run()`. This preserves ordering guarantees needed for downstream phases (e.g., discovery results feeding into static analysis). Enforced by test and verified via `grep`.

**buildStages factory:** A `STAGE_REGISTRY: Record<StageId, () => StageRunner>` map decouples stage construction from the runner. Phase 2+ only needs to swap in real implementations — the registry key remains the same.

**Dual output (D-01 / D-02):** `renderTable()` writes to stdout; `writeJsonReport()` always writes `agentshield-report.json` to `config.outputDir`. These are independent calls inside `ScanRunner.run()`.

**mkdirSync recursive (Pitfall 5):** Output directory is created with `{ recursive: true }` before writing JSON to handle nested paths.

**D-08 exit semantics:** `process.exit(0)` on successful scan; `process.exit(1)` on `ConfigValidationError` or any thrown error. This is explicit in cli.ts action handler.

## Requirements Satisfied

- **INFRA-01:** `agentshield scan <target>` produces structured output (chalk table to stdout + JSON file with `findings` arrays per stage)
- **INFRA-02:** YAML config is validated on startup via `loadConfig`; invalid config produces non-zero exit
- **INFRA-03:** Every `Finding` carries `severity` and `score`; `ScanResult` has `compositeScore` (Phase 1 stub = 0)
- **D-01:** chalk-colored cli-table3 table is default stdout output
- **D-02:** `agentshield-report.json` always written
- **D-08:** exit 0 on success, non-zero on failure

## Test Coverage

27 tests passing across 5 suites:
- `tests/cli.test.ts` — CLI argument parsing, help output
- `tests/config.test.ts` — Config loading / validation
- `tests/types/types.test.ts` — TypeScript interface shapes
- `tests/stages/stubs.test.ts` — All 5 stage stubs implement StageRunner, return valid empty reports
- `tests/runner.test.ts` — ScanRunner orchestration, JSON output, stage filtering, recursive mkdir, CLI smoke test

## Self-Check: PASSED

- `npx tsc --noEmit` exits 0
- `npm test` — 27/27 passing
- `npx tsx src/cli.ts scan http://localhost:8001 --config tests/fixtures/runner-config.yaml` exits 0
- `grep -q "Promise.all" src/runner/runner.ts` returns 1 (sequential confirmed)
- `agentshield-report.json` contains target, timestamp, stages[5], compositeScore
