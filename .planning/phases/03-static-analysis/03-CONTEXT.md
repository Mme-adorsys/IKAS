# Phase 3: Static Analysis - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Text-analysis pass over discovered MCP tool definitions and target project configuration files — no network calls, no tool execution, pure read-and-classify. Delivers four sub-scanners integrated into `StaticAnalysisStage` that implement `StageRunner`:

1. **Prompt injection scanner** (STAT-01) — pattern library applied to tool names and descriptions
2. **Tool poisoning detector** (STAT-02) — name-squatting (Levenshtein), shadow detection, cross-server hijacking
3. **Config auditor** (STAT-03) — credential + insecure transport detection in env/YAML files
4. **Tool hash recorder** (STAT-04) — SHA-256 baseline + rug-pull detection on re-scan

AgentShield is a **general-purpose MCP security scanner**, not an IKAS-specific tool. All logic must work correctly against any MCP server, not just Keycloak/Neo4j on ports 8001–8002.

Input to this stage: `StageReport.metadata.discoveredServers` (DiscoveredServer[]) from Phase 2's DiscoveryStage. The DiscoveryStage is called first in the scan pipeline; StaticAnalysisStage reads the resulting tool list.

</domain>

<decisions>
## Implementation Decisions

### Prompt Injection Scanner (STAT-01)

- **D-01:** Use an existing open-source prompt injection library/dataset — do NOT hand-roll a regex list from scratch. The researcher must evaluate all viable options (JS/TS npm packages, Python libraries with JSON-importable pattern datasets, public adversarial prompt datasets) and pick the best fit.
- **D-02:** Tiered severity model: CRITICAL for role-takeover payloads ("you are now", "act as", "your new instructions"), HIGH for instruction-override payloads ("ignore previous instructions", "disregard your training"), MEDIUM for suspicious structural markers (unusually long description, base64 blob, Unicode obfuscation / zero-width chars).
- **D-03:** Finding output shape: matched pattern name + **full tool description text** + the OWASP/MCP Top 10 category the pattern maps to. Engineers see the complete evidence, not just a snippet.
- **D-04:** Researcher decides on the library/runtime (npm-only vs Python subprocess vs JSON dataset import). Document tradeoffs in RESEARCH.md before planning.

### Tool Poisoning Detector (STAT-02)

