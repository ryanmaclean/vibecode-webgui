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

# Run prerequisites check
log_info "Checking prerequisites..."
if [ "$DRY_RUN" = true ]; then
    log_info "Would check prerequisites script"
elif [ -f "$(dirname "$0")/check-k8s-prerequisites.sh" ]; then
    if bash "$(dirname "$0")/check-k8s-prerequisites.sh" > /dev/null 2>&1; then
        log_success "All prerequisites met"
    else
        log_error "Prerequisites check failed. Please run: ./scripts/check-k8s-prerequisites.sh"
        exit 1
    fi
else
    log_warning "Prerequisites check script not found, continuing anyway..."
fi

# Check if KIND cluster exists
log_info "Checking KIND cluster..."
if [ "$DRY_RUN" = true ]; then
    log_info "Would check for KIND cluster: $CLUSTER_NAME"
    log_info "If cluster doesn't exist, would create it with: kind create cluster --name $CLUSTER_NAME"
    log_info "Would set kubectl context to: kind-${CLUSTER_NAME}"
else
    if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_info "Creating KIND cluster: $CLUSTER_NAME"
        kind create cluster --name "$CLUSTER_NAME"
        log_success "KIND cluster created"
    else
        log_success "KIND cluster already exists: $CLUSTER_NAME"
    fi

    # Ensure kubectl context is set
    log_info "Setting kubectl context..."
    kubectl config use-context "kind-${CLUSTER_NAME}"
    log_success "kubectl context set to kind-${CLUSTER_NAME}"
fi

# Create namespaces
log_info "Creating namespaces..."
if [ "$DRY_RUN" = true ]; then
    log_info "Would create namespace: $NAMESPACE_PLATFORM"
    log_info "Would create namespace: $NAMESPACE_WEBGUI"
else
    kubectl create namespace "$NAMESPACE_PLATFORM" --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace "$NAMESPACE_WEBGUI" --dry-run=client -o yaml | kubectl apply -f -
    log_success "Namespaces created: $NAMESPACE_PLATFORM, $NAMESPACE_WEBGUI"
fi

# Build and load VibeCode WebGUI image into KIND
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
        log_info "Building VibeCode WebGUI image (this may take a few minutes)..."
        docker build -t "$VIBECODE_IMAGE" -f "$DOCKERFILE_LOCAL" . 2>&1 | grep -E "^(Step|Successfully|#)" || true

        if [ $? -eq 0 ]; then
            log_success "Image built successfully"

            log_info "Loading image into KIND cluster..."
            kind load docker-image "$VIBECODE_IMAGE" --name "$CLUSTER_NAME"
            log_success "Image loaded into KIND cluster"
        else
            log_error "Failed to build VibeCode WebGUI image"
            log_warning "Continuing anyway - deployment will fail if image is not available"
        fi
    else
        log_warning "Dockerfile not found at $DOCKERFILE_LOCAL"
        log_warning "Deployment will attempt to pull image from registry"
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

# Deploy PostgreSQL
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
    if [ -f "$K8S_MANIFESTS_DIR/postgres-deployment.yaml" ]; then
        kubectl apply -f "$K8S_MANIFESTS_DIR/postgres-deployment.yaml"
        log_success "PostgreSQL deployment applied"

        # Wait for PostgreSQL to be ready
        log_info "Waiting for PostgreSQL to be ready..."
        kubectl wait --for=condition=available --timeout=300s deployment/postgres -n "$NAMESPACE_WEBGUI" 2>/dev/null || log_warning "Timeout waiting for PostgreSQL (may still be starting)"
        log_success "PostgreSQL is ready"
    else
        log_error "postgres-deployment.yaml not found at $K8S_MANIFESTS_DIR"
        exit 1
    fi
fi

# Deploy Redis
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
        kubectl apply -f "$K8S_MANIFESTS_DIR/redis-deployment.yaml"
        log_success "Redis deployment applied"

        # Wait for Redis to be ready
        log_info "Waiting for Redis to be ready..."
        kubectl wait --for=condition=available --timeout=180s deployment/redis -n "$NAMESPACE_PLATFORM" 2>/dev/null || log_warning "Timeout waiting for Redis (may still be starting)"
        log_success "Redis is ready"
    else
        log_warning "redis-deployment.yaml not found, skipping Redis deployment"
    fi
fi

# Deploy VibeCode WebGUI
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
    if [ -f "$K8S_MANIFESTS_DIR/vibecode-deployment.yaml" ]; then
        kubectl apply -f "$K8S_MANIFESTS_DIR/vibecode-deployment.yaml"
        log_success "VibeCode WebGUI deployment applied"

        # Wait for VibeCode to be ready
        log_info "Waiting for VibeCode WebGUI to be ready..."
        kubectl wait --for=condition=available --timeout=300s deployment/vibecode-webgui -n "$NAMESPACE_PLATFORM" 2>/dev/null || log_warning "Timeout waiting for VibeCode (may still be starting)"
        log_success "VibeCode WebGUI is ready"
    else
        log_error "vibecode-deployment.yaml not found at $K8S_MANIFESTS_DIR"
        exit 1
    fi
fi

# Display deployment summary
echo ""
echo "📊 Deployment Summary:"
echo "  ☸️  Cluster: $CLUSTER_NAME"
echo "  📦 Namespaces: $NAMESPACE_PLATFORM, $NAMESPACE_WEBGUI"
echo ""

if [ "$DRY_RUN" = true ]; then
    log_info "DRY RUN: Would check pod status in namespaces"
    log_info "DRY RUN: Would display service endpoints"
    log_info "DRY RUN: Would check for VibeCode WebGUI NodePort"
    echo ""
    log_success "✅ DRY RUN completed - no actual changes were made"
    echo ""
    echo "📝 To deploy for real, run without --dry-run:"
    echo "  $0"
    echo ""
else
    # Check pod status
    log_info "Checking pod status..."
    echo ""
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
