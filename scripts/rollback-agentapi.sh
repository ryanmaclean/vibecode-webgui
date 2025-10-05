#!/usr/bin/env bash

# AgentAPI Rollback Script
# Usage: ./scripts/rollback-agentapi.sh [environment] [revision]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT="${1:-dev}"
REVISION="${2:-0}"  # 0 means previous revision
NAMESPACE="vibecode-${ENVIRONMENT}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        exit 1
    fi

    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE not found"
        exit 1
    fi
}

show_rollout_history() {
    log_info "Showing rollout history for code-server-workspace in $NAMESPACE:"
    kubectl rollout history deployment/code-server-workspace -n "$NAMESPACE"
}

get_current_revision() {
    kubectl get deployment code-server-workspace -n "$NAMESPACE" \
        -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}'
}

rollback_to_revision() {
    local target_revision="$1"

    log_warn "Rolling back to revision $target_revision in $ENVIRONMENT environment"
    log_warn "Current revision: $(get_current_revision)"

    read -p "Are you sure you want to rollback? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi

    if [ "$target_revision" = "0" ]; then
        log_info "Rolling back to previous revision..."
        kubectl rollout undo deployment/code-server-workspace -n "$NAMESPACE"
    else
        log_info "Rolling back to specific revision: $target_revision"
        kubectl rollout undo deployment/code-server-workspace \
            --to-revision="$target_revision" -n "$NAMESPACE"
    fi

    # Wait for rollback to complete
    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/code-server-workspace -n "$NAMESPACE" --timeout=5m

    log_info "Rollback completed successfully"
}

verify_rollback() {
    log_info "Verifying rollback..."

    # Check pod status
    kubectl get pods -n "$NAMESPACE" -l app=code-server

    # Test health endpoint
    POD_NAME=$(kubectl get pod -n "$NAMESPACE" -l app=code-server -o jsonpath='{.items[0].metadata.name}')

    log_info "Testing health endpoint on pod: $POD_NAME"
    if kubectl exec -n "$NAMESPACE" "$POD_NAME" -c agentapi -- \
        curl -f -s http://127.0.0.1:3284/health > /dev/null; then
        log_info "Health check passed"
    else
        log_error "Health check failed after rollback"
        exit 1
    fi

    log_info "Rollback verification complete"
}

main() {
    log_info "AgentAPI Rollback Script"
    log_info "Environment: $ENVIRONMENT"

    check_prerequisites
    show_rollout_history

    rollback_to_revision "$REVISION"
    verify_rollback

    log_info "Rollback completed and verified!"
}

main "$@"
