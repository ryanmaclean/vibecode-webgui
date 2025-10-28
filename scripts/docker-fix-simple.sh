#!/bin/bash
# Simple Docker Desktop Fix - Based on actual working solution
# Fixes the exact issue encountered: Docker daemon connection errors

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "🐳 Docker Desktop Quick Fix"
echo "============================="

# Check if Docker Desktop is installed
if [ ! -d "/Applications/Docker.app" ]; then
    log_error "Docker Desktop not found at /Applications/Docker.app"
    log_info "Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Function to check Docker status
check_docker() {
    if docker info >/dev/null 2>&1; then
        log_success "Docker is working correctly"
        docker --version
        return 0
    else
        return 1
    fi
}

# Function to restart Docker Desktop (the fix that worked)
restart_docker() {
    log_info "Restarting Docker Desktop..."
    
    # Step 1: Quit Docker Desktop gracefully
    log_info "Step 1: Stopping Docker Desktop..."
    osascript -e 'quit app "Docker Desktop"' 2>/dev/null || true
    
    # Step 2: Wait for clean shutdown
    log_info "Step 2: Waiting for clean shutdown..."
    sleep 5
    
    # Step 3: Start Docker Desktop
    log_info "Step 3: Starting Docker Desktop..."
    open -a "Docker Desktop"
    
    # Step 4: Wait for Docker to be ready
    log_info "Step 4: Waiting for Docker to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        sleep 2
        if docker info >/dev/null 2>&1; then
            log_success "Docker Desktop is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        echo -n "."
    done
    
    echo ""
    log_warning "Docker took longer than expected to start"
    log_info "Try running: docker info"
    return 1
}

# Function to clean Docker if restart doesn't work
clean_docker() {
    log_info "Cleaning Docker data..."
    
    if docker info >/dev/null 2>&1; then
        log_info "Cleaning unused Docker resources..."
        docker system prune -f || true
        docker builder prune -f || true
        log_success "Docker cleanup completed"
    else
        log_warning "Docker not accessible for cleanup"
    fi
}

# Main logic
main() {
    log_info "Diagnosing Docker issue..."
    
    # First, check if Docker is already working
    if check_docker; then
        log_success "Docker is already working correctly!"
        exit 0
    fi
    
    # Check if Docker processes are running but not responding
    if pgrep -f "com.docker.backend" >/dev/null; then
        log_info "Docker processes detected but not responding"
        log_info "This matches the exact issue we encountered"
    else
        log_info "No Docker processes found"
    fi
    
    # Apply the fix that worked
    restart_docker
    
    # Verify the fix
    if check_docker; then
        log_success "🎉 Docker fix successful!"
        log_info "You can now run: docker run hello-world"
    else
        log_error "Docker restart didn't resolve the issue"
        log_info "Trying cleanup..."
        clean_docker
        
        # One more check after cleanup
        if check_docker; then
            log_success "🎉 Docker fix successful after cleanup!"
        else
            log_error "Docker still not working"
            log_info "Manual steps to try:"
            log_info "1. Open Docker Desktop manually"
            log_info "2. Check Docker Desktop settings"
            log_info "3. Try: docker system prune -a"
            log_info "4. Restart your Mac if needed"
            exit 1
        fi
    fi
}

# Handle command line arguments
case "${1:-auto}" in
    --help|-h)
        echo "Docker Desktop Quick Fix"
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  auto, --auto      Automatically fix Docker (default)"
        echo "  restart           Just restart Docker Desktop"
        echo "  clean             Clean Docker data"
        echo "  check             Check Docker status only"
        echo "  --help, -h        Show this help"
        echo ""
        echo "This script fixes the exact Docker daemon connection issue"
        echo "by restarting Docker Desktop with proper timing."
        ;;
    restart)
        restart_docker && check_docker
        ;;
    clean)
        clean_docker && check_docker
        ;;
    check)
        check_docker
        ;;
    auto|--auto|*)
        main
        ;;
esac