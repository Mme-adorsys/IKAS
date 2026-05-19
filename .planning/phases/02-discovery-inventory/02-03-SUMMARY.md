---
phase: 02-discovery-inventory
plan: "03"
subsystem: agentshield/discovery
tags: [cve-lookup, owasp-mcp-top10, findings, tdd, security]
dependency_graph:
  requires:
    - agentshield/src/types/discovery.ts (DiscoveredServer from 02-01)
    - agentshield/src/stages/discovery.ts (classifyShadowServers from 02-02)
    - agentshield/src/types/findings.ts (Finding extended with cveId)
  provides:
    - agentshield/src/data/cve-lookup.ts (CVE_LOOKUP_TABLE + applyCveLookup)
    - agentshield/src/stages/discovery.ts (applyCveLookup integrated into DiscoveryStage.run)
    - agentshield/src/types/findings.ts (optional cveId field added)
  affects:
    - agentshield/tests/data/cve-lookup.test.ts (22 new unit tests)
    - agentshield/tests/stages/discovery.test.ts (3 new CVE integration tests)
tech_stack:
  added: []
  patterns:
    - Static CVE/OWASP lookup table with match predicates
    - Predicate-driven finding builder (match + build separation)
    - TDD (RED commit 675cb0b → GREEN commits 57088da + cb54c4b)
key_files:
  created:
    - agentshield/src/data/cve-lookup.ts
    - agentshield/tests/data/cve-lookup.test.ts
  modified:
    - agentshield/src/types/findings.ts
    - agentshield/src/stages/discovery.ts
    - agentshield/tests/stages/discovery.test.ts
decisions:
  - "CVE_LOOKUP_TABLE uses separate match() and build() per row for easy extension without cross-row coupling"
  - "ROW 4 (command injection) uses build(server) to interpolate actual matched tool names into description at runtime"
  - "cveId is optional on Finding (not all rows have CVE IDs — e.g. KEYCLOAK-REST-NOAUTH and TOOL-COMMAND-INJECTION)"
  - "applyCveLookup uses spread-conditional for cveId to avoid undefined key being serialized as null"
  - "T-02-09: tool name interpolation into description is accepted risk — no execution context, report-only"
metrics:
  duration_seconds: 240
  completed_date: "2026-05-10"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 03: CVE and OWASP Lookup Table — SUMMARY

Static CVE/OWASP MCP Top 10 lookup table (`CVE_LOOKUP_TABLE`) with `applyCveLookup` function that matches each discovered server against 4 CVE/OWASP rows and emits annotated `Finding` objects with `cveId` and `owaspCategory` fields; integrated into `DiscoveryStage.run` alongside shadow detection findings.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for CVE lookup table | 675cb0b | agentshield/src/types/findings.ts (MODIFIED), agentshield/tests/data/cve-lookup.test.ts (NEW) |
| 1 (GREEN) | Create cve-lookup.ts implementation | 57088da | agentshield/src/data/cve-lookup.ts (NEW) |
| 2 | Wire applyCveLookup into DiscoveryStage + integration tests | cb54c4b | agentshield/src/stages/discovery.ts (MODIFIED), agentshield/tests/stages/discovery.test.ts (MODIFIED) |

## CVE Lookup Table

| Row ID | Match Condition | owaspCategory | Severity | CVE ID |
|--------|----------------|---------------|----------|--------|
| CVE-2025-49596 | baseUrl includes 'localhost' OR '127.0.0.1' | MCP07:2025 | high | CVE-2025-49596 (CVSS 9.4) |
| CVE-2025-6514 | transport === 'mcp-jsonrpc' AND hasAuth === false | MCP07:2025 | high | CVE-2025-6514 (CVSS 9.6) |
| KEYCLOAK-REST-NOAUTH | transport === 'rest-keycloak' | MCP07:2025 | high | (none — IKAS-specific finding) |
| TOOL-COMMAND-INJECTION | tools.some(t => ['create-user','delete-user','write_neo4j_cypher'].includes(t.name)) | MCP05:2025 | high | (none — IKAS-specific finding) |

## Test Results

- **New unit tests (cve-lookup.test.ts):** 22 tests, all passing
- **New integration tests (discovery.test.ts):** 3 tests in `DiscoveryStage.run with CVE lookup`
- **Total test suite:** 70 tests across 7 suites — all pass (up from 45 in 02-02)
- **Type-check:** `npx tsc --noEmit` exits 0 (clean)
- **TDD gates:** RED commit `675cb0b` → GREEN commit `57088da` (Task 1) + GREEN commit `cb54c4b` (Task 2)

