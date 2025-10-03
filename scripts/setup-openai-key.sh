#!/usr/bin/env bash
# Prompt for an OpenAI API key and store it in .env/.env.local using repo logging helpers.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="${SCRIPTS_ROOT}"
cd "$REPO_ROOT"

ENV_FILE=".env"

log_step "OpenAI API Key Setup"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example "$ENV_FILE"
    log_success "Created ${ENV_FILE} from .env.example"
  else
    touch "$ENV_FILE"
    log_warn "No .env.example found; created empty ${ENV_FILE}"
  fi
fi

read -rsp "🔑 Enter your OpenAI API key: " OPENAI_API_KEY
printf '\n'

if [[ -z "$OPENAI_API_KEY" ]]; then
  log_error "No API key provided. Aborting."
  exit 1
fi

update_env_var() {
  local file=$1
  local key=$2
  local value=$3
  if grep -q "^${key}=" "$file"; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
    fi
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

update_env_var "$ENV_FILE" "OPENAI_API_KEY" "$OPENAI_API_KEY"
log_success "OPENAI_API_KEY stored in ${ENV_FILE}"

log_step "Next steps"
log_info "  • Optionally export OPENAI_API_KEY in your shell profile for CLI usage"
log_info "  • Commit is not required; keep .env local only"

log_success "OpenAI API key configured"
