#!/usr/bin/env bash
# Validate liveness/readiness probes for VibeCode pods.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="${SCRIPTS_ROOT}"
cd "$REPO_ROOT"

NAMESPACE=${NAMESPACE:-"vibecode-platform"}
APP_LABEL=${APP_LABEL:-"app=vibecode-app"}
LOCAL_PORT=${LOCAL_PORT:-8080}
TIMEOUT=${TIMEOUT:-5}
VERBOSE=${VERBOSE:-true}

LIVENESS_PROBE="/api/healthz"
READINESS_PROBE="/api/readyz"
HEALTH_CHECK="/api/health"

show_help() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --namespace <namespace>   Kubernetes namespace (default: ${NAMESPACE})
  --app-label <label>       Pod selector label (default: ${APP_LABEL})
  --port <number>           Local port for port-forward (default: ${LOCAL_PORT})
  --timeout <seconds>       Timeout in seconds (default: ${TIMEOUT})
  --quiet                   Suppress detailed output
  --help                    Show this message and exit
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="$2"; shift 2 ;;
    --app-label)
      APP_LABEL="$2"; shift 2 ;;
    --port)
      LOCAL_PORT="$2"; shift 2 ;;
    --timeout)
      TIMEOUT="$2"; shift 2 ;;
    --quiet)
      VERBOSE=false; shift ;;
    --help)
      show_help; exit 0 ;;
    *)
      log_error "Unknown option: $1"; show_help; exit 1 ;;
  esac
done

log_step "VibeCode Kubernetes Health Probe Testing"
log_info "Namespace: ${NAMESPACE}"
log_info "App Label: ${APP_LABEL}"
log_info "Local Port: ${LOCAL_PORT}"
log_info "Timeout: ${TIMEOUT}s"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command '$1' not available."
    exit 1
  fi
}

require_cmd kubectl
require_cmd curl

if ! kubectl cluster-info >/dev/null 2>&1; then
  log_error "Cannot connect to Kubernetes cluster. Check kubeconfig/context."
  exit 1
fi

if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  log_error "Namespace '${NAMESPACE}' does not exist."
  exit 1
fi

PODS=$(kubectl get pods -n "$NAMESPACE" -l "$APP_LABEL" -o name)
if [[ -z "$PODS" ]]; then
  log_error "No pods found with label '${APP_LABEL}' in namespace '${NAMESPACE}'."
  exit 1
fi

log_info "Found pods:"
printf '%s\n' "$PODS" | sed 's/^/  • /'

PORT_FORWARD_PID=""
# shellcheck disable=SC2329
cleanup() {
  if [[ -n "$PORT_FORWARD_PID" ]]; then
    kill "$PORT_FORWARD_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

FIRST_POD=$(printf '%s\n' "$PODS" | head -n 1)
log_info "Port-forwarding ${FIRST_POD} to localhost:${LOCAL_PORT}"
(kubectl port-forward -n "$NAMESPACE" "$FIRST_POD" "${LOCAL_PORT}:3000" >/dev/null 2>&1) &
PORT_FORWARD_PID=$!
sleep 3

run_endpoint() {
  local endpoint=$1
  local name=$2
  local url="http://localhost:${LOCAL_PORT}${endpoint}"
  local response
  local status_code
  local start
  local end

  log_info "Testing ${name}: ${endpoint}"
  start=$(date +%s%3N)
  response=$(curl -s -o - -w "%{http_code}" -m "$TIMEOUT" "$url" 2>/dev/null || echo "000")
  status_code=${response: -3}
  body=${response:0:${#response}-3}
  end=$(date +%s%3N)
  duration=$((end - start))

  if [[ $status_code =~ ^2[0-9][0-9]$ ]]; then
    log_success "${name} OK (${status_code}) - ${duration}ms"
    if [[ "$VERBOSE" == true && -n "$body" ]]; then
      log_info "Response: ${body}"
    fi
    if echo "$body" | grep -qi 'unhealthy'; then
      log_warn "${name} response indicated unhealthy state"
      return 1
    fi
    return 0
  else
    log_error "${name} failed (${status_code}) - ${duration}ms"
    if [[ "$VERBOSE" == true && -n "$body" ]]; then
      log_info "Response: ${body}"
    fi
    return 1
  fi
}

RESULT=0
run_endpoint "$LIVENESS_PROBE" "Liveness" || RESULT=1
run_endpoint "$READINESS_PROBE" "Readiness" || RESULT=1
run_endpoint "$HEALTH_CHECK" "Health" || RESULT=1

if [[ "$RESULT" -eq 0 ]]; then
  log_success "All health probes are responding correctly."
else
  log_warn "One or more probes reported failures."
fi

exit "$RESULT"
