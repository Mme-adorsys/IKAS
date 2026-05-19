# Phase 3: Static Analysis - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 9 (4 sub-scanner modules + 1 data file + 1 type modification + 1 orchestrator + 2 test files per scanner = 9 logical units)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `agentshield/src/stages/static-analysis/prompt-injection.ts` | scanner (named exports) | transform | `agentshield/src/stages/discovery.ts` (`classifyShadowServers`) | exact |
| `agentshield/src/stages/static-analysis/tool-poisoning.ts` | scanner (named exports) | transform | `agentshield/src/stages/discovery.ts` (`classifyShadowServers`) | exact |
| `agentshield/src/stages/static-analysis/config-auditor.ts` | scanner (named exports) | file-I/O + transform | `agentshield/src/stages/discovery.ts` (`enumerateServers`) | role-match |
| `agentshield/src/stages/static-analysis/tool-hash.ts` | scanner (named exports) | file-I/O + CRUD | `agentshield/src/stages/discovery.ts` (`probeMcpServer`) | role-match |
| `agentshield/src/data/prompt-injection-patterns.ts` | data / pattern table | — | `agentshield/src/data/cve-lookup.ts` | exact |
| `agentshield/src/stages/staticAnalysis.ts` (modify) | orchestrating class | transform | `agentshield/src/stages/discovery.ts` (`DiscoveryStage`) | exact |
| `agentshield/src/types/config.ts` (modify) | type / zod schema | — | existing `AgentShieldConfigSchema` | self-analog |
| `agentshield/tests/stages/prompt-injection.test.ts` | test | — | `agentshield/tests/stages/discovery.test.ts` | exact |
| `agentshield/tests/stages/tool-poisoning.test.ts` | test | — | `agentshield/tests/stages/discovery.test.ts` | exact |
| `agentshield/tests/stages/config-auditor.test.ts` | test | — | `agentshield/tests/data/cve-lookup.test.ts` | exact |
| `agentshield/tests/stages/tool-hash.test.ts` | test | — | `agentshield/tests/stages/discovery.test.ts` | exact |

---

## Pattern Assignments

### `agentshield/src/data/prompt-injection-patterns.ts` (data, pattern table)

**Analog:** `agentshield/src/data/cve-lookup.ts`

**Build this file first** — all scanner modules import from it.

**Imports pattern** (cve-lookup.ts lines 1-3):
```typescript
import { randomUUID } from 'crypto';
import { DiscoveredServer } from '../types/discovery';
import { Finding, SeverityLevel } from '../types/findings';
```
For prompt-injection-patterns.ts, replace `DiscoveredServer` import with `ToolDefinition`:
```typescript
import { ToolDefinition } from '../types/discovery';
import { SeverityLevel } from '../types/findings';
```

**Table entry interface pattern** (cve-lookup.ts lines 5-19):
```typescript
interface CveTableEntry {
  id: string;            // stable identifier for the row
  match: (server: DiscoveredServer) => boolean;
  build: (server: DiscoveredServer) => CveTemplate;
}
```
For prompt-injection-patterns.ts, define a parallel `InjectionPattern` interface:
```typescript
interface InjectionPattern {
  id: string;           // e.g. 'PI-ROLE-TAKEOVER-01'
  name: string;         // human-readable pattern name
  severity: SeverityLevel;
  score: number;
  owaspCategory: string;  // 'MCP06:2025' for most prompt injection
  match: (tool: ToolDefinition) => boolean;
}
```

**Table-driven export pattern** (cve-lookup.ts lines 23-107):
```typescript
export const CVE_LOOKUP_TABLE: CveTableEntry[] = [
  {
    id: 'CVE-2025-49596',
    match: (s) => { ... },
    build: (_s) => ({ ... }),
  },
  // additional entries...
];
```
Replicate as:
```typescript
export const PROMPT_INJECTION_PATTERNS: InjectionPattern[] = [
  {
    id: 'PI-ROLE-TAKEOVER-01',
    name: 'Role Takeover Payload',
    severity: 'critical',
    score: 9.0,
    owaspCategory: 'MCP06:2025',
    match: (t) => /\b(you are now|act as|pretend (you are|to be)|your (new|true) (role|instructions|persona))\b/i
      .test(`${t.name ?? ''} ${t.description ?? ''}`),
  },
  // HIGH tier, MEDIUM tier entries...
];
```

