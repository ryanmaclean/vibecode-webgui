#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# Deploy Comparison Environments Script
# Sets up both AKS (dev) and Azure Functions (staging) for A/B testing

# Initialize log aggregation
init_log_aggregation


echo "🚀 Deploying Comparison Environments for A/B Testing"
echo "=================================================="

# Configuration
AKS_ENVIRONMENT="dev"
FUNCTIONS_ENVIRONMENT="staging"
RESOURCE_GROUP_AKS="vibecode-dev-rg"
RESOURCE_GROUP_FUNCTIONS="vibecode-staging-rg"
CLUSTER_NAME="vibecode-dev-aks"
FUNCTION_APP_NAME="vibecode-docs-search-staging"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install it first."
        exit 1
    fi
    
    # Check OpenTofu/Terraform
    if ! command -v tofu &> /dev/null && ! command -v terraform &> /dev/null; then
        error "Neither OpenTofu nor Terraform is installed. Please install one."
        exit 1
    fi
    
    # Check Azure login
    if ! az account show &> /dev/null; then
        error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        error "Node.js and npm are required. Please install them first."
        exit 1
    fi
    
    success "All prerequisites satisfied"
}

# Deploy AKS environment (dev)
deploy_aks_environment() {
    log "Deploying AKS environment (dev)..."
    
    # Check if we have existing AKS deployment
    if kubectl config current-context | grep -q "$CLUSTER_NAME" 2>/dev/null; then
        warning "AKS cluster already configured. Updating existing deployment..."
        
        # Update the existing deployment
        cd helm/vibecode-platform
        helm upgrade vibecode-dev . \
            --namespace vibecode-dev \
            --create-namespace \
            --values values-dev.yaml \
            --set image.tag="${AKS_VERSION:-latest}" \
            --set environment=dev \
            --set monitoring.datadog.enabled=true \
            --timeout=10m
        
        success "AKS environment updated"
    else
        warning "AKS cluster not found. Please deploy AKS infrastructure first:"
        echo "  cd infrastructure/terraform/azure"
        echo "  tofu init && tofu apply"
        echo "  az aks get-credentials --resource-group $RESOURCE_GROUP_AKS --name $CLUSTER_NAME"
        echo "Then run this script again."
        return 1
    fi
}

# Deploy Azure Functions environment (staging)
deploy_functions_environment() {
    log "Deploying Azure Functions environment (staging)..."
    
    cd azure-functions
    
    # Install dependencies
    npm install
    
    # Build the functions
    npm run build
    
    # Check if function app exists
    if az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP_FUNCTIONS" &>/dev/null; then
        warning "Function app already exists. Updating deployment..."
    else
        log "Creating new function app..."
        
        # Create resource group if it doesn't exist
        az group create --name "$RESOURCE_GROUP_FUNCTIONS" --location "East US 2" || true
        
        # Create storage account
        STORAGE_ACCOUNT="${FUNCTION_APP_NAME}storage"
        az storage account create \
            --name "$STORAGE_ACCOUNT" \
            --location "East US 2" \
            --resource-group "$RESOURCE_GROUP_FUNCTIONS" \
            --sku Standard_LRS \
            --kind StorageV2 || true
        
        # Create function app
        az functionapp create \
            --name "$FUNCTION_APP_NAME" \
            --storage-account "$STORAGE_ACCOUNT" \
            --consumption-plan-location "East US 2" \
            --resource-group "$RESOURCE_GROUP_FUNCTIONS" \
            --runtime node \
            --runtime-version 18 \
            --functions-version 4 \
            --tags "Environment=staging" "Purpose=ab-testing"
    fi
    
    # Configure environment variables
    log "Configuring function app settings..."
    az functionapp config appsettings set \
        --name "$FUNCTION_APP_NAME" \
        --resource-group "$RESOURCE_GROUP_FUNCTIONS" \
        --settings \
            "DD_SITE=datadoghq.com" \
            "DD_SERVICE=vibecode-docs-search-staging" \
            "DD_ENV=staging" \
            "DD_VERSION=${FUNCTIONS_VERSION:-1.0.0}" \
            "DD_LOGS_ENABLED=true" \
            "DD_TRACE_ENABLED=true" \
            "DATABASE_URL=${DATABASE_URL:-}" \
            "AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY:-}" \
            "AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT:-}" \
            "EMBEDDINGS_DEPLOYMENT_NAME=${EMBEDDINGS_DEPLOYMENT_NAME:-text-embedding-ada-002}" \
            "DD_API_KEY=${DD_API_KEY:-}"
    
    # Deploy functions
    log "Deploying functions..."
    func azure functionapp publish "$FUNCTION_APP_NAME" --typescript
    
    success "Azure Functions environment deployed"
    cd ..
}

