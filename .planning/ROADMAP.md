# Roadmap: AgentShield

## Overview

AgentShield is built in 7 phases that map directly to the conference PoC structure: a CLI foundation, the 5 AgentShield stages (Discovery, Static Analysis, Dynamic Testing, Runtime Monitoring, Remediation Report), and a final conference demo integration pass. Each phase delivers one complete, runnable capability — by the end of Phase 6, the full pipeline produces real findings against IKAS; Phase 7 polishes the demo surface.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & CLI** - Scaffold the `agentshield/` module, CLI entrypoint, config schema, and shared result types
- [x] **Phase 2: Discovery & Inventory** - Enumerate MCP servers, tool definitions, shadow servers, and CVE cross-reference
- [x] **Phase 3: Static Analysis** - Scan tool descriptions for prompt injection, detect poisoning patterns, audit configs, record hashes
- [ ] **Phase 4: Dynamic Adversarial Testing** - Execute sandboxed attack simulations, inject RADE payloads, test privilege escalation, report ASR
- [ ] **Phase 5: Runtime Behavioral Monitoring** - Intercept live MCP traffic via proxy, detect anomalous chains and PII exfiltration
- [ ] **Phase 6: Remediation Report** - Synthesize all findings into scored JSON + Markdown report with OWASP mapping and fix guidance
- [ ] **Phase 7: Conference Demo** - Wire end-to-end IKAS scan, format CLI output for live demo, produce sample remediation report

## Phase Details

### Phase 1: Foundation & CLI
**Goal**: A developer can run `agentshield scan <target-url>` and receive structured output with severity-annotated findings
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. Running `agentshield scan http://localhost:8001` from the terminal exits with structured JSON output containing a `findings` array
  2. A config file specifying target URL, auth credentials, and output format (JSON/Markdown) is accepted and validated on startup
  3. Every finding in the output carries a severity level (critical/high/medium/low) and a composite score field
  4. Running `agentshield scan --help` prints usage instructions with available flags
**Plans**: 4 plans

Plans:
- [x] 01-01: Scaffold `agentshield/` directory structure, `package.json`, `tsconfig.json`, and `tsx`-based CLI entrypoint with `scan` command
- [x] 01-02: Implement config schema (Zod) covering target MCP URL, auth credentials, output format, and validation error reporting
- [x] 01-03: Define shared result types: `Finding`, `SeverityLevel`, `CompositeScore`, `ScanResult`, and `StageReport` interfaces in `agentshield/src/types/`
- [x] 01-04: Wire CLI runner that loads config, stubs all 5 stage runners, aggregates results, and outputs JSON or Markdown to stdout

### Phase 2: Discovery & Inventory
**Goal**: AgentShield enumerates the full MCP attack surface of a target system, including shadow servers and known CVE matches
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04
**Success Criteria** (what must be TRUE):
  1. Running a scan against IKAS lists both MCP servers (Keycloak port 8001, Neo4j port 8002) in the discovery report
  2. Each discovered server's tool definitions, resource endpoints, and transport config appear in the output
  3. Any unregistered or shadow MCP server detected on the network is flagged as a finding with HIGH or CRITICAL severity
  4. At least one finding is tagged with a CVE ID (CVE-2025-6514 or CVE-2025-49596) or an OWASP MCP Top 10 category when a match is found
**Plans**: 3 plans

Plans:
- [x] 02-01: Implement MCP server enumeration: HTTP probe of target URL, multi-port sweep for additional MCP servers, parse tool list and transport config from REST responses
- [x] 02-02: Implement shadow server detection: compare discovered servers against the configured allow-list; flag unregistered and over-permissioned integrations as findings
- [x] 02-03: Implement CVE and OWASP MCP Top 10 cross-reference: static lookup table mapping tool/endpoint patterns to CVE IDs and OWASP categories; annotate matched findings

