#!/bin/bash
#
# Tundra Dome Bootstrap Script
# =============================
# Initial cluster setup and prerequisite checks
#
# Usage:
#   ./bootstrap.sh              # Bootstrap with defaults
#   ./bootstrap.sh --check      # Check prerequisites only
#   ./bootstrap.sh --clean      # Remove cluster and start fresh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="${TUNDRA_CLUSTER_NAME:-tundra-dome}"
NAMESPACE="tundra-dome"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[bootstrap]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

check_prerequisites() {
    log "Checking prerequisites..."

    local missing=()

    for cmd in kind kubectl docker; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing required tools: ${missing[*]}. Install with: brew install ${missing[*]}"
    fi

    if ! docker info &>/dev/null; then
        error "Docker is not running. Please start Docker first."
    fi

    log "All prerequisites satisfied"
}

create_cluster() {
    log "Creating KIND cluster: $CLUSTER_NAME"

    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        warn "Cluster '$CLUSTER_NAME' already exists"
        return 0
    fi

    # Use existing kind-config.yaml if available, otherwise create minimal config
    if [ -f "$SCRIPT_DIR/../kind-config.yaml" ]; then
        kind create cluster --name "$CLUSTER_NAME" --config "$SCRIPT_DIR/../kind-config.yaml"
    else
        kind create cluster --name "$CLUSTER_NAME"
    fi

    log "Cluster created successfully"
}

setup_namespaces() {
    log "Setting up namespaces..."

    kubectl config use-context "kind-${CLUSTER_NAME}" &>/dev/null

    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - &>/dev/null
    kubectl create namespace datadog --dry-run=client -o yaml | kubectl apply -f - &>/dev/null

    log "Namespaces ready"
}

setup_secrets() {
    log "Creating initial secrets..."

    local api_key="${DD_API_KEY:-placeholder-key}"

    kubectl -n "$NAMESPACE" create secret generic tundra-dome-secrets \
        --from-literal=DD_API_KEY="$api_key" \
        --dry-run=client -o yaml | kubectl apply -f - &>/dev/null

    if [ "$api_key" = "placeholder-key" ]; then
        warn "DD_API_KEY not set. Using placeholder. Set with: export DD_API_KEY=your_key"
    fi

    log "Secrets created"
}

install_crds() {
    log "Installing CRDs..."

    local crds_dir="$SCRIPT_DIR/../crds"

    if [ -d "$crds_dir" ]; then
        kubectl apply -f "$crds_dir/" 2>&1 | grep -v "unchanged" || true
        log "CRDs installed"
    else
        warn "CRDs directory not found at $crds_dir"
    fi
}

case "${1:-}" in
    --check)
        check_prerequisites
        exit 0
        ;;
    --clean)
        log "Cleaning up existing cluster..."
        kind delete cluster --name "$CLUSTER_NAME" 2>/dev/null || true
        log "Cleanup complete"
        exit 0
        ;;
esac

log "Starting Tundra Dome bootstrap..."

check_prerequisites
create_cluster
setup_namespaces
setup_secrets
install_crds

echo ""
log "Bootstrap complete!"
echo ""
echo "  Next steps:"
echo "    Deploy stack:  $SCRIPT_DIR/deploy.sh"
echo "    Health check:  $SCRIPT_DIR/proactive-health-check.sh"
echo "    Cluster info:  kubectl cluster-info --context kind-${CLUSTER_NAME}"
echo ""
