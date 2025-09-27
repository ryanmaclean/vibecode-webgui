#!/bin/bash
# GitHub Environments Setup Script
# This script provides instructions for setting up GitHub environments
# Note: This script cannot directly create environments - that must be done through the GitHub UI

set -e

echo "🚀 GitHub Environments Setup Guide"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "This script must be run from within the git repository"
    exit 1
fi

# Get repository information
REPO_URL=$(git config --get remote.origin.url)
REPO_NAME=$(basename -s .git "$REPO_URL")
REPO_OWNER=$(echo "$REPO_URL" | sed -n 's#.*/\([^/]*\)/[^/]*$#\1#p')

log_info "Repository: ${REPO_OWNER}/${REPO_NAME}"
log_info "Repository URL: ${REPO_URL}"
echo ""

echo "📋 MANUAL SETUP REQUIRED"
echo "========================"
echo ""
log_warning "GitHub environments must be created through the GitHub web interface."
log_warning "This script provides guidance and validates your workflow configuration."
echo ""

echo "🔧 Step 1: Create GitHub Environments"
echo "-------------------------------------"
echo "1. Go to: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/environments"
echo "2. Click 'New environment'"
echo "3. Create environment: 'staging'"
echo "   - No protection rules needed"
echo "   - Allow deployment from: develop, main branches"
echo "4. Create environment: 'production'"
echo "   - Enable 'Required reviewers'"
echo "   - Add 1-2 reviewers (maintainers/senior developers)"
echo "   - Restrict deployment branch to: main"
echo ""

echo "🔐 Step 2: Environment Secrets"
echo "------------------------------"
echo ""
echo "🟡 STAGING Environment Secrets:"
echo "  DATABASE_PASSWORD"
echo "  NEXTAUTH_SECRET"
echo "  KUBECONFIG"
echo "  APP_NAME_WEBGUI"
echo "  DD_API_KEY"
echo "  DD_APP_KEY"
echo "  AZURE_CLIENT_ID"
echo "  AZURE_TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID"
echo "  ACR_NAME"
echo "  AZURE_RESOURCE_GROUP"
echo ""
echo "🔴 PRODUCTION Environment Secrets:"
echo "  DATABASE_PASSWORD"
echo "  NEXTAUTH_SECRET" 
echo "  KUBECONFIG"
echo "  APP_NAME_WEBGUI"
echo "  DD_API_KEY"
echo "  DD_APP_KEY"
echo "  AZURE_CLIENT_ID"
echo "  AZURE_TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID"
echo "  ACR_NAME"
echo "  AZURE_RESOURCE_GROUP"
echo ""

echo "🔍 Step 3: Validate Workflow Configuration"
echo "-------------------------------------------"

# Check if workflows exist and have environment configuration
WORKFLOWS_DIR=".github/workflows"
GITOPS_WORKFLOW="${WORKFLOWS_DIR}/gitops-deployment.yml"
AZURE_WORKFLOW="${WORKFLOWS_DIR}/azure-webgui-deploy.yml"

if [[ -f "$GITOPS_WORKFLOW" ]]; then
    log_success "GitOps deployment workflow found"
    
    # Check for environment configuration
    if grep -q "environment:" "$GITOPS_WORKFLOW"; then
        log_success "Environment configuration found in GitOps workflow"
    else
        log_error "Environment configuration missing in GitOps workflow"
    fi
    
    # Check for staging environment
    if grep -q "name: staging" "$GITOPS_WORKFLOW"; then
        log_success "Staging environment configured"
    else
        log_warning "Staging environment not found in workflow"
    fi
    
    # Check for production environment  
    if grep -q "name: production" "$GITOPS_WORKFLOW"; then
        log_success "Production environment configured"
    else
        log_warning "Production environment not found in workflow"
    fi
else
    log_error "GitOps deployment workflow not found: $GITOPS_WORKFLOW"
fi

if [[ -f "$AZURE_WORKFLOW" ]]; then
    log_success "Azure WebGUI deployment workflow found"
    
    if grep -q "environment:" "$AZURE_WORKFLOW"; then
        log_success "Environment configuration found in Azure workflow"
    else
        log_error "Environment configuration missing in Azure workflow"
    fi
else
    log_warning "Azure WebGUI deployment workflow not found: $AZURE_WORKFLOW"
fi

echo ""
echo "📚 Step 4: Review Documentation"
echo "-------------------------------"
if [[ -f "docs/GITHUB_ENVIRONMENTS.md" ]]; then
    log_success "GitHub environments documentation found"
    echo "   📖 Review: docs/GITHUB_ENVIRONMENTS.md"
else
    log_warning "GitHub environments documentation not found"
fi

echo ""
echo "🧪 Step 5: Test Deployment Flow" 
echo "-------------------------------"
echo "After setting up environments:"
echo ""
echo "1. 🟡 Test Staging Deployment:"
echo "   - Create PR against 'develop' branch"
echo "   - Merge PR → should trigger automatic staging deployment"
echo "   - Verify deployment at staging URL"
echo ""
echo "2. 🔴 Test Production Deployment:"
echo "   - Create PR against 'main' branch"
echo "   - Merge PR → should wait for manual approval"
echo "   - Approve deployment in GitHub Actions"
echo "   - Verify deployment at production URL"
echo ""

echo "✅ SETUP CHECKLIST"
echo "=================="
echo "□ Created 'staging' environment in GitHub"
echo "□ Created 'production' environment in GitHub" 
echo "□ Set up protection rules for production (required reviewers)"
echo "□ Configured staging environment secrets"
echo "□ Configured production environment secrets"
echo "□ Tested staging deployment flow"
echo "□ Tested production deployment flow (with approval)"
echo "□ Updated deployment URLs in workflows"
echo ""

log_info "Setup complete! Your repository now uses GitHub environments for secure deployments."
echo ""
echo "🔗 Useful Links:"
echo "   - Environments: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/environments"
echo "   - Actions: https://github.com/${REPO_OWNER}/${REPO_NAME}/actions"
echo "   - Documentation: docs/GITHUB_ENVIRONMENTS.md"