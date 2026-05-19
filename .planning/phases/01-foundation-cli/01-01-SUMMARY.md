---
phase: 01-foundation-cli
plan: "01"
subsystem: agentshield-cli
tags: [scaffold, cli, typescript, commander, jest, cjs-safe]
dependency_graph:
  requires: []
  provides:
    - agentshield/package.json
    - agentshield/tsconfig.json
    - agentshield/jest.config.js
    - agentshield/src/cli.ts
    - agentshield/tests/cli.test.ts
    - agentshield/tests/setup.ts
  affects:
    - agentshield/ directory structure (base for all subsequent plans)
tech_stack:
  added:
    - commander@14.0.3 (CLI argument parsing)
    - chalk@4.1.2 (CJS-safe terminal colorization)
    - ora@5.4.1 (CJS-safe spinner)
    - zod@3.23.8 (schema validation, pinned to match ai-gateway)
    - cli-table3@0.6.5 (table output)
    - js-yaml@4.1.1 (YAML parsing)
    - jest@29.7.0 + ts-jest@29.2.5 (test framework)
    - tsx@4.19.0 (TypeScript runner)
    - typescript@5.6.2 (type checking)
  patterns:
    - Commander.js scan subcommand with <target> positional argument
    - parseAsync (not parse) to avoid unhandled promise rejections
    - CJS-safe dependency pinning (chalk@4, ora@5, zod@3)
    - tsconfig mirroring ai-gateway exactly (strict: false with individual flags)
key_files:
  created:
    - agentshield/package.json
    - agentshield/tsconfig.json
    - agentshield/jest.config.js
    - agentshield/.gitignore
    - agentshield/src/cli.ts
    - agentshield/tests/setup.ts
    - agentshield/tests/cli.test.ts
  modified: []
decisions:
  - "Pinned chalk@4.1.2, ora@5.4.1, zod@3.23.8 without caret — ESM-only v5/v9/v4 would break CommonJS tsconfig"
  - "Used program.parseAsync() not program.parse() per pitfall 6 from RESEARCH.md"
  - "tsconfig strict: false with individual noImplicit* flags mirroring ai-gateway exactly"
  - "setupFilesAfterEnv (not setupFilesAfterEach) — corrected plan typo"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-30"
  tasks_completed: 2
  files_created: 7
---

# Phase 1 Plan 1: AgentShield CLI Scaffold Summary

**One-liner:** Commander.js CLI scaffold with `agentshield scan <target>` command stub, CJS-safe dependency baseline (chalk@4.1.2, ora@5.4.1, zod@3.23.8), tsconfig mirroring ai-gateway, and Jest smoke tests.

## What Was Built

Scaffolded the `agentshield/` peer-service directory from scratch with the following:

1. **Package manifest** (`package.json`): pinned CJS-safe dependencies — chalk@4.1.2 (last CJS release), ora@5.4.1 (last CJS release), zod@3.23.8 (matching ai-gateway; v4 is now npm latest with breaking changes). Commander, js-yaml, cli-table3 at latest compatible versions.

2. **TypeScript config** (`tsconfig.json`): exact copy of `ai-gateway/tsconfig.json` — `strict: false` with explicit `noImplicitAny`, `noImplicitReturns`, `noImplicitThis`, `module: commonjs`, `target: ES2022`. No `ts-node` section (not needed for CLI tool).

3. **Jest config** (`jest.config.js`): ts-jest preset following ai-gateway pattern. Key correction: plan specified `setupFilesAfterEach` (invalid key) — fixed to `setupFilesAfterEnv` (see Deviations).

4. **CLI entrypoint** (`src/cli.ts`): Commander.js program with `scan <target>` subcommand. Uses `parseAsync` not `parse`. Stub action logs `agentshield scan invoked: target=... config=...`. Note: `scan` action body is intentionally a stub — real wiring lands in plan 01-04.

5. **Test suite** (`tests/cli.test.ts`): 3 smoke tests — `scan --help` output, `--version` output, missing target exits non-zero. All pass.

## Verification Results

```
cd agentshield && npm install       -> 336 packages, 0 vulnerabilities, no ERR_REQUIRE_ESM
cd agentshield && npx tsc --noEmit  -> exit 0
npx tsx src/cli.ts scan --help      -> "Usage: agentshield scan [options] <target>" exit 0
npx tsx src/cli.ts --version        -> "0.1.0" exit 0
npm test -- --testPathPattern=cli   -> 3 passed, 0 failed
```

## Commits

| Hash | Message |
|------|---------|
| ea05c9b | chore(01-01): scaffold agentshield package manifest, tsconfig, jest config, and gitignore |
| 0b61d42 | test(01-01): add failing tests for agentshield CLI scan command |
| ce2c998 | feat(01-01): implement agentshield CLI scan command with Commander.js |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Jest config key `setupFilesAfterEach` -> `setupFilesAfterEnv`**
- **Found during:** Task 2 - test run showed "Unknown option setupFilesAfterEach" warning
- **Issue:** Plan specified `setupFilesAfterEach` which is an invalid Jest config key (throws a validation warning and the setup file is never loaded). The correct key is `setupFilesAfterEnv`.
- **Fix:** Changed `setupFilesAfterEach` to `setupFilesAfterEnv` in `agentshield/jest.config.js`
- **Files modified:** `agentshield/jest.config.js`
- **Commit:** ce2c998

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| agentshield/src/cli.ts | `scan` action body prints stub message | Intentional per plan — real wiring in plan 01-04 |

Note: This stub is intentional and documented in the plan. The `scan --help` surface and argument parsing are complete; the action implementation is deferred.

## Self-Check: PASSED
