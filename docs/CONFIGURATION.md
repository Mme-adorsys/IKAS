<!-- generated-by: gsd-doc-writer -->
# CONFIGURATION.md

Configuration reference for the IKAS (Intelligentes Keycloak Admin System) multi-service stack. This document covers environment variables per service, LLM provider selection, Docker Compose profiles, and development vs. production configuration differences.

---

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Root .env File](#root-env-file)
3. [Environment Variables by Service](#environment-variables-by-service)
   - [AI Gateway](#ai-gateway)
   - [WebSocket Server](#websocket-server)
   - [Frontend (Next.js)](#frontend-nextjs)
   - [Keycloak MCP Server](#keycloak-mcp-server)
   - [Neo4j MCP Server](#neo4j-mcp-server)
   - [Keycloak](#keycloak)
   - [Neo4j](#neo4j)
   - [PostgreSQL](#postgresql)
   - [Redis](#redis)
4. [LLM Provider Selection](#llm-provider-selection)
5. [Docker Compose Profiles](#docker-compose-profiles)
6. [Development vs. Production Differences](#development-vs-production-differences)
7. [Advanced / Optional Variables](#advanced--optional-variables)

---

## Quick Setup

```bash
# Copy the example file and edit values for your environment
cp .env.example .env
```

At minimum you must set the API key for your chosen LLM provider. The rest of the defaults in `.env.example` work for a standard local development setup.

---

## Root .env File

The root `.env` file is consumed by Docker Compose and is the single source of truth for the entire stack. The `.env.example` file at the project root documents every supported variable with safe defaults.

Variables that fall back to a hard-coded default in Docker Compose or source code are marked **Optional**. Variables whose absence causes a startup failure are marked **Required**.

---

## Environment Variables by Service

### AI Gateway

**Port:** 8005  
**Source:** `ai-gateway/src/utils/config.ts` (validated with Zod)

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | Required | `anthropic` | Active LLM backend. One of `anthropic`, `gemini`, `openai`, `ollama`. |
| `ANTHROPIC_API_KEY` | Required when `LLM_PROVIDER=anthropic` | — | Anthropic API key. |
| `GEMINI_API_KEY` | Required when `LLM_PROVIDER=gemini` | — | Google Gemini API key. |
| `OPENAI_API_KEY` | Required when `LLM_PROVIDER=openai` | — | OpenAI API key. |
| `LLM_MODEL` | Optional | Provider default (see below) | Override the model ID used for inference. |
| `ANTHROPIC_MODEL` | Optional | `claude-opus-4-1-20250805` | Anthropic-specific model override. Takes precedence over `LLM_MODEL` when provider is `anthropic`. |
| `LLM_TEMPERATURE` | Optional | `0.1` | Sampling temperature. Range 0–2. |
| `LLM_MAX_TOKENS` | Optional | `8192` | Maximum output tokens per response. Max 200000. |
| `LLM_TOP_P` | Optional | `0.95` | Top-p nucleus sampling. Range 0–1. |
| `LLM_TIMEOUT` | Optional | `30000` | LLM request timeout in milliseconds. |
| `PORT` | Optional | `8000` | HTTP port for the AI Gateway. Docker Compose overrides this to `8005`. |
| `NODE_ENV` | Optional | `development` | Runtime environment. One of `development`, `production`, `test`. |
| `REDIS_URL` | Optional | `redis://localhost:6379` | Redis connection URL for session caching. |
| `KEYCLOAK_MCP_URL` | Optional | `http://localhost:8001` | Base URL of the Keycloak MCP server. |
| `NEO4J_MCP_URL` | Optional | `http://localhost:8002` | Base URL of the Neo4j MCP HTTP wrapper. |
| `WEBSOCKET_SERVER_URL` | Optional | `http://localhost:3001` | URL of the WebSocket server (used for event notifications from gateway). |
| `CORS_ORIGINS` | Optional | `http://localhost:3000,http://localhost:3001,http://localhost:3002` | Comma-separated list of allowed CORS origins. In production, this is locked down. |
| `HEALTH_CHECK_TIMEOUT` | Optional | `5000` | Timeout in ms for upstream health checks. |
| `HEALTH_CHECK_INTERVAL` | Optional | `30000` | Health check poll interval in ms. |
| `MAX_FUNCTION_ITERATIONS` | Optional | `10` | Maximum LLM function-call iterations per request to prevent infinite loops. |
| `DEBUG` | Optional | — | Enable debug namespaces, e.g. `ikas:*`. Used in hot-reload development profile. |

#### Cache TTL Variables (AI Gateway)

| Variable | Default | Description |
|---|---|---|
| `CACHE_TTL_USER_DATA` | `300` | Seconds to cache Keycloak user data. |
| `CACHE_TTL_COMPLIANCE_RESULTS` | `1800` | Seconds to cache compliance analysis results. |
| `CACHE_TTL_GRAPH_ANALYSIS` | `3600` | Seconds to cache Neo4j graph analysis results. |
| `CACHE_TTL_SYSTEM_METRICS` | `60` | Seconds to cache system metrics. |

#### Circuit Breaker Variables (AI Gateway)

| Variable | Default | Description |
|---|---|---|
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5` | Number of consecutive failures before opening the circuit. |
| `CIRCUIT_BREAKER_RECOVERY_TIMEOUT` | `30000` | Milliseconds to wait before retrying after circuit open. |

---

### WebSocket Server

**Port:** 3001  
**Source:** `websocket-server/src/server.ts`

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `3001` | HTTP/WebSocket listen port. |
| `REDIS_URL` | Optional | `redis://localhost:6379` | Redis URL for pub/sub messaging between services. |
| `CORS_ORIGIN` | Optional | `http://localhost:3000,http://localhost:3002` | Comma-separated allowed CORS origins for Socket.io. |
| `CORS_CREDENTIALS` | Optional | `false` | Set to `true` to allow credentialed cross-origin requests. |
| `SESSION_TIMEOUT` | Optional | `3600000` | Voice session timeout in milliseconds (default 1 hour). |
| `AI_GATEWAY_URL` | Optional | `http://localhost:8005` | URL of the AI Gateway for forwarding processed commands. |
| `NODE_ENV` | Optional | `development` | Runtime environment. |
| `LOG_LEVEL` | Optional | `info` | Winston log level (`debug`, `info`, `warn`, `error`). |

---

### Frontend (Next.js)

**Port:** 3002 (development)  
**Source:** `frontend/src/services/websocket.ts`, `frontend/src/store/index.ts`

All `NEXT_PUBLIC_` variables are embedded at build time and exposed to the browser.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Optional | `http://localhost:8005` | AI Gateway base URL for REST API calls. |
| `NEXT_PUBLIC_WS_URL` | Optional | `http://localhost:3001` | WebSocket server URL for real-time communication. |
| `NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS` | Optional | `5` | Maximum Socket.io reconnection attempts. |
| `NEXT_PUBLIC_WS_RECONNECT_DELAY` | Optional | `1000` | Delay in ms between reconnection attempts. |
| `NEXT_PUBLIC_WS_TIMEOUT` | Optional | `10000` | WebSocket connection timeout in ms. |
| `NEXT_PUBLIC_DEBUG_WEBSOCKET` | Optional | `false` | Set to `true` to enable verbose WebSocket logging in the browser console. |

---

### Keycloak MCP Server

**Port:** 8001  
**Source:** `keycloak-mcp-server/src/http-server.ts`

| Variable | Required | Default | Description |
|---|---|---|---|
| `KEYCLOAK_URL` | Optional | `http://localhost:8080` | Base URL of the Keycloak server. |
| `KEYCLOAK_ADMIN` | Required* | — | Admin username. Alias accepted by `KEYCLOAK_USERNAME`. |
| `KEYCLOAK_ADMIN_PASSWORD` | Required* | — | Admin password. Alias accepted by `KEYCLOAK_PASSWORD`. |
| `KEYCLOAK_USERNAME` | Optional | Falls back to `KEYCLOAK_ADMIN` | Explicit username override. |
| `KEYCLOAK_PASSWORD` | Optional | Falls back to `KEYCLOAK_ADMIN_PASSWORD` | Explicit password override. |
| `KEYCLOAK_CLIENT_ID` | Optional | — | OAuth2 client ID if using client credentials grant instead of admin credentials. |
| `KEYCLOAK_CLIENT_SECRET` | Optional | — | OAuth2 client secret paired with `KEYCLOAK_CLIENT_ID`. |
| `KEYCLOAK_REALM_NAME` | Optional | `master` | Default realm for all MCP tool operations. |
| `RESOURCES_FOLDER` | Optional | `./resources` | Path to static resource files used by the MCP server. |
| `PORT` | Optional | `8001` | HTTP listen port. |
| `NODE_ENV` | Optional | `development` | Runtime environment. |

*`KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` are effectively required; the server will fail to authenticate against Keycloak without credentials.

---

### Neo4j MCP Server

**Port:** 8002 (HTTP wrapper) / 8003 (native MCP)  
**Source:** `mcp-neo4j/src/http_wrapper.py`, `mcp-neo4j/src/mcp_neo4j_cypher/__init__.py`

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEO4J_URI` | Optional | `bolt://localhost:7687` | Neo4j Bolt connection URI. Also read as `NEO4J_URL`. |
| `NEO4J_USERNAME` | Optional | `neo4j` | Neo4j database user. |
| `NEO4J_PASSWORD` | Optional | `password` | Neo4j database password. |
| `NEO4J_DATABASE` | Optional | `neo4j` | Target Neo4j database name. |
| `NEO4J_TRANSPORT` | Optional | `stdio` | MCP transport mode. Set to `http` for containerised use. |
| `NEO4J_MCP_SERVER_HOST` | Optional | `127.0.0.1` | Host interface to bind to. Set to `0.0.0.0` in Docker. |
| `NEO4J_MCP_SERVER_PORT` | Optional | `8002` | HTTP server port (for `http` transport mode). |
| `NEO4J_MCP_SERVER_PATH` | Optional | `/mcp/` | URL path for the MCP endpoint (native MCP mode). |
| `NEO4J_MCP_MODE` | Optional | — | Set to `http-wrapper` for the REST API mode or `mcp-server` for native MCP protocol. |
| `NEO4J_NAMESPACE` | Optional | `""` | Optional prefix namespace for tool names. |

---

### Keycloak

**Port:** 8080  
**Image:** `quay.io/keycloak/keycloak:24.0`

| Variable | Required | Default | Description |
|---|---|---|---|
| `KEYCLOAK_ADMIN` | Optional | `admin` | Admin console username. |
| `KEYCLOAK_ADMIN_PASSWORD` | Optional | `admin` | Admin console password. Change before any production use. |
| `KC_DB` | Set by Compose | `postgres` | Database backend type. |
| `KC_DB_URL` | Set by Compose | `jdbc:postgresql://postgres:5432/keycloak` | JDBC URL for the Keycloak PostgreSQL database. |
| `KC_DB_USERNAME` | Set by Compose | `keycloak` | Database user. |
| `KC_DB_PASSWORD` | Set by Compose | `keycloak` | Database password. |
| `KC_HOSTNAME_STRICT` | Set by Compose | `false` | Disable strict hostname validation (development only). |
| `KC_HTTP_ENABLED` | Set by Compose | `true` | Enable plain HTTP (development only; use HTTPS in production). |

---

### Neo4j

**Ports:** 7474 (HTTP browser) / 7687 (Bolt)  
**Image:** `neo4j:5.15`

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEO4J_AUTH` | Optional | `neo4j/password` | Combined `user/password` credential string. |
| `NEO4J_PLUGINS` | Optional | `["apoc", "graph-data-science"]` | JSON array of plugins to enable. |
| `NEO4J_ACCEPT_LICENSE_AGREEMENT` | Set by Compose | `yes` | Required to enable the Graph Data Science plugin. |

---

### PostgreSQL

**Port:** 5432  
**Image:** `postgres:13-alpine`

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_DB` | Optional | `keycloak` | Database name. |
| `POSTGRES_USER` | Optional | `keycloak` | Database user. |
| `POSTGRES_PASSWORD` | Optional | `keycloak` | Database password. Change before any production use. |

---

### Redis

**Port:** 6379  
**Image:** `redis:7.2-alpine`

Redis has no application-level environment variables. Docker Compose starts it with:

```
redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

Persistence is enabled via append-only file (AOF). The eviction policy is `allkeys-lru` with a 256 MB cap.

---

## LLM Provider Selection

The AI Gateway supports four LLM providers controlled by `LLM_PROVIDER`. The gateway validates at startup that the required API key or base URL for the selected provider is present and will exit with an error if it is missing.

### Provider defaults

| Provider | `LLM_PROVIDER` value | Required credential | Default model |
|---|---|---|---|
| Anthropic Claude | `anthropic` | `ANTHROPIC_API_KEY` | `claude-opus-4-1-20250805` |
| Google Gemini | `gemini` | `GEMINI_API_KEY` | `gemini-2.5-pro` |
| OpenAI | `openai` | `OPENAI_API_KEY` | `gpt-4-turbo` |
| Ollama (local) | `ollama` | None (no key needed) | `llama3` |

### Selecting a provider

Set `LLM_PROVIDER` in your `.env` file (or Docker Compose environment) before starting the stack:

```bash
# Use Anthropic Claude (default)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Use Google Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...

# Use OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Use a locally running Ollama instance
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```

### Overriding the model

Use `LLM_MODEL` to select any model ID supported by the active provider. For Anthropic specifically, `ANTHROPIC_MODEL` takes precedence over `LLM_MODEL`:

```bash
# Available Anthropic models
ANTHROPIC_MODEL=claude-opus-4-1-20250805   # Default – superior reasoning
ANTHROPIC_MODEL=claude-sonnet-4-20250514   # Faster, balanced performance
ANTHROPIC_MODEL=claude-3-sonnet-20240229   # Legacy support
```

### Switching providers at runtime

The AI Gateway exposes a model-switching API that does not require a restart:

```bash
# List available models and current selection
curl http://localhost:8005/api/models

# Switch to Gemini without restarting
curl -X POST http://localhost:8005/api/models/switch \
  -H "Content-Type: application/json" \
  -d '{"provider": "gemini"}'
```

### Ollama-specific variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | URL of the Ollama HTTP API. |
| `OLLAMA_KEEP_ALIVE` | `5m` | How long Ollama keeps the model loaded between requests. |
| `OLLAMA_NUM_PREDICT` | `8192` | Maximum tokens for Ollama to generate. |
| `OLLAMA_STREAM` | `false` | Enable streaming responses from Ollama. |

---

## Docker Compose Profiles

The stack uses two Docker Compose files located in `docker/`:

| File | Purpose |
|---|---|
| `docker/docker-compose.dev.yml` | Primary development stack. Defines all services. |
| `docker/docker-compose.dev-hotreload.yml` | Override file that enables source-mounted hot-reload for the AI Gateway. |

### Default profile (no profile flag)

Starting without a profile runs all services except `ai-gateway-hot`:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

This starts: `postgres`, `keycloak`, `neo4j`, `redis`, `keycloak-mcp`, `neo4j-mcp`, `neo4j-mcp-native`, `ai-gateway`, `websocket-server`.

### `hot-reload` profile

The `ai-gateway-hot` service is gated behind the `hot-reload` profile. It mounts `ai-gateway/src/` into the container so TypeScript changes are picked up without rebuilding the image.

```bash
# Start the full stack with hot-reload AI Gateway
docker compose -f docker/docker-compose.dev.yml --profile hot-reload up -d
```

`ai-gateway` and `ai-gateway-hot` both bind port 8005. They are mutually exclusive — do not start both at the same time.

### Using the hotreload override file

The `docker-compose.dev-hotreload.yml` override provides an alternative to the profile approach and also mounts test files:

```bash
docker compose \
  -f docker/docker-compose.dev.yml \
  -f docker/docker-compose.dev-hotreload.yml \
  up ai-gateway
```

This override additionally:
- Sets `TSX_WATCH=true` to enable `tsx --watch` mode
- Sets `DEBUG=ikas:*`
- Mounts `ai-gateway/.env` and `ai-gateway/.env.development` from the host

### Neo4j MCP modes

The compose file defines two Neo4j MCP containers:

| Service | Port | `NEO4J_MCP_MODE` | Use case |
|---|---|---|---|
| `neo4j-mcp` | 8002 | `http-wrapper` | Used by the AI Gateway. Provides a plain REST API over the MCP tools. |
| `neo4j-mcp-native` | 8003 | `mcp-server` | For external MCP clients (e.g., Claude Desktop) that speak the native MCP protocol. |

---

## Development vs. Production Differences

### Development (default)

- `NODE_ENV=development` on all Node.js services.
- Keycloak runs with `start-dev` command: no TLS, no strict hostname checks.
- CORS origins include all localhost ports.
- Redis eviction is handled gracefully (256 MB cap, LRU policy).
- AI Gateway `DEBUG=ikas:*` in hot-reload mode.
- API keys fall back to placeholder defaults in `.env.example`; these must be replaced with real keys.
- AI Gateway port in config.ts defaults to `8000`; Docker Compose overrides to `8005`.

### Production considerations

The following changes are recommended for production deployment. None are configured automatically — they require explicit environment variable changes.

| Area | Change required |
|---|---|
| **Keycloak** | Remove `KC_HOSTNAME_STRICT=false` and `KC_HTTP_ENABLED=true`; configure TLS. Change `KEYCLOAK_ADMIN_PASSWORD` to a strong secret. |
| **PostgreSQL** | Change `POSTGRES_PASSWORD` to a strong secret stored in a secret manager. |
| **Neo4j** | Change `NEO4J_AUTH` password. Disable APOC file import (`NEO4J_apoc_import_file_enabled=false`). |
| **AI Gateway CORS** | Set `CORS_ORIGINS` to only the production frontend domain. |
| **LLM API keys** | Store `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` in the deployment platform's secret manager, not in `.env` files. <!-- VERIFY: confirm secret manager used in production deployment --> |
| **Redis** | Consider enabling Redis AUTH password and TLS for production. <!-- VERIFY: Redis AUTH and TLS configuration for production environment --> |
| **Frontend URLs** | Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to production hostnames before building the Next.js image. |
| **WebSocket CORS** | Set `CORS_ORIGIN` to the production frontend URL only. |

---

## Advanced / Optional Variables

The following variables appear in source or Docker Compose but are not in `.env.example`. They can be set in `.env` to override defaults.

| Variable | Service | Default | Description |
|---|---|---|---|
| `LOG_LEVEL` | websocket-server, root env | `info` | Winston log level. Set `debug` for verbose output. |
| `VOICE_LANGUAGE` | root env | `de-DE` | Browser speech recognition locale (note: app hotword is English-based). |
| `VOICE_HOTWORD` | root env | `Hey Keycloak` | Hotword string for browser-side detection. |
| `DEMO_MODE` | root env | `false` | Enable demo mode for presentations. |
| `CACHE_DEMO_RESPONSES` | root env | `false` | Cache LLM responses during demo. |
| `PROMETHEUS_PORT` | root env | `9090` | Reserved port for future Prometheus integration. <!-- VERIFY: Prometheus integration is listed as future work in .env.example --> |
| `GRAFANA_PORT` | root env | `3000` | Reserved port for future Grafana integration. <!-- VERIFY: Grafana integration is listed as future work in .env.example --> |
| `JAEGER_PORT` | root env | `16686` | Reserved port for future Jaeger tracing integration. <!-- VERIFY: Jaeger integration is listed as future work in .env.example --> |
| `NEO4J_NAMESPACE` | mcp-neo4j | `""` | Prefix added to all tool names when registering with the MCP server. |
| `WEBSOCKET_SERVER_URL` | ai-gateway | `http://localhost:3001` | URL the AI Gateway uses to notify the WebSocket server of events. |
