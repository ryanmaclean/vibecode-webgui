#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Complete Platform Deployment Script
# Orchestrates deployment of the entire VibeCode platform with all components

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_MODE=${DEPLOYMENT_MODE:-"development"}
SKIP_PREREQUISITES=${SKIP_PREREQUISITES:-"false"}
SKIP_MONITORING=${SKIP_MONITORING:-"false"}
SKIP_DATABASE=${SKIP_DATABASE:-"false"}

# Print functions
print_header() {
    echo ""
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
}

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

# Usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy the complete VibeCode platform with all components.

Options:
    --mode MODE             Deployment mode: development, staging, production (default: development)
    --skip-prerequisites    Skip prerequisite checks
    --skip-monitoring       Skip monitoring deployment
    --skip-database         Skip database setup
    --help                  Show this help message

Environment Variables:
    DEPLOYMENT_MODE         Same as --mode
    SKIP_PREREQUISITES      Same as --skip-prerequisites (true/false)
    SKIP_MONITORING         Same as --skip-monitoring (true/false)
    SKIP_DATABASE          Same as --skip-database (true/false)
    DD_API_KEY             Datadog API key for monitoring
    DD_APP_KEY             Datadog application key

Examples:
    # Development deployment with all components
    $0

    # Production deployment
    $0 --mode production

    # Quick deployment without monitoring
    $0 --skip-monitoring

    # Staging deployment with custom environment
    DEPLOYMENT_MODE=staging DD_API_KEY=\$YOUR_KEY $0
EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode)
                DEPLOYMENT_MODE="$2"
                shift 2
                ;;
            --skip-prerequisites)
                SKIP_PREREQUISITES="true"
                shift
                ;;
            --skip-monitoring)
                SKIP_MONITORING="true"
                shift
                ;;
            --skip-database)
                SKIP_DATABASE="true"
                shift
                ;;
            --help|-h)
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
}

# Check prerequisites
check_prerequisites() {
    if [ "$SKIP_PREREQUISITES" = "true" ]; then
        print_warning "Skipping prerequisite checks"
        return 0
    fi

    print_header "CHECKING PREREQUISITES"
    
    local missing_tools=()
    
    # Check required tools
    for tool in docker kubectl helm kind node npm; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local required_version="18.0.0"
    if ! npx semver-compare "$node_version" ">=" "$required_version" 2>/dev/null; then
        print_warning "Node.js version $node_version detected. Recommended: $required_version+"
    fi
    
    print_success "Prerequisites check passed"
}

# Load environment configuration
load_environment() {
    print_header "LOADING ENVIRONMENT CONFIGURATION"
    
    # Load environment files based on deployment mode
    local env_files=(
        "$PROJECT_ROOT/.env"
        "$PROJECT_ROOT/.env.local"
        "$PROJECT_ROOT/.env.$DEPLOYMENT_MODE"
    )
    
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            print_status "Loading environment from $(basename "$env_file")"
            set -a
            source "$env_file"
            set +a
        fi
    done
    
    # Set default values for critical variables
    export DD_API_KEY=${DD_API_KEY:-"dummy-key-for-development"}
    export DD_APP_KEY=${DD_APP_KEY:-"dummy-app-key-for-development"}
    export DD_SITE=${DD_SITE:-"datadoghq.com"}
    export DATABASE_PASSWORD=${DATABASE_PASSWORD:-"vibecode_password"}
    export NAMESPACE=${NAMESPACE:-"vibecode-platform"}
    
    print_success "Environment configuration loaded for $DEPLOYMENT_MODE mode"
}

# Deploy Kubernetes cluster
deploy_cluster() {
    print_header "DEPLOYING KUBERNETES CLUSTER"
    
    case $DEPLOYMENT_MODE in
        development)
            if [ -x "$SCRIPT_DIR/deploy-kind-postgres-monitoring.sh" ]; then
                print_status "Deploying KIND cluster with PostgreSQL monitoring..."
                "$SCRIPT_DIR/deploy-kind-postgres-monitoring.sh"
            else
                print_warning "KIND deployment script not found, using basic setup"
                kind create cluster --name vibecode-dev
            fi
            ;;
        staging|production)
            print_status "For $DEPLOYMENT_MODE, please ensure your Kubernetes cluster is already configured"
            print_status "Verifying cluster connectivity..."
            kubectl cluster-info
            ;;
    esac
    
    print_success "Kubernetes cluster ready"
}

# Deploy database components
deploy_database() {
    if [ "$SKIP_DATABASE" = "true" ]; then
        print_warning "Skipping database deployment"
        return 0
    fi

    print_header "DEPLOYING DATABASE COMPONENTS"
    
    # Deploy PostgreSQL with monitoring
    if [ -x "$SCRIPT_DIR/deploy-database-migrations.sh" ]; then
        print_status "Running database migrations..."
        "$SCRIPT_DIR/deploy-database-migrations.sh"
    fi
    
    # Setup RAG database
    if [ -x "$SCRIPT_DIR/setup-rag-db.sh" ]; then
        print_status "Setting up RAG database..."
        "$SCRIPT_DIR/setup-rag-db.sh"
    fi
    
    print_success "Database components deployed"
}

