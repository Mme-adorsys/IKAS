<!-- generated-by: gsd-doc-writer -->
# DEPLOYMENT.md

Deployment reference for IKAS (Intelligentes Keycloak Admin System). The current operational target is a local Docker Compose development environment. Production deployment is forward-looking and not yet implemented.

---

## Table of Contents

1. [Deployment Targets](#deployment-targets)
2. [Prerequisites](#prerequisites)
3. [Building Images](#building-images)
4. [Starting the Development Stack](#starting-the-development-stack)
5. [Service Startup Order](#service-startup-order)
6. [Port Reference](#port-reference)
7. [Health Checks](#health-checks)
8. [Hot-Reload Development Mode](#hot-reload-development-mode)
9. [Rebuilding After Code Changes](#rebuilding-after-code-changes)
10. [Viewing Logs](#viewing-logs)
11. [Stopping and Cleaning Up](#stopping-and-cleaning-up)
12. [Forward-Looking: Production Deployment](#forward-looking-production-deployment)

---

## Deployment Targets

| Target | Status | Config File |
|--------|--------|-------------|
| Docker Compose (dev) | Active | `docker/docker-compose.dev.yml` |
| Docker Compose (hot-reload) | Active (dev only) | `docker/docker-compose.dev-hotreload.yml` |
| Container platform (production) | Not yet implemented | — |

All services share a single Docker network named `ikas-network` (declared as the default network in the Compose file).

---

## Prerequisites

- **Docker** — Engine with Compose v2 support (`docker compose` command or `docker-compose` CLI)
- **Node.js** `>= 18.0.0` — Required for the frontend and local script execution
- **npm** — Package manager for Node.js packages
- **LLM API key** — `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` must be set in the shell environment before starting the AI Gateway (see [CONFIGURATION.md](CONFIGURATION.md))

Optional:
- **`uv`** (Python package manager) — Used by `scripts/start-dev.sh` to install Neo4j MCP Python dependencies locally; falls back to `pip` if absent

---

## Building Images

Four services require a local Docker build before first use. Run these from the project root:

```bash
# Keycloak MCP Server (Node.js/TypeScript, image: ikas-keycloak-mcp:latest)
docker build -t ikas-keycloak-mcp ./keycloak-mcp-server

# Neo4j MCP Server (Python/FastMCP, image: ikas-neo4j-mcp:latest)
docker build -t ikas-neo4j-mcp ./mcp-neo4j

# AI Gateway — production build (multi-stage, image: ikas-ai-gateway)
cd docker && docker-compose -f docker-compose.dev.yml build ai-gateway

# AI Gateway — hot-reload development build (image: ikas-ai-gateway-hot)
cd docker && docker-compose -f docker-compose.dev.yml build ai-gateway-hot

# WebSocket Server (built by Compose on first up; or build explicitly)
cd docker && docker-compose -f docker-compose.dev.yml build websocket-server
```

Infrastructure images (`keycloak:24.0`, `neo4j:5.15`, `redis:7.2-alpine`, `postgres:13-alpine`) are pulled automatically from their registries on first use.

---

## Starting the Development Stack

### Option A — Automated script (recommended)

```bash
# From project root
./scripts/start-dev.sh
```

`start-dev.sh` performs the following in sequence:

1. Checks prerequisites (Docker, Node.js, npm)
2. Starts infrastructure services: `postgres`, `redis`, `neo4j`, `keycloak`
3. Waits for each service to pass its health check
4. Builds and starts MCP servers: `keycloak-mcp`, `neo4j-mcp`
5. Starts `ai-gateway` (skipped with a warning if `GEMINI_API_KEY` is not set)
6. Starts `websocket-server`
7. Runs `docker/health-check.sh` to verify all endpoints

### Option B — Manual Compose invocation

```bash
# Start all services in the default profile (excluding hot-reload)
docker-compose -f docker/docker-compose.dev.yml up -d

# Start specific services only
docker-compose -f docker/docker-compose.dev.yml up -d postgres redis neo4j keycloak
docker-compose -f docker/docker-compose.dev.yml up -d keycloak-mcp neo4j-mcp
docker-compose -f docker/docker-compose.dev.yml up -d ai-gateway websocket-server
```

### Option C — Frontend (runs outside Docker)

The Next.js frontend is not included in the Compose file and runs on the host:

```bash
cd frontend
npm install
npm run dev   # starts on http://localhost:3000
```

---

## Service Startup Order

Services must come up in dependency order. The Compose file encodes this via `depends_on` conditions. The required sequence is:

```
PostgreSQL (healthy) → Keycloak (started) → Redis (healthy)
                                                  ↓
                              Neo4j (healthy) ───┘
                                  ↓
                   keycloak-mcp (started) ── neo4j-mcp (started)
                                  ↓                   ↓
                             ai-gateway (started) ────┘
                                  ↓
                          websocket-server (started)
                                  ↓
                         frontend (host process)
```

Key dependency conditions:

| Service | Waits for |
|---------|-----------|
| `keycloak` | `postgres` healthy |
| `neo4j-mcp` | `neo4j` healthy |
| `neo4j-mcp-native` | `neo4j` healthy |
| `ai-gateway` | `keycloak-mcp` started, `neo4j-mcp` started, `redis` healthy |
| `ai-gateway-hot` | `keycloak-mcp` started, `neo4j-mcp` started, `redis` healthy |
| `websocket-server` | `ai-gateway` started, `redis` healthy |

**Note:** Keycloak has a 90-second `start_period` before its health check begins. Plan for 2–3 minutes total for the full stack to be ready on a cold start.

---

## Port Reference

| Service | Container Port | Host Port | Protocol |
|---------|---------------|-----------|----------|
| PostgreSQL | 5432 | 5432 | TCP |
| Keycloak | 8080 | 8080 | HTTP |
| Neo4j Browser | 7474 | 7474 | HTTP |
| Neo4j Bolt | 7687 | 7687 | Bolt |
| Redis | 6379 | 6379 | TCP |
| Keycloak MCP | 8001 | 8001 | HTTP |
| Neo4j MCP (HTTP wrapper) | 8002 | 8002 | HTTP |
| Neo4j MCP (native MCP) | 8003 | 8003 | HTTP |
| AI Gateway | 8005 | 8005 | HTTP |
| WebSocket Server | 3001 | 3001 | HTTP/WS |
| Frontend (host) | — | 3000 | HTTP |

`ai-gateway` and `ai-gateway-hot` share port 8005 and are mutually exclusive — do not run both at the same time.

---

## Health Checks

### Automated health check script

```bash
bash docker/health-check.sh
```

This script:

1. Waits 10 seconds for services to initialize
2. Checks PostgreSQL and Redis on their TCP ports using `nc`
3. Checks Neo4j Bolt (TCP) and Neo4j Browser (HTTP 200 on `http://localhost:7474`)
4. Checks Keycloak at `http://localhost:8080/realms/master`
5. Checks Keycloak MCP at `http://localhost:8001/health` (if the container is running)
6. Checks Neo4j MCP at `http://localhost:8002/health` (if the container is running)
7. Prints container status via `docker-compose ps`

### Per-service health check endpoints

| Service | Health endpoint |
|---------|----------------|
| Keycloak | `http://localhost:8080/health/ready` or `http://localhost:8080/realms/master` |
| Keycloak MCP | `http://localhost:8001/health` |
| AI Gateway | `http://localhost:8005/health` |
| WebSocket Server | `http://localhost:3001/health` |
| Neo4j Browser | `http://localhost:7474` |
| Redis | `redis-cli -h localhost -p 6379 ping` |

### Docker built-in health check summary

| Service | Interval | Timeout | Retries | Start period |
|---------|----------|---------|---------|--------------|
| postgres | 5s | 5s | 5 | — |
| redis | 10s | 5s | 3 | — |
| neo4j | 30s | 10s | 5 | — |
| keycloak | 10s | 10s | 15 | 90s |
| keycloak-mcp | 30s | 10s | 3 | — |
| neo4j-mcp-native | 30s | 10s | 3 | — |
| ai-gateway | 30s | 10s | 3 | — |
| ai-gateway-hot | 60s | 15s | 3 | 30s |
| websocket-server | 30s | 10s | 3 | — |

**Note:** `neo4j-mcp` (HTTP wrapper on port 8002) has its built-in Compose health check disabled due to 406 responses on its endpoint. Use `http://localhost:8002/health` via the external health check script.

---

## Hot-Reload Development Mode

The `ai-gateway-hot` service uses `Dockerfile.dev` which runs `tsx watch` for automatic TypeScript recompilation on file changes. Source files are bind-mounted into the container.

This service is gated behind the `hot-reload` profile in `docker-compose.dev.yml`:

```bash
# Start the full stack with hot-reload AI Gateway instead of the production build
docker-compose -f docker/docker-compose.dev.yml --profile hot-reload up -d

# Or use the override file (starts ai-gateway service with hot-reload config):
docker-compose \
  -f docker/docker-compose.dev.yml \
  -f docker/docker-compose.dev-hotreload.yml \
  up -d ai-gateway
```

With hot reload active:
- Edit any file in `ai-gateway/src/` and the container restarts automatically
- Logs are available at `ai-gateway/logs/` on the host (bind-mounted with `delegated` mode)
- `DEBUG=ikas:*` is set in the container environment for verbose logging

---

## Rebuilding After Code Changes

### Application services (keycloak-mcp, neo4j-mcp, ai-gateway, websocket-server)

After modifying source files in any of these packages, rebuild and restart the affected service:

```bash
# Rebuild and restart a single service
docker-compose -f docker/docker-compose.dev.yml up -d --build <service-name>

# Examples:
docker-compose -f docker/docker-compose.dev.yml up -d --build keycloak-mcp
docker-compose -f docker/docker-compose.dev.yml up -d --build neo4j-mcp
docker-compose -f docker/docker-compose.dev.yml up -d --build ai-gateway
docker-compose -f docker/docker-compose.dev.yml up -d --build websocket-server
```

For the MCP images tagged separately:

```bash
docker build -t ikas-keycloak-mcp ./keycloak-mcp-server
docker-compose -f docker/docker-compose.dev.yml restart keycloak-mcp

docker build -t ikas-neo4j-mcp ./mcp-neo4j
docker-compose -f docker/docker-compose.dev.yml restart neo4j-mcp
```

### Infrastructure services (keycloak, neo4j, redis, postgres)

These use upstream images and do not need rebuilding. To pick up a version change, update the image tag in `docker-compose.dev.yml` and run:

```bash
docker-compose -f docker/docker-compose.dev.yml pull <service-name>
docker-compose -f docker/docker-compose.dev.yml up -d <service-name>
```

### Dependency changes (package.json / pyproject.toml)

If you add or remove npm or Python dependencies, a full image rebuild is required:

```bash
# Rebuild without cache to force dependency re-installation
docker-compose -f docker/docker-compose.dev.yml build --no-cache <service-name>
docker-compose -f docker/docker-compose.dev.yml up -d <service-name>
```

---

## Viewing Logs

```bash
# All services
docker-compose -f docker/docker-compose.dev.yml logs -f

# Single service
docker-compose -f docker/docker-compose.dev.yml logs -f ai-gateway
docker-compose -f docker/docker-compose.dev.yml logs -f keycloak-mcp

# AI Gateway enhanced log files (written inside the container / bind-mounted in hot-reload mode)
docker exec ikas-ai-gateway-hot tail -f logs/combined.log
docker exec ikas-ai-gateway-hot tail -f logs/gemini.log
docker exec ikas-ai-gateway-hot tail -f logs/mcp.log
```

---

## Stopping and Cleaning Up

```bash
# Stop all containers (volumes and data preserved)
docker-compose -f docker/docker-compose.dev.yml stop

# Stop and remove containers (volumes preserved)
docker-compose -f docker/docker-compose.dev.yml down

# Stop, remove containers, and delete all named volumes (full reset)
docker-compose -f docker/docker-compose.dev.yml down -v
```

Named volumes managed by this Compose file:

| Volume | Purpose |
|--------|---------|
| `postgres_data` | Keycloak PostgreSQL data |
| `neo4j_data` | Neo4j graph data |
| `neo4j_logs` | Neo4j log files |
| `neo4j_plugins` | Neo4j APOC and graph-data-science plugins |
| `redis_data` | Redis AOF persistence |
| `ai_gateway_dev_node_modules` | node_modules for hot-reload container |

---

## Forward-Looking: Production Deployment

Production deployment has not been implemented. The notes below capture the expected direction based on the current architecture.

### Environment hardening required before production

- Replace all default credentials in `docker-compose.dev.yml` with secrets management (Keycloak `admin/admin`, Neo4j `neo4j/password`, PostgreSQL `keycloak/keycloak` are development defaults only)
- Set `KC_HOSTNAME_STRICT: true` and `KC_HOSTNAME_STRICT_HTTPS: true` on the Keycloak service
- Replace `command: start-dev` on Keycloak with `start --optimized`
- Remove the hardcoded `GEMINI_API_KEY` fallback value from the Compose environment block
- Set `NODE_ENV: production` for all Node.js services

### Containerization readiness

The `ai-gateway/Dockerfile` (production stage) already implements a multi-stage build that:
- Builds TypeScript in a `builder` stage using `node:18-alpine`
- Produces a production image with only compiled `dist/` output and production `node_modules`
- Runs as a non-root `nodejs` user (uid 1001)

`keycloak-mcp-server/Dockerfile` and `websocket-server/Dockerfile` are single-stage builds suitable for containerized deployment with minor hardening.

`mcp-neo4j/Dockerfile` uses `python:3.11-slim` and an `entrypoint.sh` to select between HTTP wrapper and native MCP server modes.

<!-- VERIFY: Target container platform (Kubernetes, ECS, Fly.io, etc.) for production -->
<!-- VERIFY: Production database backend — whether a managed PostgreSQL service replaces the containerized postgres:13-alpine -->
<!-- VERIFY: TLS termination approach (ingress controller, load balancer, or Caddy/nginx sidecar) -->
<!-- VERIFY: Secret management solution (Vault, AWS Secrets Manager, Kubernetes Secrets, etc.) for API keys and database passwords in production -->
<!-- VERIFY: Horizontal scaling requirements and whether any services have stateful constraints that limit replica count -->

### CI/CD pipeline

No CI/CD pipeline configuration exists in the repository at this time.

<!-- VERIFY: CI/CD platform to be used (GitHub Actions, GitLab CI, etc.) and target deployment workflow -->
