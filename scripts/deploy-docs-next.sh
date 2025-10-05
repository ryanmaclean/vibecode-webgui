#!/usr/bin/env bash
set -euo pipefail

#############################################################################
# Deploy Next.js Docs to Azure Web App for Containers
#
# Usage:
#   ./scripts/deploy-docs-next.sh [environment] [action]
#
# Arguments:
#   environment: dev|staging|production (default: production)
#   action: provision|deploy|swap|rollback (default: deploy)
#
# Examples:
#   ./scripts/deploy-docs-next.sh production provision  # First-time setup
#   ./scripts/deploy-docs-next.sh staging deploy        # Deploy to staging
#   ./scripts/deploy-docs-next.sh production swap       # Blue-green swap
#   ./scripts/deploy-docs-next.sh production rollback   # Rollback deployment
#############################################################################

# Configuration
ENVIRONMENT="${1:-production}"
ACTION="${2:-deploy}"
RESOURCE_GROUP="rg-vibecode-docs-${ENVIRONMENT}"
LOCATION="eastus2"
PLAN_NAME="plan-vibecode-docs-${ENVIRONMENT}"
APP_NAME="vibecode-docs-next-${ENVIRONMENT}"
KEY_VAULT_NAME="kv-vibecode-docs-${ENVIRONMENT}"
ACR_NAME="${ACR_NAME:-vibecodecr}"
IMAGE_REPOSITORY="vibecode/docs-next"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Validate environment
validate_environment() {
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or production."
        exit 1
    fi
}

# Validate action
validate_action() {
    if [[ ! "$ACTION" =~ ^(provision|deploy|swap|rollback|status)$ ]]; then
        log_error "Invalid action: $ACTION. Must be provision, deploy, swap, rollback, or status."
        exit 1
    fi
}

# Check Azure CLI login
check_azure_login() {
    log_info "Checking Azure CLI authentication..."
    if ! az account show &>/dev/null; then
        log_error "Not logged in to Azure. Run 'az login' first."
        exit 1
    fi
    log_success "Azure CLI authenticated"
}

# Provision infrastructure using Bicep
provision_infrastructure() {
    log_info "Provisioning infrastructure for environment: $ENVIRONMENT"

    # Create resource group if it doesn't exist
    if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
        log_info "Creating resource group: $RESOURCE_GROUP"
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    else
        log_info "Resource group already exists: $RESOURCE_GROUP"
    fi

    # Create Key Vault if it doesn't exist
    if ! az keyvault show --name "$KEY_VAULT_NAME" &>/dev/null; then
        log_info "Creating Key Vault: $KEY_VAULT_NAME"
        az keyvault create \
            --name "$KEY_VAULT_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --enable-rbac-authorization false \
            --enabled-for-template-deployment true
    else
        log_info "Key Vault already exists: $KEY_VAULT_NAME"
    fi

    # Deploy Bicep template
    log_info "Deploying Bicep template..."

    # Get latest image from ACR or use placeholder
    LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv 2>/dev/null || echo "${ACR_NAME}.azurecr.io")
    CONTAINER_IMAGE="${LOGIN_SERVER}/${IMAGE_REPOSITORY}:latest"

    log_info "Using container image: $CONTAINER_IMAGE"

    az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file azure/docs-next-appservice.bicep \
        --parameters \
            environment="$ENVIRONMENT" \
            planName="$PLAN_NAME" \
            appName="$APP_NAME" \
            containerImage="$CONTAINER_IMAGE" \
            keyVaultName="$KEY_VAULT_NAME" \
            skuName="${SKU_NAME:-P1v3}" \
            enableStagingSlot=true \
            enableAutoScale=true \
            minInstances=1 \
            maxInstances=5

    log_success "Infrastructure provisioned successfully"

    # Display outputs
    APP_URL=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)
    log_success "Application URL: https://${APP_URL}"
    log_success "Staging URL: https://${APP_NAME}-staging.azurewebsites.net"
}

