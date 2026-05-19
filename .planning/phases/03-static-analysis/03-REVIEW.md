---
phase: 03-static-analysis
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - agentshield/package.json
  - agentshield/src/data/prompt-injection-patterns.ts
  - agentshield/src/runner/runner.ts
  - agentshield/src/stages/stage.interface.ts
  - agentshield/src/stages/static-analysis/config-auditor.ts
  - agentshield/src/stages/static-analysis/prompt-injection.ts
  - agentshield/src/stages/static-analysis/tool-hash.ts
  - agentshield/src/stages/static-analysis/tool-poisoning.ts
  - agentshield/src/stages/staticAnalysis.ts
  - agentshield/src/types/config.ts
  - agentshield/tests/stages/config-auditor.test.ts
  - agentshield/tests/stages/prompt-injection.test.ts
  - agentshield/tests/stages/staticAnalysis.test.ts
  - agentshield/tests/stages/tool-hash.test.ts
  - agentshield/tests/stages/tool-poisoning.test.ts
findings:
  critical: 1
  warning: 5
  info: 1
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the complete static-analysis stage of agentshield: four sub-scanners (prompt injection, tool poisoning, tool hash, config auditor), the stage orchestrator, supporting types, and all corresponding tests.

The core security logic is structurally sound and the test coverage is broad. However, there is one critical correctness defect in the YAML parser that produces duplicate findings for every docker-compose credential, a second-order prompt-injection risk where detected payloads are echoed verbatim into the scan report, and three logic gaps (missing tool-removal detection, a misleading `configPaths=[]` fallback, and an overbroad base64 regex). Tests for the config-auditor are non-hermetic in a way that makes them pass in the current environment but would fail if run in a directory containing real config files.

---

## Critical Issues

### CR-01: Docker-Compose Credential Findings Emitted Twice (Duplicate Findings)

**File:** `agentshield/src/stages/static-analysis/config-auditor.ts:121-150`

**Issue:** `parseYamlFile` first special-cases `services.*.environment` blocks (lines 122-146), calling `checkCredential`/`checkInsecureTransport` for each key-value pair. It then unconditionally calls `walkYamlNode(doc, '', filePath, findings)` (line 150), which recursively descends the entire document — including the same `services.*.environment` nodes — and calls `checkCredential`/`checkInsecureTransport` a second time with the same key and value. Every credential or insecure-transport finding in a docker-compose file is therefore emitted exactly twice. The docker-compose tests do not catch this because they use `.find()` rather than an exact-count assertion.

**Fix:** Remove the dedicated docker-compose block and rely solely on the generic `walkYamlNode` walk, OR exclude the `services.*.environment` subtree from the generic walk:

```typescript
// Option A — remove lines 121-146 entirely and let walkYamlNode handle everything.
// The generic walk already reaches services.*.environment correctly.

// Option B — guard the generic walk:
function parseYamlFile(content: string, filePath: string, findings: Finding[]): void {
  let doc: unknown;
  try { doc = yamlLoad(content); } catch { return; }
  if (!doc || typeof doc !== 'object') return;
  // Single unified walk — no separate docker-compose special case needed
  walkYamlNode(doc, '', filePath, findings);
}
```

---

## Warnings

### WR-01: Prompt-Injection Payload Echoed Verbatim into Scan Report (Second-Order Injection Risk)

**File:** `agentshield/src/stages/static-analysis/prompt-injection.ts:15-17`

**Issue:** Every matched finding includes `Full tool description: ${tool.description ?? '(none)'}` in the `description` field. For all five patterns — including `PI-LONG-DESC-01` (triggered on descriptions > 500 chars) — the full tool description, which IS the suspected injection payload, is written into `agentshield-report.json`. If this report is later fed to an AI agent for processing (the expected use-case for a security scanner in an agentic pipeline), the payload is replayed to the agent verbatim, achieving exactly the attack the scanner was meant to prevent. `config-auditor.ts` correctly avoids echoing credential values (line 43); the same discipline must be applied here.

**Fix:** Truncate the echoed description and/or escape it with a clear label:

```typescript
const MAX_ECHO_LEN = 120;
const rawDesc = tool.description ?? '(none)';
const truncatedDesc = rawDesc.length > MAX_ECHO_LEN
  ? rawDesc.slice(0, MAX_ECHO_LEN) + '…[truncated]'
  : rawDesc;

findings.push({
  // ...
  description:
    `Pattern "${pattern.name}" (${pattern.id}) matched in tool "${tool.name}" on ${server.baseUrl}. ` +
    `Tool description excerpt (first ${MAX_ECHO_LEN} chars): ${truncatedDesc}`,
  // ...
});
```

---

### WR-02: Tool Removal Between Scans Is Silently Ignored

**File:** `agentshield/src/stages/static-analysis/tool-hash.ts:92-112`

**Issue:** The rug-pull comparison iterates `currentHashes` and checks each key against `baseline`. Tools that existed in the previous baseline but are absent in `currentHashes` are never visited — their removal is not flagged. An attacker controlling an MCP server can remove a tool between scans without triggering any finding.

**Fix:** Add a second pass over `baseline` keys:

