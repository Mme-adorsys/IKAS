# IKAS Implementierungsplan (Angepasste Version)
## Mit existierenden Keycloak MCP & Neo4j MCP

### 📋 Projekt-Übersicht (AKTUALISIERT)
- **Zeitrahmen:** 12 Wochen bis MVP (statt 16)
- **Team:** 2-3 Entwickler (statt 3-5)
- **Fokus:** AI Gateway, Orchestration & Frontend
- **Existierende Komponenten:**
    - ✅ Keycloak MCP (bereits vorhanden)
    - ✅ Neo4j MCP (neo4j-contrib/mcp-neo4j-cypher)

---

## 🎯 Phase 0: Projekt-Setup & MCP Integration (Woche 1)
### Milestone 0: MCPs Integrated & Running

#### Epic: MCP Integration
**Story 1: Existierende MCPs Setup**
- **Priorität:** P0 (Blocker)
- **Story Points:** 8
- **Akzeptanzkriterien:**
    - Keycloak MCP läuft und ist konfiguriert
    - Neo4j MCP installiert und verbunden
    - Beide MCPs via MCP Protocol erreichbar

**Tasks:**
- [ ] Task 1.1: Keycloak MCP Konfiguration (2h)
  ```bash
  # Existing Keycloak MCP setup
  # Configure connection parameters
  # Test basic operations
  ```
- [ ] Task 1.2: Neo4j MCP Installation (2h)
  ```bash
  npm install @neo4j-contrib/mcp-neo4j-cypher
  # Configure Neo4j connection
  # Test Cypher queries
  ```
- [ ] Task 1.3: MCP Protocol Testing (3h)
    - Test tool definitions
    - Validate responses
    - Document available functions
- [ ] Task 1.4: Docker Compose für Development (2h)
  ```yaml
  services:
    keycloak:
      image: quay.io/keycloak/keycloak:24.0
    neo4j:
      image: neo4j:5.15
      environment:
        - NEO4J_PLUGINS=["apoc", "gds"]
  ```
- [ ] Task 1.5: MCP Interface Documentation (2h)
    - Document available tools
    - Create TypeScript interfaces
    - Define request/response types

**Story 2: Development Environment**
- **Priorität:** P0
- **Story Points:** 5
- **Akzeptanzkriterien:**
    - Monorepo structure ready
    - TypeScript configured
    - Build pipeline works

**Tasks:**
- [ ] Task 2.1: Nx Workspace Setup (2h)
  ```bash
  npx create-nx-workspace@latest ikas --preset=ts
  ```
- [ ] Task 2.2: Project Structure (2h)
  ```
  ikas/
  ├── apps/
  │   ├── frontend/        # Next.js
  │   └── ai-gateway/      # NestJS
  ├── libs/
  │   ├── shared-types/    # TypeScript interfaces
  │   └── mcp-client/      # MCP Protocol client
  └── tools/
  ```
- [ ] Task 2.3: TypeScript Configuration (1h)
- [ ] Task 2.4: ESLint & Prettier Setup (1h)

---

## 🤖 Phase 1: Intelligence Layer (Woche 2-4)
### Milestone 1: AI Gateway with MCP Orchestration

#### Epic: MCP Client Library
**Story 3: TypeScript MCP Client**
- **Priorität:** P0
- **Story Points:** 13
- **Akzeptanzkriterien:**
    - MCP Protocol client implemented
    - Can communicate with both MCPs
    - Type-safe interfaces

**Tasks:**
- [ ] Task 3.1: MCP Protocol Implementation (5h)
  ```typescript
  // libs/mcp-client/src/mcp-client.ts
  export class MCPClient {
    async callTool(server: string, tool: string, args: any): Promise<any>
    async listTools(server: string): Promise<ToolDefinition[]>
  }
  ```
- [ ] Task 3.2: Keycloak MCP Client Wrapper (3h)
  ```typescript
  export class KeycloakMCPClient extends MCPClient {
    async getUsers(realm?: string)
    async getRoles(realm?: string)
    async checkCompliance(userId: string)
  }
  ```
- [ ] Task 3.3: Neo4j MCP Client Wrapper (3h)
  ```typescript
  export class Neo4jMCPClient extends MCPClient {
    async executeCypher(query: string, params?: any)
    async importData(nodes: any[], relationships: any[])
    async findPatterns(patternType: string)
  }
  ```
- [ ] Task 3.4: Error Handling & Retry Logic (2h)
- [ ] Task 3.5: Connection Pool Management (2h)
- [ ] Task 3.6: Unit Tests (3h)

#### Epic: AI Gateway Core
**Story 4: NestJS AI Gateway Setup**
- **Priorität:** P0
- **Story Points:** 8
- **Akzeptanzkriterien:**
    - NestJS application running
    - REST endpoints defined
    - WebSocket support

