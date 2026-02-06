#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# GitOps Environment Cleanup Script
# Safely removes the local KIND cluster and Docker resources

# Initialize log aggregation
init_log_aggregation


echo "🧹 VibeCode GitOps Environment Cleanup"
echo "====================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

CLUSTER_NAME="vibecode-local"

# Function to confirm action
confirm() {
    read -p "$(echo -e ${YELLOW}$1${NC}) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

echo -e "\n${BOLD}Current Environment Status${NC}"
echo "========================="

# Check if KIND cluster exists
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    echo -e "${GREEN}✅ KIND cluster '${CLUSTER_NAME}' found${NC}"
    
    # Show cluster resources
    echo -e "\n${BLUE}Cluster Resources:${NC}"
    kubectl get nodes --context kind-${CLUSTER_NAME} 2>/dev/null || echo "Unable to access cluster"
    
    echo -e "\n${BLUE}Running Pods:${NC}"
    kubectl get pods -A --context kind-${CLUSTER_NAME} 2>/dev/null | head -10 || echo "Unable to list pods"
    
    echo -e "\n${BLUE}Services:${NC}"
    kubectl get services -A --context kind-${CLUSTER_NAME} 2>/dev/null | head -10 || echo "Unable to list services"
else
    echo -e "${YELLOW}⚠️  KIND cluster '${CLUSTER_NAME}' not found${NC}"
fi

# Check for Docker containers
echo -e "\n${BLUE}Docker Containers:${NC}"
DOCKER_CONTAINERS=$(docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep -E "(vibecode|kind)" || echo "No related containers found")
echo "$DOCKER_CONTAINERS"

# Check for Docker images
echo -e "\n${BLUE}Docker Images:${NC}"
DOCKER_IMAGES=$(docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "(vibecode|kind)" || echo "No related images found")
echo "$DOCKER_IMAGES"

echo -e "\n${BOLD}Cleanup Options${NC}"
echo "==============="

# Option 1: Delete KIND cluster
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    if confirm "Delete KIND cluster '${CLUSTER_NAME}' and all resources?"; then
        echo -e "${BLUE}🗑️  Deleting KIND cluster...${NC}"
        kind delete cluster --name ${CLUSTER_NAME}
        echo -e "${GREEN}✅ KIND cluster deleted${NC}"
    else
        echo -e "${YELLOW}⏭️  Skipping cluster deletion${NC}"
    fi
fi

# Option 2: Clean Docker images
if confirm "Remove VibeCode Docker images and build cache?"; then
    echo -e "${BLUE}🗑️  Cleaning Docker images...${NC}"
    
    # Remove VibeCode images
    docker images | grep vibecode | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    
    # Clean build cache
    docker builder prune -f
    
    echo -e "${GREEN}✅ Docker images cleaned${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping Docker image cleanup${NC}"
fi

# Option 3: Full Docker cleanup
if confirm "Perform full Docker system cleanup (removes all unused containers, networks, images)?"; then
    echo -e "${BLUE}🗑️  Performing full Docker cleanup...${NC}"
    docker system prune -af --volumes
    echo -e "${GREEN}✅ Full Docker cleanup completed${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping full Docker cleanup${NC}"
fi

# Option 4: Remove temporary files
if confirm "Remove temporary test files and configurations?"; then
    echo -e "${BLUE}🗑️  Removing temporary files...${NC}"
    
    # Remove temporary files
    rm -f test-app.yaml 2>/dev/null || true
    rm -f kind-config.yaml 2>/dev/null || true
    # Remove any temporary Dockerfiles (now using consolidated structure)
    # rm -f Dockerfile.simple 2>/dev/null || true
    
    echo -e "${GREEN}✅ Temporary files removed${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping temporary file cleanup${NC}"
fi

echo -e "\n${BOLD}Cleanup Summary${NC}"
echo "==============="

# Final status check
if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    echo -e "${GREEN}✅ KIND cluster removed${NC}"
else
    echo -e "${YELLOW}ℹ️  KIND cluster still exists${NC}"
fi

# Check remaining Docker resources
REMAINING_CONTAINERS=$(docker ps -a | grep -E "(vibecode|kind)" | wc -l)
REMAINING_IMAGES=$(docker images | grep -E "(vibecode|kind)" | wc -l)

if [ "$REMAINING_CONTAINERS" -eq 0 ] && [ "$REMAINING_IMAGES" -eq 0 ]; then
    echo -e "${GREEN}✅ All Docker resources cleaned${NC}"
else
    echo -e "${YELLOW}ℹ️  Some Docker resources remain ($REMAINING_CONTAINERS containers, $REMAINING_IMAGES images)${NC}"
fi

echo -e "\n${BOLD}Post-Cleanup Actions${NC}"
echo "==================="
echo "• Check Docker disk usage: docker system df"
echo "• List all containers: docker ps -a"  
echo "• List all images: docker images"
echo "• View KIND clusters: kind get clusters"

echo -e "\n${BOLD}Re-setup Instructions${NC}"
echo "===================="
echo "To recreate the GitOps environment:"
echo "1. ./scripts/local-kind-setup.sh"
echo "2. ./scripts/final-automation-validation.sh"
echo "3. Access ArgoCD: kubectl port-forward svc/argocd-server -n argocd 8080:80"

echo -e "\n${GREEN}🎉 Cleanup completed successfully!${NC}"
echo -e "\n${BLUE}Your system is now clean and ready for fresh deployments.${NC}"