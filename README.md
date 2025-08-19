# IKAS - Intelligentes Keycloak Admin System

> **Revolutionary AI-powered Keycloak administration through natural language processing and knowledge graph analytics**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](docker/docker-compose.dev.yml)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](shared-types/)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](mcp-neo4j/)

## 🎯 Project Overview

IKAS revolutionizes Keycloak instance management by combining:

- **🎤 Natural Language Processing**: German voice commands ("Hey Keycloak")
- **🤖 AI-Powered Decision Making**: Google Gemini LLM with intelligent tool orchestration  
- **📊 Knowledge Graph Analytics**: Neo4j for relationship analysis and pattern detection
- **🛡️ Automated Compliance**: Security checks and governance monitoring
- **⚡ Existing MCP Integration**: Leverages pre-built Keycloak and Neo4j MCP servers

### Timeline
- **Duration**: 12 weeks to MVP
- **Demo**: Amsterdam IAM Conference
- **Team**: 2-3 developers
- **Advantage**: 5 weeks saved by leveraging existing MCPs

## 🏗️ Architecture

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

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose**: Container orchestration
- **Node.js 18+**: JavaScript runtime
- **Python 3.11+**: For Neo4j MCP server
- **npm/yarn**: Package management
- **uv** (optional): Fast Python package manager

### 1. Clone and Setup

```bash
git clone <repository-url>
cd IKAS
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start Development Environment

```bash
# All-in-one startup script
./scripts/start-dev.sh
```

Or manually:

```bash
# Start infrastructure services
docker-compose -f docker/docker-compose.dev.yml up -d

# Install dependencies
npm install                    # Shared types
cd keycloak-mcp-server && npm install && npm run build
cd ../mcp-neo4j && uv sync     # or pip install -r requirements.txt

# Run health check
./docker/health-check.sh
```

### 3. Verify Installation

- **Keycloak**: http://localhost:8080 (admin/admin)
- **Neo4j Browser**: http://localhost:7474 (neo4j/password)  
- **Integration Tests**: `node tests/mcp-integration-test.js`

## 📁 Project Structure

```
IKAS/
├── 📁 keycloak-mcp-server/     # ✅ Keycloak MCP (existing)
├── 📁 mcp-neo4j/               # ✅ Neo4j MCP (existing)
├── 📁 ai-gateway/              # 🚧 LLM orchestration service
├── 📁 frontend/                # 🚧 Next.js voice interface
├── 📁 websocket-server/        # 🚧 Real-time communication
├── 📁 shared-types/            # ✅ TypeScript definitions
├── 📁 docker/                  # ✅ Development environment
├── 📁 docs/                    # ✅ Architecture & implementation plans
├── 📁 tests/                   # ✅ Integration tests
└── 📁 scripts/                 # ✅ Development utilities
```

## 🎤 Voice Commands (Demo)

```bash
"Hey Keycloak, zeige mir alle Benutzer"
# → Shows all users with live data from Keycloak

"Analysiere die Compliance"  
# → Multi-MCP orchestration: sync data + analyze patterns

"Finde doppelte Benutzer"
# → Graph analysis with real-time visualization

"Wie ist der System-Status?"
# → System health metrics from all services
```

## 🛠️ Development Phases

### ✅ Phase 0: Foundation (Week 1)
- Docker development environment
- MCP server integration and testing  
- Project structure and shared types
- Basic integration tests

### 🚧 Phase 1: Intelligence Layer (Weeks 2-4)
- AI Gateway with FastAPI
- Google Gemini LLM integration
- Dynamic MCP tool discovery
- Intelligent routing strategies

### 🚧 Phase 2: Voice & Real-time (Weeks 5-7)  
- Voice recognition with Web Speech API
- WebSocket server for real-time updates
- German language support
- "Hey Keycloak" hotword detection

### 🚧 Phase 3: Frontend (Weeks 8-10)
- Next.js dashboard with TypeScript
- D3.js graph visualization
- Real-time compliance monitoring
- Responsive design with dark mode

### 🚧 Phase 4: Demo Ready (Weeks 11-12)
- End-to-end testing with Playwright
- Amsterdam demo scenarios
- Performance optimization
- Documentation and presentation materials

## 📖 Documentation

- **[Implementation Plan](docs/ikas-implementation-plan.md)**: Detailed 12-week roadmap
- **[Architecture Guide](docs/arc42.md)**: Complete system architecture  
- **[MCP Tools Reference](docs/mcp-tools-reference.md)**: Available MCP server tools
- **[Development Guide](CLAUDE.md)**: Claude Code specific instructions

## 🔧 Available Scripts

```bash
# Development
./scripts/start-dev.sh          # Start full development environment
./docker/health-check.sh        # Verify all services are healthy
node tests/mcp-integration-test.js  # Test MCP server integration

# Docker Management  
docker-compose -f docker/docker-compose.dev.yml up -d     # Start services
docker-compose -f docker/docker-compose.dev.yml down     # Stop services
docker-compose -f docker/docker-compose.dev.yml logs     # View logs
```

## 🏆 Demo Scenarios

### 1. Voice Activation & User Management
- Natural hotword detection
- List users with voice commands
- Real-time data visualization

### 2. AI-Powered Compliance Analysis
- Multi-MCP orchestration
- Pattern detection in user data
- Automated violation reporting

### 3. Graph-Based Duplicate Detection
- Knowledge graph analytics
- Similarity algorithms
- Interactive visualization

### 4. System Health Monitoring
- Real-time metrics dashboard
- Service health indicators
- Performance monitoring

## 🔍 MCP Tools Available

### Keycloak MCP (8 tools)
- User management (create, delete, list)
- Realm administration
- Event monitoring (admin & user events)
- System metrics

### Neo4j MCP (3 tools)  
- Schema inspection
- Read-only Cypher queries
- Write Cypher operations

## 🌟 Key Features

- **🎯 Intelligent Routing**: Context-aware MCP tool selection
- **⚡ Real-time Updates**: WebSocket-based live dashboard
- **🔒 Security First**: Comprehensive audit trails and compliance checks
- **🌐 German Language**: Native support for German voice commands
- **📊 Graph Analytics**: Advanced pattern detection and visualization
- **🔄 Error Recovery**: Circuit breakers and graceful fallbacks

## 🤝 Contributing

1. Follow the [implementation plan](docs/ikas-implementation-plan.md)
2. Use conventional commits
3. Write tests for new features
4. Update documentation
5. Test with the demo scenarios

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🎪 Amsterdam Demo

Ready for IAM Conference presentation with:
- Live voice command demonstrations
- Real-time graph analytics
- Multi-language compliance analysis
- Interactive system monitoring

---

**Built with ❤️ for the future of IAM administration**