---

### `agentshield/src/stages/static-analysis/prompt-injection.ts` (scanner, transform)

**Analog:** `agentshield/src/stages/discovery.ts` — specifically `classifyShadowServers` (lines 46-72)

**Imports pattern** (discovery.ts lines 1-7):
```typescript
import { randomUUID } from 'crypto';
import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';
import { DiscoveredServer, ToolDefinition } from '../types/discovery';
import { Finding, SeverityLevel } from '../types/findings';
import { applyCveLookup } from '../data/cve-lookup';
```
For prompt-injection.ts (path depth differs — this file lives one level deeper):
```typescript
import { randomUUID } from 'crypto';
import { DiscoveredServer } from '../../types/discovery';
import { Finding } from '../../types/findings';
import { PROMPT_INJECTION_PATTERNS } from '../../data/prompt-injection-patterns';
```

**Core scan pattern** (modeled on discovery.ts `classifyShadowServers` lines 46-72):
```typescript
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
This mirrors the `for (const server of discovered) { findings.push({ id: randomUUID(), ... }) }` pattern from `classifyShadowServers` (discovery.ts lines 52-70) identically — same loop shape, same Finding construction, same `randomUUID()` for ids.

**Named export only** — no default export. No class wrapper. (Convention from codebase: classifyShadowServers, applyCveLookup are both named exports.)

---

### `agentshield/src/stages/static-analysis/tool-poisoning.ts` (scanner, transform)

**Analog:** `agentshield/src/stages/discovery.ts` — `classifyShadowServers` (lines 46-72) and `enumerateServers` (lines 182-203)

**Imports pattern**:
```typescript
import { randomUUID } from 'crypto';
import { DiscoveredServer } from '../../types/discovery';
import { Finding } from '../../types/findings';
import leven = require('leven');
```
Note: `leven` uses CommonJS `export =` style. The `import leven = require('leven')` form is confirmed correct by `leven@3.1.0 index.d.ts`.

**Core shadow detection pattern** (map grouping, modeled on discovery.ts lines 182-203 `Promise.allSettled` + dedup with `seen` Set):
```typescript
// Shadow tool detection: group by lowercase tool name
const nameToEntries = new Map<string, Array<{ server: DiscoveredServer; tool: typeof allTools[0]['tool'] }>>();
for (const entry of allTools) {
  const key = entry.tool.name.toLowerCase();
  if (!nameToEntries.has(key)) nameToEntries.set(key, []);
  nameToEntries.get(key)!.push(entry);
}
for (const [, entries] of nameToEntries) {
  if (entries.length < 2) continue;
  const descSet = new Set(entries.map(e => e.tool.description ?? ''));
  const severity = descSet.size === 1 ? 'critical' : 'high';    // D-07
  const owaspCategory = descSet.size === 1 ? 'MCP09:2025' : 'MCP02:2025';  // D-07
  // push finding...
}
```

**Levenshtein name-squatting pattern**:
```typescript
// Name-squatting: cross-product over different-server tools
for (let i = 0; i < allTools.length; i++) {
  for (let j = i + 1; j < allTools.length; j++) {
    const a = allTools[i], b = allTools[j];
    if (a.server.baseUrl === b.server.baseUrl) continue;
    if (a.tool.name === b.tool.name) continue;  // handled by shadow check
    const na = a.tool.name, nb = b.tool.name;
    if (na.length < 4 || nb.length < 4) continue;  // D-06: skip short names
    if (leven(na, nb) <= 2) {
      findings.push({
        id: randomUUID(),
        title: `Tool name-squatting: "${na}" resembles "${nb}"`,
        description: `Tool "${na}" on ${a.server.baseUrl} has Levenshtein distance ≤ 2 from "${nb}" on ${b.server.baseUrl}. This is consistent with name-squatting. (D-08)`,
        severity: 'medium',
        component: `${a.server.baseUrl}#${na}`,
        score: 6.0,
        owaspCategory: 'MCP03:2025',
      });
    }
  }
}
```

**Error handling pattern** (discovery.ts lines 93-101, `tryMcpJsonRpcAtPath`):
```typescript
try {
  // ... work
} catch {
  return null;  // or return []
}
```
For sync functions that return `Finding[]`, catch errors and return `[]` — never let sub-scanner throw into the orchestrator.

---

### `agentshield/src/stages/static-analysis/config-auditor.ts` (scanner, file-I/O + transform)

**Analog:** `agentshield/src/stages/discovery.ts` — `enumerateServers` (lines 182-203) for the glob+filter pattern; `cve-lookup.ts` for the two-factor check pattern.

**Imports pattern**:
```typescript
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { sync as globSync } from 'glob';
import { load as yamlLoad } from 'js-yaml';
import { AgentShieldConfig } from '../../types/config';
import { Finding } from '../../types/findings';
```

**File discovery pattern** (RESEARCH.md code example, Pitfall 4 guard):
```typescript
const GLOB_PATTERN = '**/{*.env,.env.*,docker-compose*.yml,*.yaml,*.json}';
const GLOB_IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**'];

