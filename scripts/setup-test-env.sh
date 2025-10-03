#!/usr/bin/env bash
# GenAI demo environment bootstrapper

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"
cd "$REPO_ROOT"

log_step "VibeCode GenAI Demo – Environment Setup"

require_cmd() {
  local cmd=$1
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command '$cmd' is not available."
    exit 1
  fi
}

log_step "1. Validating prerequisites"
require_cmd az
require_cmd docker-compose
require_cmd npm
require_cmd openssl

if ! az account show >/dev/null 2>&1; then
  log_warn "Azure CLI not logged in – invoking 'az login'"
  az login || {
    log_error "Azure login failed. Please run 'az login' manually and retry."
    exit 1
  }
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)

if [[ -z "$SUBSCRIPTION_ID" || -z "$TENANT_ID" ]]; then
  log_error "Unable to resolve Azure subscription details."
  exit 1
fi

log_success "Using Azure subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})"
export AZURE_SUBSCRIPTION_ID="$SUBSCRIPTION_ID"
export AZURE_TENANT_ID="$TENANT_ID"

log_step "2. Starting local Docker services (db, datadog-agent)"
docker-compose up -d db datadog-agent

log_step "3. Waiting for PostgreSQL to become ready"
MAX_RETRIES=${MAX_RETRIES:-30}
COUNTER=0
until docker-compose exec -T db pg_isready -U vibecode >/dev/null 2>&1; do
  if (( COUNTER >= MAX_RETRIES )); then
    log_error "Timed out waiting for PostgreSQL readiness."
    exit 1
  fi
  sleep 2
  ((COUNTER++))
done
log_success "PostgreSQL is ready"

log_step "4. Installing npm dependencies"
if [[ ! -d node_modules ]]; then
  npm install --legacy-peer-deps
else
  log_warn "node_modules already present – skipping npm install"
fi

log_step "5. Running Prisma migrations"
if npx prisma migrate status | grep -q 'Database schema is up to date'; then
  log_warn "Database schema already up to date"
else
  npx prisma migrate deploy
fi

log_step "6. Ensuring tsx is available"
npm install -g tsx >/dev/null 2>&1 || log_warn "Global tsx install failed – continuing (make sure tsx is available in PATH)"

log_step "7. Seeding demo database"
npx tsx scripts/setup-demo-db.ts

ENV_FILE=".env"
log_step "8. Preparing environment file (${ENV_FILE})"
if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example "$ENV_FILE"
  log_success "Created ${ENV_FILE} from template"
else
  log_warn "${ENV_FILE} already exists – keeping existing values"
fi

update_env_var() {
  local key=$1
  local value=$2
  if [[ -z "$value" ]]; then
    return
  fi
  if grep -q "^${key}=" "$ENV_FILE"; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    fi
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

if [[ -n "${AZURE_OPENAI_ENDPOINT:-}" && -n "${AZURE_OPENAI_API_KEY:-}" ]]; then
  log_success "Applying Azure OpenAI credentials to ${ENV_FILE}"
  update_env_var "AZURE_OPENAI_ENDPOINT" "$AZURE_OPENAI_ENDPOINT"
  update_env_var "AZURE_OPENAI_API_KEY" "$AZURE_OPENAI_API_KEY"
else
  log_warn "Azure OpenAI credentials not detected – update ${ENV_FILE} manually (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY)."
fi

log_step "9. Running demo tests"
npm test tests/genai-workflow.test.ts

log_success "Test environment setup complete"
log_info "Next steps:"
log_info "  • Start the demo app: npm run dev"
log_info "  • Run the workflow script: cd demos && npx ts-node genai-workflow.ts"
