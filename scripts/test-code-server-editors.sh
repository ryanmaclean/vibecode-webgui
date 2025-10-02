#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "==> $*"
}

sanitize_message() {
  local sanitized="$1"
  sanitized=${sanitized//$'
'/ }
  sanitized=${sanitized//password=[^[:space:]]*/password=***}
  sanitized=${sanitized//token=[^[:space:]]*/token=***}
  sanitized=${sanitized//key=[^[:space:]]*/key=***}
  printf '%s' "$sanitized"
}

emit_status() {
  local tool="$1"
  local status="$2"
  local duration_ms="$3"
  local message
  message=$(sanitize_message "$4")
  printf 'tool=%s status=%s duration_ms=%s message="%s"
' "$tool" "$status" "$duration_ms" "$message"
}

error() {
  local sanitized
  sanitized=$(sanitize_message "$*")
  echo "$sanitized" >&2
  exit 1
}

now_ms() {
  if command -v gdate >/dev/null 2>&1; then
    gdate +%s%3N
    return
  fi
  local raw
  raw=$(date +%s%3N 2>/dev/null || true)
  if [[ $raw == *N ]]; then
    python3 - <<'PYTIME'
import time
print(int(time.time() * 1000))
PYTIME
  else
    printf '%s
' "$raw"
  fi
}

timeout_candidates=()
if [[ -n ${TIMEOUT_BIN:-} ]]; then
  timeout_candidates+=("${TIMEOUT_BIN}")
fi
timeout_candidates+=(timeout gtimeout)
TIMEOUT_BIN=""
for candidate in "${timeout_candidates[@]}"; do
  if command -v "$candidate" >/dev/null 2>&1; then
    TIMEOUT_BIN="$candidate"
    break
  fi
done

HAS_TIMEOUT=0
if [[ -n "$TIMEOUT_BIN" ]]; then
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
MAX_POD_ATTEMPTS=${MAX_POD_ATTEMPTS:-5}

log "Locating Ready code-server pods in namespace '$NAMESPACE' (selector: $SELECTOR)"

kubectl_wait_ready() {
  local err_file rc
  err_file=$(mktemp)
  local args=(wait --namespace "$NAMESPACE" --selector "$SELECTOR" --for=condition=Ready pod --timeout="$WAIT_TIMEOUT" --request-timeout="$REQUEST_TIMEOUT")
  if [[ $HAS_TIMEOUT -eq 1 ]]; then
    set +e
    "$TIMEOUT_BIN" "$WAIT_TIMEOUT" kubectl "${args[@]}" >/dev/null 2>"$err_file"
    rc=$?
    set -e
  else
    set +e
    kubectl "${args[@]}" >/dev/null 2>"$err_file"
    rc=$?
    set -e
  fi
  if [[ $rc -ne 0 ]]; then
    local err
    err=$(sanitize_message "$(<"$err_file")")
    rm -f "$err_file"
    error "kubectl wait failed (rc=$rc): ${err:-<none>}"
  fi
  rm -f "$err_file"
}

declare -a READY_PODS=()
current_pod_index=0
LAST_KUBECTL_ERROR=""

mask_pod_name() {
  local name="$1"
  local length=${#name}
  if (( length <= 4 )); then
    printf '***'
    return
  fi
  local head=${name:0:4}
  local tail=${name: -3}
  printf '%s***%s' "$head" "$tail"
}

masked_ready_list() {
  local result=""
  local pod masked
  for pod in "${READY_PODS[@]}"; do
    masked=$(mask_pod_name "$pod")
    if [[ -n "$result" ]]; then
      result="$result $masked"
    else
      result="$masked"
    fi
  done
  printf '%s' "$result"
}

populate_ready_pods() {
  local jsonpath="$1"
  local err_file out_file rc line idx
  READY_PODS=()
  LAST_KUBECTL_ERROR=""
  err_file=$(mktemp)
  out_file=$(mktemp)
  kubectl get pods     --namespace "$NAMESPACE"     --selector "$SELECTOR"     --field-selector=status.phase=Running     --output "jsonpath=${jsonpath}"     --request-timeout="$REQUEST_TIMEOUT"     >"$out_file" 2>"$err_file"
  rc=$?
  if [[ $rc -ne 0 ]]; then
    LAST_KUBECTL_ERROR=$(sanitize_message "$(<"$err_file")")
    rm -f "$err_file" "$out_file"
    return $rc
  fi
  idx=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ -n "$line" ]]; then
      READY_PODS[$idx]="$line"
      idx=$((idx + 1))
    fi
  done <"$out_file"
  rm -f "$err_file" "$out_file"
  return 0
}

refresh_ready_pods() {
  kubectl_wait_ready
  if ! populate_ready_pods '{range .items[?(@.status.conditions[?(@.type=="Ready" && @.status=="True")])]}{.metadata.name}{"
"}{end}'; then
    if ! populate_ready_pods '{range .items[*]}{.metadata.name}{"
"}{end}'; then
      error "kubectl get pods failed: ${LAST_KUBECTL_ERROR:-unknown error}"
    fi
  fi
  if [[ ${#READY_PODS[@]} -eq 0 ]]; then
    if ! populate_ready_pods '{range .items[*]}{.metadata.name}{"
"}{end}'; then
      error "kubectl get pods failed: ${LAST_KUBECTL_ERROR:-unknown error}"
    fi
  fi
  current_pod_index=0
  if [[ ${#READY_PODS[@]} -eq 0 ]]; then
    error "No Ready pods found for selector '$SELECTOR' in namespace '$NAMESPACE'."
  fi
  log "Tracking ${#READY_PODS[@]} Ready pod(s): $(masked_ready_list)"
}

choose_next_pod() {
  local total=${#READY_PODS[@]}
  if (( total == 0 )); then
    error "Ready pod list empty while selecting pod"
  fi
  local idx=$(( current_pod_index % total ))
  local pod="${READY_PODS[$idx]}"
  current_pod_index=$(( current_pod_index + 1 ))
  printf '%s' "$pod"
}

EXEC_STDOUT=""
EXEC_STDERR=""

run_pod_cmd() {
  local pod="$1"
  local command="$2"
  local out_file err_file rc
  out_file=$(mktemp)
  err_file=$(mktemp)
  if [[ $HAS_TIMEOUT -eq 1 ]]; then
    set +e
    "$TIMEOUT_BIN" "$EXEC_TIMEOUT" kubectl exec "$pod" -n "$NAMESPACE" --request-timeout="$REQUEST_TIMEOUT" -- sh -lc "$command" >"$out_file" 2>"$err_file"
    rc=$?
    set -e
  else
    set +e
    kubectl exec "$pod" -n "$NAMESPACE" --request-timeout="$REQUEST_TIMEOUT" -- sh -lc "$command" >"$out_file" 2>"$err_file"
    rc=$?
    set -e
  fi
  EXEC_STDOUT=$(<"$out_file")
  EXEC_STDERR=$(<"$err_file")
  rm -f "$out_file" "$err_file"
  return $rc
}

refresh_ready_pods

check_tool() {
  local label="$1"
  local detect_cmd="$2"
  local version_cmd="$3"
  local overall_rc=1
  local message=""
  local attempt=1

  while (( attempt <= MAX_POD_ATTEMPTS )); do
    if (( ${#READY_PODS[@]} == 0 )); then
      refresh_ready_pods
    fi
    if (( ${#READY_PODS[@]} == 0 )); then
      message="no Ready pods available"
      break
    fi
    local pod masked start_ms end_ms rc shell_output
    pod=$(choose_next_pod)
    masked=$(mask_pod_name "$pod")
    start_ms=$(now_ms)
    if run_pod_cmd "$pod" "$detect_cmd"; then
      shell_output=""
      if run_pod_cmd "$pod" "$version_cmd"; then
        shell_output=$(printf '%s' "$EXEC_STDOUT" | head -n 1)
      else
        shell_output="version command failed: $(sanitize_message "$EXEC_STDERR")"
      fi
      end_ms=$(now_ms)
      shell_output=${shell_output//$'
'/ }
      echo "✅ $label available — ${shell_output:-available} (pod=${masked})"
      emit_status "$label" "ok" "$(( end_ms - start_ms ))" "pod=${masked}"
      overall_rc=0
      break
    fi
    rc=$?
    end_ms=$(now_ms)
    if [[ $rc -eq 124 ]]; then
      message="timeout after $EXEC_TIMEOUT (pod=${masked})"
    elif [[ $rc -eq 137 ]]; then
      message="command terminated (pod=${masked})"
    elif [[ $rc -eq 127 ]]; then
      message="missing ($label) (pod=${masked})"
      emit_status "$label" "missing" "$(( end_ms - start_ms ))" "$message"
      echo "❌ $label missing"
      return 1
    elif [[ $rc -eq 126 ]]; then
      message="permission denied or binary not executable (pod=${masked})"
    else
      local stderr_clean
      stderr_clean=$(sanitize_message "$EXEC_STDERR")
      if [[ -n "$stderr_clean" ]]; then
        message="kubectl exec failed (rc=$rc) pod=${masked} stderr=${stderr_clean}"
      else
        message="kubectl exec failed (rc=$rc) pod=${masked}"
      fi
    fi
    emit_status "$label" "retry" "$(( end_ms - start_ms ))" "$message"
    refresh_ready_pods
    attempt=$(( attempt + 1 ))
  done

  if [[ $overall_rc -ne 0 ]]; then
    local clean_message
    clean_message=$(sanitize_message "$message")
    echo "❌ $label check failed — ${clean_message:-unknown error}"
    return 1
  fi
}

missing=0

check_tool "vim" "command -v vim >/dev/null 2>&1" "vim --version" || missing=1
check_tool "nvim" "command -v nvim >/dev/null 2>&1" "nvim --version" || missing=1
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
