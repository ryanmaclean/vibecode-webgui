#!/bin/bash
# Install Tundra Dome Controllers
# Creates ConfigMaps with controller code and deploys the controllers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="${NAMESPACE:-tundra-dome}"

log_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
log_success() { echo -e "\033[0;32m[OK]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# Create namespace if needed
kubectl create namespace "$NAMESPACE" 2>/dev/null || true

# Create ConfigMaps from controller code
log_info "Creating controller code ConfigMaps..."

# Polecat Operator
kubectl create configmap polecat-operator-code \
    --from-file=index.js="$SCRIPT_DIR/polecat-operator/index.js" \
    --from-file=package.json="$SCRIPT_DIR/polecat-operator/package.json" \
    -n "$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -
log_success "polecat-operator-code ConfigMap"

# Bead Controller
kubectl create configmap bead-controller-code \
    --from-file=index.js="$SCRIPT_DIR/bead-controller/index.js" \
    --from-file=package.json="$SCRIPT_DIR/bead-controller/package.json" \
    -n "$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -
log_success "bead-controller-code ConfigMap"

# OpenLineage-Bead Bridge
kubectl create configmap openlineage-bead-bridge-code \
    --from-file=index.js="$SCRIPT_DIR/../bridges/openlineage-bead/index.js" \
    --from-file=package.json="$SCRIPT_DIR/../bridges/openlineage-bead/package.json" \
    -n "$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -
log_success "openlineage-bead-bridge-code ConfigMap"

# Deploy controllers
log_info "Deploying controllers..."
kubectl apply -f "$SCRIPT_DIR/controllers.yaml"
log_success "Controllers deployed"

# Wait for controllers to be ready
log_info "Waiting for controllers to be ready..."
kubectl rollout status deployment/polecat-operator -n "$NAMESPACE" --timeout=120s || true
kubectl rollout status deployment/bead-controller -n "$NAMESPACE" --timeout=120s || true
kubectl rollout status deployment/openlineage-bead-bridge -n "$NAMESPACE" --timeout=120s || true

log_success "Controllers installed!"

echo ""
echo "Verify with:"
echo "  kubectl get pods -n $NAMESPACE -l tundra.dome/component=controller"
echo "  kubectl get pods -n $NAMESPACE -l tundra.dome/component=bridge"
