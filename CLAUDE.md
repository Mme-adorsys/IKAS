# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in the IKAS (Intelligentes Keycloak Admin System) repository.

## Project Overview: IKAS

IKAS is an intelligent administrative system for Keycloak that revolutionizes instance management through:

- **Natural Language Processing**: Voice commands in German ("Hey Keycloak")
- **AI-Powered Decision Making**: Google Gemini LLM with function calling
- **Knowledge Graph Analytics**: Neo4j for relationship analysis and pattern detection  
- **Automated Compliance**: Security checks and governance monitoring
- **Existing MCP Integration**: Leverages pre-built Keycloak and Neo4j MCP servers

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   AI Gateway    │    │  MCP Services   │
│  (Next.js/TS)   │◄──►│  (FastAPI/Py)   │◄──►│ Keycloak + Neo4j│
│                 │    │                 │    │                 │
│ • Voice UI      │    │ • LLM Orchestr. │    │ • Admin Tools   │
│ • WebSocket     │    │ • Tool Discovery│    │ • Graph Queries │
│ • Graph Viz     │    │ • Smart Routing │    │ • Event Monitor │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Timeline & Milestones

- **Total Duration**: 12 weeks to MVP for Amsterdam demo
- **Team Size**: 2-3 developers (reduced from original plan)
- **Key Advantage**: 5 weeks saved by leveraging existing MCPs
- **Current Status**: ✅ Phase 0 Complete - Foundation Ready

### Phase Status Overview
- **✅ Phase 0** (Week 1): MCP Integration & Foundation - **COMPLETED**
- **🚧 Phase 1** (Weeks 2-4): Intelligence Layer with AI Gateway - **NEXT**
- **⏳ Phase 2** (Weeks 5-7): Voice Interface & Real-time WebSocket
- **⏳ Phase 3** (Weeks 8-10): Frontend Development
- **⏳ Phase 4** (Weeks 11-12): Integration & Amsterdam Demo Prep

## Project Management via Trello

This project uses a **Getting Things Done (GTD)** methodology implemented through Trello for comprehensive task and project management. The GTD system ensures stress-free productivity by capturing, clarifying, organizing, reflecting, and engaging with work systematically.

**Board Name:** IKAS

### GTD Workflow Integration

**Core Lists:**
- **📥 Inbox/Capture**: Universal catch-all for everything new
- **🔍 Project Planning**: Multi-step projects requiring breakdown
- **⚡ Next Actions**: Immediately actionable tasks (heart of GTD)
- **🔄 In Progress**: Currently active work (WIP limited)
- **⏳ Waiting For**: Dependencies and blocked items
- **🧪 Testing/Review**: Completed work awaiting validation
- **🚀 Ready to Deploy**: Tested items ready for production
- **✅ Done**: Completed work for tracking and metrics
- **💡 Someday/Maybe**: Future ideas and potential projects

### Project Hierarchy System

**4-Level Structure:**
```
📁 [PROJECT-ID] - Project Name
  ├── 🎯 [PROJECT-ID:M#] - Milestone Name
  │   ├── 📋 [PROJECT-ID:AREA-##] - Story/Epic Name
  │   │   ├── ⚙️ [PROJECT-ID:AREA-##:TYPE] - Task Name
```

**Example Hierarchy:**
```
[CRM-REDESIGN] - Customer Portal Enhancement Project
├── [CRM-REDESIGN:M1] - Authentication System
│   ├── [CRM-REDESIGN:AUTH-01] - OAuth2 Integration
│   │   ├── [CRM-REDESIGN:AUTH-01:DEV] - Code OAuth2 Service
│   │   ├── [CRM-REDESIGN:AUTH-01:TEST] - Write OAuth2 Tests
│   │   └── [CRM-REDESIGN:AUTH-01:DOC] - Document OAuth2 Setup
```

### Claude Code Prompt System

Each task card includes a "Prompt" custom field with structured instructions for Claude Code:

