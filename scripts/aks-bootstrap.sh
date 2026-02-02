#!/usr/bin/env bash
set -euo pipefail

# Deprecated AKS bootstrap wrapper.
# This script now delegates to scripts/deploy_aks.py so infrastructure logic
# lives in a single, testable implementation.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/datadog-logging.sh" 2>/dev/null || true
PYTHON=${PYTHON:-python3}

ENVIRONMENT=${ENVIRONMENT:-dev}
RESOURCE_GROUP=${RESOURCE_GROUP:-vibecode-rg}
CLUSTER_NAME=${CLUSTER_NAME:-vibecode-aks}
PROJECT_NAME=${PROJECT_NAME:-vibecode}
LOCATION=${LOCATION:-East US 2}

cat <<'MSG'
[aks-bootstrap] NOTICE: this script is deprecated.
Please migrate any automation to use scripts/deploy_aks.py directly.
Proceeding by invoking the shared deployment manager...
MSG

set -x
"$PYTHON" "$SCRIPT_DIR/deploy_aks.py" \
  --environment "$ENVIRONMENT" \
  --resource-group "$RESOURCE_GROUP" \
  --cluster-name "$CLUSTER_NAME" \
  --project-name "$PROJECT_NAME" \
  --location "$LOCATION" \
  "$@"
set +x
