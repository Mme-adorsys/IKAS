#!/bin/bash

# IKAS AI Gateway Hot Deployment Script
# This script provides easy commands for hot deployment development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$(dirname "$PROJECT_DIR")/docker"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop first."
        exit 1
    fi
}

# Function to check if required files exist
check_files() {
    local required_files=(
        "$PROJECT_DIR/Dockerfile.dev"
        "$DOCKER_DIR/docker-compose.dev.yml"
        "$PROJECT_DIR/src/main.ts"
        "$PROJECT_DIR/package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Required file not found: $file"
            exit 1
        fi
    done
}

# Function to build development image
build_dev_image() {
    print_status "Building AI Gateway development image..."
    cd "$DOCKER_DIR"
    docker-compose -f docker-compose.dev.yml build ai-gateway-hot
    print_success "Development image built successfully!"
}

# Function to start hot reload development
start_hot_reload() {
    print_status "Starting AI Gateway with hot reload..."
    cd "$DOCKER_DIR"
    
    # Start dependencies first
    print_status "Starting dependencies (Redis, MCP servers)..."
    docker-compose -f docker-compose.dev.yml up -d redis keycloak-mcp neo4j-mcp
    
    # Wait a moment for dependencies
    sleep 5
    
    # Start AI Gateway with hot reload
    print_status "Starting AI Gateway with hot reload on port 8006..."
    docker-compose -f docker-compose.dev.yml --profile hot-reload up ai-gateway-hot
}

# Function to start in background
start_background() {
    print_status "Starting AI Gateway with hot reload in background..."
    cd "$DOCKER_DIR"
    docker-compose -f docker-compose.dev.yml up -d redis keycloak-mcp neo4j-mcp
    sleep 5
    docker-compose -f docker-compose.dev.yml --profile hot-reload up -d ai-gateway-hot
    print_success "AI Gateway started in background. Access at http://localhost:8006"
    print_status "Use 'docker-compose logs -f ai-gateway-hot' to view logs"
}

# Function to stop hot reload
stop_hot_reload() {
    print_status "Stopping AI Gateway hot reload..."
    cd "$DOCKER_DIR"
    docker-compose -f docker-compose.dev.yml --profile hot-reload down
    print_success "AI Gateway stopped!"
}

# Function to restart hot reload
restart_hot_reload() {
    print_status "Restarting AI Gateway hot reload..."
    stop_hot_reload
    sleep 2
    start_background
}

# Function to show logs
show_logs() {
    print_status "Showing AI Gateway hot reload logs..."
    cd "$DOCKER_DIR"
    docker-compose -f docker-compose.dev.yml logs -f ai-gateway-hot
}

# Function to show status
show_status() {
    cd "$DOCKER_DIR"
    echo -e "\n${BLUE}=== AI Gateway Hot Reload Status ===${NC}"
    echo -e "\n${YELLOW}Container Status:${NC}"
    docker-compose -f docker-compose.dev.yml ps ai-gateway-hot
    
    echo -e "\n${YELLOW}Service Health:${NC}"
    if curl -s http://localhost:8006/health > /dev/null 2>&1; then
        print_success "AI Gateway is healthy at http://localhost:8006"
    else
        print_warning "AI Gateway health check failed or service not running"
    fi
    
    echo -e "\n${YELLOW}Volume Mounts:${NC}"
    docker inspect ikas-ai-gateway-hot 2>/dev/null | jq -r '.[0].Mounts[] | select(.Destination == "/app/src") | "Source: \(.Source) -> Destination: \(.Destination) (Mode: \(.Mode))"' 2>/dev/null || echo "Container not running or jq not installed"
}

# Function to run tests in hot reload environment
run_tests() {
    print_status "Running tests in hot reload environment..."
    cd "$PROJECT_DIR"
    
    # Ensure container is running
    if ! docker ps | grep -q ikas-ai-gateway-hot; then
        print_warning "Hot reload container not running. Starting it..."
        start_background
        sleep 10
    fi
    
    # Run tests inside the container
    docker exec ikas-ai-gateway-hot npm test
}

# Function to exec into container
exec_container() {
    print_status "Opening shell in AI Gateway hot reload container..."
    docker exec -it ikas-ai-gateway-hot sh
}

# Function to clean up
cleanup() {
    print_status "Cleaning up hot reload environment..."
    cd "$DOCKER_DIR"
    docker-compose -f docker-compose.dev.yml --profile hot-reload down -v
    docker system prune -f --filter "label=com.docker.compose.project=docker"
    print_success "Cleanup completed!"
}

# Function to show help
show_help() {
    echo -e "${BLUE}IKAS AI Gateway Hot Deployment Script${NC}\n"
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build       Build the development Docker image"
    echo "  start       Start hot reload development (foreground)"
    echo "  up          Start hot reload development (background)"
    echo "  stop        Stop hot reload development"
    echo "  restart     Restart hot reload development"
    echo "  logs        Show hot reload logs"
    echo "  status      Show service status and health"
    echo "  test        Run tests in hot reload environment"
    echo "  shell       Open shell in hot reload container"
    echo "  cleanup     Clean up containers and volumes"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build        # Build development image"
    echo "  $0 start        # Start in foreground with logs"
    echo "  $0 up           # Start in background"
    echo "  $0 logs         # View logs"
    echo "  $0 status       # Check service status"
}

# Main script logic
main() {
    case "${1:-help}" in
        build)
            check_docker
            check_files
            build_dev_image
            ;;
        start)
            check_docker
            check_files
            start_hot_reload
            ;;
        up)
            check_docker
            check_files
            start_background
            ;;
        stop)
            check_docker
            stop_hot_reload
            ;;
        restart)
            check_docker
            restart_hot_reload
            ;;
        logs)
            check_docker
            show_logs
            ;;
        status)
            check_docker
            show_status
            ;;
        test)
            check_docker
            run_tests
            ;;
        shell)
            check_docker
            exec_container
            ;;
        cleanup)
            check_docker
            cleanup
            ;;
        help)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"