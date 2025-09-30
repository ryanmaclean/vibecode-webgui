#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "==> $*"
}

error() {
  echo "Error: $*" >&2
  exit 1
}

if ! command -v kubectl >/dev/null 2>&1; then
  error "kubectl is required but not found in PATH"
fi

NAMESPACE=${CODE_SERVER_NAMESPACE:-vibecode-platform}
SELECTOR=${CODE_SERVER_SELECTOR:-app=code-server,tier=workspace}

log "Locating code-server pod in namespace '$NAMESPACE' (selector: $SELECTOR)"
POD_NAME=$(kubectl get pods \
  --namespace "$NAMESPACE" \
  --selector "$SELECTOR" \
  --output jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [[ -z "$POD_NAME" ]]; then
  error "No code-server pod found. Ensure the deployment is running before testing editors."
fi

log "Testing terminal editors inside pod '$POD_NAME'"

check_editor() {
  local editor="$1"
  local version_cmd="$2"

  if kubectl exec "$POD_NAME" -n "$NAMESPACE" -- sh -lc "command -v $editor >/dev/null 2>&1"; then
    local version_output
    version_output=$(kubectl exec "$POD_NAME" -n "$NAMESPACE" -- sh -lc "$version_cmd" 2>/dev/null | head -n 1 || true)
    if [[ -z "$version_output" ]]; then
      echo "✅ $editor installed"
    else
      echo "✅ $editor installed — $version_output"
    fi
  else
    echo "❌ $editor not found"
    return 1
  fi
}

missing=0

check_editor "vim" "vim --version" || missing=1
check_editor "nvim" "nvim --version" || missing=1
check_editor "emacs" "emacs --version" || missing=1

if [[ $missing -eq 0 ]]; then
  log "All editors verified."
else
  error "One or more editors missing."
fi
