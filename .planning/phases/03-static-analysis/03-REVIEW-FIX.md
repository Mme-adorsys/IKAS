---
phase: 03-static-analysis
fixed_at: 2026-05-11T19:05:00Z
review_path: .planning/phases/03-static-analysis/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-11T19:05:00Z
**Source review:** .planning/phases/03-static-analysis/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 Critical, 5 Warnings)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Docker-Compose Credential Findings Emitted Twice (Duplicate Findings)

**Files modified:** `agentshield/src/stages/static-analysis/config-auditor.ts`
**Commit:** 3475c95
**Applied fix:** Removed the dedicated docker-compose `services.*.environment` block (lines 121-146) from `parseYamlFile`. That block iterated environment key-value pairs and called `checkCredential`/`checkInsecureTransport` directly, then the function unconditionally called `walkYamlNode(doc, ...)` which recursed into those same nodes a second time. Replaced with a single unified `walkYamlNode` call and an explanatory comment.

---

### WR-01: Prompt-Injection Payload Echoed Verbatim into Scan Report

**Files modified:** `agentshield/src/stages/static-analysis/prompt-injection.ts`
**Commit:** aac0c9b
**Applied fix:** Added a `MAX_ECHO_LEN = 120` constant and truncation logic. The `description` field in each finding now includes only the first 120 characters of the tool description followed by `…[truncated]` if longer, instead of the full text. This prevents the suspected injection payload from being replayed verbatim to an AI agent that later reads the report. The approach mirrors the existing credential-value handling in `config-auditor.ts`.

---

### WR-02: Tool Removal Between Scans Is Silently Ignored

**Files modified:** `agentshield/src/stages/static-analysis/tool-hash.ts`
**Commit:** 4b2f5eb
**Applied fix:** Added a second `for...of` loop over `Object.entries(baseline)` after the existing changed-hash loop. Any key present in the baseline but absent in `currentHashes` now emits a `high`-severity finding titled `Tool removed since last scan: {key}`. This closes the gap where an attacker could silently drop a tool from the MCP server without triggering a rug-pull alert.

---

### WR-03: `configPaths: []` Falls Back to Default Glob Instead of Scanning Nothing

**Files modified:** `agentshield/src/stages/static-analysis/config-auditor.ts`, `agentshield/tests/stages/config-auditor.test.ts`
**Commit:** c02c751
**Applied fix:** Added an explicit early-return guard at the top of `auditConfigFiles`: when `config.configPaths !== undefined && config.configPaths.length === 0` the function returns immediately, scanning nothing. Previously the `&&` chain treated `[]` identically to `undefined`, falling through to the `DEFAULT_GLOB` CWD scan. Also hardened the companion test: it now writes a real high-entropy credential file into the temp directory before calling `auditConfigFiles({ configPaths: [] })`, so the test verifies the mechanism (early return) rather than relying on CWD being credential-free.

---

### WR-04: Base64 Regex Produces False Positives on URL Path Segments

**Files modified:** `agentshield/src/data/prompt-injection-patterns.ts`
**Commit:** 85eb134
**Applied fix:** Changed the `PI-BASE64-01` regex from `/[A-Za-z0-9+/]{40,}={0,2}/` to `/[A-Za-z0-9+/]{40,}={1,2}/` — requiring at least one trailing `=` padding character. The zero-padding allowance matched long URL paths (e.g. `com/api/v1/authentication/oauth2callback/verylongpathhere`) because `/` is in the character class. Requiring `={1,2}` eliminates those false positives while retaining detection of real base64 blobs. Verified locally: URL path no longer matches, real base64 still matches.

---

### WR-05: Three-or-More Server Shadow Detection Downgrades CRITICAL to HIGH

**Files modified:** `agentshield/src/stages/static-analysis/tool-poisoning.ts`
**Commit:** aa4279a
**Applied fix:** Replaced the `descSet.size === 1` check with a `Map`-based count that computes `maxDuplicateCount` — the highest number of servers sharing the same description. `sameDesc` is now `true` when `maxDuplicateCount >= 2`, meaning CRITICAL is raised whenever any two servers share an identical description, regardless of whether a third server presents a different one. The old approach suppressed CRITICAL in exactly that mixed-description scenario.

---

_Fixed: 2026-05-11T19:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
