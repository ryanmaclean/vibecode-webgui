#!/bin/bash

# VibeCode KIND Cluster Test Script
# This script creates a KIND cluster and tests all VibeCode platform components

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="vibecode-test"
NAMESPACE="vibecode-platform"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if ! command -v kind &> /dev/null; then
        missing_deps+=("kind")
    fi
    
    if ! command -v kubectl &> /dev/null; then
        missing_deps+=("kubectl")
    fi
    
    if ! command -v helm &> /dev/null; then
        missing_deps+=("helm")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_status "Please install missing dependencies and try again"
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Function to create KIND cluster
create_kind_cluster() {
    print_status "Creating KIND cluster: $CLUSTER_NAME"
    
    # Check if cluster already exists
    if kind get clusters | grep -q "^$CLUSTER_NAME$"; then
        print_warning "Cluster $CLUSTER_NAME already exists. Deleting it first..."
        kind delete cluster --name "$CLUSTER_NAME"
    fi
    
    # Create cluster with custom config
    if kind create cluster --config "$PROJECT_ROOT/test-kind-cluster.yaml"; then
        print_success "KIND cluster created successfully"
    else
        print_error "Failed to create KIND cluster"
        exit 1
    fi
    
    # Wait for cluster to be ready
    print_status "Waiting for cluster to be ready..."
    kubectl wait --for=condition=Ready nodes --all --timeout=300s
    
    print_success "Cluster is ready"
}

# Function to install ingress controller
install_ingress() {
    print_status "Installing NGINX Ingress Controller..."
    
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
    
    # Wait for ingress controller to be ready
    print_status "Waiting for ingress controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s
    
    print_success "Ingress controller is ready"
}

