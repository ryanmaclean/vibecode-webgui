#!/bin/bash
# KIND Cleanup - Remove previous installations
set -e

echo "🧹 Cleaning previous KIND clusters and resources"
echo "==============================================="

# Clean up existing VibeCode clusters
CLEANED=0

for cluster in vibecode vibecode-test vibecode-cluster; do
    if kind get clusters 2>/dev/null | grep -q "^${cluster}$"; then
        echo "🗑️  Deleting cluster: $cluster"
        kind delete cluster --name="$cluster"
        CLEANED=$((CLEANED + 1))
    fi
done

if [ $CLEANED -eq 0 ]; then
    echo "✅ No existing VibeCode clusters found"
else
    echo "✅ Cleaned $CLEANED clusters"
fi

# Clean Docker resources (optional - commented out for safety)
# Uncomment if you want aggressive cleanup
echo ""
echo "🔍 Checking Docker resources..."

# Count KIND-related containers
KIND_CONTAINERS=$(docker ps -a --filter "name=vibecode" --filter "name=kind" -q | wc -l)
if [ "$KIND_CONTAINERS" -gt 0 ]; then
    echo "🗑️  Found $KIND_CONTAINERS KIND-related containers"
    echo "   Run 'docker rm -f \$(docker ps -a --filter \"name=kind\" -q)' to clean them"
else
    echo "✅ No KIND containers to clean"
fi

# Count KIND-related images
KIND_IMAGES=$(docker images --filter "reference=kindest/*" --filter "reference=*vibecode*" -q | wc -l)
if [ "$KIND_IMAGES" -gt 0 ]; then
    echo "🗑️  Found $KIND_IMAGES KIND-related images"
    echo "   Run 'docker rmi \$(docker images --filter \"reference=kindest/*\" -q)' to clean them"
else
    echo "✅ No KIND images to clean"
fi

# Clean KIND networks
KIND_NETWORKS=$(docker network ls --filter "name=kind" --format "{{.Name}}" 2>/dev/null | wc -l)
if [ "$KIND_NETWORKS" -gt 0 ]; then
    echo "🗑️  Found $KIND_NETWORKS KIND networks"
    docker network ls --filter "name=kind" --format "{{.Name}}" | xargs -r docker network rm 2>/dev/null || true
    echo "✅ Cleaned KIND networks"
else
    echo "✅ No KIND networks to clean"
fi

# Reset kubectl context if pointing to deleted cluster
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
if echo "$CURRENT_CONTEXT" | grep -q "kind-vibecode"; then
    echo "🔄 Resetting kubectl context from: $CURRENT_CONTEXT"
    kubectl config unset current-context 2>/dev/null || true
    echo "✅ kubectl context reset"
fi

echo ""
echo "✅ Cleanup complete!"
echo "   Ready for fresh KIND cluster creation"