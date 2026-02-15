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

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-vibecode-local}"
NAMESPACE_PLATFORM="vibecode-platform"
NAMESPACE_WEBGUI="vibecode-webgui"
K8S_MANIFESTS_DIR="platforms/kubernetes/k8s"

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

# Run prerequisites check
log_info "Checking prerequisites..."
if [ -f "$(dirname "$0")/check-k8s-prerequisites.sh" ]; then
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

# Create namespaces
log_info "Creating namespaces..."
kubectl create namespace "$NAMESPACE_PLATFORM" --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace "$NAMESPACE_WEBGUI" --dry-run=client -o yaml | kubectl apply -f -
log_success "Namespaces created: $NAMESPACE_PLATFORM, $NAMESPACE_WEBGUI"

# Deploy secrets
log_info "Deploying secrets..."
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

# Deploy PostgreSQL
log_info "Deploying PostgreSQL with pgvector..."
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

# Deploy Redis
log_info "Deploying Redis..."
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

# Deploy VibeCode WebGUI
log_info "Deploying VibeCode WebGUI..."
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

# Display deployment summary
echo ""
echo "📊 Deployment Summary:"
echo "  ☸️  Cluster: $CLUSTER_NAME"
echo "  📦 Namespaces: $NAMESPACE_PLATFORM, $NAMESPACE_WEBGUI"
echo ""

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
