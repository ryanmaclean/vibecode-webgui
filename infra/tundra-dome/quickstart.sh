#!/bin/bash
#
# Tundra Dome Quick Start
# =======================
# One-command deployment for local development
#
# Usage:
#   ./quickstart.sh              # Deploy with defaults
#   ./quickstart.sh --with-dd    # Deploy with Datadog (requires DD_API_KEY)
#   ./quickstart.sh --teardown   # Remove everything
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="tundra-dome"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[tundra]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }

case "${1:-}" in
    --teardown)
        log "Tearing down Tundra Dome..."
        kind delete cluster --name "$CLUSTER_NAME" 2>/dev/null || true
        log "Done."
        exit 0
        ;;
    --with-dd)
        if [ -z "$DD_API_KEY" ]; then
            warn "DD_API_KEY not set. Datadog features will be limited."
        fi
        ;;
esac

# Check prerequisites
for cmd in kind kubectl docker; do
    if ! command -v $cmd &>/dev/null; then
        echo "Missing: $cmd. Install with: brew install $cmd"
        exit 1
    fi
done

if ! docker info &>/dev/null; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

log "Starting Tundra Dome deployment..."

# Create cluster if not exists
if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    log "Creating KIND cluster..."
    kind create cluster --name "$CLUSTER_NAME" --config "$SCRIPT_DIR/kind-config.yaml"
else
    log "Using existing cluster: $CLUSTER_NAME"
fi

kubectl config use-context "kind-${CLUSTER_NAME}"

# Create namespaces
log "Creating namespaces..."
kubectl create namespace tundra-dome --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace datadog --dry-run=client -o yaml | kubectl apply -f -

# Install CRDs
log "Installing CRDs..."
kubectl apply -f "$SCRIPT_DIR/crds/"

# Deploy stack
log "Deploying Tundra Dome stack..."
kubectl apply -f "$SCRIPT_DIR/tundra-dome.clean.yaml" 2>&1 | grep -v "hides previous definition" || true

# Deploy examples
log "Deploying example resources..."
kubectl apply -f "$SCRIPT_DIR/examples/"

# Wait for core services
log "Waiting for Kafka..."
kubectl wait --for=condition=ready pod -l app=kafka -n tundra-dome --timeout=120s 2>/dev/null || warn "Kafka not ready yet"

log "Waiting for Airflow..."
kubectl wait --for=condition=ready pod -l app=airflow-scheduler -n tundra-dome --timeout=180s 2>/dev/null || warn "Airflow not ready yet"

echo ""
log "Tundra Dome is ready!"
echo ""
echo "  Airflow UI:  kubectl port-forward svc/airflow-api-service 8080:8080 -n tundra-dome"
echo "               Then visit http://localhost:8080 (tundra/admin)"
echo ""
echo "  Kafka:       kubectl port-forward svc/kafka 9092:9092 -n tundra-dome"
echo ""
echo "  Status:      ./deploy.sh --status"
echo "  Teardown:    ./quickstart.sh --teardown"
echo ""
