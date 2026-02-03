#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

log() { echo "[disk-prune] $*"; }

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    log "docker system prune"
    docker system prune -af --volumes || true
    docker image prune -af || true
  else
    log "docker not running"
  fi
else
  log "docker not installed"
fi

if command -v kubectl >/dev/null 2>&1; then
  ctx=$(kubectl config current-context 2>/dev/null || true)
  if [[ "$ctx" == kind-* ]]; then
    log "kubectl cleanup for context $ctx"
    kubectl delete pods --all-namespaces --field-selector=status.phase=Succeeded >/dev/null 2>&1 || true
    kubectl delete pods --all-namespaces --field-selector=status.phase=Failed >/dev/null 2>&1 || true
  fi
fi