### Phase 3: Static Analysis
**Goal**: AgentShield detects prompt injection payloads, tool poisoning patterns, credential exposure, and records tool hashes — all without executing any tools
**Depends on**: Phase 2
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04
**Success Criteria** (what must be TRUE):
  1. A tool description containing a hidden instruction (e.g., "Ignore previous instructions") is flagged as a prompt injection finding
  2. A tool whose name or description shadows another tool is flagged as a tool-poisoning finding with evidence
  3. A configuration file containing a hardcoded credential or insecure transport setting generates a HIGH or CRITICAL finding
  4. Tool definition hashes are written to a scan artifact file; re-running a scan against a modified tool description produces a rug-pull change-detection finding
**Plans**: 6 plans

Plans:
- [x] 03-01-PLAN.md — Phase 3 foundations: extend StageRunner.run with previousReports, promote `leven` to direct dep, add `configPaths` to AgentShieldConfig, create PROMPT_INJECTION_PATTERNS data file (Wave 1, unblocks all sub-scanners)
- [x] 03-02-PLAN.md — STAT-01 scanPromptInjection: regex-and-keyword pattern library scanner over tool name+description with full-description evidence (Wave 2)
- [x] 03-03-PLAN.md — STAT-02 detectToolPoisoning: cross-server shadow detection (D-07) and Levenshtein name-squatting (D-06/D-08, threshold ≤ 2, names ≥ 4 chars) (Wave 2)
- [x] 03-04-PLAN.md — STAT-03 auditConfigFiles: two-factor credential scan (key-name keyword + Shannon entropy > 3.5) and http:// insecure-transport detection across env/yaml/json files (Wave 2)
- [x] 03-05-PLAN.md — STAT-04 recordToolHashes: SHA-256 baseline at `{outputDir}/tool-hashes.json`, first-scan INFO + rug-pull HIGH findings on re-scan (Wave 2)
- [x] 03-06-PLAN.md — StaticAnalysisStage orchestrator: merge all four sub-scanners, extract DiscoveredServer[] from previousReports, expose toolsScanned + hashBaselineWritten metadata (Wave 3)

### Phase 4: Dynamic Adversarial Testing
**Goal**: AgentShield executes controlled attacks in a sandboxed context and produces an Attack Success Rate per attack type mapped to MCPSecBench taxonomy
**Depends on**: Phase 3
**Requirements**: DYN-01, DYN-02, DYN-03, DYN-04
**Success Criteria** (what must be TRUE):
  1. A tool-shadowing simulation runs and the report contains an ASR percentage for the shadowing attack type
  2. A RADE payload injected via a mocked tool return value is detectable in the scan output with the LLM response captured as evidence
  3. A cross-server privilege escalation chain (e.g., Keycloak tool → Neo4j write) is simulated and flagged if the chain executes beyond expected bounds
  4. Each dynamic finding is tagged with its MCPSecBench attack taxonomy label
**Plans**: 4 plans

Plans:
- [ ] 04-01: Implement sandboxed tool-shadowing and name-squatting simulation: create a shadow mock server, invoke target LLM with conflicting tool names, record which tool is called
- [ ] 04-02: Implement RADE and indirect prompt injection test: craft adversarial tool return payloads, inject via mock MCP response, capture LLM follow-on behavior as evidence
- [ ] 04-03: Implement privilege escalation chain tester: enumerate cross-server call sequences, simulate chained invocations beyond intended scope, detect out-of-bounds tool access
- [ ] 04-04: Implement ASR calculator and MCPSecBench taxonomy tagger: compute attack success rate per attack type, annotate each dynamic finding with taxonomy label and ASR value

