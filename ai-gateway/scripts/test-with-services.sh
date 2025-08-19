#!/bin/bash

# IKAS AI Gateway - Integration Tests mit Docker Services
# Startet alle erforderlichen Services und führt Integration Tests aus

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}🧪 Starting IKAS Integration Tests with Services${NC}"
echo "Project Root: $PROJECT_ROOT"
echo "==========================================================="

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=${3:-60}
    local attempt=1
    
    echo -n "Waiting for $service_name to be ready"
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✅${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo -e " ${RED}❌ Timeout${NC}"
    return 1
}

# Function to check docker container health
wait_for_container_health() {
    local container_name=$1
    local max_attempts=${2:-60}
    local attempt=1
    
    echo -n "Waiting for $container_name to be healthy"
    while [ $attempt -le $max_attempts ]; do
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
        if [ "$health_status" = "healthy" ]; then
            echo -e " ${GREEN}✅${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo -e " ${RED}❌ Timeout${NC}"
    return 1
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up test environment...${NC}"
    cd "$PROJECT_ROOT"
    
    # Stop test containers
    docker-compose -f docker/docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Check prerequisites
echo -e "\n${YELLOW}🔍 Checking Prerequisites...${NC}"

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is required but not installed${NC}"
    exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose is required but not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites satisfied${NC}"

# Set environment variables for tests
echo -e "\n${YELLOW}🔧 Setting Test Environment...${NC}"
export NODE_ENV=test
export KEYCLOAK_MCP_URL=http://localhost:8001
export NEO4J_MCP_URL=http://localhost:8002
export REDIS_URL=redis://localhost:6379
export GEMINI_API_KEY=test-key-placeholder

# Start infrastructure services
echo -e "\n${YELLOW}🐳 Starting Infrastructure Services...${NC}"
cd "$PROJECT_ROOT"

# Create test-specific docker-compose config
cat > docker/docker-compose.test.yml << EOF
version: '3.8'

services:
  # Core infrastructure services
  postgres:
    image: postgres:15-alpine
    container_name: ikas-test-postgres
    ports:
      - "5433:5432"  # Different port to avoid conflicts
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: keycloak
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U keycloak"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7.2-alpine
    container_name: ikas-test-redis
    ports:
      - "6380:6379"  # Different port to avoid conflicts
    command: redis-server --appendonly no --maxmemory 128mb
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  neo4j:
    image: neo4j:5.15
    container_name: ikas-test-neo4j
    ports:
      - "7475:7474"  # Different ports to avoid conflicts
      - "7688:7687"
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["apoc"]'
      NEO4J_ACCEPT_LICENSE_AGREEMENT: yes
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -u neo4j -p password 'RETURN 1' || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 15

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    container_name: ikas-test-keycloak
    ports:
      - "8081:8080"  # Different port to avoid conflicts
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
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/realms/master || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 10

  # MCP Services
  keycloak-mcp:
    build:
      context: ../keycloak-mcp-server
      dockerfile: Dockerfile
    container_name: ikas-test-keycloak-mcp
    ports:
      - "8001:8001"
    environment:
      KEYCLOAK_URL: http://keycloak:8080
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      PORT: 8001
      NODE_ENV: test
    depends_on:
      keycloak:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8001/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  neo4j-mcp:
    build:
      context: ../mcp-neo4j
      dockerfile: Dockerfile
    container_name: ikas-test-neo4j-mcp
    ports:
      - "8002:8000"  # Map container 8000 to host 8002
    environment:
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USERNAME: neo4j
      NEO4J_PASSWORD: password
      NEO4J_DATABASE: neo4j
      NEO4J_MCP_SERVER_PORT: 8000
      NEO4J_TRANSPORT: http
    depends_on:
      neo4j:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  postgres_test_data:
  neo4j_test_data:

networks:
  default:
    name: ikas-test-network
EOF

# Start all services
docker-compose -f docker/docker-compose.test.yml up -d --build

echo -e "\n${YELLOW}⏳ Waiting for all services to be ready...${NC}"

# Wait for infrastructure services
wait_for_container_health "ikas-test-postgres"
wait_for_container_health "ikas-test-redis"
wait_for_container_health "ikas-test-neo4j"
wait_for_container_health "ikas-test-keycloak"

# Wait for MCP services
wait_for_container_health "ikas-test-keycloak-mcp"
wait_for_container_health "ikas-test-neo4j-mcp"

# Verify services are responding
echo -e "\n${YELLOW}🔍 Verifying Service Endpoints...${NC}"
wait_for_service "Keycloak MCP" "http://localhost:8001/health" 10
wait_for_service "Neo4j MCP" "http://localhost:8002/health" 10

# Display service status
echo -e "\n${GREEN}🎉 All Services Ready!${NC}"
echo "============================================="
echo -e "${BLUE}Service URLs:${NC}"
echo "  • Keycloak:     http://localhost:8081 (admin/admin)"
echo "  • Neo4j:        http://localhost:7475 (neo4j/password)"
echo "  • PostgreSQL:   localhost:5433 (keycloak/keycloak)"
echo "  • Redis:        localhost:6380"
echo "  • Keycloak MCP: http://localhost:8001/health"
echo "  • Neo4j MCP:    http://localhost:8002/health"

# Run tests
echo -e "\n${YELLOW}🧪 Running Integration Tests...${NC}"
cd "$PROJECT_ROOT/ai-gateway"

# Update environment for tests
export KEYCLOAK_MCP_URL=http://localhost:8001
export NEO4J_MCP_URL=http://localhost:8002
export REDIS_URL=redis://localhost:6380

# Run the actual tests
npm test -- --testPathPattern=integration --verbose --detectOpenHandles

# Capture test results
TEST_EXIT_CODE=$?

# Display results
echo -e "\n${BLUE}📊 Test Results Summary${NC}"
echo "============================================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All integration tests passed!${NC}"
    echo -e "${GREEN}🎯 AI Gateway is ready for Phase 2${NC}"
else
    echo -e "${RED}❌ Some integration tests failed${NC}"
    echo -e "${YELLOW}⚠️  Check logs above for details${NC}"
fi

# Keep services running for manual testing if requested
if [ "$KEEP_SERVICES" = "true" ]; then
    echo -e "\n${YELLOW}🔄 Services will keep running for manual testing...${NC}"
    echo "Stop with: docker-compose -f docker/docker-compose.test.yml down"
    trap - EXIT  # Remove cleanup trap
fi

exit $TEST_EXIT_CODE