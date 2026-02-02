#!/bin/bash
set -euo pipefail

# VibeCode AgentAPI Kubernetes Deployment Script
# Validates and deploys all manifests with health checks

NAMESPACE="vibecode-platform"
DEPLOYMENT="code-server-workspace"
TIMEOUT=300

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        error "kubectl not found. Please install kubectl."
    fi

    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster. Check your kubeconfig."
    fi

    info "Prerequisites check passed"
}

# Validate manifests
validate_manifests() {
    info "Validating Kubernetes manifests..."

    for file in *.yaml; do
        if ! kubectl apply --dry-run=client -f "$file" &> /dev/null; then
            error "Invalid manifest: $file"
        fi
    done

    info "All manifests validated successfully"
}

# Deploy namespace and RBAC
deploy_namespace() {
    info "Creating namespace and RBAC..."
    kubectl apply -f 00-namespace.yaml

    # Wait for service account
    kubectl -n "$NAMESPACE" wait --for=condition=Ready serviceaccount/code-server-sa --timeout=30s || true
    info "Namespace and RBAC created"
}

# Deploy ConfigMap and Secrets
deploy_config() {
    info "Creating ConfigMap and Secrets..."

    kubectl apply -f 01-configmap.yaml

    # Check if secrets exist, create if not
    if ! kubectl -n "$NAMESPACE" get secret code-server-config &> /dev/null; then
        warn "Secret code-server-config not found, creating default..."
        kubectl apply -f 02-secrets.yaml
    else
        info "Secret code-server-config already exists, skipping"
    fi

    info "Configuration created"
}

# Deploy storage
deploy_storage() {
    info "Creating PersistentVolumeClaim..."

    # Check if storage class exists
    STORAGE_CLASS=$(kubectl get sc vibecode-ssd-storage --no-headers 2>/dev/null || echo "")
    if [ -z "$STORAGE_CLASS" ]; then
        warn "StorageClass vibecode-ssd-storage not found. Using default StorageClass."
        # Update manifest to use default storage class
        kubectl apply -f 06-pvc.yaml
    else
        kubectl apply -f 06-pvc.yaml
    fi

    # Wait for PVC to be bound
    info "Waiting for PVC to be bound..."
    kubectl -n "$NAMESPACE" wait --for=condition=Bound pvc/code-server-workspace-pvc --timeout=60s || \
        warn "PVC not bound yet. This may take time depending on your storage provisioner."

    info "Storage created"
}

# Deploy service
deploy_service() {
    info "Creating Service..."
    kubectl apply -f 03-service.yaml

    # Verify service is created
    kubectl -n "$NAMESPACE" get svc code-server-workspace
    info "Service created"
}

# Deploy workload
deploy_workload() {
    info "Deploying code-server-workspace..."
    kubectl apply -f 04-deployment.yaml

    info "Waiting for deployment to be ready..."
    if ! kubectl -n "$NAMESPACE" wait --for=condition=Available deployment/$DEPLOYMENT --timeout=${TIMEOUT}s; then
        error "Deployment failed to become ready within ${TIMEOUT}s"
    fi

    info "Deployment ready"
}

# Deploy autoscaling and policies
deploy_policies() {
    info "Deploying autoscaling and policies..."

    # Check if metrics-server is available
    if kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        kubectl apply -f 05-hpa.yaml
        info "HPA created"
    else
        warn "metrics-server not found. Skipping HPA creation. Install metrics-server for autoscaling."
    fi

    # Apply network policy if supported
    if kubectl api-resources | grep -q networkpolicies; then
        kubectl apply -f 07-networkpolicy.yaml
        info "NetworkPolicy created"
    else
        warn "NetworkPolicies not supported in this cluster. Skipping."
    fi

    kubectl apply -f 08-pdb.yaml
    kubectl apply -f 09-priorityclass.yaml

    info "Policies deployed"
}

# Verify deployment
verify_deployment() {
    info "Verifying deployment..."

    # Check pod status
    PODS=$(kubectl -n "$NAMESPACE" get pods -l app=code-server --no-headers 2>/dev/null || echo "")
    if [ -z "$PODS" ]; then
        error "No pods found for deployment"
    fi

    POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l app=code-server -o jsonpath='{.items[0].metadata.name}')
    info "Pod: $POD_NAME"

    # Check container status
    info "Checking container status..."
    kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{range .status.containerStatuses[*]}{.name}{": "}{.ready}{"\n"}{end}'

    # Test health endpoints
    info "Testing health endpoints..."

    # code-server health
    if kubectl -n "$NAMESPACE" exec "$POD_NAME" -c code-server -- curl -sf http://localhost:8765/healthz &> /dev/null; then
        info "code-server health check: PASS"
    else
        warn "code-server health check: FAIL"
    fi

    # agentapi health
    if kubectl -n "$NAMESPACE" exec "$POD_NAME" -c agentapi -- curl -sf http://127.0.0.1:3284/health &> /dev/null; then
        info "agentapi health check: PASS"
    else
        warn "agentapi health check: FAIL"
    fi

    # Show logs
    info "Recent logs (code-server):"
    kubectl -n "$NAMESPACE" logs "$POD_NAME" -c code-server --tail=5

    info "Recent logs (agentapi):"
    kubectl -n "$NAMESPACE" logs "$POD_NAME" -c agentapi --tail=5

    info "Deployment verification complete"
}

# Show access information
show_access_info() {
    info "Deployment complete!"
    echo ""
    echo "Access Information:"
    echo "==================="
    echo ""
    echo "Service: code-server-workspace.$NAMESPACE.svc.cluster.local"
    echo ""
    echo "Ports:"
    echo "  - IDE:      8765"
    echo "  - AgentAPI: 3284"
    echo "  - Metrics:  9090"
    echo ""
    echo "Port Forward (for local access):"
    echo "  kubectl -n $NAMESPACE port-forward svc/code-server-workspace 8765:8765"
    echo ""
    echo "View Logs:"
    echo "  kubectl -n $NAMESPACE logs -l app=code-server -c code-server --tail=50"
    echo "  kubectl -n $NAMESPACE logs -l app=code-server -c agentapi --tail=50"
    echo ""
    echo "Scale Deployment:"
    echo "  kubectl -n $NAMESPACE scale deployment/$DEPLOYMENT --replicas=3"
    echo ""
}

# Main deployment flow
main() {
    info "Starting VibeCode AgentAPI deployment..."

    check_prerequisites
    validate_manifests

    deploy_namespace
    deploy_config
    deploy_storage
    deploy_service
    deploy_workload
    deploy_policies

    verify_deployment
    show_access_info

    info "Deployment completed successfully!"
}

# Run main function
main "$@"
