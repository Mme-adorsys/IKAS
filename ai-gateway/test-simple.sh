#!/bin/bash

# Einfacher Test-Runner ohne Docker Build Issues
# Startet nur Keycloak und Neo4j, nutzt lokale MCP Services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Starting Simple Integration Tests${NC}"
echo "================================================"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    # Kill mock services
    kill $KEYCLOAK_MCP_PID $NEO4J_MCP_PID 2>/dev/null || true
    # Stop docker services
    docker-compose -f test-basic-services.yml down --volumes 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Kill any existing processes on test ports
echo -e "${YELLOW}🔧 Cleaning up existing processes...${NC}"
lsof -ti:8003 | xargs kill -9 2>/dev/null || true
lsof -ti:8004 | xargs kill -9 2>/dev/null || true

# Create basic services docker-compose
cat > test-basic-services.yml << 'EOF'
services:
  postgres:
    image: postgres:15-alpine
    ports: ["5433:5432"]
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: keycloak
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U keycloak"]
      interval: 5s
      timeout: 5s
      retries: 10

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    ports: ["8081:8080"]
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: keycloak
      KC_HOSTNAME_STRICT: false
      KC_HOSTNAME_STRICT_HTTPS: false
      KC_HTTP_ENABLED: true
    command: start-dev
    depends_on:
      postgres: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/realms/master || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 10

  neo4j:
    image: neo4j:5.15
    ports: ["7475:7474", "7688:7687"]
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["apoc"]'
      NEO4J_ACCEPT_LICENSE_AGREEMENT: yes
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -u neo4j -p password 'RETURN 1' || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 15

  redis:
    image: redis:7.2-alpine
    ports: ["6380:6379"]
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping"]
      interval: 5s
      timeout: 5s
      retries: 10
EOF

# Start basic services
echo -e "\n${YELLOW}🐳 Starting Basic Services...${NC}"
docker-compose -f test-basic-services.yml up -d

# Wait for services
wait_for_container() {
    local container_name=$1
    echo -n "Waiting for $container_name"
    for i in {1..60}; do
        if docker ps | grep -q "$container_name"; then
            echo -e " ${GREEN}✅${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    echo -e " ${RED}❌${NC}"
    return 1
}

wait_for_container "postgres"
wait_for_container "keycloak"
wait_for_container "neo4j"
wait_for_container "redis"

echo -e "\n${GREEN}✅ Basic services are running!${NC}"

# Create mock MCP services
echo -e "\n${YELLOW}🔧 Starting Mock MCP Services...${NC}"

# Enhanced Keycloak MCP mock server
node -e "
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Health endpoint that matches expected format
app.get('/health', (req, res) => res.status(200).json({ 
  status: 'healthy',
  service: 'keycloak-mcp-server',
  version: '1.0.0',
  timestamp: new Date().toISOString()
}));

app.get('/tools', (req, res) => res.json({ tools: ['list-users', 'create-user'] }));
app.post('/tools/list-users', (req, res) => res.json({ 
  success: true, 
  users: [{ id: '1', username: 'testuser', email: 'test@example.com' }] 
}));

app.listen(8003, () => console.log('Enhanced Mock Keycloak MCP on 8003'));
" &

KEYCLOAK_MCP_PID=$!

# Enhanced Neo4j MCP mock server  
node -e "
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Health endpoint that matches expected format
app.get('/health', (req, res) => res.status(200).json({ 
  status: 'healthy',
  service: 'neo4j-mcp-server', 
  version: '1.0.0',
  timestamp: new Date().toISOString()
}));

app.get('/tools', (req, res) => res.json({ tools: ['query_read', 'get_neo4j_schema'] }));
app.post('/tools/query_read', (req, res) => res.json({ 
  success: true, 
  records: [], 
  summary: { resultAvailableAfter: 5, resultConsumedAfter: 10 }
}));

app.listen(8004, () => console.log('Enhanced Mock Neo4j MCP on 8004'));
" &

NEO4J_MCP_PID=$!

# Wait for mock services
sleep 3

# Verify mock services
echo -e "\n${YELLOW}🔍 Verifying Mock Services...${NC}"
curl -f http://localhost:8003/health && echo -e " ${GREEN}Keycloak MCP OK${NC}"
curl -f http://localhost:8004/health && echo -e " ${GREEN}Neo4j MCP OK${NC}"

# Set test environment
export NODE_ENV=test
export KEYCLOAK_MCP_URL=http://localhost:8003
export NEO4J_MCP_URL=http://localhost:8004
export REDIS_URL=redis://localhost:6380
export GEMINI_API_KEY=test-key

# Run integration tests
echo -e "\n${YELLOW}🧪 Running Integration Tests...${NC}"
npm test -- --testPathPattern=integration --verbose

TEST_EXIT_CODE=$?

# Cleanup mock services
kill $KEYCLOAK_MCP_PID $NEO4J_MCP_PID 2>/dev/null || true

echo -e "\n${BLUE}📊 Test Results Summary${NC}"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Integration tests passed with mock services!${NC}"
else
    echo -e "${RED}❌ Some tests failed${NC}"
fi

exit $TEST_EXIT_CODE
" >test-simple.sh && chmod +x test-simple.sh

echo "Simple test runner created!"