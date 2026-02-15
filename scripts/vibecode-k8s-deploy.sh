#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# VibeCode Kubernetes One-Click Deployment
# Deploys a complete VibeCode environment to a KIND cluster

# Initialize log aggregation
init_log_aggregation


echo "🚀 VibeCode One-Click Kubernetes Deployment"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command-line arguments
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --cluster-name)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run           Show what would be deployed without actually deploying"
            echo "  --cluster-name NAME Specify KIND cluster name (default: vibecode-local)"
            echo "  -h, --help          Show this help message"
            echo ""
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-vibecode-local}"
NAMESPACE_PLATFORM="vibecode-platform"
NAMESPACE_WEBGUI="vibecode-webgui"
K8S_MANIFESTS_DIR="platforms/kubernetes/k8s"

if [ "$DRY_RUN" = true ]; then
    echo ""
    log_info "🔍 DRY RUN MODE - No actual changes will be made"
    echo ""
fi

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# ============================================================================
# PREREQUISITE CHECKS - ERROR HANDLING FOR COMMON FAILURES
# ============================================================================

check_prerequisites() {
    log_info "Checking system prerequisites..."
    local all_checks_passed=true

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        echo "  Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
        all_checks_passed=false
    else
        # Check if Docker daemon is running
        if ! docker info &> /dev/null; then
            log_error "Docker is installed but not running"
            echo "  Please start Docker Desktop and try again"
            all_checks_passed=false
        else
            log_success "Docker is running"
        fi
    fi

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        echo "  Install via Homebrew: brew install kubectl"
        echo "  Or download from: https://kubernetes.io/docs/tasks/tools/"
        all_checks_passed=false
    else
        log_success "kubectl is installed ($(kubectl version --client --short 2>/dev/null | head -1))"
    fi

    # Check if KIND is installed
    if ! command -v kind &> /dev/null; then
        log_error "KIND is not installed"
        echo "  Install via Homebrew: brew install kind"
        echo "  Or download from: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
        all_checks_passed=false
    else
        log_success "KIND is installed ($(kind version 2>/dev/null | head -1))"
    fi

    # Check if nc (netcat) is available for port checks
    if ! command -v nc &> /dev/null; then
        log_warning "nc (netcat) not found - port conflict checks will be skipped"
    fi

    # Check if curl is available for HTTP checks
    if ! command -v curl &> /dev/null; then
        log_warning "curl not found - HTTP health checks will be limited"
    fi

    # Check Docker resources (memory and CPU)
    if docker info &> /dev/null; then
        local docker_memory_bytes
        docker_memory_bytes=$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo "0")

        if [ "$docker_memory_bytes" != "0" ]; then
            # Convert bytes to GB
            local docker_memory_gb=$((docker_memory_bytes / 1024 / 1024 / 1024))

            if [ "$docker_memory_gb" -lt 4 ]; then
                log_warning "Docker has only ${docker_memory_gb}GB memory allocated"
                echo "  Recommended: At least 4GB for KIND clusters"
                echo "  Increase in Docker Desktop → Preferences → Resources"
            else
                log_success "Docker has ${docker_memory_gb}GB memory allocated"
            fi
        fi

        local docker_cpus
        docker_cpus=$(docker info --format '{{.NCPU}}' 2>/dev/null || echo "0")

        if [ "$docker_cpus" != "0" ]; then
            if [ "$docker_cpus" -lt 2 ]; then
                log_warning "Docker has only ${docker_cpus} CPU allocated"
                echo "  Recommended: At least 2 CPUs for KIND clusters"
                echo "  Increase in Docker Desktop → Preferences → Resources"
            else
                log_success "Docker has ${docker_cpus} CPUs allocated"
            fi
        fi
    fi

    # Check for common port conflicts (KIND API server typically uses 6443)
    if command -v nc &> /dev/null; then
        local kind_api_port=6443
        if check_port "localhost" "$kind_api_port" 1; then
            log_warning "Port $kind_api_port is already in use"
            echo "  This may conflict with KIND cluster creation"
            echo "  Check what's using the port: lsof -i :$kind_api_port"
        fi
    fi

    # Check available disk space
    local available_space_gb
    available_space_gb=$(df -g . | awk 'NR==2 {print $4}')

    if [ "$available_space_gb" -lt 10 ]; then
        log_warning "Low disk space: ${available_space_gb}GB available"
        echo "  Recommended: At least 10GB free for Docker images and KIND cluster"
    else
        log_success "Sufficient disk space available: ${available_space_gb}GB"
    fi

    echo ""
    if [ "$all_checks_passed" = false ]; then
        log_error "Prerequisites check failed - please fix the errors above and try again"
        return 1
    else
        log_success "All critical prerequisites met"
        return 0
    fi
}

