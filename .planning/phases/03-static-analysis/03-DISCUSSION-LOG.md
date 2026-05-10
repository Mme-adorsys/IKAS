# Phase 3: Static Analysis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 03-static-analysis
**Areas discussed:** Prompt injection patterns, Tool poisoning thresholds, Config audit scope, Hash artifact persistence

---

## Prompt Injection Patterns

| Option | Description | Selected |
|--------|-------------|----------|
| Classic jailbreaks only | ~20 well-known adversarial phrases, low false-positive rate | |
| Broad OWASP MCP Top 10 set | ~50–80 patterns covering jailbreaks + role-override + hidden commands | |
| Tiered by severity | CRITICAL/HIGH/MEDIUM tiers based on payload type | ✓ (plus library) |

**User's choice:** Tiered severity structure (option 3), but powered by an existing open-source prompt injection library rather than a hand-rolled regex list. Researcher decides which library.

**Notes:** User explicitly wants best-in-class open-source library research (rebuff, langkit, deepeval guardrails, etc.) rather than custom patterns. Researcher evaluates JS/Python/JSON dataset options and documents tradeoffs in RESEARCH.md.

Follow-up — finding format:

| Option | Description | Selected |
|--------|-------------|----------|
| Match + evidence snippet | Pattern name + matched substring + tool source | |
| Match + full description | Pattern name + full tool description + OWASP category | ✓ |
| You decide | Claude picks evidence format | |

---

## Tool Poisoning Thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| Distance ≤ 2 = HIGH | Tight threshold, catches obvious typosquatting | |
| Distance ≤ 3 = HIGH, 4–5 = MEDIUM | Tiered severity | |
| Researcher decides threshold | Research agent evaluates and picks | ✓ |

**User's choice:** Researcher decides — but with the constraint that the threshold must be general-purpose (work across any MCP server's tool set, not tuned to IKAS's 11 tools).

**Notes:** User clarified mid-discussion that AgentShield is a general-purpose MCP scanner, not IKAS-specific. This affects both the threshold calibration and all other design decisions in the phase.

Follow-up — npm dependency:

| Option | Description | Selected |
|--------|-------------|----------|
| Allow new dependency | fast-levenshtein, natural, or similar | ✓ |
| Inline implementation | 20-line function, no new package | |
| Researcher decides | Research agent evaluates | |

Follow-up — shadow tool definition:

| Option | Description | Selected |
|--------|-------------|----------|
| Exact duplicate name only | Same name across servers = CRITICAL | |
| Exact duplicate OR same name + different description | Tiered: duplicate = CRITICAL, diverging desc = HIGH | ✓ |
| You decide | Claude picks definition | |

---

## Config Audit Scope

| Option | Description | Selected |
|--------|-------------|----------|
| IKAS-specific only | docker-compose + .env files only | |
| Any YAML/JSON/env in configurable path | configPath in agentshield.config.yaml | |
| Both: smart defaults + configurable override | Default = project root scan + optional override | ✓ |

**User's choice:** Smart defaults (scan project root for *.env, docker-compose*.yml, *.yaml) plus optional configPaths override in agentshield.config.yaml.

Follow-up — credential detection:

| Option | Description | Selected |
|--------|-------------|----------|
| Key-value pattern match | Key contains PASSWORD/SECRET/etc, value is non-placeholder | |
| Key match + entropy scoring | Key pattern + Shannon entropy > 3.5 bits/char | ✓ |
| Researcher decides | Research agent evaluates truffleHog/gitleaks patterns | |

---

## Hash Artifact Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| In outputDir (alongside scan report) | tool-hashes.json in outputDir | ✓ |
| Named by target URL (per-target baseline) | tool-hashes-{hostname}.json | |
| Configurable path in agentshield.config.yaml | hashFile: path/to/baseline.json | |

Follow-up — first-scan behavior:

| Option | Description | Selected |
|--------|-------------|----------|
| Write baseline, no findings | INFO finding only: "Baseline established" | ✓ |
| Write baseline + HIGH warning | HIGH finding per server about missing baseline | |
| Write baseline silently | No findings, no messages | |

---

## Claude's Discretion

- Internal file/module organization within `agentshield/src/stages/static-analysis/`
- Whether sub-scanners are separate files or functions in one file (follow discovery.ts pattern)
- Shannon entropy inline implementation (~10 lines)
- OWASP category mapping for each severity tier in prompt injection
- Finding deduplication when multiple patterns trigger on the same tool

## Deferred Ideas

None — discussion stayed within phase scope.
