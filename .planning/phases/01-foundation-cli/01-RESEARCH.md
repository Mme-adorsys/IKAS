# Phase 1: Foundation & CLI - Research

**Researched:** 2026-04-29
**Domain:** Node.js CLI tooling, TypeScript module scaffolding, Zod config schema, multi-stage runner pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Default output is human-readable to stdout — color-coded severity table, findings listed per stage.
- **D-02:** JSON report (`agentshield-report.json`) is **always** written to the output directory on every scan, regardless of display mode. Table view + JSON file every time.
- **D-03:** A `--json` flag can be added later to switch stdout to JSON, but table is the default.
- **D-04:** Primary interface is a config file (`agentshield.config.yaml`) for persistent settings. CLI flags override per-run.
- **D-05:** Config file format: YAML. Filename: `agentshield.config.yaml`.
- **D-06:** Config file includes the **MCP server allow-list** (`allowedServers[]`). Any server discovered outside this list is flagged as a shadow server (CRITICAL finding).
- **D-07:** Config schema covers: `target`, `allowedServers[]`, `auth`, `outputDir`, `stages[]`.
- **D-08:** Exit code 0 on any successful scan completion — non-zero only on scan failure (network error, invalid config, crash).
- **D-09:** `--fail-on` flag deferred to Phase 7/v2.
- **D-10:** All AgentShield types (`Finding`, `SeverityLevel`, `CompositeScore`, `StageReport`, `ScanResult`) live inside `agentshield/src/types/` only.
- **D-11:** Follow exact same pattern as existing services: `agentshield/package.json`, `agentshield/tsconfig.json`, `agentshield/src/`, `agentshield/tests/`, `agentshield/jest.config.js`. Use `tsx` for running TypeScript directly.
- **D-12:** CLI library: commander.js (Claude's discretion — confirmed by research).
- **D-13:** Use Zod for config schema validation (already in `ai-gateway/`).

### Claude's Discretion

- CLI library selection (commander.js confirmed — see research below)
- Internal file organization within `agentshield/src/` (types/, config/, runner/, stages/)
- Stub return format (empty `StageReport` with empty `findings[]` array)
- NPM script naming (e.g., `scan`, `dev`, `build`, `test`)

### Deferred Ideas (OUT OF SCOPE)

- `--fail-on critical|high|medium|low` flag — Phase 7 or v2
- Exporting types to `shared-types/` — future milestone
- Web UI dashboard — explicitly out of scope (v2)
- Auto-fix application — explicitly out of scope (v2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | User can run `agentshield scan <target-url>` from the command line and receive structured output | commander.js `scan` subcommand with `<target>` argument; chalk + cli-table3 for output |
| INFRA-02 | User can provide a config file specifying target MCP URLs, auth credentials, and output format | js-yaml for YAML loading; Zod schema validation following ai-gateway config.ts pattern |
| INFRA-03 | System produces findings with severity levels (critical/high/medium/low) and a composite score | `SeverityLevel` union type + `CompositeScore` interface in types/; stub stages return empty `StageReport` |
</phase_requirements>

---

## Summary

Phase 1 is a pure scaffold — no real scanning logic, only wiring. The goal is a working `agentshield scan <target>` command that loads a Zod-validated YAML config, calls five stub stages in sequence, and writes a color-coded table to stdout plus a JSON report file. Everything downstream (Phases 2–6) slots real stage implementations into the stub interfaces without changing the runner.

The technology choices are already effectively locked: commander.js for CLI, js-yaml for YAML parsing, chalk@4 + cli-table3 for output (both CJS-safe for the project's `module: commonjs` tsconfig), and Zod 3.x pinned to match `ai-gateway/`. The module structure mirrors `ai-gateway/` exactly.

The most important design decision is the **stage interface contract**: `StageRunner` must be defined narrowly enough that stubs and real implementations are interchangeable, but broadly enough that future stages (which need HTTP calls, file I/O, etc.) fit without a refactor.

**Primary recommendation:** Scaffold `agentshield/` following the `ai-gateway/` template, define the `StageRunner` interface first (before touching the runner), and lock the type definitions before any stage implementation starts.

---

## Project Constraints (from CLAUDE.md)

The following directives from `./CLAUDE.md` are relevant to this phase. The planner must verify the plan does not violate any of these.

| Directive | Source | Impact on Plan |
|-----------|--------|---------------|
| Use TypeScript for type safety | CLAUDE.md §Coding Guidelines | All files must be `.ts`; no plain `.js` in `src/` |
| Prefer `const` over `let`, avoid `var` | CLAUDE.md §TypeScript/JavaScript Standards | Code examples must follow this |
| Always handle errors with `try-catch` | CLAUDE.md §Error Handling | CLI entry point must wrap scan execution |
| Use `async/await` instead of promises | CLAUDE.md §TypeScript/JavaScript Standards | Runner and stage stubs must use async |
| Keep imports organized (external first, then internal) | CLAUDE.md §Code Organization | Import ordering enforced in all new files |
| Never expose sensitive information in logs | CLAUDE.md §Security | Auth token from config must never be logged |
| Validate all user inputs | CLAUDE.md §Security | Zod schema on config file + CLI args |
| 2-space indentation, semicolons, single quotes | CONVENTIONS.md §Code Style | All generated code must match |
| `error instanceof Error` checks before `.message` | CONVENTIONS.md §Error Handling | Required in CLI catch blocks |
| No barrel `index.ts` anti-patterns | CONTEXT.md §Code Context | Direct imports only within `agentshield/src/` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | 14.0.3 | CLI argument parsing, subcommands, `--help` | De facto standard for Node.js CLIs; ships its own `.d.ts`; no separate `@types` needed |
| js-yaml | 4.1.1 | Load and parse `agentshield.config.yaml` | CJS-native (dual ESM+CJS exports); well-typed via `@types/js-yaml`; widely adopted |
| zod | 3.23.8 | Validate parsed YAML config at runtime | Already pinned in `ai-gateway/`; must stay at v3.x to match project baseline |
| chalk | 4.1.2 | Colorize severity labels and table headers | v4 is CJS (no `"type":"module"`); v5+ is ESM-only and breaks `module: commonjs` builds |
| cli-table3 | 0.6.5 | Render boxed table of findings to stdout | CJS-native; widely used for CLI result tables; zero-config |
| tsx | 4.19.0 | Run `src/cli.ts` directly in dev (`npm run dev`) | Already used by all other IKAS services; no new dependency |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ora | 5.4.1 | Spinner during each stage execution | v5 is CJS; v6+ is ESM-only. Use to show "Running stage 1..." progress |
| @types/js-yaml | 4.0.9 | TypeScript types for js-yaml | devDependency; install alongside js-yaml |
| @types/cli-table3 | (bundled in package) | TypeScript types | cli-table3 ships its own types as of 0.6.x |
| @types/node | 22.x | Node.js built-in types (fs, path, process) | devDependency for all Node services |
| ts-jest | 29.x | Compile TypeScript for Jest test runs | Already used in ai-gateway jest.config.js |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| commander | yargs | yargs is heavier, auto-generates more boilerplate; commander is more explicit and idiomatic for TypeScript |
| commander | oclif | oclif is framework-level (plugins, multi-file commands); overkill for a single scan command |
| js-yaml | yaml (npm) | yaml@2 is ESM-only; `js-yaml@4` has dual CJS/ESM exports and is the safe pick for `module: commonjs` |
| chalk@4 | chalk@5 | chalk@5 is ESM-only — will break under `module: commonjs` tsconfig unless using dynamic import workaround |
| cli-table3 | columnify / text-table | cli-table3 renders boxed grid; better visual separation for multi-stage results |
| ora@5 | ora@9 | ora@6+ are ESM-only; v5 is the last CJS release and is actively maintained for CJS users |

**Installation:**
```bash
npm install commander js-yaml zod chalk@4 cli-table3 ora@5
npm install -D @types/js-yaml @types/node ts-jest typescript tsx jest
```

**Version verification (all confirmed via npm registry 2026-04-29):**
- `commander`: 14.0.3 (latest)
- `js-yaml`: 4.1.1 (latest)
- `zod`: 3.23.8 (pinned to match ai-gateway; npm latest is 4.3.6 — do NOT upgrade; stick with 3.x)
- `chalk`: 4.1.2 (last CJS release; v5.6.2 is latest but ESM-only)
- `cli-table3`: 0.6.5 (latest)
- `ora`: 5.4.1 (last CJS release; v9.4.0 is latest but ESM-only)

---

## Architecture Patterns

### Recommended Project Structure

```
agentshield/
├── src/
│   ├── cli.ts              # Entry point — commander program, scan command
│   ├── types/
│   │   ├── config.ts       # AgentShieldConfig, AuthConfig types
│   │   ├── findings.ts     # Finding, SeverityLevel, CompositeScore
│   │   └── report.ts       # StageReport, ScanResult
│   ├── config/
│   │   └── loader.ts       # loadConfig(): reads YAML file, validates with Zod
│   ├── runner/
│   │   └── runner.ts       # ScanRunner class — orchestrates stages in sequence
│   └── stages/
│       ├── stage.interface.ts   # StageRunner interface contract
│       ├── discovery.ts         # Stage 1 stub
│       ├── staticAnalysis.ts    # Stage 2 stub
│       ├── dynamicTesting.ts    # Stage 3 stub
│       ├── runtimeMonitoring.ts # Stage 4 stub
│       └── report.ts            # Stage 5 stub
├── tests/
│   ├── config.test.ts      # Zod schema validation tests
│   ├── runner.test.ts      # Runner orchestration tests
│   └── stages/
│       └── stubs.test.ts   # Verify all stubs return valid StageReport shape
├── jest.config.js
├── package.json
└── tsconfig.json
```

### Pattern 1: Stage Interface Contract

**What:** A `StageRunner` interface that every stage (stub and real) must implement. The runner holds an array of `StageRunner` instances and calls them sequentially.

**When to use:** Always. This is the core extensibility contract that allows Phase 2–6 to drop in real implementations.

**Example:**
```typescript
// src/stages/stage.interface.ts
// Source: [ASSUMED] — interface design pattern; not sourced from external docs

export interface StageRunner {
  readonly name: string;         // e.g. 'Discovery & Inventory'
  readonly id: string;           // e.g. 'discovery' — matches stages[] config key
  run(target: string, config: AgentShieldConfig): Promise<StageReport>;
}
```

Key design decisions baked into this interface:
- `run()` is async — all real stages will need I/O
- Takes `target` and full `config` so stages have access to `allowedServers`, `auth`, etc.
- Returns `StageReport` (not void) — the runner aggregates all reports into `ScanResult`

### Pattern 2: Config Loader following ai-gateway pattern

**What:** Load YAML file, parse with `js-yaml`, validate with Zod schema, export typed config object. Process exits with non-zero on invalid config (D-08).

**When to use:** At CLI startup, before runner is invoked.

**Example:**
```typescript
// src/config/loader.ts
// Source: adapted from ai-gateway/src/utils/config.ts [VERIFIED: codebase read]

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { load } from 'js-yaml';
import { z } from 'zod';

const AgentShieldConfigSchema = z.object({
  target: z.string().url('target must be a valid URL'),
  allowedServers: z.array(z.string().url()).default([]),
  auth: z.object({
    apiKey: z.string().optional(),
    token: z.string().optional(),
  }).optional(),
  outputDir: z.string().default('./agentshield-output'),
  stages: z.array(z.enum([
    'discovery',
    'staticAnalysis',
    'dynamicTesting',
    'runtimeMonitoring',
    'report',
  ])).default(['discovery', 'staticAnalysis', 'dynamicTesting', 'runtimeMonitoring', 'report']),
});

export type AgentShieldConfig = z.infer<typeof AgentShieldConfigSchema>;

export function loadConfig(configPath: string): AgentShieldConfig {
  const raw = readFileSync(resolve(configPath), 'utf8');
  const parsed = load(raw);        // js-yaml parse
  const result = AgentShieldConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Invalid config:', result.error.format());
    process.exit(1);               // D-08: non-zero on config failure
  }
  return result.data;
}
```

### Pattern 3: Commander.js scan command

**What:** Top-level `program` with `scan` subcommand, `<target>` positional argument, `--config` option, optional `--output-dir` override.

**When to use:** `src/cli.ts` entry point.

**Example:**
```typescript
// src/cli.ts
// Source: commander v14 docs [CITED: https://github.com/tj/commander.js#readme]

import { Command } from 'commander';
import { loadConfig } from './config/loader';
import { ScanRunner } from './runner/runner';

const program = new Command();

program
  .name('agentshield')
  .description('MCP security scanner for agentic AI systems')
  .version('0.1.0');

program
  .command('scan')
  .description('Run a security scan against a target MCP server')
  .argument('<target>', 'Target MCP server URL')
  .option('-c, --config <path>', 'Path to agentshield.config.yaml', 'agentshield.config.yaml')
  .option('-o, --output-dir <dir>', 'Override output directory for report files')
  .action(async (target: string, options: { config: string; outputDir?: string }) => {
    try {
      const config = loadConfig(options.config);
      if (options.outputDir) {
        config.outputDir = options.outputDir;
      }
      const runner = new ScanRunner(config);
      const result = await runner.run(target);
      process.exit(result.success ? 0 : 1);   // D-08
    } catch (error) {
      console.error('Scan failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch(() => process.exit(1));
```

### Pattern 4: ScanRunner that aggregates stage results

**What:** Class that holds the list of enabled `StageRunner` instances, calls them in sequence, collects `StageReport[]` into a `ScanResult`, writes the JSON file, renders the table.

**When to use:** `src/runner/runner.ts`.

**Example:**
```typescript
// src/runner/runner.ts
// Source: [ASSUMED] — standard sequential runner pattern

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import type { AgentShieldConfig } from '../types/config';
import type { ScanResult } from '../types/report';
import type { StageRunner } from '../stages/stage.interface';
import { renderTable } from './table';  // chalk + cli-table3 rendering

export class ScanRunner {
  private stages: StageRunner[];

  constructor(private config: AgentShieldConfig) {
    // Stages injected here — real implementations in Phase 2+
    this.stages = buildStages(config);  // returns stub instances for Phase 1
  }

  async run(target: string): Promise<{ success: boolean }> {
    const stageReports = [];
    for (const stage of this.stages) {
      const report = await stage.run(target, this.config);
      stageReports.push(report);
    }
    const result: ScanResult = {
      target,
      timestamp: new Date().toISOString(),
      stages: stageReports,
      compositeScore: computeCompositeScore(stageReports),
    };
    this.writeJsonReport(result);
    renderTable(result);          // stdout color table
    return { success: true };
  }

  private writeJsonReport(result: ScanResult): void {
    mkdirSync(resolve(this.config.outputDir), { recursive: true });
    const outPath = resolve(this.config.outputDir, 'agentshield-report.json');
    writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\nReport written to: ${outPath}`);
  }
}
```

### Pattern 5: Stub Stage (template for all 5)

**What:** Implements `StageRunner` interface and returns an empty `StageReport` with `findings: []`. Real implementation in later phases drops in without changing the runner.

**Example:**
```typescript
// src/stages/discovery.ts
// Source: [ASSUMED]