**Prompt Template Structure:**
```
CONTEXT:
- Project: [PROJECT-ID] - [Project Name]
- Component: [Area/Service/Module]
- Architecture: [Tech Stack/Framework]
- Environment: [Development/Testing/Production]

TASK:
[Clear, specific task with measurable outcome]

REQUIREMENTS:
Functional:
- [Specific functional requirements]
Non-Functional:
- Performance: [Metrics and benchmarks]
- Security: [Security requirements]
- Compatibility: [Platform/API compatibility]

TECHNICAL SPECIFICATIONS:
- Language/Framework: [Specific technology]
- Dependencies: [Required libraries/services]
- API Contracts: [Input/Output specifications]
- Database Schema: [If applicable]

FILE STRUCTURE:
Expected files to create/modify:
- src/[path]/[filename.ext]
- tests/[path]/[test-filename.ext]
- docs/[path]/[documentation.md]

DEFINITION OF DONE:
- [ ] Implementation completed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Code review ready
- [ ] Performance benchmarks met

VCS WORKFLOW:
Branch Management:
- [ ] Create feature branch: feature/[PROJECT-ID]-[feature-name]
- [ ] Follow GitFlow branching strategy
- [ ] Keep branch up-to-date with develop

Commit Strategy:
- [ ] Atomic commits with clear scope
- [ ] Conventional commit format
feat([PROJECT-ID]): [component] - [description]

[Detailed description]
Closes: [PROJECT-ID]-[task-number]
Co-authored-by: [Name] <email@domain.com>
```

### Daily & Weekly GTD Workflows

**Daily Workflow (10 minutes):**
1. **Morning**: Check Inbox → Review Next Actions → Update In Progress → Check Waiting For
2. **During Work**: Capture everything in Inbox → Work from Next Actions by context
3. **End of Day**: Update progress → Move completed items → Plan tomorrow's priorities

**Weekly Review (45 minutes):**
1. **Collect & Process (15 min)**: Empty Inbox completely → Process each item
2. **Review & Update (15 min)**: Review Waiting For → Update In Progress → Review Project Planning
3. **Plan & Prioritize (10 min)**: Review Someday/Maybe → Plan next week → Ensure Next Actions has work
4. **Metrics & Reflection (5 min)**: Count completions → Identify patterns → Note improvements

### Integration with Development

**Task-to-Code Workflow:**
1. Tasks created with detailed prompts in Trello
2. Claude Code uses prompts for consistent implementation
3. Progress tracked through GTD workflow states
4. Completion triggers automatic updates to parent cards

**Cross-Reference System:**
- All cards link to parent/child cards via URLs
- Checklists track sub-item completion
- Custom fields track project metadata
- Labels enable filtered views and automation

# Additional Instructions
- @docs/gtd_board_guide.md

## Coding Guidelines

### General Principles
- Write clean, readable, and maintainable code
- Follow the principle of least surprise
- Use descriptive names for variables, functions, and classes
- Keep functions small and focused on a single responsibility

### TypeScript/JavaScript Standards
- Use TypeScript for type safety
- Prefer const over let, avoid var
- Use arrow functions for callbacks and short functions
- Always handle errors appropriately with try-catch blocks
- Use async/await instead of promises when possible

### Code Organization
- Group related functionality together
- Use meaningful file and directory names
- Keep imports organized (external first, then internal)
- Export only what needs to be used elsewhere

### Documentation
- Write JSDoc comments for public APIs
- Include examples in documentation when helpful
- Keep README files up to date
- Document complex business logic with inline comments

### Testing
- Write unit tests for all business logic
- Use descriptive test names that explain what is being tested
- Test both happy path and error cases
- Maintain good test coverage

### Git Practices
- Write clear, descriptive commit messages
- Make small, focused commits
- Use branches for features and bug fixes
- Review code before merging

### Error Handling
- Always handle errors gracefully
- Provide meaningful error messages to users
- Log errors with sufficient context for debugging
- Use appropriate error types and status codes

### Performance
- Avoid unnecessary computations in loops
- Cache expensive operations when appropriate
- Use pagination for large data sets
- Optimize database queries

### Security
- Never expose sensitive information in logs
- Validate all user inputs
- Use secure authentication and authorization
- Keep dependencies up to date

## IKAS Project Structure

This is the development repository for IKAS containing:

