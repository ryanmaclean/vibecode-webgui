#!/usr/bin/env bash
set -euo pipefail

# Extracts the Kind Postgres connection string from the bitnami/postgresql release
# and exports it as TEST_POSTGRES_CONNECTION_STRING for integration tests.
# Usage: ./scripts/kind-export-postgres-url.sh [namespace] [release]

NAMESPACE=${1:-vibecode}
RELEASE=${2:-vibecode-postgres}
SECRET_NAME="${RELEASE}-postgresql"
DATABASE=${DATABASE:-vibecode}
USERNAME=${USERNAME:-postgres}
PORT=${PORT:-5432}
SERVICE_FQDN="${SECRET_NAME}.${NAMESPACE}.svc.cluster.local"

password_b64=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data.postgres-password}' 2>/dev/null || true)
if [[ -z "$password_b64" ]]; then
  echo "❌ Unable to locate secret $SECRET_NAME in namespace $NAMESPACE" >&2
  exit 1
fi

PASSWORD=$(printf "%s" "$password_b64" | base64 --decode)
CONNECTION="postgresql://${USERNAME}:${PASSWORD}@${SERVICE_FQDN}:${PORT}/${DATABASE}"

echo "export TEST_POSTGRES_CONNECTION_STRING=\"$CONNECTION\""
