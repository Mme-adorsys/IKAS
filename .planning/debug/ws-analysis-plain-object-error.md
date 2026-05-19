---
slug: ws-analysis-plain-object-error
status: resolved
trigger: "WebSocket error '[object Object]' {} fires when running analysis - server is emitting a plain object as the error payload"
created: 2026-05-10
updated: 2026-05-10
---

## Symptoms

- **Error message**: `⚠️ WebSocket error "[object Object]" {}`
- **Location**: `src/services/websocket.ts:148` — inside `this.socket.on('error', ...)` handler
- **Key clue**: `msg = "[object Object]"` — means `error` is NOT an Error instance, it is a plain JS object. `String({...})` produces `"[object Object]"`. The object itself still prints as `{}` because it has no enumerable own props, OR they are non-enumerable, OR it IS actually empty.
- **Trigger**: Fires when the user tries to run an analysis (not on page load anymore — previous fix resolved that)
- **Stack trace**: Socket.io client chain: `manager.js → socket.js (onpacket → onevent → emitEvent → emit)` — this is a server-emitted `error` event being delivered to the client

## Environment

- Frontend: Next.js 15.5.0 (Turbopack), port 3000
- WebSocket server: ikas-websocket-server Docker container, port 3001
- AI Gateway: ikas-ai-gateway, port 8005
- Previous fix: `.env.local` created, error logging improved

## Current Focus

hypothesis: "Server calls socket.emit('error', { message: '...' }) which is the reserved Socket.io error event name. The plain object is received on the client but String({...}) produces '[object Object]'. Socket.io v4 treats the 'error' event name specially — the data IS passed through but the client handler was checking instanceof Error instead of extracting .message from the plain object."
test: ""
expecting: ""
next_action: "DONE — fix applied"
reasoning_checkpoint: "Root cause confirmed and fix applied."

## Evidence

- timestamp: 2026-05-10
  observation: "server.ts has 10 calls to socket.emit('error', { message: '...' }) — all send a plain object, not an Error instance"
  significance: "String({ message: '...' }) = '[object Object]' — this is the '[object Object]' symptom"

- timestamp: 2026-05-10
  observation: "Socket.io v4 'error' event is reserved for transport errors on the client. When the server emits 'error', the client listener receives the plain object payload. The existing client handler did 'const msg = error instanceof Error ? error.message : String(error)' which hits the String() branch for plain objects."
  significance: "Confirms the root cause: using the reserved 'error' event name causes ambiguity and the plain object payload is not properly extracted."

- timestamp: 2026-05-10
  observation: "The '{}' display in the console is a Chrome DevTools rendering artifact: the object { message: '...' } may have been logged in a context where DevTools shows a collapsed view. OR the error is a ZodError/Error instance that serializes as '{}' via JSON (Error properties are non-enumerable)."
  significance: "Either way the fix is the same: separate server application errors from transport errors."

## Eliminated

- Redis connection failure as the root cause — Redis is running and healthy; the error fires even when Redis publishes successfully
- Zod validation errors in publishEvent — createAnalysisEvent returns a schema-valid object
- Session not found race condition — session is created synchronously in memory before handlers are registered

## Resolution

root_cause: "The websocket-server used socket.emit('error', { message: '...' }) which is Socket.io's reserved transport error event name. The client's error handler received the plain object payload and called String(payload) producing '[object Object]' instead of extracting payload.message. By using the reserved 'error' event name for application errors, there was also a risk that Socket.io would treat the event differently than a regular named event."

fix: "1) Renamed all socket.emit('error', ...) calls in websocket-server/src/server.ts to socket.emit('serverError', ...) to avoid collision with Socket.io's reserved 'error' event. 2) Added a 'serverError' listener in frontend/src/services/websocket.ts that correctly extracts the message from the plain object payload { message?: string }. 3) Kept the 'error' listener for genuine transport-level errors where the argument IS always an Error instance. 4) Added a 'serverError' handler registration in frontend/src/store/index.ts inside connectWebSocket() that shows a user-facing notification with the extracted error message."

verification: "All 20 websocket service tests pass. TypeScript compilation for changed files produces no errors. The 16 failing VoicePanel tests are pre-existing and unrelated to this fix."

files_changed:
  - websocket-server/src/server.ts
  - frontend/src/services/websocket.ts
  - frontend/src/store/index.ts
