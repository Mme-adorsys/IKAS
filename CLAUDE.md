# CLAUDE.md — IKAS (Intelligentes Keycloak Admin System)

> Intelligent Keycloak administration via English voice commands, multi-LLM orchestration, and Neo4j graph analytics.

## Project Overview

IKAS manages Keycloak instances through natural language. Key components:

- **AI Gateway** (port 8005) — Multi-LLM orchestration (Anthropic Claude & Google Gemini) with MCP tool calling
- **WebSocket Server** (port 3001) — Real-time voice/event hub via Socket.io + Redis
- **Frontend** (port 3002) — Next.js dashboard with "Hey IKAS" voice activation
- **Keycloak MCP** (port 8001) — 8 admin tools: `create-user`, `delete-user`, `list-users`, `list-realms`, `list-admin-events`, `get-event-details`, `list-user-events`, `get-metrics`
- **Neo4j MCP** (port 8002) — 3 graph tools: `get_neo4j_schema`, `read_neo4j_cypher`, `write_neo4j_cypher`

**Quick start:** `./scripts/start-dev.sh`  
**Frontend:** `cd frontend && npm run dev`  
**AI Gateway:** `cd ai-gateway && npm run dev`  
**Logs:** `docker exec ikas-ai-gateway-hot tail -f logs/combined.log`

**Environment:** Copy `.env.example` to `.env`. Required: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LLM_PROVIDER` (anthropic|gemini).

---

## Hindsight Memory Integration

### Memory Bank Configuration
- **Bank ID**: `ikas`
- **Operations**: `recall` (retrieve), `retain` (store), `reflect` (deep analysis)

### Session Protocol

**On Session Start** — Load context:
```
recall(bank_id="ikas", query="current task progress decisions problems")
recall(bank_id="ikas", query="recent decisions patterns problems solutions")
recall(bank_id="ikas", query="preferences code_style workflow conventions")
```

**Before Implementation** — Check for prior knowledge:
```
recall(bank_id="ikas", query="[task-area] pattern solution approach best_practice")
recall(bank_id="ikas", query="[task-area] error problem anti_pattern avoid")
```

**After Task Completion** — Save learnings:
```
retain(bank_id="ikas", content="Task: [what]. Approach: [how]. Result: [outcome]. Key decisions: [why].", context="experience")
```

**On Error** — Check memory before fixing:
```
recall(bank_id="ikas", query="[error keywords] fix solution workaround")
```

**After Fix** — Save solution:
```
retain(bank_id="ikas", content="Error: [message]. Cause: [root cause]. Fix: [solution]. Prevention: [how to avoid].", context="error")
```

### Build Verification Gates

Before marking any task as done:

```bash
cd frontend && npm run type-check && npm run lint && npm run test
cd ai-gateway && npm run build
cd websocket-server && npm run build
./docker/health-check.sh
```

All gates must pass. Fix before proceeding.

---

## Epic Workflow

### Working Through the Backlog

Epics are in `docs/engram/backlog/` and must be worked **sequentially** (Epic 01 → 02 → ... → 15).

**For each Epic:**
1. Read `epic-NN-*/epic.md` for scope, dependencies, and acceptance criteria
2. Work stories sequentially within the epic
3. For each story, work tasks as the embedded checklist

**For each Task:**
1. Load memory context: `recall(bank_id="ikas", query="[task keywords]")`
2. Read the relevant source files
3. Implement the change
4. Run Build Verification Gates
5. Update the task checkbox in the story file
6. Save learnings: `retain(bank_id="ikas", ...)`

**For each Story completion:**
1. All tasks checked off
2. Build Verification Gates pass
3. Update story status in `epic.md`

**For each Epic completion:**
1. All stories done
2. Run Milestone acceptance criteria tests (see `milestones.md`)
3. Update epic status in `epic-overview.md`
4. Run `/milestone-check` if this completes a phase

---

## Key Conventions

### TypeScript / Node.js
- TypeScript throughout; `const` over `let`, no `var`
- `async/await` over raw promises; always wrap in `try/catch`
- Imports: external first, then internal
- JSDoc on all public APIs

### Git
- Branch: `feature/IKAS-[feature-name]`
- Commits: `feat(IKAS): [component] - [description]`
- Small, atomic commits

### Security
- Never log sensitive data (tokens, passwords)
- Validate all user inputs
- Use environment variables for secrets — never hardcode

### Project Management
Trello board: **IKAS** (GTD). See `docs/gtd_board_guide.md`. Card naming: `[IKAS:AREA-##:TYPE]`.