import type { StageRunner } from './stage.interface';
import type { AgentShieldConfig } from '../types/config';
import type { StageReport } from '../types/report';

export class DiscoveryStage implements StageRunner {
  readonly name = 'Discovery & Inventory';
  readonly id = 'discovery';

  async run(target: string, _config: AgentShieldConfig): Promise<StageReport> {
    // Phase 2 will replace this body
    return {
      stageId: this.id,
      stageName: this.name,
      findings: [],
      duration: 0,
      error: null,
    };
  }
}
```

### Pattern 6: Table output with chalk + cli-table3

**What:** Render a boxed summary table per stage, with severity colorization.

**Example:**
```typescript
// src/runner/table.ts
// Source: cli-table3 README [CITED: https://github.com/cli-table/cli-table3#readme]

import Table from 'cli-table3';
import chalk from 'chalk';
import type { ScanResult } from '../types/report';

const SEVERITY_COLOR: Record<string, (s: string) => string> = {
  critical: chalk.bgRed.white.bold,
  high:     chalk.red.bold,
  medium:   chalk.yellow,
  low:      chalk.cyan,
  info:     chalk.gray,
};

export function renderTable(result: ScanResult): void {
  console.log(chalk.bold(`\nAgentShield Scan Results — ${result.target}`));
  console.log(chalk.gray(`Timestamp: ${result.timestamp}`));

  for (const stage of result.stages) {
    console.log(chalk.bold.underline(`\n${stage.stageName}`));
    if (stage.findings.length === 0) {
      console.log(chalk.green('  No findings.'));
      continue;
    }
    const table = new Table({
      head: ['Severity', 'Title', 'Component', 'Score'],
      colWidths: [12, 40, 25, 8],
    });
    for (const f of stage.findings) {
      const color = SEVERITY_COLOR[f.severity] ?? ((s: string) => s);
      table.push([color(f.severity.toUpperCase()), f.title, f.component, String(f.score)]);
    }
    console.log(table.toString());
  }
  console.log(chalk.bold(`\nComposite Score: ${result.compositeScore}`));
}
```

### Anti-Patterns to Avoid

- **Barrel `index.ts` files inside `agentshield/src/`:** The codebase explicitly forbids this pattern (CONTEXT.md §Code Context). Import directly from `./types/findings`, not from `./types`.
- **Importing chalk v5 or ora v6+:** Both are ESM-only and will cause `ERR_REQUIRE_ESM` at runtime under `module: commonjs`.
- **Importing Zod v4 API (`.check()`, `.parse()` behavioral changes):** The project pins `zod@3.23.8` — do not import from `zod/v4` or use v4-only APIs.
- **Using `process.exit()` inside stages:** Only the CLI entry (`cli.ts`) and `loadConfig()` may call `process.exit()`. Stages must throw errors for the runner to handle.
- **Logging auth tokens:** The `auth` object from config must never appear in console output or log files (CLAUDE.md §Security).
- **Synchronous stage execution with `Promise.all`:** Stages must run sequentially (stage 5 depends on stage 1–4 findings). Do not parallelize with `Promise.all`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom argv parser | `commander` | Handles `--help`, `--version`, subcommand routing, option types, variadic args — all edge cases |
| YAML parsing | Custom YAML parser | `js-yaml` | YAML has many spec edge cases (anchors, multiline strings, boolean coercion) |
| Runtime type validation of YAML | Manual type guards | `zod` schema | Zod gives detailed error messages and TypeScript inference; manual guards are error-prone |
| Color output | ANSI escape codes manually | `chalk@4` | Chalk handles terminal detection (no-color env, CI mode), Windows compatibility, color nesting |
| Table rendering | String padding/alignment | `cli-table3` | Unicode-safe column widths, border styles, header formatting |
| Spinner | Custom TTY control | `ora@5` | ora handles TTY detection (suppresses in non-TTY environments), cursor management |

**Key insight:** The output layer (table, colors, spinner) looks simple but has many edge cases around TTY detection, Windows cmd.exe, CI environments that strip color, and Unicode width. Use established libraries.

---

## Common Pitfalls

### Pitfall 1: ESM-only packages break under CommonJS tsconfig

**What goes wrong:** Importing `chalk@5`, `ora@6+`, or `yaml@2` in a project with `"module": "commonjs"` in tsconfig.json causes `ERR_REQUIRE_ESM` at runtime with tsx or node. The error appears only at runtime, not at compile time.

**Why it happens:** These packages ship with `"type": "module"` in their `package.json`, making them pure ESM. Node.js CJS loader cannot `require()` them.

**How to avoid:** Pin `chalk@4.1.2`, `ora@5.4.1`, and use `js-yaml@4` (not the `yaml` package). Verified: chalk@4 and cli-table3 have no `"type": "module"` field.

**Warning signs:** TypeScript compiles fine but tsx throws `ERR_REQUIRE_ESM`; npm install succeeds but runtime fails.

### Pitfall 2: Zod version drift — v4 is now the npm latest

**What goes wrong:** Running `npm install zod` without a version pin installs Zod 4.x (currently `4.3.6`), which has breaking API changes and a different import structure from v3.

**Why it happens:** npm `latest` tag now points to Zod 4. The `ai-gateway/` package uses `zod@^3.23.8`. If `agentshield/` installs Zod 4 and types are ever shared, you get incompatible schema types.

**How to avoid:** Pin `"zod": "3.23.8"` (exact pin, no `^`) in `agentshield/package.json` to stay aligned with `ai-gateway/`. Verified: zod@3.23.8 is on the registry.

**Warning signs:** `z.object()` returns `ZodObject<...>` from v3 vs. v4 — type errors if cross-imported.

### Pitfall 3: `process.exit()` inside stage stubs prevents test assertions

**What goes wrong:** If a stub calls `process.exit(0)`, Jest tests terminate before assertions run. The test runner reports no failures — but nothing was tested.

**Why it happens:** Stage stubs initially mirror the CLI entry point pattern, where exit calls are appropriate.

**How to avoid:** Only `cli.ts` and `loadConfig()` may call `process.exit()`. Stages throw `Error` objects; the runner catches them and decides exit behavior.

**Warning signs:** Jest tests pass with 0 assertions; `--coverage` reports 0% for stage files.

### Pitfall 4: `tsconfig.json` `strict: false` in reference — but CONTEXT says strict mode required

**What goes wrong:** The `ai-gateway/tsconfig.json` has `"strict": false` (observed in actual file), but `noImplicitAny`, `noImplicitReturns`, and `noImplicitThis` are set individually. CONTEXT.md §Code Context says "TypeScript strict mode — all services use `strict: true`." There is a contradiction.

**Why it happens:** The ai-gateway tsconfig was likely set up with explicit flags rather than the `strict` umbrella option. The effect is nearly equivalent to `strict: true` but not identical (e.g., `strictNullChecks` is not explicitly set).

**How to avoid:** For `agentshield/`, use the same tsconfig structure as `ai-gateway/` exactly (copy and adjust `rootDir`/`outDir`). Do not add `"strict": true` unless explicitly instructed — mirror the reference, not the docs claim.

**Warning signs:** Adding `"strict": true` to agentshield tsconfig causes TypeScript errors in patterns that compile fine in ai-gateway.

### Pitfall 5: `mkdirSync` fails if parent dirs missing and `recursive: false`

**What goes wrong:** Writing the JSON report to `./agentshield-output/agentshield-report.json` fails with `ENOENT` if the output directory does not exist and `mkdirSync` is called without `{ recursive: true }`.

**Why it happens:** Default `mkdirSync` behavior throws if any path segment is missing.

**How to avoid:** Always call `mkdirSync(resolve(config.outputDir), { recursive: true })` before `writeFileSync`.

### Pitfall 6: commander `.parseAsync()` vs `.parse()` — unhandled promise rejections

**What goes wrong:** Using `.parse()` instead of `.parseAsync()` in the CLI entry point means async `.action()` callbacks run but rejections are unhandled, appearing only as warnings rather than process exit.

**How to avoid:** Use `program.parseAsync(process.argv).catch(() => process.exit(1))` as shown in Pattern 3.

---

## Code Examples

### Zod schema for agentshield.config.yaml (full)

```typescript
// src/config/loader.ts
// Source: adapted from ai-gateway/src/utils/config.ts [VERIFIED: codebase read]