export function auditConfigFiles(config: AgentShieldConfig): Finding[] {
  const projectRoot = process.cwd();
  const scanPaths = config.configPaths ?? [GLOB_PATTERN];
  const files = globSync(
    scanPaths.length === 1 ? scanPaths[0] : `{${scanPaths.join(',')}}`,
    { cwd: projectRoot, absolute: true, ignore: GLOB_IGNORE, dot: true, nodir: true },
  );
  // ... process files
}
```

**Shannon entropy inline function** (RESEARCH.md Pattern 4):
```typescript
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

**Two-factor credential check pattern** (modeled on cve-lookup.ts `match` predicates, lines 26-31):
```typescript
const CREDENTIAL_KEY_PATTERN = /PASSWORD|SECRET|API_KEY|TOKEN|PRIVATE_KEY|CREDENTIAL/i;
const ENV_VAR_REF = /^\$\{.+\}$/;        // Pitfall 7 guard
const PLACEHOLDER_REF = /^<[^>]+>$/;     // Pitfall 7 guard

function checkCredential(key: string, val: string, filePath: string, findings: Finding[]): void {
  if (!CREDENTIAL_KEY_PATTERN.test(key)) return;
  if (ENV_VAR_REF.test(val) || PLACEHOLDER_REF.test(val)) return;
  if (shannonEntropy(val) <= 3.5) return;
  findings.push({
    id: randomUUID(),
    title: `Hardcoded credential: ${key}`,
    description: `Key "${key}" in ${filePath} has a high-entropy value (entropy > 3.5 bits/char), indicating a real credential stored in plain text.`,
    severity: 'high',
    component: filePath,
    score: 8.5,
    owaspCategory: 'MCP07:2025',
    remediation: 'Move secrets to a secrets manager or environment variables injected at runtime. Do not commit credential values.',
  });
}
```

