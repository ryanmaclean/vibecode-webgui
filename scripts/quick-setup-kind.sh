#!/usr/bin/env bash

###############################################################################
# VibeCode KIND/Kubernetes Quick Setup
# Configures KIND (Kubernetes in Docker) cluster for local development
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
CLUSTER_NAME="vibecode-local"
KUBECTL_VERSION_MIN="1.20.0"
KIND_VERSION_MIN="0.11.0"
DOCKER_VERSION_MIN="20.10.0"
USE_SIMPLE_CONFIG=false

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

check_kubectl() {
    log_info "Checking kubectl installation..."

    if ! command -v kubectl &> /dev/null; then
        log_error "ERROR: kubectl is not installed"
        log_warning "Install kubectl:"
        log_warning "  macOS: brew install kubectl"
        log_warning "  Linux: https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/"
        log_warning "  Windows: https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/"
        exit 1
    fi

    local kubectl_version
    kubectl_version=$(kubectl version --client --output=json 2>/dev/null | grep -oE '"gitVersion":"v[0-9]+\.[0-9]+\.[0-9]+"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

    log "Current kubectl version: $kubectl_version"

    if ! version_compare "$kubectl_version" "$KUBECTL_VERSION_MIN"; then
        log_warning "WARNING: kubectl $KUBECTL_VERSION_MIN+ is recommended"
        log_warning "Current version: $kubectl_version"
    else
        log_success "kubectl version is compatible ✓"
    fi
}

check_kind() {
    log_info "Checking KIND installation..."

    if ! command -v kind &> /dev/null; then
        log_error "ERROR: KIND is not installed"
        log_warning "Install KIND:"
        log_warning "  macOS: brew install kind"
        log_warning "  Linux: https://kind.sigs.k8s.io/docs/user/quick-start/#installing-from-release-binaries"
        log_warning "  Windows: https://kind.sigs.k8s.io/docs/user/quick-start/#installing-with-a-package-manager"
        exit 1
    fi

    local kind_version
    kind_version=$(kind version | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

    log "Current KIND version: $kind_version"

    if ! version_compare "$kind_version" "$KIND_VERSION_MIN"; then
        log_warning "WARNING: KIND $KIND_VERSION_MIN+ is recommended"
        log_warning "Current version: $kind_version"
    else
        log_success "KIND version is compatible ✓"
    fi
}

check_system_resources() {
    log_info "Checking system resources..."

    # Check available disk space
    local available_space
    if [[ "$OSTYPE" == "darwin"* ]]; then
        available_space=$(df -g . | awk 'NR==2 {print $4}')
        log "Available disk space: ${available_space}GB"

        if [ "$available_space" -lt 20 ]; then
            log_warning "WARNING: Low disk space (< 20GB available)"
            log_warning "KIND cluster with images requires significant space"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        available_space=$(df -BG . | awk 'NR==2 {print $4}' | tr -d 'G')
        log "Available disk space: ${available_space}GB"

        if [ "$available_space" -lt 20 ]; then
            log_warning "WARNING: Low disk space (< 20GB available)"
            log_warning "KIND cluster with images requires significant space"
        fi
    fi

    # Check available memory
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local total_mem
        total_mem=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
        log "Total system memory: ${total_mem}GB"

        if [ "$total_mem" -lt 8 ]; then
            log_warning "WARNING: Low memory (< 8GB total)"
            log_warning "KIND cluster may require 4GB+ for smooth operation"
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
# Generated by quick-setup-kind.sh

# AI Provider API Keys
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Authentication
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=mongodb://vibecode:vibecode-password@mongodb:27017/vibecode-db

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

detect_kind_config() {
    log_info "Detecting KIND configuration files..."

    local config_files=()

    # Check common locations
    if [ -f "platforms/kubernetes/k8s/kind-config.yaml" ]; then
        config_files+=("platforms/kubernetes/k8s/kind-config.yaml")
    fi

    if [ -f "platforms/kubernetes/k8s/kind-cluster-config.yaml" ]; then
        config_files+=("platforms/kubernetes/k8s/kind-cluster-config.yaml")
    fi

    if [ -f "platforms/kubernetes/k8s/kind-simple-config.yaml" ]; then
        config_files+=("platforms/kubernetes/k8s/kind-simple-config.yaml")
    fi

    if [ -f "kind-config.yaml" ]; then
        config_files+=("kind-config.yaml")
    fi

    if [ ${#config_files[@]} -eq 0 ]; then
        log_warning "WARNING: No KIND config files found in standard locations"
        log_warning "Will create a simple single-node cluster"
        return 1
    else
        log "Found KIND configuration files:"
        for file in "${config_files[@]}"; do
            log "  - $file" "$GREEN"
        done
        return 0
    fi
}

check_existing_cluster() {
    log_info "Checking for existing KIND clusters..."

    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_warning "WARNING: Cluster '$CLUSTER_NAME' already exists"
        log_warning "Delete it with: kind delete cluster --name $CLUSTER_NAME"
        return 0
    fi

    log "No existing cluster named '$CLUSTER_NAME' found"
    return 1
}

create_kind_cluster() {
    log_info "Creating KIND cluster..."

    if check_existing_cluster; then
        log_warning "Skipping cluster creation - cluster already exists"
        return 0
    fi

    local config_file=""

    # Determine which config file to use
    if [ "$USE_SIMPLE_CONFIG" = true ]; then
        log "Using simple single-node configuration"
        if [ "$DRY_RUN" = false ]; then
            kind create cluster --name "$CLUSTER_NAME"
        else
            log_warning "[DRY RUN] Would execute: kind create cluster --name $CLUSTER_NAME"
        fi
    else
        # Try to find a config file
        if [ -f "platforms/kubernetes/k8s/kind-config.yaml" ]; then
            config_file="platforms/kubernetes/k8s/kind-config.yaml"
        elif [ -f "platforms/kubernetes/k8s/kind-simple-config.yaml" ]; then
            config_file="platforms/kubernetes/k8s/kind-simple-config.yaml"
        fi

        if [ -n "$config_file" ]; then
            log "Using configuration file: $config_file"
            run_command "kind create cluster --name $CLUSTER_NAME --config $config_file" "Creating KIND cluster"
        else
            log_warning "No config file found, using default configuration"
            run_command "kind create cluster --name $CLUSTER_NAME" "Creating KIND cluster"
        fi
    fi

    if [ "$DRY_RUN" = false ]; then
        log_success "KIND cluster created successfully ✓"
    fi
}

verify_cluster() {
    log_info "Verifying cluster..."

    if [ "$DRY_RUN" = true ]; then
        log_warning "[DRY RUN] Would verify cluster: kubectl cluster-info --context kind-$CLUSTER_NAME"
        return 0
    fi

    # Wait a moment for cluster to be ready
    sleep 2

    if kubectl cluster-info --context "kind-$CLUSTER_NAME" &> /dev/null; then
        log_success "Cluster is accessible ✓"

        # Show nodes
        log "Cluster nodes:"
        kubectl get nodes --context "kind-$CLUSTER_NAME" 2>/dev/null || true
    else
        log_error "ERROR: Cannot access cluster"
        log_warning "Try: kubectl cluster-info --context kind-$CLUSTER_NAME"
        return 1
    fi
}

setup_namespace() {
    log_info "Setting up Kubernetes namespace..."

    if [ "$DRY_RUN" = true ]; then
        log_warning "[DRY RUN] Would create namespace: vibecode"
        return 0
    fi

    if kubectl get namespace vibecode --context "kind-$CLUSTER_NAME" &> /dev/null; then
        log_success "Namespace 'vibecode' already exists ✓"
    else
        kubectl create namespace vibecode --context "kind-$CLUSTER_NAME"
        log_success "Created namespace 'vibecode' ✓"
    fi
}

detect_kubernetes_manifests() {
    log_info "Detecting Kubernetes manifests..."

    local manifest_files=()

    # Check common locations
    if [ -f "platforms/kubernetes/k8s/vibecode-deployment.yaml" ]; then
        manifest_files+=("platforms/kubernetes/k8s/vibecode-deployment.yaml")
    fi

    if [ -f "platforms/kubernetes/k8s/vibecode-app-simple.yaml" ]; then
        manifest_files+=("platforms/kubernetes/k8s/vibecode-app-simple.yaml")
    fi

    if [ -f "platforms/kubernetes/k8s/code-server-kind.yaml" ]; then
        manifest_files+=("platforms/kubernetes/k8s/code-server-kind.yaml")
    fi

    if [ ${#manifest_files[@]} -eq 0 ]; then
        log_warning "WARNING: No Kubernetes manifest files found in standard locations"
        log_warning "Available manifest files:"
        find platforms/kubernetes/k8s -name "*.yaml" -not -path "*/datadog/*" -not -path "*/templates/*" 2>/dev/null | head -10 || true
    else
        log "Found Kubernetes manifest files:"
        for file in "${manifest_files[@]}"; do
            log "  - $file" "$GREEN"
        done
    fi
}

load_local_images() {
    log_info "Checking for local Docker images..."

    if [ "$DRY_RUN" = true ]; then
        log_warning "[DRY RUN] Would load local images into KIND cluster"
        return 0
    fi

    # Check if we have any local vibecode images
    local images
    images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -i vibecode || true)

    if [ -z "$images" ]; then
        log "No local VibeCode images found"
        log_warning "You may need to build images first or pull them from a registry"
        return 0
    fi

    log "Found local images:"
    echo "$images" | while read -r image; do
        log "  - $image" "$GREEN"
        log_info "Loading $image into KIND cluster..."
        if kind load docker-image "$image" --name "$CLUSTER_NAME" 2>/dev/null; then
            log_success "Loaded $image ✓"
        else
            log_warning "Could not load $image (may not be needed)"
        fi
    done
}

print_next_steps() {
    log ""
    log "=====================================================================" "$GREEN"
    log "  KIND/Kubernetes Setup Complete!" "$GREEN"
    log "=====================================================================" "$GREEN"
    log ""
    log "Cluster Information:" "$CYAN"
    log "  Name: $CLUSTER_NAME" "$YELLOW"
    log "  Context: kind-$CLUSTER_NAME" "$YELLOW"
    log ""
    log "Next steps:" "$CYAN"
    log ""
    log "1. Verify cluster is running:" "$YELLOW"
    log "   kubectl cluster-info --context kind-$CLUSTER_NAME" "$YELLOW"
    log "   kubectl get nodes --context kind-$CLUSTER_NAME" "$YELLOW"
    log ""
    log "2. Deploy VibeCode application:" "$YELLOW"
    log "   # Option A: Using kubectl apply" "$YELLOW"
    log "   kubectl apply -f platforms/kubernetes/k8s/vibecode-app-simple.yaml" "$YELLOW"
    log ""
    log "   # Option B: Using Helm (if available)" "$YELLOW"
    log "   helm install vibecode ./platforms/kubernetes/helm/vibecode-platform -n vibecode" "$YELLOW"
    log ""
    log "3. Check deployment status:" "$YELLOW"
    log "   kubectl get pods -n vibecode --context kind-$CLUSTER_NAME" "$YELLOW"
    log "   kubectl logs -n vibecode -l app=vibecode --context kind-$CLUSTER_NAME" "$YELLOW"
    log ""
    log "4. Access the application:" "$YELLOW"
    log "   # Port-forward to access locally" "$YELLOW"
    log "   kubectl port-forward -n vibecode svc/vibecode 3000:80 --context kind-$CLUSTER_NAME" "$YELLOW"
    log "   # Then open http://localhost:3000" "$YELLOW"
    log ""
    log "5. Cleanup when done:" "$YELLOW"
    log "   # Delete deployment" "$YELLOW"
    log "   kubectl delete namespace vibecode --context kind-$CLUSTER_NAME" "$YELLOW"
    log ""
    log "   # Delete entire cluster" "$YELLOW"
    log "   kind delete cluster --name $CLUSTER_NAME" "$YELLOW"
    log ""
    log "For more information, see:" "$CYAN"
    log "  docs/setup/KIND_KUBERNETES_SETUP.md" "$YELLOW"
    log ""
}

###############################################################################
# Main Setup Flow
###############################################################################

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    --cluster-name NAME     Specify cluster name (default: vibecode-local)
    --simple                Use simple single-node configuration
    --dry-run               Show what would be done without executing
    --verbose               Show detailed command output
    -h, --help              Show this help message

Examples:
    $0                      Run full setup with default configuration
    $0 --dry-run            Preview setup without making changes
    $0 --simple             Create a simple single-node cluster
    $0 --cluster-name dev   Create cluster named 'dev'
    $0 --verbose            Run with detailed output

EOF
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cluster-name)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            --simple)
                USE_SIMPLE_CONFIG=true
                shift
                ;;
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
    log "  VibeCode KIND/Kubernetes Quick Setup" "$CYAN"
    log "=====================================================================" "$CYAN"
    log ""

    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN MODE - No changes will be made"
        log ""
    fi

    # Run all checks and setup steps
    check_docker
    check_kubectl
    check_kind
    check_system_resources
    setup_environment_file
    detect_kind_config
    create_kind_cluster
    verify_cluster
    setup_namespace
    detect_kubernetes_manifests
    load_local_images

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