**Tasks:**
- [ ] Task 4.1: NestJS Bootstrap (2h)
  ```bash
  nest new ai-gateway
  npm install @nestjs/websockets socket.io
  ```
- [ ] Task 4.2: Module Structure (2h)
  ```
  ai-gateway/
  ├── orchestration/
  ├── llm/
  ├── voice/
  └── websocket/
  ```
- [ ] Task 4.3: Health Checks & Monitoring (2h)
- [ ] Task 4.4: Configuration Management (1h)
- [ ] Task 4.5: Logging Setup (1h)

**Story 5: LLM Integration with MCP Tools**
- **Priorität:** P0
- **Story Points:** 21
- **Akzeptanzkriterien:**
    - Gemini integrated with function calling
    - MCP tools dynamically discovered and exposed to LLM
    - Orchestration logic working

**Tasks:**
- [ ] Task 5.1: Gemini SDK Setup (2h)
  ```typescript
  npm install @google/generative-ai
  ```
- [ ] Task 5.2: Dynamic Tool Discovery & Mapping (4h)
  ```typescript
  // Dynamically fetch tool definitions from MCPs
  async function discoverMCPTools() {
    const keycloakTools = await keycloakMCP.listTools();
    const neo4jTools = await neo4jMCP.listTools();
    
    // Transform MCP tools to Gemini function calling format
    return [
      ...keycloakTools.map(tool => ({
        name: `keycloak_${tool.name}`,
        description: enrichDescription(tool.description),
        parameters: tool.inputSchema
      })),
      ...neo4jTools.map(tool => ({
        name: `neo4j_${tool.name}`,
        description: enrichDescription(tool.description),
        parameters: tool.inputSchema
      }))
    ];
  }
  ```
- [ ] Task 5.3: Orchestration Service (6h)
  ```typescript
  @Injectable()
  export class OrchestrationService {
    private availableTools: any[] = [];
    
    async onModuleInit() {
      // Discover tools on startup
      this.availableTools = await this.discoverAllTools();
    }
    
    async processIntent(input: string) {
      // 1. Pass discovered tools to LLM
      const llmResponse = await this.gemini.generateContent({
        prompt: input,
        tools: this.availableTools
      });
      
      // 2. Route LLM decisions to correct MCP
      for (const toolCall of llmResponse.functionCalls) {
        if (toolCall.name.startsWith('keycloak_')) {
          await this.keycloakMCP.callTool(
            toolCall.name.replace('keycloak_', ''),
            toolCall.args
          );
        } else if (toolCall.name.startsWith('neo4j_')) {
          await this.neo4jMCP.callTool(
            toolCall.name.replace('neo4j_', ''),
            toolCall.args
          );
        }
      }
    }
  }
  ```
- [ ] Task 5.4: Tool Description Enhancement (4h)
  ```typescript
  // Add context to help LLM make better decisions
  function enrichDescription(originalDesc: string, toolName: string): string {
    const enrichments = {
      // Help LLM understand when to use which tool
      'get_users': originalDesc + ' Use for current live data from Keycloak.',
      'execute_cypher': originalDesc + ' Use for analysis and pattern detection.',
      // Add freshness hints
      'query_graph': originalDesc + ' Check data freshness first before analysis.'
    };
    return enrichments[toolName] || originalDesc;
  }
  ```
- [ ] Task 5.5: Context Management (3h)
- [ ] Task 5.6: Response Generation (2h)
- [ ] Task 5.7: Error Recovery (2h)

**Story 6: Intelligent Routing Logic**
- **Priorität:** P0
- **Story Points:** 13
- **Akzeptanzkriterien:**
    - Smart decision between MCPs
    - Caching strategy implemented
    - Pattern recognition working

**Tasks:**
- [ ] Task 6.1: Decision Engine (4h)
  ```typescript
  class DecisionEngine {
    determineDataSource(intent: string): 'keycloak' | 'neo4j' | 'both'
    checkFreshness(dataType: string): boolean
    buildExecutionPlan(intent: string): ExecutionPlan
  }
  ```
- [ ] Task 6.2: Caching Layer with Redis (3h)
- [ ] Task 6.3: Pattern Detection Queries (3h)
  ```cypher
  // Duplicate detection
  MATCH (u1:User), (u2:User)
  WHERE u1.email = u2.email AND u1.id <> u2.id
  RETURN u1, u2
  ```
- [ ] Task 6.4: Compliance Check Orchestration (3h)
- [ ] Task 6.5: Performance Optimization (2h)

---

## 🎤 Phase 2: Voice & Real-time (Woche 5-7)
### Milestone 2: Voice Interface & WebSocket Communication

