#!/bin/bash
# Install Tundra Dome CRDs
# Usage: ./install.sh [--delete]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$1" == "--delete" ]]; then
    echo "Removing Tundra Dome CRDs..."
    kubectl delete crd beads.tundra.dome 2>/dev/null || true
    kubectl delete crd polecats.tundra.dome 2>/dev/null || true
    kubectl delete crd lanes.tundra.dome 2>/dev/null || true
    kubectl delete crd playbooks.tundra.dome 2>/dev/null || true
    kubectl delete crd stations.tundra.dome 2>/dev/null || true
    echo "CRDs removed."
    exit 0
fi

echo "Installing Tundra Dome CRDs..."

# Install CRDs
kubectl apply -f "$SCRIPT_DIR/bead.yaml"
kubectl apply -f "$SCRIPT_DIR/polecat.yaml"
kubectl apply -f "$SCRIPT_DIR/lane.yaml"
kubectl apply -f "$SCRIPT_DIR/playbook.yaml"
kubectl apply -f "$SCRIPT_DIR/station.yaml"

echo ""
echo "Tundra Dome CRDs installed successfully!"
echo ""
echo "Available resources:"
echo "  kubectl get beads      (bd)  - Work items"
echo "  kubectl get polecats   (pc)  - Workers"
echo "  kubectl get lanes      (ln)  - Priority queues"
echo "  kubectl get playbooks  (pb)  - Workflows"
echo "  kubectl get stations   (st)  - Services"
echo ""
echo "Create example resources:"
echo "  kubectl apply -f $SCRIPT_DIR/../examples/"