**Insecure transport check pattern** (modeled on cve-lookup.ts ROW match predicates):
```typescript
const HTTP_URL_PATTERN = /\bhttp:\/\/(?!localhost|127\.0\.0\.1)/i;

function checkInsecureTransport(key: string, val: string, filePath: string, findings: Finding[]): void {
  if (typeof val !== 'string') return;
  if (HTTP_URL_PATTERN.test(val)) {
    findings.push({
      id: randomUUID(),
      title: `Insecure transport: ${key} uses http://`,
      description: `Key "${key}" in ${filePath} contains an http:// URL for an external service. Unencrypted transport exposes credentials and data in transit.`,
      severity: 'medium',
      component: filePath,
      score: 5.5,
      owaspCategory: 'MCP07:2025',
      remediation: 'Use https:// for all external service URLs.',
    });
  }
}
```

**YAML Docker Compose environment dual-format handling** (RESEARCH.md code example, Pitfall 6):
```typescript
// Both list format and map format must be handled
if (Array.isArray(env)) {
  for (const item of env) {
    const eqIdx = item.indexOf('=');
    if (eqIdx === -1) continue;
    checkCredential(item.slice(0, eqIdx), item.slice(eqIdx + 1), filePath, findings);
  }
} else if (env && typeof env === 'object') {
  for (const [k, v] of Object.entries(env)) {
    checkCredential(k, String(v ?? ''), filePath, findings);
  }
}
```

**Error handling pattern** — wrap per-file reads in try/catch so one unreadable file does not abort the scan:
```typescript
try {
  const raw = readFileSync(filePath, 'utf8');
  // parse and check
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  // optionally push a low-severity INFO finding about the unreadable file
}
```
This mirrors discovery.ts `tryKeycloakRest` lines 103-127: each probe returns `null` on error rather than throwing.

---

### `agentshield/src/stages/static-analysis/tool-hash.ts` (scanner, file-I/O + CRUD)

**Analog:** `agentshield/src/stages/discovery.ts` — `probeMcpServer` (lines 169-180) for the async pattern; `runner.ts` `writeJsonReport` (lines 64-70) for the `mkdirSync` + `writeFileSync` pattern.

**Imports pattern**:
```typescript
import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DiscoveredServer } from '../../types/discovery';
import { AgentShieldConfig } from '../../types/config';
import { Finding, SeverityLevel } from '../../types/findings';
```
Note: `randomUUID` from `crypto` — same import as discovery.ts line 1.

**mkdirSync guard pattern** (runner.ts lines 64-66 — Pitfall 5 fix):
```typescript
mkdirSync(config.outputDir, { recursive: true });
```

**SHA-256 hash function** (RESEARCH.md Pattern 5):
```typescript
function hashTool(tool: ToolDefinition): string {
  const canonical = JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
```

**First-scan / re-scan branching pattern** (RESEARCH.md Pattern 5):
```typescript
export async function recordToolHashes(
  servers: DiscoveredServer[],
  config: AgentShieldConfig,
): Promise<Finding[]> {
  mkdirSync(config.outputDir, { recursive: true });
  const baselinePath = join(config.outputDir, 'tool-hashes.json');
  // ... build currentHashes ...
  const isFirstScan = !existsSync(baselinePath);
  if (isFirstScan) {
    writeFileSync(baselinePath, JSON.stringify(currentHashes, null, 2), 'utf8');
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
  // ... compare and emit HIGH findings for changed hashes ...
  writeFileSync(baselinePath, JSON.stringify(currentHashes, null, 2), 'utf8');
  return findings;
}
```

**Error handling pattern** — wrap file I/O in try/catch:
```typescript
try {
  // existsSync / readFileSync / writeFileSync
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  return [{
    id: randomUUID(),
    title: 'Tool hash recording failed',
    description: message,
    severity: 'low',
    component: config.outputDir,
    score: 0,
  }];
}
```

---

### `agentshield/src/stages/staticAnalysis.ts` (modify — orchestrating class)

**Analog:** `agentshield/src/stages/discovery.ts` — `DiscoveryStage` class (lines 211-242)

**Current file** (staticAnalysis.ts lines 1-18) is a stub with empty `run()`. Replace with full orchestration following `DiscoveryStage.run` shape exactly.

**Class structure pattern** (discovery.ts lines 211-242):
```typescript
export class DiscoveryStage implements StageRunner {
  readonly id = 'discovery';
  readonly name = 'Discovery & Inventory';

  async run(target: string, config: AgentShieldConfig): Promise<StageReport> {
    const start = Date.now();
    try {
      const discovered = await enumerateServers(target);
      const inventoried = await Promise.all(discovered.map(inventoryServer));
      const shadowFindings = classifyShadowServers(inventoried, config.allowedServers);
      const cveFindings = applyCveLookup(inventoried);
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [...shadowFindings, ...cveFindings],
        duration: Date.now() - start,
        error: null,
        metadata: { discoveredServers: inventoried },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [],
        duration: Date.now() - start,
        error: message,
        metadata: { discoveredServers: [] },
      };
    }
  }
}
```

For `StaticAnalysisStage`, the key difference is how `DiscoveredServer[]` is obtained. The runner (runner.ts lines 36-42) calls `stage.run(target, config)` sequentially — there is no `previousReports` parameter. The discovery stage stores results in `StageReport.metadata.discoveredServers`. The planner must resolve how Phase 3 accesses this (see Open Question 1 in RESEARCH.md). The simplest approach that requires no runner interface change: **extend `StaticAnalysisStage.run()` to re-accept the `target` URL and extract servers from a passed-in `previousReports?: StageReport[]`**, OR call a lightweight version of discovery internally.

**StaticAnalysisStage orchestrator shape** (follow discovery.ts lines 211-242):
```typescript
export class StaticAnalysisStage implements StageRunner {
  readonly id = 'staticAnalysis';
  readonly name = 'Static Analysis';

  async run(target: string, config: AgentShieldConfig, previousReports?: StageReport[]): Promise<StageReport> {
    const start = Date.now();
    try {
      const servers = extractDiscoveredServers(previousReports);
      const piFindings = scanPromptInjection(servers);
      const tpFindings = detectToolPoisoning(servers);
      const caFindings = auditConfigFiles(config);
      const thFindings = await recordToolHashes(servers, config);
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [...piFindings, ...tpFindings, ...caFindings, ...thFindings],
        duration: Date.now() - start,
        error: null,
        metadata: { toolsScanned: servers.flatMap(s => s.tools).length },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [],
        duration: Date.now() - start,
        error: message,
        metadata: {},
      };
    }
  }
}
```

**Imports for staticAnalysis.ts** (follow discovery.ts lines 1-7):
```typescript
import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';
import { DiscoveredServer } from '../types/discovery';
import { scanPromptInjection } from './static-analysis/prompt-injection';
import { detectToolPoisoning } from './static-analysis/tool-poisoning';
import { auditConfigFiles } from './static-analysis/config-auditor';
import { recordToolHashes } from './static-analysis/tool-hash';
```
No barrel files — import each sub-scanner by its specific path.

---

### `agentshield/src/types/config.ts` (modify — add `configPaths` field)

**Analog:** existing `AgentShieldConfigSchema` (config.ts lines 20-28) — self-analog.

**Add field** to `AgentShieldConfigSchema` (lines 20-28), following the `.default([])` pattern used by `allowedServers`:
```typescript
export const AgentShieldConfigSchema = z.object({
  target: z.string().url({ message: 'target must be a valid URL' }),
  allowedServers: z
    .array(z.string().url({ message: 'each allowedServer must be a valid URL' }))
    .default([]),
  auth: AuthConfigSchema.optional(),
  outputDir: z.string().default('./agentshield-output'),
  stages: z.array(z.enum(STAGE_IDS)).default([...STAGE_IDS]),
  configPaths: z.array(z.string()).optional(),   // NEW — D-10: STAT-03 override
});
```
`AgentShieldConfig` type is inferred via `z.infer<typeof AgentShieldConfigSchema>` — no separate type edit needed; the inference propagates automatically.

---

### Test Files

**Analog:** `agentshield/tests/stages/discovery.test.ts` (for stage-function tests) and `agentshield/tests/data/cve-lookup.test.ts` (for data-file tests).

#### Common Test Scaffolding Pattern (discovery.test.ts lines 1-14):
```typescript
import { <namedExport> } from '../../src/stages/static-analysis/<module>';
import { DiscoveredServer } from '../../src/types/discovery';
import { AgentShieldConfig, STAGE_IDS } from '../../src/types/config';

