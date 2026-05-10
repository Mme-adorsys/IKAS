# Requirements: AgentShield

**Defined:** 2026-04-29
**Core Value:** A security engineer runs `agentshield scan <target>` and receives a prioritized, actionable remediation report covering all four MCP attack surfaces in under 10 minutes.

## v1 Requirements

### Infrastructure (CLI Foundation)

- [ ] **INFRA-01**: User can run `agentshield scan <target-url>` from the command line and receive structured output
- [ ] **INFRA-02**: User can provide a config file specifying target MCP URLs, auth credentials, and output format (JSON/Markdown)
- [ ] **INFRA-03**: System produces findings with severity levels (critical/high/medium/low) and a composite score

### Discovery & Inventory (Stage 1)

- [x] **DISC-01**: System enumerates all MCP servers connected to a target agentic system
- [x] **DISC-02**: System lists all tool definitions, resource endpoints, and transport configurations for each discovered MCP server
- [x] **DISC-03**: System detects shadow MCP servers (unregistered servers) and over-permissioned tool integrations
- [ ] **DISC-04**: System cross-references discovered tools and endpoints against known vulnerabilities (CVE-2025-6514, CVE-2025-49596) and OWASP MCP Top 10

### Static Analysis (Stage 2)

- [ ] **STAT-01**: System scans all tool descriptions for hidden prompt injection payloads and malicious instruction patterns
- [ ] **STAT-02**: System detects tool poisoning patterns including tool shadowing, name-squatting, cross-server hijacking, and rug-pull indicators
- [ ] **STAT-03**: System audits configuration files for hardcoded credentials, excessive permissions, insecure transport settings, and missing authentication
- [ ] **STAT-04**: System records tool definition hashes at scan time to enable rug-pull detection across scan runs

### Dynamic Adversarial Testing (Stage 3)

- [ ] **DYN-01**: System executes controlled tool-shadowing and name-squatting attack simulations in a sandboxed environment
- [ ] **DYN-02**: System injects RADE (Retrieval-Agent Deception) payloads and indirect prompt injections via tool return values against the host LLM
- [ ] **DYN-03**: System tests for privilege escalation via cross-server tool invocation chains
- [ ] **DYN-04**: System reports Attack Success Rate (ASR) per attack type, mapped to MCPSecBench taxonomy

### Runtime Behavioral Monitoring (Stage 4)

- [ ] **MON-01**: System provides a lightweight proxy layer that intercepts live MCP traffic between client and MCP servers
- [ ] **MON-02**: System detects anomalous tool invocations, unexpected tool-call chains, and suspicious data flow patterns in real time
- [ ] **MON-03**: System detects PII exfiltration attempts in tool inputs and outputs

### Remediation Report (Stage 5)

- [ ] **RPT-01**: System synthesizes findings from all stages into a structured report in both JSON and Markdown formats
- [ ] **RPT-02**: System ranks vulnerabilities by composite severity score (ASR × exploitability × blast radius × OWASP weight)
- [ ] **RPT-03**: System provides per-finding remediation guidance including: description, affected component, concrete fix action, and a verification test case
- [ ] **RPT-04**: System maps each finding to the OWASP MCP Top 10 category

### Conference Demo

- [ ] **DEMO-01**: System completes a full end-to-end scan of IKAS (all 5 stages) with real findings from the known vulnerability surface
- [ ] **DEMO-02**: CLI output is formatted for live demo legibility (progress indicators, color-coded severity, summary table)
- [ ] **DEMO-03**: System produces a sample remediation report demonstrating at least 5 real IKAS vulnerabilities (no-rate-limiting, CSRF, MCP arg injection, API key logging, infinite loop)

## v2 Requirements

### UI & Visualization

- **UI-01**: Web dashboard showing scan progress and findings in real time
- **UI-02**: Interactive remediation checklist with mark-as-fixed workflow
- **UI-03**: Historical scan comparison (diff between scans)

### Extended Coverage

- **EXT-01**: Protocol-level MITM and DNS rebinding probe support
- **EXT-02**: Supply-chain injection detection (malicious npm packages in MCP server deps)
- **EXT-03**: Automated CVE database sync (NIST NVD integration)
- **EXT-04**: CI/CD integration (GitHub Actions, pre-commit hook)

### Reporting

- **RPT-05**: HTML report with embedded remediation guidance and compliance mapping
- **RPT-06**: SARIF output format for integration with GitHub Security tab

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI / SaaS offering | CLI-only for PoC; complexity not justified for conference demo |
| Auto-remediation (apply fixes) | Report-only in v1; auto-fix carries risk of breaking target systems |
| Non-MCP AI system support | MCP-only scope; generalizing adds complexity without demo value |
| Real-time CVE database sync | Static list sufficient; live sync adds infrastructure dependency |
| Support for non-TypeScript MCP servers | IKAS target is TS; Python/Go server support deferred |

## Traceability

| Requirement | Phase | Phase Name | Status |
|-------------|-------|------------|--------|
| INFRA-01 | Phase 1 | Foundation & CLI | Pending |
| INFRA-02 | Phase 1 | Foundation & CLI | Pending |
| INFRA-03 | Phase 1 | Foundation & CLI | Pending |
| DISC-01 | Phase 2 | Discovery & Inventory | Pending |
| DISC-02 | Phase 2 | Discovery & Inventory | Pending |
| DISC-03 | Phase 2 | Discovery & Inventory | Complete |
| DISC-04 | Phase 2 | Discovery & Inventory | Pending |
| STAT-01 | Phase 3 | Static Analysis | Pending |
| STAT-02 | Phase 3 | Static Analysis | Pending |
| STAT-03 | Phase 3 | Static Analysis | Pending |
| STAT-04 | Phase 3 | Static Analysis | Pending |
| DYN-01 | Phase 4 | Dynamic Adversarial Testing | Pending |
| DYN-02 | Phase 4 | Dynamic Adversarial Testing | Pending |
| DYN-03 | Phase 4 | Dynamic Adversarial Testing | Pending |
| DYN-04 | Phase 4 | Dynamic Adversarial Testing | Pending |
| MON-01 | Phase 5 | Runtime Behavioral Monitoring | Pending |
| MON-02 | Phase 5 | Runtime Behavioral Monitoring | Pending |
| MON-03 | Phase 5 | Runtime Behavioral Monitoring | Pending |
| RPT-01 | Phase 6 | Remediation Report | Pending |
| RPT-02 | Phase 6 | Remediation Report | Pending |
| RPT-03 | Phase 6 | Remediation Report | Pending |
| RPT-04 | Phase 6 | Remediation Report | Pending |
| DEMO-01 | Phase 7 | Conference Demo | Pending |
| DEMO-02 | Phase 7 | Conference Demo | Pending |
| DEMO-03 | Phase 7 | Conference Demo | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-29*
*Last updated: 2026-04-29 after roadmap creation — phase names added to traceability*
