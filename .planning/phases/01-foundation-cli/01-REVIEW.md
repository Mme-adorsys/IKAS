---
phase: 01-foundation-cli
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - agentshield/src/cli.ts
  - agentshield/src/config/loader.ts
  - agentshield/src/runner/runner.ts
  - agentshield/src/runner/score.ts
  - agentshield/src/runner/table.ts
  - agentshield/src/stages/discovery.ts
  - agentshield/src/stages/dynamicTesting.ts
  - agentshield/src/stages/report.ts
  - agentshield/src/stages/runtimeMonitoring.ts
  - agentshield/src/stages/stage.interface.ts
  - agentshield/src/stages/staticAnalysis.ts
  - agentshield/src/types/config.ts
  - agentshield/src/types/findings.ts
  - agentshield/src/types/report.ts
  - agentshield/tests/cli.test.ts
  - agentshield/tests/config.test.ts
  - agentshield/tests/runner.test.ts
  - agentshield/tests/setup.ts
  - agentshield/tests/stages/stubs.test.ts
  - agentshield/tests/types/types.test.ts
  - agentshield/jest.config.js
  - agentshield/package.json
  - agentshield/tsconfig.json
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

This phase delivers the AgentShield CLI foundation: Commander-based CLI entry point, Zod-validated YAML config loader, a sequential stage runner with JSON report output, five stub stages, shared type definitions, and a comprehensive Jest test suite. The architecture is clean and well-structured. Error handling follows project conventions. The majority of findings are low-risk concerns that can be addressed incrementally; one critical issue requires attention before later phases add real MCP network calls.

The critical issue is that `auth.apiKey` and `auth.token` are stored in plain-text config files with no mechanism to substitute environment variables — the test fixture even commits a literal key string (`test-api-key-literal`) and the test explicitly asserts that `${}` substitution does NOT occur. When real credentials are added, this will expose secrets in YAML files checked into the repository.

---

## Critical Issues

### CR-01: Auth credentials stored in plain-text YAML with no env-var substitution

**File:** `agentshield/src/config/loader.ts:26-39` and `agentshield/src/types/config.ts:13-18`

**Issue:** `AuthConfigSchema` accepts `apiKey` and `token` as plain string values. `js-yaml`'s `load()` is called with no custom type or resolver, so `${ENV_VAR}` syntax in the YAML file is passed through literally — as the test at `tests/config.test.ts:54-58` explicitly confirms. When a security engineer configures a real API key or bearer token in `agentshield.config.yaml`, that secret will live in a checked-in file. Combined with the fixture file `tests/fixtures/valid-config.yaml` already containing a literal `apiKey` value, this establishes a pattern that will result in leaked credentials.

**Fix:** Support `env:VAR_NAME` as an alternative value format and resolve it at load time, or at minimum document clearly that `auth` values must not be committed. A simple approach:

```typescript
// In loadConfig(), after YAML parse but before Zod validation,
// walk the parsed object and replace env: references:
function resolveEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    const match = obj.match(/^env:([A-Z_][A-Z0-9_]*)$/);
    if (match) {
      const val = process.env[match[1]];
      if (!val) throw new Error(`Required env var ${match[1]} is not set`);
      return val;
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(resolveEnvVars);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, resolveEnvVars(v)])
    );
  }
  return obj;
}
// call resolveEnvVars(parsed) before AgentShieldConfigSchema.safeParse(parsed)
```

At minimum, update `tests/fixtures/valid-config.yaml` to use `env:TEST_API_KEY` and set the variable in CI so no literal credential exists in the repository.

---

## Warnings

### WR-01: `config.outputDir` is mutated on the `AgentShieldConfig` object after Zod validation

**File:** `agentshield/src/cli.ts:21-23`

**Issue:** `AgentShieldConfig` is typed as a `z.infer<>` value. After `loadConfig()` returns it, the CLI directly assigns `config.outputDir = options.outputDir`. Zod inferred types are plain objects, not frozen, so this works at runtime — but it bypasses any validation of the override value. An attacker (or a misconfigured shell alias) could pass `--output-dir /etc/cron.d/malicious` and the path would be accepted silently and created via `mkdirSync`. There is also no URL/path validation for the override.

**Fix:** Validate the override through the same schema or a dedicated path validator before assignment:

```typescript
if (options.outputDir) {
  const overrideResult = z.string().min(1).safeParse(options.outputDir);
  if (!overrideResult.success) {
    console.error('Invalid --output-dir value');
    process.exit(1);
  }
  config.outputDir = overrideResult.data;
}
```

For a security scanner that will run in CI pipelines, consider also rejecting absolute paths outside the project tree.

### WR-02: `strict: false` in `tsconfig.json` while individual strict flags are manually enumerated — `strictNullChecks` and `strictFunctionTypes` are silently disabled

**File:** `agentshield/tsconfig.json:8`

**Issue:** `"strict": false` disables the strict suite, including `strictNullChecks` and `strictFunctionTypes`. The config re-enables several individual strict flags (`noImplicitAny`, `noImplicitReturns`, `noImplicitThis`, `noImplicitOverride`) but does NOT re-enable `strictNullChecks`. This means assignments of `null | undefined` to non-nullable types will not produce type errors. The codebase is small now, but as real MCP network calls are added in later phases, missing null checks will silently pass the TypeScript compiler. The project's `CLAUDE.md` coding guidelines state "Use TypeScript for type safety."

