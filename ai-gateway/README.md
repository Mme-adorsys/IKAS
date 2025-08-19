# IKAS AI Gateway

The AI Gateway is the central orchestration service for IKAS (Intelligentes Keycloak Admin System), providing intelligent routing and coordination between LLM (Google Gemini) and MCP (Model Context Protocol) services.

## Features

- **Express.js/TypeScript**: Modern, type-safe web server
- **Google Gemini Integration**: LLM with function calling for natural language processing
- **Dynamic MCP Tool Discovery**: Auto-discovery of Keycloak and Neo4j MCP tools
- **Intelligent Routing**: Context-aware routing based on user intent
- **Data Synchronization**: Automatic sync between Keycloak and Neo4j
- **Health Monitoring**: Comprehensive health checks and service monitoring
- **Circuit Breakers**: Resilient error handling and recovery

## Quick Start

### Prerequisites

- Node.js 18+
- Running MCP services:
  - Keycloak MCP server on port 8001
  - Neo4j MCP server on port 8002
- Google Gemini API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
# GEMINI_API_KEY is required!
```

### Development

```bash
# Start in development mode with hot reload
npm run dev

# Run tests
npm test
npm run test:integration

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

### Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build Docker image
docker build -t ikas-ai-gateway .

# Run container
docker run -p 8000:8000 \
  -e GEMINI_API_KEY=your-key \
  -e KEYCLOAK_MCP_URL=http://keycloak-mcp:8001 \
  -e NEO4J_MCP_URL=http://neo4j-mcp:8002 \
  ikas-ai-gateway
```

## API Endpoints

### Health Check
- `GET /health` - Comprehensive health status
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

### Chat Interface
- `POST /api/chat` - Main chat endpoint for natural language interaction
- `DELETE /api/chat/:sessionId` - Clear chat session

### Tool Management
- `GET /api/tools` - Discover available MCP tools
- `POST /api/tools/refresh` - Refresh tool cache

### System Management
- `GET /api/status` - Orchestrator status
- `POST /api/cleanup` - Cleanup old sessions

## Usage Examples

### Basic Chat Request

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Zeige alle Benutzer im master Realm",
    "sessionId": "my-session",
    "context": {
      "realm": "master",
      "preferredLanguage": "de"
    }
  }'
```

### Tool Discovery

```bash
curl http://localhost:8000/api/tools
```

### Health Check

```bash
curl http://localhost:8000/health
```

## Configuration

Environment variables (see `.env.example`):

- `GEMINI_API_KEY` - Google Gemini API key (required)
- `KEYCLOAK_MCP_URL` - Keycloak MCP service URL
- `NEO4J_MCP_URL` - Neo4j MCP service URL
- `PORT` - Server port (default: 8000)
- `NODE_ENV` - Environment (development/production/test)

## Architecture

The AI Gateway follows a layered architecture:

1. **API Layer** (`src/api/`) - Express.js routes and middleware
2. **Orchestration Layer** (`src/orchestration/`) - Request routing and coordination
3. **LLM Layer** (`src/llm/`) - Google Gemini integration and tool discovery
4. **MCP Layer** (`src/mcp/`) - MCP client implementations
5. **Utils Layer** (`src/utils/`) - Configuration, logging, and utilities

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=unit
npm test -- --testPathPattern=integration

# Run tests with coverage
npm test -- --coverage

# Watch mode for development
npm run test:watch
```

## Monitoring

The AI Gateway provides comprehensive monitoring:

- **Health Checks**: Service dependency monitoring
- **Metrics**: Request duration, error rates, active sessions
- **Logging**: Structured logging with Winston
- **Circuit Breakers**: Automatic failure recovery

## German Language Support

IKAS is designed for German language interaction:

- System instructions in German
- German keyword recognition for routing
- Localized error messages
- Voice command support ("Hey Keycloak")

## Development

### Project Structure

```
ai-gateway/
├── src/
│   ├── api/              # Express.js routes
│   ├── llm/              # LLM integration
│   ├── mcp/              # MCP clients
│   ├── orchestration/    # Business logic
│   ├── types/            # TypeScript definitions
│   ├── utils/            # Utilities
│   └── main.ts           # Application entry point
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── setup.ts          # Test configuration
├── Dockerfile            # Container configuration
└── README.md
```

### Adding New MCP Tools

1. Update client classes in `src/mcp/`
2. Add type definitions in `src/types/`
3. Update tool discovery in `src/llm/tool-discovery.ts`
4. Add tests in `tests/`

### Contributing

1. Follow TypeScript best practices
2. Write tests for new functionality  
3. Use conventional commits
4. Update documentation

## License

MIT License - see LICENSE file for details.