---
phase: 03-static-analysis
plan: "03"
subsystem: agentshield/static-analysis
tags: [static-analysis, tool-poisoning, levenshtein, shadow, name-squatting, tdd]
dependency_graph:
  requires: [03-01]
  provides: [detectToolPoisoning]
  affects: [agentshield/src/stages/staticAnalysis.ts]
tech_stack:
  added: []
  patterns: [levenshtein-distance, map-grouping, cross-product-iteration, tdd-red-green]
key_files:
  created:
    - agentshield/src/stages/static-analysis/tool-poisoning.ts
    - agentshield/tests/stages/tool-poisoning.test.ts
  modified: []
decisions:
  - "Shadow detection groups by lowercase name then checks distinct server set (Set<baseUrl>) — defensive against duplicate server entries"
  - "Squatting check explicitly skips exact-name matches so shadow and squatting scanners do not double-emit"
  - "import leven = require('leven') used (not ES import) because leven@3.1.0 uses CommonJS export ="
  - "component field for shadow finding = comma-separated server list; for squatting = baseUrl#toolName of suspicious tool"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_created: 2
---

# Phase 03 Plan 03: Tool Poisoning Detection Summary

Implemented STAT-02: cross-server tool poisoning detection (shadow + name-squatting) using two complementary scanners in `detectToolPoisoning(servers: DiscoveredServer[]): Finding[]` via TDD red-green cycle.

## What Was Built

### `agentshield/src/stages/static-analysis/tool-poisoning.ts` (84 lines)

Named export `detectToolPoisoning` implementing two detection mechanisms:

**Shadow detection (D-07):**
- Groups all tools by lowercase name using a `Map<string, ToolEntry[]>`
- For groups with tools from 2+ distinct `baseUrl` values:
  - Same description across all servers → CRITICAL, `MCP09:2025`, score 9.0
  - Diverging descriptions → HIGH, `MCP02:2025`, score 7.5

**Name-squatting detection (D-06 + D-08):**
- O(n²) cross-product over `allTools[]` (acceptable: ≤100 tools in realistic MCP environments)
- Guards applied per iteration: same-server skip, exact-name skip, length < 4 skip, leven > 2 skip
- Qualifying pairs → MEDIUM, `MCP03:2025`, score 6.0
- Both tool names appear in the finding description per D-08

### `agentshield/tests/stages/tool-poisoning.test.ts` (138 lines)

10 tests across 8 describe blocks:
- Shadow CRITICAL: identical tool name + description across servers
- Shadow HIGH: same name, diverging descriptions
- Name-squatting MEDIUM: `create-user` / `createuser` (leven=1)
- No squatting for exact-match same-name (shadow handles it)
- Short-name exclusion: `run` / `fun` (both < 4 chars) → 0 findings
- Same-server exclusion: two near-identical tools on one server → 0 squatting findings
- leven > 2 exclusion: `create-user` / `delete-realm` → 0 findings
- Empty/trivial: `[]` and single-server/single-tool → `[]`
- Finding shape contract: id, title, description, severity union, component starts with `http://`, score is number

## Jest Output Snippet

```
PASS tests/stages/tool-poisoning.test.ts
  detectToolPoisoning — shadow CRITICAL (same name + same description)
    ✓ emits CRITICAL with MCP09:2025 when two servers expose identical tool (1 ms)
  detectToolPoisoning — shadow HIGH (same name + different descriptions)
    ✓ emits HIGH with MCP02:2025 when two servers expose same-name tool with diverging descriptions
  detectToolPoisoning — name-squatting MEDIUM
    ✓ emits MEDIUM finding for cross-server tools with Levenshtein <= 2 and length >= 4 (1 ms)
    ✓ does not emit squatting for same name (handled by shadow)
  detectToolPoisoning — short-name exclusion (Pitfall 3)
    ✓ does NOT flag squatting when either name is shorter than 4 chars
  detectToolPoisoning — same-server exclusion
    ✓ does NOT compare tools within the same server for squatting
  detectToolPoisoning — leven > 2 exclusion
    ✓ does NOT flag tools with Levenshtein distance > 2 (1 ms)
  detectToolPoisoning — empty / trivial inputs
    ✓ returns [] for empty server list
    ✓ returns [] for single server with single tool
  detectToolPoisoning — Finding shape contract
    ✓ every Finding has required fields (1 ms)

Test Suites: 8 passed, 8 total
Tests:       80 passed, 80 total
```

## TDD Gate Compliance

- RED gate: `test(03-03)` commit `5fe6496` — jest failed with `TS2307: Cannot find module '../../src/stages/static-analysis/tool-poisoning'`
- GREEN gate: `feat(03-03)` commit `4184b01` — all 10 new tests pass, 70 prior tests unaffected

## Deviations from Plan

None — plan executed exactly as written. The implementation follows the exact code structure from `<action>` in Task 2 with minor inline adaptations (unicode `≤` replaced with `<=` in description string to avoid encoding issues in source).

## Known Stubs

None — `detectToolPoisoning` is fully wired. No placeholder data paths or hardcoded empty returns.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All inputs are in-memory `DiscoveredServer[]` arrays; tool names are attacker-controllable strings but the only operation on them is `String.length`, lowercase comparison, and `leven()` — no eval, no file I/O, no network calls. No new threat surface beyond what the plan's threat model already acknowledged (T-03-09, T-03-10, T-03-11).

## Self-Check

- tool-poisoning.ts: FOUND
- tool-poisoning.test.ts: FOUND
- 03-03-SUMMARY.md: FOUND
- RED commit 5fe6496: FOUND
- GREEN commit 4184b01: FOUND

## Self-Check: PASSED