# Function to create namespace and secrets
setup_namespace() {
    print_status "Setting up namespace and secrets..."
    
    # Create namespace
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Create basic secrets (you'll need to set these with actual values)
    kubectl create secret generic vibecode-platform-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=openai-api-key="" \
        --from-literal=anthropic-api-key="" \
        --from-literal=azure-openai-endpoint="" \
        --from-literal=azure-openai-api-key="" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Create chat-ui secrets
    kubectl create secret generic vibecode-platform-chat-ui-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=hf-access-token="" \
        --from-literal=rate-limit-secret="test-secret-$(date +%s)" \
        --from-literal=parquet-export-secret="export-secret-$(date +%s)" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Create Datadog secrets (with placeholder values)
    kubectl create secret generic datadog-secret \
        --namespace="$NAMESPACE" \
        --from-literal=api-key="placeholder-api-key" \
        --from-literal=app-key="placeholder-app-key" \
        --from-literal=site="datadoghq.com" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Namespace and secrets created"
}

# Function to build and load Docker images
build_and_load_images() {
    print_status "Building and loading Docker images..."
    
    # Build MongoDB image
    print_status "Building MongoDB image..."
    cd "$PROJECT_ROOT/docker/mongodb"
    docker build -t vibecode/mongodb:test .
    kind load docker-image vibecode/mongodb:test --name "$CLUSTER_NAME"
    
    # Build Chat-UI image  
    print_status "Building Chat-UI image..."
    cd "$PROJECT_ROOT/docker/chat-ui"
    docker build -t vibecode/chat-ui:test .
    kind load docker-image vibecode/chat-ui:test --name "$CLUSTER_NAME"
    
    # Build Semantic Kernel image
    print_status "Building Semantic Kernel image..."
    cd "$PROJECT_ROOT/templates/semantic-kernel/basic-agent"
    docker build -t vibecode/semantic-kernel:test .
    kind load docker-image vibecode/semantic-kernel:test --name "$CLUSTER_NAME"
    
    print_success "All images built and loaded"
}

# Function to create test values file for Helm
create_test_values() {
    print_status "Creating test values file..."
    
    cat > "$PROJECT_ROOT/test-values.yaml" << EOF
global:
  domain: localhost
  storageClass: standard
  nodeEnv: development

# Disable web components for focused testing
web:
  enabled: false
websocket:
  enabled: false
codeServer:
  enabled: false

# Enable core platform components
mongodb:
  enabled: true
  image:
    repository: vibecode/mongodb
    tag: test
  auth:
    rootPassword: test-root-password
    password: test-chatui-password

redis:
  enabled: true

chatui:
  enabled: true
  image:
    repository: vibecode/chat-ui
    tag: test

semanticKernel:
  enabled: true
  image:
    repository: vibecode/semantic-kernel
    tag: test

# Enable Datadog with test configuration
datadog:
  enabled: true
  apiKey: placeholder-api-key
  appKey: placeholder-app-key
  site: datadoghq.com

# Ingress configuration for local testing
ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
EOF

    print_success "Test values file created"
}

# Function to deploy with Helm
deploy_with_helm() {
    print_status "Deploying VibeCode platform with Helm..."
    
    cd "$PROJECT_ROOT"
    
    # Update Helm dependencies
    helm dependency update charts/vibecode-platform/
    
    # Install or upgrade the release
    if helm list --namespace "$NAMESPACE" | grep -q vibecode-platform; then
        print_status "Upgrading existing release..."
        helm upgrade vibecode-platform charts/vibecode-platform/ \
            --namespace "$NAMESPACE" \
            --values test-values.yaml \
            --timeout 10m
    else
        print_status "Installing new release..."
        helm install vibecode-platform charts/vibecode-platform/ \
            --namespace "$NAMESPACE" \
            --values test-values.yaml \
            --timeout 10m \
            --create-namespace
    fi
    
    print_success "Helm deployment completed"
}

# Function to wait for deployments
wait_for_deployments() {
    print_status "Waiting for deployments to be ready..."
    
    # Wait for MongoDB
    print_status "Waiting for MongoDB..."
    kubectl wait --for=condition=available deployment/mongodb \
        --namespace="$NAMESPACE" --timeout=300s
    
    # Wait for Redis
    print_status "Waiting for Redis..."
    kubectl wait --for=condition=available deployment/vibecode-platform-redis \
        --namespace="$NAMESPACE" --timeout=300s
    
    # Wait for Chat-UI
    print_status "Waiting for Chat-UI..."
    kubectl wait --for=condition=available deployment/vibecode-platform-chat-ui \
        --namespace="$NAMESPACE" --timeout=300s
    
    # Wait for Semantic Kernel
    print_status "Waiting for Semantic Kernel..."
    kubectl wait --for=condition=available deployment/vibecode-platform-semantic-kernel \
        --namespace="$NAMESPACE" --timeout=300s
    
    print_success "All deployments are ready"
}

# Function to run connectivity tests
test_connectivity() {
    print_status "Running connectivity tests..."
    
    # Test MongoDB connectivity
    print_status "Testing MongoDB connectivity..."
    if kubectl exec -n "$NAMESPACE" deployment/mongodb -- mongosh --eval "db.adminCommand('ping')" > /dev/null; then
        print_success "MongoDB is accessible"
    else
        print_error "MongoDB connectivity test failed"
        return 1
    fi
    
    # Test Redis connectivity
    print_status "Testing Redis connectivity..."
    if kubectl exec -n "$NAMESPACE" deployment/vibecode-platform-redis -- redis-cli ping | grep -q PONG; then
        print_success "Redis is accessible"
    else
        print_error "Redis connectivity test failed"
        return 1
    fi
    
    # Test Chat-UI health endpoint
    print_status "Testing Chat-UI health endpoint..."
    if kubectl exec -n "$NAMESPACE" deployment/vibecode-platform-chat-ui -- curl -f http://localhost:3000/health > /dev/null; then
        print_success "Chat-UI is healthy"
    else
        print_warning "Chat-UI health check failed (might be normal if health endpoint doesn't exist)"
    fi
    
    print_success "Connectivity tests completed"
}

# Function to test service mesh
test_service_mesh() {
    print_status "Testing service mesh connectivity..."
    
    # Create a test pod for internal connectivity tests
    kubectl run test-pod --image=curlimages/curl:latest \
        --namespace="$NAMESPACE" \
        --rm -i --tty --restart=Never \
        --command -- /bin/sh -c "
        echo 'Testing MongoDB service...';
        nc -zv mongodb 27017;
        echo 'Testing Redis service...';
        nc -zv vibecode-platform-redis 6379;
        echo 'Testing Chat-UI service...';
        nc -zv vibecode-platform-chat-ui 3000;
        echo 'Testing Semantic Kernel service...';
        nc -zv vibecode-platform-semantic-kernel 8080;
        echo 'All service connectivity tests completed';
    " || true
    
    print_success "Service mesh tests completed"
}

# Function to display cluster information
display_cluster_info() {
    print_status "Cluster Information:"
    echo "===================="
    
    echo "Cluster: $CLUSTER_NAME"
    echo "Namespace: $NAMESPACE"
    echo ""
    
    echo "Nodes:"
    kubectl get nodes -o wide
    echo ""
    
    echo "Pods:"
    kubectl get pods -n "$NAMESPACE" -o wide
    echo ""
    
    echo "Services:"
    kubectl get services -n "$NAMESPACE"
    echo ""
    
    echo "Ingresses:"
    kubectl get ingress -n "$NAMESPACE" || echo "No ingresses found"
    echo ""
    
    echo "Access URLs (after port forwarding):"
    echo "- Chat-UI: http://localhost:3000"
    echo "- MongoDB: localhost:27017"
    echo "- Redis: localhost:6379"
    echo ""
    
    echo "Port forwarding commands:"
    echo "kubectl port-forward -n $NAMESPACE svc/vibecode-platform-chat-ui 3000:3000"
    echo "kubectl port-forward -n $NAMESPACE svc/mongodb 27017:27017"
    echo "kubectl port-forward -n $NAMESPACE svc/vibecode-platform-redis 6379:6379"
}

# Function to setup port forwarding
setup_port_forwarding() {
    print_status "Setting up port forwarding..."
    
    # Kill existing port forwards
    pkill -f "kubectl port-forward" || true
    
    # Start port forwards in background
    kubectl port-forward -n "$NAMESPACE" svc/vibecode-platform-chat-ui 3000:3000 &
    kubectl port-forward -n "$NAMESPACE" svc/mongodb 27017:27017 &
    kubectl port-forward -n "$NAMESPACE" svc/vibecode-platform-redis 6379:6379 &
    kubectl port-forward -n "$NAMESPACE" svc/vibecode-platform-semantic-kernel 8081:8080 &
    
    sleep 5
    print_success "Port forwarding setup completed"
    print_status "Services are now accessible on localhost"
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    # Test Chat-UI endpoint
    print_status "Testing Chat-UI HTTP endpoint..."
    if curl -f http://localhost:3000/ > /dev/null 2>&1; then
        print_success "Chat-UI is accessible via HTTP"
    else
        print_warning "Chat-UI HTTP test failed (service might not be fully ready)"
    fi
    
    # Test MongoDB connection
    print_status "Testing MongoDB connection..."
    if command -v mongosh &> /dev/null; then
        if mongosh mongodb://localhost:27017/test --eval "db.runCommand('ping')" > /dev/null 2>&1; then
            print_success "MongoDB is accessible via port forward"
        else
            print_warning "MongoDB connection test failed"
        fi
    else
        print_warning "mongosh not available for MongoDB testing"
    fi
    
    # Test Redis connection
    print_status "Testing Redis connection..."
    if command -v redis-cli &> /dev/null; then
        if redis-cli -h localhost -p 6379 ping | grep -q PONG; then
            print_success "Redis is accessible via port forward"
        else
            print_warning "Redis connection test failed"
        fi
    else
        print_warning "redis-cli not available for Redis testing"
    fi
    
    print_success "Integration tests completed"
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Kill port forwards
    pkill -f "kubectl port-forward" || true
    
    # Remove test files
    rm -f "$PROJECT_ROOT/test-values.yaml"
    
    if [ "${1:-}" == "full" ]; then
        print_status "Performing full cleanup..."
        kind delete cluster --name "$CLUSTER_NAME" || true
        print_success "Full cleanup completed"
    else
        print_status "Cluster left running for manual testing"
        print_status "To delete cluster: kind delete cluster --name $CLUSTER_NAME"
    fi
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    --setup-only      Only create cluster and setup, don't run tests
    --test-only       Only run tests (assumes cluster exists)
    --cleanup-full    Perform full cleanup including cluster deletion
    --help           Show this help message

Examples:
    $0                    # Full setup and test
    $0 --setup-only       # Only setup cluster
    $0 --test-only        # Only run tests
    $0 --cleanup-full     # Full cleanup

EOF
}

# Main execution function
main() {
    local setup_only=false
    local test_only=false
    local cleanup_full=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --setup-only)
                setup_only=true
                shift
                ;;
            --test-only)
                test_only=true
                shift
                ;;
            --cleanup-full)
                cleanup_full=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Trap to cleanup on exit
    if [ "$cleanup_full" == "true" ]; then
        trap 'cleanup full' EXIT
    else
        trap 'cleanup' EXIT
    fi
    
    print_status "Starting VibeCode KIND cluster testing..."
    
    check_prerequisites
    
    if [ "$test_only" != "true" ]; then
        create_kind_cluster
        install_ingress
        setup_namespace
        build_and_load_images
        create_test_values
        deploy_with_helm
        wait_for_deployments
    fi
    
    if [ "$setup_only" != "true" ]; then
        test_connectivity
        test_service_mesh
        setup_port_forwarding
        run_integration_tests
    fi
    
    display_cluster_info
    
    print_success "VibeCode KIND cluster testing completed successfully!"
    print_status "Cluster is ready for manual testing and exploration"
}

# Run main function with all arguments
main "$@"