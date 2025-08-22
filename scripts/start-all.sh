#!/bin/bash

# IKAS Complete System Startup Script
# Starts all services in parallel for faster development setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🚀 IKAS - Complete System Startup${NC}"
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
    echo -e "${YELLOW}⚠️  GEMINI_API_KEY not set. AI Gateway will fail to start.${NC}"
    echo "   Set with: export GEMINI_API_KEY=\"your-google-gemini-key\""
    echo "   Continuing in 5 seconds... (Ctrl+C to cancel)"
    sleep 5
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

# Start all services at once
echo -e "\n${YELLOW}🐳 Starting All IKAS Services...${NC}"
cd "$PROJECT_ROOT"

# Stop any existing containers first
echo "Stopping any existing containers..."
docker-compose -f docker/docker-compose.dev.yml down

# Start working services only (skip problematic MCP servers)
echo "Starting working services (skipping broken MCP servers)..."
docker-compose -f docker/docker-compose.dev.yml up -d --no-build postgres redis neo4j keycloak

# Build and start working application services
echo "Building and starting application services..."
docker-compose -f docker/docker-compose.dev.yml build ai-gateway websocket-server
docker-compose -f docker/docker-compose.dev.yml up -d ai-gateway websocket-server

# Wait a moment for containers to initialize
echo -e "\n${YELLOW}⏳ Waiting for services to initialize...${NC}"
sleep 10

# Function to check service health
check_service_health() {
    local service_name=$1
    local container_name=$2
    local health_url=$3
    
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

# Function to check HTTP endpoint
check_http_endpoint() {
    local service_name=$1
    local url=$2
    
    echo -n "Checking $service_name API... "
    if curl -sf "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Responding${NC}"
    else
        echo -e "${RED}❌ Not responding${NC}"
    fi
}

# Display service status
echo -e "\n${BLUE}📊 Service Status Dashboard${NC}"
echo "=================================================="

echo -e "\n${YELLOW}Infrastructure Services:${NC}"
check_service_health "PostgreSQL" "ikas-postgres" ""
check_service_health "Redis" "ikas-redis" ""
check_service_health "Neo4j" "ikas-neo4j" ""
check_service_health "Keycloak" "ikas-keycloak" ""

echo -e "\n${YELLOW}IKAS Services:${NC}"
check_service_health "AI Gateway" "ikas-ai-gateway" ""
check_service_health "WebSocket Server" "ikas-websocket-server" ""

echo -e "\n${RED}❌ Skipped Services (Build Issues):${NC}"
echo "  • Keycloak MCP Server   - TypeScript compilation error"
echo "  • Neo4j MCP Server      - Python dependency issues"

# Wait a bit more and check HTTP endpoints
echo -e "\n${YELLOW}⏳ Waiting 30 seconds for services to fully start...${NC}"
sleep 30

echo -e "\n${YELLOW}HTTP Endpoint Checks:${NC}"
check_http_endpoint "Neo4j Browser" "http://localhost:7474"
check_http_endpoint "Keycloak Admin" "http://localhost:8080/realms/master"
check_http_endpoint "AI Gateway" "http://localhost:8005/health"
check_http_endpoint "WebSocket Server" "http://localhost:3001/health"

# Display access information
echo -e "\n${GREEN}🎉 IKAS System Startup Complete!${NC}"
echo "=================================================="
echo -e "${BLUE}Infrastructure Services:${NC}"
echo "  • Keycloak Admin Console: http://localhost:8080 (admin/admin)"
echo "  • Neo4j Browser:          http://localhost:7474 (neo4j/password)"
echo "  • PostgreSQL:             localhost:5432 (keycloak/keycloak)"
echo "  • Redis:                  localhost:6379"
echo ""
echo -e "${BLUE}Working IKAS Services:${NC}"
echo "  • AI Gateway:             http://localhost:8005/health"
echo "  • WebSocket Server:       http://localhost:3001/health"
echo ""
echo -e "${RED}Skipped Services (Build Issues):${NC}"
echo "  • Keycloak MCP Server:    TypeScript compilation error"
echo "  • Neo4j MCP Server:       Python dependency issues"
echo ""
echo -e "${BLUE}Frontend Development:${NC}"
echo "  • Next.js Frontend:       http://localhost:3000 (after 'cd frontend && npm run dev')"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. cd frontend && npm install && npm run dev"
echo "  2. Open http://localhost:3000"
echo "  3. Test voice command: 'Hey Keycloak, zeige alle Benutzer'"
echo ""
echo -e "${BLUE}Commands:${NC}"
echo "  • View all containers:    docker-compose -f docker/docker-compose.dev.yml ps"
echo "  • View service logs:      docker-compose -f docker/docker-compose.dev.yml logs -f [service]"
echo "  • Restart service:        docker-compose -f docker/docker-compose.dev.yml restart [service]"
echo "  • Stop all services:      docker-compose -f docker/docker-compose.dev.yml down"
echo ""

# Final container status
echo -e "${YELLOW}Final Container Status:${NC}"
docker-compose -f docker/docker-compose.dev.yml ps

echo -e "\n${GREEN}🎤 Ready for German voice commands!${NC}"
echo -e "Say 'Hey Keycloak' to start interacting with the system."