# Build and deploy application
deploy_application() {
    log_info "Deploying application to environment: $ENVIRONMENT"

    # Get ACR login server
    LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)

    # Generate image tag (use git SHA if available, otherwise timestamp)
    if git rev-parse --git-dir > /dev/null 2>&1; then
        IMAGE_TAG=$(git rev-parse --short HEAD)
    else
        IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
    fi

    IMAGE_NAME="${LOGIN_SERVER}/${IMAGE_REPOSITORY}:${IMAGE_TAG}"

    log_info "Building container image: $IMAGE_NAME"

    # Build Next.js application
    log_info "Building Next.js application..."
    npm ci --legacy-peer-deps
    npm run build

    # Prepare standalone bundle
    log_info "Preparing standalone bundle..."
    mkdir -p next-standalone
    rsync -a --delete .next/standalone/ next-standalone/
    if [ -d ".next/static" ]; then
        rsync -a .next/static/ next-standalone/.next/static/
    fi
    if [ -d "public" ]; then
        rsync -a public/ next-standalone/public/
    fi
    if [ -d "content/wiki" ]; then
        rsync -a content/wiki/ next-standalone/content/wiki/
    fi

    # Build Docker image
    log_info "Building Docker image..."
    docker build -f docker/Dockerfile.docs-next -t "$IMAGE_NAME" .

    # Login to ACR
    log_info "Logging in to Azure Container Registry..."
    az acr login --name "$ACR_NAME"

    # Push image
    log_info "Pushing image to ACR..."
    docker push "$IMAGE_NAME"

    # Tag as latest
    docker tag "$IMAGE_NAME" "${LOGIN_SERVER}/${IMAGE_REPOSITORY}:latest"
    docker push "${LOGIN_SERVER}/${IMAGE_REPOSITORY}:latest"

    # Deploy to staging slot first
    log_info "Deploying to staging slot..."
    az webapp config container set \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --slot staging \
        --docker-custom-image-name "$IMAGE_NAME" \
        --docker-registry-server-url "https://${LOGIN_SERVER}"

    # Restart staging slot
    az webapp restart --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --slot staging

    # Wait for staging to be ready
    log_info "Waiting for staging slot to be ready..."
    STAGING_URL="https://${APP_NAME}-staging.azurewebsites.net"
    for i in {1..10}; do
        if curl -fsS --max-time 10 "${STAGING_URL}/api/readyz" &>/dev/null; then
            log_success "Staging slot is ready"
            break
        fi
        log_warning "Attempt $i: Staging not ready yet, waiting..."
        sleep $((i * 5))
    done

    log_success "Deployment to staging completed"
    log_info "Staging URL: $STAGING_URL"
    log_info "To promote to production, run: ./scripts/deploy-docs-next.sh $ENVIRONMENT swap"
}

# Swap staging to production (blue-green deployment)
swap_slots() {
    log_info "Performing blue-green deployment swap..."

    # Preview swap
    log_info "Previewing slot swap..."
    az webapp deployment slot swap \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --slot staging \
        --target-slot production \
        --action preview

    # Confirm swap
    read -p "Review staging slot. Continue with swap? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_warning "Swap cancelled"
        exit 0
    fi

    # Perform swap
    log_info "Swapping staging to production..."
    az webapp deployment slot swap \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --slot staging \
        --target-slot production

    log_success "Swap completed successfully"

    # Verify production
    PROD_URL="https://${APP_NAME}.azurewebsites.net"
    log_info "Verifying production deployment..."
    sleep 10

    if curl -fsS --max-time 10 "${PROD_URL}/api/readyz" &>/dev/null; then
        log_success "Production is healthy: $PROD_URL"
    else
        log_error "Production health check failed. Consider rolling back."
        exit 1
    fi
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."

    # Confirm rollback
    read -p "This will swap production back to staging. Continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_warning "Rollback cancelled"
        exit 0
    fi

    # Swap back
    az webapp deployment slot swap \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --slot production \
        --target-slot staging

    log_success "Rollback completed"

    # Verify
    PROD_URL="https://${APP_NAME}.azurewebsites.net"
    if curl -fsS --max-time 10 "${PROD_URL}/api/readyz" &>/dev/null; then
        log_success "Production is healthy after rollback: $PROD_URL"
    else
        log_error "Production health check failed after rollback"
        exit 1
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment status for environment: $ENVIRONMENT"

    # Get app details
    APP_STATE=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query state -o tsv)
    APP_URL=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)

    # Get current image
    CURRENT_IMAGE=$(az webapp config container show \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[0].value" -o tsv)

    echo ""
    echo "======================================"
    echo "  Deployment Status: $ENVIRONMENT"
    echo "======================================"
    echo "App Name: $APP_NAME"
    echo "State: $APP_STATE"
    echo "Production URL: https://$APP_URL"
    echo "Staging URL: https://${APP_NAME}-staging.azurewebsites.net"
    echo "Current Image: $CURRENT_IMAGE"
    echo ""

    # Check health
    log_info "Checking production health..."
    if curl -fsS --max-time 10 "https://${APP_URL}/api/readyz" &>/dev/null; then
        log_success "Production is healthy"
    else
        log_error "Production health check failed"
    fi

    log_info "Checking staging health..."
    if curl -fsS --max-time 10 "https://${APP_NAME}-staging.azurewebsites.net/api/readyz" &>/dev/null; then
        log_success "Staging is healthy"
    else
        log_warning "Staging health check failed"
    fi
}

# Main execution
main() {
    validate_environment
    validate_action
    check_azure_login

    case "$ACTION" in
        provision)
            provision_infrastructure
            ;;
        deploy)
            deploy_application
            ;;
        swap)
            swap_slots
            ;;
        rollback)
            rollback_deployment
            ;;
        status)
            show_status
            ;;
        *)
            log_error "Unknown action: $ACTION"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
