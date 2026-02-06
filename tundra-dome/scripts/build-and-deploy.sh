#!/bin/bash
# Build and Deploy Airflow to KIND clusters
# Usage: ./build-and-deploy.sh [cluster] [--build-only|--deploy-only]
#
# Examples:
#   ./build-and-deploy.sh                     # Build and deploy to all clusters
#   ./build-and-deploy.sh kind-tundra-dome    # Build and deploy to tundra-dome only
#   ./build-and-deploy.sh --build-only        # Only build the image
#   ./build-and-deploy.sh kind-gastown --deploy-only  # Deploy existing image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AIRFLOW_DIR="$SCRIPT_DIR/../airflow"
K8S_DIR="$SCRIPT_DIR/../k8s"

IMAGE_NAME="tundra-dome/airflow"
IMAGE_TAG="latest"
NAMESPACE="tundra-dome"

# All KIND clusters in the Tundra Dome project
ALL_CLUSTERS=(kind-tundra-dome kind-gastown kind-vibecode-local)

# Parse arguments
BUILD=true
DEPLOY=true
TARGET_CLUSTER=""

for arg in "$@"; do
    case $arg in
        --build-only)
            DEPLOY=false
            ;;
        --deploy-only)
            BUILD=false
            ;;
        kind-*)
            TARGET_CLUSTER="$arg"
            ;;
    esac
done

# Determine which clusters to target
if [ -n "$TARGET_CLUSTER" ]; then
    CLUSTERS=("$TARGET_CLUSTER")
else
    CLUSTERS=("${ALL_CLUSTERS[@]}")
fi

echo "=========================================="
echo "Tundra Dome Airflow Build & Deploy"
echo "=========================================="
echo "Build: $BUILD"
echo "Deploy: $DEPLOY"
echo "Target clusters: ${CLUSTERS[*]}"
echo ""

# Build the Docker image
if [ "$BUILD" = true ]; then
    echo "[1/3] Building Docker image: $IMAGE_NAME:$IMAGE_TAG"
    cd "$AIRFLOW_DIR"

    # Build for ARM64 (Apple Silicon) - KIND nodes run the host architecture
    docker build -t "$IMAGE_NAME:$IMAGE_TAG" .

    echo "[1/3] Build complete"
    echo ""
fi

# Load image into KIND clusters and deploy
for cluster in "${CLUSTERS[@]}"; do
    echo "=========================================="
    echo "Processing cluster: $cluster"
    echo "=========================================="

    # Check if cluster exists
    if ! kubectl config get-contexts "$cluster" &>/dev/null; then
        echo "[WARN] Cluster $cluster not found, skipping"
        continue
    fi

    # Check if cluster is running
    if ! kubectl --context="$cluster" get nodes &>/dev/null; then
        echo "[WARN] Cluster $cluster is not running, skipping"
        continue
    fi

    if [ "$BUILD" = true ]; then
        echo "[2/3] Loading image into KIND cluster: $cluster"
        kind load docker-image "$IMAGE_NAME:$IMAGE_TAG" --name "${cluster#kind-}"
        echo "[2/3] Image loaded"
    fi

    if [ "$DEPLOY" = true ]; then
        echo "[3/3] Deploying to cluster: $cluster"

        # Ensure namespace exists
        kubectl --context="$cluster" create namespace "$NAMESPACE" --dry-run=client -o yaml | \
            kubectl --context="$cluster" apply -f -

        # Delete old deployment to force image pull
        kubectl --context="$cluster" delete deployment airflow-api-server -n "$NAMESPACE" --ignore-not-found

        # Apply the persistent deployment
        kubectl --context="$cluster" apply -f "$K8S_DIR/airflow-persistent.yaml"

        echo "[3/3] Deployment applied"

        # Wait for rollout
        echo "Waiting for deployment to be ready..."
        kubectl --context="$cluster" rollout status deployment/airflow-api-server -n "$NAMESPACE" --timeout=300s || {
            echo "[WARN] Deployment not ready within timeout, checking status..."
            kubectl --context="$cluster" get pods -n "$NAMESPACE" -l app=airflow-api-server
            kubectl --context="$cluster" describe pod -n "$NAMESPACE" -l app=airflow-api-server | tail -30
        }
    fi

    echo ""
done

echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
for cluster in "${CLUSTERS[@]}"; do
    if kubectl config get-contexts "$cluster" &>/dev/null; then
        echo ""
        echo "Cluster: $cluster"
        kubectl --context="$cluster" get pods -n "$NAMESPACE" -l app=airflow-api-server 2>/dev/null || echo "  No pods found"
        kubectl --context="$cluster" get pvc -n "$NAMESPACE" 2>/dev/null || echo "  No PVCs found"
    fi
done

echo ""
echo "Done! To access Airflow UI, run:"
echo "  kubectl --context=<cluster> port-forward svc/airflow-service 8080:8080 -n $NAMESPACE"
echo "  Then open: http://localhost:8080"