**Fix:** Set `"strict": true` and remove the redundant individual flags (they are all included in `strict`):

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

If any existing code breaks under `strictNullChecks`, those sites are exactly where null-dereference bugs can hide.

### WR-03: `StageReport.error` typed as `string | null` but `ScanRunner` can only ever set it to `string` — type mismatch between interface and usage

**File:** `agentshield/src/types/report.ts:12` and `agentshield/src/runner/runner.ts:47`

**Issue:** `StageReport.error` is declared `string | null`. Stage stub implementations return `error: null` (correct). However, `ScanRunner.run()` at line 47 only sets `error: message` (always a `string`) in the catch branch, and never explicitly sets `error: null` in the success branch because it spreads the stage's own report (`{ ...report, duration: ... }`). The stages return `error: null` so this works today — but the asymmetry will cause a subtle bug when `error` is not null-initialized by future stages: the spread will carry over a non-null `error` from a previous run if the stage object is ever reused across calls.

**Fix:** Make the success path explicit:

```typescript
const report = await stage.run(target, this.config);
stageReports.push({
  ...report,
  duration: report.duration || Date.now() - start,
  error: report.error ?? null,  // normalize to null explicitly
});
```

### WR-04: `runner.test.ts` CLI smoke test writes output to `tests/fixtures/runner-output` which is inside the repo tree

**File:** `agentshield/tests/runner.test.ts:70-79`

**Issue:** The CLI smoke test at line 70 hard-codes `outDir = resolve(__dirname, 'fixtures', 'runner-output')` as the output directory. The test calls `rmSync(outDir, ...)` as cleanup, but if the test is interrupted (SIGKILL, test timeout, assertion failure before cleanup), the `runner-output/` directory and the `agentshield-report.json` inside it will be left inside the source tree. There is no `.gitignore` entry for this path visible in the reviewed files. A subsequent `git add .` could accidentally commit generated report output.

**Fix:** Use `mkdtempSync` from `os.tmpdir()` as all other test cases do, or add `agentshield/tests/fixtures/runner-output/` to `.gitignore`:

```typescript
// Replace hard-coded outDir with a temp directory:
const outDir = mkdtempSync(resolve(tmpdir(), 'agentshield-smoke-'));
```

---

## Info

### IN-01: `ora` is listed as a production dependency but is never imported

**File:** `agentshield/package.json:18`

**Issue:** `"ora": "5.4.1"` appears in `dependencies`, not `devDependencies`. No source file in `src/` imports `ora`. This increases the installed footprint when the package is used as a library and signals that spinner feedback was planned but not yet wired up.

**Fix:** Either remove `ora` from `dependencies` until it is used, or if spinner output is planned for a near-term phase, move it to `devDependencies` as a reminder and promote it when integrated.

### IN-02: Version number hardcoded in `cli.ts` independently from `package.json`

**File:** `agentshield/src/cli.ts:10`

**Issue:** `.version('0.1.0')` is a string literal. `package.json` also declares `"version": "0.1.0"`. These will drift when the version is bumped. In a Node.js project the canonical approach is to read the version from `package.json` at runtime.

**Fix:**
```typescript
// At the top of cli.ts, after imports:
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json') as { version: string };

program
  .name('agentshield')
  .description('MCP security scanner for agentic AI systems')
  .version(version);
```

Alternatively, configure `"resolveJsonModule": true` (already set in `tsconfig.json`) and use a static import:
```typescript
import { version } from '../package.json';
```

### IN-03: `tsconfig.json` excludes `tests/` but `jest.config.js` uses `ts-jest` to compile them — potential type-checking gap

**File:** `agentshield/tsconfig.json:32-38`

**Issue:** The `"exclude": ["tests"]` entry means `tsc --noEmit` (run via `npm run type-check`) does not type-check test files. Bugs in test helper types (e.g., the `as { status: number }` cast in `runner.test.ts:91`) will not be caught by CI type checking. The project's CLAUDE.md guidelines state "Use TypeScript for type safety."

**Fix:** Create a separate `tsconfig.test.json` that extends the base and includes `tests/`:
```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*", "tests/**/*"],
  "compilerOptions": {
    "outDir": "./dist-test",
    "noEmit": true
  }
}
```
Update `jest.config.js` to reference it: `globals: { 'ts-jest': { tsconfig: 'tsconfig.test.json' } }`.

### IN-04: `computeCompositeScore` parameter is named `_stages` but the stub comment implies it will consume `StageReport[]` — the underscore prefix can be dropped when implementing

**File:** `agentshield/src/runner/score.ts:4`

**Issue:** This is a Phase 1 stub with a comment noting real implementation comes in Phase 6. The underscore-prefixed parameter is correct for a stub (suppresses unused-parameter warnings). This is not a defect — flagged only as a reminder that when Phase 6 implements ASR × exploitability × blast radius scoring, the parameter name and function signature should be revisited to ensure `noUnusedParameters` is enabled by that point (currently `"noUnusedParameters": false` in `tsconfig.json`).

**Fix:** No action needed now. In Phase 6, rename `_stages` to `stages` and enable `"noUnusedParameters": true` in `tsconfig.json` to catch leftover stubs.

---

_Reviewed: 2026-04-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
