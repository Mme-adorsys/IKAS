#!/bin/bash

# IKAS Development Environment Startup Script
# This script starts all required services for IKAS development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🚀 Starting IKAS Development Environment${NC}"
echo "Project Root: $PROJECT_ROOT"
echo "=================================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=${3:-30}
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

# Check prerequisites
echo -e "\n${YELLOW}🔍 Checking Prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is required but not installed${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is required but not installed${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is required but not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is required but not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites satisfied${NC}"

# Set environment variables
echo -e "\n${YELLOW}🔧 Setting Environment Variables...${NC}"
export KEYCLOAK_URL="http://localhost:8080"
export KEYCLOAK_ADMIN="admin"
export KEYCLOAK_ADMIN_PASSWORD="admin"
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USERNAME="neo4j"
export NEO4J_PASSWORD="password"
export NEO4J_DATABASE="neo4j"
export REDIS_URL="redis://localhost:6379"

# Start Docker services
echo -e "\n${YELLOW}🐳 Starting Docker Services...${NC}"
cd "$PROJECT_ROOT"

# Stop any existing containers (keep volumes and data)
docker-compose -f docker/docker-compose.dev.yml stop

# Start infrastructure services
docker-compose -f docker/docker-compose.dev.yml up -d postgres redis neo4j keycloak

# Wait for core services
echo -e "\n${YELLOW}⏳ Waiting for Core Services...${NC}"

# Wait for PostgreSQL using docker health check
echo -n "Waiting for PostgreSQL to be ready"
while [ "$(docker inspect --format='{{.State.Health.Status}}' ikas-postgres 2>/dev/null)" != "healthy" ]; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✅${NC}"

# Wait for Redis using docker health check
echo -n "Waiting for Redis to be ready"
while [ "$(docker inspect --format='{{.State.Health.Status}}' ikas-redis 2>/dev/null)" != "healthy" ]; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✅${NC}"
wait_for_service "Neo4j" "http://localhost:7474" 30
wait_for_service "Keycloak" "http://localhost:8080/realms/master" 60

# Check Keycloak health using Docker health status with timeout
echo -n "Waiting for Keycloak to be healthy"
keycloak_attempts=0
max_keycloak_attempts=30
while [ $keycloak_attempts -lt $max_keycloak_attempts ]; do
    keycloak_health=$(docker inspect --format='{{.State.Health.Status}}' ikas-keycloak 2>/dev/null || echo "unknown")
    if [ "$keycloak_health" = "healthy" ]; then
        echo -e " ${GREEN}✅${NC}"
        break
    elif [ "$keycloak_health" = "unhealthy" ]; then
        echo -e " ${YELLOW}⚠️  Keycloak is running but health check failed. Continuing...${NC}"
        break
    else
        echo -n "."
        sleep 3
        ((keycloak_attempts++))
    fi
done

if [ $keycloak_attempts -eq $max_keycloak_attempts ]; then
    echo -e " ${YELLOW}⚠️  Keycloak health check timeout. Continuing anyway...${NC}"
fi

# Start MCP servers
echo -e "\n${YELLOW}🔧 Starting MCP Servers...${NC}"
docker-compose -f docker/docker-compose.dev.yml up -d keycloak-mcp neo4j-mcp

# Wait for MCP servers with timeout
echo -n "Waiting for Keycloak MCP to be ready"
mcp_attempts=0
max_mcp_attempts=20
while [ $mcp_attempts -lt $max_mcp_attempts ]; do
    keycloak_mcp_health=$(docker inspect --format='{{.State.Health.Status}}' ikas-keycloak-mcp 2>/dev/null || echo "unknown")
    if [ "$keycloak_mcp_health" = "healthy" ]; then
        echo -e " ${GREEN}✅${NC}"
        break
    else
        echo -n "."
        sleep 3
        ((mcp_attempts++))
    fi
done
if [ $mcp_attempts -eq $max_mcp_attempts ]; then
    echo -e " ${YELLOW}⚠️  Timeout, continuing...${NC}"
fi

echo -n "Waiting for Neo4j MCP to be ready"
neo4j_mcp_attempts=0
while [ $neo4j_mcp_attempts -lt $max_mcp_attempts ]; do
    neo4j_mcp_health=$(docker inspect --format='{{.State.Health.Status}}' ikas-neo4j-mcp 2>/dev/null || echo "unknown")
    if [ "$neo4j_mcp_health" = "healthy" ]; then
        echo -e " ${GREEN}✅${NC}"
        break
    else
        echo -n "."
        sleep 3
        ((neo4j_mcp_attempts++))
    fi
done
if [ $neo4j_mcp_attempts -eq $max_mcp_attempts ]; then
    echo -e " ${YELLOW}⚠️  Timeout, continuing...${NC}"
fi

# Start AI Gateway (requires GEMINI_API_KEY)
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  GEMINI_API_KEY not set. Please set it in your environment or .env file${NC}"
    echo "   You can start AI Gateway manually later with: docker-compose -f docker/docker-compose.dev.yml up -d ai-gateway"
