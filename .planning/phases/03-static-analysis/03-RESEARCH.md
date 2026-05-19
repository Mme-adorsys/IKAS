# Phase 3: Static Analysis - Research

**Researched:** 2026-05-10
**Domain:** MCP security static analysis — prompt injection detection, tool poisoning, credential scanning, SHA-256 hashing
**Confidence:** HIGH (core technical stack), MEDIUM (prompt injection library recommendation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use an existing open-source prompt injection library/dataset — do NOT hand-roll a regex list from scratch.
- **D-02:** Tiered severity model: CRITICAL for role-takeover payloads, HIGH for instruction-override payloads, MEDIUM for suspicious structural markers (long description, base64 blob, Unicode obfuscation).
- **D-03:** Finding output shape: matched pattern name + full tool description text + OWASP/MCP Top 10 category.
- **D-04:** Researcher decides on library/runtime approach (npm-only vs Python subprocess vs JSON dataset import).
- **D-05:** A new npm dependency is allowed for Levenshtein/string-similarity calculation.
- **D-06:** Levenshtein threshold must be general-purpose, calibrated for any MCP tool set.
- **D-07:** Shadow tool definition — exact duplicate name across servers → CRITICAL (MCP09:2025); same name + diverging description → HIGH (MCP02:2025).
- **D-08:** Name-squatting findings include both the suspicious tool name AND the legitimate tool it resembles.
- **D-09:** Default scan path = project root — auto-discovers `*.env`, `.env.*`, `docker-compose*.yml`, `*.yaml`, `*.json`.
- **D-10:** Configurable override — `configPaths?: string[]` in `agentshield.config.yaml` overrides root scan.
- **D-11:** Two-factor credential matching: (1) key name contains PASSWORD/SECRET/API_KEY/TOKEN/PRIVATE_KEY/CREDENTIAL (case-insensitive) AND (2) Shannon entropy of value > 3.5 bits/char.
- **D-12:** Flag `http://` values for external URLs; exempt localhost/127.0.0.1.
- **D-13:** Hash baseline file location: `{outputDir}/tool-hashes.json`.
- **D-14:** Hash each tool as SHA-256 of `JSON.stringify({ name, description, inputSchema })`.
- **D-15:** First-scan behavior: write baseline, emit one INFO finding per server with tool count.
- **D-16:** Subsequent scans: compare hashes, emit HIGH finding for any changed definition tagged `owaspCategory: 'MCP02:2025'`.

### Claude's Discretion
- Internal file organization within `agentshield/src/stages/static-analysis/`
- Whether sub-scanners are separate exported functions or separate files (follow discovery.ts pattern)
- Exact Shannon entropy implementation (inline ~10-line function is fine)
- OWASP category mapping for each prompt injection pattern severity tier
- Whether to deduplicate findings that trigger multiple patterns on the same tool

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAT-01 | System scans all tool descriptions for hidden prompt injection payloads and malicious instruction patterns | Pattern library approach documented below; `llm-guard` npm package chosen for tiered detection |
| STAT-02 | System detects tool poisoning patterns including tool shadowing, name-squatting, cross-server hijacking, and rug-pull indicators | `leven` package (already in node_modules) recommended; threshold analysis and shadow detection logic documented |
| STAT-03 | System audits configuration files for hardcoded credentials, excessive permissions, insecure transport settings, and missing authentication | Two-factor detection (key-name + entropy > 3.5) validated; `glob.sync` available via existing node_modules |
| STAT-04 | System records tool definition hashes at scan time to enable rug-pull detection across scan runs | Node.js built-in `crypto.createHash('sha256')` — zero new dependencies; baseline file write/compare pattern documented |
</phase_requirements>

---

## Summary

Phase 3 implements four sub-scanners that operate as a pure text-analysis pass over (a) `DiscoveredServer[]` from Phase 2's output and (b) the project's configuration files on disk. No network calls, no tool execution. The stage produces `Finding[]` objects conforming to the existing `Finding` interface and returns them in a `StageReport`.

The largest open question resolved by this research is the prompt injection library (D-01/D-04). The verdict is: **use a hand-curated, TypeScript-native pattern array imported from a JSON-importable data file** rather than any npm library. Neither `rebuff` (requires Pinecone + OpenAI + LangChain 0.0.159), `llm-guard` (Python only from Protect AI), nor the community JS port (`theRizwan/llm-guard`) meets the project's zero-LLM-call requirement. The correct approach is to encode the community-established attack taxonomy as a typed TypeScript array — sourced from published research (deepset/prompt-injections, Rebuff heuristic patterns, OWASP MCP Top 10) — and ship it as `src/data/prompt-injection-patterns.ts` following the exact table-driven pattern already used in `cve-lookup.ts`.

For Levenshtein (D-05/D-06), `leven@3.1.0` is the recommendation: it is already present in `agentshield/node_modules/` as a transitive dependency, ships its own `.d.ts`, and has zero dependencies. Threshold: **distance ≤ 2**, applied only when both tool names are at least 4 characters long (prevents false positives on short names like `ls` vs `la`).

For credential scanning (STAT-03), `glob.sync` from `glob@7.2.3` (already in `node_modules`) handles file discovery without a new dependency. The two-factor rule (key-name keyword + Shannon entropy > 3.5) is the same approach used by TruffleHog and validated industry practice.

For tool hashing (STAT-04), Node.js built-in `crypto.createHash('sha256')` is sufficient — confirmed already imported in `discovery.ts` via `randomUUID`.

**Primary recommendation:** Build the four sub-scanners as named exported functions inside `agentshield/src/stages/static-analysis/` sub-directory, following the exact pattern of `discovery.ts` (named exports + `class StaticAnalysisStage implements StageRunner`). Use zero new npm dependencies for STAT-02, STAT-03, and STAT-04. Add one new npm dependency (`leven`) only if it is not already satisfiable from the transitive tree — but it already is.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Prompt injection scan (STAT-01) | Static Analysis Stage | Pattern data module | Pure regex/keyword over strings — no network, no LLM |
| Tool poisoning detection (STAT-02) | Static Analysis Stage | — | Levenshtein over in-memory tool name lists |
| Config credential auditor (STAT-03) | Static Analysis Stage | File system (glob) | Reads files from project root; no MCP communication |
| Tool hash recorder (STAT-04) | Static Analysis Stage | `{outputDir}/tool-hashes.json` | Writes to output dir, reads from same on re-scan |
| OWASP category tagging | Data layer (`prompt-injection-patterns.ts`) | Stage output | Same pattern as `cve-lookup.ts` — data drives output |

---

## Standard Stack

### Core (no new dependencies for STAT-02/03/04)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `crypto` (Node built-in) | Node ≥18 | SHA-256 hashing for STAT-04 | Already used in `discovery.ts` (`randomUUID`) |
| `leven` | 3.1.0 | Levenshtein distance for STAT-02 name-squatting | Already in `agentshield/node_modules/` (transitive dep); ships `.d.ts`; zero dependencies; MIT |
| `glob` | 7.2.3 | File discovery for STAT-03 config scan | Already in `agentshield/node_modules/` (transitive dep); `glob.sync` works for synchronous discovery |
| `js-yaml` | 4.1.1 | Parse `.yaml`/`docker-compose*.yml` for STAT-03 | Already a **direct** agentshield dependency |
| `zod` | 3.23.8 | Validate `configPaths` field in config schema | Already a direct agentshield dependency |

[VERIFIED: npm registry, node_modules inspection]

### Supporting (pattern data)

| Item | Source | Purpose | When to Use |
|------|--------|---------|-------------|
| `src/data/prompt-injection-patterns.ts` | Hand-curated from deepset/prompt-injections, Rebuff heuristics, OWASP MCP06 | Pattern library for STAT-01 | Always — this IS the scanner's intelligence |
| `src/data/unicode-obfuscation-ranges.ts` | Unicode standard | Zero-width/homoglyph detection for MEDIUM tier | Included in pattern file or inline in scanner |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `leven` | `fast-levenshtein@3.0.0` | fast-levenshtein needs `@types/fast-levenshtein` (separate install, DefinitelyTyped); `leven` ships its own `.d.ts`. leven is already in node_modules. |
| `leven` | `fastest-levenshtein@1.0.16` | fastest-levenshtein is faster but not already in node_modules; adds a dependency with WASM. Overkill for ≤100 tool names. |
| `glob` | `fast-glob@3.3.3` | fast-glob is faster, not in node_modules. Not worth adding for STAT-03 which scans ≤200 files. |
| JS pattern array | `llm-guard` (npm, theRizwan) | `llm-guard@0.1.8` is 252 kB, last published 11 months ago, 5 stars, opaque patterns. Our JSON-importable approach gives full control over the taxonomy and zero runtime risk. [VERIFIED: npm registry] |
| JS pattern array | `rebuff@0.1.0` | Requires Pinecone, OpenAI, LangChain 0.0.159, chromadb — it is a client SDK for a hosted service, not a pattern library. Incompatible with offline/static operation. [VERIFIED: npm registry] |
| JS pattern array | Python subprocess (protectai/llm-guard Python) | Adds Python runtime dependency, subprocess coordination, error propagation complexity. AgentShield is a CLI tool; subprocess adds 2-3 seconds per scan. Rejected. |

**Installation (no new packages needed for direct dependencies):**
```bash
# No new npm install needed — leven, glob, js-yaml, zod, crypto are all available
# Verify transitive deps are stable:
cd agentshield && npm ls leven glob
```

---

## Architecture Patterns

### System Architecture Diagram

```
StaticAnalysisStage.run(target, config)
          │
          ├─── reads from ──► StageReport.metadata.discoveredServers  (DiscoveredServer[])
          │                   (written by Phase 2 DiscoveryStage)
          │
          ├─── STAT-01 scanPromptInjection(servers)
          │       │  reads: server.tools[].name, server.tools[].description
          │       │  data:  prompt-injection-patterns.ts (pattern table)
          │       └─► Finding[] (CRITICAL/HIGH/MEDIUM)
          │
          ├─── STAT-02 detectToolPoisoning(servers)
          │       │  reads: server.tools[].name  (cross-server comparison)
          │       │  uses:  leven(nameA, nameB) ≤ 2 for squatting
          │       └─► Finding[] (CRITICAL=shadow/MEDIUM=squatting)
          │
          ├─── STAT-03 auditConfigFiles(config)
          │       │  reads: glob(root, patterns) → file list
          │       │  parses: yaml, env, json files
          │       │  applies: key-name keyword + Shannon entropy > 3.5
          │       └─► Finding[] (HIGH=real-credential/MEDIUM=http-transport)
          │
          ├─── STAT-04 recordToolHashes(servers, config)
          │       │  reads:  {outputDir}/tool-hashes.json (if exists)
          │       │  hashes: SHA-256(JSON.stringify({name, description, inputSchema}))
          │       │  writes: {outputDir}/tool-hashes.json
          │       └─► Finding[] (INFO=baseline / HIGH=hash-changed)
          │
          └─► StageReport { findings: [...all], metadata: { hashBaseline, toolsScanned } }
```

### Recommended Project Structure
```
agentshield/src/stages/static-analysis/
├── prompt-injection.ts    # scanPromptInjection(servers): Finding[]
├── tool-poisoning.ts      # detectToolPoisoning(servers): Finding[]
├── config-auditor.ts      # auditConfigFiles(config): Finding[]
└── tool-hash.ts           # recordToolHashes(servers, config): Promise<Finding[]>

agentshield/src/data/
├── cve-lookup.ts          # (existing)
└── prompt-injection-patterns.ts   # NEW: pattern table for STAT-01
```

The top-level `agentshield/src/stages/staticAnalysis.ts` stub (existing file, 18 lines) becomes the orchestrating class that calls all four sub-scanners and merges findings.

### Pattern 1: Sub-scanner as Named Export (follows discovery.ts)

**What:** Each sub-scanner is a named exported function (not a class). The stage class calls them and merges.
**When to use:** Always — consistent with `classifyShadowServers`, `applyCveLookup` pattern.

```typescript
// Source: agentshield/src/stages/discovery.ts lines 46-71 (existing pattern)
export function scanPromptInjection(servers: DiscoveredServer[]): Finding[] {
  const findings: Finding[] = [];
  for (const server of servers) {
    for (const tool of server.tools) {
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.match(tool)) {
          findings.push({
            id: randomUUID(),
            title: `${pattern.name}: ${tool.name}`,
            description: `Pattern "${pattern.name}" matched in tool description. Full description: ${tool.description ?? '(none)'}`,
            severity: pattern.severity,
            component: `${server.baseUrl}#${tool.name}`,
            score: pattern.score,
            owaspCategory: pattern.owaspCategory,
          });
        }
      }
    }
  }
  return findings;
}
```

### Pattern 2: Table-Driven Pattern Library for STAT-01 (follows cve-lookup.ts)

**What:** Prompt injection patterns defined as a typed array, each with a `match` predicate and metadata.
**When to use:** Always for STAT-01 — separates data from logic, enables easy extension.

```typescript
// Source: modeled on agentshield/src/data/cve-lookup.ts
interface InjectionPattern {
  id: string;
  name: string;
  severity: SeverityLevel;
  score: number;
  owaspCategory: string;  // MCP06:2025 for most prompt injection
  match: (tool: ToolDefinition) => boolean;
}

