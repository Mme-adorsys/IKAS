<!-- generated-by: gsd-doc-writer -->
# Getting Started with IKAS

IKAS (Intelligentes Keycloak Admin System) is an AI-powered Keycloak administration system operated through English voice commands. This guide walks you through setting up the full development environment and verifying that all services are healthy.

---

## Prerequisites

Before running IKAS, ensure the following tools are installed and available in your `PATH`.

### Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | Latest stable | Container runtime for all backend services |
| Docker Compose | v2+ | Multi-container orchestration |
| Node.js | >= 18.0.0 | Frontend, AI Gateway, WebSocket Server, Keycloak MCP |
| npm | Bundled with Node.js | Package management |
| Python | >= 3.11 | `mcp-neo4j` service |
| `uv` | Latest | Python dependency management for `mcp-neo4j` |

### Verify Installed Tools

```bash
docker --version
docker compose version
node --version
npm --version
python3 --version
uv --version
```

### Required API Keys

At least one LLM provider key is required for the AI Gateway to process voice commands:

| Variable | Provider | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Anthropic Claude | Default provider (`claude-sonnet-4-20250514`) |
| `GEMINI_API_KEY` | Google Gemini | Alternative provider; also used as fallback |

You need at least one of these keys. Both can be set to enable runtime model switching.

---

## Step-by-Step First Run

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd IKAS
```

### Step 2: Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` in your editor and set your LLM API key(s):

```bash
# Set at minimum one of these:
ANTHROPIC_API_KEY=sk-ant-...your-anthropic-key...
GEMINI_API_KEY=AIza...your-gemini-key...
```

The remaining values in `.env` (Keycloak, Neo4j, Redis, PostgreSQL) are pre-configured with development defaults and do not need changes for a local setup.

### Step 3: Start All Services

Run the startup script from the project root. This script checks prerequisites, starts Docker infrastructure services in dependency order, builds MCP server images, waits for health checks, and installs Node.js and Python dependencies.

```bash
./scripts/start-dev.sh
```

The script prints status messages as each service comes up. Startup takes 3–5 minutes on the first run because Docker images for Keycloak, Neo4j, and the MCP servers are pulled or built.

Expected output at the end:

```
🎉 IKAS Development Environment Started Successfully!
==================================================
Infrastructure Services:
  • Keycloak Admin Console: http://localhost:8080 (admin/admin)
  • Neo4j Browser:          http://localhost:7474 (neo4j/password)
  • PostgreSQL:             localhost:5432 (keycloak/keycloak)
  • Redis:                  localhost:6379

IKAS Services:
  • Keycloak MCP Server:    http://localhost:8001
  • Neo4j MCP Server:       http://localhost:8002
  • AI Gateway:             http://localhost:8005
  • WebSocket Server:       http://localhost:3001
```

### Step 4: Start the Frontend

The frontend is a Next.js application that runs as a separate process outside Docker. Open a new terminal and run:

```bash
cd frontend
npm install
npm run dev -- --port 3002
```

The frontend dashboard is then available at `http://localhost:3002`.

---

## Verifying All Services Are Healthy

### Automated Health Check

Run the health check script to verify all services at once:

```bash
./docker/health-check.sh
```

This script checks TCP availability for PostgreSQL (5432) and Redis (6379), HTTP availability for Neo4j Browser (7474), Keycloak (8080), Keycloak MCP (8001), and Neo4j MCP (8002), and prints the Docker Compose container status table.

### Manual Service Verification

You can also verify each service individually:

```bash
# Infrastructure
curl -sf http://localhost:8080/realms/master | head -c 100  # Keycloak
curl -sf http://localhost:7474                               # Neo4j Browser
redis-cli -h localhost -p 6379 ping                         # Redis (returns PONG)

# IKAS core services
curl -sf http://localhost:8001/health   # Keycloak MCP
curl -sf http://localhost:8005/health   # AI Gateway
curl -sf http://localhost:3001/health   # WebSocket Server
```

### Service Port Reference

| Service | URL | Default Credentials |
|---------|-----|-------------------|
| Frontend dashboard | `http://localhost:3002` | — |
| Keycloak Admin Console | `http://localhost:8080` | `admin` / `admin` |
| Neo4j Browser | `http://localhost:7474` | `neo4j` / `password` |
| AI Gateway | `http://localhost:8005/health` | — |
| WebSocket Server | `http://localhost:3001/health` | — |
| Keycloak MCP Server | `http://localhost:8001/health` | — |
| Neo4j MCP Server | `http://localhost:8002` | — |
| PostgreSQL | `localhost:5432` | `keycloak` / `keycloak` |
| Redis | `localhost:6379` | — |