# ============================================================================
# HEALTH CHECK FUNCTIONS
# ============================================================================

# Check if a port is accessible
check_port() {
    local host=$1
    local port=$2
    local timeout=${3:-1}
    nc -z -w "$timeout" "$host" "$port" > /dev/null 2>&1
}

# Check HTTP endpoint
check_http() {
    local url=$1
    local timeout=${2:-2}
    curl -s -f --connect-timeout "$timeout" "$url" > /dev/null 2>&1
}

# Wait for a Kubernetes deployment to be ready
wait_for_deployment() {
    local deployment=$1
    local namespace=$2
    local timeout=${3:-300}

    log_info "Waiting for deployment/$deployment in namespace $namespace..."

    if kubectl wait --for=condition=available --timeout="${timeout}s" \
        "deployment/$deployment" -n "$namespace" > /dev/null 2>&1; then
        log_success "Deployment $deployment is ready"
        return 0
    else
        log_warning "Timeout waiting for $deployment (may still be starting)"
        return 1
    fi
}

# Check if pod is running and ready
check_pod_ready() {
    local pod_label=$1
    local namespace=$2

    local pod_status
    pod_status=$(kubectl get pods -n "$namespace" -l "$pod_label" \
        -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")

    if [ "$pod_status" = "Running" ]; then
        local ready_status
        ready_status=$(kubectl get pods -n "$namespace" -l "$pod_label" \
            -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")

        if [ "$ready_status" = "True" ]; then
            return 0
        fi
    fi
    return 1
}

# Check service health via port-forward
check_service_health() {
    local service=$1
    local namespace=$2
    local port=$3
    local check_type=${4:-http}
    local timeout=${5:-5}

    # Start port-forward in background
    local pf_pid
    kubectl port-forward -n "$namespace" "service/$service" "$port:$port" > /dev/null 2>&1 &
    pf_pid=$!

    # Wait a moment for port-forward to establish
    sleep 2

    local result=1
    if [ "$check_type" = "http" ]; then
        if check_http "http://localhost:$port" "$timeout"; then
            log_success "Service $service: http://localhost:$port is healthy"
            result=0
        else
            log_error "Service $service: http://localhost:$port is not responding"
            result=1
        fi
    else
        if check_port "localhost" "$port" "$timeout"; then
            log_success "Service $service: localhost:$port is accessible"
            result=0
        else
            log_error "Service $service: localhost:$port is not accessible"
            result=1
        fi
    fi

    # Clean up port-forward
    kill "$pf_pid" 2>/dev/null || true
    wait "$pf_pid" 2>/dev/null || true

    return $result
}

# Get pod status summary
get_pod_status() {
    local namespace=$1

    local total running pending failed
    total=$(kubectl get pods -n "$namespace" --no-headers 2>/dev/null | wc -l | tr -d ' ')
    running=$(kubectl get pods -n "$namespace" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
    pending=$(kubectl get pods -n "$namespace" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
    failed=$(kubectl get pods -n "$namespace" --field-selector=status.phase=Failed --no-headers 2>/dev/null | wc -l | tr -d ' ')

    echo "Total: $total | Running: $running | Pending: $pending | Failed: $failed"
}

# Verify deployment health
verify_deployment_health() {
    local deployment=$1
    local namespace=$2

    local desired ready available
    desired=$(kubectl get deployment "$deployment" -n "$namespace" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    ready=$(kubectl get deployment "$deployment" -n "$namespace" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    available=$(kubectl get deployment "$deployment" -n "$namespace" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo "0")

    if [ "$desired" = "$ready" ] && [ "$ready" = "$available" ] && [ "$desired" != "0" ]; then
        log_success "Deployment $deployment: $ready/$desired replicas ready"
        return 0
    else
        log_warning "Deployment $deployment: $ready/$desired replicas ready (available: $available)"
        return 1
    fi
}

# ============================================================================
# RUN PREREQUISITE CHECKS
# ============================================================================

echo ""
log_info "Running prerequisite checks..."
echo ""

if [ "$DRY_RUN" = true ]; then
    log_info "DRY RUN: Would check system prerequisites"
    log_info "DRY RUN: Would verify Docker, kubectl, KIND, and system resources"
else
    # Run inline prerequisite checks
    if ! check_prerequisites; then
        log_error "System prerequisite checks failed"
        echo ""
        echo "Please fix the issues above and try again."
        exit 1
    fi

    # Also run the external prerequisites check script if available
    if [ -f "$(dirname "$0")/check-k8s-prerequisites.sh" ]; then
        log_info "Running additional prerequisites check script..."
        if bash "$(dirname "$0")/check-k8s-prerequisites.sh" > /dev/null 2>&1; then
            log_success "External prerequisites check passed"
        else
            log_warning "External prerequisites check reported issues"
            log_info "Run manually for details: ./scripts/check-k8s-prerequisites.sh"
        fi
    fi
fi

echo ""

# ============================================================================
# CREATE/VERIFY KIND CLUSTER
# ============================================================================

log_info "Checking KIND cluster..."
if [ "$DRY_RUN" = true ]; then
    log_info "Would check for KIND cluster: $CLUSTER_NAME"
    log_info "If cluster doesn't exist, would create it with: kind create cluster --name $CLUSTER_NAME"
    log_info "Would set kubectl context to: kind-${CLUSTER_NAME}"
else
    if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_info "Creating KIND cluster: $CLUSTER_NAME (this may take a few minutes)..."

        # Create cluster with error handling
        if ! kind create cluster --name "$CLUSTER_NAME" 2>&1 | tee /tmp/kind-create-${CLUSTER_NAME}.log; then
            log_error "Failed to create KIND cluster"
            echo ""
            log_error "Possible causes:"
            echo "  1. Docker is not running or unhealthy"
            echo "  2. Insufficient system resources (memory/CPU)"
            echo "  3. Port conflicts with existing services"
            echo "  4. Another cluster with the same name exists in a bad state"
            echo ""
            log_info "Troubleshooting steps:"
            echo "  1. Verify Docker is running: docker info"
            echo "  2. Check existing clusters: kind get clusters"
            echo "  3. Delete conflicting cluster: kind delete cluster --name $CLUSTER_NAME"
            echo "  4. View full logs: cat /tmp/kind-create-${CLUSTER_NAME}.log"
            echo ""
            exit 1
        fi

        log_success "KIND cluster created successfully"

        # Verify cluster is accessible
        if ! kubectl cluster-info --context "kind-${CLUSTER_NAME}" &> /dev/null; then
            log_error "KIND cluster created but not accessible"
            echo "  Try: kubectl cluster-info --context kind-${CLUSTER_NAME}"
            exit 1
        fi
    else
        log_success "KIND cluster already exists: $CLUSTER_NAME"

        # Verify existing cluster is healthy
        if ! kubectl cluster-info --context "kind-${CLUSTER_NAME}" &> /dev/null; then
            log_error "KIND cluster exists but is not responding"
            echo ""
            log_info "The cluster may be in a bad state. Try:"
            echo "  1. Delete and recreate: kind delete cluster --name $CLUSTER_NAME"
            echo "  2. Restart Docker and try again"
            exit 1
        fi
    fi

    # Ensure kubectl context is set
    log_info "Setting kubectl context..."
    if ! kubectl config use-context "kind-${CLUSTER_NAME}" &> /dev/null; then
        log_error "Failed to set kubectl context to kind-${CLUSTER_NAME}"
        echo "  Available contexts:"
        kubectl config get-contexts
        exit 1
    fi
    log_success "kubectl context set to kind-${CLUSTER_NAME}"
fi

# ============================================================================
# CREATE NAMESPACES
# ============================================================================

log_info "Creating namespaces..."
if [ "$DRY_RUN" = true ]; then
    log_info "Would create namespace: $NAMESPACE_PLATFORM"
    log_info "Would create namespace: $NAMESPACE_WEBGUI"
else
    # Create platform namespace
    if ! kubectl create namespace "$NAMESPACE_PLATFORM" --dry-run=client -o yaml | kubectl apply -f - &> /dev/null; then
        log_error "Failed to create namespace: $NAMESPACE_PLATFORM"
        echo "  This may indicate kubectl connectivity issues"
        echo "  Verify cluster: kubectl cluster-info"
        exit 1
    fi

    # Create webgui namespace
    if ! kubectl create namespace "$NAMESPACE_WEBGUI" --dry-run=client -o yaml | kubectl apply -f - &> /dev/null; then
        log_error "Failed to create namespace: $NAMESPACE_WEBGUI"
        exit 1
    fi

    log_success "Namespaces created: $NAMESPACE_PLATFORM, $NAMESPACE_WEBGUI"
fi

# ============================================================================
# BUILD AND LOAD DOCKER IMAGE
# ============================================================================

log_info "Building and loading VibeCode WebGUI image into KIND..."
VIBECODE_IMAGE="vibecodeacr.azurecr.io/vibecode-webgui:v1.5.0"
DOCKERFILE_LOCAL="platforms/docker/docker/Dockerfile.local"

if [ "$DRY_RUN" = true ]; then
    if [ -f "$DOCKERFILE_LOCAL" ]; then
        log_info "Would build image: $VIBECODE_IMAGE using $DOCKERFILE_LOCAL"
        log_info "Would load image into KIND cluster: $CLUSTER_NAME"
    else
        log_warning "Dockerfile not found at $DOCKERFILE_LOCAL, would skip image build"
    fi
else
    if [ -f "$DOCKERFILE_LOCAL" ]; then
        # Verify Docker is still running before building
        if ! docker info &> /dev/null; then
            log_error "Docker is not running - cannot build image"
            echo "  Please start Docker and try again"
            exit 1
        fi

        # Check available disk space before building
        local available_space_gb
        available_space_gb=$(df -g . | awk 'NR==2 {print $4}')
        if [ "$available_space_gb" -lt 5 ]; then
            log_error "Insufficient disk space for Docker build: ${available_space_gb}GB available"
            echo "  Docker builds require at least 5GB free space"
            echo "  Free up space or clean Docker: docker system prune -a"
            exit 1
        fi

        log_info "Building VibeCode WebGUI image (this may take a few minutes)..."
        log_info "Using Dockerfile: $DOCKERFILE_LOCAL"

        # Build with error handling and output capture
        if ! docker build -t "$VIBECODE_IMAGE" -f "$DOCKERFILE_LOCAL" . 2>&1 | tee /tmp/docker-build-vibecode.log | grep -E "^(Step|Successfully|#|ERROR|Error)"; then
            log_error "Failed to build VibeCode WebGUI image"
            echo ""
            log_error "Possible causes:"
            echo "  1. Insufficient disk space"
            echo "  2. Network issues downloading dependencies"
            echo "  3. Syntax errors in Dockerfile"
            echo "  4. Missing build dependencies"
            echo ""
            log_info "Troubleshooting:"
            echo "  1. Check Docker disk space: docker system df"
            echo "  2. View full build log: cat /tmp/docker-build-vibecode.log"
            echo "  3. Clean Docker cache: docker builder prune"
            echo "  4. Verify Dockerfile syntax: docker build --no-cache -f $DOCKERFILE_LOCAL ."
            exit 1
        fi

        # Verify image was created
        if ! docker images "$VIBECODE_IMAGE" --format "{{.Repository}}:{{.Tag}}" | grep -q "$VIBECODE_IMAGE"; then
            log_error "Docker build completed but image not found"
            echo "  Expected image: $VIBECODE_IMAGE"
            echo "  Available images:"
            docker images | head -5
            exit 1
        fi

        log_success "Image built successfully: $VIBECODE_IMAGE"

        # Load image into KIND cluster
        log_info "Loading image into KIND cluster: $CLUSTER_NAME..."
        if ! kind load docker-image "$VIBECODE_IMAGE" --name "$CLUSTER_NAME" 2>&1 | tee /tmp/kind-load-${CLUSTER_NAME}.log; then
            log_error "Failed to load image into KIND cluster"
            echo ""
            log_error "Possible causes:"
            echo "  1. KIND cluster is not running"
            echo "  2. Cluster name mismatch"
            echo "  3. Image name mismatch"
            echo ""
            log_info "Troubleshooting:"
            echo "  1. Verify cluster exists: kind get clusters"
            echo "  2. Check cluster nodes: docker ps --filter name=^${CLUSTER_NAME}"
            echo "  3. View full log: cat /tmp/kind-load-${CLUSTER_NAME}.log"
            exit 1
        fi

        log_success "Image loaded into KIND cluster successfully"
    else
        log_warning "Dockerfile not found at $DOCKERFILE_LOCAL"
        log_warning "Deployment will attempt to pull image from registry"
        log_info "If deployment fails, ensure the image exists in the registry or provide a local Dockerfile"
    fi
fi

# Deploy secrets
log_info "Deploying secrets..."
if [ "$DRY_RUN" = true ]; then
    [ -f "$K8S_MANIFESTS_DIR/postgres-secret.yaml" ] && log_info "Would deploy: $K8S_MANIFESTS_DIR/postgres-secret.yaml" || log_warning "postgres-secret.yaml not found"
    [ -f "$K8S_MANIFESTS_DIR/oauth-secrets.yaml" ] && log_info "Would deploy: $K8S_MANIFESTS_DIR/oauth-secrets.yaml" || log_warning "oauth-secrets.yaml not found"
    [ -f "$K8S_MANIFESTS_DIR/vibecode-secrets.yaml" ] && log_info "Would deploy: $K8S_MANIFESTS_DIR/vibecode-secrets.yaml" || log_warning "vibecode-secrets.yaml not found"
else
    if [ -f "$K8S_MANIFESTS_DIR/postgres-secret.yaml" ]; then
        kubectl apply -f "$K8S_MANIFESTS_DIR/postgres-secret.yaml"
        log_success "PostgreSQL secrets deployed"
    else
        log_warning "postgres-secret.yaml not found, skipping..."
    fi

    if [ -f "$K8S_MANIFESTS_DIR/oauth-secrets.yaml" ]; then
        kubectl apply -f "$K8S_MANIFESTS_DIR/oauth-secrets.yaml"
        log_success "OAuth secrets deployed"
    else
        log_warning "oauth-secrets.yaml not found, skipping..."
    fi

    if [ -f "$K8S_MANIFESTS_DIR/vibecode-secrets.yaml" ]; then
        kubectl apply -f "$K8S_MANIFESTS_DIR/vibecode-secrets.yaml"
        log_success "VibeCode secrets deployed"
    else
        log_warning "vibecode-secrets.yaml not found, skipping..."
    fi
fi

# ============================================================================
# DEPLOY POSTGRESQL
# ============================================================================

log_info "Deploying PostgreSQL with pgvector..."
if [ "$DRY_RUN" = true ]; then
    if [ -f "$K8S_MANIFESTS_DIR/postgres-deployment.yaml" ]; then
        log_info "Would deploy: $K8S_MANIFESTS_DIR/postgres-deployment.yaml"
        log_info "Would wait for PostgreSQL deployment to be ready in namespace: $NAMESPACE_WEBGUI"
    else
        log_error "postgres-deployment.yaml not found at $K8S_MANIFESTS_DIR"
        exit 1
    fi
else
    if [ ! -f "$K8S_MANIFESTS_DIR/postgres-deployment.yaml" ]; then
        log_error "postgres-deployment.yaml not found at $K8S_MANIFESTS_DIR"
        echo ""
        log_error "Required manifest missing. Check:"
        echo "  1. Working directory: $(pwd)"
        echo "  2. Manifest directory exists: ls -la $K8S_MANIFESTS_DIR/"
        echo "  3. Repository is complete"
        exit 1
    fi

    # Apply PostgreSQL deployment
    if ! kubectl apply -f "$K8S_MANIFESTS_DIR/postgres-deployment.yaml" 2>&1 | tee /tmp/postgres-deploy.log; then
        log_error "Failed to apply PostgreSQL deployment"
        echo ""
        log_info "Check the deployment file for errors:"
        echo "  cat $K8S_MANIFESTS_DIR/postgres-deployment.yaml"
        echo "  kubectl apply -f $K8S_MANIFESTS_DIR/postgres-deployment.yaml --dry-run=client"
        exit 1
    fi
    log_success "PostgreSQL deployment applied"

    # Wait for PostgreSQL to be ready with better error handling
    log_info "Waiting for PostgreSQL to be ready (timeout: 300s)..."
    if ! kubectl wait --for=condition=available --timeout=300s deployment/postgres -n "$NAMESPACE_WEBGUI" 2>&1; then
        log_error "PostgreSQL deployment failed to become ready"
        echo ""
        log_error "Deployment status:"
        kubectl get deployment postgres -n "$NAMESPACE_WEBGUI" 2>/dev/null || echo "  Deployment not found"
        echo ""
        log_error "Pod status:"
        kubectl get pods -n "$NAMESPACE_WEBGUI" -l app=postgres 2>/dev/null || echo "  No pods found"
        echo ""
        log_info "Troubleshooting:"
        echo "  1. Check pod logs: kubectl logs -n $NAMESPACE_WEBGUI -l app=postgres"
        echo "  2. Describe pod: kubectl describe pod -n $NAMESPACE_WEBGUI -l app=postgres"
        echo "  3. Check events: kubectl get events -n $NAMESPACE_WEBGUI --sort-by='.lastTimestamp'"
        exit 1
    fi
    log_success "PostgreSQL is ready"
fi

# ============================================================================
# DEPLOY REDIS
# ============================================================================

log_info "Deploying Redis..."
if [ "$DRY_RUN" = true ]; then
    if [ -f "$K8S_MANIFESTS_DIR/redis-deployment.yaml" ]; then
        log_info "Would deploy: $K8S_MANIFESTS_DIR/redis-deployment.yaml"
        log_info "Would wait for Redis deployment to be ready in namespace: $NAMESPACE_PLATFORM"
    else
        log_warning "redis-deployment.yaml not found, would skip Redis deployment"
    fi
else
    if [ -f "$K8S_MANIFESTS_DIR/redis-deployment.yaml" ]; then
        # Apply Redis deployment
        if ! kubectl apply -f "$K8S_MANIFESTS_DIR/redis-deployment.yaml" 2>&1 | tee /tmp/redis-deploy.log; then
            log_error "Failed to apply Redis deployment"
            echo "  Check manifest: $K8S_MANIFESTS_DIR/redis-deployment.yaml"
            exit 1
        fi
        log_success "Redis deployment applied"

        # Wait for Redis to be ready
        log_info "Waiting for Redis to be ready (timeout: 180s)..."
        if ! kubectl wait --for=condition=available --timeout=180s deployment/redis -n "$NAMESPACE_PLATFORM" 2>&1; then
            log_error "Redis deployment failed to become ready"
            echo ""
            log_error "Deployment status:"
            kubectl get deployment redis -n "$NAMESPACE_PLATFORM" 2>/dev/null || echo "  Deployment not found"
            echo ""
            log_info "Redis is optional - continuing with deployment..."
            log_info "You can check Redis status later with:"
            echo "  kubectl get pods -n $NAMESPACE_PLATFORM -l app=redis"
        else
            log_success "Redis is ready"
        fi
    else
        log_warning "redis-deployment.yaml not found, skipping Redis deployment"
        log_info "Redis is optional for this deployment"
    fi
fi

# ============================================================================
# DEPLOY VIBECODE WEBGUI
# ============================================================================

log_info "Deploying VibeCode WebGUI..."
if [ "$DRY_RUN" = true ]; then
    if [ -f "$K8S_MANIFESTS_DIR/vibecode-deployment.yaml" ]; then
        log_info "Would deploy: $K8S_MANIFESTS_DIR/vibecode-deployment.yaml"
        log_info "Would wait for VibeCode WebGUI deployment to be ready in namespace: $NAMESPACE_PLATFORM"
    else
        log_error "vibecode-deployment.yaml not found at $K8S_MANIFESTS_DIR"
        exit 1
    fi
else
    if [ ! -f "$K8S_MANIFESTS_DIR/vibecode-deployment.yaml" ]; then
        log_error "vibecode-deployment.yaml not found at $K8S_MANIFESTS_DIR"
        echo ""
        log_error "Critical manifest missing. Check:"
        echo "  1. Working directory: $(pwd)"
        echo "  2. Manifest directory: ls -la $K8S_MANIFESTS_DIR/"
        exit 1
    fi

    # Apply VibeCode WebGUI deployment
    if ! kubectl apply -f "$K8S_MANIFESTS_DIR/vibecode-deployment.yaml" 2>&1 | tee /tmp/vibecode-deploy.log; then
        log_error "Failed to apply VibeCode WebGUI deployment"
        echo ""
        log_info "Check the deployment file for errors:"
        echo "  cat $K8S_MANIFESTS_DIR/vibecode-deployment.yaml"
        echo "  kubectl apply -f $K8S_MANIFESTS_DIR/vibecode-deployment.yaml --dry-run=client"
        exit 1
    fi
    log_success "VibeCode WebGUI deployment applied"

    # Wait for VibeCode to be ready with better error handling
    log_info "Waiting for VibeCode WebGUI to be ready (timeout: 300s)..."
    if ! kubectl wait --for=condition=available --timeout=300s deployment/vibecode-webgui -n "$NAMESPACE_PLATFORM" 2>&1; then
        log_error "VibeCode WebGUI deployment failed to become ready"
        echo ""
        log_error "Deployment status:"
        kubectl get deployment vibecode-webgui -n "$NAMESPACE_PLATFORM" 2>/dev/null || echo "  Deployment not found"
        echo ""
        log_error "Pod status:"
        kubectl get pods -n "$NAMESPACE_PLATFORM" -l app=vibecode-webgui 2>/dev/null || echo "  No pods found"
        echo ""
        log_error "Common causes:"
        echo "  1. Image pull failures (check if image exists in cluster)"
        echo "  2. Resource limits exceeded (insufficient memory/CPU)"
        echo "  3. Missing dependencies (PostgreSQL not ready)"
        echo "  4. Configuration errors (secrets, env vars)"
        echo ""
        log_info "Troubleshooting:"
        echo "  1. Check pod logs: kubectl logs -n $NAMESPACE_PLATFORM -l app=vibecode-webgui"
        echo "  2. Describe pod: kubectl describe pod -n $NAMESPACE_PLATFORM -l app=vibecode-webgui"
        echo "  3. Check events: kubectl get events -n $NAMESPACE_PLATFORM --sort-by='.lastTimestamp'"
        echo "  4. Verify image: kind load docker-image $VIBECODE_IMAGE --name $CLUSTER_NAME"
        exit 1
    fi
    log_success "VibeCode WebGUI is ready"
fi

# ============================================================================
# COMPREHENSIVE DEPLOYMENT VERIFICATION
# ============================================================================

echo ""
echo "🔍 Verifying Deployment Health..."
echo "=================================="

if [ "$DRY_RUN" = true ]; then
    log_info "DRY RUN: Would verify all deployments"
    log_info "DRY RUN: Would check PostgreSQL deployment health"
    log_info "DRY RUN: Would check Redis deployment health"
    log_info "DRY RUN: Would check VibeCode WebGUI deployment health"
    log_info "DRY RUN: Would verify pod status in all namespaces"
    echo ""
else
    VERIFICATION_FAILED=false

    # Verify PostgreSQL deployment
    log_info "Verifying PostgreSQL deployment..."
    if verify_deployment_health "postgres" "$NAMESPACE_WEBGUI"; then
        log_success "PostgreSQL deployment verified"
    else
        log_error "PostgreSQL deployment verification failed"
        VERIFICATION_FAILED=true
    fi

    # Verify Redis deployment (if deployed)
    if kubectl get deployment redis -n "$NAMESPACE_PLATFORM" > /dev/null 2>&1; then
        log_info "Verifying Redis deployment..."
        if verify_deployment_health "redis" "$NAMESPACE_PLATFORM"; then
            log_success "Redis deployment verified"
        else
            log_error "Redis deployment verification failed"
            VERIFICATION_FAILED=true
        fi
    else
        log_warning "Redis deployment not found (may not be configured)"
    fi

    # Verify VibeCode WebGUI deployment
    log_info "Verifying VibeCode WebGUI deployment..."
    if verify_deployment_health "vibecode-webgui" "$NAMESPACE_PLATFORM"; then
        log_success "VibeCode WebGUI deployment verified"
    else
        log_error "VibeCode WebGUI deployment verification failed"
        VERIFICATION_FAILED=true
    fi

    # Get comprehensive pod status
    echo ""
    log_info "Pod status summary..."
    echo "  Platform namespace ($NAMESPACE_PLATFORM): $(get_pod_status "$NAMESPACE_PLATFORM")"
    echo "  WebGUI namespace ($NAMESPACE_WEBGUI): $(get_pod_status "$NAMESPACE_WEBGUI")"

    # Check for failed pods
    FAILED_PODS_PLATFORM=$(kubectl get pods -n "$NAMESPACE_PLATFORM" --field-selector=status.phase=Failed --no-headers 2>/dev/null | wc -l | tr -d ' ')
    FAILED_PODS_WEBGUI=$(kubectl get pods -n "$NAMESPACE_WEBGUI" --field-selector=status.phase=Failed --no-headers 2>/dev/null | wc -l | tr -d ' ')

    if [ "$FAILED_PODS_PLATFORM" -gt 0 ] || [ "$FAILED_PODS_WEBGUI" -gt 0 ]; then
        log_error "Found failed pods in deployment"
        VERIFICATION_FAILED=true

        if [ "$FAILED_PODS_PLATFORM" -gt 0 ]; then
            echo ""
            log_error "Failed pods in $NAMESPACE_PLATFORM:"
            kubectl get pods -n "$NAMESPACE_PLATFORM" --field-selector=status.phase=Failed
        fi

        if [ "$FAILED_PODS_WEBGUI" -gt 0 ]; then
            echo ""
            log_error "Failed pods in $NAMESPACE_WEBGUI:"
            kubectl get pods -n "$NAMESPACE_WEBGUI" --field-selector=status.phase=Failed
        fi
    fi

    # Wait a moment for services to stabilize
    log_info "Allowing services to stabilize..."
    sleep 5

    # Final verification status
    echo ""
    if [ "$VERIFICATION_FAILED" = true ]; then
        log_error "❌ Deployment verification FAILED"
        log_warning "Some components are not healthy. Check the logs above for details."
        echo ""
        log_info "Troubleshooting commands:"
        echo "  Check pod status:   kubectl get pods --all-namespaces"
        echo "  View pod logs:      kubectl logs -n <namespace> <pod-name>"
        echo "  Describe pod:       kubectl describe pod -n <namespace> <pod-name>"
        echo ""
        exit 1
    else
        log_success "✅ All deployments verified successfully"
    fi
fi

# Display deployment summary
echo ""
echo "📊 Deployment Summary:"
echo "  ☸️  Cluster: $CLUSTER_NAME"
echo "  📦 Namespaces: $NAMESPACE_PLATFORM, $NAMESPACE_WEBGUI"
echo ""

if [ "$DRY_RUN" = true ]; then
    log_info "DRY RUN: Would display pod status in namespaces"
    log_info "DRY RUN: Would display service endpoints"
    log_info "DRY RUN: Would check for VibeCode WebGUI NodePort"
    echo ""
    log_success "✅ DRY RUN completed - no actual changes were made"
    echo ""
    echo "📝 To deploy for real, run without --dry-run:"
    echo "  $0"
    echo ""
else
    # Display detailed pod status
    echo "Pods in $NAMESPACE_PLATFORM:"
    kubectl get pods -n "$NAMESPACE_PLATFORM" 2>/dev/null || log_warning "No pods found in $NAMESPACE_PLATFORM"
    echo ""
    echo "Pods in $NAMESPACE_WEBGUI:"
    kubectl get pods -n "$NAMESPACE_WEBGUI" 2>/dev/null || log_warning "No pods found in $NAMESPACE_WEBGUI"

    # Display service endpoints
    echo ""
    log_info "Service endpoints..."
    echo ""
    kubectl get services -n "$NAMESPACE_PLATFORM" 2>/dev/null || log_warning "No services found in $NAMESPACE_PLATFORM"

    # Get NodePort for VibeCode WebGUI if available
    VIBECODE_NODEPORT=$(kubectl get service vibecode-service -n "$NAMESPACE_PLATFORM" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")
    if [ -n "$VIBECODE_NODEPORT" ]; then
        echo ""
        log_success "VibeCode WebGUI is available at: http://localhost:${VIBECODE_NODEPORT}"
        log_info "Default login: admin@vibecode.dev / admin123"
    else
        echo ""
        log_warning "VibeCode service not found or NodePort not configured"
        log_info "You can access the service using port-forwarding:"
        log_info "  kubectl port-forward -n $NAMESPACE_PLATFORM service/vibecode-service 3000:3000"
    fi

    echo ""
    log_success "✅ VibeCode deployment completed successfully!"
    echo ""
    echo "📝 Quick commands:"
    echo "  View logs:        kubectl logs -n $NAMESPACE_PLATFORM -l app=vibecode-webgui --tail=50 -f"
    echo "  View all pods:    kubectl get pods --all-namespaces"
    echo "  Delete cluster:   kind delete cluster --name $CLUSTER_NAME"
    echo ""
fi
