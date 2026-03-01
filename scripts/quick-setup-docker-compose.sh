#!/usr/bin/env bash

###############################################################################
# VibeCode Docker Compose Quick Setup
# Configures Docker Compose for development and production environments
###############################################################################

set -e

# Color definitions (matching setup-development.js pattern)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Configuration
DRY_RUN=false
VERBOSE=false
COMPOSE_VERSION_MIN="2.0.0"
DOCKER_VERSION_MIN="20.10.0"

###############################################################################
# Utility Functions
###############################################################################

log() {
    local message="$1"
    local color="${2:-$CYAN}"
    echo -e "${color}${message}${RESET}"
}

log_error() {
    log "$1" "$RED"
}

log_success() {
    log "$1" "$GREEN"
}

log_warning() {
    log "$1" "$YELLOW"
}

log_info() {
    log "$1" "$BLUE"
}

run_command() {
    local cmd="$1"
    local description="${2:-Running command}"

    if [ "$VERBOSE" = true ]; then
        log_info "  → $cmd"
    fi

    if [ "$DRY_RUN" = true ]; then
        log_warning "[DRY RUN] Would execute: $cmd"
        return 0
    fi

    if eval "$cmd"; then
        return 0
    else
        log_error "Failed: $description"
        return 1
    fi
}