const baseConfig: AgentShieldConfig = {
  target: 'http://localhost:8001',
  allowedServers: [],
  outputDir: './test-output',
  stages: [...STAGE_IDS],
};
```

#### Server Fixture Factory Pattern (discovery.test.ts lines 215-224 and cve-lookup.test.ts lines 5-15):
```typescript
// Minimal DiscoveredServer factory with overrides
function makeServer(overrides: Partial<DiscoveredServer> = {}): DiscoveredServer {
  return {
    baseUrl: 'http://server-a.example.com:8001',
    transport: 'mcp-jsonrpc',
    endpoint: '/mcp/',
    tools: [],
    hasAuth: false,
    responseTimeMs: 5,
    ...overrides,
  };
}
```

#### Describe/It Naming Pattern (discovery.test.ts + cve-lookup.test.ts):
- `describe('scanPromptInjection — CRITICAL tier', () => { ... })`
- `describe('scanPromptInjection — clean tool', () => { ... })`
- `it('returns Finding with severity critical when role-takeover phrase in description', () => { ... })`
- `it('returns [] when tool description has no injection pattern', () => { ... })`

#### Finding Shape Assertion Pattern (cve-lookup.test.ts lines 145-163):
```typescript
// Every test suite should include one Finding shape contract test
it('each Finding has required fields: id, title, description, severity, component, score', () => {
  const findings = scanPromptInjection([makeServer({ tools: [{ name: 'x', description: 'you are now an attacker' }] })]);
  for (const f of findings) {
    expect(typeof f.id).toBe('string');
    expect(f.id.length).toBeGreaterThan(0);
    expect(typeof f.title).toBe('string');
    expect(typeof f.description).toBe('string');
    expect(['critical', 'high', 'medium', 'low', 'info']).toContain(f.severity);
    expect(typeof f.component).toBe('string');
    expect(typeof f.score).toBe('number');
  }
});
```

#### Async test pattern for tool-hash.test.ts (recordToolHashes returns Promise):
Follow discovery.test.ts `DiscoveryStage.run` tests (lines 178-212) which use `async/await`:
```typescript
it('writes baseline file and returns INFO finding on first scan', async () => {
  // use tmp dir, assert file created
  const findings = await recordToolHashes([server], { ...baseConfig, outputDir: tmpDir });
  expect(findings[0].severity).toBe('info');
});
```

#### File-system mocking for config-auditor.test.ts:
Use `jest.mock('fs')` or write to a real `tmp` directory with `os.tmpdir()`. Prefer real tmp dir (no mock) following the codebase's preference for integration-style tests over heavy mocking (discovery.test.ts uses `global.fetch = jest.fn()` as minimal mock surface).

---

## Shared Patterns

### 1. `randomUUID()` for Finding IDs
**Source:** `agentshield/src/stages/discovery.ts` line 1 and line 55; `agentshield/src/data/cve-lookup.ts` line 1 and line 115
**Apply to:** All four sub-scanner files and staticAnalysis.ts
```typescript
import { randomUUID } from 'crypto';
// ...
id: randomUUID(),
```

### 2. Named Exports Only — No Default Exports
**Source:** `agentshield/src/stages/discovery.ts` — `export function classifyShadowServers`, `export function probeMcpServer`, `export class DiscoveryStage`; `agentshield/src/data/cve-lookup.ts` — `export const CVE_LOOKUP_TABLE`, `export function applyCveLookup`
**Apply to:** All sub-scanner files, data file
```typescript
// CORRECT:
export function scanPromptInjection(...): Finding[] { ... }
export const PROMPT_INJECTION_PATTERNS: InjectionPattern[] = [ ... ];

