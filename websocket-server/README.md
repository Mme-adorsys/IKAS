<!-- generated-by: gsd-doc-writer -->
# ikas-websocket-server

Real-time communication hub for IKAS. Manages Socket.io connections, session state, Redis pub/sub event distribution, and forwards voice/text commands to the AI Gateway for LLM processing.

Part of the [IKAS monorepo](../README.md).

---

## Purpose

This service is the central real-time relay between the IKAS frontend and the AI Gateway. When a user issues a voice or text command, it arrives here first via WebSocket, gets published to Redis, and is forwarded to the AI Gateway (`/api/chat`) for orchestration. Responses from the AI Gateway are published back through Redis and distributed to the correct connected clients.

Key responsibilities:
- Maintain per-client session state backed by Redis
- Accept voice commands (`voiceCommand`) and text commands (`textCommand`) and forward them to the AI Gateway on port 8005
- Accept analysis requests (`startAnalysis`) and emit progress/completion events back to clients
- Distribute server-side events (user changes, compliance alerts, graph updates) to subscribed clients
- Perform periodic health checks every 30 seconds and broadcast status to monitoring subscribers

---

## Quick Start

**Prerequisites:** Node.js >= 18.0.0, Redis running on `localhost:6379`, AI Gateway running on `localhost:8005`.

```bash
# Install dependencies
npm install

# Development (hot reload via tsx)
npm run dev

# Production
npm run build
npm start
```

The server listens on port **3001** by default.

Health endpoint: `GET http://localhost:3001/health`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `3001` | Port the HTTP/WebSocket server binds to |
| `REDIS_URL` | Optional | `redis://localhost:6379` | ioredis connection string |
| `CORS_ORIGIN` | Optional | `http://localhost:3000,http://localhost:3002` | Comma-separated list of allowed origins |
| `CORS_CREDENTIALS` | Optional | `false` | Set to `true` to allow credentialed cross-origin requests |
| `SESSION_TIMEOUT` | Optional | `3600000` | Session idle timeout in milliseconds (default 1 hour) |
| `AI_GATEWAY_URL` | Optional | `http://localhost:8005` | Base URL for the AI Gateway service |
| `LOG_LEVEL` | Optional | `info` | Winston log level (`debug`, `info`, `warn`, `error`) |

Create a `.env` file at this directory's root to override any of these for local development.

---

## Socket.io Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `voiceCommand` | `{ command, transcript, confidence? }` | Submit a voice command; forwarded to AI Gateway `/api/chat` |
| `textCommand` | `{ message, sessionId? }` | Submit a text command; processed identically to voice commands |
| `startAnalysis` | `{ analysisType, parameters? }` | Start an analysis job (`user_patterns`, `compliance_check`, `security_audit`, `usage_statistics`) |
| `subscribe` | `{ eventTypes, room?, filters? }` | Subscribe to specific event types or a room |
| `unsubscribe` | `{ eventTypes, room? }` | Cancel a subscription |
| `joinRoom` | `{ room }` | Join a named Socket.io room |
| `leaveRoom` | `{ room }` | Leave a named Socket.io room |
| `ping` | _(none)_ | Heartbeat — server replies with `pong` |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `connected` | `{ sessionId, timestamp, message }` | Sent immediately after connection is established |
| `voiceCommandReceived` | `{ eventId, timestamp }` | Acknowledgment that a voice command was accepted |
| `textCommandReceived` | `{ eventId, timestamp }` | Acknowledgment that a text command was accepted |
| `analysisStarted` | `{ analysisId, type, timestamp }` | Confirms analysis job has begun |
| `subscriptionConfirmed` | `{ eventTypes, room, timestamp }` | Confirms a subscription was registered |
| `unsubscriptionConfirmed` | `{ eventTypes, room, timestamp }` | Confirms a subscription was removed |
| `roomJoined` | `{ room, timestamp }` | Confirms room join |
| `roomLeft` | `{ room, timestamp }` | Confirms room leave |
| `pong` | `{ timestamp }` | Response to a client `ping` |
| `event` | `IKASEvent` | Pushed event from Redis (see Event Types below) |
| `serverError` | `{ message }` | Indicates a server-side processing error |

---

## Event Types

All events on the `event` channel conform to the `IKASEvent` union type defined in `src/types/events.ts`. Each event carries `id` (UUID), `type`, `timestamp`, `sessionId`, and an event-specific `payload`.

| Category | Event Types |
|---|---|
| Voice | `voice:command`, `voice:response`, `voice:error` |
| Analysis | `analysis:started`, `analysis:progress`, `analysis:completed` |
| User Management | `user:created`, `user:updated`, `user:deleted` |
| Graph | `graph:update`, `pattern:detected` |
| Compliance | `compliance:check`, `compliance:alert`, `compliance:report` |
| Session | `session:started`, `session:ended`, `session:timeout` |
| System | `connection:status`, `heartbeat`, `error:occurred` |

---

## Architecture

```
Frontend (port 3002)
       │ Socket.io
       ▼
WebSocket Server (port 3001)
  ├── SessionManager (Redis-backed session state)
  ├── EventPublisher  ──► Redis pub/sub channel
  ├── EventSubscriber ◄── Redis pub/sub channel
  └── EventHandlers (distributes events to subscribers)
       │ HTTP POST /api/chat
       ▼
AI Gateway (port 8005)
```

On each `voiceCommand` or `textCommand`:
1. A `voice:command` event is published to Redis via `EventPublisher`.
2. An HTTP request is sent to `AI_GATEWAY_URL/api/chat` with `{ message, sessionId, source }`.
3. The AI Gateway response is packaged as a `voice:response` event and published back to Redis.
4. `EventSubscriber` receives the event and `EventHandlers` routes it to the originating client socket.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with hot reload using `tsx watch` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output from `dist/server.js` |
| `npm test` | Run Jest test suite |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run lint` | ESLint check on `src/` |
| `npm run lint:fix` | ESLint auto-fix on `src/` |

---

## License

MIT
