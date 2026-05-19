<!-- generated-by: gsd-doc-writer -->
# agentshield

MCP security scanner for agentic AI systems.

Part of the [IKAS monorepo](../../README.md).

## Installation

Requires Node.js >= 18.0.0.

```bash
npm install
```

## Quick Start

```bash
# Run a security scan against a target MCP server
npm run scan -- http://localhost:8001

# Or after building
npm run build
agentshield scan http://localhost:8001
```

## Usage

```bash
agentshield scan <target> [options]
```

**Arguments:**

- `<target>` — Target MCP server URL (required)

**Options:**

| Option | Default | Description |
|---|---|---|
| `-c, --config <path>` | `agentshield.config.yaml` | Path to config file |
| `-o, --output-dir <dir>` | _(from config)_ | Override output directory for report files |
| `-s, --stages <stages>` | all stages | Comma-separated list of stages to run |
| `-v, --verbose` | `false` | Print attack prompts, responses, and tool calls during dynamic testing |

**Example — run only discovery and static analysis:**

```bash
agentshield scan http://localhost:8001 --stages discovery,staticAnalysis
```

**Example — use a custom config and output directory:**

```bash
agentshield scan http://localhost:8001 --config ./my-config.yaml --output-dir ./reports
```

## Scan Stages

Scans run five sequential stages. Each stage builds on the previous stage's output.

| Stage ID | Name | Description |
|---|---|---|
| `discovery` | Discovery & Inventory | Port-sweeps the target host, probes for MCP servers (JSON-RPC and REST), enumerates tool lists, and flags shadow servers not in the allow-list |
| `staticAnalysis` | Static Analysis | Scans discovered tool descriptions for prompt-injection patterns, tool-poisoning indicators, config-file issues, and records a tool-hash baseline |
| `dynamicTesting` | Dynamic Adversarial Testing | Sends adversarial prompts via an AI gateway to test tool-shadowing, RADE (Role-takeover / data exfiltration / escalation) attacks, and privilege escalation chains |
| `runtimeMonitoring` | Runtime Behavioral Monitoring | Reserved for live behavioral monitoring (stub in current version) |
| `report` | Report | Writes findings to `agentshield-report.json` in the output directory and renders a summary table to stdout |

## Configuration

Create or edit `agentshield.config.yaml` in the project directory:

```yaml
target: http://localhost:8001
allowedServers:
  - http://localhost:8001
  - http://localhost:8002
outputDir: ./agentshield-output
stages:
  - discovery
  - staticAnalysis
  - dynamicTesting
  - runtimeMonitoring
  - report
```

| Field | Required | Default | Description |
|---|---|---|---|
| `target` | Yes | — | Target MCP server URL |
| `allowedServers` | No | `[]` | URLs of MCP servers permitted in this environment; any server not listed is flagged as a shadow server |
| `outputDir` | No | `./agentshield-output` | Directory where `agentshield-report.json` is written |
| `stages` | No | all stages | Ordered list of stages to execute |
| `auth.apiKey` | No | — | API key forwarded to the target server when probing |
| `auth.token` | No | — | Bearer token forwarded to the target server when probing |
| `verbose` | No | `false` | Enables verbose output during dynamic testing |

## Output

After a scan completes, results are written to `<outputDir>/agentshield-report.json`. A summary table is also printed to stdout.

Each finding includes:

- `id` — UUID
- `title` — Short description of the finding
- `description` — Full explanation
- `severity` — `critical`, `high`, `medium`, `low`, or `info`
- `component` — Affected component or URL
- `score` — Numeric risk score
- `remediation` — Suggested fix (when available)
- `owaspCategory` — OWASP category reference (when applicable)
- `cveId` — CVE identifier (when applicable)

## Development

```bash
# TypeScript compilation
npm run build

# Run in development mode (tsx, no build required)
npm run dev

# Type-check without emitting
npm run type-check
```

## Testing

```bash
# Run the full test suite
npm test

# Watch mode
npm run test:watch
```

Test files are located in `tests/` and follow the `*.test.ts` naming convention. The test suite covers the runner, config loader, and CLI.
