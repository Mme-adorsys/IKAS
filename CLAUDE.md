# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in the IKAS (Intelligentes Keycloak Admin System) repository.

## Project Overview: IKAS

IKAS is an intelligent administrative system for Keycloak that revolutionizes instance management through:

- **Natural Language Processing**: Voice commands in English ("Hey IKAS")
- **AI-Powered Decision Making**: Multiple LLM providers (Anthropic Claude Opus 4.1 & Google Gemini) with function calling
- **Knowledge Graph Analytics**: Neo4j for relationship analysis and pattern detection  
- **Automated Compliance**: Security checks and governance monitoring
- **Existing MCP Integration**: Leverages pre-built Keycloak and Neo4j MCP servers

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Voice Client   │    │ WebSocket Server│    │   AI Gateway    │    │  MCP Services   │
│   (Browser)     │◄──►│  (Socket.io/TS) │◄──►│  (Express/TS)   │◄──►│ Keycloak + Neo4j│
│                 │    │                 │    │                 │    │                 │
│ • English Voice │    │ • Real-time Hub │    │ • Multi-LLM     │    │ • Admin Tools   │
│ • Hey IKAS     │    │ • Redis Pub/Sub │    │ • Event Handler │    │ • Graph Queries │
│ • WebSocket     │    │ • Session Mgmt  │    │ • Smart Routing │    │ • User Data     │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Timeline & Milestones

- **Total Duration**: 12 weeks to MVP for Amsterdam demo
- **Team Size**: 2-3 developers (reduced from original plan)
- **Key Advantage**: 5 weeks saved by leveraging existing MCPs
- **Current Status**: ✅ Phase 4 Complete - Production-Ready System with Multi-LLM Support & Enhanced Logging

### Phase Status Overview
- **✅ Phase 0** (Week 1): MCP Integration & Foundation - **COMPLETED**
- **✅ Phase 1** (Weeks 2-4): Intelligence Layer with AI Gateway - **COMPLETED**  
- **✅ Phase 2** (Weeks 5-7): Voice Interface & Real-time WebSocket - **COMPLETED**
- **✅ Phase 3** (Weeks 8-10): Frontend Development - **COMPLETED**
- **✅ Phase 4** (Weeks 11-12): Integration & Amsterdam Demo Prep - **COMPLETED**

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