### Test coverage added

| Describe block | Tests |
|----------------|-------|
| CVE_LOOKUP_TABLE (shape + entries) | 3 |
| applyCveLookup — Keycloak localhost | 6 |
| applyCveLookup — Neo4j mcp-jsonrpc write tool | 6 |
| applyCveLookup — authenticated remote (empty) | 2 |
| applyCveLookup — Finding shape contracts | 5 |
| DiscoveryStage.run with CVE lookup (integration) | 3 |

## Phase 2 ROADMAP Success Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 1. Enumerate all IKAS MCP servers | Met | 02-01: enumerateServers + probeMcpServer (port sweep) |
| 2. List tools per discovered server | Met | 02-01: inventoryServer reads tools/list; tools[] in DiscoveredServer |
| 3. Flag shadow/unauthorized servers | Met | 02-02: classifyShadowServers, MCP09:2025 findings |
| 4. Cross-reference CVEs and OWASP MCP Top 10 | Met | 02-03: applyCveLookup with CVE-2025-49596, CVE-2025-6514, MCP07:2025, MCP05:2025 |

All 4 Phase 2 ROADMAP success criteria are now met.

## Expected Finding Count (IKAS Docker Stack)

When running `npm run scan -- http://localhost:8001` against the full IKAS Docker stack (8001 = Keycloak MCP, 8002 = Neo4j MCP, allowedServers=empty):

| Server | Finding | Rule |
|--------|---------|------|
| localhost:8001 | Shadow server (MCP09:2025, critical) | classifyShadowServers |
| localhost:8002 | Shadow server (MCP09:2025, critical) | classifyShadowServers |
| localhost:8001 | CVE-2025-49596 localhost DNS-rebinding (high) | ROW 1 |
| localhost:8002 | CVE-2025-49596 localhost DNS-rebinding (high) | ROW 1 |
| localhost:8002 | CVE-2025-6514 unauthenticated mcp-jsonrpc (high) | ROW 2 |
| localhost:8001 | KEYCLOAK-REST-NOAUTH no auth/rate-limit (high) | ROW 3 |
| localhost:8001 | TOOL-COMMAND-INJECTION create-user/delete-user (high) | ROW 4 |
| localhost:8002 | TOOL-COMMAND-INJECTION write_neo4j_cypher (high) | ROW 4 |

Total: **8 findings** across 2 servers — exceeds ROADMAP minimum of 5.

## Deviations from Plan

None — plan executed exactly as written. The test file used TypeScript `noImplicitAny` compliance from the start (imported `Finding` type for explicit inference context), consistent with Rule 1 fix pattern from 02-01.

## Known Stubs

None — `applyCveLookup` is fully functional. The `inventoryServer` identity function stub from 02-01 remains (unchanged, documented in 02-01 SUMMARY; out of scope for this plan).

## Threat Flags

No new network endpoints or auth paths introduced. `applyCveLookup` is pure in-memory matching with no network calls or external lookups.

## Hand-off Notes for Phase 3 (Static Analysis)

**DiscoveredServer[] in StageReport.metadata.discoveredServers** carries:
- `tools[].name` — tool name strings for prompt-injection analysis
- `tools[].inputSchema` — optional JSON Schema for argument surface analysis
- `tools[].annotations` — optional MCP annotations (destructive, readOnly) for risk classification
- `transport` — `'mcp-jsonrpc'` or `'rest-keycloak'` for protocol-specific injection patterns
- `baseUrl` — canonical server URL for correlation

Phase 3 (Static Analysis) can read the `DiscoveredServer[]` from `metadata.discoveredServers` and apply static prompt-injection scanning across all tool definitions.

## Self-Check: PASSED

- [x] `agentshield/src/data/cve-lookup.ts` exists
- [x] `agentshield/tests/data/cve-lookup.test.ts` exists
- [x] `grep -c "export const CVE_LOOKUP_TABLE"` returns 1
- [x] `grep -c "export function applyCveLookup"` returns 1
- [x] `grep -c "CVE-2025-49596"` returns 5 (table + tests)
- [x] `grep -c "CVE-2025-6514"` returns 4
- [x] `grep -c "MCP07:2025"` returns 3
- [x] `grep -c "MCP05:2025"` returns 1
- [x] `grep -c "cveId?: string"` in findings.ts returns 1
- [x] RED commit `675cb0b` exists in git log
- [x] GREEN commit `57088da` exists in git log
- [x] Task 2 commit `cb54c4b` exists in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `npm test` exits 0 with 70 tests passing (7 suites)
- [x] No new npm dependencies added
