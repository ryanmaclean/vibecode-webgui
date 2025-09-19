#!/usr/bin/env bash
set -euo pipefail

# Deprecated: PostgreSQL setup is handled by scripts/postgres_setup.py

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON=${PYTHON:-python3}

cat <<'MSG'
[aks-postgresql-setup] NOTICE: this script is deprecated.
Please invoke scripts/postgres_setup.py directly.
Proceeding by delegating to the Python helper...
MSG

# Convert bash environment variables to Python arguments
ARGS=()

if [[ -n "${NAMESPACE:-}" ]]; then
  ARGS+=(--namespace "$NAMESPACE")
fi

if [[ -n "${STORAGE_CLASS:-}" ]]; then
  ARGS+=(--storage-class "$STORAGE_CLASS")
fi

if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
  ARGS+=(--postgres-password "$POSTGRES_PASSWORD")
fi

if [[ -n "${DATADOG_PASSWORD:-}" ]]; then
  ARGS+=(--datadog-password "$DATADOG_PASSWORD")
fi

# Default to wait and verify for compatibility
ARGS+=(--wait --verify --test-connectivity)

"$PYTHON" "$SCRIPT_DIR/postgres_setup.py" "${ARGS[@]}" "$@"