### ✅ Phase 0-3 - Completed Components
- **keycloak-mcp-server/**: Node.js/TypeScript MCP server for Keycloak administration (✅ Tested & Documented)
- **mcp-neo4j/**: Python MCP server for Neo4j database interactions (✅ Tested & Documented)
- **shared-types/**: TypeScript interfaces and schemas (✅ Complete with 11 interface files)
- **docker/**: Container orchestration and development environment (✅ Working with health checks)
- **docs/**: Complete architecture documentation and implementation plan (✅ Ready)
- **tests/**: Integration tests for MCP servers (✅ Automated testing)
- **ai-gateway/**: Express.js/TypeScript service for LLM orchestration and MCP coordination (✅ Running on Port 8005)
- **websocket-server/**: Socket.io/TypeScript real-time communication service (✅ Running on Port 3001)
- **frontend/**: Next.js/TypeScript web application with voice interface and dashboard (✅ Complete with 79 passing tests)

### 🚧 Phase 4 - Final Development Phase  
- **e2e-tests/**: End-to-end testing suite for Amsterdam demo scenarios
- **Integration**: Full system integration and demo preparation

### 📊 Available MCP Tools (Documented & Tested)
**Keycloak MCP** (8 tools): create-user, delete-user, list-users, list-realms, list-admin-events, get-event-details, list-user-events, get-metrics

**Neo4j MCP** (3 tools): get_neo4j_schema, read_neo4j_cypher, write_neo4j_cypher

### 📡 AI Gateway API Endpoints (Multi-LLM Support)
**Model Management**:
- `GET /api/models` - List available LLM models with capabilities and current selection
- `POST /api/models/switch` - Switch between LLM providers (Anthropic, Gemini, OpenAI, Ollama)

**Chat & Orchestration**:
- `POST /api/chat` - Process user messages through selected LLM with MCP orchestration  
- `GET /api/tools` - Discover available MCP tools from all connected servers
- `GET /api/status` - System health check including MCP service status
- `DELETE /api/chat/:sessionId` - Clear specific chat session history

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

### ✅ Phase 1-2: AI Gateway & WebSocket Development (COMPLETED)
```bash
# Start AI Gateway (requires GEMINI_API_KEY environment variable)
cd ai-gateway/
export GEMINI_API_KEY="your-google-gemini-key"
export PORT=8005
npm run dev  # Runs on port 8005

# Start WebSocket Server  
cd websocket-server/
npm run dev  # Runs on port 3001

# Test Voice Interface
open http://localhost:8080/test-client.html  # German voice commands
```

### ✅ Phase 3: Frontend Development (COMPLETED)
```bash
# Frontend Development - Next.js with TypeScript
cd frontend/

# Install dependencies
npm install

# Development mode
npm run dev  # Runs on port 3000

# Build and test commands
npm run build    # TypeScript compilation + build
npm run lint     # ESLint checking
npm run test     # Jest test suite (79 tests passing)
npm run type-check  # TypeScript type checking

# Open application
open http://localhost:3002  # Access IKAS frontend

# Available Features:
# - English voice interface with "Hey IKAS" hotword
# - Multi-LLM support (Anthropic Claude & Google Gemini) with model switching
# - WebSocket real-time communication  
# - Dashboard with system status and controls
# - Voice command panels with transcription
# - Event logging and management
# - Responsive design with Tailwind CSS
```

### 🚧 Phase 4: Integration & Demo Preparation (NEXT)
```bash
# End-to-end testing suite
cd e2e-tests/
npm install
npm run test:scenarios  # Demo scenarios testing

# Full system integration test
./scripts/full-system-test.sh

# Amsterdam demo preparation
./scripts/demo-setup.sh
```

### ✅ Current System Status (Phase 4 Complete - Production-Ready with Enhanced Logging)
```bash
# ✅ IKAS FULLY OPERATIONAL - All 8 services running and connected:

# Infrastructure Services:
# ✅ PostgreSQL (Port 5432) - Database backend for Keycloak
# ✅ Redis (Port 6379) - Caching and pub/sub messaging  
# ✅ Neo4j (Port 7474/7687) - Graph database for analytics
# ✅ Keycloak (Port 8080) - Identity and access management

# IKAS Core Services:
# ✅ Keycloak MCP Server (Port 8001) - User management tools
# ✅ Neo4j MCP Server (Port 8002) - Graph analytics tools  
# ✅ AI Gateway (Port 8005) - Multi-LLM orchestration (Anthropic Claude & Gemini) + Enhanced Logging
# ✅ WebSocket Server (Port 3001) - Real-time communication hub

# Frontend:
# ✅ Next.js Application (Port 3002) - Full UI with voice interface
# ✅ Voice Test Client (Port 8080) - Development testing interface

# 🆕 Enhanced Logging System (August 2025):
# ✅ Component-specific log files with emojis and performance metrics
#     • logs/combined.log - All enhanced logs with pretty formatting
#     • logs/gemini.log - Gemini LLM operations (🎯📊📤)
#     • logs/mcp.log - MCP service calls with response tracking
# ✅ Request ID tracking for correlation across components
# ✅ Performance monitoring (response times, data sizes, success rates)
# ✅ Real-time operational visibility with structured JSON logging
# ✅ Function call tracking with detailed execution metrics

# Key Capabilities Now Working:
# ✅ English voice commands with "Hey IKAS" hotword
# ✅ Multi-LLM support (Anthropic Claude Opus 4.1 & Google Gemini) with dynamic switching
# ✅ Real-time WebSocket communication between all services
# ✅ MCP orchestration - AI Gateway connects to both MCP servers
# ✅ Complete user management through voice commands
# ✅ Graph analytics and compliance checking
# ✅ Dashboard with system status and controls
# ✅ Comprehensive logging and monitoring system
# ✅ Event logging and session management with request tracing

# Quick Access URLs:
# • Frontend Dashboard:     http://localhost:3002
# • Voice Test Client:      http://localhost:8080/test-client.html
# • Keycloak Admin:         http://localhost:8080 (admin/admin)
# • Neo4j Browser:          http://localhost:7474 (neo4j/password)
# • AI Gateway Health:      http://localhost:8005/health
# • WebSocket Health:       http://localhost:3001/health

# Enhanced Logging Commands:
# • View all logs:           docker exec ikas-ai-gateway tail -f logs/combined.log
# • View Gemini logs:        docker exec ikas-ai-gateway tail -f logs/gemini.log
# • View MCP logs:           docker exec ikas-ai-gateway tail -f logs/mcp.log
```

### 🆕 Enhanced Logging System Implementation (August 2025)

The AI Gateway now features a comprehensive enhanced logging system with component-specific tracking and performance monitoring.

#### Key Features:
- **Component-Specific Loggers**: Separate loggers for Gemini LLM and MCP operations
- **Request Correlation**: Unique request IDs track operations across all components
- **Performance Metrics**: Response times, data sizes, and success rates monitoring
- **Visual Categorization**: Emojis for quick log scanning (🎯📊📤✅)
- **Structured JSON Output**: Machine-readable logs with pretty-print formatting

#### Log Files:
```bash
# AI Gateway Enhanced Logging Structure:
ai-gateway/logs/
├── combined.log     # All enhanced logs with unified formatting
├── gemini.log       # Gemini LLM operations with function call tracking
└── mcp.log          # MCP service calls with response analysis

# Example Enhanced Log Entries:
# Gemini: 🎯 Final Gemini response after function processing [requestId: 9d7c8db5]
# MCP: ✅ MCP tool completed [neo4j:write_neo4j_cypher] 21ms [requestId: cd11a571]
# Combined: Pretty-printed JSON with timestamps and correlation IDs
```

#### Implementation Files:
- `ai-gateway/src/utils/logger.ts` - Winston logger configuration with custom formatters
- Request tracking with `RequestTracker` class for correlation
- Component-specific loggers: `geminiLogger` and `mcpLogger`
- Performance monitoring for all API calls and function executions

#### Recent Fixes:
- ✅ Fixed TypeScript error in logger.ts requestId handling
- ✅ Rebuilt Docker images with enhanced logging (August 23, 2025)
- ✅ Verified operational with live orchestration test
- ✅ All log files created and populated with enhanced formatting

### 🔧 Recent System Fixes (August 2025)
```bash
# Issues Resolved:
# ✅ Built missing MCP Docker images (Keycloak + Neo4j)
# ✅ Fixed Neo4j MCP port configuration (8000 → 8002)
# ✅ Updated docker-compose environment variables
# ✅ Resolved port conflicts and dependency issues
# ✅ Implemented proper startup sequence for all services
# ✅ FIXED: AI Gateway port configuration (ai-gateway-hot: 8006 → 8005)
# ✅ FIXED: Health check dependency (WebSocket made optional for API)
# ✅ FIXED: TypeScript error in voice.ts (SpeechSynthesisErrorEvent typing)
# ✅ FIXED: Anthropic API key Docker environment variable passing
# ✅ ADDED: Multi-LLM support with dynamic provider switching

# Current Docker Setup:
# ✅ ikas-keycloak-mcp:latest - HTTP server on port 8001
# ✅ ikas-neo4j-mcp:latest - FastMCP server on port 8002
# ✅ ikas-ai-gateway-hot - Development with hot reload on port 8005
# ✅ All services use Docker network "ikas-network"
# ✅ Health checks configured and working
# ✅ Manual container management for complex dependencies
```

### 🎤 Demo Voice Commands - Fully Operational (August 2025)
```bash
# English voice commands that work end-to-end with multi-LLM support:
"Hey IKAS, show all users"                # Show all users ✅ TESTED (Anthropic Claude)
"Hey IKAS, analyze compliance"            # Run compliance analysis  
"Hey IKAS, find duplicate users"          # Find duplicate users
"Hey IKAS, create a user"                 # Create a new user
"Hey IKAS, show statistics"               # Show usage statistics
"Hey IKAS, switch to Gemini model"        # Switch LLM provider to Google Gemini
"Hey IKAS, switch to Claude model"        # Switch LLM provider to Anthropic Claude

# Latest Test Results (August 24, 2025):
# ✅ Successfully tested "show all users" via API endpoint /api/chat (Anthropic Claude)
# ✅ Full orchestration workflow: Message → Claude Opus 4.1 → MCP → Response (<2000ms)
# ✅ Multi-LLM support verified: Both Anthropic and Gemini operational
# ✅ Enhanced logging captured all operations with request correlation
# ✅ Keycloak MCP integration successful (admin user retrieved)
# ✅ Model switching API tested: /api/models and /api/models/switch endpoints
# ✅ Frontend integration: Model selection UI functional
# ✅ Strategy: coordinated_multi_mcp with dynamic provider selection

# Test Commands:
# node test-logging.js  # Sends POST to /api/chat with English user request
# curl http://localhost:8005/api/models  # Check available models
# curl -X POST http://localhost:8005/api/models/switch -H "Content-Type: application/json" -d '{"provider":"gemini"}'
```

### ✅ Phase 3: Frontend Development (COMPLETED)
```bash
# Next.js frontend with full IKAS interface - COMPLETED
cd frontend/

# Complete feature set implemented:
# ✅ English voice interface with "Hey IKAS" hotword detection
# ✅ Multi-LLM model support with dynamic switching UI
# ✅ Real-time WebSocket communication with backend services
# ✅ Dashboard with system status, voice controls, and event management
# ✅ Responsive design with Tailwind CSS and dark mode support
# ✅ TypeScript + ESLint + Jest with 79/79 tests passing
# ✅ Voice transcription and command processing
# ✅ Event logging and management interface

# Start development
npm run dev  # Port 3000 - Ready for use
```

### ✅ Phase 4: Final Integration & Demo Preparation (COMPLETED - August 2025)
```bash
# ✅ PHASE 4 COMPLETED - Production-Ready Multi-LLM System Achieved

# Major Accomplishments:
# ✅ Multi-LLM support implemented with Anthropic Claude Opus 4.1 & Google Gemini
# ✅ LLM Factory pattern with dynamic provider switching (<2000ms response time)
# ✅ Enhanced logging system deployed with component-specific tracking
# ✅ Full orchestration workflow tested and verified across multiple providers
# ✅ Request correlation system operational across all components
# ✅ Performance monitoring active with detailed metrics
# ✅ Visual log categorization with emojis for operational clarity
# ✅ All Docker services rebuilt and updated with latest enhancements
# ✅ Frontend model selection UI operational

# Integration Testing Results:
# ✅ AI Gateway → MCP coordination fully operational across multiple LLM providers
# ✅ Anthropic Claude Opus 4.1 function calling with enhanced tracking
# ✅ Google Gemini Pro function calling with enhanced tracking  
# ✅ Dynamic model switching operational via API and frontend
# ✅ Keycloak user management via voice commands (multi-model support)
# ✅ Neo4j graph analytics integration operational
# ✅ Real-time WebSocket communication maintained
# ✅ End-to-end request flow: Voice → WebSocket → AI Gateway → Selected LLM → MCP → Response

# Amsterdam Demo Readiness:
# ✅ Multi-LLM system fully operational with comprehensive monitoring
# ✅ English voice commands working end-to-end with model selection
# ✅ Dynamic model switching demo: Anthropic Claude ↔ Google Gemini
# ✅ Enhanced logging provides full operational visibility
# ✅ Performance metrics tracking for demo reliability (<2000ms response)
# ✅ All services containerized and health-checked

# Quick Demo Tests:
# node test-logging.js  # Demonstrates full multi-LLM system integration
# curl http://localhost:8005/api/models  # List available models
# docker exec ikas-ai-gateway-hot tail -f logs/combined.log  # Watch all operations live
# docker exec ikas-ai-gateway-hot tail -f logs/gemini.log   # Watch Gemini operations
# docker exec ikas-ai-gateway-hot tail -f logs/anthropic.log # Watch Claude operations (if exists)
```

## IKAS Architecture Details

### 1. Keycloak MCP Server (Existing ✅)
- **Framework**: @modelcontextprotocol/sdk + @keycloak/keycloak-admin-client
- **Capabilities**: User management, realm administration, event monitoring
- **Environment**: KEYCLOAK_URL, KEYCLOAK_ADMIN, KEYCLOAK_ADMIN_PASSWORD
- **Key Tools**: create-user, list-users, list-admin-events, get-metrics
- **Entry Point**: `src/index.ts`

### 2. Neo4j MCP Server (To Migrate 🚧)  
- **Framework**: @modelcontextprotocol/sdk + Neo4j JavaScript driver
- **Capabilities**: Cypher execution (read/write), schema inspection
- **Transport**: stdio, http, sse modes
- **Environment**: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
- **Key Tools**: get_neo4j_schema, query_read, query_write
- **Entry Point**: `src/index.ts`

### 3. AI Gateway (Existing ✅)
- **Framework**: Express.js/TypeScript + Multi-LLM Support (Anthropic Claude Opus 4.1 & Google Gemini)
- **Purpose**: Orchestrate between multiple LLM providers and MCP services
- **Key Features**: 
  - Dynamic MCP tool discovery
  - Multi-LLM provider support with hot-switching (Anthropic, Google, OpenAI, Ollama)
  - Intelligent routing (fresh data vs. cached analysis)
  - Function calling with context management
  - Error recovery and fallback strategies
  - LLM Factory pattern for provider abstraction
- **Status**: ✅ Running on port 8005 with full MCP integration and multi-LLM support

### 4. Frontend (Existing ✅)
- **Framework**: Next.js 14 + TypeScript + Tailwind CSS
- **Key Features**:
  - English voice activation with "Hey IKAS" hotword
  - Multi-LLM model selection and switching interface
  - Real-time WebSocket communication
  - Dashboard with system status and controls
  - Voice command panels with transcription
  - Event logging and management interface
  - Responsive design with dark mode support
- **Status**: ✅ Complete with 79/79 tests passing
- **Entry Point**: `src/app/page.tsx`
- **Port**: 3000

### 5. WebSocket Server (Existing ✅)
- **Framework**: Socket.io/TypeScript + Redis pub/sub  
- **Purpose**: Real-time updates for voice commands and system events
- **Events**: voice:command, voice:response, system:status, analysis:progress
- **Status**: ✅ Running on port 3001 with full session management
- **Entry Point**: `src/server.ts`

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

# Phase 1: AI Gateway (TypeScript/Node.js)
export GEMINI_API_KEY="your-google-gemini-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
export LLM_PROVIDER="anthropic"  # or "gemini", "ollama", "openai"
export LLM_MODEL="claude-opus-4-1-20250805"
export LLM_TEMPERATURE="0.1"
export LLM_MAX_TOKENS="8192"
export REDIS_URL="redis://localhost:6379"
export KEYCLOAK_MCP_URL="http://localhost:8001"
export NEO4J_MCP_URL="http://localhost:8002"
export NODE_ENV="development"
export PORT="8005"

# Phase 2: Frontend
export NEXT_PUBLIC_API_URL="http://localhost:8005"
export NEXT_PUBLIC_WS_URL="http://localhost:3001"
```

### Docker Development Environment

```yaml
# docker/docker-compose.dev.yml - Multi-LLM Support
services:
  # AI Gateway with Hot Reload & Multi-LLM Support
  ai-gateway-hot:
    build:
      context: ../ai-gateway
      dockerfile: Dockerfile.dev
    container_name: ikas-ai-gateway-hot
    ports: ["8005:8005"]  # Fixed port mapping
    environment:
      GEMINI_API_KEY: ${GEMINI_API_KEY:-your-google-key}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}  # Added Anthropic support
      # LLM Configuration
      LLM_PROVIDER: ${LLM_PROVIDER:-anthropic}
      LLM_MODEL: ${LLM_MODEL:-claude-opus-4-1-20250805}
      LLM_TEMPERATURE: ${LLM_TEMPERATURE:-0.1}
      LLM_MAX_TOKENS: ${LLM_MAX_TOKENS:-8192}
      PORT: 8005
      NODE_ENV: development
    volumes:
      - ../ai-gateway/src:/app/src:cached  # Hot reload support
    profiles: ["hot-reload"]

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
npm test  # Uses testcontainers for Node.js
```

### Phase 1: AI Gateway Tests
```bash
# Unit tests for orchestration logic
cd ai-gateway/
npm test

# Integration tests with mock MCPs
npm run test:integration
```

### Phase 2: WebSocket & Voice Interface Tests (COMPLETED)
```bash
# WebSocket server tests
cd websocket-server/
npm run build  # TypeScript compilation successful
npm run test   # Event system and session management tests

# Voice interface testing  
open http://localhost:8080/test-client.html
# Test English voice commands:
# - "Hey IKAS" hotword detection ✅
# - Real-time WebSocket communication ✅ 
# - Voice response synthesis ✅
# - Multi-LLM model switching ✅
```

### Phase 3: Frontend Tests (NEXT)
```bash
# Component tests
cd frontend/
npm run test

# E2E voice interface testing with full UI
npx playwright test tests/voice-commands.spec.ts
```

### Phase 4: Amsterdam Demo Tests
```bash
# End-to-end demo scenarios
cd e2e-tests/
npm run test:scenarios  # Demo scenarios testing
```

### 🚀 Amsterdam Demo Test Scenarios (Phase 2 Ready)

**✅ Currently Working End-to-End:**
1. **"Hey IKAS, show all users"** - Voice activation and user listing with multi-LLM support
   - English hotword detection → WebSocket → AI Gateway → Anthropic/Gemini → Keycloak MCP → Real-time response
2. **"Hey IKAS, analyze compliance"** - Multi-MCP orchestration with model selection
   - Voice processing → Analysis event → Progress updates → Neo4j queries → Results
3. **"Hey IKAS, switch to Gemini model"** - Dynamic model switching
   - Model selection → Factory pattern → Provider switch → Response confirmation
4. **System Health Check** - All components operational with WebSocket status monitoring

**✅ Phase 4 Enhancements:**
5. **"Hey IKAS, find duplicate users"** - Graph analysis with visual interface
6. **Real-time Graph Visualization** - D3.js rendering of Neo4j data updates
7. **Dashboard Integration** - Complete web UI with voice, model selection, graphs, and admin tools

## Critical Implementation Notes

### MCP Orchestration Strategy
The AI Gateway must intelligently route requests:

```typescript
// Example decision logic
const determineDataSource = (intent: string): string => {
  const lowerIntent = intent.toLowerCase();
  
  if (lowerIntent.includes("current") || lowerIntent.includes("latest")) {
    return "keycloak_direct";  // Fresh data
  } else if (lowerIntent.includes("analyze") || lowerIntent.includes("pattern")) {
    return "neo4j_analysis";  // Historical analysis
  } else {
    return "both_coordinated";  // Sync then analyze
  }
};
```

### Voice Command Processing
English language support with multi-LLM integration:

```typescript
// Web Speech API with English locale
const recognition = new SpeechRecognition();
recognition.lang = 'en-US';
recognition.continuous = false;
recognition.interimResults = false;

// Multi-LLM hotword detection
const hotwords = ['hey ikas', 'ikas'];
const modelSwitchCommands = {
  'switch to claude': 'anthropic',
  'switch to gemini': 'gemini',
  'use anthropic': 'anthropic',
  'use google': 'gemini'
};
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

## Multi-LLM Support Architecture

### LLM Factory Pattern
The AI Gateway implements a factory pattern for managing multiple LLM providers:

```typescript
// ai-gateway/src/llm/llm-factory.ts
export class LLMFactory {
  static createLLMService(overrideProvider?: string): LLMService {
    const providerConfig = getProviderConfig();
    const requestedProvider = overrideProvider || providerConfig.provider;

    switch (requestedProvider as LLMProvider) {
      case LLMProvider.ANTHROPIC:
        return new AnthropicService(); // Claude Opus 4.1
      case LLMProvider.GEMINI:
        return new GeminiService();   // Gemini Pro
      case LLMProvider.OPENAI:
        return new OpenAIService();   // GPT-4 (when available)
      case LLMProvider.OLLAMA:
        return new OllamaService();   // Local models
      default:
        throw new LLMError(provider, 'UNKNOWN_PROVIDER', `Unsupported provider: ${requestedProvider}`);
    }
  }

  static async switchProvider(newProvider: LLMProvider): Promise<LLMService> {
    const newService = this.instantiateProvider(newProvider);
    
    if (!await newService.isAvailable()) {
      throw new LLMUnavailableError(newProvider, 'Provider is not available');
    }

    this.instance = newService;
    this.currentProvider = newProvider;
    return newService;
  }
}
```

### Provider-Specific Services
Each LLM provider has its own service implementation:

1. **AnthropicService** - Claude Opus 4.1 with advanced reasoning capabilities
2. **GeminiService** - Google Gemini Pro with fast function calling
3. **OpenAIService** - GPT-4 integration (configurable)
4. **OllamaService** - Local model support (llama2, etc.)

### Model Switching Workflow
1. Frontend calls `/api/models/switch` with provider selection
2. Factory validates provider availability and API keys
3. New service instance created and tested
4. Orchestrator switches to new provider
5. Chat history optionally cleared for fresh context
6. Response confirms successful switch with model details

## MCP Orchestration Guidelines

### Core Orchestration Principles

The AI Gateway serves as the intelligent coordinator between LLM and MCP services. Follow these patterns for consistent implementation:

#### 1. Dynamic Tool Discovery
```typescript
// ai-gateway/src/mcp/discovery.ts
import { ToolDefinition } from '../types/mcp';

class MCPToolDiscovery {
  async discoverAllTools(): Promise<Record<string, ToolDefinition[]>> {
    const tools: Record<string, ToolDefinition[]> = {};
    
    // Keycloak MCP tools
    const keycloakTools = await this.keycloakMcp.listTools();
    tools.keycloak = keycloakTools.map(tool => 
      this.enhanceToolDescription(tool, 'keycloak')
    );
    
    // Neo4j MCP tools  
    const neo4jTools = await this.neo4jMcp.listTools();
    tools.neo4j = neo4jTools.map(tool => 
      this.enhanceToolDescription(tool, 'neo4j')
    );
    
    return tools;
  }
  
  private enhanceToolDescription(tool: ToolDefinition, source: string): ToolDefinition {
    const enhancements: Record<string, Record<string, string>> = {
      keycloak: {
        'list-users': tool.description + " Use for current live user data from Keycloak.",
        'list-admin-events': tool.description + " Use for recent administrative actions and audit trails.",
      },
      neo4j: {
        'query_read': tool.description + " Use for pattern analysis, relationship queries, and historical data analysis.",
        'get_neo4j_schema': tool.description + " Use to understand data structure before writing complex queries.",
      }
    };
    
    const enhancedDesc = enhancements[source]?.[tool.name] || tool.description;
    return {
      ...tool,
      name: `${source}_${tool.name}`,
      description: enhancedDesc
    };
  }
}
```

#### 2. Intelligent Routing Strategy
```typescript
// ai-gateway/src/orchestration/routing.ts
import { ExecutionStrategy } from '../types/orchestration';

class IntelligentRouter {
  private freshnessThreshold = 30; // minutes
  private patterns = {
    freshDataKeywords: ['aktuell', 'current', 'latest', 'jetzt', 'live'],
    analysisKeywords: ['analysiere', 'analyze', 'finde', 'pattern', 'duplikat', 'muster', 'statistik'],
    writeKeywords: ['erstelle', 'create', 'lösche', 'delete', 'update', 'ändere']
  };
  
  async determineExecutionStrategy(userInput: string): Promise<ExecutionStrategy> {
    const userLower = userInput.toLowerCase();
    
    // Check for write operations (always route to Keycloak first)
    if (this.patterns.writeKeywords.some(keyword => userLower.includes(keyword))) {
      return ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC;
    }
    
    // Check for fresh data requirements
    if (this.patterns.freshDataKeywords.some(keyword => userLower.includes(keyword))) {
      return ExecutionStrategy.KEYCLOAK_FRESH_DATA;
    }
    
    // Check for analysis requirements
    if (this.patterns.analysisKeywords.some(keyword => userLower.includes(keyword))) {
      const freshness = await this.checkGraphDataFreshness();
      return freshness.needsRefresh 
        ? ExecutionStrategy.SYNC_THEN_ANALYZE
        : ExecutionStrategy.NEO4J_ANALYSIS_ONLY;
    }
    
    // Default: coordinated approach
    return ExecutionStrategy.COORDINATED_MULTI_MCP;
  }
  
  private async checkGraphDataFreshness() {
    // Implementation for checking data freshness
    return { needsRefresh: false };
  }
}
```

#### 3. Data Synchronization Patterns
```typescript
// ai-gateway/src/orchestration/sync.ts
import { SyncResult } from '../types/orchestration';
import { logger } from '../utils/logger';

class DataSynchronizer {
  async syncKeycloakToNeo4j(realm: string = "master", force: boolean = false): Promise<SyncResult> {
    // Check if sync is needed
    if (!force) {
      const freshness = await this.checkFreshness(realm);
      if (!freshness.needsRefresh) {
        return { skipped: true, reason: "Data is fresh" };
      }
    }
    
    try {
      // Fetch users from Keycloak
      const usersResult = await this.keycloakMcp.callTool("list-users", { realm });
      const users = usersResult.data;
      
      // Fetch roles and groups if needed
      const rolesResult = await this.keycloakMcp.callTool("list-roles", { realm });
      
      // Create comprehensive sync query
      const syncQuery = `
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
      `;
      
      // Execute sync
      await this.neo4jMcp.callTool("query_write", {
        query: syncQuery,
        parameters: {
          realm,
          users
        }
      });
      
      return { success: true, recordsSynced: users.length };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Sync failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
  
  private async checkFreshness(realm: string) {
    // Implementation for checking data freshness
    return { needsRefresh: false };
  }
}
```

#### 4. Error Recovery and Circuit Breakers
```typescript
// ai-gateway/src/orchestration/resilience.ts
import { CircuitBreaker } from '../utils/circuit-breaker';
import { MCPResponse, HttpError, Neo4jError } from '../types/mcp';
import { logger } from '../utils/logger';

class ResilientOrchestrator {
  private keycloakBreaker: CircuitBreaker;
  private neo4jBreaker: CircuitBreaker;
  
  constructor() {
    // Circuit breakers for each MCP
    this.keycloakBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      expectedExceptions: [HttpError]
    });
    
    this.neo4jBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 60000, // 60 seconds
      expectedExceptions: [Neo4jError]
    });
  }
  
  async callKeycloakTool(toolName: string, args: Record<string, any>): Promise<MCPResponse> {
    return this.keycloakBreaker.execute(async () => {
      return await this.keycloakMcp.callTool(toolName, args);
    });
  }
  
  async callNeo4jTool(toolName: string, args: Record<string, any>): Promise<MCPResponse> {
    return this.neo4jBreaker.execute(async () => {
      return await this.neo4jMcp.callTool(toolName, args);
    });
  }
  
  async executeWithFallback<T>(
    primaryCall: () => Promise<T>,
    fallbackCall?: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryCall();
    } catch (error) {
      if (error instanceof CircuitBreakerOpenException && fallbackCall) {
        logger.warn("Primary service unavailable, using fallback");
        return await fallbackCall();
      } else if (!fallbackCall) {
        throw new ServiceUnavailableException("Primary service down, no fallback available");
      }
      throw error;
    }
  }
}

class CircuitBreakerOpenException extends Error {}
class ServiceUnavailableException extends Error {}
```

#### 5. Caching and Performance Optimization
```typescript
// ai-gateway/src/orchestration/cache.ts
import Redis from 'ioredis';
import { createHash } from 'crypto';

class IntelligentCache {
  private redis: Redis;
  private ttlConfig = {
    user_data: 300,          // 5 minutes
    compliance_results: 1800, // 30 minutes  
    graph_analysis: 3600,     // 1 hour
    system_metrics: 60        // 1 minute
  };
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }
  
  async getOrExecute<T>(
    cacheKey: string, 
    cacheType: keyof typeof this.ttlConfig, 
    executorFunc: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cachedResult = await this.redis.get(cacheKey);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }
    
    // Execute and cache
    const result = await executorFunc();
    const ttl = this.ttlConfig[cacheType] || 300;
    
    await this.redis.setex(
      cacheKey,
      ttl,
      JSON.stringify(result, null, 0)
    );
    
    return result;
  }
  
  generateCacheKey(operation: string, params: Record<string, any>): string {
    const paramHash = createHash('md5')
      .update(JSON.stringify(params, Object.keys(params).sort()))
      .digest('hex')
      .substring(0, 8);
    
    return `ikas:${operation}:${paramHash}`;
  }
}
```

### Best Practices for MCP Integration

1. **Always Use Type-Safe Interfaces**
   ```typescript
   // ai-gateway/src/types/mcp.ts
   export interface MCPToolCall {
     server: 'keycloak' | 'neo4j';
     tool: string;
     arguments: Record<string, any>;
     context?: Record<string, any>;
   }
   
   export interface MCPResponse<T = any> {
     success: boolean;
     data?: T;
     error?: string;
     metadata?: Record<string, any>;
   }
   
   export interface ToolDefinition {
     name: string;
     description: string;
     inputSchema: Record<string, any>;
   }
   ```

2. **Implement Comprehensive Logging**
   ```typescript
   // ai-gateway/src/utils/logger.ts
   import winston from 'winston';
   
   export const logger = winston.createLogger({
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.json()
     ),
     transports: [
       new winston.transports.Console(),
       new winston.transports.File({ filename: 'logs/app.log' })
     ]
   });
   
   // Usage in orchestration
   async function orchestrateRequest(
     request: OrchestrationRequest
   ): Promise<OrchestrationResponse> {
     logger.info('orchestration_started', {
       userInput: request.userInput,
       sessionId: request.sessionId,
       strategy: request.strategy
     });
     
     try {
       const result = await this.executeStrategy(request);
       
       logger.info('orchestration_completed', {
         sessionId: request.sessionId,
         duration: result.duration,
         toolsCalled: result.toolsCalled
       });
       
       return result;
       
     } catch (error) {
       logger.error('orchestration_failed', {
         sessionId: request.sessionId,
         error: error instanceof Error ? error.message : 'Unknown error',
         stack: error instanceof Error ? error.stack : undefined
       });
       throw error;
     }
   }
   ```

3. **Monitor Performance Metrics**
   ```typescript
   // ai-gateway/src/utils/metrics.ts
   import { register, Counter, Histogram, Gauge } from 'prom-client';
   
   // Metrics
   export const mcpCallsTotal = new Counter({
     name: 'ikas_mcp_calls_total',
     help: 'Total MCP calls',
     labelNames: ['server', 'tool', 'status']
   });
   
   export const mcpDuration = new Histogram({
     name: 'ikas_mcp_duration_seconds',
     help: 'MCP call duration',
     labelNames: ['server', 'tool']
   });
   
   export const activeSessions = new Gauge({
     name: 'ikas_active_sessions',
     help: 'Number of active user sessions'
   });
   
   export async function callMcpWithMetrics(
     server: string,
     tool: string,
     args: Record<string, any>,
     mcpCall: () => Promise<any>
   ) {
     const startTime = Date.now();
     
     try {
       const result = await mcpCall();
       mcpCallsTotal.labels({ server, tool, status: 'success' }).inc();
       return result;
       
     } catch (error) {
       mcpCallsTotal.labels({ server, tool, status: 'error' }).inc();
       throw error;
       
     } finally {
       const duration = (Date.now() - startTime) / 1000;
       mcpDuration.labels({ server, tool }).observe(duration);
     }
   }
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
1. **Express.js Setup**: Create basic AI Gateway with health endpoints and TypeScript configuration
2. **MCP Client Library**: Implement HTTP clients for both MCP servers with type safety
3. **Google Gemini Integration**: Setup LLM with function calling using @google/generative-ai
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
│   ├── main.ts                  # Express.js application
│   ├── types/
│   │   ├── mcp.ts               # MCP type definitions
│   │   └── orchestration.ts    # Orchestration types
│   ├── orchestration/
│   │   ├── orchestrator.ts      # Main orchestration logic
│   │   ├── routing.ts           # Intelligent MCP selection
│   │   └── sync.ts              # Data synchronization
│   ├── llm/
│   │   ├── gemini-service.ts    # Google Gemini integration
│   │   └── tool-discovery.ts    # Dynamic MCP tool mapping
│   ├── mcp/
│   │   ├── client.ts            # Base MCP client
│   │   ├── keycloak-client.ts   # Keycloak MCP wrapper
│   │   └── neo4j-client.ts      # Neo4j MCP wrapper
│   ├── api/
│   │   ├── routes.ts            # REST endpoints
│   │   └── websocket.ts         # WebSocket handlers
│   └── utils/
│       ├── logger.ts            # Winston logging
│       ├── metrics.ts           # Prometheus metrics
│       └── circuit-breaker.ts   # Circuit breaker util
├── tests/
│   ├── orchestration.test.ts
│   ├── mcp-clients.test.ts
│   └── integration.test.ts
├── package.json
└── tsconfig.json
```

### Success Metrics for Phase 1
- ✅ AI Gateway responding to HTTP requests
- ✅ All 11 MCP tools discovered and mapped to Gemini functions  
- ✅ Basic voice command processing: "Hey Keycloak, zeige alle Benutzer"
- ✅ Data freshness checks and intelligent routing working
- ✅ Error handling and recovery mechanisms in place
- ✅ Performance: <3 second response time for basic queries