### Phase 5: Runtime Behavioral Monitoring
**Goal**: AgentShield provides a proxy layer that intercepts live MCP traffic and flags anomalous behavior and PII exfiltration in real time
**Depends on**: Phase 4
**Requirements**: MON-01, MON-02, MON-03
**Success Criteria** (what must be TRUE):
  1. Starting AgentShield in monitor mode launches a proxy on a configurable port that forwards MCP traffic transparently; the original MCP workflow continues to function
  2. A tool invoked outside its expected call sequence (e.g., write tool called before any read) is logged as an anomalous-invocation finding
  3. A tool input or output containing a known PII pattern (email address, national ID format) is flagged and the offending value is redacted in the log
**Plans**: 3 plans

Plans:
- [ ] 05-01: Implement lightweight HTTP proxy layer: intercept requests/responses between AI Gateway and MCP servers, log all tool invocations with timestamps and payloads
- [ ] 05-02: Implement anomaly detector: define expected tool-call sequences per workflow, flag deviations (unexpected tools, out-of-order calls, suspiciously long chains) as findings
- [ ] 05-03: Implement PII exfiltration detector: regex pattern library for email, phone, national ID, credit card; scan tool inputs and outputs; redact and flag matches

### Phase 6: Remediation Report
**Goal**: AgentShield synthesizes all stage findings into a prioritized, OWASP-mapped remediation report with actionable fix guidance
**Depends on**: Phase 5
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04
**Success Criteria** (what must be TRUE):
  1. After a full scan, a JSON report file and a Markdown report file are both written to the output directory
  2. Findings in the report are ranked highest-to-lowest by composite severity score (ASR x exploitability x blast radius x OWASP weight)
  3. Every finding entry includes: description, affected component, concrete fix action, and a verification test case
  4. Every finding is annotated with its OWASP MCP Top 10 category identifier
**Plans**: 3 plans

Plans:
- [ ] 06-01: Implement report synthesizer: collect `StageReport` objects from all 5 stages, deduplicate overlapping findings, produce unified `ScanResult` with all findings
- [ ] 06-02: Implement composite scorer and ranker: compute ASR × exploitability × blast radius × OWASP weight for each finding; sort descending; emit severity summary table
- [ ] 06-03: Implement report renderer: produce structured JSON report and human-readable Markdown report with per-finding remediation blocks (description, component, fix, verification test)

### Phase 7: Conference Demo
**Goal**: A complete end-to-end scan of IKAS completes in under 10 minutes with real findings, polished CLI output, and a sample report ready for live demonstration
**Depends on**: Phase 6
**Requirements**: DEMO-01, DEMO-02, DEMO-03
**Success Criteria** (what must be TRUE):
  1. Running `agentshield scan http://localhost:8001` against a running IKAS stack completes all 5 stages and produces a report with at least 5 real findings in under 10 minutes
  2. The CLI displays color-coded severity indicators, a live progress bar per stage, and a findings summary table on completion
  3. The sample report documents all five known IKAS vulnerabilities: no rate limiting, missing CSRF protection, MCP tool arg injection, API key logging risk, and Gemini infinite loop potential
**Plans**: 3 plans

Plans:
- [ ] 07-01: Wire full end-to-end scan against IKAS: validate that all 5 stage runners execute against live IKAS services and produce non-empty findings from CONCERNS.md vulnerabilities
- [ ] 07-02: Implement demo-quality CLI output: `chalk`-based color coding by severity, `ora` spinner progress indicators per stage, final summary table with counts by severity level
- [ ] 07-03: Produce and validate sample remediation report: verify all 5 known IKAS vulnerabilities appear in output with correct severity scores, OWASP mappings, and fix guidance

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & CLI | 4/4 | Complete | 2026-04-29 |
| 2. Discovery & Inventory | 3/3 | Complete | 2026-05-10 |
| 3. Static Analysis | 6/6 | Complete | 2026-05-11 |
| 4. Dynamic Adversarial Testing | 0/4 | Not started | - |
| 5. Runtime Behavioral Monitoring | 0/3 | Not started | - |
| 6. Remediation Report | 0/3 | Not started | - |
| 7. Conference Demo | 0/3 | Not started | - |
