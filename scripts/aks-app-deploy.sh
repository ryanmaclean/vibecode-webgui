#!/usr/bin/env bash
set -euo pipefail

# Deprecated: Application deployment is handled by scripts/app_deploy.py

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/datadog-logging.sh" 2>/dev/null || true
PYTHON=${PYTHON:-python3}

cat <<'MSG'
[aks-app-deploy] NOTICE: this script is deprecated.
Please invoke scripts/app_deploy.py directly.
Proceeding by delegating to the Python helper...
MSG

# Convert bash environment variables to Python arguments
ARGS=()

if [[ -n "${NAMESPACE:-}" ]]; then
  ARGS+=(--namespace "$NAMESPACE")
fi

if [[ -n "${ACR_NAME:-}" ]]; then
  ARGS+=(--acr-name "$ACR_NAME")
else
  echo "ERROR: ACR_NAME environment variable is required" >&2
  exit 1
fi

if [[ -n "${IMAGE_TAG:-}" ]]; then
  ARGS+=(--image-tag "$IMAGE_TAG")
fi

if [[ -n "${LOCATION:-}" ]]; then
  ARGS+=(--location "$LOCATION")
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  ARGS+=(--database-url "$DATABASE_URL")
fi

if [[ -n "${NEXTAUTH_SECRET:-}" ]]; then
  ARGS+=(--nextauth-secret "$NEXTAUTH_SECRET")
fi

if [[ -n "${NODE_ENV:-}" ]]; then
  ARGS+=(--node-env "$NODE_ENV")
fi

if [[ -n "${DD_API_KEY:-}" ]]; then
  ARGS+=(--dd-api-key "$DD_API_KEY")
fi

if [[ -n "${DD_APP_KEY:-}" ]]; then
  ARGS+=(--dd-app-key "$DD_APP_KEY")
fi

if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  ARGS+=(--openrouter-api-key "$OPENROUTER_API_KEY")
fi

if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
  ARGS+=(--postgres-password "$POSTGRES_PASSWORD")
fi

# Default to wait for compatibility
ARGS+=(--wait)

"$PYTHON" "$SCRIPT_DIR/app_deploy.py" "${ARGS[@]}" "$@"