#### Epic: Voice Integration
**Story 7: Speech Recognition & TTS**
- **Priorität:** P0
- **Story Points:** 8
- **Akzeptanzkriterien:**
    - "Hey Keycloak" activation works
    - German language support
    - TTS responses

**Tasks:**
- [ ] Task 7.1: Web Speech API Integration (3h)
- [ ] Task 7.2: Hotword Detection (2h)
- [ ] Task 7.3: Gemini TTS Integration (2h)
- [ ] Task 7.4: Audio Queue Management (2h)
- [ ] Task 7.5: Error Handling (1h)

**Story 8: WebSocket Real-time Updates**
- **Priorität:** P1
- **Story Points:** 8
- **Akzeptanzkriterien:**
    - Live graph updates
    - Progress notifications
    - Multi-client support

**Tasks:**
- [ ] Task 8.1: Socket.io Server Setup (2h)
- [ ] Task 8.2: Event Definitions (2h)
  ```typescript
  enum SocketEvents {
    GRAPH_UPDATE = 'graph:update',
    ANALYSIS_PROGRESS = 'analysis:progress',
    COMPLIANCE_ALERT = 'compliance:alert'
  }
  ```
- [ ] Task 8.3: Room Management (2h)
- [ ] Task 8.4: Client Synchronization (2h)
- [ ] Task 8.5: Connection Recovery (2h)

---

## 🎨 Phase 3: Frontend Development (Woche 8-10)
### Milestone 3: User Interface Complete

#### Epic: Next.js Frontend
**Story 9: Frontend Foundation**
- **Priorität:** P0
- **Story Points:** 13
- **Akzeptanzkriterien:**
    - Next.js 14 app running
    - Authentication working
    - API connected

**Tasks:**
- [ ] Task 9.1: Next.js Setup (2h)
  ```bash
  npx create-next-app@latest frontend --typescript --tailwind --app
  ```
- [ ] Task 9.2: Page Structure (3h)
    - Dashboard
    - Analytics
    - Voice Interface
    - Settings
- [ ] Task 9.3: State Management with Zustand (3h)
- [ ] Task 9.4: API Client Setup (2h)
- [ ] Task 9.5: WebSocket Client (3h)
- [ ] Task 9.6: Authentication Flow (2h)

**Story 10: UI Components**
- **Priorität:** P0
- **Story Points:** 21
- **Akzeptanzkriterien:**
    - All components implemented
    - Responsive design
    - Dark mode support

**Tasks:**
- [ ] Task 10.1: Design System Setup (3h)
- [ ] Task 10.2: Voice Interface Component (4h)
  ```typescript
  export function VoiceInterface() {
    // Microphone button
    // Transcript display
    // Response visualization
  }
  ```
- [ ] Task 10.3: Dashboard Components (4h)
- [ ] Task 10.4: Graph Visualization (5h)
    - D3.js or Cytoscape.js
    - Real-time updates
    - Interactive nodes
- [ ] Task 10.5: Compliance Dashboard (3h)
- [ ] Task 10.6: User Management UI (3h)
- [ ] Task 10.7: Activity Feed (2h)
- [ ] Task 10.8: Notification System (2h)

**Story 11: Voice UI Integration**
- **Priorität:** P0
- **Story Points:** 8
- **Akzeptanzkriterien:**
    - Voice commands working
    - Visual feedback
    - Error states handled

**Tasks:**
- [ ] Task 11.1: Voice Button Component (2h)
- [ ] Task 11.2: Transcript Display (2h)
- [ ] Task 11.3: Visual Feedback States (2h)
- [ ] Task 11.4: Command History (2h)
- [ ] Task 11.5: Settings Panel (2h)

---

## 🧪 Phase 4: Integration & Testing (Woche 11-12)
### Milestone 4: MVP Ready for Amsterdam

#### Epic: System Integration
**Story 12: End-to-End Testing**
- **Priorität:** P0
- **Story Points:** 13
- **Akzeptanzkriterien:**
    - All flows working
    - Performance acceptable
    - No critical bugs

**Tasks:**
- [ ] Task 12.1: E2E Test Setup with Playwright (3h)
- [ ] Task 12.2: Voice Command Testing (3h)
- [ ] Task 12.3: MCP Integration Tests (3h)
- [ ] Task 12.4: Performance Testing (2h)
- [ ] Task 12.5: Security Audit (2h)
- [ ] Task 12.6: Bug Fixing (4h)

**Story 13: Demo Preparation**
- **Priorität:** P0
- **Story Points:** 8
- **Akzeptanzkriterien:**
    - Demo scenarios ready
    - Data prepared
    - Backup plans

**Tasks:**
- [ ] Task 13.1: Demo Data Setup (3h)
    - Create realistic Keycloak data
    - Import to Neo4j
    - Create patterns to find
