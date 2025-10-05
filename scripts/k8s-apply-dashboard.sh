#!/usr/bin/env bash
set -euo pipefail

# Apply a DatadogDashboard CR only if the CRD is present
# Usage:
#   scripts/k8s-apply-dashboard.sh -f /path/to/dashboard.yaml
#
# Notes:
# - This script does not print or read any Datadog credentials.
# - It only uses the Kubernetes API to apply the CR if supported by the cluster.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}✅${NC} $*"; }
warn() { echo -e "${YELLOW}⚠️ ${NC}$*"; }
fail() { echo -e "${RED}❌${NC} $*"; exit 1; }

DASHBOARD_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--file)
      DASHBOARD_FILE="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 -f /path/to/dashboard.yaml"; exit 0;;
    *)
      echo "Unknown argument: $1"; exit 1;;
  esac
done

if [[ -z "${DASHBOARD_FILE}" ]]; then
  fail "Missing -f / --file argument"
fi

if ! command -v kubectl >/dev/null 2>&1; then
  fail "kubectl is not installed or not in PATH"
fi

if [[ ! -f "${DASHBOARD_FILE}" ]]; then
  fail "File not found: ${DASHBOARD_FILE}"
fi

log "Checking for DatadogDashboard CRD..."
if ! kubectl get crd datadogdashboards.datadoghq.com >/dev/null 2>&1; then
  warn "DatadogDashboard CRD not found (datadogdashboards.datadoghq.com)."
  echo "Install the Datadog Operator to enable Dashboard CRs, e.g.:"
  echo "  helm repo add datadog https://helm.datadoghq.com && helm repo update"
  echo "  helm upgrade --install datadog-operator datadog/datadog-operator -n datadog --create-namespace"
  exit 2
fi

log "Applying DatadogDashboard: ${DASHBOARD_FILE}"
kubectl apply -f "${DASHBOARD_FILE}"
success "DatadogDashboard applied."

# Try to display status if name is easily extractable (best-effort)
NAME=$(grep -E '^\s*name:' "${DASHBOARD_FILE}" | head -n1 | awk '{print $2}' || true)
if [[ -n "${NAME}" ]]; then
  log "Current CR state for: ${NAME}"
  kubectl get datadogdashboard "${NAME}" -o yaml || true
fi
