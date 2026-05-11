---
phase: 03-static-analysis
plan: "05"
subsystem: agentshield/static-analysis
tags: [static-analysis, rug-pull, hashing, baseline, tdd, sha256, mcp02]

dependency_graph:
  requires:
    - 03-01  # AgentShield infrastructure and types
  provides:
    - recordToolHashes(servers, config): Promise<Finding[]>
    - agentshield/src/stages/static-analysis/tool-hash.ts
  affects:
    - agentshield/src/stages/staticAnalysis.ts  # can integrate recordToolHashes

tech_stack:
  added:
    - node:crypto createHash('sha256') for tool definition fingerprinting
  patterns:
    - TDD (RED-GREEN) with Jest + TypeScript
    - Baseline file persistence pattern (outputDir/tool-hashes.json)
    - Rug-pull detection via hash comparison

key_files:
  created:
    - agentshield/src/stages/static-analysis/tool-hash.ts  # 130 lines
    - agentshield/tests/stages/tool-hash.test.ts  # 193 lines
  modified: []

decisions:
  - SHA-256 hash of JSON.stringify({name, description, inputSchema}) produces deterministic fingerprint; undefined values serialize consistently
  - New tools (key absent from baseline) do not emit HIGH findings — only mutations of existing keys trigger rug-pull alerts
  - Baseline always updated after re-scan comparison so each scan compares against the most recent state
  - File I/O errors surfaced as low-severity Finding objects, never thrown — orchestrator depends on Finding[] return

metrics:
  duration: "~2 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_created: 2
  tests_added: 8
  tests_total: 88
---

# Phase 03 Plan 05: Tool Hash Baseline (STAT-04) Summary

SHA-256-based rug-pull detection recording per-tool fingerprints for all discovered MCP servers, comparing against a persistent baseline to detect tool definition mutations post-approval.

## What Was Built

### agentshield/src/stages/static-analysis/tool-hash.ts (130 lines)

Exports `recordToolHashes(servers: DiscoveredServer[], config: AgentShieldConfig): Promise<Finding[]>`.

Key behaviors:

- `mkdirSync(config.outputDir, { recursive: true })` runs first — before any file I/O (Pitfall 5 guard)
- `hashTool(tool)`: SHA-256 of `JSON.stringify({ name, description, inputSchema })` — includes inputSchema so schema-only changes trigger detection (D-14)
- **First scan** (no baseline): writes `{outputDir}/tool-hashes.json`, emits one INFO finding per server with `owaspCategory: 'MCP03:2025'`, `score: 0` (D-15)
- **Re-scan**: reads baseline, compares each key; emits HIGH finding (`score: 8.0`, `owaspCategory: 'MCP02:2025'`, `title` contains "rug-pull") for any mutated key (D-16)
- New tools (key not in baseline) silently added to updated baseline — no HIGH finding
- Baseline always rewritten after comparison so next scan compares against current state (D-16)
- All file I/O errors caught and surfaced as `severity: 'low'` findings

### agentshield/tests/stages/tool-hash.test.ts (193 lines)

8 tests across 6 describe blocks, all passing:

```
PASS tests/stages/tool-hash.test.ts
  recordToolHashes — first scan (D-15)
    ✓ creates outputDir if missing, writes baseline file, returns INFO finding per server (2 ms)
    ✓ emits one INFO per server when multiple servers discovered (1 ms)
  recordToolHashes — re-scan no change
    ✓ returns empty array when tool definitions are identical (1 ms)
  recordToolHashes — re-scan with changed description (D-16)
    ✓ emits HIGH finding tagged MCP02:2025 when a tool description changes (1 ms)
    ✓ updates baseline file to current hashes after detecting change (1 ms)
  recordToolHashes — re-scan with inputSchema change (D-14)
    ✓ detects change when only inputSchema differs (description unchanged) (1 ms)
  recordToolHashes — new tool added
    ✓ does NOT emit HIGH finding for a brand-new tool (not in baseline) (1 ms)
  recordToolHashes — Finding shape contract
    ✓ every Finding has required fields (1 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

Full suite: **88/88 tests passing** across 9 suites.

## Sample Baseline File (from test fixture)

After first scan with `http://server-a` having tool `list-users`:

```json
{
  "http://server-a#list-users": "a72f8e3d1c4b..."
}
```

Key format: `${baseUrl}#${toolName}`. After a second scan with added `delete-user`:

```json
{
  "http://server-a#list-users": "a72f8e3d1c4b...",
  "http://server-a#delete-user": "f9c21a0e8d7b..."
}
```

## TDD Gate Compliance

- RED gate: commit `be84555` — `test(03-05): add failing tests for recordToolHashes`
- GREEN gate: commit `4463b1c` — `feat(03-05): implement recordToolHashes for rug-pull detection`

Both gates present in correct order.

## Deviations from Plan

None — plan executed exactly as written.

The only minor stylistic difference: test `describe()` strings use double-quotes instead of single-quotes as shown in the plan's code block. This is functionally equivalent and does not affect behavior.

## Threat Flags

No new threat surface introduced. The `tool-hashes.json` baseline file was already documented in the plan's threat model (T-03-17 through T-03-20). No new network endpoints, auth paths, or file access patterns beyond what the plan specified.

## Known Stubs

None. All code paths are fully wired. The `recordToolHashes` function returns real findings based on actual hash computation and file comparison.

## Self-Check

- `/Users/vishwangdave/Work/IKAS/IKAS/agentshield/src/stages/static-analysis/tool-hash.ts` — FOUND
- `/Users/vishwangdave/Work/IKAS/IKAS/agentshield/tests/stages/tool-hash.test.ts` — FOUND
- Commit `be84555` (RED) — FOUND
- Commit `4463b1c` (GREEN) — FOUND

## Self-Check: PASSED
