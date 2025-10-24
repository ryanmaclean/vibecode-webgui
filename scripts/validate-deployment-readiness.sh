#!/usr/bin/env bash
set -euo pipefail

# Deployment Readiness Validation Script
# Validates all prerequisites before executing Azure deployment

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"
}

success() {
  printf "${GREEN}✅ %s${NC}\n" "$*"
}

warning() {
  printf "${YELLOW}⚠️  %s${NC}\n" "$*"
}

error() {
  printf "${RED}❌ %s${NC}\n" "$*"
}

info() {
  printf "${BLUE}ℹ️  %s${NC}\n" "$*"
}

VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

check_requirement() {
  local requirement="$1"
  local command="$2"
  local expected="$3"
  
  if command -v "$command" >/dev/null 2>&1; then
    local version
    version=$($command --version 2>/dev/null | head -1 || echo "unknown")
    success "$requirement: $version"
  else
    error "$requirement: NOT INSTALLED (required: $expected)"
    ((VALIDATION_ERRORS++))
  fi
}

check_env_var() {
  local var_name="$1"
  local description="$2"
  local required="${3:-true}"
  
  if [ -n "${!var_name:-}" ]; then
    if [[ "$var_name" == *"KEY"* ]] || [[ "$var_name" == *"SECRET"* ]] || [[ "$var_name" == *"PASSWORD"* ]]; then
      success "$description: SET (***hidden***)"
    else
      success "$description: ${!var_name}"
    fi
  else
    if [ "$required" = "true" ]; then
      error "$description: NOT SET (required variable: $var_name)"
      ((VALIDATION_ERRORS++))
    else
      warning "$description: NOT SET (optional variable: $var_name)"
      ((VALIDATION_WARNINGS++))
    fi
  fi
}

log "🔍 Validating deployment readiness for Azure AKS"

# Check required tools
echo
info "Checking required tools..."
check_requirement "Azure CLI" "az" "2.0+"
check_requirement "OpenTofu" "tofu" "1.6+"
check_requirement "kubectl" "kubectl" "1.28+"
check_requirement "Helm" "helm" "3.12+"
check_requirement "Docker" "docker" "20.0+"

# Check Azure authentication
echo
info "Checking Azure authentication..."
if az account show >/dev/null 2>&1; then
  subscription_name=$(az account show --query name -o tsv)
  subscription_id=$(az account show --query id -o tsv)
  success "Azure authentication: Logged in to '$subscription_name' ($subscription_id)"
else
  error "Azure authentication: NOT LOGGED IN (run 'az login')"
  ((VALIDATION_ERRORS++))
fi

# Load environment configuration
ENV_FILE=${ENV_FILE:-.env.aks}
if [ -f "$ENV_FILE" ]; then
  success "Environment file: Found $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  error "Environment file: $ENV_FILE not found (copy from env.aks.example)"
  ((VALIDATION_ERRORS++))
fi

# Check required environment variables
echo
info "Checking required environment variables..."
check_env_var "TF_VAR_datadog_api_key" "Datadog API Key" true
check_env_var "TF_VAR_datadog_app_key" "Datadog App Key" true
check_env_var "TF_VAR_postgresql_admin_password" "PostgreSQL Password" true
check_env_var "TF_VAR_nextauth_secret" "NextAuth Secret" true
check_env_var "TF_VAR_resource_group_name" "Resource Group Name" true
check_env_var "TF_VAR_location" "Azure Location" true

# Check optional environment variables
echo
info "Checking optional environment variables..."
check_env_var "TF_VAR_openrouter_api_key" "OpenRouter API Key" false
check_env_var "TF_VAR_azure_openai_api_key" "Azure OpenAI API Key" false
check_env_var "TF_VAR_azure_openai_endpoint" "Azure OpenAI Endpoint" false
check_env_var "OPENAI_API_KEY" "OpenAI API Key (for AI generation)" false

# Check OpenTofu configuration
echo
info "Checking OpenTofu configuration..."
if [ -d "tofu" ]; then
  success "OpenTofu directory: Found"
  
  cd tofu
  if tofu validate >/dev/null 2>&1; then
    success "OpenTofu validation: PASSED"
  else
    error "OpenTofu validation: FAILED"
    tofu validate
    ((VALIDATION_ERRORS++))
  fi
  cd ..
else
  error "OpenTofu directory: NOT FOUND"
  ((VALIDATION_ERRORS++))
fi

# Check Dockerfile
echo
info "Checking container configuration..."
if [ -f "docker/Dockerfile" ]; then
  success "Production Dockerfile: Found"
else
  error "Production Dockerfile: NOT FOUND (docker/Dockerfile required)"
  ((VALIDATION_ERRORS++))
fi

# Check Helm charts
if [ -d "charts/vibecode" ] || [ -f "scripts/tofu-aks-deploy.sh" ]; then
  success "Helm configuration: Ready (will be created during deployment)"
else
  warning "Helm configuration: Will be generated during deployment"
  ((VALIDATION_WARNINGS++))
fi

# Check AI project generation dependencies
echo
info "Checking AI project generation..."
if [ -f "src/lib/services/ai-project-generator.ts" ]; then
  success "AI Project Generator: Implemented"
else
  error "AI Project Generator: NOT FOUND"
  ((VALIDATION_ERRORS++))
fi

if [ -f "src/app/api/ai/generate-project/route.ts" ]; then
  success "AI Generation API: Implemented"
else
  error "AI Generation API: NOT FOUND"
  ((VALIDATION_ERRORS++))
fi

# Check Azure resource availability
echo
info "Checking Azure resource availability..."
if [ -n "${TF_VAR_resource_group_name:-}" ]; then
  if az group show --name "${TF_VAR_resource_group_name}" >/dev/null 2>&1; then
    warning "Resource Group: Already exists (will be reused)"
    ((VALIDATION_WARNINGS++))
  else
    success "Resource Group: Available for creation"
  fi
fi

# Estimate deployment costs
echo
info "Deployment cost estimation..."
info "Expected monthly costs:"
info "  • AKS Cluster (3 nodes): ~$200-400/month"
info "  • PostgreSQL (Flexible): ~$50-100/month" 
info "  • Container Registry: ~$5-20/month"
info "  • Networking & Storage: ~$20-50/month"
info "  • Total estimated: ~$275-570/month"
info ""
info "To minimize costs:"
info "  • Use spot instances where possible"
info "  • Scale down during non-business hours"
info "  • Monitor usage with Azure Cost Management"

# Summary
echo
log "📊 Validation Summary"
if [ $VALIDATION_ERRORS -eq 0 ]; then
  success "All critical requirements satisfied!"
  if [ $VALIDATION_WARNINGS -gt 0 ]; then
    warning "$VALIDATION_WARNINGS warnings found (non-critical)"
  fi
  echo
  success "✅ READY FOR DEPLOYMENT"
  echo
  info "Next steps:"
  info "  1. Review cost estimates above"
  info "  2. Run: ./scripts/tofu-aks-deploy.sh"
  info "  3. Monitor deployment progress"
  info "  4. Verify application functionality"
else
  error "$VALIDATION_ERRORS critical errors found"
  if [ $VALIDATION_WARNINGS -gt 0 ]; then
    warning "$VALIDATION_WARNINGS warnings found"
  fi
  echo
  error "❌ NOT READY FOR DEPLOYMENT"
  echo
  info "Fix the errors above before deploying"
  exit 1
fi