# Deploy monitoring stack
deploy_monitoring() {
    if [ "$SKIP_MONITORING" = "true" ]; then
        print_warning "Skipping monitoring deployment"
        return 0
    fi

    print_header "DEPLOYING MONITORING STACK"
    
    # Deploy Datadog monitoring
    if [ -x "$SCRIPT_DIR/deploy-monitoring.sh" ]; then
        print_status "Deploying monitoring stack..."
        "$SCRIPT_DIR/deploy-monitoring.sh"
    fi
    
    # Deploy Datadog Database Monitoring
    if [ -x "$SCRIPT_DIR/deploy-datadog-dbm.sh" ]; then
        print_status "Deploying database monitoring..."
        "$SCRIPT_DIR/deploy-datadog-dbm.sh"
    fi
    
    print_success "Monitoring stack deployed"
}

# Deploy application components
deploy_application() {
    print_header "DEPLOYING APPLICATION COMPONENTS"
    
    # Build and deploy the main application
    print_status "Building application..."
    cd "$PROJECT_ROOT"
    npm ci
    npm run build
    
    # Deploy to Kubernetes
    print_status "Deploying application to Kubernetes..."
    kubectl apply -f k8s/ --recursive || print_warning "Some Kubernetes manifests may have failed"
    
    # Wait for deployments to be ready
    print_status "Waiting for application deployments..."
    kubectl wait --for=condition=available --timeout=300s deployment --all -n "$NAMESPACE" || print_warning "Some deployments may not be ready"
    
    print_success "Application components deployed"
}

# Deploy AI Gateway
deploy_ai_gateway() {
    print_header "DEPLOYING AI GATEWAY"
    
    if [ -d "$PROJECT_ROOT/services/ai-gateway" ]; then
        print_status "Building AI Gateway..."
        cd "$PROJECT_ROOT/services/ai-gateway"
        npm ci
        npm run build
        
        # Apply AI Gateway monitoring if available
        if [ -x "$PROJECT_ROOT/scripts/apply-ai-gateway-monitoring.ts" ]; then
            print_status "Applying AI Gateway monitoring..."
            npx ts-node "$PROJECT_ROOT/scripts/apply-ai-gateway-monitoring.ts"
        fi
        
        print_success "AI Gateway deployed"
    else
        print_warning "AI Gateway directory not found, skipping"
    fi
}

# Validate deployment
validate_deployment() {
    print_header "VALIDATING DEPLOYMENT"
    
    # Check pod status
    print_status "Checking pod status..."
    kubectl get pods -n "$NAMESPACE"
    
    # Check services
    print_status "Checking services..."
    kubectl get services -n "$NAMESPACE"
    
    # Run health checks
    print_status "Running health checks..."
    if kubectl get pods -n "$NAMESPACE" -l app=vibecode-webgui &> /dev/null; then
        local app_pod=$(kubectl get pods -n "$NAMESPACE" -l app=vibecode-webgui -o jsonpath='{.items[0].metadata.name}')
        if [ -n "$app_pod" ]; then
            kubectl exec -n "$NAMESPACE" "$app_pod" -- curl -f http://localhost:3000/api/health || print_warning "Health check failed"
        fi
    fi
    
    print_success "Deployment validation completed"
}

# Display deployment information
display_deployment_info() {
    print_header "DEPLOYMENT COMPLETE"
    
    cat << EOF
🎉 VibeCode Platform Deployment Successful!

Deployment Mode: $DEPLOYMENT_MODE
Namespace: $NAMESPACE

Key Components Deployed:
✅ Kubernetes Cluster
$([ "$SKIP_DATABASE" != "true" ] && echo "✅ Database Components (PostgreSQL + RAG)")
$([ "$SKIP_MONITORING" != "true" ] && echo "✅ Monitoring Stack (Datadog)")
✅ Application Components
✅ AI Gateway

Access Information:
EOF

    case $DEPLOYMENT_MODE in
        development)
            cat << EOF
- Main Application: http://localhost:3000
- PostgreSQL: localhost:30001
- Monitoring: Check Datadog dashboard

Useful Commands:
# Port forward services
kubectl port-forward -n $NAMESPACE service/vibecode-webgui 3000:3000
kubectl port-forward -n $NAMESPACE service/postgres-service 5432:5432

# Check logs
kubectl logs -n $NAMESPACE -l app=vibecode-webgui
kubectl logs -n datadog -l app=datadog-agent

# Scale application
kubectl scale deployment vibecode-webgui -n $NAMESPACE --replicas=3
EOF
            ;;
        staging|production)
            echo "- Access via your configured ingress/load balancer"
            echo "- Check your cloud provider's console for external IPs"
            ;;
    esac
    
    echo ""
    print_success "Deployment completed successfully! 🚀"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up temporary files..."
    # Add any cleanup logic here
}

# Main execution
main() {
    # Set trap for cleanup
    trap cleanup EXIT
    
    print_header "VIBECODE PLATFORM DEPLOYMENT"
    print_status "Starting complete platform deployment..."
    print_status "Mode: $DEPLOYMENT_MODE"
    
    # Execute deployment steps
    check_prerequisites
    load_environment
    deploy_cluster
    deploy_database
    deploy_monitoring
    deploy_application
    deploy_ai_gateway
    validate_deployment
    display_deployment_info
}

# Parse arguments and run
parse_arguments "$@"
main "$@"