### ✅ Phase 0 - Completed Components
- **keycloak-mcp-server/**: Node.js/TypeScript MCP server for Keycloak administration (✅ Tested & Documented)
- **mcp-neo4j/**: Python MCP server for Neo4j database interactions (✅ Tested & Documented)
- **shared-types/**: TypeScript interfaces and schemas (✅ Complete with 11 interface files)
- **docker/**: Container orchestration and development environment (✅ Working with health checks)
- **docs/**: Complete architecture documentation and implementation plan (✅ Ready)
- **tests/**: Integration tests for MCP servers (✅ Automated testing)

### 🚧 Phase 1-4 - Next Development Phases
- **ai-gateway/**: FastAPI Python service for LLM orchestration and MCP coordination
- **frontend/**: Next.js/TypeScript web application with voice interface
- **websocket-server/**: Real-time communication service

### 📊 Available MCP Tools (Documented & Tested)
**Keycloak MCP** (8 tools): create-user, delete-user, list-users, list-realms, list-admin-events, get-event-details, list-user-events, get-metrics

**Neo4j MCP** (3 tools): get_neo4j_schema, read_neo4j_cypher, write_neo4j_cypher

## IKAS Development Commands

### ✅ Phase 0: Foundation Setup (COMPLETED)
```bash
# Quick Start - All services in one command
./scripts/start-dev.sh  # Starts everything with health checks

# Individual service management
docker-compose -f docker/docker-compose.dev.yml up -d  # Start all services
./docker/health-check.sh  # Verify all services healthy
node tests/mcp-integration-test.js  # Test MCP integration

# Manual setup (if needed)
cd keycloak-mcp-server/ && npm install && npm run build
cd mcp-neo4j/ && uv sync  # or pip install requirements
```

### 🚧 Phase 1: AI Gateway Development (NEXT - Weeks 2-4)
```bash
# Step 1: Create AI Gateway structure
mkdir -p ai-gateway/src/{orchestration,llm,mcp,api}
cd ai-gateway/

# Step 2: Initialize Python project with dependencies
uv init
uv add fastapi uvicorn google-generativeai websockets redis pydantic structlog

# Step 3: Environment setup
export GEMINI_API_KEY="your-google-gemini-key"
export REDIS_URL="redis://localhost:6379"
export KEYCLOAK_MCP_URL="http://localhost:8001"
export NEO4J_MCP_URL="http://localhost:8002"

# Step 4: Start development server
uv run uvicorn src.main:app --reload --port 8000

# Available tools after Phase 0
# - All MCP tools documented and tested
# - Shared TypeScript interfaces ready
# - Docker environment operational
```

### Phase 2: Frontend Development  
```bash
# Create Next.js frontend
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend/

# Add IKAS dependencies
npm install @types/speech-recognition socket.io-client zustand d3 @types/d3

# Start development
npm run dev  # Port 3000
```

### Phase 3: Integration Testing
```bash
# Full stack development
docker-compose -f docker/docker-compose.dev.yml up -d

# Run end-to-end tests
cd e2e-tests/
npx playwright test
```

## IKAS Architecture Details

### 1. Keycloak MCP Server (Existing ✅)
- **Framework**: @modelcontextprotocol/sdk + @keycloak/keycloak-admin-client
- **Capabilities**: User management, realm administration, event monitoring
- **Environment**: KEYCLOAK_URL, KEYCLOAK_ADMIN, KEYCLOAK_ADMIN_PASSWORD
- **Key Tools**: create-user, list-users, list-admin-events, get-metrics
- **Entry Point**: `src/index.ts`

### 2. Neo4j MCP Server (Existing ✅)  
- **Framework**: FastMCP + Neo4j Python driver
- **Capabilities**: Cypher execution (read/write), schema inspection
- **Transport**: stdio, http, sse modes
- **Environment**: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
- **Key Tools**: get_neo4j_schema, query_read, query_write
- **Entry Point**: `src/mcp_neo4j_cypher/server.py`

### 3. AI Gateway (To Build 🚧)
- **Framework**: FastAPI + Google Gemini LLM
- **Purpose**: Orchestrate between LLM and MCP services
- **Key Features**: 
  - Dynamic MCP tool discovery
  - Intelligent routing (fresh data vs. cached analysis)
  - Function calling with context management
  - Error recovery and fallback strategies

### 4. Frontend (To Build 🚧)
- **Framework**: Next.js 14 + TypeScript + Tailwind
- **Key Features**:
  - Voice activation with "Hey Keycloak" hotword
  - WebSocket real-time updates
  - D3.js graph visualization
  - Responsive dashboard with dark mode

### 5. WebSocket Server (To Build 🚧)
- **Framework**: Socket.io + Redis pub/sub  
- **Purpose**: Real-time updates for graph changes and analysis progress
- **Events**: graph:update, analysis:progress, compliance:alert

## IKAS Configuration

### Environment Variables

```bash
# Phase 0: MCP Services
# Keycloak MCP
export KEYCLOAK_URL="http://localhost:8080"
export KEYCLOAK_ADMIN="admin"
export KEYCLOAK_ADMIN_PASSWORD="admin"

# Neo4j MCP  
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USERNAME="neo4j"
export NEO4J_PASSWORD="password"
export NEO4J_DATABASE="neo4j"

# Phase 1: AI Gateway
export GEMINI_API_KEY="your-google-gemini-key"
export REDIS_URL="redis://localhost:6379"
export KEYCLOAK_MCP_URL="http://localhost:8001"
export NEO4J_MCP_URL="http://localhost:8002"

# Phase 2: Frontend
export NEXT_PUBLIC_API_URL="http://localhost:8000"
export NEXT_PUBLIC_WS_URL="http://localhost:3001"
```

### Docker Development Environment

```yaml
# docker/docker-compose.dev.yml
version: '3.8'
services:
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    ports: ["8080:8080"]
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    command: start-dev
    
  neo4j:
    image: neo4j:5.15
    ports: ["7474:7474", "7687:7687"]
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
      
  redis:
    image: redis:7.2-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes
```

## IKAS Testing Strategy

### Phase 0: MCP Integration Tests
```bash
# Test Keycloak MCP
cd keycloak-mcp-server/
npm test

# Test Neo4j MCP  
cd mcp-neo4j/
uv run pytest tests/integration/ -v  # Uses testcontainers
```

### Phase 1: AI Gateway Tests
```bash
# Unit tests for orchestration logic
cd ai-gateway/
uv run pytest tests/unit/ -v

# Integration tests with mock MCPs
uv run pytest tests/integration/ -v
```

### Phase 2: Frontend Tests
```bash
# Component tests
cd frontend/
npm run test

# E2E voice interface testing
npx playwright test tests/voice-commands.spec.ts
```

### Phase 3: Full System Tests
```bash
# End-to-end scenarios
cd e2e-tests/
npm run test:scenarios  # Demo scenarios testing
```

### Amsterdam Demo Test Scenarios

1. **"Hey Keycloak, zeige alle Benutzer"** - Voice activation and user listing
2. **"Analysiere die Compliance"** - Multi-MCP orchestration  
3. **"Finde doppelte Benutzer"** - Graph analysis with real-time visualization
4. **System Health Check** - All components operational with fallback modes

## Critical Implementation Notes

### MCP Orchestration Strategy
The AI Gateway must intelligently route requests:

```python
# Example decision logic
def determine_data_source(intent: str) -> str:
    if "current" in intent or "latest" in intent:
        return "keycloak_direct"  # Fresh data
    elif "analyze" in intent or "pattern" in intent:
        return "neo4j_analysis"  # Historical analysis
    else:
        return "both_coordinated"  # Sync then analyze
```

### Voice Command Processing
German language support with fallback:

```typescript
// Web Speech API with German locale
const recognition = new SpeechRecognition();
recognition.lang = 'de-DE';
recognition.continuous = false;
recognition.interimResults = false;
```

### Real-time Graph Updates
WebSocket events for live visualization:

```typescript
// Frontend graph update handling  
socket.on('graph:update', (data) => {
  d3GraphViz.updateNodes(data.nodes);
  d3GraphViz.updateEdges(data.relationships);
});
```

## MCP Orchestration Guidelines

### Core Orchestration Principles

The AI Gateway serves as the intelligent coordinator between LLM and MCP services. Follow these patterns for consistent implementation:

#### 1. Dynamic Tool Discovery
```python
# ai-gateway/src/mcp/discovery.py
class MCPToolDiscovery:
    async def discover_all_tools(self) -> Dict[str, List[ToolDefinition]]:
        """Dynamically discover tools from all MCP servers"""
        tools = {}
        
        # Keycloak MCP tools
        keycloak_tools = await self.keycloak_mcp.list_tools()
        tools['keycloak'] = [
            self.enhance_tool_description(tool, 'keycloak')
            for tool in keycloak_tools
        ]
        
        # Neo4j MCP tools  
        neo4j_tools = await self.neo4j_mcp.list_tools()
        tools['neo4j'] = [
            self.enhance_tool_description(tool, 'neo4j')
            for tool in neo4j_tools
        ]
        
        return tools
    
    def enhance_tool_description(self, tool: ToolDefinition, source: str) -> ToolDefinition:
        """Add context hints to help LLM make better routing decisions"""
        enhancements = {
            'keycloak': {
                'list-users': tool.description + " Use for current live user data from Keycloak.",
                'list-admin-events': tool.description + " Use for recent administrative actions and audit trails.",
            },
            'neo4j': {
                'query_read': tool.description + " Use for pattern analysis, relationship queries, and historical data analysis.",
                'get_neo4j_schema': tool.description + " Use to understand data structure before writing complex queries.",
            }
        }
        
        enhanced_desc = enhancements.get(source, {}).get(tool.name, tool.description)
        return ToolDefinition(name=f"{source}_{tool.name}", description=enhanced_desc, inputSchema=tool.inputSchema)
```

#### 2. Intelligent Routing Strategy
```python
# ai-gateway/src/orchestration/routing.py
class IntelligentRouter:
    def __init__(self):
        self.freshness_threshold = 30  # minutes
        self.patterns = {
            'fresh_data_keywords': ['aktuell', 'current', 'latest', 'jetzt', 'live'],
            'analysis_keywords': ['analysiere', 'analyze', 'finde', 'pattern', 'duplikat', 'muster', 'statistik'],
            'write_keywords': ['erstelle', 'create', 'lösche', 'delete', 'update', 'ändere']
        }
    
    async def determine_execution_strategy(self, user_input: str) -> ExecutionStrategy:
        """Determine the optimal routing strategy based on user intent"""
        
        user_lower = user_input.lower()
        
        # Check for write operations (always route to Keycloak first)
        if any(keyword in user_lower for keyword in self.patterns['write_keywords']):
            return ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC
        
        # Check for fresh data requirements
        elif any(keyword in user_lower for keyword in self.patterns['fresh_data_keywords']):
            return ExecutionStrategy.KEYCLOAK_FRESH_DATA
        
        # Check for analysis requirements
        elif any(keyword in user_lower for keyword in self.patterns['analysis_keywords']):
            freshness = await self.check_graph_data_freshness()
            if freshness.needs_refresh:
                return ExecutionStrategy.SYNC_THEN_ANALYZE
            else:
                return ExecutionStrategy.NEO4J_ANALYSIS_ONLY
        
        # Default: coordinated approach
        else:
            return ExecutionStrategy.COORDINATED_MULTI_MCP
```

#### 3. Data Synchronization Patterns
```python
# ai-gateway/src/orchestration/sync.py
class DataSynchronizer:
    async def sync_keycloak_to_neo4j(self, realm: str = "master", force: bool = False) -> SyncResult:
        """Intelligently sync data from Keycloak to Neo4j"""
        
        # Check if sync is needed
        if not force:
            freshness = await self.check_freshness(realm)
            if not freshness.needs_refresh:
                return SyncResult(skipped=True, reason="Data is fresh")
        
        try:
            # Fetch users from Keycloak
            users_result = await self.keycloak_mcp.call_tool("list-users", {"realm": realm})
            users = users_result.data
            
            # Fetch roles and groups if needed
            roles_result = await self.keycloak_mcp.call_tool("list-roles", {"realm": realm})
            
            # Create comprehensive sync query
            sync_query = """
            // Clear existing data for this realm
            MATCH (n:User {realm: $realm}) DETACH DELETE n
            
            // Import users
            UNWIND $users as userData
            CREATE (u:User {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                enabled: userData.enabled,
                realm: $realm,
                lastSync: datetime()
            })
            
            // Update sync metadata
            MERGE (m:Metadata {type: 'sync', realm: $realm})
            SET m.lastUpdated = datetime(),
                m.userCount = size($users),
                m.syncVersion = randomUUID()
            """
            
            # Execute sync
            await self.neo4j_mcp.call_tool("query_write", {
                "query": sync_query,
                "parameters": {
                    "realm": realm,
                    "users": users
                }
            })
            
            return SyncResult(success=True, records_synced=len(users))
            
        except Exception as e:
            logger.error(f"Sync failed: {str(e)}")
            return SyncResult(success=False, error=str(e))
```

#### 4. Error Recovery and Circuit Breakers
```python
# ai-gateway/src/orchestration/resilience.py
from circuit_breaker import CircuitBreaker

class ResilientOrchestrator:
    def __init__(self):
        # Circuit breakers for each MCP
        self.keycloak_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=30,
            expected_exception=HttpError
        )
        
        self.neo4j_breaker = CircuitBreaker(
            failure_threshold=3,
            recovery_timeout=60,
            expected_exception=Neo4jError
        )
    
    @self.keycloak_breaker
    async def call_keycloak_tool(self, tool_name: str, args: dict) -> MCPResponse:
        """Call Keycloak MCP with circuit breaker protection"""
        return await self.keycloak_mcp.call_tool(tool_name, args)
    
    @self.neo4j_breaker  
    async def call_neo4j_tool(self, tool_name: str, args: dict) -> MCPResponse:
        """Call Neo4j MCP with circuit breaker protection"""
        return await self.neo4j_mcp.call_tool(tool_name, args)
    
    async def execute_with_fallback(self, primary_call, fallback_call=None):
        """Execute primary call with optional fallback"""
        try:
            return await primary_call()
        except CircuitBreakerOpenException:
            if fallback_call:
                logger.warning("Primary service unavailable, using fallback")
                return await fallback_call()
            else:
                raise ServiceUnavailableException("Primary service down, no fallback available")
```

#### 5. Caching and Performance Optimization
```python
# ai-gateway/src/orchestration/cache.py
class IntelligentCache:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl_config = {
            'user_data': 300,      # 5 minutes
            'compliance_results': 1800,  # 30 minutes  
            'graph_analysis': 3600,      # 1 hour
            'system_metrics': 60         # 1 minute
        }
    
    async def get_or_execute(self, cache_key: str, cache_type: str, executor_func) -> Any:
        """Get from cache or execute function and cache result"""
        
        # Try cache first
        cached_result = await self.redis.get(cache_key)
        if cached_result:
            return json.loads(cached_result)
        
        # Execute and cache
        result = await executor_func()
        ttl = self.ttl_config.get(cache_type, 300)
        
        await self.redis.setex(
            cache_key, 
            ttl, 
            json.dumps(result, default=str)
        )
        
        return result
    
    def generate_cache_key(self, operation: str, params: dict) -> str:
        """Generate consistent cache keys"""
        param_hash = hashlib.md5(
            json.dumps(params, sort_keys=True).encode()
        ).hexdigest()[:8]
        
        return f"ikas:{operation}:{param_hash}"
```

### Best Practices for MCP Integration

1. **Always Use Type-Safe Interfaces**
   ```python
   from pydantic import BaseModel
   
   class MCPToolCall(BaseModel):
       server: Literal['keycloak', 'neo4j']
       tool: str
       arguments: Dict[str, Any]
       context: Optional[Dict[str, Any]] = None
   
   class MCPResponse(BaseModel):
       success: bool
       data: Optional[Any] = None
       error: Optional[str] = None
       metadata: Optional[Dict[str, Any]] = None
   ```

2. **Implement Comprehensive Logging**
   ```python
   import structlog
   
   logger = structlog.get_logger()
   
   async def orchestrate_request(request: OrchestrationRequest) -> OrchestrationResponse:
       logger.info(
           "orchestration_started",
           user_input=request.user_input,
           session_id=request.session_id,
           strategy=request.strategy
       )
       
       try:
           result = await self.execute_strategy(request)
           
           logger.info(
               "orchestration_completed",
               session_id=request.session_id,
               duration=result.duration,
               tools_called=result.tools_called
           )
           
           return result
           
       except Exception as e:
           logger.error(
               "orchestration_failed", 
               session_id=request.session_id,
               error=str(e),
               exc_info=True
           )
           raise
   ```

3. **Monitor Performance Metrics**
   ```python
   from prometheus_client import Counter, Histogram, Gauge
   
   # Metrics
   mcp_calls_total = Counter('ikas_mcp_calls_total', 'Total MCP calls', ['server', 'tool', 'status'])
   mcp_duration = Histogram('ikas_mcp_duration_seconds', 'MCP call duration', ['server', 'tool'])
   active_sessions = Gauge('ikas_active_sessions', 'Number of active user sessions')
   
   async def call_mcp_with_metrics(self, server: str, tool: str, args: dict):
       start_time = time.time()
       
       try:
           result = await self.call_mcp(server, tool, args)
           mcp_calls_total.labels(server=server, tool=tool, status='success').inc()
           return result
           
       except Exception as e:
           mcp_calls_total.labels(server=server, tool=tool, status='error').inc()
           raise
           
       finally:
           duration = time.time() - start_time
           mcp_duration.labels(server=server, tool=tool).observe(duration)
   ```

## ✅ Phase 0 Completion Status

### What's Ready Now
The foundation is complete and tested. You can immediately start Phase 1 development with:

1. **Working Development Environment**: 
   - All services (Keycloak, Neo4j, Redis, PostgreSQL) operational
   - Health checks and monitoring in place
   - One-command startup with `./scripts/start-dev.sh`

2. **MCP Integration Tested**:
   - 8 Keycloak tools available and documented
   - 3 Neo4j tools available and documented  
   - Integration tests verify connectivity
   - Tool schemas and examples ready

3. **Development Infrastructure**:
   - TypeScript shared types with 6 interface files
   - Docker orchestration with health monitoring
   - Automated testing and health verification
   - Complete documentation and implementation plan

4. **Ready Access URLs** (after running `./scripts/start-dev.sh`):
   - Keycloak: http://localhost:8080 (admin/admin)
   - Neo4j: http://localhost:7474 (neo4j/password)
   - PostgreSQL: localhost:5432 (keycloak/keycloak)
   - Redis: localhost:6379

### Next Phase Priority Tasks

#### Week 2 - AI Gateway Foundation
1. **FastAPI Setup**: Create basic AI Gateway with health endpoints
2. **MCP Client Library**: Implement HTTP clients for both MCP servers
3. **Google Gemini Integration**: Setup LLM with function calling
4. **Dynamic Tool Discovery**: Auto-detect and map MCP tools to Gemini functions

#### Week 3 - Intelligent Orchestration  
1. **Routing Logic**: Implement smart decision engine for MCP selection
2. **Data Freshness**: Build caching and sync strategies
3. **Error Recovery**: Add circuit breakers and fallback mechanisms
4. **Performance**: Implement Redis caching and connection pooling

#### Week 4 - Integration Testing
1. **End-to-End**: Test complete user input → LLM → MCP → response flow
2. **Load Testing**: Verify performance under concurrent requests
3. **Demo Preparation**: Implement basic demo scenarios for voice commands

### Critical Files for Phase 1

```bash
# Phase 1 will create these key files:
ai-gateway/
├── src/
│   ├── main.py                 # FastAPI application
│   ├── orchestration/
│   │   ├── orchestrator.py     # Main orchestration logic
│   │   ├── routing.py          # Intelligent MCP selection
│   │   └── sync.py             # Data synchronization
│   ├── llm/
│   │   ├── gemini_service.py   # Google Gemini integration
│   │   └── tool_discovery.py   # Dynamic MCP tool mapping
│   ├── mcp/
│   │   ├── client.py           # Base MCP client
│   │   ├── keycloak_client.py  # Keycloak MCP wrapper
│   │   └── neo4j_client.py     # Neo4j MCP wrapper
│   └── api/
│       ├── routes.py           # REST endpoints
│       └── websocket.py        # WebSocket handlers
├── tests/
│   ├── test_orchestration.py
│   ├── test_mcp_clients.py
│   └── test_integration.py
└── pyproject.toml
```

### Success Metrics for Phase 1
- ✅ AI Gateway responding to HTTP requests
- ✅ All 11 MCP tools discovered and mapped to Gemini functions  
- ✅ Basic voice command processing: "Hey Keycloak, zeige alle Benutzer"
- ✅ Data freshness checks and intelligent routing working
- ✅ Error handling and recovery mechanisms in place
- ✅ Performance: <3 second response time for basic queries