- **D-05:** A **new npm dependency is allowed** for Levenshtein / string-similarity calculation (e.g. `fast-levenshtein`, `natural`, or similar well-maintained TS-typed package). Researcher evaluates options.
- **D-06:** Levenshtein threshold must be **general-purpose** — calibrated to work across any MCP tool set, not tuned to IKAS's 11 known tool names. Researcher determines the threshold and documents reasoning in RESEARCH.md.
- **D-07:** Shadow tool definition:
  - **Exact duplicate name across servers** (two servers expose a tool with the same name) → CRITICAL finding (agent may invoke wrong server's tool). Maps to OWASP MCP09:2025.
  - **Same name + diverging description** across servers → HIGH finding (rug-pull / description manipulation risk). Maps to OWASP MCP02:2025.
- **D-08:** Name-squatting findings (Levenshtein-based) should include both the suspicious tool name AND the legitimate tool it resembles as evidence in the finding description.

### Config Auditor (STAT-03)

- **D-09:** **Default scan path = project root** — auto-discovers `*.env`, `.env.*`, `docker-compose*.yml`, `*.yaml`, `*.json` config files. No explicit configuration needed for the common case.
- **D-10:** **Configurable override** — `agentshield.config.yaml` may include a `configPaths: []` field with explicit glob patterns or directory paths. When set, these override the default root scan.
- **D-11:** Credential detection uses **two-factor matching**: (1) key name contains `PASSWORD`, `SECRET`, `API_KEY`, `TOKEN`, `PRIVATE_KEY`, `CREDENTIAL` (case-insensitive), AND (2) Shannon entropy of the value > 3.5 bits/char (filters out placeholder values like `admin`, `password`, `${VAR}`, `<REPLACE_ME>`).
- **D-12:** Insecure transport detection: flag any config value that uses `http://` (not `https://`) for external service URLs, except localhost/127.0.0.1 (internal dev addresses are expected HTTP).

### Tool Hash Recorder (STAT-04)

- **D-13:** Hash baseline file location: `{outputDir}/tool-hashes.json` — same directory as the scan report. Predictable, user-inspectable, user-deletable to force a fresh baseline.
- **D-14:** Hash each tool definition as SHA-256 of `JSON.stringify({ name, description, inputSchema })` — includes all fields that could carry malicious content.
- **D-15:** **First-scan behavior**: write baseline file, emit one INFO finding per server: "Baseline established for {N} tools — re-run to detect definition changes." No rug-pull findings on first run.
- **D-16:** **Subsequent scans**: compare current hashes against baseline. Any tool definition that changed emits a HIGH finding tagged with `owaspCategory: 'MCP02:2025'` (Tool Definition Manipulation). Update baseline file after flagging.

### Claude's Discretion

- Internal file organization within `agentshield/src/stages/static-analysis/` (sub-scanner module layout)
- Whether to implement sub-scanners as separate exported functions or separate files (follow codebase pattern from discovery.ts)
- Exact Shannon entropy implementation (inline ~10-line function is fine)
- OWASP category mapping for each prompt injection pattern severity tier
- Whether to deduplicate findings that trigger multiple patterns on the same tool

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — AgentShield vision, core value, known IKAS vulnerabilities (CONCERNS.md-derived)
- `.planning/REQUIREMENTS.md` — STAT-01, STAT-02, STAT-03, STAT-04 acceptance criteria

### Phase 2 Output (consumed by Phase 3)
- `.planning/phases/02-discovery-inventory/02-01-SUMMARY.md` — DiscoveredServer shape, tools[], transport field
- `agentshield/src/types/discovery.ts` — DiscoveredServer, ToolDefinition interfaces (Phase 3 reads these)
- `agentshield/src/types/findings.ts` — Finding interface with cveId? field (Phase 3 adds findings to same type)
- `agentshield/src/stages/discovery.ts` — Pattern for how a StageRunner is structured

### Codebase Patterns
- `.planning/codebase/CONVENTIONS.md` — 2-space indent, single quotes, semicolons, camelCase, no barrel files
- `.planning/codebase/STACK.md` — TypeScript strict mode, tsx, Jest setup
- `.planning/codebase/CONCERNS.md` — IKAS-specific vulnerabilities for STAT-03 validation (hardcoded creds, missing auth)

### IKAS Config Files (STAT-03 scan targets during development/testing)
- `docker/docker-compose.dev.yml` — Contains KEYCLOAK_ADMIN_PASSWORD, NEO4J_PASSWORD, ANTHROPIC_API_KEY
- `ai-gateway/` `.env` pattern — Contains GEMINI_API_KEY

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agentshield/src/stages/discovery.ts` — Pattern to follow: named exported functions + `class StaticAnalysisStage implements StageRunner`. Sub-scanner functions exported separately for unit testing.
- `agentshield/src/data/cve-lookup.ts` — Table-driven pattern: `match(server)` predicate + `build(server)` output. Same pattern suits the prompt injection pattern library and config credential rules.
- `agentshield/src/types/findings.ts` — `Finding` interface already has `cveId?`, `owaspCategory?`, `remediation?` — no new fields needed for Phase 3 output.
- `agentshield/src/types/report.ts` — `StageReport.metadata` is `Record<string, unknown>` — can carry `hashBaseline`, `toolsScanned` etc. from this stage.
- `crypto` (Node.js built-in) — Already used in discovery.ts (`randomUUID`). `crypto.createHash('sha256')` available for STAT-04 without new dependency.

### Established Patterns
- **Named exports**: all scanner functions exported by name for unit testability (no default exports)
- **TDD**: red/green/refactor cycle per plan — write failing tests first
- **No barrel files**: import from specific file paths, not `index.ts`
- **AbortController + timeout**: not needed here (no network), but the Promise.allSettled pattern from discovery.ts may be useful if sub-scanners are parallelized
- **`randomUUID()` for finding IDs**: already used in discovery.ts and cve-lookup.ts — continue this pattern

### Integration Points
- `agentshield/src/runner/` — The scan runner calls `StaticAnalysisStage.run(target, config)` and aggregates results. Phase 3 must not change the runner interface.
- `agentshield/src/types/config.ts` — `AgentShieldConfig` may need a `configPaths?: string[]` field added for the D-10 override (STAT-03).
- `StageReport.metadata` — STAT-04 should store `{ hashBaseline: Record<string, string>, baslineIsNew: boolean }` so Phase 6 (report renderer) can surface this info.

</code_context>

<specifics>
## Specific Ideas

- **General-purpose scanner emphasis**: User explicitly clarified that AgentShield is not IKAS-specific. All thresholds, file scan paths, and pattern matching must generalize to any MCP server/project.
- **Library-first for prompt injection**: User wants best-in-class open-source library research, not a custom regex list. The researcher should find what the security community uses (e.g. rebuff, llm-guard, adversarial-robustness-toolbox pattern lists) and evaluate fitness.
- **Entropy scoring for credentials**: Catches the known IKAS weakness (KEYCLOAK_ADMIN_PASSWORD=admin has entropy ~2.0 bits/char — low enough to flag as weak default; ANTHROPIC_API_KEY=sk-ant-... has entropy ~5.8 — flags as real credential in plain text).

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-static-analysis*
*Context gathered: 2026-05-10*
