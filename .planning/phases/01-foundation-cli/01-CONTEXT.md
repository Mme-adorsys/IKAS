# Phase 1: Foundation & CLI - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold `agentshield/` as a peer service directory alongside `ai-gateway/` and `websocket-server/`. Deliver: a working `agentshield scan <target>` CLI command, a Zod-validated YAML config schema, shared TypeScript result types, and a runner that calls stubs for all 5 stages and outputs a human-readable table to stdout + a JSON report file.

This phase is pure scaffold + wiring. No real scanning logic. Downstream phases (2–6) fill in the stage implementations.

</domain>

<decisions>
## Implementation Decisions

### Output Format
- **D-01:** Default output is human-readable to stdout — color-coded severity table, findings listed per stage. This is what the conference audience sees.
- **D-02:** JSON report (`agentshield-report.json`) is **always** written to the output directory on every scan, regardless of display mode. Table view + JSON file every time.
- **D-03:** A `--json` flag can be added later to switch stdout to JSON, but table is the default.

### Config Interface
- **D-04:** Primary interface is a config file (`agentshield.config.yaml`) for persistent settings. CLI flags override per-run.
- **D-05:** Config file format: YAML. Filename: `agentshield.config.yaml` (consistent with Docker Compose / Kubernetes tooling already in the IKAS stack).
- **D-06:** Config file includes the **MCP server allow-list** — a list of known/expected MCP server URLs. Any server discovered outside this list is flagged as a shadow server (CRITICAL finding). This makes AgentShield self-contained for security teams.
- **D-07:** Config schema covers: `target` (primary MCP URL), `allowedServers[]` (allow-list), `auth` (optional API key/token), `outputDir` (where to write report files), `stages[]` (which stages to run, defaults to all).

### Exit Code Semantics
- **D-08:** Exit code 0 on any successful scan completion — regardless of findings detected. Non-zero only on scan failure (network error, invalid config, crash). This keeps demo terminal output clean and avoids alarming "command failed" messages during the conference presentation.
- **D-09:** Future phases can add a `--fail-on critical|high|medium|low` flag for CI/CD gate use cases (out of scope for Phase 1).

### Type Placement
- **D-10:** All AgentShield types (`Finding`, `SeverityLevel`, `CompositeScore`, `StageReport`, `ScanResult`) live inside `agentshield/src/types/` only. Self-contained module. No coupling to `shared-types/` in Phase 1. Move to shared-types/ in a future phase if other IKAS services need to consume scan results (e.g., a frontend dashboard).

### Module Structure
- **D-11:** Follow the exact same pattern as existing services: `agentshield/package.json`, `agentshield/tsconfig.json`, `agentshield/src/`, `agentshield/tests/`, `agentshield/jest.config.js`. Use `tsx` for running TypeScript directly (consistent with rest of IKAS stack).
- **D-12:** CLI library: Claude's discretion (commander.js preferred — lightweight, well-typed, consistent with Node.js CLI conventions).
- **D-13:** Use Zod for config schema validation (already a validated dependency in `ai-gateway/` — no new dependency introduced).

### Claude's Discretion
- CLI library selection (commander.js recommended, Claude can choose based on TypeScript support)
- Internal file organization within `agentshield/src/` (types/, config/, runner/, stages/)
- Stub return format (empty `StageReport` with empty `findings[]` array)
- NPM script naming (e.g., `scan`, `dev`, `build`, `test`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — AgentShield vision, constraints, core value statement
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-03 acceptance criteria

### Existing Codebase Patterns
- `.planning/codebase/CONVENTIONS.md` — Naming conventions, code style (2-space indent, single quotes, semicolons, camelCase functions, PascalCase interfaces)
- `.planning/codebase/STRUCTURE.md` — How peer service directories are organized (package.json + tsconfig.json + src/ + tests/ + jest.config.js)
- `.planning/codebase/STACK.md` — TypeScript version, tsx runner, Zod version, Jest setup

### Reference Implementations
- `ai-gateway/src/utils/config.ts` — Zod-based config loading pattern to follow
- `ai-gateway/tsconfig.json` — TypeScript config pattern for strict mode + CommonJS + Node 18+
- `ai-gateway/jest.config.js` — Jest config pattern for TypeScript services

No external security specs needed for Phase 1 (scaffold only — no scanning logic yet).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Zod** (`zod` v3.23.8) — Already installed in `ai-gateway/`. The `agentshield/` package will install its own copy but can follow `ai-gateway/src/utils/config.ts` as a pattern for Zod schema + loader pattern.
- **tsx** (`tsx` v4.19.0) — Installed across all services. Use same invocation pattern: `tsx src/cli.ts` for development, compiled output for production.
- **winston** — Available in `ai-gateway/` for reference logging patterns (AgentShield may want its own lightweight logger or use console.log in Phase 1).

### Established Patterns
- **TypeScript strict mode** — All services use `strict: true` in tsconfig. Must match.
- **Imports** — External deps first, then type imports, then internal. Single quotes. No barrel `index.ts` anti-patterns.
- **Error handling** — `try/catch` with typed errors, `error instanceof Error` checks (per CONVENTIONS.md). Never swallow errors silently.
- **No test mocks for integration paths** — From codebase concerns, integration tests should hit real services, not mocks.

### Integration Points
- `agentshield/` sits as a sibling to `ai-gateway/`, `websocket-server/`, `keycloak-mcp-server/`, `mcp-neo4j/`, `frontend/`
- Phase 2 onwards, the runner will call into real MCP endpoints (ports 8001, 8002) — the stub runner's interface must be designed to accept real implementations as drop-in replacements
- Output dir defaults to `./agentshield-output/` in the project root (writable by Docker or local dev)

</code_context>

<specifics>
## Specific Ideas

- **User mental model confirmed:** AgentShield is explained as "you point it at your MCP server URL, it runs 5 stages automatically, and tells you what's vulnerable." This framing should be reflected in `--help` output and any README.
- **Allow-list in config:** The `allowedServers` list in `agentshield.config.yaml` is the security baseline. Shadow server detection in Phase 2 compares discovered servers against this list.
- **Demo experience priority:** The default output (table + color) is optimized for a live conference demo, not for CI automation. CI integration is v2 scope.

</specifics>

<deferred>
## Deferred Ideas

- `--fail-on critical|high|medium|low` flag for CI/CD gate — Phase 7 or v2
- Exporting types to `shared-types/` for frontend dashboard — future milestone
- Web UI dashboard showing scan results — explicitly out of scope (v2)
- Auto-fix application — explicitly out of scope (v2)

</deferred>

---

*Phase: 01-foundation-cli*
*Context gathered: 2026-04-30*
