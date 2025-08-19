#!/bin/bash

# IKAS Docker Health Check Script
# Verifies all required services are running and healthy

set -e

echo "🔍 IKAS Health Check - Verifying all services..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name..."
    
    if curl -sf -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        echo -e " ${GREEN}✅ Healthy${NC}"
        return 0
    else
        echo -e " ${RED}❌ Unhealthy${NC}"
        return 1
    fi
}

# Function to check TCP port
check_port() {
    local service_name=$1
    local host=$2
    local port=$3
    
    echo -n "Checking $service_name (TCP $port)..."
    
    if nc -z "$host" "$port" 2>/dev/null; then
        echo -e " ${GREEN}✅ Available${NC}"
        return 0
    else
        echo -e " ${RED}❌ Unavailable${NC}"
        return 1
    fi
}

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check PostgreSQL
echo -e "\n${YELLOW}📊 Database Services:${NC}"
check_port "PostgreSQL" "localhost" "5432"

# Check Redis
check_port "Redis" "localhost" "6379"

# Check Neo4j
check_port "Neo4j Bolt" "localhost" "7687"
check_service "Neo4j Browser" "http://localhost:7474"

# Check Keycloak
echo -e "\n${YELLOW}🔐 Identity Services:${NC}"
check_service "Keycloak Admin" "http://localhost:8080/realms/master"

# Check MCP Services (if they have HTTP endpoints)
echo -e "\n${YELLOW}🤖 MCP Services:${NC}"
if docker ps --format "table {{.Names}}" | grep -q "ikas-keycloak-mcp"; then
    check_service "Keycloak MCP" "http://localhost:8001/health"
else
    echo -e "Keycloak MCP: ${YELLOW}⚠️  Running in stdio mode${NC}"
fi

if docker ps --format "table {{.Names}}" | grep -q "ikas-neo4j-mcp"; then
    check_service "Neo4j MCP" "http://localhost:8002/health"
else
    echo -e "Neo4j MCP: ${YELLOW}⚠️  Running in stdio mode${NC}"
fi

# Docker container status
echo -e "\n${YELLOW}🐳 Container Status:${NC}"
docker-compose -f docker/docker-compose.dev.yml ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"

# Final status
echo -e "\n=================================================="
if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 All IKAS services are healthy and ready!${NC}"
    echo -e "\n📝 Access URLs:"
    echo -e "   • Keycloak Admin: http://localhost:8080 (admin/admin)"
    echo -e "   • Neo4j Browser:  http://localhost:7474 (neo4j/password)"
    echo -e "   • Redis CLI:      redis-cli -h localhost -p 6379"
    exit 0
else
    echo -e "${RED}❌ Some services are not healthy. Check logs with:${NC}"
    echo -e "   docker-compose -f docker/docker-compose.dev.yml logs [service-name]"
    exit 1
fi