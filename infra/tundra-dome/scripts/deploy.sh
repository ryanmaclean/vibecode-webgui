#!/bin/bash
#
# Tundra Dome Deploy Script
# ==========================
# Deploy Tundra Dome stack to existing cluster
#
# Usage:
#   ./deploy.sh                 # Full deployment
#   ./deploy.sh --stack-only    # Stack only (no examples)
#   ./deploy.sh --examples      # Examples only
#   ./deploy.sh --wait          # Deploy and wait for ready
#   ./deploy.sh --status        # Show deployment status
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="${TUNDRA_CLUSTER_NAME:-tundra-dome}"
NAMESPACE="tundra-dome"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
info() { echo -e "${BLUE}[info]${NC} $1"; }

check_cluster() {
    if ! kubectl cluster-info --context "kind-${CLUSTER_NAME}" &>/dev/null; then
        warn "Cluster not accessible. Run bootstrap.sh first."
        exit 1
    fi
    kubectl config use-context "kind-${CLUSTER_NAME}" &>/dev/null
}

show_status() {
    info "Deployment status for $NAMESPACE:"
    echo ""

    echo "Pods:"
    kubectl get pods -n "$NAMESPACE" 2>/dev/null || echo "  No pods found"
    echo ""

    echo "Services:"
    kubectl get svc -n "$NAMESPACE" 2>/dev/null || echo "  No services found"
    echo ""

    echo "Custom Resources:"
    kubectl get beads,polecats,lanes,playbooks,stations -n "$NAMESPACE" 2>/dev/null || echo "  No custom resources found"
    echo ""
}

deploy_stack() {
    log "Deploying Tundra Dome stack..."

    local manifest="$SCRIPT_DIR/../tundra-dome.clean.yaml"

    if [ ! -f "$manifest" ]; then
        warn "Stack manifest not found at $manifest"
        return 1
    fi

    kubectl apply -f "$manifest" 2>&1 | grep -v "hides previous definition" || true

    log "Stack deployed"
}

deploy_examples() {
    log "Deploying example resources..."

    local examples_dir="$SCRIPT_DIR/../examples"

    if [ ! -d "$examples_dir" ]; then
        warn "Examples directory not found at $examples_dir"
        return 1
    fi

    kubectl apply -f "$examples_dir/" 2>&1 | grep -v "unchanged" || true

    log "Examples deployed"
}

wait_for_ready() {
    log "Waiting for services to be ready..."

    info "Waiting for Kafka..."
    kubectl wait --for=condition=ready pod -l app=kafka -n "$NAMESPACE" --timeout=120s 2>/dev/null || warn "Kafka not ready yet"

    info "Waiting for Airflow scheduler..."
    kubectl wait --for=condition=ready pod -l app=airflow-scheduler -n "$NAMESPACE" --timeout=180s 2>/dev/null || warn "Airflow not ready yet"

    info "Waiting for PostgreSQL..."
    kubectl wait --for=condition=ready pod -l app=postgresql -n "$NAMESPACE" --timeout=60s 2>/dev/null || warn "PostgreSQL not ready yet"

    log "Core services ready (or timeout reached)"
}

case "${1:-}" in
    --status)
        check_cluster
        show_status
        exit 0
        ;;
    --stack-only)
        check_cluster
        deploy_stack
        exit 0
        ;;
    --examples)
        check_cluster
        deploy_examples
        exit 0
        ;;
    --wait)
        check_cluster
        deploy_stack
        deploy_examples
        wait_for_ready
        exit 0
        ;;
esac

log "Starting deployment..."

check_cluster
deploy_stack
deploy_examples

echo ""
log "Deployment complete!"
echo ""
echo "  Status:      $SCRIPT_DIR/deploy.sh --status"
echo "  Health:      $SCRIPT_DIR/proactive-health-check.sh"
echo ""
echo "  Port forward Airflow UI:"
echo "    kubectl port-forward svc/airflow-api-service 8080:8080 -n $NAMESPACE"
echo ""