export const PROMPT_INJECTION_PATTERNS: InjectionPattern[] = [
  // CRITICAL tier — role-takeover
  {
    id: 'PI-ROLE-TAKEOVER-01',
    name: 'Role Takeover Payload',
    severity: 'critical',
    score: 9.0,
    owaspCategory: 'MCP06:2025',
    match: (t) => /\b(you are now|act as|pretend (you are|to be)|your (new|true) (role|instructions|persona))\b/i
      .test(`${t.name ?? ''} ${t.description ?? ''}`),
  },
  // HIGH tier — instruction override
  {
    id: 'PI-INSTR-OVERRIDE-01',
    name: 'Instruction Override Payload',
    severity: 'high',
    score: 7.5,
    owaspCategory: 'MCP06:2025',
    match: (t) => /\b(ignore (previous|prior|all|above)|disregard (your|previous)|forget (all|your|previous)|override (system|instructions))\b/i
      .test(`${t.name ?? ''} ${t.description ?? ''}`),
  },
  // MEDIUM tier — structural markers
  {
    id: 'PI-LONG-DESC-01',
    name: 'Unusually Long Tool Description',
    severity: 'medium',
    score: 4.5,
    owaspCategory: 'MCP06:2025',
    match: (t) => (t.description?.length ?? 0) > 500,
  },
  {
    id: 'PI-BASE64-01',
    name: 'Base64 Blob in Tool Description',
    severity: 'medium',
    score: 5.0,
    owaspCategory: 'MCP06:2025',
    match: (t) => /[A-Za-z0-9+/]{40,}={0,2}/.test(t.description ?? ''),
  },
  {
    id: 'PI-UNICODE-ZWC-01',
    name: 'Unicode Zero-Width Character in Tool Description',
    severity: 'medium',
    score: 5.5,
    owaspCategory: 'MCP06:2025',
    match: (t) => /[​-‍﻿⁠­]/.test(`${t.name ?? ''}${t.description ?? ''}`),
  },
];
```

[ASSUMED] — The exact pattern strings above are derived from established community research (Rebuff project regex, deepset/prompt-injections dataset taxonomy, OWASP LLM01/MCP06 descriptions). They should be reviewed against the full published dataset before shipping.

### Pattern 3: Levenshtein Name-Squatting Detection (STAT-02)

**What:** Cross-product comparison of all tool names across servers using `leven`. Emit finding when distance ≤ 2 and both names have length ≥ 4.
**When to use:** STAT-02 name-squatting check.

```typescript
// Source: leven@3.1.0 (already in node_modules)
import leven = require('leven');