// WRONG (never):
export default function scanPromptInjection(...) { ... }
```

### 3. Error Handling: `error instanceof Error ? error.message : 'Unknown error'`
**Source:** `agentshield/src/stages/discovery.ts` lines 237-238
```typescript
const message = error instanceof Error ? error.message : 'Unknown error';
```
**Apply to:** `StaticAnalysisStage.run()` catch block; `recordToolHashes` file I/O catch block

### 4. Finding Construction Shape
**Source:** `agentshield/src/data/cve-lookup.ts` lines 113-125; `agentshield/src/stages/discovery.ts` lines 55-70
```typescript
findings.push({
  id: randomUUID(),
  title: '...',
  description: '...',
  severity: '<SeverityLevel>',
  component: server.baseUrl,       // or `${server.baseUrl}#${tool.name}` for tool-level
  score: 0.0,
  owaspCategory: 'MCP__:2025',
  remediation: '...',              // optional but encouraged
  // cveId: '...'                  // only when a specific CVE applies
});
```
**Apply to:** All four sub-scanner files

### 5. No Barrel Files — Import from Specific Paths
**Source:** `.planning/codebase/CONVENTIONS.md` and CONTEXT.md canonical refs
**Apply to:** All imports in new files
```typescript
// CORRECT:
import { Finding } from '../../types/findings';
import { PROMPT_INJECTION_PATTERNS } from '../../data/prompt-injection-patterns';

