#!/bin/bash

# IKAS Working Services Startup Script
# Starts only the services that are known to work

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🚀 IKAS - Working Services Startup${NC}"
echo "Project Root: $PROJECT_ROOT"
echo "=================================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
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

echo -e "${GREEN}✅ All prerequisites satisfied${NC}"

# Check for GEMINI_API_KEY
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  GEMINI_API_KEY not set. Setting dummy key for demonstration.${NC}"
    export GEMINI_API_KEY="dummy-key-for-testing"
fi

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

# Start working services
echo -e "\n${YELLOW}🐳 Starting Working IKAS Services...${NC}"
cd "$PROJECT_ROOT"

# Stop any existing containers first
echo "Stopping any existing containers..."
docker-compose -f docker/docker-compose.dev.yml down 2>/dev/null || true

# Start only infrastructure services (these always work)
echo "Starting infrastructure services..."
docker-compose -f docker/docker-compose.dev.yml up -d --no-build postgres redis neo4j keycloak

# Wait for infrastructure
echo -e "\n${YELLOW}⏳ Waiting for infrastructure services...${NC}"
sleep 15

# Start the working services we built successfully
echo -e "\n${YELLOW}🔧 Starting Application Services...${NC}"

# Start WebSocket Server 
echo "Starting WebSocket Server..."
if docker image inspect docker-websocket-server >/dev/null 2>&1; then
    docker run -d --name ikas-websocket-server-manual \
        --network ikas-network \
        -p 3001:3001 \
        -e REDIS_URL=redis://redis:6379 \
        -e NODE_ENV=development \
        -e PORT=3001 \
        docker-websocket-server
    echo -e "${GREEN}✅ WebSocket Server started${NC}"
else
    echo -e "${YELLOW}⚠️  WebSocket Server image not found, skipping${NC}"
fi

# Start AI Gateway
echo "Starting AI Gateway..."
if docker image inspect docker-ai-gateway >/dev/null 2>&1; then
    docker run -d --name ikas-ai-gateway-manual \
        --network ikas-network \
        -p 8005:8005 \
        -e GEMINI_API_KEY="$GEMINI_API_KEY" \
        -e REDIS_URL=redis://redis:6379 \
        -e NODE_ENV=development \
        -e PORT=8005 \
        docker-ai-gateway
    echo -e "${GREEN}✅ AI Gateway started${NC}"
else
    echo -e "${YELLOW}⚠️  AI Gateway image not found, skipping${NC}"
fi

# Wait for services to initialize
echo -e "\n${YELLOW}⏳ Waiting for services to initialize...${NC}"
sleep 10

# Function to check service health
check_service_health() {
    local service_name=$1
    local container_name=$2
    
    echo -n "Checking $service_name... "
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        echo -e "${RED}❌ Not running${NC}"
        return 1
    fi
    
    # Check Docker health status if available
    health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "no-health")
    
    if [ "$health_status" = "healthy" ]; then
        echo -e "${GREEN}✅ Healthy${NC}"
    elif [ "$health_status" = "starting" ]; then
        echo -e "${YELLOW}🔄 Starting...${NC}"
    elif [ "$health_status" = "unhealthy" ]; then
        echo -e "${RED}❌ Unhealthy${NC}"
    else
        # No health check defined, check if container is running
        echo -e "${BLUE}🔵 Running${NC}"
    fi
}

# Display service status
echo -e "\n${BLUE}📊 Service Status Dashboard${NC}"
echo "=================================================="

echo -e "\n${YELLOW}Infrastructure Services:${NC}"
check_service_health "PostgreSQL" "ikas-postgres"
check_service_health "Redis" "ikas-redis"
check_service_health "Neo4j" "ikas-neo4j"
check_service_health "Keycloak" "ikas-keycloak"

echo -e "\n${YELLOW}Application Services:${NC}"
check_service_health "WebSocket Server" "ikas-websocket-server-manual"
check_service_health "AI Gateway" "ikas-ai-gateway-manual"

echo -e "\n${RED}❌ Skipped Services (Build Issues):${NC}"
echo "  • Keycloak MCP Server   - TypeScript compilation error"
echo "  • Neo4j MCP Server      - Python dependency issues"

# Display access information
echo -e "\n${GREEN}🎉 Working IKAS Services Started!${NC}"
echo "=================================================="
echo -e "${BLUE}Infrastructure Access:${NC}"
echo "  • Keycloak Admin Console: http://localhost:8080 (admin/admin)"
echo "  • Neo4j Browser:          http://localhost:7474 (neo4j/password)"
echo "  • PostgreSQL:             localhost:5432 (keycloak/keycloak)"
echo "  • Redis:                  localhost:6379"
echo ""
echo -e "${BLUE}Application Services:${NC}"
echo "  • AI Gateway:             http://localhost:8005/health"
echo "  • WebSocket Server:       http://localhost:3001/health"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Start the frontend:"
echo "     cd frontend && npm install && npm run dev"
echo "  2. Open http://localhost:3000"
echo "  3. The voice interface will work with AI Gateway"
echo ""
echo -e "${BLUE}Manual Commands:${NC}"
echo "  • View all containers:    docker ps"
echo "  • View service logs:      docker logs [container-name]"
echo "  • Stop services:          docker stop \$(docker ps -q)"
echo "  • Clean up:               docker system prune"
echo ""

# Final container status
echo -e "${YELLOW}Current Container Status:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(ikas|NAMES)"

echo -e "\n${GREEN}🎤 Ready for Development!${NC}"
echo -e "Most services are running. You can develop the frontend and test the voice interface."