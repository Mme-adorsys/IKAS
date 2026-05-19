---
slug: websocket-error-on-analysis
status: root_cause_found
trigger: "WebSocket error {} fires immediately on page load when trying to run analysis"
created: 2026-05-10
updated: 2026-05-10
---

## Symptoms

- **Error message**: `⚠️ WebSocket error {}`
- **Location**: `src/services/websocket.ts:147:19` — inside `this.socket.on('error', ...)` handler
- **Error object**: Empty `{}` — the Socket.io error event emitted an empty/opaque object
- **Trigger**: Fires immediately on page load (not just on analysis action)
- **Expected**: Analysis runs and results appear in the UI
- **History**: First time running everything together — never worked end-to-end

## Environment

- Frontend: Next.js 15.5.0 (Turbopack), port 3000
- WebSocket server: ikas-websocket-server, port 3001
- AI Gateway: ikas-ai-gateway, port 8005

## Current Focus

hypothesis: "The empty WebSocket error {} on page load is caused by the Socket.io client receiving a server-emitted 'error' event during session creation because the WebSocket server's Redis subscriber (EventSubscriber) fails to subscribe, OR by a CORS mismatch between the server's CORS_CREDENTIALS=false (default) and the client not sending credentials. The primary root cause is the NEXT_PUBLIC_WS_URL is never loaded into the frontend because there is no .env.local in the frontend directory — the .env file at the project root is not read by Next.js, so the WebSocket service falls back to 'ws://localhost:3001' (ws:// protocol) while Socket.io connects over HTTP/polling. However the deeper driver of the empty {} error object is that Socket.io's 'error' event fires with a non-serializable Error object that JSON.stringify collapses to {}."
test: ""
expecting: "After creating frontend/.env.local with NEXT_PUBLIC_WS_URL=http://localhost:3001 and NEXT_PUBLIC_API_URL=http://localhost:8005, the connection should succeed. The error logging should also be fixed to show the error message."
next_action: "Apply fix"
reasoning_checkpoint: "Two compounding issues confirmed: (1) Next.js only reads NEXT_PUBLIC_ vars from .env.local / .env in the frontend directory — the root .env is not picked up by the frontend dev server, so the fallback is 'ws://localhost:3001' (wrong protocol string that is still accepted by isValidWebSocketUrl). (2) The socket.on('error') handler logs `error` directly — Socket.io error objects are Error instances, and console.error with an Error prints {} for the object part when the error has no enumerable properties, making the log misleading."

## Evidence

- timestamp: 2026-05-10T00:00:00Z
  finding: "frontend/.env.local does not exist. The root .env has NEXT_PUBLIC_WS_URL=http://localhost:3001 but Next.js only picks up NEXT_PUBLIC_ vars from env files inside the frontend/ directory."
  file: "/Users/vishwangdave/Work/IKAS/IKAS/frontend"
  impact: "websocketService.url falls back to the hardcoded 'ws://localhost:3001' in the constructor. isValidWebSocketUrl accepts ws: protocol, so no validation error. Socket.io still connects over polling/websocket to that URL. This means NEXT_PUBLIC_WS_URL from root .env is silently ignored."

- timestamp: 2026-05-10T00:01:00Z
  finding: "socket.on('error') handler at websocket.ts:146-149 calls console.error('⚠️ WebSocket error', error). Socket.io fires the 'error' event with an Error instance. Error objects have no enumerable own properties, so console.error logs them as {}. The actual message is accessible via error.message but is never extracted."
  file: "/Users/vishwangdave/Work/IKAS/IKAS/frontend/src/services/websocket.ts:146"
  impact: "The error appears as empty {} in console, masking the real reason (likely CORS or connection refused)."

- timestamp: 2026-05-10T00:02:00Z
  finding: "CORS_CREDENTIALS in docker-compose is not set (defaults to false per server.ts line 42: process.env.CORS_CREDENTIALS === 'true'). Socket.io client uses transports: ['websocket', 'polling'] with no credentials option. This is consistent — credentials are not required here."
  file: "/Users/vishwangdave/Work/IKAS/IKAS/docker/docker-compose.dev.yml:268"
  impact: "Not the root cause, but worth noting CORS_ORIGIN includes http://localhost:3000 which is correct for the frontend."

- timestamp: 2026-05-10T00:03:00Z
  finding: "IKASDashboard.tsx calls connectWebSocket('dashboard-user','master') on every mount inside useEffect with [initializeServices, connectWebSocket] as deps. These are Zustand store methods and are stable references, so this fires once. If the WebSocket connect() rejects (throws), isInitialized stays false and the loading spinner never resolves."
  file: "/Users/vishwangdave/Work/IKAS/IKAS/frontend/src/components/dashboard/IKASDashboard.tsx:32-52"
  impact: "If the WS connection fails at all, the entire dashboard stays stuck on the loading screen."

## Eliminated

- Redis being down: All containers including ikas-redis show healthy
- Port 3001 being unreachable: Docker reports ikas-websocket-server healthy with 1 connection (proving TCP is reachable)
- CORS origin mismatch: docker-compose CORS_ORIGIN includes http://localhost:3000

## Resolution

root_cause: "Two issues compound: (1) The frontend has no .env.local file so Next.js never loads NEXT_PUBLIC_WS_URL from the root .env — the WebSocket service falls back to 'ws://localhost:3001' (ws:// protocol) which may cause a protocol negotiation issue with Socket.io expecting http://. (2) The socket.on('error') handler logs the Error object directly which JSON-serializes to {} since Error has no enumerable properties, completely hiding the real error message."
fix: "Create frontend/.env.local with the correct NEXT_PUBLIC_ vars, and fix the error handler to log error.message explicitly."
verification: ""
files_changed:
  - /Users/vishwangdave/Work/IKAS/IKAS/frontend/.env.local
  - /Users/vishwangdave/Work/IKAS/IKAS/frontend/src/services/websocket.ts