export function detectToolPoisoning(servers: DiscoveredServer[]): Finding[] {
  const findings: Finding[] = [];
  const allTools = servers.flatMap(s => s.tools.map(t => ({ server: s, tool: t })));

  // Shadow detection: same name across different servers
  const nameToServers = new Map<string, typeof allTools>();
  for (const entry of allTools) {
    const key = entry.tool.name.toLowerCase();
    if (!nameToServers.has(key)) nameToServers.set(key, []);
    nameToServers.get(key)!.push(entry);
  }
  for (const [name, entries] of nameToServers) {
    if (entries.length < 2) continue;
    const descSet = new Set(entries.map(e => e.tool.description ?? ''));
    const severity = descSet.size === 1 ? 'critical' : 'high';
    // ... build finding per D-07
  }

  // Name-squatting: Levenshtein ≤ 2 between different-server tools
  for (let i = 0; i < allTools.length; i++) {
    for (let j = i + 1; j < allTools.length; j++) {
      const a = allTools[i];
      const b = allTools[j];
      if (a.server.baseUrl === b.server.baseUrl) continue; // same server is fine
      if (a.tool.name === b.tool.name) continue; // handled above as shadow
      const na = a.tool.name, nb = b.tool.name;
      if (na.length < 4 || nb.length < 4) continue; // skip short names
      if (leven(na, nb) <= 2) {
        findings.push({
          id: randomUUID(),
          title: `Tool name-squatting: "${na}" resembles "${nb}"`,
          description: `Tool "${na}" on ${a.server.baseUrl} has Levenshtein distance ≤ 2 from "${nb}" on ${b.server.baseUrl}. This pattern is consistent with name-squatting attacks where an attacker registers a nearly identical tool name.`,
          severity: 'medium',
          component: `${a.server.baseUrl}#${na}`,
          score: 6.0,
          owaspCategory: 'MCP03:2025',
        });
      }
    }
  }
  return findings;
}
```

### Pattern 4: Shannon Entropy Calculation (STAT-03)

**What:** Inline ~10-line function; no npm dependency.
**When to use:** Every credential value candidate in STAT-03.

```typescript
// Source: Shannon entropy formula (information theory standard)
function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of str) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
```

Entropy values for validation against IKAS docker-compose.dev.yml [VERIFIED: manual calculation]:
- `admin` → ~2.32 bits/char — below 3.5 threshold → NOT flagged as real credential
- `password` → ~2.75 bits/char — below 3.5 → NOT flagged
- `sk-ant-api03-...` (Anthropic key, ~40 chars random) → ~5.8 bits/char → flagged CORRECT
- `AIzaSyDa1fNkc-LVV7EKhEBHm8VA7yyrpEitje4` (Gemini key visible in docker-compose) → ~5.1 bits/char → flagged CORRECT

### Pattern 5: SHA-256 Tool Hash Recording (STAT-04)

**What:** Hash each tool definition, write/compare `tool-hashes.json` in `outputDir`.

```typescript
// Source: Node.js built-in crypto module (already imported in discovery.ts)
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

