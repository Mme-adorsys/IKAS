# LLM Cost Optimization — Task Brief

> Claude Code task: fix the identified LLM cost drivers in the AI Gateway.
> All changes are in `ai-gateway/src/`. Run build gates after each fix.

---

## Context

The system uses `claude-opus-4-1-20250805` (most expensive Anthropic model) for all operations.
Five root causes have been identified that multiply token costs significantly.
Fix them in the order listed — each is independent unless noted.

---

## Fix 1 — `isAvailable()` must not make real API calls

**File:** `ai-gateway/src/llm/anthropic-service.ts`

**Problem:**
`isAvailable()` creates a real `messages.create` call to verify the service is alive.
This method is called:
- On every `GET /api/models` → `LLMFactory.getAvailableProviders()` loops all 4 providers → 4 real API calls on every page load
- On every `POST /api/models/switch` (line ~458 in orchestration.ts)

```typescript
// CURRENT — costs money on every call
async isAvailable(): Promise<boolean> {
  const testMessage = await this.client.messages.create({
    model: this.model,
    max_tokens: 10,
    messages: [{ role: 'user', content: 'test' }]
  });
  return testMessage && testMessage.content && testMessage.content.length > 0;
}
```

**Fix:**
Replace with a lightweight check that only verifies the API key is present and the client was initialized successfully. Do NOT make a network call.

```typescript
async isAvailable(): Promise<boolean> {
  return !!(config.ANTHROPIC_API_KEY && this.client);
}
```

Apply the same pattern to `GeminiService.isAvailable()` in `gemini-service.ts` — check for API key presence only, no network call.

Also fix `LLMFactory.getAvailableProviders()` in `llm-factory.ts`:
Currently it instantiates every provider and calls `isAvailable()` on each.
After the fix above this is safe, but also add a try/catch so a missing API key just skips the provider rather than throwing.

---

## Fix 2 — Trim MCP tool results before storing in chat history

**File:** `ai-gateway/src/llm/anthropic-service.ts`

**Problem:**
Full MCP responses (e.g. a `list-users` returning 100 users, or a Neo4j graph dump) are stored verbatim in chat history as pretty-printed JSON.
Every subsequent message in the same session resends all previous tool results as input tokens.

```typescript
// CURRENT — pretty-prints entire MCP response into history
content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
```

**Fix:**
1. Replace `JSON.stringify(result, null, 2)` with `JSON.stringify(result)` everywhere (compact, not pretty-printed).
2. Add a helper that truncates tool result content before it enters history:

```typescript
private truncateToolResult(result: any, maxChars = 2000): string {
  const serialized = typeof result === 'string' ? result : JSON.stringify(result);
  if (serialized.length <= maxChars) return serialized;
  return serialized.substring(0, maxChars) + `... [truncated, ${serialized.length} chars total]`;
}
```

Use this helper when building `toolResults` in `processFunctionCalls()`.

3. Reduce `maxHistoryLength` from `20` to `10`:
```typescript
private readonly maxHistoryLength = 10;
```

Also lower the hard reset threshold from `> 20` to `> 10` accordingly.

---

## Fix 3 — Remove hardcoded `max_tokens: 8192` in `processFunctionCalls`

**File:** `ai-gateway/src/llm/anthropic-service.ts`

**Problem:**
The continuation call after tool execution has `max_tokens` hardcoded to 8192 with no way to override:

```typescript
// CURRENT — line ~296, hardcoded
const continueResponse = await this.client.messages.create({
  model: this.model,
  max_tokens: 8192,
  ...
```

**Fix:**
Use the configured value instead:

```typescript
const continueResponse = await this.client.messages.create({
  model: this.model,
  max_tokens: config.LLM_MAX_TOKENS || 4096,
  ...
```

Also change the default in `config.ts`:
```typescript
LLM_MAX_TOKENS: z.coerce.number().min(1).max(200000).default(4096), // was 8192
```

---

## Fix 4 — Change default model to Sonnet 4

**File:** `ai-gateway/src/utils/config.ts`

**Problem:**
The default model is `claude-opus-4-1-20250805` — the most expensive Anthropic model.
Opus is 3–5× more expensive than Sonnet 4 per token.
For the majority of IKAS operations (list users, sync, routine queries) Sonnet 4 is sufficient.

