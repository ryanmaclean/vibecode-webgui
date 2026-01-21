#!/bin/bash
# VibeCode Docker Deployment Script
# Usage: ./deploy.sh [environment] [options]

set -e

# Default values
ENVIRONMENT="dev"
COMPOSE_FILE=""
REGISTRY=""
NAMESPACE="vibecode-platform"
FORCE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to show usage
show_usage() {
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  dev         - Development environment"
    echo "  prod        - Production environment"
    echo "  test        - Testing environment"
    echo "  aks         - AKS production deployment"
    echo ""
    echo "Options:"
    echo "  --registry REGISTRY  - Container registry (e.g., ghcr.io/username)"
    echo "  --namespace NS       - Kubernetes namespace (default: vibecode-platform)"
    echo "  --force              - Force deployment without confirmation"
    echo "  --help               - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 dev"
    echo "  $0 prod --registry ghcr.io/username"
    echo "  $0 aks --registry ghcr.io/username --namespace production"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        dev|prod|test|aks)
            ENVIRONMENT="$1"
            shift
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --force)
            FORCE=true
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

# Set compose file based on environment
case $ENVIRONMENT in
    dev)
        COMPOSE_FILE="docker-compose.dev.yml"
        ;;
    prod)
        COMPOSE_FILE="docker-compose.prod.yml"
        ;;
    test)
        COMPOSE_FILE="docker-compose.test.yml"
        ;;
    aks)
        COMPOSE_FILE="docker-compose.aks.yml"
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        show_usage
        exit 1
        ;;
esac

# Check if compose file exists
if [ ! -f "docker/$COMPOSE_FILE" ]; then
    print_error "Compose file not found: docker/$COMPOSE_FILE"
    exit 1
fi

# Print deployment information
print_status "Deploying VibeCode WebGUI"
print_status "Environment: $ENVIRONMENT"
print_status "Compose File: docker/$COMPOSE_FILE"
if [ -n "$REGISTRY" ]; then
    print_status "Registry: $REGISTRY"
fi
if [ "$ENVIRONMENT" = "aks" ]; then
    print_status "Namespace: $NAMESPACE"
fi

# Confirmation prompt (unless forced)
if [ "$FORCE" = false ]; then
    echo ""
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        exit 0
    fi
fi

# Change to docker directory
cd docker

# Build and deploy based on environment
case $ENVIRONMENT in
    dev|prod|test)
        print_status "Starting Docker Compose deployment..."
        if docker-compose -f $COMPOSE_FILE up --build -d; then
            print_success "Deployment completed successfully!"
            print_status "Services running:"
            docker-compose -f $COMPOSE_FILE ps
        else
            print_error "Deployment failed!"
            exit 1
        fi
        ;;
    aks)
        print_status "Preparing AKS deployment..."
        
        # Check if kubectl is available
        if ! command -v kubectl &> /dev/null; then
            print_error "kubectl is not installed or not in PATH"
            exit 1
        fi
        
        # Check if helm is available
        if ! command -v helm &> /dev/null; then
            print_error "helm is not installed or not in PATH"
            exit 1
        fi
        
        # Build image if registry is provided
        if [ -n "$REGISTRY" ]; then
            print_status "Building and pushing image to registry..."
            IMAGE_TAG="$REGISTRY/vibecode-webgui:latest"
            if ../build.sh aks --tag $IMAGE_TAG --push; then
                print_success "Image built and pushed successfully!"
            else
                print_error "Failed to build and push image"
                exit 1
            fi
        fi
        
        # Deploy to AKS using Helm
        print_status "Deploying to AKS using Helm..."
        if helm upgrade --install vibecode-app ../charts/vibecode \
            --namespace $NAMESPACE \
            --set image.repository="$REGISTRY/vibecode-webgui" \
            --set image.tag="latest" \
            --wait --timeout=600s; then
            print_success "AKS deployment completed successfully!"
            print_status "Checking deployment status..."
            kubectl rollout status deployment/vibecode-app -n $NAMESPACE --timeout=300s
            kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=vibecode
        else
            print_error "AKS deployment failed!"
            exit 1
        fi
        ;;
esac

print_success "Deployment completed successfully!"
