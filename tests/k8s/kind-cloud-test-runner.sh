#!/bin/bash
set -e

# KinD Cloud Test Runner
# Comprehensive test runner for cloud deployment validation

echo "🚀 KinD Cloud Test Runner"
echo "========================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

CLUSTER_NAME="vibecode-cloud-test"
NAMESPACE="vibecode-cloud"
CODESERVER_NAMESPACE="codeserver"

# Function to check if cluster exists
cluster_exists() {
    kind get clusters | grep -q "$CLUSTER_NAME" 2>/dev/null
}

# Function to create cluster
create_cluster() {
    echo -e "${BLUE}Creating KinD cloud cluster...${NC}"
    kind create cluster --name $CLUSTER_NAME --config k8s/kind-cloud-config.yaml
    echo -e "${GREEN}✅ KinD cloud cluster created${NC}"
}

# Function to setup cluster
setup_cluster() {
    echo -e "${BLUE}Setting up cloud cluster...${NC}"
    
    # Set kubectl context
    kubectl config use-context kind-$CLUSTER_NAME
    
    # Create namespaces
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace $CODESERVER_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Wait for cluster to be ready
    kubectl wait --for=condition=Ready nodes --all --timeout=300s
    
    echo -e "${GREEN}✅ Cloud cluster setup complete${NC}"
}

# Function to run tests
run_tests() {
    echo -e "${BLUE}Running cloud deployment tests...${NC}"
    
    # Run Jest tests
    echo -e "${YELLOW}Running Jest cloud deployment tests...${NC}"
    npm run test:unit -- --testPathPattern="kind-cloud-deployment-smoke.test.ts" || {
        echo -e "${RED}❌ Jest tests failed${NC}"
        return 1
    }
    
    # Run shell tests
    echo -e "${YELLOW}Running shell cloud deployment tests...${NC}"
    ./tests/k8s/cloud-deployment-smoke.sh || {
        echo -e "${RED}❌ Shell tests failed${NC}"
        return 1
    }
    
    echo -e "${GREEN}✅ All cloud deployment tests passed${NC}"
}

# Function to cleanup
cleanup() {
    echo -e "${BLUE}Cleaning up cloud cluster...${NC}"
    kind delete cluster --name $CLUSTER_NAME
    echo -e "${GREEN}✅ Cloud cluster cleaned up${NC}"
}

# Function to show cluster info
show_info() {
    echo -e "${BLUE}Cloud Cluster Information:${NC}"
    echo "  🎯 Cluster: $CLUSTER_NAME"
    echo "  📦 Namespaces: $NAMESPACE, $CODESERVER_NAMESPACE"
    echo "  🔧 Access: kubectl config use-context kind-$CLUSTER_NAME"
    echo "  📊 Status: $(kubectl get nodes --no-headers | wc -l) nodes"
    echo ""
    echo "Available commands:"
    echo "  kubectl get pods -n $CODESERVER_NAMESPACE"
    echo "  kubectl port-forward -n $CODESERVER_NAMESPACE svc/codeserver-cloud 8080:80"
    echo "  kubectl logs -l app=codeserver -n $CODESERVER_NAMESPACE"
}

# Main execution
main() {
    case "${1:-run}" in
        "create")
            if cluster_exists; then
                echo -e "${YELLOW}Cluster already exists${NC}"
            else
                create_cluster
                setup_cluster
            fi
            show_info
            ;;
        "setup")
            if ! cluster_exists; then
                echo -e "${RED}Cluster does not exist. Run with 'create' first.${NC}"
                exit 1
            fi
            setup_cluster
            show_info
            ;;
        "test")
            if ! cluster_exists; then
                echo -e "${RED}Cluster does not exist. Run with 'create' first.${NC}"
                exit 1
            fi
            run_tests
            ;;
        "info")
            if ! cluster_exists; then
                echo -e "${RED}Cluster does not exist. Run with 'create' first.${NC}"
                exit 1
            fi
            show_info
            ;;
        "cleanup")
            if cluster_exists; then
                cleanup
            else
                echo -e "${YELLOW}Cluster does not exist${NC}"
            fi
            ;;
        "run")
            # Full run: create, setup, test, cleanup
            if cluster_exists; then
                echo -e "${YELLOW}Cluster already exists, skipping creation${NC}"
            else
                create_cluster
            fi
            
            setup_cluster
            run_tests
            
            echo -e "${BLUE}Keep cluster for inspection? (y/N)${NC}"
            read -r keep_cluster
            if [[ ! "$keep_cluster" =~ ^[Yy]$ ]]; then
                cleanup
            else
                show_info
            fi
            ;;
        *)
            echo "Usage: $0 {create|setup|test|info|cleanup|run}"
            echo ""
            echo "Commands:"
            echo "  create  - Create KinD cloud cluster"
            echo "  setup   - Setup cluster (namespaces, etc.)"
            echo "  test    - Run cloud deployment tests"
            echo "  info    - Show cluster information"
            echo "  cleanup - Delete cluster"
            echo "  run     - Full run (create, setup, test, cleanup)"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"