### Check Container Status Directly

```bash
docker compose -f docker/docker-compose.dev.yml ps
```

All containers should show a `running` or `healthy` status. Containers showing `starting` will become healthy within 2–3 minutes of initial startup.

---

## First Voice Command Test

### Using the Voice Test Client

The quickest way to test the complete end-to-end flow is the built-in test client served by Keycloak:

1. Open `http://localhost:8080/test-client.html` in your browser.
2. Allow microphone access when the browser prompts.
3. Say the hotword **"Hey IKAS"** followed by a command.

### Example Commands

```
Hey IKAS, show all users
Hey IKAS, analyze compliance
Hey IKAS, switch to Gemini model
Hey IKAS, switch to Claude model
Hey IKAS, find duplicate users
Hey IKAS, show statistics
```

### Using the Full Dashboard

The frontend dashboard at `http://localhost:3002` provides the complete interface including:

- Voice command panel with live transcription
- Model selection for Anthropic Claude or Google Gemini
- Real-time WebSocket status
- Dashboard with system status and event log

### Testing the AI Gateway Directly

To verify the AI Gateway processes a command without the voice interface:

```bash
curl -s -X POST http://localhost:8005/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "show all users", "sessionId": "test-session"}' | python3 -m json.tool
```

A successful response contains a `response` field with an AI-generated answer, and the AI Gateway logs at `docker exec ikas-ai-gateway tail -f logs/combined.log` will show the full orchestration trace.

---

## Common Setup Issues

### AI Gateway does not start — missing API key

**Symptom:** `./scripts/start-dev.sh` prints `GEMINI_API_KEY not set` and skips the AI Gateway step, or the container exits immediately.

**Fix:** Ensure `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` is set in your `.env` file. The AI Gateway requires at least one key to initialise. After setting the key, start the gateway manually:

```bash
docker compose -f docker/docker-compose.dev.yml up -d ai-gateway
```

### Keycloak health check timeout

**Symptom:** The startup script prints `Keycloak health check timeout. Continuing anyway...` and Keycloak may not be fully ready.

**Fix:** Keycloak connects to PostgreSQL at startup and can take up to 90 seconds on first boot. Wait 2 minutes and re-run the health check:

```bash
./docker/health-check.sh
```

If Keycloak remains unhealthy, check its logs:

```bash
docker compose -f docker/docker-compose.dev.yml logs keycloak
```

### Port already in use

**Symptom:** Docker Compose fails with `address already in use` for ports 8080, 7474, 5432, or 6379.

**Fix:** Identify and stop the conflicting process:

```bash
lsof -i :<port-number>
kill -9 <pid>
```

Common conflicts: a local PostgreSQL installation on 5432, a local Redis instance on 6379, or another Keycloak instance on 8080.

### `uv` not found — Python dependency install fails

**Symptom:** The startup script prints `uv not found, using pip instead` and may fail if there is no `requirements.txt`.

**Fix:** Install `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then re-run `./scripts/start-dev.sh` or sync the `mcp-neo4j` service manually:

```bash
cd mcp-neo4j && uv sync
```

### MCP server shows `Running in stdio mode`

**Symptom:** The health check script reports `Keycloak MCP: Running in stdio mode` instead of `Healthy`.

**Fix:** This means the MCP container is not running. Rebuild and restart it:

```bash
docker build -t ikas-keycloak-mcp ./keycloak-mcp-server
docker compose -f docker/docker-compose.dev.yml up -d keycloak-mcp
```

### View service logs for any issue

```bash
# Replace <service> with: keycloak, postgres, redis, neo4j, keycloak-mcp, neo4j-mcp, ai-gateway, websocket-server
docker compose -f docker/docker-compose.dev.yml logs <service>

# Stream live logs
docker compose -f docker/docker-compose.dev.yml logs -f <service>
```

---

## Next Steps

- See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed breakdown of how the services interact.
- See [CONFIGURATION.md](CONFIGURATION.md) for the full environment variable reference.
- See [DEVELOPMENT.md](DEVELOPMENT.md) for build commands, code style, and the PR workflow.
- See [TESTING.md](TESTING.md) for running the unit and integration test suites.

---

## Stopping All Services

```bash
# Stop containers but preserve volumes (data is retained)
docker compose -f docker/docker-compose.dev.yml stop

# Stop and remove containers (data volumes are retained)
docker compose -f docker/docker-compose.dev.yml down

# Stop and remove containers AND volumes (full reset)
docker compose -f docker/docker-compose.dev.yml down -v
```
