#!/bin/bash
# Development Environment Management
# Usage: ./vibecode dev [subcommand] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
WITH_DB=false
WITH_REDIS=false
WITH_MONITORING=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-db)
            WITH_DB=true
            shift
            ;;
        --with-redis)
            WITH_REDIS=true
            shift
            ;;
        --with-monitoring)
            WITH_MONITORING=true
            shift
            ;;
        *)
            SUBCOMMAND="$1"
            shift
            ;;
    esac
done

case "$SUBCOMMAND" in
    start)
        print_status "Starting development environment..."
        
        # Start Docker Compose for development
        cd docker
        COMPOSE_FILE="docker-compose.dev.yml"
        
        # Add additional services based on options
        if [ "$WITH_DB" = true ]; then
            print_status "Including database services..."
        fi
        
        if [ "$WITH_REDIS" = true ]; then
            print_status "Including Redis services..."
        fi
        
        if [ "$WITH_MONITORING" = true ]; then
            print_status "Including monitoring services..."
        fi
        
        docker-compose -f "$COMPOSE_FILE" up -d
        print_success "Development environment started!"
        ;;
        
    stop)
        print_status "Stopping development environment..."
        cd docker
        docker-compose -f docker-compose.dev.yml down
        print_success "Development environment stopped!"
        ;;
        
    restart)
        print_status "Restarting development environment..."
        cd docker
        docker-compose -f docker-compose.dev.yml restart
        print_success "Development environment restarted!"
        ;;
        
    status)
        print_status "Development environment status:"
        cd docker
        docker-compose -f docker-compose.dev.yml ps
        ;;
        
    logs)
        print_status "Showing development logs..."
        cd docker
        docker-compose -f docker-compose.dev.yml logs -f
        ;;
        
    shell)
        print_status "Opening development shell..."
        cd docker
        docker-compose -f docker-compose.dev.yml exec webgui /bin/sh
        ;;
        
    *)
        print_error "Unknown subcommand: $SUBCOMMAND"
        echo "Available subcommands: start, stop, restart, status, logs, shell"
        exit 1
        ;;
esac