else
    echo -e "\n${YELLOW}🧠 Starting AI Gateway...${NC}"
    docker-compose -f docker/docker-compose.dev.yml up -d ai-gateway
    
    echo -n "Waiting for AI Gateway to be ready"
    ai_gateway_attempts=0
    max_ai_attempts=20
    while [ $ai_gateway_attempts -lt $max_ai_attempts ]; do
        ai_gateway_health=$(docker inspect --format='{{.State.Health.Status}}' ikas-ai-gateway 2>/dev/null || echo "unknown")
        if [ "$ai_gateway_health" = "healthy" ]; then
            echo -e " ${GREEN}✅${NC}"
            break
        else
            echo -n "."
            sleep 3
            ((ai_gateway_attempts++))
        fi
    done
    if [ $ai_gateway_attempts -eq $max_ai_attempts ]; then
        echo -e " ${YELLOW}⚠️  Timeout, continuing...${NC}"
    fi
fi

# Start WebSocket Server
echo -e "\n${YELLOW}🌐 Starting WebSocket Server...${NC}"
docker-compose -f docker/docker-compose.dev.yml up -d websocket-server

echo -n "Waiting for WebSocket Server to be ready"
websocket_attempts=0
max_websocket_attempts=20
while [ $websocket_attempts -lt $max_websocket_attempts ]; do
    websocket_health=$(docker inspect --format='{{.State.Health.Status}}' ikas-websocket-server 2>/dev/null || echo "unknown")
    if [ "$websocket_health" = "healthy" ]; then
        echo -e " ${GREEN}✅${NC}"
        break
    else
        echo -n "."
        sleep 3
        ((websocket_attempts++))
    fi
done
if [ $websocket_attempts -eq $max_websocket_attempts ]; then
    echo -e " ${YELLOW}⚠️  Timeout, continuing...${NC}"
fi

# Build and install dependencies
echo -e "\n${YELLOW}📦 Installing Dependencies...${NC}"

# Shared types
if [ -d "$PROJECT_ROOT/shared-types" ]; then
    echo "Installing shared-types dependencies..."
    cd "$PROJECT_ROOT/shared-types"
    npm install
    npm run build
fi

# Keycloak MCP Server
if [ -d "$PROJECT_ROOT/keycloak-mcp-server" ]; then
    echo "Building Keycloak MCP Server..."
    cd "$PROJECT_ROOT/keycloak-mcp-server"
    npm install
    npm run build
fi

# Neo4j MCP Server
if [ -d "$PROJECT_ROOT/mcp-neo4j" ]; then
    echo "Setting up Neo4j MCP Server..."
    cd "$PROJECT_ROOT/mcp-neo4j"
    if command_exists uv; then
        uv sync
    else
        echo -e "${YELLOW}⚠️  uv not found, using pip instead${NC}"
        pip install -r requirements.txt || echo -e "${YELLOW}⚠️  No requirements.txt found${NC}"
    fi
fi

# Run integration tests
echo -e "\n${YELLOW}🧪 Running Integration Tests...${NC}"
cd "$PROJECT_ROOT"

if [ -f "tests/mcp-integration-test.js" ]; then
    node tests/mcp-integration-test.js
else
    echo -e "${YELLOW}⚠️  Integration tests not found, skipping...${NC}"
fi

# Run health check
echo -e "\n${YELLOW}🏥 Running Health Check...${NC}"
if [ -f "docker/health-check.sh" ]; then
    bash docker/health-check.sh
else
    echo -e "${YELLOW}⚠️  Health check script not found${NC}"
fi

# Display access information
echo -e "\n${GREEN}🎉 IKAS Development Environment Started Successfully!${NC}"
echo "=================================================="
echo -e "${BLUE}Infrastructure Services:${NC}"
echo "  • Keycloak Admin Console: http://localhost:8080 (admin/admin)"
echo "  • Neo4j Browser:          http://localhost:7474 (neo4j/password)"
echo "  • PostgreSQL:             localhost:5432 (keycloak/keycloak)"
echo "  • Redis:                  localhost:6379"
echo ""
echo -e "${BLUE}IKAS Services:${NC}"
echo "  • Keycloak MCP Server:    http://localhost:8001"
echo "  • Neo4j MCP Server:       http://localhost:8002"
echo "  • AI Gateway:             http://localhost:8005"
echo "  • WebSocket Server:       http://localhost:3001"
echo ""
echo -e "${BLUE}Frontend Development:${NC}"
echo "  • Next.js Frontend:       http://localhost:3000 (after 'npm run dev' in /frontend)"
echo "  • Voice Test Client:      http://localhost:8080/test-client.html"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. cd frontend && npm install && npm run dev"
echo "  2. Test voice interface: 'Hey Keycloak, zeige alle Benutzer'"
echo "  3. Monitor WebSocket connection in browser console"
echo ""
echo -e "${BLUE}Troubleshooting:${NC}"
echo "  • Check WebSocket connection: curl http://localhost:3001/health"
echo "  • View service logs:          docker-compose -f docker/docker-compose.dev.yml logs [service]"
echo "  • Restart services:           docker-compose -f docker/docker-compose.dev.yml restart [service]"
echo "  • Stop all services:          docker-compose -f docker/docker-compose.dev.yml down"
echo ""
echo -e "${GREEN}🎤 Ready for German voice commands! Say 'Hey Keycloak' to get started.${NC}"