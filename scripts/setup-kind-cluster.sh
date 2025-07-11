#!/bin/bash
# VibeCode KIND Cluster Setup Script
# Creates a production-ready local Kubernetes cluster for development

set -euo pipefail

# Configuration
CLUSTER_NAME="vibecode-cluster"
CONFIG_FILE="k8s/kind-cluster-config.yaml"
KUBECTL_VERSION="v1.31.0"
HELM_VERSION="v3.16.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command_exists docker; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker."
        exit 1
    fi
    
    # Check KIND
    if ! command_exists kind; then
        log_warning "KIND is not installed. Installing KIND..."
        install_kind
    fi
    
    # Check kubectl
    if ! command_exists kubectl; then
        log_warning "kubectl is not installed. Installing kubectl..."
        install_kubectl
    fi
    
    # Check Helm
    if ! command_exists helm; then
        log_warning "Helm is not installed. Installing Helm..."
        install_helm
    fi
    
    log_success "Prerequisites check completed"
}

# Install KIND
install_kind() {
    log_info "Installing KIND..."
    
    case "$(uname -s)" in
        Darwin)
            if command_exists brew; then
                brew install kind
            else
                curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.24.0/kind-darwin-amd64
                chmod +x ./kind
                sudo mv ./kind /usr/local/bin/kind
            fi
            ;;
        Linux)
            # For AMD64 / x86_64
            [ $(uname -m) = x86_64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-amd64
            # For ARM64
            [ $(uname -m) = aarch64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-arm64
            chmod +x ./kind
            sudo mv ./kind /usr/local/bin/kind
            ;;
        *)
            log_error "Unsupported operating system: $(uname -s)"
            exit 1
            ;;
    esac
    
    log_success "KIND installed successfully"
}

# Install kubectl
install_kubectl() {
    log_info "Installing kubectl..."
    
    case "$(uname -s)" in
        Darwin)
            if command_exists brew; then
                brew install kubectl
            else
                curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/darwin/amd64/kubectl"
                chmod +x kubectl
                sudo mv kubectl /usr/local/bin/
            fi
            ;;
        Linux)
            curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
            chmod +x kubectl
            sudo mv kubectl /usr/local/bin/
            ;;
        *)
            log_error "Unsupported operating system: $(uname -s)"
            exit 1
            ;;
    esac
    
    log_success "kubectl installed successfully"
}

# Install Helm
install_helm() {
    log_info "Installing Helm..."
    
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    
    log_success "Helm installed successfully"
}

# Create host directories
create_host_directories() {
    log_info "Creating host directories for cluster mounts..."
    
    mkdir -p /tmp/vibecode-data
    mkdir -p /tmp/vibecode-workspaces
    mkdir -p /tmp/vibecode-monitoring
    
    # Set appropriate permissions
    chmod 755 /tmp/vibecode-data
    chmod 755 /tmp/vibecode-workspaces
    chmod 755 /tmp/vibecode-monitoring
    
    log_success "Host directories created"
}

# Check if cluster exists
cluster_exists() {
    kind get clusters | grep -q "^${CLUSTER_NAME}$"
}

# Delete existing cluster
delete_cluster() {
    log_warning "Deleting existing cluster: ${CLUSTER_NAME}"
    kind delete cluster --name "${CLUSTER_NAME}"
    log_success "Cluster deleted"
}

# Create KIND cluster
create_cluster() {
    log_info "Creating KIND cluster: ${CLUSTER_NAME}"
    
    if ! test -f "${CONFIG_FILE}"; then
        log_error "Cluster configuration file not found: ${CONFIG_FILE}"
        exit 1
    fi
    
    kind create cluster --name "${CLUSTER_NAME}" --config "${CONFIG_FILE}"
    
    log_success "KIND cluster created successfully"
}

