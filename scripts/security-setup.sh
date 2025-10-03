#!/usr/bin/env bash
# VibeCode security bootstrap: provisions namespaces, secrets, and local env files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"
cd "$REPO_ROOT"

log_step "🔐 VibeCode Security Setup"

require_cmd() {
  local cmd=$1
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command '$cmd' not found in PATH."
    exit 1
  fi
}

require_cmd kubectl
require_cmd openssl

if ! kubectl cluster-info >/dev/null 2>&1; then
  log_warn "No active Kubernetes cluster detected; creating KIND cluster 'vibecode-dev'."
  require_cmd kind
  kind create cluster --name vibecode-dev --config k8s/kind-config.yaml
  log_success "KIND cluster vibecode-dev created"
fi

log_step "📋 Ensuring namespaces"
for ns in vibecode-platform datadog authelia monitoring; do
  kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  log_info "Namespace '${ns}' available"
done

log_step "🔑 Gathering secrets"
prompt_for_secret() {
  local var_name=$1
  local prompt_text=$2
  local current_value="${!var_name:-}"
  if [[ -z "$current_value" ]]; then
    read -rsp "${prompt_text}: " input_value
    printf '\n'
    export "$var_name=$input_value"
  fi
}

prompt_for_secret DD_API_KEY "Enter Datadog API key"
prompt_for_secret OPENROUTER_API_KEY "Enter OpenRouter API key"
prompt_for_secret CLAUDE_API_KEY "Enter Claude API key (optional)"

log_step "🎲 Generating local secrets"
DD_CLUSTER_AGENT_TOKEN=$(openssl rand -base64 32 | tr -d '\n')
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')

log_step "📊 Creating Datadog secrets"
kubectl create secret generic datadog-secret \
  --from-literal=api-key="$DD_API_KEY" \
  -n datadog --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic datadog-cluster-agent-secret \
  --from-literal=token="$DD_CLUSTER_AGENT_TOKEN" \
  -n datadog --dry-run=client -o yaml | kubectl apply -f -

log_step "🤖 Creating AI integration secrets"
kubectl create secret generic ai-gateway-secret \
  --from-literal=openrouter-api-key="$OPENROUTER_API_KEY" \
  --from-literal=claude-api-key="${CLAUDE_API_KEY:-}" \
  -n vibecode-platform --dry-run=client -o yaml | kubectl apply -f -

log_step "🔐 Creating authentication secrets"
kubectl create secret generic auth-secrets \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --from-literal=session-secret="$SESSION_SECRET" \
  --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
  -n vibecode-platform --dry-run=client -o yaml | kubectl apply -f -

ENV_FILE=".env"
log_step "📝 Writing ${ENV_FILE}"
cat > "$ENV_FILE" <<EOF_ENV
# VibeCode Local Development Environment (generated)
DD_API_KEY=$DD_API_KEY
DD_SITE=datadoghq.com
DD_ENV=development
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0
OPENROUTER_API_KEY=$OPENROUTER_API_KEY
CLAUDE_API_KEY=${CLAUDE_API_KEY:-}
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://vibecode:vibecode123@localhost:5432/vibecode_dev
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3000
VITE_PORT=5173
ENABLE_DEBUG_LOGGING=true
ENABLE_DATADOG_INTEGRATION_TESTS=false
KUBECONFIG=$HOME/.kube/config
KUBERNETES_NAMESPACE=vibecode-platform
PLATFORM_DOMAIN=vibecode.dev
EOF_ENV
log_success "Updated ${ENV_FILE}"

log_step "📁 Updating .gitignore"
if ! grep -q '^\.env$' .gitignore 2>/dev/null; then
  echo ".env" >> .gitignore
  log_info "Added .env to .gitignore"
fi
if ! grep -q '.env.local' .gitignore 2>/dev/null; then
  echo ".env.local" >> .gitignore
  log_info "Added .env.local to .gitignore"
fi

printf '\n'
log_step "Summary"
log_success "Namespaces ensured"
log_success "Datadog + cluster agent secrets provisioned"
log_success "AI gateway + auth secrets provisioned"
log_success "Local .env generated and ignored"

log_step "Next steps"
log_info "  • Review ${ENV_FILE} (and create .env.local for overrides)"
log_info "  • Verify secrets: kubectl get secrets --all-namespaces"
log_info "  • Optionally install Datadog Helm stack using ops/monitoring values"
log_info "  • Start dev environment: npm run dev"

log_step "Useful commands"
log_info "  kubectl get secrets -n datadog"
log_info "  kubectl get secrets -n vibecode-platform"
log_info "  kubectl describe secret datadog-secret -n datadog"

log_success "Security setup complete"
