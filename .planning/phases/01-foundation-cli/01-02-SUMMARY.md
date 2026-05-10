---
phase: 01-foundation-cli
plan: 02
subsystem: agentshield/config
tags: [config, zod, yaml, typescript, tdd]
dependency_graph:
  requires: []
  provides: [AgentShieldConfig type, loadConfig function, ConfigValidationError class]
  affects: [agentshield/src/cli.ts (plan 01-04), agentshield/src/runner (plan 01-04), agentshield/src/types (plan 01-03)]
tech_stack:
  added: [js-yaml@4.1.1, zod@3.23.8]
  patterns: [Zod safeParse with ConfigValidationError, throw-not-exit loader contract]
key_files:
  created:
    - agentshield/src/types/config.ts
    - agentshield/src/config/loader.ts
    - agentshield/tests/config.test.ts
    - agentshield/tests/fixtures/valid-config.yaml
    - agentshield/tests/fixtures/invalid-config.yaml
    - agentshield/package.json
    - agentshield/tsconfig.json
    - agentshield/jest.config.js
    - agentshield/.gitignore
  modified: []
decisions:
  - "Loader throws ConfigValidationError (not process.exit) — only cli.ts may exit"
  - "auth values read literally from YAML — no env-var substitution in Phase 1"
  - "STAGE_IDS tuple exported for use in runner stage filtering"
  - "AgentShieldConfigSchema and types co-located in src/types/config.ts as single source of truth"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-30"
  tasks_completed: 1
  tasks_total: 1
  files_created: 9
  files_modified: 0
---

# Phase 01 Plan 02: YAML Config Loader Summary

**One-liner:** Zod-validated YAML config loader with typed AgentShieldConfig, ConfigValidationError, and throw-not-exit contract using js-yaml + Zod 3.23.8.

## What Was Built

A standalone config module for AgentShield covering:

1. **`agentshield/src/types/config.ts`** — Single source of truth for:
   - `STAGE_IDS` tuple constant (5 stage IDs)
   - `StageId` union type
   - `AuthConfigSchema` / `AuthConfig` (optional apiKey and token)
   - `AgentShieldConfigSchema` — Zod object with URL validation, defaults, enum stages
   - `AgentShieldConfig` — inferred TypeScript type

2. **`agentshield/src/config/loader.ts`** — `loadConfig(path)` function:
   - Reads file with `fs.readFileSync`
   - Parses YAML with `js-yaml` `load()` (safe by default in v4)
   - Validates with `AgentShieldConfigSchema.safeParse()`
   - Throws `ConfigValidationError` (not `process.exit`) on validation failure
   - Throws plain `Error` on file read or YAML parse failure

3. **Test fixtures and Jest test suite** — 5 tests all green:
   - Valid full config loads correctly
   - Missing `target` triggers `ConfigValidationError` with "target" in message
   - Unknown stage ID (`foo`) rejected by Zod enum
   - Minimal config gets correct defaults (outputDir, all 5 stages, empty allowedServers)
   - Auth values read as literal strings (no `${ENV}` substitution)

## Schema Fields and Defaults

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `target` | URL string | Yes | — |
| `allowedServers` | URL string[] | No | `[]` |
| `auth.apiKey` | string | No | undefined |
| `auth.token` | string | No | undefined |
| `outputDir` | string | No | `'./agentshield-output'` |
| `stages` | StageId[] | No | All 5 stage IDs |

## Key Design Decisions

### Literal Auth (No Env-Var Substitution)
Per the RESEARCH.md open question resolution: `auth.apiKey` and `auth.token` are read as literal strings from YAML. The value `${AGENTSHIELD_API_KEY}` would be stored as-is. Env-var override support is deferred to Phase 2 when auth is actually used in real HTTP calls.

### Throw-Not-Exit Error Contract
The loader throws `ConfigValidationError` (extends Error) on invalid config — it never calls `process.exit()`. Only `cli.ts` (plan 01-04) may call `process.exit()`. This makes the loader testable without mocking process and allows callers to handle errors gracefully.

### Co-located Schema + Types
`AgentShieldConfigSchema` and `AgentShieldConfig` live together in `src/types/config.ts` as the single canonical source. The loader imports from `../types/config`. Plans 01-03 and 01-04 will import `AgentShieldConfig` directly from that same path.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary crossings introduced. The YAML `load()` function (not `loadAll()`) is safe by default per js-yaml v4 documentation.

## Self-Check: PASSED

- `agentshield/src/types/config.ts` — FOUND
- `agentshield/src/config/loader.ts` — FOUND
- `agentshield/tests/config.test.ts` — FOUND
- `agentshield/tests/fixtures/valid-config.yaml` — FOUND
- `agentshield/tests/fixtures/invalid-config.yaml` — FOUND
- Commit `a357405` — FOUND
- 5 Jest tests green — VERIFIED
- `npx tsc --noEmit` — PASSED (0 errors)
- No `process.exit` in `agentshield/src/config/` — VERIFIED
