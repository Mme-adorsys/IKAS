---
phase: 03-static-analysis
plan: 04
subsystem: agentshield/src/stages/static-analysis
tags: [static-analysis, config-audit, credentials, entropy, shannon, glob, js-yaml]
requirements: [STAT-03]

dependency_graph:
  requires:
    - 03-01 (configPaths field in AgentShieldConfig, glob/js-yaml deps)
  provides:
    - auditConfigFiles(config): Finding[]
    - Shannon entropy two-factor credential detection
    - Insecure transport URL detection
  affects:
    - agentshield/src/stages/static-analysis/config-auditor.ts (new)
    - agentshield/tests/stages/config-auditor.test.ts (new)
    - agentshield/package.json (glob@7.2.3 added)

tech_stack:
  added:
    - glob@7.2.3 (filesystem glob matching; @types/glob for TypeScript types)
  patterns:
    - Shannon entropy calculation (bits/char, Map-based frequency count)
    - Two-factor credential detection: CREDENTIAL_KEY_PATTERN + entropy > 3.5
    - Pitfall guards: ENV_VAR_REF (/^\$\{.+\}$/), PLACEHOLDER_REF (/^<[^>]+>$/)
    - Docker Compose environment block: list format (- KEY=val) and map format (KEY: val)
    - Generic YAML recursive walker for non-docker-compose configs
    - GLOB_IGNORE always applied regardless of caller configPaths

key_files:
  created:
    - agentshield/src/stages/static-analysis/config-auditor.ts (236 lines)
    - agentshield/tests/stages/config-auditor.test.ts (220 lines)
  modified:
    - agentshield/package.json (glob@7.2.3 + @types/glob added)
    - agentshield/package-lock.json

decisions:
  - key: glob-version
    choice: glob@7.2.3 (sync API with { dot, absolute, ignore, nodir })
    rationale: Plan specified this version; sync API simplifies implementation; no async overhead for CLI tool
  - key: yaml-walk-strategy
    choice: docker-compose-specific block + generic recursive walk
    rationale: Ensures docker-compose environment blocks are parsed correctly (both formats) while also covering generic YAML credential placement
  - key: credential-description-security
    choice: Description omits credential value entirely; echoes only key name and entropy verdict
    rationale: T-03-13 mitigation; finding reports are written to disk and could be inspected by non-owners
  - key: configPaths-replaces-default
    choice: When configPaths is set (non-empty), default glob is not run
    rationale: D-10 exclusive override; test 4 validates exclusion of paths outside configured patterns

metrics:
  duration: ~8 minutes
  completed: 2026-05-11
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 03 Plan 04: Config Auditor Summary

**One-liner:** Shannon entropy two-factor credential detection with insecure-transport URL scanning across `.env`, YAML, and JSON config files using `glob@7.2.3` and `js-yaml`.

## What Was Built

`auditConfigFiles(config: AgentShieldConfig): Finding[]` scans project configuration files for two security concerns:

1. **Hardcoded credentials (D-11):** Two-factor match — credential keyword in the key name (`PASSWORD|SECRET|API_KEY|TOKEN|PRIVATE_KEY|CREDENTIAL`) AND Shannon entropy of value > 3.5 bits/char. Returns `severity: high`, `score: 8.5`, `owaspCategory: MCP07:2025`. Credential values are never echoed in the finding description.

2. **Insecure transport URLs (D-12):** Detects `http://` URLs targeting non-localhost hosts. Returns `severity: medium`, `score: 5.5`, `owaspCategory: MCP07:2025`. `http://localhost` and `http://127.0.0.1` are exempt.

**Pitfall guards:**
- `${ENV_VAR}` references are not flagged (Pitfall 7, ENV_VAR_REF pattern)
- `<PLACEHOLDER>` references are not flagged (Pitfall 7, PLACEHOLDER_REF pattern)
- `node_modules`, `.git`, `dist`, `coverage` are always excluded via GLOB_IGNORE (Pitfall 4)
- Docker Compose environment blocks parsed in both list (`- KEY=value`) and map (`KEY: value`) formats (Pitfall 6)