version_compare() {
    # Returns 0 if $1 >= $2, 1 otherwise
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

###############################################################################
# Prerequisite Checks
###############################################################################

check_docker() {
    log_info "Checking Docker installation..."

    if ! command -v docker &> /dev/null; then
        log_error "ERROR: Docker is not installed"
        log_warning "Please install Docker 20.10+ from: https://docs.docker.com/get-docker/"
        exit 1
    fi

    local docker_version
    docker_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

    log "Current Docker version: $docker_version"

    if ! version_compare "$docker_version" "$DOCKER_VERSION_MIN"; then
        log_error "ERROR: Docker $DOCKER_VERSION_MIN+ is required"
        log_warning "Current version: $docker_version"
        log_warning "Please upgrade Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "ERROR: Docker daemon is not running"
        log_warning "Please start Docker and try again"
        exit 1
    fi

    log_success "Docker version is compatible ✓"
}

check_docker_compose() {
    log_info "Checking Docker Compose installation..."

    # Check for Docker Compose V2 (docker compose)
    if docker compose version &> /dev/null; then
        local compose_version
        compose_version=$(docker compose version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

        log "Current Docker Compose version: $compose_version (V2)"

        if ! version_compare "$compose_version" "$COMPOSE_VERSION_MIN"; then
            log_warning "WARNING: Docker Compose $COMPOSE_VERSION_MIN+ is recommended"
            log_warning "Current version: $compose_version"
        else
            log_success "Docker Compose V2 is installed ✓"
        fi
        return 0
    fi

    # Fallback to docker-compose V1
    if command -v docker-compose &> /dev/null; then
        local compose_version
        compose_version=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

        log_warning "WARNING: Using docker-compose V1 (deprecated)"
        log_warning "Current version: $compose_version"
        log_warning "Please upgrade to Docker Compose V2: https://docs.docker.com/compose/install/"
        return 0
    fi

    log_error "ERROR: Docker Compose is not installed"
    log_warning "Please install Docker Compose V2 from: https://docs.docker.com/compose/install/"
    exit 1
}

check_system_resources() {
    log_info "Checking system resources..."

    # Check available disk space
    local available_space
    if [[ "$OSTYPE" == "darwin"* ]]; then
        available_space=$(df -g . | awk 'NR==2 {print $4}')
        log "Available disk space: ${available_space}GB"

        if [ "$available_space" -lt 10 ]; then
            log_warning "WARNING: Low disk space (< 10GB available)"
            log_warning "Docker images and volumes require significant space"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        available_space=$(df -BG . | awk 'NR==2 {print $4}' | tr -d 'G')
        log "Available disk space: ${available_space}GB"

        if [ "$available_space" -lt 10 ]; then
            log_warning "WARNING: Low disk space (< 10GB available)"
            log_warning "Docker images and volumes require significant space"
        fi
    fi

    log_success "System resources checked ✓"
}

###############################################################################
# Setup Functions
###############################################################################

setup_environment_file() {
    log_info "Setting up environment configuration..."

    local env_file=".env"
    local env_example=".env.example"

    if [ -f "$env_file" ]; then
        log_success "$env_file already exists ✓"
        return 0
    fi

    if [ -f "$env_example" ]; then
        run_command "cp $env_example $env_file" "Copying .env.example to .env"
        log_success "Created $env_file from template"
        log_warning "Please add your API keys to $env_file"
    else
        log_warning "No .env.example found, creating minimal .env"

        local env_content="# VibeCode Environment Configuration
# Generated by quick-setup-docker-compose.sh

# AI Provider API Keys
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Authentication
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vibecode_dev

# Development Settings
NODE_ENV=development
"

        if [ "$DRY_RUN" = false ]; then
            echo "$env_content" > "$env_file"
            log_success "Created minimal $env_file"
        else
            log_warning "[DRY RUN] Would create: $env_file"
        fi
    fi
}

detect_compose_files() {
    log_info "Detecting Docker Compose configurations..."

    local compose_files=()

    # Check common locations
    if [ -f "docker-compose.yml" ]; then
        compose_files+=("docker-compose.yml")
    fi

    if [ -f "config/docker/docker-compose.dev.yml" ]; then
        compose_files+=("config/docker/docker-compose.dev.yml")
    fi

    if [ -f "platforms/docker/docker/docker-compose.dev.yml" ]; then
        compose_files+=("platforms/docker/docker/docker-compose.dev.yml")
    fi

    if [ ${#compose_files[@]} -eq 0 ]; then
        log_warning "WARNING: No docker-compose.yml files found in standard locations"
        log_warning "Available compose files:"
        find . -name "docker-compose*.yml" -not -path "*/node_modules/*" -not -path "*/.auto-claude/*" 2>/dev/null | head -10
    else
        log "Found Docker Compose configurations:"
        for file in "${compose_files[@]}"; do
            log "  - $file" "$GREEN"
        done
    fi
}

setup_docker_network() {
    log_info "Setting up Docker network..."

    local network_name="vibecode-network"

    if docker network inspect "$network_name" &> /dev/null; then
        log_success "Docker network '$network_name' already exists ✓"
        return 0
    fi

    run_command "docker network create $network_name" "Creating Docker network"

    if [ "$DRY_RUN" = false ]; then
        log_success "Created Docker network: $network_name ✓"
    fi
}

pull_docker_images() {
    log_info "Checking Docker images..."

    local compose_file="${1:-config/docker/docker-compose.dev.yml}"

    if [ ! -f "$compose_file" ]; then
        log_warning "Compose file not found: $compose_file"
        return 0
    fi

    log "Using compose file: $compose_file"

    if [ "$DRY_RUN" = true ]; then
        log_warning "[DRY RUN] Would pull images from: $compose_file"
        return 0
    fi

    if docker compose -f "$compose_file" pull --ignore-pull-failures 2>/dev/null; then
        log_success "Docker images pulled successfully ✓"
    else
        log_warning "Some images could not be pulled (will build locally if needed)"
    fi
}

validate_compose_config() {
    log_info "Validating Docker Compose configuration..."

    local compose_file="${1:-config/docker/docker-compose.dev.yml}"

    if [ ! -f "$compose_file" ]; then
        log_warning "Compose file not found: $compose_file"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_warning "[DRY RUN] Would validate: $compose_file"
        return 0
    fi

    if docker compose -f "$compose_file" config > /dev/null 2>&1; then
        log_success "Docker Compose configuration is valid ✓"
    else
        log_error "ERROR: Docker Compose configuration has errors"
        log_warning "Run: docker compose -f $compose_file config"
        return 1
    fi
}

print_next_steps() {
    log ""
    log "=====================================================================" "$GREEN"
    log "  Docker Compose Setup Complete!" "$GREEN"
    log "=====================================================================" "$GREEN"
    log ""
    log "Next steps:" "$CYAN"
    log ""
    log "1. Update your .env file with API keys:" "$YELLOW"
    log "   - OPENROUTER_API_KEY (get from https://openrouter.ai/keys)" "$YELLOW"
    log "   - Generate NEXTAUTH_SECRET: openssl rand -base64 32" "$YELLOW"
    log ""
    log "2. Start services:" "$YELLOW"
    log "   docker compose -f config/docker/docker-compose.dev.yml up -d" "$YELLOW"
    log ""
    log "3. View logs:" "$YELLOW"
    log "   docker compose -f config/docker/docker-compose.dev.yml logs -f" "$YELLOW"
    log ""
    log "4. Stop services:" "$YELLOW"
    log "   docker compose -f config/docker/docker-compose.dev.yml down" "$YELLOW"
    log ""
    log "For production deployment, use:" "$YELLOW"
    log "   docker compose -f config/docker/docker-compose.prod.yml up -d" "$YELLOW"
    log ""
}

###############################################################################
# Main Setup Flow
###############################################################################

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    --dry-run           Show what would be done without executing
    --verbose           Show detailed command output
    -h, --help          Show this help message

Examples:
    $0                  Run full setup
    $0 --dry-run        Preview setup without making changes
    $0 --verbose        Run with detailed output

EOF
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    log "=====================================================================" "$CYAN"
    log "  VibeCode Docker Compose Quick Setup" "$CYAN"
    log "=====================================================================" "$CYAN"
    log ""

    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN MODE - No changes will be made"
        log ""
    fi

    # Run all checks and setup steps
    check_docker
    check_docker_compose
    check_system_resources
    setup_environment_file
    detect_compose_files
    setup_docker_network
    pull_docker_images "config/docker/docker-compose.dev.yml"
    validate_compose_config "config/docker/docker-compose.dev.yml"

    log ""

    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN COMPLETE - No changes were made"
        log_info "Run without --dry-run to apply changes"
    else
        print_next_steps
    fi
}

# Run main function
main "$@"