- [ ] Task 13.2: Demo Script (2h)
  ```markdown
  1. "Hey Keycloak, zeige mir alle Benutzer"
  2. "Analysiere die Compliance"
  3. "Finde doppelte Benutzer"
  4. Show real-time graph updates
  ```
- [ ] Task 13.3: Presentation Materials (2h)
- [ ] Task 13.4: Backup Video Recording (2h)
- [ ] Task 13.5: Practice Runs (3h)

---

## 📊 Adjusted Sprint Planning

### Sprint 1 (Woche 1): MCP Integration
- Story 1: MCPs Setup (8 SP)
- Story 2: Dev Environment (5 SP)
  **Total: 13 SP**

### Sprint 2 (Woche 2-3): MCP Client & Gateway
- Story 3: MCP Client (13 SP)
- Story 4: Gateway Setup (8 SP)
  **Total: 21 SP**

### Sprint 3 (Woche 3-4): LLM Integration
- Story 5: LLM with MCPs (21 SP)
  **Total: 21 SP**

### Sprint 4 (Woche 5-6): Intelligence & Voice
- Story 6: Routing Logic (13 SP)
- Story 7: Speech Recognition (8 SP)
  **Total: 21 SP**

### Sprint 5 (Woche 7-8): Real-time & Frontend Start
- Story 8: WebSocket (8 SP)
- Story 9: Frontend Foundation (13 SP)
  **Total: 21 SP**

### Sprint 6 (Woche 9-10): UI Complete
- Story 10: UI Components (21 SP)
  **Total: 21 SP**

### Sprint 7 (Woche 11): Voice UI & Integration
- Story 11: Voice UI (8 SP)
- Story 12: E2E Testing (13 SP)
  **Total: 21 SP**

### Sprint 8 (Woche 12): Demo Ready
- Story 13: Demo Prep (8 SP)
- Buffer for fixes
  **Total: 8 SP + Buffer**

---

## 🚀 Key Architecture Changes

### MCP Protocol Integration
```typescript
// libs/mcp-client/src/types.ts
export interface MCPServer {
  name: string;
  url: string;
  transport: 'stdio' | 'http' | 'websocket';
}

export interface MCPToolCall {
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface MCPResponse {
  content: Array<{
    type: 'text' | 'resource';
    text?: string;
    resource?: any;
  }>;
}
```

### Orchestration with Existing MCPs
```typescript
@Injectable()
export class MCPOrchestrationService {
  constructor(
    private keycloakMCP: KeycloakMCPClient,
    private neo4jMCP: Neo4jMCPClient,
    private llm: GeminiService,
  ) {}

  async executeAnalysis(intent: string) {
    // 1. Check Neo4j for existing data
    const checkQuery = `
      MATCH (m:Metadata {type: 'users'})
      RETURN m.lastUpdated as lastUpdated
    `;
    const freshness = await this.neo4jMCP.executeCypher(checkQuery);
    
    // 2. Refresh if needed
    if (this.needsRefresh(freshness)) {
      const users = await this.keycloakMCP.getUsers();
      await this.syncToGraph(users);
    }
    
    // 3. Run analysis
    const analysisQuery = `
      MATCH (u:User)
      RETURN count(u) as total,
             count(CASE WHEN u.mfaEnabled THEN 1 END) as mfaCount
    `;
    return await this.neo4jMCP.executeCypher(analysisQuery);
  }
}
```

---

## 🎯 Critical Success Factors

### Week 1-2: Quick Wins
✅ Both MCPs running and tested
✅ Basic orchestration working
✅ First voice command processed

### Week 4: Intelligence Checkpoint
✅ LLM correctly routing to MCPs
✅ Freshness checks working
✅ Pattern detection functional

### Week 8: UI Checkpoint
✅ Dashboard showing real data
✅ Graph visualization working
✅ Voice interface stable

### Week 12: Demo Ready
✅ All demo scenarios tested
✅ Fallback plans ready
✅ Performance optimized

---

## 💡 Time & Cost Savings

### Saved Development Time:
- **Keycloak MCP:** ~3 weeks saved
- **Neo4j MCP:** ~2 weeks saved
- **Total:** 5 weeks saved (31% faster)

### New Time Allocation:
- **More Polish:** Better UI/UX
- **More Testing:** Higher quality
- **More Features:** Advanced analytics
- **Better Demo:** More impressive presentation

---

## 📝 Next Immediate Steps

1. **Day 1:** Clone and test both MCPs
2. **Day 2:** Setup Nx monorepo structure
3. **Day 3:** Create MCP client library
4. **Day 4:** Start AI Gateway
5. **Day 5:** First LLM integration test

---

*This adjusted plan leverages existing MCPs to deliver faster and focus on the unique value-add components.*