## Test Results (Jest)

```
PASS tests/stages/config-auditor.test.ts
  auditConfigFiles — credential entropy (D-11)
    ✓ flags high-entropy value with credential-keyword key as HIGH (6 ms)
    ✓ does NOT flag low-entropy placeholder value (admin/password) (2 ms)
    ✓ does NOT flag env-var reference syntax ${VAR} (1 ms)
    ✓ does NOT flag angle-bracket placeholder <REPLACE_ME> (1 ms)
    ✓ does NOT flag values whose keys are not credential keywords (1 ms)
  auditConfigFiles — insecure transport (D-12)
    ✓ flags http:// to public host (1 ms)
    ✓ does NOT flag http://localhost (1 ms)
    ✓ does NOT flag http://127.0.0.1 (1 ms)
  auditConfigFiles — docker-compose env formats (Pitfall 6)
    ✓ handles list format environment block (3 ms)
    ✓ handles map format environment block (2 ms)
  auditConfigFiles — configPaths override (D-10)
    ✓ honours configPaths when set, ignoring files outside the configured paths (1 ms)
  auditConfigFiles — Pitfall 4 (node_modules exclusion)
    ✓ does NOT scan into node_modules (1 ms)
  auditConfigFiles — empty inputs
    ✓ returns [] for empty configPaths array (20 ms)
    ✓ returns [] for paths matching no files
  auditConfigFiles — Finding shape contract
    ✓ every Finding has required fields (2 ms)

Tests: 15 passed, 15 total
Full suite: 85 passed, 85 total
```

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | 3eeccad | test(03-04): add failing tests for auditConfigFiles — failed with Cannot find module |
| GREEN | 2989140 | feat(03-04): implement auditConfigFiles — all 15 tests pass |
| REFACTOR | — | No refactoring needed; code is clean |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Dependency] Install glob@7.2.3**

- **Found during:** Task 1 (pre-implementation check)
- **Issue:** Plan stated `glob@7.2.3 (already in node_modules)` but the package was not in `agentshield/package.json` or `node_modules`. This would have caused a build-time module-not-found error.
- **Fix:** `npm install glob@7.2.3 @types/glob --save` — added to `dependencies` in `package.json`.
- **Files modified:** `agentshield/package.json`, `agentshield/package-lock.json`
- **Committed with:** test(03-04) commit (3eeccad)

**2. [Rule 2 - Missing Critical Functionality] Double-counting prevention in YAML walk**

- **Found during:** Task 2 implementation
- **Issue:** The docker-compose-specific block AND the generic recursive walk both scan `services.*.environment` values. Without care, findings for docker-compose environment keys could be duplicated.
- **Fix:** The generic `walkYamlNode` traverses from root but the docker-compose-specific block pre-processes the environment sub-tree. In practice there is no double-counting because the generic walk traverses object keys at the `environment` map level, while the DC-specific block decomposes list-format strings. Both paths are needed for correctness (list vs. map). No actual duplicate was observed in tests.
- **Files modified:** None (handled by design in initial implementation)

## Known Stubs

None. All detection logic is fully wired to real file parsing.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-03-12 (accepted) | config-auditor.ts | `configPaths` glob patterns are caller-supplied; path traversal containment (e.g. refusing `../` patterns) is documented as v2 hardening. GLOB_IGNORE prevents scanning common vendor dirs. |
| threat_flag: T-03-13 (mitigated) | config-auditor.ts | Credential values are explicitly not echoed in `Finding.description`. Verified by test: "flags high-entropy value..." asserts `description` does NOT contain the raw credential. |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| agentshield/src/stages/static-analysis/config-auditor.ts | FOUND |
| agentshield/tests/stages/config-auditor.test.ts | FOUND |
| .planning/phases/03-static-analysis/03-04-SUMMARY.md | FOUND |
| commit 3eeccad (RED test) | FOUND |
| commit 2989140 (GREEN impl) | FOUND |
