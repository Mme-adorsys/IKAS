# AgentShield

## What This Is

AgentShield is a 5-stage automated penetration testing and remediation framework for MCP-enabled agentic AI systems, built as a security module within the IKAS repository. It enables security engineers and developers to enumerate MCP attack surfaces, run controlled adversarial simulations, monitor runtime behavior, and receive a prioritized remediation report — all from a single CLI command. The primary target for the conference PoC is IKAS itself.

## Core Value

A security engineer runs `agentshield scan <target>` and receives a prioritized, actionable remediation report covering all four MCP attack surfaces in under 10 minutes.

## Requirements

### Validated

- ✓ MCP server infrastructure (Keycloak MCP port 8001, Neo4j MCP port 8002) — existing in IKAS
- ✓ AI Gateway orchestration layer (Express.js, port 8005) — existing in IKAS
- ✓ Tool discovery via HTTP REST wrapper — existing in IKAS
- ✓ Structured logging with Winston + request correlation — existing in IKAS
- ✓ Docker compose environment for all services — existing in IKAS
- ✓ TypeScript + Node.js runtime across all services — existing in IKAS
- ✓ Known vulnerability surface documented in .planning/codebase/CONCERNS.md — existing

### Active

- [x] INFRA-01: `agentshield/` directory with CLI entrypoint (`agentshield scan <target>`) — Validated in Phase 01
- [x] INFRA-02: Configuration schema (target MCP URL, auth, output format) — Validated in Phase 01
- [x] INFRA-03: Shared result types and severity model (critical/high/medium/low) — Validated in Phase 01
- [x] DISC-01: Enumerate all MCP servers connected to a target system — Validated in Phase 02
- [x] DISC-02: List all tool definitions, resource endpoints, and transport configs — Validated in Phase 02
- [x] DISC-03: Detect shadow MCP servers and over-permissioned integrations — Validated in Phase 02
- [x] DISC-04: Cross-reference against CVE-2025-6514, CVE-2025-49596, OWASP MCP Top 10 — Validated in Phase 02
- [x] STAT-01: Scan tool descriptions for hidden prompt injection payloads — Validated in Phase 03
- [x] STAT-02: Detect tool poisoning patterns (shadowing, name-squatting, rug-pull) — Validated in Phase 03
- [x] STAT-03: Audit configuration files for hardcoded credentials and excessive permissions — Validated in Phase 03
- [x] STAT-04: Record tool definition hashes for rug-pull detection — Validated in Phase 03
- [x] DYN-01: Execute tool-shadowing and name-squatting attack simulations in sandbox — Validated in Phase 04
- [x] DYN-02: Inject RADE (Retrieval-Agent Deception) payloads against host LLM — Validated in Phase 04
- [x] DYN-03: Test indirect prompt injection via tool return values — Validated in Phase 04
- [x] DYN-04: Report Attack Success Rate (ASR) per attack type — Validated in Phase 04
- [ ] MON-01: Lightweight proxy layer intercepting MCP traffic
- [ ] MON-02: Detect anomalous tool invocations and unexpected call chains
- [ ] MON-03: PII exfiltration detection in tool inputs/outputs
- [ ] RPT-01: Synthesize all stage findings into structured JSON + Markdown report
- [ ] RPT-02: Rank vulnerabilities by composite severity score (ASR × exploitability × blast radius)
- [ ] RPT-03: Per-finding remediation guidance with verification test cases
- [ ] RPT-04: OWASP MCP Top 10 alignment for each finding
- [ ] DEMO-01: End-to-end scan of IKAS reference target with real findings
- [ ] DEMO-02: CLI output formatted for live demo presentation
- [ ] DEMO-03: Sample report showing known IKAS vulnerabilities

### Out of Scope

- Web UI for AgentShield — CLI-only for PoC, defer to post-conference
- Real-time vulnerability database sync — static CVE list sufficient for demo
- Support for non-MCP AI systems — MCP-only scope for v1
- Automated fix application — report only, no auto-remediation in v1
- Cloud-hosted SaaS offering — local tool only for PoC

## Context

**Conference abstract:** "Mapping the Attack Surface of MCP-Enabled AI Agents: A Survey of Threats, Benchmarks, and a Proposed Self-Assessment Penetration Testing Framework" proposes AgentShield as a 5-stage framework: (1) Discovery & Inventory, (2) Static Analysis & Configuration Audit, (3) Dynamic Adversarial Testing, (4) Runtime Behavioral Monitoring, (5) Remediation Report & Prioritized Security Suggestions.

**Reference target:** IKAS itself — a production-ready MCP-enabled system with known vulnerabilities documented in `.planning/codebase/CONCERNS.md` including: no rate limiting, no CSRF protection, missing input validation on MCP tool args, API key exposure risk in logging, WebSocket protocol validation bug, and infinite loop potential in Gemini function calling.

**Prior art integrated:** MCPSecBench (17 attack types), MCPLIB (31 attack methods), MCP-Guard (95.4% F1 detection pipeline), MCP-Scan (static + proxy), OWASP MCP Top 10.

**Conference timeline:** Amsterdam IAM/Security Conference demo (see IKAS CLAUDE.md for context).

## Constraints

- **Tech stack**: TypeScript + Node.js — must match existing IKAS services; no new languages
- **Scope**: PoC for conference demo — depth over breadth; 3 attack types per stage is sufficient
- **Target**: Must demonstrate real findings against IKAS; not just synthetic test data
- **Security**: AgentShield itself must not introduce vulnerabilities into the IKAS repo
- **Timeline**: Conference demo is the hard deadline; all 7 phases must complete before it

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AgentShield as IKAS module (not standalone repo) | Shares MCP infrastructure, TypeScript, Docker; faster to PoC | — Pending |
| CLI-first (no web UI) | Faster to build; more credible for security audience; extensible later | — Pending |
| IKAS as primary scan target | Known vulnerabilities from CONCERNS.md provide guaranteed real findings for demo | — Pending |
| TypeScript + tsx for CLI | Consistent with existing stack; avoids Python dependency | — Pending |
| Static CVE list for v1 | Sufficient for demo; live DB sync adds complexity without demo value | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-11 after Phase 03 completion*
