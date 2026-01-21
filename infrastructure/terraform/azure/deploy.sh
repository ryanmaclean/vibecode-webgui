#!/bin/bash
# VibeCode Azure Infrastructure Deployment Script
# Uses OpenTofu for infrastructure as code

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check OpenTofu or Terraform
    if command -v tofu &> /dev/null; then
        TF_CMD="tofu"
        log_info "Using OpenTofu: $(tofu version | head -1)"
    elif command -v terraform &> /dev/null; then
        TF_CMD="terraform"
        log_info "Using Terraform: $(terraform version | head -1)"
    else
        log_error "Neither OpenTofu nor Terraform found. Install one of them."
        exit 1
    fi

    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI not found. Install with: brew install azure-cli"
        exit 1
    fi

    # Check Azure login
    if ! az account show &> /dev/null; then
        log_warn "Not logged into Azure. Running az login..."
        az login
    fi

    # Check required environment variables
    local required_vars=("TF_VAR_datadog_api_key" "TF_VAR_datadog_app_key")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            log_info "Set it with: export $var='your-value'"
            exit 1
        fi
    done

    log_info "All prerequisites met"
}

# Initialize Terraform/OpenTofu
init() {
    log_info "Initializing ${TF_CMD}..."
    cd "${TF_DIR}"

    # Create backend config if not exists
    if [[ ! -f backend.tfvars ]]; then
        log_info "Creating backend.tfvars from template..."
        cat > backend.tfvars << 'EOF'
resource_group_name  = "rg-vibecode-tofu-state"
storage_account_name = "vibecodetofustate"
container_name       = "tfstate"
key                  = "vibecode-azure.tfstate"
EOF
        log_warn "Update backend.tfvars with your state storage details"
    fi

    # Initialize with backend config
    ${TF_CMD} init -backend-config=backend.tfvars -upgrade
}

# Plan deployment
plan() {
    log_info "Planning deployment..."
    cd "${TF_DIR}"

    ${TF_CMD} plan -out=tfplan -var-file=terraform.tfvars
    log_info "Plan saved to tfplan"
}

# Apply deployment
apply() {
    log_info "Applying deployment..."
    cd "${TF_DIR}"

    if [[ -f tfplan ]]; then
        ${TF_CMD} apply tfplan
    else
        log_warn "No plan file found. Running plan first..."
        ${TF_CMD} apply -var-file=terraform.tfvars
    fi

    log_info "Deployment complete!"
}

# Destroy infrastructure
destroy() {
    log_warn "This will DESTROY all infrastructure!"
    read -p "Are you sure? (type 'yes' to confirm): " confirm

    if [[ "${confirm}" == "yes" ]]; then
        cd "${TF_DIR}"
        ${TF_CMD} destroy -var-file=terraform.tfvars
        log_info "Infrastructure destroyed"
    else
        log_info "Destroy cancelled"
    fi
}

# Get kubeconfig for AKS
get_kubeconfig() {
    log_info "Getting AKS kubeconfig..."

    local cluster_name=$(${TF_CMD} output -raw aks_cluster_name 2>/dev/null || echo "")
    local rg_name=$(${TF_CMD} output -raw resource_group_name 2>/dev/null || echo "")

    if [[ -z "${cluster_name}" || -z "${rg_name}" ]]; then
        log_error "Could not get cluster details from Terraform output"
        exit 1
    fi

    az aks get-credentials --resource-group "${rg_name}" --name "${cluster_name}" --overwrite-existing
    kubelogin convert-kubeconfig -l azurecli

    log_info "Kubeconfig updated for ${cluster_name}"
}

# Setup state storage
setup_state_storage() {
    log_info "Setting up Terraform state storage..."

    local RG_NAME="rg-vibecode-tofu-state"
    local STORAGE_NAME="vibecodetofustate"
    local CONTAINER_NAME="tfstate"
    local LOCATION="eastus2"

    # Create resource group
    az group create --name "${RG_NAME}" --location "${LOCATION}" --output none

    # Create storage account
    az storage account create \
        --name "${STORAGE_NAME}" \
        --resource-group "${RG_NAME}" \
        --location "${LOCATION}" \
        --sku Standard_LRS \
        --encryption-services blob \
        --output none

    # Create blob container
    az storage container create \
        --name "${CONTAINER_NAME}" \
        --account-name "${STORAGE_NAME}" \
        --output none

    log_info "State storage created: ${STORAGE_NAME}/${CONTAINER_NAME}"
}

# Show outputs
outputs() {
    log_info "Terraform outputs:"
    cd "${TF_DIR}"
    ${TF_CMD} output
}

# Main
case "${1:-help}" in
    init)
        check_prerequisites
        init
        ;;
    plan)
        check_prerequisites
        plan
        ;;
    apply)
        check_prerequisites
        apply
        ;;
    destroy)
        check_prerequisites
        destroy
        ;;
    kubeconfig)
        get_kubeconfig
        ;;
    setup-state)
        setup_state_storage
        ;;
    outputs)
        outputs
        ;;
    full-deploy)
        check_prerequisites
        init
        plan
        apply
        get_kubeconfig
        ;;
    *)
        echo "VibeCode Azure Infrastructure Deployment"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  setup-state   Create Azure Storage for Terraform state"
        echo "  init          Initialize Terraform/OpenTofu"
        echo "  plan          Plan infrastructure changes"
        echo "  apply         Apply infrastructure changes"
        echo "  destroy       Destroy all infrastructure"
        echo "  kubeconfig    Get AKS kubeconfig"
        echo "  outputs       Show Terraform outputs"
        echo "  full-deploy   Run init, plan, apply, and kubeconfig"
        echo ""
        echo "Required environment variables:"
        echo "  TF_VAR_datadog_api_key  - Datadog API key"
        echo "  TF_VAR_datadog_app_key  - Datadog App key"
        echo ""
        echo "Optional environment variables:"
        echo "  TF_VAR_openai_api_key       - OpenAI API key"
        echo "  TF_VAR_github_client_id     - GitHub OAuth client ID"
        echo "  TF_VAR_github_client_secret - GitHub OAuth client secret"
        ;;
esac
