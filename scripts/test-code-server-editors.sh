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

check_tool() {
  local label="$1"
  local detect_cmd="$2"
  local version_cmd="$3"

  if kubectl exec "$POD_NAME" -n "$NAMESPACE" -- sh -lc "$detect_cmd"; then
    local version_output
    version_output=$(kubectl exec "$POD_NAME" -n "$NAMESPACE" -- sh -lc "$version_cmd" 2>/dev/null | head -n 1 || true)
    if [[ -z "$version_output" ]]; then
      echo "✅ $label available"
    else
      echo "✅ $label available — $version_output"
    fi
  else
    echo "❌ $label missing"
    return 1
  fi
}

missing=0

check_tool "vim" "command -v vim >/dev/null 2>&1" "vim --version" || missing=1
check_tool "nvim" "command -v nvim >/dev/null 2>&1" "nvim --version" || missing=1
check_tool "emacs" "command -v emacs >/dev/null 2>&1" "emacs --version" || missing=1
check_tool "aider" "command -v aider >/dev/null 2>&1" "aider --version || aider --help" || missing=1
check_tool "goose" "command -v goose >/dev/null 2>&1" "goose --version || goose --help" || missing=1

if [[ $missing -eq 0 ]]; then
  log "All tools verified."
else
  error "One or more required tools missing."
fi