// WRONG (never):
import { Finding } from '../../types';   // barrel file
```

### 6. StageReport Return Shape
**Source:** `agentshield/src/stages/discovery.ts` lines 222-240; `agentshield/src/types/report.ts` lines 8-15
```typescript
return {
  stageId: this.id,
  stageName: this.name,
  findings: [...all sub-scanner findings],
  duration: Date.now() - start,
  error: null,
  metadata: { /* stage-specific data */ },
};
```
**Apply to:** `StaticAnalysisStage.run()` success and error paths

### 7. `mkdirSync` Before Any File Write
**Source:** `agentshield/src/runner/runner.ts` lines 64-66
```typescript
mkdirSync(outDir, { recursive: true });
```
**Apply to:** `recordToolHashes` in tool-hash.ts (Pitfall 5)

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Key Integration Notes for Planner

### Runner interface gap (Open Question 1 from RESEARCH.md)
`StageRunner.run(target, config)` in `stage.interface.ts` has no `previousReports` parameter. The runner calls stages sequentially without passing prior results. Resolution options (in order of invasiveness):
1. **Minimal**: Extend `StaticAnalysisStage.run()` signature to accept optional `previousReports?: StageReport[]`. Update `ScanRunner.run()` in runner.ts to pass the accumulating `stageReports` array when calling each stage. This is the least-invasive fix.
2. **Alternative**: `StaticAnalysisStage` re-runs a lightweight discovery probe internally if no `previousReports` are supplied. Higher cost but preserves the `StageRunner` interface contract exactly.

### Import depth for sub-scanner files
Files in `agentshield/src/stages/static-analysis/` are one directory deeper than `agentshield/src/stages/`. All relative imports must step up two levels:
- Types: `../../types/findings`, `../../types/discovery`, `../../types/config`
- Data: `../../data/prompt-injection-patterns`
- Runner types: `../../types/report`

### Test file locations
Following existing convention (`agentshield/tests/stages/discovery.test.ts`, `agentshield/tests/data/cve-lookup.test.ts`):
- `agentshield/tests/stages/prompt-injection.test.ts`
- `agentshield/tests/stages/tool-poisoning.test.ts`
- `agentshield/tests/stages/config-auditor.test.ts`
- `agentshield/tests/stages/tool-hash.test.ts`

NOT inside `agentshield/src/stages/static-analysis/__tests__/` — the project's test directory is `agentshield/tests/`, not co-located.

---

## Metadata

**Analog search scope:** `agentshield/src/`, `agentshield/tests/`
**Files read:** 12 (discovery.ts, staticAnalysis.ts, cve-lookup.ts, findings.ts, config.ts, discovery types, report.ts, stage.interface.ts, runner.ts, discovery.test.ts, cve-lookup.test.ts, stubs listing)
**Pattern extraction date:** 2026-05-10
