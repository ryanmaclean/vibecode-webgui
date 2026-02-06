#!/bin/bash
# Deploy Persistent Airflow to KIND clusters
# This script deploys Airflow with PVC-based persistence
# and ensures state survives pod restarts.
#
# Usage: ./deploy-persistent-airflow.sh [cluster]
# Examples:
#   ./deploy-persistent-airflow.sh                    # Deploy to all clusters
#   ./deploy-persistent-airflow.sh kind-tundra-dome   # Deploy to specific cluster

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_DIR="$SCRIPT_DIR/../k8s"
NAMESPACE="tundra-dome"

# All KIND clusters in the Tundra Dome project
ALL_CLUSTERS=(kind-tundra-dome kind-gastown kind-vibecode-local)

# Parse target cluster
TARGET_CLUSTER="${1:-}"

if [ -n "$TARGET_CLUSTER" ]; then
    CLUSTERS=("$TARGET_CLUSTER")
else
    CLUSTERS=("${ALL_CLUSTERS[@]}")
fi

echo "=========================================="
echo "Persistent Airflow Deployment"
echo "=========================================="
echo "Target clusters: ${CLUSTERS[*]}"
echo ""

for cluster in "${CLUSTERS[@]}"; do
    echo "=========================================="
    echo "Processing cluster: $cluster"
    echo "=========================================="

    # Check if cluster exists and is running
    if ! kubectl --context="$cluster" get nodes &>/dev/null; then
        echo "[WARN] Cluster $cluster not available, skipping"
        continue
    fi

    echo "[1/4] Ensuring namespace exists..."
    kubectl --context="$cluster" create namespace "$NAMESPACE" --dry-run=client -o yaml | \
        kubectl --context="$cluster" apply -f -

    echo "[2/4] Cleaning up old deployment..."
    kubectl --context="$cluster" delete deployment airflow-api-server -n "$NAMESPACE" --ignore-not-found
    # Wait for pods to terminate
    sleep 5

    echo "[3/4] Applying persistent deployment..."
    kubectl --context="$cluster" apply -f "$MANIFEST_DIR/airflow-lightweight.yaml"

    echo "[4/4] Waiting for deployment..."
    kubectl --context="$cluster" rollout status deployment/airflow-api-server -n "$NAMESPACE" --timeout=300s || {
        echo "[WARN] Deployment not ready within timeout"
        echo "Pod status:"
        kubectl --context="$cluster" get pods -n "$NAMESPACE" -l app=airflow-api-server
        echo ""
        echo "Pod logs (last 50 lines):"
        kubectl --context="$cluster" logs -n "$NAMESPACE" -l app=airflow-api-server --tail=50 || true
    }

    echo ""
done

echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
for cluster in "${CLUSTERS[@]}"; do
    if kubectl --context="$cluster" get nodes &>/dev/null 2>&1; then
        echo ""
        echo "Cluster: $cluster"
        echo "Pods:"
        kubectl --context="$cluster" get pods -n "$NAMESPACE" -l app=airflow-api-server -o wide 2>/dev/null || echo "  No pods found"
        echo "PVC:"
        kubectl --context="$cluster" get pvc -n "$NAMESPACE" 2>/dev/null | grep airflow || echo "  No PVC found"
        echo "Service:"
        kubectl --context="$cluster" get svc -n "$NAMESPACE" airflow-service 2>/dev/null || echo "  No service found"
    fi
done

echo ""
echo "=========================================="
echo "Access Instructions"
echo "=========================================="
echo "To access Airflow UI:"
echo "  kubectl --context=<cluster> port-forward svc/airflow-service 8080:8080 -n $NAMESPACE"
echo "  Then open: http://localhost:8080"
echo ""
echo "To verify persistence:"
echo "  1. Create a DAG run"
echo "  2. kubectl --context=<cluster> rollout restart deployment/airflow-api-server -n $NAMESPACE"
echo "  3. Verify the DAG run history is preserved"
