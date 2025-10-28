#!/bin/bash
# AgentAPI Deployment Script
# Deploys VibeCode workspace with AgentAPI to Kubernetes

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HELM_CHART_PATH="${PROJECT_ROOT}/helm/agentapi"

# Default values
ENVIRONMENT="${1:-dev}"
NAMESPACE="${NAMESPACE:-vibecode-platform}"
RELEASE_NAME="${RELEASE_NAME:-agentapi}"
DRY_RUN="${DRY_RUN:-false}"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

main() {
    log_info "Deploying AgentAPI to $ENVIRONMENT..."
    
    helm upgrade --install "$RELEASE_NAME" "$HELM_CHART_PATH" \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --values "${HELM_CHART_PATH}/values-${ENVIRONMENT}.yaml" \
        --wait
    
    log_success "Deployment complete!"
}

main