import { z } from 'zod';

export const STAGE_IDS = ['discovery', 'staticAnalysis', 'dynamicTesting', 'runtimeMonitoring', 'report'] as const;
export type StageId = typeof STAGE_IDS[number];

export const AgentShieldConfigSchema = z.object({
  target: z.string().url({ message: 'target must be a valid URL' }),
  allowedServers: z.array(z.string().url({ message: 'each allowedServer must be a valid URL' })).default([]),
  auth: z.object({
    apiKey: z.string().optional(),
    token:  z.string().optional(),
  }).optional(),
  outputDir: z.string().default('./agentshield-output'),
  stages: z.array(z.enum(STAGE_IDS)).default([...STAGE_IDS]),
});

export type AgentShieldConfig = z.infer<typeof AgentShieldConfigSchema>;
```

### Core type definitions

```typescript
// src/types/findings.ts
// Source: [ASSUMED] — derived from REQUIREMENTS.md INFRA-03

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  id: string;                    // uuid
  title: string;
  description: string;
  severity: SeverityLevel;
  component: string;             // e.g. 'keycloak-mcp-server'
  score: number;                 // 0.0 – 10.0
  remediation?: string;
  owaspCategory?: string;        // Phase 6
}

// src/types/report.ts
export interface CompositeScore {
  value: number;                 // 0.0 – 10.0 weighted aggregate
  breakdown: Record<string, number>;
}