```typescript
// After the existing loop over currentHashes:
for (const [key, previousHash] of Object.entries(baseline)) {
  if (currentHashes[key] === undefined) {
    findings.push({
      id: randomUUID(),
      title: `Tool removed since last scan: ${key}`,
      description:
        `Tool "${key}" was present in the previous baseline (hash: ${previousHash.slice(0, 12)}...) ` +
        `but is no longer exposed by the server. Unexpected tool removal may indicate a rug-pull. (D-16)`,
      severity: 'high' as SeverityLevel,
      component: key,
      score: RUG_PULL_SCORE,
      owaspCategory: 'MCP02:2025',
      remediation: 'Verify the tool was intentionally removed. If unexpected, treat the server as untrusted.',
    });
  }
}
```

---

### WR-03: `configPaths: []` Falls Back to Default Glob Instead of Scanning Nothing

**File:** `agentshield/src/stages/static-analysis/config-auditor.ts:195-199`

**Issue:** The guard `config.configPaths && config.configPaths.length > 0` treats an empty array the same as `undefined`, falling back to `DEFAULT_GLOB` (which scans the entire `process.cwd()` tree). A caller that explicitly passes `configPaths: []` to opt out of config scanning receives a full CWD scan instead. The test at `tests/stages/config-auditor.test.ts:188-191` asserts `expect(findings).toEqual([])` and passes only because the current working directory happens to contain no high-entropy credential files; the test does not verify the mechanism, and the behavior is wrong.

**Fix:** Distinguish `undefined` (not configured, use default) from `[]` (explicitly empty, scan nothing):

```typescript
// undefined → use DEFAULT_GLOB; [] → no-op; non-empty → use provided paths
if (config.configPaths !== undefined && config.configPaths.length === 0) {
  return findings; // caller explicitly opted out
}
const patterns: string[] =
  config.configPaths && config.configPaths.length > 0
    ? config.configPaths
    : [DEFAULT_GLOB];
```

The companion test must also be fixed to verify the mechanism rather than the side-effect of an empty CWD.

---

### WR-04: Base64 Regex Produces False Positives on URL Path Segments

**File:** `agentshield/src/data/prompt-injection-patterns.ts:51`

**Issue:** The pattern `/[A-Za-z0-9+/]{40,}={0,2}/` has no anchors and the character class includes `/`, which appears in URL paths. A legitimate tool description containing a long URL such as `https://docs.example.com/api/v1/authentication/oauth2callback/verylongpathhere` will match because the path segment after `com` is 40+ characters composed entirely of `[A-Za-z0-9/]`. This will cause `PI-BASE64-01` to fire on benign tools and erode operator trust in the scanner's findings.

Verified:
```
Input: "See https://docs.example.com/api/v1/authentication/oauth2callback/verylongpathhere for details"
Match: "com/api/v1/authentication/oauth2callback/verylongpathhere"
```

**Fix:** Require at least one `+` or the characteristic trailing `=` padding, and/or exclude `/` from the character class:

```typescript
// Require padding OR a '+' to distinguish from URL paths:
match: (t) => /(?:[A-Za-z0-9+]{39,}[A-Za-z0-9+/]*={1,2}|[A-Za-z0-9+]{10,}[+][A-Za-z0-9+/]{29,})/.test(t.description ?? ''),

// Simpler: require the trailing = that real base64 blobs have (≥1)
match: (t) => /[A-Za-z0-9+/]{40,}={1,2}/.test(t.description ?? ''),
```

The `={0,2}` allowance for zero padding characters is what admits URL paths; requiring at least one `=` substantially reduces false positives while still catching typical base64-encoded payloads.

---

### WR-05: Three-or-More Server Shadow Detection Downgrades CRITICAL to HIGH

**File:** `agentshield/src/stages/static-analysis/tool-poisoning.ts:28-32`

**Issue:** `descSet` collects the description of every server that exposes a tool with the same name. If three servers share the name — two with identical descriptions and one with a different description — `descSet.size === 2`, so `sameDesc` is `false` and severity is downgraded to `high` even though two of the servers present an identical-description shadow (the CRITICAL case). A single outlier description among many identical ones silently suppresses the CRITICAL classification.

**Fix:** Calculate `sameDesc` based on whether the majority (or any two) share the same description, or emit one finding per distinct description group:

```typescript
// Count how many servers share the most common description:
const descCounts = new Map<string, number>();
for (const e of entries) {
  const d = e.tool.description ?? '';
  descCounts.set(d, (descCounts.get(d) ?? 0) + 1);
}
const maxDuplicateCount = Math.max(...descCounts.values());
const sameDesc = maxDuplicateCount >= 2; // at least 2 servers share exact description
```

---

## Info

### IN-01: `hashBaselineWritten` Metadata Field Is Misleading

**File:** `agentshield/src/stages/staticAnalysis.ts:55`

**Issue:** `hashBaselineWritten` is set to `true` only when `thFindings` contains at least one `info`-severity finding, which only occurs on the very first scan (baseline establishment). On subsequent scans that detect a rug-pull and update the baseline file, the field is `false` even though the baseline was in fact rewritten. The field name implies "did we write the baseline this run?" but actually means "was this the first scan?". Downstream consumers or UI code reading this metadata will be misinformed.

**Fix:** Rename the field to `hashBaselineEstablished` and document its meaning, or track baseline writes explicitly:

```typescript
// In recordToolHashes, return a flag in the findings or via a distinct return type
// For now, rename to clarify semantics:
metadata: {
  toolsScanned,
  hashBaselineEstablished: thFindings.some((f) => f.severity === 'info'),
}
```

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
