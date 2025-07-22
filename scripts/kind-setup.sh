#!/bin/bash
# VibeCode KIND Setup - One command to rule them all
set -e

echo "🚀 VibeCode KIND Setup - Automated"
echo "=================================="
echo "This will create a complete local Kubernetes development environment"
echo ""

# Configuration
CLUSTER_NAME="vibecode-test"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log_step() {
    echo -e "\n${GREEN}==>${NC} $1"
}

log_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

# Step 1: Environment check
log_step "Step 1: Environment check"
if [ -f "$SCRIPT_DIR/kind-env-check.sh" ]; then
    chmod +x "$SCRIPT_DIR/kind-env-check.sh"
    if ! "$SCRIPT_DIR/kind-env-check.sh"; then
        log_error "Environment check failed. Please resolve the issues above."
        echo ""
        echo -e "${YELLOW}💡 Docker issues detected? Try Docker Doctor:${NC}"
        echo -e "   ${GREEN}./scripts/docker-doctor.sh${NC}"
        echo ""
        exit 1
    fi
else
    log_error "Environment check script not found: $SCRIPT_DIR/kind-env-check.sh"
    exit 1
fi

# Step 2: Cleanup
log_step "Step 2: Cleanup previous installations"
if [ -f "$SCRIPT_DIR/kind-cleanup.sh" ]; then
    chmod +x "$SCRIPT_DIR/kind-cleanup.sh"
    "$SCRIPT_DIR/kind-cleanup.sh"
else
    log_warning "Cleanup script not found, skipping: $SCRIPT_DIR/kind-cleanup.sh"
fi

# Step 3: Create cluster
log_step "Step 3: Create KIND cluster"
if [ -f "$SCRIPT_DIR/kind-create-cluster.sh" ]; then
    chmod +x "$SCRIPT_DIR/kind-create-cluster.sh"
    if ! "$SCRIPT_DIR/kind-create-cluster.sh"; then
        log_error "Cluster creation failed"
        exit 1
    fi
else
    log_error "Cluster creation script not found: $SCRIPT_DIR/kind-create-cluster.sh"
    exit 1
fi

# Step 4: Deploy services
log_step "Step 4: Deploy VibeCode services"
if [ -f "$SCRIPT_DIR/kind-deploy-services.sh" ]; then
    chmod +x "$SCRIPT_DIR/kind-deploy-services.sh"
    if ! "$SCRIPT_DIR/kind-deploy-services.sh"; then
        log_error "Service deployment failed"
        exit 1
    fi
else
    log_error "Service deployment script not found: $SCRIPT_DIR/kind-deploy-services.sh"
    exit 1
fi

# Step 5: Health check
log_step "Step 5: Final health check"
if [ -f "$SCRIPT_DIR/kind-health-check.sh" ]; then
    chmod +x "$SCRIPT_DIR/kind-health-check.sh"
    if ! "$SCRIPT_DIR/kind-health-check.sh"; then
        log_warning "Health check detected issues, but setup is complete"
        echo ""
        echo "🔧 The environment may need a few more minutes to fully initialize."
        echo "   Try running the health check again in 2-3 minutes:"
        echo "   ./scripts/kind-health-check.sh"
    fi
else
    log_warning "Health check script not found: $SCRIPT_DIR/kind-health-check.sh"
fi

# Success message
echo ""
echo "🎉 SUCCESS! VibeCode KIND environment is ready"
echo ""
echo "📊 Cluster Information:"
echo "   Cluster name: $CLUSTER_NAME"
echo "   Context: kind-$CLUSTER_NAME"
echo "   Namespace: vibecode"
echo ""
echo "💡 Quick access commands:"
echo "   # Check status"
echo "   kubectl get pods -n vibecode"
echo ""
echo "   # Access application"
echo "   kubectl port-forward -n vibecode svc/vibecode-service 3000:3000"
echo "   open http://localhost:3000"
echo ""
echo "   # View logs"
echo "   kubectl logs -f deployment/vibecode-webgui -n vibecode"
echo ""
echo "   # Health check"
echo "   ./scripts/kind-health-check.sh"
echo ""
echo "📋 What to test next:"
echo "   1. 🤖 AI Chat - Test the enhanced AI features with multiple models"
echo "   2. 🔍 RAG Search - Upload files and test semantic search"
echo "   3. 🖥️  Console Mode - Try VS Code in the browser"
echo "   4. 🏗️  Project Generation - Generate a new project with AI"
echo "   5. 🔧 Agent Framework - Test the multi-agent capabilities"
echo ""
echo "🆘 If you encounter issues:"
echo "   • Check logs: kubectl logs -l app=vibecode-webgui -n vibecode"
echo "   • Restart pods: kubectl rollout restart deployment/vibecode-webgui -n vibecode"
echo "   • Full reset: kind delete cluster --name=$CLUSTER_NAME && ./scripts/kind-setup.sh"
echo ""
echo "📖 Documentation:"
echo "   • Troubleshooting: KIND_TROUBLESHOOTING_GUIDE.md"
echo "   • Features: ENHANCED_AI_FEATURES.md"
echo "   • Repository scan: REPOSITORY_SCAN_REPORT_JULY_2025.md"