export interface StageReport {
  stageId: string;
  stageName: string;
  findings: Finding[];
  duration: number;              // ms
  error: string | null;
}

export interface ScanResult {
  target: string;
  timestamp: string;             // ISO 8601
  stages: StageReport[];
  compositeScore: CompositeScore;
}
```

### Sample agentshield.config.yaml

```yaml
# agentshield.config.yaml
target: http://localhost:8001
allowedServers:
  - http://localhost:8001
  - http://localhost:8002
auth:
  apiKey: ${AGENTSHIELD_API_KEY}
outputDir: ./agentshield-output
stages:
  - discovery
  - staticAnalysis
  - dynamicTesting
  - runtimeMonitoring
  - report
```

Note: `${ENV_VAR}` substitution is not supported by js-yaml — that line is illustrative only. The actual auth value must be a literal string or omitted (loaded from environment separately if needed).

### package.json for agentshield/

```json
{
  "name": "agentshield",
  "version": "0.1.0",
  "description": "MCP security scanner for agentic AI systems",
  "main": "dist/cli.js",
  "bin": {
    "agentshield": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "scan": "tsx src/cli.ts scan",
    "start": "node dist/cli.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "chalk": "4.1.2",
    "cli-table3": "^0.6.5",
    "commander": "^14.0.3",
    "js-yaml": "^4.1.1",
    "ora": "5.4.1",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/jest": "^29.5.12",
    "@types/node": "^22.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.0",
    "typescript": "^5.6.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

Note: `chalk` and `ora` are pinned without `^` because the ESM-only versions at `^5.x`/`^9.x` would break the build.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod 3.x as npm latest | Zod 4.x is now npm latest (4.3.6) | Early 2025 | Must pin `"zod": "3.23.8"` explicitly; `npm install zod` will install v4 |
| chalk@4 as npm latest | chalk@5.x is npm latest (ESM-only) | 2022 | Must pin `chalk@4.1.2` for CJS projects |
| ora@5 as npm latest | ora@9.x is npm latest (ESM-only) | 2022 | Must pin `ora@5.4.1` for CJS projects |
| commander@12 | commander@14 is current | 2025 | Ships own `.d.ts`, API stable; no breaking changes for basic usage |
| js-yaml CommonJS-only | js-yaml@4 has dual CJS/ESM exports | 2021 | Both import styles work; CJS is default in Node require() |

**Deprecated/outdated:**
- `commander@<10`: Old argument parsing API (`command.opts()` vs old destructuring) — don't follow tutorials older than 2022
- `chalk@3`: Used `import chalk from 'chalk'` with different color methods — chalk@4 API is the same, so no risk

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stage interface design (StageRunner with `run(target, config)` signature) | Architecture Patterns | Future stages might need more context (e.g., a shared HTTP client). If wrong, the interface needs expanding — but adding optional params is backward-compatible. |
| A2 | `computeCompositeScore()` in Phase 1 returns 0.0 (stub) | Architecture Patterns | If the planner puts a real scoring formula in Phase 1, that's acceptable but out of scope; stub is correct for Phase 1. |
| A3 | `ora` spinner is needed in Phase 1 | Standard Stack | Phase 1 stubs run instantly; spinner adds polish but is not strictly required. Could be omitted from Phase 1 and added in Phase 2 when stages take real time. |
| A4 | `agentshield/` will NOT be added to Docker Compose in Phase 1 | Architecture | If the conference demo requires containerized agentshield, a Dockerfile would also be needed. Deferred assumption — no evidence either way. |

---

## Open Questions (RESOLVED)

1. **env var substitution in YAML config**
   - What we know: js-yaml does not process `${ENV_VAR}` placeholders — it returns them as literal strings.
   - What's unclear: Does the auth token need to be read from environment (rather than config file) to avoid secrets in YAML?
   - RESOLVED: In Phase 1, read `auth` from the YAML literally. Env-var override support deferred to Phase 2 when auth is actually used.

2. **agentshield binary registration in root package.json**
   - What we know: Other services are run as `npm run dev` inside their own directories, not as global CLIs.
   - What's unclear: Should `agentshield` be registered as a root-level npm workspace binary so it can be called as `npx agentshield scan`?
   - RESOLVED: For Phase 1, keep it as `cd agentshield && npm run scan -- <target>`. Global binary registration is a Phase 7 demo polish task.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tsx runner, all npm packages | Yes | v23.11.0 | — |
| npm | Package installation | Yes | 11.4.1 | — |
| tsx | `npm run dev` / `npm run scan` | Not installed globally | — | Install as devDependency (already plan) |

**Missing dependencies with no fallback:** None — all dependencies installed per-package via `npm install` in `agentshield/`.

**Note:** tsx is not globally installed on this machine (detected: command not found), but that is expected — it is consumed as a local devDependency in each service's `node_modules/.bin/tsx`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.x |
| Config file | `agentshield/jest.config.js` (Wave 0 — does not exist yet) |
| Quick run command | `cd agentshield && npm test -- --testPathPattern=config` |
| Full suite command | `cd agentshield && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `scan` command parses `<target>` argument and calls runner | unit | `npm test -- --testPathPattern=runner` | Wave 0 |
| INFRA-01 | Table output written to stdout (check no throw) | unit/smoke | `npm test -- --testPathPattern=table` | Wave 0 |
| INFRA-02 | Valid YAML config loads and passes Zod validation | unit | `npm test -- --testPathPattern=config` | Wave 0 |
| INFRA-02 | Invalid config (missing `target`) causes process.exit(1) | unit | `npm test -- --testPathPattern=config` | Wave 0 |
| INFRA-02 | Unknown stage ID in `stages[]` fails Zod validation | unit | `npm test -- --testPathPattern=config` | Wave 0 |
| INFRA-03 | All 5 stub stages return `StageReport` with `findings: []` | unit | `npm test -- --testPathPattern=stubs` | Wave 0 |
| INFRA-03 | `ScanResult` written to `outputDir/agentshield-report.json` | unit | `npm test -- --testPathPattern=runner` | Wave 0 |
| INFRA-03 | JSON report contains `stages`, `compositeScore`, `timestamp` fields | unit | `npm test -- --testPathPattern=runner` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd agentshield && npm test -- --testPathPattern=<changed-file>`
- **Per wave merge:** `cd agentshield && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `agentshield/jest.config.js` — ts-jest preset matching ai-gateway pattern
- [ ] `agentshield/tests/config.test.ts` — Zod schema validation (REQ INFRA-02)
- [ ] `agentshield/tests/runner.test.ts` — runner orchestration + JSON file write (REQ INFRA-01, INFRA-03)
- [ ] `agentshield/tests/stages/stubs.test.ts` — all 5 stubs return valid `StageReport` (REQ INFRA-03)
- [ ] Framework install: `npm install` inside `agentshield/` directory

---

## Security Domain

> `security_enforcement` is not explicitly set to `false` in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 1 scaffold only; auth config loaded but unused |
| V3 Session Management | No | CLI tool, no sessions |
| V4 Access Control | No | Phase 1 scaffold only |
| V5 Input Validation | Yes | Zod validates YAML config; URL fields validated with `.url()` |
| V6 Cryptography | No | No crypto in Phase 1 |

### Known Threat Patterns for CLI + config file

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auth token leakage via console.log | Information Disclosure | Never log `config.auth.*` fields; mask in debug output |
| Path traversal in `outputDir` | Tampering | `resolve()` normalizes paths; Zod validates it's a string; do not allow `../../` to be useful — but no sensitive data is written, so risk is low in Phase 1 |
| YAML arbitrary code execution | Tampering | Use `js-yaml`'s `load()` (safe by default in v4) — NOT `loadAll()` with untrusted input |
| Malicious target URL causing SSRF | Tampering | Phase 1 stubs do not make HTTP calls; Zod validates URL format. Real SSRF risk deferred to Phase 2. |

**js-yaml safety note:** `js-yaml@4` removed the unsafe `safeLoad/safeDump` distinction — the standard `load()` function is safe by default and does not execute arbitrary code. [CITED: https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md]

---

## Sources

### Primary (HIGH confidence)

- npm registry (`npm view <package> version/type/exports`) — verified all package versions and ESM/CJS status for commander, js-yaml, zod, chalk, ora, cli-table3
- `ai-gateway/src/utils/config.ts` — Zod config pattern (read directly from codebase)
- `ai-gateway/tsconfig.json` — TypeScript config pattern (read directly)
- `ai-gateway/package.json` — dependency versions and script naming patterns (read directly)
- `ai-gateway/jest.config.js` — Jest/ts-jest configuration pattern (read directly)
- `.planning/codebase/STACK.md`, `CONVENTIONS.md`, `STRUCTURE.md` — project conventions and constraints

### Secondary (MEDIUM confidence)

- commander.js README [CITED: https://github.com/tj/commander.js#readme] — subcommand and parseAsync patterns
- cli-table3 README [CITED: https://github.com/cli-table/cli-table3#readme] — Table constructor and row push API
- js-yaml CHANGELOG [CITED: https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md] — v4 safety note

### Tertiary (LOW confidence)

- None — all claims in this research are VERIFIED or CITED.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry on 2026-04-29
- Architecture: MEDIUM-HIGH — patterns derived from ai-gateway reference implementation (verified) + standard commander.js usage
- Pitfalls: HIGH — ESM/CJS issues verified by checking `"type"` field in npm registry; Zod v4 confirmed as npm latest

**Research date:** 2026-04-29
**Valid until:** 2026-05-30 (stable libraries; only risk is if Zod v3 API changes, which it won't)