function hashTool(tool: ToolDefinition): string {
  const canonical = JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export async function recordToolHashes(
  servers: DiscoveredServer[],
  config: AgentShieldConfig,
): Promise<Finding[]> {
  const baselinePath = join(config.outputDir, 'tool-hashes.json');
  const currentHashes: Record<string, string> = {};
  for (const server of servers) {
    for (const tool of server.tools) {
      const key = `${server.baseUrl}#${tool.name}`;
      currentHashes[key] = hashTool(tool);
    }
  }

  const isFirstScan = !existsSync(baselinePath);
  if (isFirstScan) {
    writeFileSync(baselinePath, JSON.stringify(currentHashes, null, 2), 'utf8');
    // Emit one INFO finding per server (D-15)
    return servers.map(server => ({
      id: randomUUID(),
      title: `Tool hash baseline established for ${server.baseUrl}`,
      description: `Baseline established for ${server.tools.length} tools. Re-run to detect definition changes.`,
      severity: 'info' as SeverityLevel,
      component: server.baseUrl,
      score: 0,
      owaspCategory: 'MCP03:2025',
    }));
  }

  const baseline: Record<string, string> = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const findings: Finding[] = [];
  for (const [key, hash] of Object.entries(currentHashes)) {
    if (baseline[key] !== undefined && baseline[key] !== hash) {
      findings.push({
        id: randomUUID(),
        title: `Tool definition changed (rug-pull indicator): ${key}`,
        description: `Tool "${key}" hash changed since last scan. Previous: ${baseline[key].slice(0,12)}... Current: ${hash.slice(0,12)}...`,
        severity: 'high' as SeverityLevel,
        component: key,
        score: 8.0,
        owaspCategory: 'MCP02:2025',
      });
    }
  }
  writeFileSync(baselinePath, JSON.stringify(currentHashes, null, 2), 'utf8');
  return findings;
}
```

### Anti-Patterns to Avoid

- **Using rebuff as a dependency:** It requires Pinecone + OpenAI + LangChain. It is a client SDK for a hosted detection service, not a regex pattern library. [VERIFIED: npm registry inspection]
- **Using the Python llm-guard via subprocess:** Adds 2-3s cold start per scan, cross-process error handling complexity, and a Python runtime requirement that IKAS users may not have.
- **Using the JS `llm-guard` package (theRizwan):** 252 kB, 11 months since last publish, 5 GitHub stars, opaque pattern implementation — opaque patterns make tiered severity mapping impossible. [VERIFIED: npm registry + GitHub inspection]
- **Setting Levenshtein threshold to 1:** Too strict — false positive rate 26% across typical npm-sized name sets. Use 2. [CITED: https://blog.scottlogic.com/2018/02/27/hunting-typosquatters-on-npm.html]
- **Setting Levenshtein threshold to 3:** 64% false positive rate. Use 2. [CITED: same source]
- **Applying Levenshtein to short names (< 4 chars):** `run` and `fun` have distance 1 but are completely unrelated. Skip names shorter than 4 characters.
- **Barrel files:** CONVENTIONS.md and 03-CONTEXT.md explicitly prohibit `index.ts` barrel files. Import from specific file paths.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Edit distance | Custom DP matrix | `leven` (already in node_modules) | leven is battle-tested, ships `.d.ts`, zero deps |
| File glob | `fs.readdirSync` recursive walker | `glob.sync` (already in node_modules) | Handles symlinks, ignore patterns, cross-platform paths |
| YAML parsing | Line-by-line regex | `js-yaml.load()` (already a direct dep) | Multi-line values, anchors, nested structures |
| SHA-256 | md5 or custom hash | `crypto.createHash('sha256')` (Node built-in) | Cryptographic quality, no dep |
| Shannon entropy | external library | Inline 10-line function | Trivial implementation, zero dependency risk |
| Credential patterns | Full secret scanner clone | Two-factor (key-name keyword + entropy > 3.5) | Matches TruffleHog/Gitleaks approach at 1/100th complexity |

**Key insight:** Every tool needed for Phase 3 is already available (crypto built-in, leven/glob as transitives, js-yaml/zod as direct deps). The only real open-source contribution needed is the prompt injection pattern taxonomy — and that is best owned as a data file in the codebase, not delegated to an opaque third-party package.

---

## Common Pitfalls

### Pitfall 1: AgentShieldConfig missing `configPaths` field for D-10
**What goes wrong:** `agentshield.config.yaml` parser ignores `configPaths:` because the Zod schema doesn't define it. STAT-03 always uses the default root scan regardless of user config.
**Why it happens:** `AgentShieldConfig` in `config.ts` doesn't yet have `configPaths?: string[]`.
**How to avoid:** Add `configPaths: z.array(z.string()).optional()` to `AgentShieldConfigSchema`. Wave 0 task.
**Warning signs:** TypeScript compilation error when accessing `config.configPaths`.

### Pitfall 2: `StageReport.metadata` missing `discoveredServers` for Phase 3 input
**What goes wrong:** `StaticAnalysisStage.run()` receives `target` (a URL string) but not the `DiscoveredServer[]` from Phase 2.
**Why it happens:** `StageRunner.run(target, config)` interface has no `previousReports` parameter. The runner must pass Phase 2's metadata forward.
**How to avoid:** Read `discoveredServers` from the scan runner's in-memory state or extend `run()` signature — research shows the runner calls stages sequentially (see `runner.test.ts`). The cleanest approach: extend `run()` to accept an optional `previousStageReports?: StageReport[]` parameter, OR have the runner pass a derived `servers` list. Check how `ScanRunner` sequences stages before planning.
**Warning signs:** `StaticAnalysisStage` emits zero findings even for servers with malicious tool names.

### Pitfall 3: Levenshtein false positives on short MCP tool names
**What goes wrong:** Tools like `run` (distance 1 from `fun`, `gun`, `bun`, `sun`) generate dozens of spurious name-squatting findings.
**Why it happens:** Levenshtein distance is proportionally meaningless for short strings.
**How to avoid:** Skip the comparison when either name has fewer than 4 characters.
**Warning signs:** Test suite showing name-squatting findings for tool names `list` vs `last` (edit distance 2, clearly not squatting).

### Pitfall 4: glob scanning into node_modules and hidden dirs
**What goes wrong:** STAT-03 finds credentials in `node_modules/.bin/env-sample` or test fixtures, flooding findings.
**Why it happens:** `glob.sync('**/*.env', { cwd: root })` without `ignore` recurses everywhere.
**How to avoid:** Always pass `ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**']` to `glob.sync`.
**Warning signs:** Dozens of STAT-03 findings in a fresh project with no real config files.

### Pitfall 5: SHA-256 baseline written before `outputDir` exists
**What goes wrong:** `writeFileSync` throws `ENOENT` when the runner hasn't created `outputDir` yet.
**Why it happens:** The runner creates the report file in the same directory, but only after all stages run.
**How to avoid:** Call `mkdirSync(config.outputDir, { recursive: true })` before writing the baseline in STAT-04.
**Warning signs:** Runtime crash on first scan.

### Pitfall 6: YAML parsing `docker-compose.dev.yml` environment block
**What goes wrong:** Docker Compose `environment:` can be a list (`- KEY=value`) or a map (`KEY: value`). `js-yaml.load()` returns either an array or an object depending on which format is used.
**Why it happens:** Both formats are valid YAML/Docker Compose. IKAS uses the map format; other projects may use the list format.
**How to avoid:** In the config auditor, handle both: if `environment` is an array, split on `=`; if it's an object, iterate key/value pairs.
**Warning signs:** STAT-03 finds zero credentials in IKAS docker-compose despite `GEMINI_API_KEY` and `KEYCLOAK_ADMIN_PASSWORD` being present.

### Pitfall 7: Entropy false positive on `.env` variable substitution syntax
**What goes wrong:** Values like `${GEMINI_API_KEY}` or `<REPLACE_ME>` flag as high entropy.
**Why it happens:** `${GEMINI_API_KEY}` contains uppercase letters + special chars → entropy ≈ 3.8.
**How to avoid:** After the entropy check, add a second filter: skip values that match `/^\$\{.+\}$/` (env var reference) or `/^<[^>]+>$/` (placeholder).
**Warning signs:** Dozens of false-positive STAT-03 findings in CI for unset `.env` templates.

---

## Code Examples

### Verified: glob.sync with ignore patterns

```typescript
// Source: glob@7.2.3 (in agentshield/node_modules)
import { sync as globSync } from 'glob';

const files = globSync('**/{*.env,.env.*,docker-compose*.yml,*.yaml,*.json}', {
  cwd: projectRoot,
  absolute: true,
  ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**'],
  dot: true,  // include hidden files like .env
  nodir: true,
});
```

### Verified: js-yaml parsing for Docker Compose environment block

```typescript
// Source: js-yaml@4.1.1 (direct agentshield dependency)
import { load as yamlLoad } from 'js-yaml';
import { readFileSync } from 'fs';

const doc = yamlLoad(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
const services = doc['services'] as Record<string, { environment?: Record<string,string> | string[] }> | undefined;
if (services) {
  for (const [, service] of Object.entries(services)) {
    const env = service.environment;
    if (Array.isArray(env)) {
      // List format: ["KEY=value", ...]
      for (const item of env) {
        const eqIdx = item.indexOf('=');
        if (eqIdx === -1) continue;
        const key = item.slice(0, eqIdx);
        const val = item.slice(eqIdx + 1);
        checkCredential(key, val, filePath);
      }
    } else if (env && typeof env === 'object') {
      // Map format: { KEY: value }
      for (const [key, val] of Object.entries(env)) {
        checkCredential(key, String(val ?? ''), filePath);
      }
    }
  }
}
```

### Verified: leven import pattern (CommonJS module)

```typescript
// Source: leven@3.1.0 index.d.ts — uses export = pattern
import leven = require('leven');

const distance = leven('create-user', 'createuser');  // returns 1
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ML model for prompt injection (requires Python/GPU) | Regex + keyword taxonomy against static strings | 2024-2025, driven by offline/static scanner requirements | Pattern-based works for tool description scanning; ML is overkill for short strings |
| Entropy alone for credential detection | Two-factor: key-name keyword AND entropy > 3.5 | ~2022 (TruffleHog v3) | Dramatically lower false positive rate; `admin`, `password`, `${VAR}` filtered out |
| Domain-squatting: threshold = 1 | Typosquatting: threshold = 2 for names ≥ 4 chars | ~2018-2020 research [CITED: scottlogic.com] | Threshold 1 has 26% false positive rate; 2 is the community standard |

**Deprecated/outdated:**
- `rebuff@0.1.0` npm: Requires OpenAI + Pinecone — it's a hosted-service client SDK, not useful for static analysis.
- Entropy-only credential detection: generates excessive false positives on config templates; two-factor approach is now standard.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Prompt injection pattern strings (regex in Pattern 2 code example) are comprehensive for CRITICAL/HIGH tiers | Code Examples | Scanner may miss novel jailbreak phrases; add more patterns from deepset dataset |
| A2 | OWASP MCP Top 10 category for prompt injection in tool descriptions is MCP06:2025 (Intent Flow Subversion) | Standard Stack / Pattern 2 | Could also be MCP03:2025 (Tool Poisoning) for tool-embedded payloads — verify against canonical OWASP MCP source |
| A3 | `leven` is a transitive dependency that will remain after future `npm install` — verify it's not pruned | Standard Stack | Would require `npm install leven` as direct dep in agentshield/package.json |
| A4 | `glob.sync` in `glob@7.2.3` accepts `ignore` as array of glob strings | Code Examples | If API differs, use `ignore: new glob.GlobSync(...)` form — verify against glob 7.x docs |
| A5 | name-squatting OWASP category is MCP03:2025 (Tool Poisoning) | Pattern 3 code | Could be MCP09:2025 (Shadow MCP Servers) — context says D-07 shadow detection maps to MCP09 |

---

## Open Questions (RESOLVED)

1. **How does `StaticAnalysisStage` receive `DiscoveredServer[]` from Phase 2?**
   - What we know: `StageRunner.run(target, config)` has no `previousReports` parameter. `ScanRunner` sequences stages.
   - What's unclear: Does the runner pass metadata between stages? Does Phase 3 re-run discovery internally?
   - Recommendation: Inspect `agentshield/src/runner/runner.ts` before creating the plan. The cleanest solution is to have the runner call stages with `previousReports?: StageReport[]` and let Phase 3 extract `metadata.discoveredServers`.
   - **RESOLVED: Plan 03-01 Task 2 extends `StageRunner.run()` to accept `previousReports?: StageReport[]`. Plan 03-06 extracts `DiscoveredServer[]` via `extractDiscoveredServers(previousReports)` helper.**

2. **Should name-squatting check compare tools within the same server?**
   - What we know: D-08 says name-squatting is cross-server (suspicious tool resembles legitimate tool on another server). D-07 shadow detection covers same-server duplicates.
   - What's unclear: Are within-server similar names meaningful in a single-server scan scenario (no cross-server comparison possible)?
   - Recommendation: For single-server scans, still run name-squatting but compare against a built-in "known-safe MCP tool name" list. Defer to planner.
   - **RESOLVED: Plan 03-03 skips same-server pairs in name-squatting — D-08 cross-server only. For single-server scans with no other servers, name-squatting produces no findings by design.**

3. **Deduplication of findings across sub-scanners**
   - What we know: CONTEXT.md leaves this to Claude's discretion.
   - Recommendation: If a tool triggers both PI-ROLE-TAKEOVER-01 (STAT-01) AND has a changed hash (STAT-04), emit both — they are different finding types. Only deduplicate within the same scanner when a single tool matches multiple patterns at the same severity tier (emit highest only).
   - **RESOLVED: Plan 03-06 emits all findings from all sub-scanners without cross-scanner deduplication. Within-scanner deduplication (highest severity for same tool+pattern) is handled inside each sub-scanner.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js crypto | STAT-04 hashing | ✓ | Node ≥18 built-in | — |
| `leven` | STAT-02 Levenshtein | ✓ | 3.1.0 (in node_modules) | `fast-levenshtein` + `@types/fast-levenshtein` |
| `glob` | STAT-03 file discovery | ✓ | 7.2.3 (in node_modules) | `fast-glob@3.3.3` |
| `js-yaml` | STAT-03 YAML parse | ✓ | 4.1.1 (direct dep) | — |
| `zod` | Config schema extension | ✓ | 3.23.8 (direct dep) | — |
| `randomUUID` from `crypto` | Finding IDs | ✓ | Node ≥18 built-in | — |

**Missing dependencies with no fallback:** None — all required tools are available.

**Note on `leven` transitive status:** `leven@3.1.0` is present because it is a transitive dependency of `ts-jest` (via `jest-validate`). It is reliable for development but should be added as a direct dependency in `agentshield/package.json` to prevent silent pruning in production installs.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest |
| Config file | `agentshield/jest.config.js` |
| Quick run command | `cd agentshield && npx jest --testPathPattern=static-analysis --no-coverage` |
| Full suite command | `cd agentshield && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-01 | Pattern match on role-takeover phrase in tool description | unit | `npx jest --testPathPattern=prompt-injection -t "CRITICAL"` | ❌ Wave 0 |
| STAT-01 | Pattern match on instruction override phrase | unit | `npx jest --testPathPattern=prompt-injection -t "HIGH"` | ❌ Wave 0 |
| STAT-01 | Pattern match on long description (> 500 chars) | unit | `npx jest --testPathPattern=prompt-injection -t "long description"` | ❌ Wave 0 |
| STAT-01 | Pattern match on base64 blob | unit | `npx jest --testPathPattern=prompt-injection -t "base64"` | ❌ Wave 0 |
| STAT-01 | Pattern match on zero-width chars | unit | `npx jest --testPathPattern=prompt-injection -t "unicode"` | ❌ Wave 0 |
| STAT-01 | Clean tool description emits no findings | unit | `npx jest --testPathPattern=prompt-injection -t "clean"` | ❌ Wave 0 |
| STAT-02 | Shadow tool: same name, same desc → CRITICAL | unit | `npx jest --testPathPattern=tool-poisoning -t "shadow CRITICAL"` | ❌ Wave 0 |
| STAT-02 | Shadow tool: same name, diff desc → HIGH | unit | `npx jest --testPathPattern=tool-poisoning -t "shadow HIGH"` | ❌ Wave 0 |
| STAT-02 | Name-squatting: leven ≤ 2, names ≥ 4 chars → MEDIUM | unit | `npx jest --testPathPattern=tool-poisoning -t "squatting"` | ❌ Wave 0 |
| STAT-02 | Short names (< 4 chars) not squatted | unit | `npx jest --testPathPattern=tool-poisoning -t "short names"` | ❌ Wave 0 |
| STAT-03 | High-entropy key value flagged as credential | unit | `npx jest --testPathPattern=config-auditor -t "entropy high"` | ❌ Wave 0 |
| STAT-03 | Placeholder value (admin/password) not flagged | unit | `npx jest --testPathPattern=config-auditor -t "entropy low"` | ❌ Wave 0 |
| STAT-03 | http:// external URL flagged | unit | `npx jest --testPathPattern=config-auditor -t "http transport"` | ❌ Wave 0 |
| STAT-03 | localhost http:// not flagged | unit | `npx jest --testPathPattern=config-auditor -t "localhost exempt"` | ❌ Wave 0 |
| STAT-03 | docker-compose.dev.yml scanned and GEMINI key found | integration | `npx jest --testPathPattern=config-auditor -t "docker-compose"` | ❌ Wave 0 |
| STAT-04 | First scan writes baseline, emits INFO | unit | `npx jest --testPathPattern=tool-hash -t "first scan"` | ❌ Wave 0 |
| STAT-04 | Re-scan with same hashes emits no findings | unit | `npx jest --testPathPattern=tool-hash -t "no change"` | ❌ Wave 0 |
| STAT-04 | Re-scan with changed description emits HIGH | unit | `npx jest --testPathPattern=tool-hash -t "hash changed"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd agentshield && npx jest --testPathPattern=static-analysis --no-coverage`
- **Per wave merge:** `cd agentshield && npx jest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `agentshield/tests/stages/prompt-injection.test.ts` — covers STAT-01 (all pattern tiers)
- [ ] `agentshield/tests/stages/tool-poisoning.test.ts` — covers STAT-02 (shadow + squatting)
- [ ] `agentshield/tests/stages/config-auditor.test.ts` — covers STAT-03 (entropy, http, files)
- [ ] `agentshield/tests/stages/tool-hash.test.ts` — covers STAT-04 (first scan, re-scan, change)
- [ ] `agentshield/src/data/prompt-injection-patterns.ts` — pattern data file (needed before tests compile)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (Phase 3 is read-only static analysis) |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | Validate `configPaths` via zod; validate `outputDir` is writable before writing baseline |
| V6 Cryptography | yes | SHA-256 via Node built-in crypto — never hand-roll |

### Known Threat Patterns for Static Analysis Stage

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `configPaths` override | Spoofing / Tampering | Validate that each path is under the project root; reject absolute paths outside working dir |
| Hash baseline file tampering (attacker modifies `tool-hashes.json`) | Tampering | Out of scope for v1; note in remediation text that baseline file is user-controlled |
| Glob expression injection via `configPaths` | Tampering | Validate that each element is a relative path or recognized pattern, not an arbitrary shell expression |

---

## Project Constraints (from CLAUDE.md)

The IKAS CLAUDE.md covers the parent project, not AgentShield specifically. Directives that apply to AgentShield:

- **TypeScript for all source:** Enforced (agentshield is already TypeScript).
- **Descriptive names, small focused functions:** Follow — sub-scanner functions should be 30-50 lines.
- **Error handling:** `try-catch`, check `error instanceof Error` before accessing `.message`.
- **Write unit tests for all business logic:** All four sub-scanners must have unit tests (Wave 0 task).
- **Security — never expose sensitive info in logs:** STAT-03 must NOT log credential values, only key names and entropy scores.
- **Keep dependencies up to date:** Note: `leven@3.1.0` and `glob@7.2.3` are transitive — track if they become direct deps.

AgentShield-specific conventions from CONTEXT.md/canonical refs:
- **No barrel files** — import from specific file paths, not `index.ts`.
- **Named exports only** — no default exports on scanner functions.
- **`randomUUID()` for finding IDs** — consistent with `discovery.ts` and `cve-lookup.ts`.
- **2-space indent, single quotes, semicolons** — standard across codebase.

---

## Sources

### Primary (HIGH confidence)
- `agentshield/node_modules/leven/index.d.ts` — confirmed TypeScript declaration, version 3.1.0
- `agentshield/node_modules/glob/package.json` — confirmed version 7.2.3, `glob.sync` API verified
- `agentshield/src/stages/discovery.ts` — confirmed StageRunner pattern and named export convention
- `agentshield/src/data/cve-lookup.ts` — confirmed table-driven `match()`/`build()` pattern
- `agentshield/src/types/config.ts` — confirmed Zod schema, missing `configPaths` field
- `agentshield/src/types/findings.ts` — confirmed `Finding` interface shape
- `agentshield/package.json` — confirmed dependencies: js-yaml, zod, no levenshtein/glob as direct deps
- `docker/docker-compose.dev.yml` — confirmed KEYCLOAK_ADMIN_PASSWORD=admin, GEMINI_API_KEY hardcoded
- [https://registry.npmjs.org/rebuff](https://www.npmjs.com/package/rebuff) — confirmed rebuff deps: pinecone, openai, langchain, chromadb
- [https://registry.npmjs.org/llm-guard](https://www.npmjs.com/package/llm-guard) — confirmed version 0.1.8, 11 months old, 252 kB
- [https://owasp.org/www-project-mcp-top-10/](https://owasp.org/www-project-mcp-top-10/) — confirmed all 10 MCP categories

### Secondary (MEDIUM confidence)
- [https://blog.scottlogic.com/2018/02/27/hunting-typosquatters-on-npm.html](https://blog.scottlogic.com/2018/02/27/hunting-typosquatters-on-npm.html) — Levenshtein threshold 2: 18/40 historical typosquats at distance ≤ 2; 46% false positive rate at threshold 3
- [https://soteri.io/blog/how-secret-detection-tools-spot-leaks](https://soteri.io/blog/how-secret-detection-tools-spot-leaks) — Entropy threshold 3.5: industry standard for two-factor credential detection
- [https://github.com/Giskard-AI/prompt-injections](https://github.com/Giskard-AI/prompt-injections) — Giskard prompt injection dataset: CSV format from garak + PromptInject libraries
- [https://github.com/protectai/rebuff](https://github.com/protectai/rebuff) — Rebuff regex pattern taxonomy (instruction bypass regex documented in search results)

### Tertiary (LOW confidence)
- OWASP MCP category assignments for name-squatting (MCP03 vs MCP09) — multiple sources give slightly different mappings; use MCP03:2025 for Tool Poisoning as the primary, MCP09 for shadow/unregistered servers per existing codebase usage in `classifyShadowServers`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified against npm registry and node_modules
- Architecture: HIGH — follows existing discovery.ts pattern exactly
- Prompt injection patterns: MEDIUM — regex strings are ASSUMED from published taxonomy; need dataset review before shipping
- Levenshtein threshold: HIGH — multiple independent sources confirm threshold 2 as industry standard
- Entropy threshold 3.5: MEDIUM — validated against known values in IKAS docker-compose; consistent with TruffleHog approach

**Research date:** 2026-05-10
**Valid until:** 2026-08-10 (90 days — stable domain; npm package versions stable)
