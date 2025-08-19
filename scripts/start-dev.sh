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
echo -e "${BLUE}Access URLs:${NC}"
echo "  • Keycloak Admin Console: http://localhost:8080 (admin/admin)"
echo "  • Neo4j Browser:          http://localhost:7474 (neo4j/password)"
echo "  • PostgreSQL:             localhost:5432 (keycloak/keycloak)"
echo "  • Redis:                  localhost:6379"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Start AI Gateway development (Phase 1)"
echo "  2. Implement voice interface (Phase 2)"
echo "  3. Build frontend dashboard (Phase 3)"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  • View logs:       docker-compose -f docker/docker-compose.dev.yml logs [service]"
echo "  • Stop services:   docker-compose -f docker/docker-compose.dev.yml down"
echo "  • Restart service: docker-compose -f docker/docker-compose.dev.yml restart [service]"
echo ""
echo "Happy coding! 🚀"