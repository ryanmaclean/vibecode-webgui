#!/bin/bash
# Docker Operations
# Usage: ./vibecode docker [subcommand] [options]

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
TARGET="production"
TAG="vibecode-webgui"
PUSH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="$2"
            shift 2
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        *)
            SUBCOMMAND="$1"
            shift
            ;;
    esac
done

case "$SUBCOMMAND" in
    build)
        print_status "Building Docker image..."
        print_status "Target: $TARGET"
        print_status "Tag: $TAG"
        
        # Use the consolidated Docker build script
        cd docker
        ./build.sh "$TARGET" --tag "$TAG"
        
        if [ "$PUSH" = true ]; then
            print_status "Pushing image to registry..."
            ./build.sh "$TARGET" --tag "$TAG" --push
        fi
        
        print_success "Docker build completed!"
        ;;
        
    run)
        print_status "Running Docker container..."
        
        # Run the container
        docker run -d --name vibecode-webgui -p 3000:3000 "$TAG"
        
        print_success "Container started!"
        print_status "Access at: http://localhost:3000"
        ;;
        
    stop)
        print_status "Stopping Docker containers..."
        
        # Stop and remove containers
        docker stop vibecode-webgui 2>/dev/null || true
        docker rm vibecode-webgui 2>/dev/null || true
        
        print_success "Containers stopped!"
        ;;
        
    clean)
        print_status "Cleaning Docker resources..."
        
        # Clean up Docker resources
        docker system prune -f
        docker volume prune -f
        
        print_success "Docker resources cleaned!"
        ;;
        
    logs)
        print_status "Showing Docker logs..."
        
        # Show logs
        docker logs -f vibecode-webgui
        ;;
        
    *)
        print_error "Unknown subcommand: $SUBCOMMAND"
        echo "Available subcommands: build, run, stop, clean, logs"
        exit 1
        ;;
esac
