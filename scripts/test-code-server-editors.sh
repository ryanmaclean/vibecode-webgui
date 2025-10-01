#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "==> $*"
}

emit_status() {
  local tool="$1"
  local status="$2"
  local duration_ms="$3"
  local message="$4"
  message=${message//$'\n'/ }
  # Redact sensitive information from logs
  message=${message//password=[^[:space:]]*/password=***}
  message=${message//token=[^[:space:]]*/token=***}
  message=${message//key=[^[:space:]]*/key=***}
  printf 'tool=%s status=%s duration_ms=%s message="%s"\n' "$tool" "$status" "$duration_ms" "$message"
}

error() {
  echo "Error: $*" >&2
  exit 1
}

now_ms() {
  date +%s%3N
}

TIMEOUT_BIN=${TIMEOUT_BIN:-timeout}
HAS_TIMEOUT=0
if command -v "$TIMEOUT_BIN" >/dev/null 2>&1; then
  HAS_TIMEOUT=1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  error "kubectl is required but not found in PATH"
fi

NAMESPACE=${CODE_SERVER_NAMESPACE:-vibecode-platform}
SELECTOR=${CODE_SERVER_SELECTOR:-app=code-server,tier=workspace}
REQUEST_TIMEOUT=${KUBE_REQUEST_TIMEOUT:-30s}
WAIT_TIMEOUT=${KUBE_WAIT_TIMEOUT:-60s}
EXEC_TIMEOUT=${EDITOR_EXEC_TIMEOUT:-45s}

log "Locating Ready code-server pods in namespace '$NAMESPACE' (selector: $SELECTOR)"

kubectl_wait_ready() {
  local args=("wait" "--namespace" "$NAMESPACE" "--selector" "$SELECTOR" "--for=condition=Ready" "pod" "--timeout=$WAIT_TIMEOUT" "--request-timeout=$REQUEST_TIMEOUT")
  if [[ $HAS_TIMEOUT -eq 1 ]]; then
    "$TIMEOUT_BIN" "$WAIT_TIMEOUT" kubectl "${args[@]}" >/dev/null 2>&1 || {
      log "Warning: kubectl wait timed out after $WAIT_TIMEOUT"
      return 1
    }
  else
    kubectl "${args[@]}" >/dev/null 2>&1 || {
      log "Warning: kubectl wait failed"
      return 1
    }
  fi
}

kubectl_wait_ready

mapfile -t READY_PODS < <(
  kubectl get pods \
    --namespace "$NAMESPACE" \
    --selector "$SELECTOR" \
    --field-selector=status.phase=Running \
    --output jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' \
    --request-timeout="$REQUEST_TIMEOUT" 2>/dev/null | awk 'NF'
)

# Additional check for pods with Ready condition
mapfile -t READY_CONDITION_PODS < <(
  kubectl get pods \
    --namespace "$NAMESPACE" \
    --selector "$SELECTOR" \
    --field-selector=status.phase=Running \
    --output jsonpath='{range .items[?(@.status.conditions[?(@.type=="Ready" && @.status=="True")])]}{.metadata.name}{"\n"}{end}' \
    --request-timeout="$REQUEST_TIMEOUT" 2>/dev/null | awk 'NF'
)

# Use Ready condition pods if available, otherwise fall back to Running pods
if [[ ${#READY_CONDITION_PODS[@]} -gt 0 ]]; then
  READY_PODS=("${READY_CONDITION_PODS[@]}")
  log "Using pods with Ready condition: ${READY_PODS[*]}"
fi

if [[ ${#READY_PODS[@]} -eq 0 ]]; then
  error "No Ready pods found for selector '$SELECTOR' in namespace '$NAMESPACE'."
fi

log "Found ${#READY_PODS[@]} Ready pod(s): ${READY_PODS[*]}"

# Tracks pod list rotation so each check can retry on alternate pods.
current_pod_index=0

run_pod_cmd() {
  local pod="$1"
  local command="$2"
  local out_file err_file
  out_file=$(mktemp)
  err_file=$(mktemp)
  local rc

  if [[ $HAS_TIMEOUT -eq 1 ]]; then
    "$TIMEOUT_BIN" "$EXEC_TIMEOUT" kubectl exec "$pod" -n "$NAMESPACE" --request-timeout="$REQUEST_TIMEOUT" -- sh -lc "$command" >"$out_file" 2>"$err_file" || rc=$?
  else
    kubectl exec "$pod" -n "$NAMESPACE" --request-timeout="$REQUEST_TIMEOUT" -- sh -lc "$command" >"$out_file" 2>"$err_file" || rc=$?
  fi

  if [[ -z ${rc+x} ]]; then
    rc=0
  fi

  EXEC_STDOUT=$(<"$out_file")
  EXEC_STDERR=$(<"$err_file")
  rm -f "$out_file" "$err_file"
  return $rc
}

choose_next_pod() {
  local pod
  pod=${READY_PODS[$((current_pod_index % ${#READY_PODS[@]}))]}
  current_pod_index=$((current_pod_index + 1))
  printf '%s' "$pod"
}

check_tool() {
  local label="$1"
  local detect_cmd="$2"
  local version_cmd="$3"
  local start_ms overall_rc=1 message=""

  start_ms=$(now_ms)

  local attempts=0
  local pod
  while [[ $attempts -lt ${#READY_PODS[@]} ]]; do
    pod=$(choose_next_pod)
    attempts=$((attempts + 1))

    if run_pod_cmd "$pod" "$detect_cmd"; then
      local version_output=""
      if run_pod_cmd "$pod" "$version_cmd"; then
        version_output=$(printf '%s' "$EXEC_STDOUT" | head -n 1)
      else
        # TODO(vibe-ops-101): consolidate version command fallback handling.
        version_output="version command failed: $EXEC_STDERR"
      fi
      local end_ms shell_output
      end_ms=$(now_ms)
      shell_output=${version_output:-"available"}
      shell_output=${shell_output//$'\n'/ }
      echo "✅ $label available — $shell_output"
      emit_status "$label" "ok" "$((end_ms - start_ms))" "pod=$pod"
      overall_rc=0
      break
    fi

    local rc=$?
    local end_ms
    end_ms=$(now_ms)

    if [[ $rc -eq 124 ]]; then
      message="timeout after $EXEC_TIMEOUT (pod=$pod)"
    elif [[ $rc -eq 137 ]]; then
      message="command terminated (pod=$pod)"
    elif [[ $rc -eq 127 ]]; then
      message="missing ($label) (pod=$pod)"
      emit_status "$label" "missing" "$((end_ms - start_ms))" "$message"
      echo "❌ $label missing"
      return 1
    elif [[ $rc -eq 126 ]]; then
      message="permission denied or binary not executable (pod=$pod)"
    elif [[ $rc -eq 1 ]]; then
      # Check if it's a transport/RBAC failure vs missing tool
      if [[ "$EXEC_STDERR" == *"transport"* ]] || [[ "$EXEC_STDERR" == *"rbac"* ]] || [[ "$EXEC_STDERR" == *"forbidden"* ]]; then
        message="transport/RBAC failure (rc=$rc) pod=$pod stderr=${EXEC_STDERR:-<none>}"
      else
        message="tool execution failed (rc=$rc) pod=$pod stderr=${EXEC_STDERR:-<none>}"
      fi
    else
      message="kubectl exec failed (rc=$rc) pod=$pod stderr=${EXEC_STDERR:-<none>}"
    fi

    emit_status "$label" "retry" "$((end_ms - start_ms))" "$message"
  done

  if [[ $overall_rc -ne 0 ]]; then
    local clean_message
    clean_message=${message//$'\n'/ }
    echo "❌ $label check failed — $clean_message"
    return 1
  fi
}

missing=0

check_tool "vim" "command -v vim >/dev/null 2>&1" "vim --version" || missing=1
check_tool "nvim" "command -v nvim >/dev/null 2>&1" "nvim --version" || missing=1
check_tool "emacs" "command -v emacs >/dev/null 2>&1" "emacs --version" || missing=1
check_tool "aider" "command -v aider >/dev/null 2>&1" "aider --version || aider --help" || missing=1
check_tool "goose" "command -v goose >/dev/null 2>&1" "goose --version || goose --help" || missing=1
check_tool "kubectl" "command -v kubectl >/dev/null 2>&1" "kubectl version --client --short" || missing=1
check_tool "helm" "command -v helm >/dev/null 2>&1" "helm version --short || helm version" || missing=1
check_tool "kubectx" "command -v kubectx >/dev/null 2>&1" "kubectx --help" || missing=1
check_tool "kubens" "command -v kubens >/dev/null 2>&1" "kubens --help" || missing=1

if [[ $missing -eq 0 ]]; then
  log "All tools verified."
else
  error "One or more required tools missing or checks failed."
fi
