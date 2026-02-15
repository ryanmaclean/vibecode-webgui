#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# Kubernetes Prerequisites Check
# Verifies that all required tools are installed for KIND cluster deployment

# Initialize log aggregation
init_log_aggregation


echo "🔍 Kubernetes Prerequisites Check"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Track overall status
PREREQUISITES_MET=true

# Check Docker
log_info "Checking Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | tr -d ',')
    log_success "Docker installed: $DOCKER_VERSION"

    # Check if Docker daemon is running
    if docker info &> /dev/null; then
        log_success "Docker daemon is running"
    else
        log_error "Docker daemon is not running. Please start Docker."
        PREREQUISITES_MET=false
    fi
else
    log_error "Docker not found. Please install Docker Desktop."
    PREREQUISITES_MET=false
fi

# Check KIND
log_info "Checking KIND..."
if command -v kind &> /dev/null; then
    KIND_VERSION=$(kind version | cut -d ' ' -f2)
    log_success "KIND installed: $KIND_VERSION"
else
    log_error "KIND not found. Install with: brew install kind"
    PREREQUISITES_MET=false
fi

# Check kubectl
log_info "Checking kubectl..."
if command -v kubectl &> /dev/null; then
    KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || kubectl version --client -o json 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    log_success "kubectl installed: $KUBECTL_VERSION"
else
    log_error "kubectl not found. Install with: brew install kubectl"
    PREREQUISITES_MET=false
fi

# Check Helm
log_info "Checking Helm..."
if command -v helm &> /dev/null; then
    HELM_VERSION=$(helm version --short | cut -d '+' -f1)
    log_success "Helm installed: $HELM_VERSION"
else
    log_warning "Helm not found. Install with: brew install helm"
    log_warning "Helm is optional but recommended for package management"
fi

# Display summary
echo ""
echo "📊 Prerequisites Summary:"
echo "  🐳 Docker: $(command -v docker &> /dev/null && echo "✅" || echo "❌")"
echo "  ☸️  KIND: $(command -v kind &> /dev/null && echo "✅" || echo "❌")"
echo "  🎯 kubectl: $(command -v kubectl &> /dev/null && echo "✅" || echo "❌")"
echo "  📦 Helm: $(command -v helm &> /dev/null && echo "✅" || echo "⚠️  (optional)")"
echo ""

if [ "$PREREQUISITES_MET" = true ]; then
    echo "✅ All required prerequisites are met!"
    echo "   You can now run: ./scripts/deploy-kind-with-monitoring.sh"
    exit 0
else
    echo "❌ Some prerequisites are missing."
    echo "   Please install the missing tools and try again."
    exit 1
fi
