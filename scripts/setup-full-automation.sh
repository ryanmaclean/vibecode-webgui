#!/bin/bash
# Complete Kubernetes Automation Setup
# Installs ArgoCD, External Secrets, and configures GitOps

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl >/dev/null 2>&1; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! command -v helm >/dev/null 2>&1; then
        log_error "helm is not installed"
        exit 1
    fi
    
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "No active Kubernetes cluster found"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Install ArgoCD
install_argocd() {
    log_info "Installing ArgoCD..."
    
    # Create ArgoCD namespace
    kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
    
    # Install ArgoCD
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    
    # Wait for ArgoCD to be ready
    log_info "Waiting for ArgoCD to be ready (this may take a few minutes)..."
    kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd
    
    # Get initial admin password
    ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
    
    log_success "ArgoCD installed successfully"
    log_info "ArgoCD Admin Password: ${ARGOCD_PASSWORD}"
    log_info "Access ArgoCD: kubectl port-forward svc/argocd-server -n argocd 8080:443"
}

# Install External Secrets Operator
install_external_secrets() {
    log_info "Installing External Secrets Operator..."
    
    # Add External Secrets Helm repository
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo update
    
    # Install External Secrets Operator
    helm upgrade --install external-secrets external-secrets/external-secrets \
        --namespace external-secrets-system \
        --create-namespace \
        --set installCRDs=true \
        --wait
    
    log_success "External Secrets Operator installed"
}

# Deploy VibeCode ArgoCD Applications
deploy_argocd_apps() {
    log_info "Deploying VibeCode ArgoCD Applications..."
    
    # Apply ArgoCD applications
    kubectl apply -f k8s/argocd/application.yaml
    
    log_success "ArgoCD applications deployed"
    log_info "Applications will sync automatically from Git"
}

# Setup monitoring with Datadog
setup_monitoring() {
    log_info "Setting up Datadog monitoring..."
    
    if [ -z "${DD_API_KEY:-}" ]; then
        log_warning "DD_API_KEY environment variable not set"
        log_info "Please set DD_API_KEY and run: kubectl apply -f k8s/secrets/external-secrets.yaml"
        return
    fi
    
    # Create Datadog secret
    kubectl create secret generic datadog-secret \
        --from-literal=api-key="${DD_API_KEY}" \
        --namespace=vibecode-platform \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Datadog agent
    kubectl apply -f k8s/datadog-agent.yaml
    
    log_success "Datadog monitoring configured"
}

# Main execution
main() {
    log_info "Starting full Kubernetes automation setup..."
    
    check_prerequisites
    
    # Install core automation components
    install_argocd
    install_external_secrets
    
    # Deploy applications
    deploy_argocd_apps
    
    # Setup monitoring
    setup_monitoring
    
    log_success "Kubernetes automation setup complete!"
    echo ""
    echo "🎯 Next Steps:"
    echo "1. Access ArgoCD: kubectl port-forward svc/argocd-server -n argocd 8080:443"
    echo "2. Configure secrets in AWS Secrets Manager or update k8s/secrets/"
    echo "3. Push changes to Git - ArgoCD will automatically deploy"
    echo "4. Monitor deployments in Datadog dashboard"
    echo ""
    echo "🚀 Your Kubernetes cluster is now fully automated!"
}

# Run main function
main "$@"