**Fix:**
Change the default in `getDefaultModel()`:

```typescript
// CURRENT
'anthropic': 'claude-opus-4-1-20250805',

// CHANGE TO
'anthropic': 'claude-sonnet-4-20250514',
```

Also update `AnthropicService` constructor fallback (line ~61):
```typescript
// CURRENT
this.model = 'claude-opus-4-1-20250805';

// CHANGE TO
this.model = 'claude-sonnet-4-20250514';
```

Keep Opus available as an option in `getAvailableAnthropicModels()` — just don't default to it.

---

## Fix 5 — Reduce max function call iterations

**File:** `ai-gateway/src/orchestration/orchestrator.ts`

**Problem:**
The safety limit is 10 iterations. Each iteration is a full LLM API call with the complete message history.
For a session at message #15, with large tool results in history, 10 iterations = potentially 150,000+ input tokens for a single user command.

**Fix:**
Lower the default from 10 to 5:

```typescript
// CURRENT
let maxIterations = parseInt(process.env.MAX_FUNCTION_ITERATIONS || '10');

// CHANGE TO
let maxIterations = parseInt(process.env.MAX_FUNCTION_ITERATIONS || '5');
```

---

## Fix 6 — Shorten the system prompt

**File:** `ai-gateway/src/llm/anthropic-service.ts`

**Problem:**
`buildSystemMessage()` returns ~95 lines of XML-structured text (~2000 tokens).
This is sent on every single API call including continuation calls after tool execution —
meaning a 3-tool-call workflow sends the system prompt 4 times total.

**Fix:**
Replace with a compact version (~25 lines, ~400 tokens). The key information Claude needs is:
role, available tools by name, and critical constraints. The verbose workflow descriptions are redundant
because Claude already knows how to use tools.

```typescript
private buildSystemMessage(): string {
  return `You are IKAS, an AI assistant for Keycloak identity management and Neo4j graph operations.

TOOLS AVAILABLE:
Keycloak: create-user, delete-user, list-users, list-realms, list-admin-events, get-event-details, list-user-events, get-metrics
Neo4j: get_neo4j_schema, read_neo4j_cypher, write_neo4j_cypher

RULES:
- Call tools sequentially as needed to complete requests
- For sync operations: fetch from Keycloak first, then write to Neo4j with valid Cypher
- Always include a complete 'query' parameter when calling write_neo4j_cypher
- Respond concisely — summaries over verbose output`;
}
```

---

## Fix 7 — Add Redis caching for repeated tool calls

**File:** `ai-gateway/src/orchestration/orchestrator.ts` (new helper) + `ai-gateway/src/mcp/client.ts`

**Problem:**
Identical tool calls (e.g. `list-users` called twice in the same session, or health checks)
always hit the MCP servers and return full results that are then sent to the LLM.
Redis is already in the stack and configured.

**Fix:**
Add a simple TTL cache around MCP tool call results in `executeFunctionCall()`.
Cache key: `ikas:tool:{toolName}:{sha256(args)}`.
TTL by tool type:
- `list-users`, `list-realms`: 60 seconds
- `get-metrics`: 30 seconds
- `read_neo4j_cypher`: 120 seconds
- Write operations (`create-user`, `delete-user`, `write_neo4j_cypher`): never cache

Use the existing Redis client from config. If Redis is unavailable, fall through to the direct call (don't throw).

---

## Build Verification Gates

After all fixes, run:

```bash
cd ai-gateway && npm run build
cd frontend && npm run type-check && npm run lint && npm run test
./docker/health-check.sh
```

All gates must pass. Verify in logs that `isAvailable` no longer appears as an API call entry.

---

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| API calls on page load | 4 (one per provider) | 0 |
| Input tokens per chat message (session >5 turns) | ~8,000–30,000 | ~2,000–5,000 |
| Default model cost multiplier | 1× (Opus) | 0.2× (Sonnet 4) |
| Max API calls per user command | 10 | 5 |
| System prompt size | ~2,000 tokens | ~400 tokens |

Combined estimated cost reduction: **80–90%** for typical usage patterns.
