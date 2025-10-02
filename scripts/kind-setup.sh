#!/usr/bin/env bash
# VibeCode KIND Setup - One command to rule them all
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/bootstrap.sh"
bootstrap_init "$SCRIPT_DIR"
# shellcheck disable=SC1091
source "$LIB_DIR/logging.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/kind.sh"

CLUSTER_NAME="${CLUSTER_NAME:-vibecode-test}"

log_step "VibeCode KIND Setup - Automated"
log_info "Creating a complete local Kubernetes development environment"

kind_set_scripts_dir "$SCRIPT_DIR"

if ! kind_run_step "Step 1: Environment check" "kind-env-check.sh"; then
  log_error "Environment check failed. Resolve the issues above and re-run."
  log_info "Docker issues? Try ./scripts/docker-doctor.sh"
  exit 1
fi

kind_run_step "Step 2: Cleanup previous installations" "kind-cleanup.sh" "optional"

if ! kind_run_step "Step 3: Create KIND cluster" "kind-create-cluster.sh"; then
  log_error "Cluster creation failed"
  exit 1
fi

if ! kind_run_step "Step 4: Deploy VibeCode services" "kind-deploy-services.sh"; then
  log_error "Service deployment failed"
  exit 1
fi

if ! kind_run_step "Step 5: Final health check" "kind-health-check.sh"; then
  log_warn "Health check detected issues. Re-run ./scripts/kind-health-check.sh after a few minutes."
fi

log_success "VibeCode KIND environment is ready"

log_info "Cluster name: $CLUSTER_NAME"
log_info "Context: kind-$CLUSTER_NAME"
log_info "Namespace: vibecode"

log_info "Next steps:"
log_info "  • Check status: kubectl get pods -n vibecode"
log_info "  • Access app: kubectl port-forward -n vibecode svc/vibecode-service 3000:3000"
log_info "  • View logs: kubectl logs -f deployment/vibecode-webgui -n vibecode"
log_info "  • Health check: ./scripts/kind-health-check.sh"

log_info "What to test next:"
log_info "  1. AI Chat — exercise enhanced AI features"
log_info "  2. RAG Search — upload files and test semantic search"
log_info "  3. Console Mode — try VS Code in the browser"
log_info "  4. Project Generation — scaffold a project with AI"
log_info "  5. Agent Framework — validate multi-agent flows"

log_info "If issues appear:"
log_info "  • Check logs: kubectl logs -l app=vibecode-webgui -n vibecode"
log_info "  • Restart pods: kubectl rollout restart deployment/vibecode-webgui -n vibecode"
log_info "  • Full reset: kind delete cluster --name=$CLUSTER_NAME && npm run kind:setup"

log_info "Docs: KIND_TROUBLESHOOTING_GUIDE.md, ENHANCED_AI_FEATURES.md, REPOSITORY_SCAN_REPORT_JULY_2025.md"
