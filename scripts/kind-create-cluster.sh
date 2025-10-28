#!/bin/bash
# KIND Cluster Creation - Create VibeCode test cluster
set -e

echo "🚀 Creating VibeCode KIND cluster"
echo "================================="

# Configuration
CLUSTER_NAME="vibecode-test"
CONFIG_FILE="k8s/vibecode-kind-config.yaml"
TIMEOUT=300

# Verify config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    echo "   Create the config file first"
    exit 1
fi

echo "📋 Configuration:"
echo "   Cluster name: $CLUSTER_NAME"
echo "   Config file: $CONFIG_FILE"
echo "   Timeout: ${TIMEOUT}s"

# Display config summary
echo ""
echo "🔍 Cluster configuration preview:"
grep -E "role:|containerPort:|hostPort:" "$CONFIG_FILE" | sed 's/^/   /'

echo ""
echo "🏗️  Creating cluster... (this may take 2-5 minutes)"

# Create cluster with timeout
START_TIME=$(date +%s)
if timeout $TIMEOUT kind create cluster \
    --name="$CLUSTER_NAME" \
    --config="$CONFIG_FILE" \
    --wait=60s \
    --verbosity=1; then
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo "✅ Cluster created successfully in ${DURATION}s"
else
    echo "❌ Cluster creation failed"
    
    # Gather debug information
    echo ""
    echo "🔍 Debug information:"
    
    # Check if cluster partially exists
    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        echo "   Cluster exists but may be unhealthy"
        
        # Export logs if possible
        LOG_DIR="/tmp/kind-logs-$(date +%s)"
        if kind export logs --name="$CLUSTER_NAME" "$LOG_DIR" 2>/dev/null; then
            echo "   Logs exported to: $LOG_DIR"
            echo "   Check control-plane logs: $LOG_DIR/docker-info.txt"
        fi
        
        # Clean up failed cluster
        echo "   Cleaning up failed cluster..."
        kind delete cluster --name="$CLUSTER_NAME" 2>/dev/null || true
    fi
    
    # Check Docker status
    if ! docker info > /dev/null 2>&1; then
        echo "   Docker appears to be unhealthy"
    fi
    
    # Check resource usage
    if command -v docker > /dev/null 2>&1; then
        echo "   Docker containers: $(docker ps --format 'table {{.Names}}\t{{.Status}}' | wc -l)"
        echo "   Docker images: $(docker images -q | wc -l)"
    fi
    
    exit 1
fi

# Verify cluster health
echo ""
echo "🔍 Verifying cluster health..."

# Wait for nodes to be ready
echo "⏱️  Waiting for nodes to be ready..."
if kubectl wait --for=condition=ready nodes --all --timeout=60s --context="kind-${CLUSTER_NAME}"; then
    echo "✅ All nodes are ready"
else
    echo "❌ Some nodes are not ready"
    kubectl get nodes --context="kind-${CLUSTER_NAME}"
    exit 1
fi

# Display cluster info
echo ""
echo "📊 Cluster information:"
kubectl cluster-info --context="kind-${CLUSTER_NAME}"

echo ""
echo "🏷️  Cluster nodes:"
kubectl get nodes -o wide --context="kind-${CLUSTER_NAME}"

# Verify port mappings
echo ""
echo "🔌 Port mappings verification:"
CLUSTER_ID=$(docker ps --filter "name=${CLUSTER_NAME}-control-plane" --format "{{.ID}}")
if [ -n "$CLUSTER_ID" ]; then
    echo "   Control plane container: $CLUSTER_ID"
    docker port "$CLUSTER_ID" | sed 's/^/   /'
else
    echo "   ⚠️  Could not find control plane container"
fi

# Test basic connectivity
echo ""
echo "🧪 Testing basic connectivity..."
if kubectl get --raw=/healthz --context="kind-${CLUSTER_NAME}" > /dev/null 2>&1; then
    echo "✅ API server is healthy"
else
    echo "❌ API server health check failed"
    exit 1
fi

# Set kubectl context
kubectl config use-context "kind-${CLUSTER_NAME}"
echo "✅ kubectl context set to: kind-${CLUSTER_NAME}"

echo ""
echo "🎯 Cluster Status: READY ✅"
echo ""
echo "💡 Next steps:"
echo "   kubectl get all --all-namespaces"
echo "   ./scripts/kind-deploy-services.sh"