# Validate deployments
validate_deployments() {
    log "Validating deployments..."
    
    # Test AKS deployment
    log "Testing AKS deployment..."
    AKS_URL="${AKS_BASE_URL:-http://localhost:3000}"
    if curl -f "$AKS_URL/api/health" --max-time 10 &>/dev/null; then
        success "AKS deployment is healthy"
        export AKS_HEALTHY=true
    else
        warning "AKS deployment health check failed"
        export AKS_HEALTHY=false
    fi
    
    # Test Azure Functions deployment
    log "Testing Azure Functions deployment..."
    FUNCTIONS_URL="https://${FUNCTION_APP_NAME}.azurewebsites.net"
    
    # Wait for function app to be ready
    log "Waiting for function app to be ready..."
    sleep 30
    
    if curl -f "$FUNCTIONS_URL/api/health" --max-time 30 &>/dev/null; then
        success "Azure Functions deployment is healthy"
        export FUNCTIONS_HEALTHY=true
    else
        warning "Azure Functions deployment health check failed"
        export FUNCTIONS_HEALTHY=false
    fi
    
    # Summary
    echo ""
    log "Deployment Validation Summary:"
    echo "  AKS (dev): ${AKS_HEALTHY:-false}"
    echo "  Azure Functions (staging): ${FUNCTIONS_HEALTHY:-false}"
    
    if [[ "${AKS_HEALTHY:-false}" == "true" && "${FUNCTIONS_HEALTHY:-false}" == "true" ]]; then
        success "Both environments are ready for A/B testing!"
        return 0
    elif [[ "${AKS_HEALTHY:-false}" == "true" || "${FUNCTIONS_HEALTHY:-false}" == "true" ]]; then
        warning "One environment is ready. A/B testing can proceed with available environment."
        return 0
    else
        error "No environments are healthy. Please check deployments."
        return 1
    fi
}

# Setup environment variables for testing
setup_test_environment() {
    log "Setting up test environment variables..."
    
    # Create .env.ab-testing file
    cat > .env.ab-testing << EOF
# A/B Testing Environment Configuration
# Generated: $(date)

# AKS Environment (Dev)
AKS_BASE_URL=${AKS_BASE_URL:-http://localhost:3000}
AKS_VERSION=${AKS_VERSION:-current}
AKS_HEALTHY=${AKS_HEALTHY:-false}

# Azure Functions Environment (Staging)
FUNCTIONS_BASE_URL=https://${FUNCTION_APP_NAME}.azurewebsites.net
FUNCTIONS_VERSION=${FUNCTIONS_VERSION:-1.0.0}
FUNCTIONS_HEALTHY=${FUNCTIONS_HEALTHY:-false}

# Database Configuration
DATABASE_URL=${DATABASE_URL:-}

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY:-}
AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT:-}
EMBEDDINGS_DEPLOYMENT_NAME=${EMBEDDINGS_DEPLOYMENT_NAME:-text-embedding-ada-002}

# Datadog Configuration
DD_API_KEY=${DD_API_KEY:-}
DD_SITE=datadoghq.com

# Test Configuration
NODE_ENV=test
AB_TESTING_ENABLED=true
EOF
    
    success "Test environment configuration saved to .env.ab-testing"
    
    # Display next steps
    echo ""
    log "Next Steps:"
    echo "1. Review and update .env.ab-testing with your actual values"
    echo "2. Run A/B testing suite:"
    echo "   npm run test:ab-compare"
    echo "   # OR"
    echo "   npx ts-node tests/performance/run-ab-test.ts"
    echo ""
    echo "3. View results in tests/performance/results/"
    echo ""
    echo "4. For continuous monitoring:"
    echo "   npx ts-node tests/performance/run-ab-test.ts --monitor=30 --auto-rollback"
}

# Cleanup function
cleanup_on_error() {
    error "Deployment failed. Cleaning up..."
    
    # Add cleanup logic here if needed
    # For now, just log the error
    log "Manual cleanup may be required. Check Azure portal and kubectl for resources."
}

# Main execution
main() {
    log "Starting comparison environment deployment..."
    
    # Set trap for cleanup on error
    trap cleanup_on_error ERR
    
    # Run deployment steps
    check_prerequisites
    
    log "Deploying environments in parallel..."
    
    # Deploy AKS environment
    if deploy_aks_environment; then
        success "AKS environment deployment completed"
    else
        warning "AKS environment deployment had issues"
    fi
    
    # Deploy Azure Functions environment
    if deploy_functions_environment; then
        success "Azure Functions environment deployment completed"
    else
        warning "Azure Functions environment deployment had issues"
    fi
    
    # Validate deployments
    validate_deployments
    
    # Setup test environment
    setup_test_environment
    
    success "Comparison environments deployment completed!"
    log "Ready for A/B testing between AKS (dev) and Azure Functions (staging)"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "validate")
        validate_deployments
        ;;
    "cleanup")
        log "Cleaning up test environments..."
        # Add cleanup logic here
        warning "Cleanup not implemented yet. Please clean up manually."
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [deploy|validate|cleanup|help]"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy both AKS and Azure Functions environments (default)"
        echo "  validate - Validate existing deployments"
        echo "  cleanup  - Clean up test environments"
        echo "  help     - Show this help message"
        ;;
    *)
        error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