# Wait for cluster to be ready
wait_for_cluster() {
    log_info "Waiting for cluster to be ready..."
    
    local timeout=300  # 5 minutes
    local counter=0
    
    while [ $counter -lt $timeout ]; do
        if kubectl cluster-info --context "kind-${CLUSTER_NAME}" >/dev/null 2>&1; then
            log_success "Cluster is ready"
            return 0
        fi
        
        sleep 5
        counter=$((counter + 5))
        echo -n "."
    done
    
    log_error "Cluster failed to become ready within ${timeout} seconds"
    exit 1
}

# Install NGINX Ingress Controller
install_ingress_controller() {
    log_info "Installing NGINX Ingress Controller..."
    
    # Add NGINX Ingress Helm repository
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    # Install NGINX Ingress Controller
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.service.type=NodePort \
        --set controller.hostPort.enabled=true \
        --set controller.service.nodePorts.http=80 \
        --set controller.service.nodePorts.https=443 \
        --set controller.hostNetwork=true \
        --set controller.kind=DaemonSet \
        --set controller.metrics.enabled=true \
        --set controller.metrics.serviceMonitor.enabled=true \
        --wait
    
    log_success "NGINX Ingress Controller installed"
}

# Install cert-manager
install_cert_manager() {
    log_info "Installing cert-manager..."
    
    # Add cert-manager Helm repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install cert-manager
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --version v1.16.0 \
        --set crds.enabled=true \
        --set global.leaderElection.namespace=cert-manager \
        --set prometheus.enabled=true \
        --wait
    
    log_success "cert-manager installed"
}

# Install local storage provisioner
install_storage_provisioner() {
    log_info "Installing local storage provisioner..."
    
    # Create storage class
    kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: vibecode-local-storage
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: rancher.io/local-path
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
EOF

    # Remove default storage class annotation from standard class
    kubectl patch storageclass standard -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
    
    log_success "Local storage provisioner configured"
}

# Create VibeCode namespace
create_vibecode_namespace() {
    log_info "Creating VibeCode namespace..."
    
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: vibecode-platform
  labels:
    name: vibecode-platform
    app.kubernetes.io/name: vibecode-platform
    app.kubernetes.io/component: platform
---
apiVersion: v1
kind: Namespace
metadata:
  name: vibecode-monitoring
  labels:
    name: vibecode-monitoring
    app.kubernetes.io/name: vibecode-monitoring
    app.kubernetes.io/component: monitoring
EOF
    
    log_success "VibeCode namespaces created"
}

# Display cluster information
display_cluster_info() {
    log_info "Cluster Information:"
    echo ""
    echo "Cluster Name: ${CLUSTER_NAME}"
    echo "Kubectl Context: kind-${CLUSTER_NAME}"
    echo ""
    
    log_info "Nodes:"
    kubectl get nodes -o wide
    echo ""
    
    log_info "Namespaces:"
    kubectl get namespaces
    echo ""
    
    log_info "Ingress Controller Status:"
    kubectl get pods -n ingress-nginx
    echo ""
    
    log_info "cert-manager Status:"
    kubectl get pods -n cert-manager
    echo ""
    
    log_success "Cluster setup completed successfully!"
    echo ""
    echo "To use the cluster:"
    echo "  kubectl config use-context kind-${CLUSTER_NAME}"
    echo ""
    echo "To access services:"
    echo "  HTTP:  http://localhost"
    echo "  HTTPS: https://localhost"
    echo "  Custom: http://localhost:8080"
}

# Main execution
main() {
    log_info "Starting VibeCode KIND cluster setup..."
    
    # Check if cluster already exists
    if cluster_exists; then
        read -p "Cluster '${CLUSTER_NAME}' already exists. Delete and recreate? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            delete_cluster
        else
            log_info "Using existing cluster"
            kubectl config use-context "kind-${CLUSTER_NAME}"
            display_cluster_info
            exit 0
        fi
    fi
    
    # Setup steps
    check_prerequisites
    create_host_directories
    create_cluster
    wait_for_cluster
    
    # Set kubectl context
    kubectl config use-context "kind-${CLUSTER_NAME}"
    
    # Install cluster components
    install_ingress_controller
    install_cert_manager
    install_storage_provisioner
    create_vibecode_namespace
    
    # Display final information
    display_cluster_info
}

# Run main function
main "$@"