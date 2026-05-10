# Codebase Concerns

## Overview

Technical debt, known bugs, security gaps, performance bottlenecks, and fragile areas identified in the IKAS codebase.

---

## Tech Debt

### State Management
- **Monolithic Zustand store** (`frontend/src/store/`) — 873 lines mixing 8 unrelated state domains (chat, websocket, voice, graph, config, ui, events, session). Should be split into domain slices.
- **Unbounded event history** in frontend state — no pagination or cap on accumulated events causes memory growth over long sessions.

### Type Safety
- **Weak typing in WebSocket services** — multiple `any` types in `websocket-server/` and frontend WebSocket clients suppress TypeScript's value for catching errors.
- **Incomplete error type checking** — `catch (e)` blocks assume `e instanceof Error` but don't guard against non-Error throws.

### Component Design
- **Oversized dashboard components** (`frontend/src/components/`) — 300+ line components mixing data fetching, state management, and rendering. Violates single responsibility.
- **Overly complex service implementations** — `ai-gateway/` Orchestrator and Gemini service files are difficult to follow and test due to mixed concerns.

---

## Known Bugs

### Protocol Validation
- **WebSocket URL validation** (`websocket-server/`) — accepts `http://` and `https://` URLs but the runtime expects `ws://`/`wss://` protocols. Produces confusing runtime errors.

### Event Handling
- **Missing default event handlers** — some WebSocket event paths have no fallback handler, causing silent event loss when unexpected message types arrive.

### CORS Configuration
- **Hardcoded CORS fallback** (`ai-gateway/`) — development-only origin list is used as a fallback; production domains are missing from the hardcoded list.

---

## Security Gaps

### Secrets & Logging
- **API key exposure risk** — configuration error logging in `ai-gateway/` may print environment variables (including API keys) to stdout in verbose error modes.

### Input Validation
- **Missing input validation on MCP tool calls** (`keycloak-mcp-server/`, `mcp-neo4j/`) — tool arguments are passed through without sanitization before being used in queries or API calls.

### Web Security
- **No CSRF protection** on the chat endpoint (`ai-gateway/`).
- **No rate limiting** on any endpoints — all services (`ai-gateway/`, `websocket-server/`, `keycloak-mcp-server/`) accept unlimited requests.

---

## Performance Bottlenecks

### Hot Path Inefficiencies
- **Health check on every chat request** (`ai-gateway/`) — external service health is re-checked per request with no caching or TTL. Adds latency to every message.
- **No tool definition caching** in MCP servers — tool definitions are regenerated on each request despite being static.

### Memory Growth
- **Unbounded event history** in frontend Zustand store — events accumulate with no eviction policy, growing indefinitely in long sessions.

### Algorithmic Risks
- **Infinite loop potential in Gemini function calling** (`ai-gateway/`) — no iteration limit on the function call loop. A misbehaving model or tool could spin indefinitely.

---

## Fragile Areas

### Browser Compatibility
- **Voice recognition** (`frontend/`) — uses `webkitSpeechRecognition` with no fallback for unsupported browsers. Fails silently in Firefox and non-Chromium browsers.

### Database
- **Cypher query generation without validation** (`mcp-neo4j/`) — natural language is converted to Cypher and executed directly without a validation or safety layer.

### Connection Management
- **WebSocket reconnection without state consistency** — reconnect logic in the frontend does not re-sync state, leading to potential desync between client and server views.
- **Session management with no timeout enforcement** — sessions can persist indefinitely with no server-side expiry.

---

## Test Coverage Gaps

| Area | Gap |
|------|-----|
| `ai-gateway/` chat endpoint | Zero integration tests |
| `mcp-neo4j/` | No tests for Neo4j sync operations |
| `websocket-server/` | No WebSocket event handler tests |
| All services | No load testing or performance benchmarks |
| Frontend | No E2E tests for core chat flows |

---

## Priority Summary

| Priority | Item |
|----------|------|
| High | Rate limiting on all HTTP endpoints |
| High | Input validation on MCP tool call arguments |
| High | Fix WebSocket URL protocol validation |
| High | Infinite loop guard in Gemini function calling |
| Medium | Split monolithic Zustand store |
| Medium | Cache health checks and tool definitions |
| Medium | CSRF protection on chat endpoint |
| Low | Voice recognition browser fallback |
| Low | Break up oversized dashboard components |
