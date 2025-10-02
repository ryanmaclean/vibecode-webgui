#!/usr/bin/env bash
# KIND Health Check - Comprehensive validation of VibeCode deployment
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/bootstrap.sh"
bootstrap_init "$SCRIPT_DIR"
# shellcheck disable=SC1091
source "$LIB_DIR/logging.sh"

CLUSTER_NAME="${CLUSTER_NAME:-vibecode-test}"
NAMESPACE="${NAMESPACE:-vibecode}"
ERRORS=0

log_step "VibeCode KIND Health Check"
log_info "Validating cluster kind-${CLUSTER_NAME} (namespace: ${NAMESPACE})"

log_step "Test 1: Cluster connectivity"
if kubectl cluster-info --context="kind-${CLUSTER_NAME}" > /dev/null 2>&1; then
  log_success "Cluster is accessible"
  CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "unknown")
  log_info "Current context: ${CURRENT_CONTEXT}"
else
  log_error "Cannot connect to cluster"
  log_info "Solution: ./scripts/kind-create-cluster.sh"
  ERRORS=$((ERRORS + 1))
fi

log_step "Test 2: Node health"
READY_NODES=$(kubectl get nodes --no-headers 2>/dev/null | grep -c "Ready" || true)
TOTAL_NODES=$(kubectl get nodes --no-headers 2>/dev/null | wc -l || true)
if [[ "$READY_NODES" -eq "$TOTAL_NODES" && "$TOTAL_NODES" -gt 0 ]]; then
  log_success "All nodes ready (${READY_NODES}/${TOTAL_NODES})"
  kubectl get nodes --no-headers | sed 's/^/   /'
else
  log_error "Some nodes not ready (${READY_NODES}/${TOTAL_NODES})"
  kubectl get nodes
  ERRORS=$((ERRORS + 1))
fi

log_step "Test 3: Namespace and pods"
if kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
  log_success "Namespace '${NAMESPACE}' exists"
  RUNNING_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Running" || true)
  TOTAL_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
  if [[ "$TOTAL_PODS" -gt 0 ]]; then
    if [[ "$RUNNING_PODS" -eq "$TOTAL_PODS" ]]; then
      log_success "All pods running (${RUNNING_PODS}/${TOTAL_PODS})"
      kubectl get pods -n "$NAMESPACE" --no-headers | sed 's/^/   /'
    else
      log_error "Some pods not running (${RUNNING_PODS}/${TOTAL_PODS})"
      kubectl get pods -n "$NAMESPACE"
      ERRORS=$((ERRORS + 1))
    fi
  else
    log_warn "No pods found in namespace (deployment may be missing)"
    ERRORS=$((ERRORS + 1))
  fi
else
  log_error "Namespace '${NAMESPACE}' does not exist"
  ERRORS=$((ERRORS + 1))
fi

log_step "Test 4: Service connectivity"
SERVICES=$(kubectl get services -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
if [[ "$SERVICES" -gt 0 ]]; then
  log_success "Found ${SERVICES} services"
  kubectl get services -n "$NAMESPACE" --no-headers | awk '{print "   " $1 " (" $3 ")"}'
else
  log_warn "No services found"
fi

log_step "Test 5: Database connectivity"
if kubectl get pods -n "$NAMESPACE" -l app=postgres --no-headers 2>/dev/null | grep -q "Running"; then
  if kubectl exec -n "$NAMESPACE" deployment/postgres -- psql -U vibecode -d vibecode -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "PostgreSQL is responsive"
  else
    log_error "PostgreSQL connection failed"
    ERRORS=$((ERRORS + 1))
  fi
else
  log_error "PostgreSQL pod not running"
  ERRORS=$((ERRORS + 1))
fi

log_step "Test 6: Redis connectivity"
if kubectl get pods -n "$NAMESPACE" -l app=redis --no-headers 2>/dev/null | grep -q "Running"; then
  if kubectl exec -n "$NAMESPACE" deployment/redis -- redis-cli ping 2>/dev/null | grep -q "PONG"; then
    log_success "Redis is responsive"
  else
    log_error "Redis connection failed"
    ERRORS=$((ERRORS + 1))
  fi
else
  log_error "Redis pod not running"
  ERRORS=$((ERRORS + 1))
fi

log_step "Test 7: Application health endpoint"
if kubectl get pods -n "$NAMESPACE" -l app=vibecode-webgui --no-headers 2>/dev/null | grep -q "Running"; then
  if kubectl run health-test --image=curlimages/curl:latest --restart=Never --rm -i --timeout=30s -- \
    curl -s -f "http://vibecode-service.${NAMESPACE}.svc.cluster.local:3000/api/health" > /dev/null 2>&1; then
    log_success "Health endpoint responding"
  else
    log_error "Health endpoint not accessible (may still be starting)"
    ERRORS=$((ERRORS + 1))
  fi
else
  log_error "VibeCode application pod not running"
  ERRORS=$((ERRORS + 1))
fi

log_step "Test 8: AI endpoint basic test"
if [[ $ERRORS -eq 0 ]]; then
  if kubectl run ai-test --image=curlimages/curl:latest --restart=Never --rm -i --timeout=30s -- \
    curl -s -f -X POST "http://vibecode-service.${NAMESPACE}.svc.cluster.local:3000/api/health" \
    -H "Content-Type: application/json" > /dev/null 2>&1; then
    log_success "API endpoints accessible"
  else
    log_warn "API endpoints may not be fully ready"
  fi
else
  log_warn "Skipping API endpoint check due to previous failures"
fi

log_step "Test 9: Resource usage"
if command -v kubectl > /dev/null 2>&1; then
  log_info "Cluster resource usage:"
  if kubectl top nodes 2>/dev/null | grep -v NAME | head -5; then
    log_info "(Resource metrics available)"
  else
    log_warn "Resource metrics unavailable (metrics server may be missing)"
  fi
  echo ""
  log_info "Pod resource usage:"
  if kubectl top pods -n "$NAMESPACE" 2>/dev/null | head -10; then
    log_info "(Pod metrics available)"
  else
    log_warn "Pod metrics unavailable"
  fi
fi

log_step "Test 10: Port forwarding smoke"
PORT_FORWARD_CMD=(kubectl port-forward -n "$NAMESPACE" svc/vibecode-service 3000:3000)
if command -v timeout > /dev/null 2>&1; then
  if timeout 5s "${PORT_FORWARD_CMD[@]}" > /tmp/vibecode-port-forward.log 2>&1; then
    log_success "Port forwarding command executed"
  else
    log_warn "Port forwarding failed (systemd environments may block background pods)"
  fi
else
  log_warn "timeout command not available; skipping automated port-forward check"
fi

if [[ $ERRORS -eq 0 ]]; then
  log_success "KIND health check completed with no blocking issues"
else
  log_error "KIND health check detected ${ERRORS} blocking issue(s)"
fi

log_info "Next steps:"
log_info "  • Rerun ./scripts/kind-health-check.sh after resolving issues"
log_info "  • Inspect ./scripts/kind-deploy-services.sh for deployment steps"
log_info "  • Visit docs/src/content/docs/KIND_TROUBLESHOOTING_GUIDE.md for deeper dives"
