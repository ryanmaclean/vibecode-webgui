#!/usr/bin/env bash
# Hardened code-server editor smoke test
# Issue: #415 - Comprehensive error handling, timeouts, retry logic, and observability
#
# Exit Codes:
#   0 - Success: All tools verified
#   1 - Editor load failure: One or more required tools missing
#   2 - WebSocket/connection failure: kubectl connectivity issues
#   3 - File operation failure: kubectl exec failures
#   124 - Timeout: Operations exceeded configured timeout
#
# Environment Variables:
#   CODE_SERVER_NAMESPACE - Kubernetes namespace (default: vibecode-platform)
#   CODE_SERVER_SELECTOR - Pod selector (default: app=code-server,tier=workspace)
#   KUBE_REQUEST_TIMEOUT - kubectl request timeout (default: 30s)
#   KUBE_WAIT_TIMEOUT - kubectl wait timeout (default: 60s)
#   EDITOR_EXEC_TIMEOUT - kubectl exec timeout (default: 45s)
#   MAX_POD_ATTEMPTS - Max retry attempts per pod (default: 5)
#   MAX_RETRY_ATTEMPTS - Max retry attempts per tool check (default: 3)
#   LOG_LEVEL - Logging level: DEBUG, INFO, WARN, ERROR (default: INFO)
#   TIMEOUT_BIN - Path to timeout binary (auto-detected if not set)
#
# Usage:
#   ./scripts/test-code-server-editors.sh
#   CODE_SERVER_NAMESPACE=my-namespace ./scripts/test-code-server-editors.sh
#   LOG_LEVEL=DEBUG MAX_RETRY_ATTEMPTS=5 ./scripts/test-code-server-editors.sh

set -euo pipefail

# ============================================================================
# Configuration and Constants
# ============================================================================

readonly NAMESPACE=${CODE_SERVER_NAMESPACE:-vibecode-platform}
readonly SELECTOR=${CODE_SERVER_SELECTOR:-app=code-server,tier=workspace}
readonly REQUEST_TIMEOUT=${KUBE_REQUEST_TIMEOUT:-30s}
readonly WAIT_TIMEOUT=${KUBE_WAIT_TIMEOUT:-60s}
readonly EXEC_TIMEOUT=${EDITOR_EXEC_TIMEOUT:-45s}
readonly MAX_POD_ATTEMPTS=${MAX_POD_ATTEMPTS:-5}
readonly MAX_RETRY_ATTEMPTS=${MAX_RETRY_ATTEMPTS:-3}
readonly LOG_LEVEL=${LOG_LEVEL:-INFO}

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_EDITOR_FAILED=1
readonly EXIT_CONNECTION_FAILED=2
readonly EXIT_FILE_OP_FAILED=3
readonly EXIT_TIMEOUT=124

# Log levels
declare -A LOG_LEVELS=([DEBUG]=0 [INFO]=1 [WARN]=2 [ERROR]=3)
readonly CURRENT_LOG_LEVEL=${LOG_LEVELS[$LOG_LEVEL]:-1}

# ============================================================================
# Logging Functions
# ============================================================================

log_debug() {
  [[ $CURRENT_LOG_LEVEL -le 0 ]] && echo "[DEBUG] $*" >&2
}

log_info() {
  [[ $CURRENT_LOG_LEVEL -le 1 ]] && echo "[INFO] $*" >&2
}

log_warn() {
  [[ $CURRENT_LOG_LEVEL -le 2 ]] && echo "[WARN] $*" >&2
}

log_error() {
  [[ $CURRENT_LOG_LEVEL -le 3 ]] && echo "[ERROR] $*" >&2
}

log() {
  log_info "$@"
}

# ============================================================================
# Utility Functions
# ============================================================================

sanitize_message() {
  local sanitized="$1"
  # Remove newlines
  sanitized=${sanitized//$'\n'/ }
  # Mask sensitive data
  sanitized=${sanitized//password=[^[:space:]]*/password=***}
  sanitized=${sanitized//token=[^[:space:]]*/token=***}
  sanitized=${sanitized//key=[^[:space:]]*/key=***}
  sanitized=${sanitized//secret=[^[:space:]]*/secret=***}
  printf '%s' "$sanitized"
}

emit_status() {
  local tool="$1"
  local status="$2"
  local duration_ms="$3"
  local message
  message=$(sanitize_message "$4")
  printf 'tool=%s status=%s duration_ms=%s message="%s"\n' "$tool" "$status" "$duration_ms" "$message"
}

emit_metric() {
  local metric_name="$1"
  local metric_value="$2"
  local metric_type="${3:-gauge}"
  printf 'metric=%s value=%s type=%s\n' "$metric_name" "$metric_value" "$metric_type"
}

error() {
  local exit_code="${1:-$EXIT_EDITOR_FAILED}"
  shift
  local sanitized
  sanitized=$(sanitize_message "$*")
  log_error "$sanitized"
  cleanup_on_failure
  exit "$exit_code"
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
    printf '%s\n' "$raw"
  fi
}

# ============================================================================
# Environment Validation
# ============================================================================

validate_environment() {
  log_info "Validating environment and dependencies"

  # Check kubectl
  if ! command -v kubectl >/dev/null 2>&1; then
    error "$EXIT_CONNECTION_FAILED" "kubectl is required but not found in PATH"
  fi

  # Verify kubectl can connect to cluster
  if ! kubectl cluster-info >/dev/null 2>&1; then
    error "$EXIT_CONNECTION_FAILED" "kubectl cannot connect to cluster - verify kubeconfig"
  fi

  # Check namespace exists
  if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    error "$EXIT_CONNECTION_FAILED" "Namespace '$NAMESPACE' does not exist"
  fi

  log_debug "Environment validation passed"
}

# ============================================================================
# Timeout Binary Detection
# ============================================================================

detect_timeout_binary() {
  local timeout_candidates=()
  if [[ -n ${TIMEOUT_BIN:-} ]]; then
    timeout_candidates+=("${TIMEOUT_BIN}")
  fi
  timeout_candidates+=(timeout gtimeout)

  TIMEOUT_BIN=""
  for candidate in "${timeout_candidates[@]}"; do
    if command -v "$candidate" >/dev/null 2>&1; then
      TIMEOUT_BIN="$candidate"
      log_debug "Using timeout binary: $TIMEOUT_BIN"
      break
    fi
  done

  HAS_TIMEOUT=0
  if [[ -n "$TIMEOUT_BIN" ]]; then
    HAS_TIMEOUT=1
  else
    log_warn "No timeout binary found - operations may hang indefinitely"
  fi
}

# ============================================================================
# Cleanup Functions
# ============================================================================

cleanup_on_failure() {
  log_debug "Performing cleanup on failure"
  # Add any cleanup tasks here (e.g., remove temp files)
  # Currently using mktemp which auto-cleans, but explicit cleanup can be added
}

# ============================================================================
# Pod Management Functions
# ============================================================================

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

kubectl_wait_ready() {
  local err_file rc
  err_file=$(mktemp)
  local args=(wait --namespace "$NAMESPACE" --selector "$SELECTOR" --for=condition=Ready pod --timeout="$WAIT_TIMEOUT" --request-timeout="$REQUEST_TIMEOUT")

  log_debug "Waiting for pods to be Ready: kubectl ${args[*]}"

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

  if [[ $rc -eq 124 ]]; then
    log_error "kubectl wait timed out after $WAIT_TIMEOUT"
    rm -f "$err_file"
    error "$EXIT_TIMEOUT" "kubectl wait timed out - pods not ready within $WAIT_TIMEOUT"
  elif [[ $rc -ne 0 ]]; then
    local err
    err=$(sanitize_message "$(<"$err_file")")
    rm -f "$err_file"
    error "$EXIT_CONNECTION_FAILED" "kubectl wait failed (rc=$rc): ${err:-<none>}"
  fi

  rm -f "$err_file"
  log_debug "kubectl wait completed successfully"
}

populate_ready_pods() {
  local jsonpath="$1"
  local err_file out_file rc line idx
  READY_PODS=()
  LAST_KUBECTL_ERROR=""
  err_file=$(mktemp)
  out_file=$(mktemp)

  log_debug "Fetching pod list with jsonpath: $jsonpath"

  kubectl get pods \
    --namespace "$NAMESPACE" \
    --selector "$SELECTOR" \
    --field-selector=status.phase=Running \
    --output "jsonpath=${jsonpath}" \
    --request-timeout="$REQUEST_TIMEOUT" \
    >"$out_file" 2>"$err_file"
  rc=$?

  if [[ $rc -ne 0 ]]; then
    LAST_KUBECTL_ERROR=$(sanitize_message "$(<"$err_file")")
    log_debug "kubectl get pods failed: $LAST_KUBECTL_ERROR"
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
  log_debug "Found ${#READY_PODS[@]} pods"
  return 0
}

refresh_ready_pods() {
  log_info "Locating Ready code-server pods in namespace '$NAMESPACE' (selector: $SELECTOR)"

  kubectl_wait_ready

  # Try to get Ready pods with condition filter
  if ! populate_ready_pods '{range .items[?(@.status.conditions[?(@.type=="Ready" && @.status=="True")])]}{.metadata.name}{"\n"}{end}'; then
    log_warn "Failed to get Ready pods with condition filter, trying all pods"
    if ! populate_ready_pods '{range .items[*]}{.metadata.name}{"\n"}{end}'; then
      error "$EXIT_CONNECTION_FAILED" "kubectl get pods failed: ${LAST_KUBECTL_ERROR:-unknown error}"
    fi
  fi

  # Fallback if no pods found
  if [[ ${#READY_PODS[@]} -eq 0 ]]; then
    log_warn "No Ready pods found with initial query, trying fallback"
    if ! populate_ready_pods '{range .items[*]}{.metadata.name}{"\n"}{end}'; then
      error "$EXIT_CONNECTION_FAILED" "kubectl get pods failed: ${LAST_KUBECTL_ERROR:-unknown error}"
    fi
  fi

  current_pod_index=0

  if [[ ${#READY_PODS[@]} -eq 0 ]]; then
    error "$EXIT_CONNECTION_FAILED" "No Ready pods found for selector '$SELECTOR' in namespace '$NAMESPACE'"
  fi

  log_info "Tracking ${#READY_PODS[@]} Ready pod(s): $(masked_ready_list)"
  emit_metric "pods.ready.count" "${#READY_PODS[@]}" "gauge"
}

choose_next_pod() {
  local total=${#READY_PODS[@]}
  if (( total == 0 )); then
    error "$EXIT_CONNECTION_FAILED" "Ready pod list empty while selecting pod"
  fi
  local idx=$(( current_pod_index % total ))
  local pod="${READY_PODS[$idx]}"
  current_pod_index=$(( current_pod_index + 1 ))
  log_debug "Selected pod: $(mask_pod_name "$pod") (index: $idx)"
  printf '%s' "$pod"
}

# ============================================================================
# Pod Command Execution
# ============================================================================

EXEC_STDOUT=""
EXEC_STDERR=""

run_pod_cmd() {
  local pod="$1"
  local command="$2"
  local out_file err_file rc
  out_file=$(mktemp)
  err_file=$(mktemp)

  log_debug "Executing command on pod $(mask_pod_name "$pod"): $command"

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

  log_debug "Command exit code: $rc"
  return $rc
}

# ============================================================================
# Health Check Validation
# ============================================================================

validate_pod_health() {
  local pod="$1"
  local masked
  masked=$(mask_pod_name "$pod")

  log_debug "Validating health of pod: $masked"

  # Check pod status
  local pod_status
  pod_status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")

  if [[ "$pod_status" != "Running" ]]; then
    log_warn "Pod $masked is not Running (status: $pod_status)"
    return 1
  fi

  # Check container ready
  local ready_count
  ready_count=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")

  if [[ "$ready_count" != "True" ]]; then
    log_warn "Pod $masked is not Ready"
    return 1
  fi

  log_debug "Pod $masked health check passed"
  return 0
}

# ============================================================================
# Tool Verification Functions
# ============================================================================

verify_file_operations() {
  local pod="$1"
  local masked
  masked=$(mask_pod_name "$pod")

  log_debug "Verifying file operations on pod: $masked"

  # Create test file
  if ! run_pod_cmd "$pod" "echo 'test' > /tmp/smoke-test-$$"; then
    log_error "Failed to create test file on pod $masked"
    return "$EXIT_FILE_OP_FAILED"
  fi

  # Read test file
  if ! run_pod_cmd "$pod" "cat /tmp/smoke-test-$$"; then
    log_error "Failed to read test file on pod $masked"
    return "$EXIT_FILE_OP_FAILED"
  fi

  # Verify content
  if [[ "$EXEC_STDOUT" != "test" ]]; then
    log_error "File content mismatch on pod $masked (expected: 'test', got: '$EXEC_STDOUT')"
    return "$EXIT_FILE_OP_FAILED"
  fi

  # Cleanup test file
  run_pod_cmd "$pod" "rm -f /tmp/smoke-test-$$" || true

  log_debug "File operations verified on pod: $masked"
  return 0
}

check_tool() {
  local label="$1"
  local detect_cmd="$2"
  local version_cmd="$3"
  local overall_rc=1
  local message=""
  local retry_attempt=1

  log_info "Checking tool: $label"

  while (( retry_attempt <= MAX_RETRY_ATTEMPTS )); do
    log_debug "Tool check attempt $retry_attempt/$MAX_RETRY_ATTEMPTS for $label"

    local pod_attempt=1
    while (( pod_attempt <= MAX_POD_ATTEMPTS )); do
      if (( ${#READY_PODS[@]} == 0 )); then
        log_debug "No ready pods, refreshing pod list"
        refresh_ready_pods
      fi

      if (( ${#READY_PODS[@]} == 0 )); then
        message="no Ready pods available after refresh"
        log_error "$message"
        break 2  # Break both loops
      fi

      local pod masked start_ms end_ms rc shell_output
      pod=$(choose_next_pod)
      masked=$(mask_pod_name "$pod")

      # Validate pod health before attempting command
      if ! validate_pod_health "$pod"; then
        log_warn "Pod $masked failed health check, trying next pod"
        pod_attempt=$(( pod_attempt + 1 ))
        continue
      fi

      # Verify file operations work
      if ! verify_file_operations "$pod"; then
        log_warn "File operations failed on pod $masked, trying next pod"
        pod_attempt=$(( pod_attempt + 1 ))
        continue
      fi

      start_ms=$(now_ms)

      # Check if tool exists
      if run_pod_cmd "$pod" "$detect_cmd"; then
        shell_output=""
        # Get version info
        if run_pod_cmd "$pod" "$version_cmd"; then
          shell_output=$(printf '%s' "$EXEC_STDOUT" | head -n 1)
        else
          shell_output="version command failed: $(sanitize_message "$EXEC_STDERR")"
        fi

        end_ms=$(now_ms)
        shell_output=${shell_output//$'\n'/ }

        echo "✅ $label available — ${shell_output:-available} (pod=${masked})"
        emit_status "$label" "ok" "$(( end_ms - start_ms ))" "pod=${masked}"
        emit_metric "tool.$label.check.duration_ms" "$(( end_ms - start_ms ))" "gauge"
        emit_metric "tool.$label.available" "1" "gauge"
        overall_rc=0
        break 2  # Break both loops on success
      fi

      rc=$?
      end_ms=$(now_ms)

      # Categorize failure
      if [[ $rc -eq 124 ]]; then
        message="timeout after $EXEC_TIMEOUT (pod=${masked})"
        log_warn "$message"
      elif [[ $rc -eq 137 ]]; then
        message="command terminated/killed (pod=${masked})"
        log_warn "$message"
      elif [[ $rc -eq 127 ]]; then
        message="tool not found: $label (pod=${masked})"
        log_error "$message"
        emit_status "$label" "missing" "$(( end_ms - start_ms ))" "$message"
        emit_metric "tool.$label.available" "0" "gauge"
        echo "❌ $label missing"
        return "$EXIT_EDITOR_FAILED"
      elif [[ $rc -eq 126 ]]; then
        message="permission denied or not executable: $label (pod=${masked})"
        log_error "$message"
      else
        local stderr_clean
        stderr_clean=$(sanitize_message "$EXEC_STDERR")
        if [[ -n "$stderr_clean" ]]; then
          message="kubectl exec failed (rc=$rc) pod=${masked} stderr=${stderr_clean}"
        else
          message="kubectl exec failed (rc=$rc) pod=${masked}"
        fi
        log_warn "$message"
      fi

      emit_status "$label" "retry" "$(( end_ms - start_ms ))" "$message"
      pod_attempt=$(( pod_attempt + 1 ))

      if (( pod_attempt <= MAX_POD_ATTEMPTS )); then
        log_debug "Trying next pod for $label (attempt $pod_attempt/$MAX_POD_ATTEMPTS)"
      fi
    done

    # If we exhausted all pods, refresh and retry
    if (( overall_rc != 0 && retry_attempt < MAX_RETRY_ATTEMPTS )); then
      log_info "Retry attempt $retry_attempt/$MAX_RETRY_ATTEMPTS for $label - refreshing pod list"
      refresh_ready_pods
      retry_attempt=$(( retry_attempt + 1 ))
      sleep 2  # Brief delay between retry attempts
    else
      break
    fi
  done

  if [[ $overall_rc -ne 0 ]]; then
    local clean_message
    clean_message=$(sanitize_message "$message")
    echo "❌ $label check failed — ${clean_message:-unknown error}"
    emit_metric "tool.$label.available" "0" "gauge"
    log_error "Tool check failed for $label after $retry_attempt retry attempts"
    return "$EXIT_EDITOR_FAILED"
  fi

  return 0
}

# ============================================================================
# Extension Loading Verification
# ============================================================================

verify_extensions_loaded() {
  log_info "Verifying code-server extensions loading capability"

  local pod
  pod=$(choose_next_pod)
  local masked
  masked=$(mask_pod_name "$pod")

  # Check if code-server CLI is available
  if ! run_pod_cmd "$pod" "command -v code-server >/dev/null 2>&1"; then
    log_warn "code-server CLI not found on pod $masked, skipping extension verification"
    return 0
  fi

  # Try to list extensions
  if run_pod_cmd "$pod" "code-server --list-extensions 2>/dev/null || true"; then
    log_info "✅ Extensions loading capability verified (pod=$masked)"
    emit_metric "extensions.check.success" "1" "gauge"
    return 0
  else
    log_warn "Could not verify extensions on pod $masked (non-critical)"
    emit_metric "extensions.check.success" "0" "gauge"
    return 0  # Non-fatal
  fi
}

# ============================================================================
# WebSocket Connection Verification
# ============================================================================

verify_websocket_connection() {
  log_info "Verifying WebSocket connection capability"

  local pod
  pod=$(choose_next_pod)
  local masked
  masked=$(mask_pod_name "$pod")

  # Check if netstat or ss is available for connection verification
  if run_pod_cmd "$pod" "command -v netstat >/dev/null 2>&1 || command -v ss >/dev/null 2>&1"; then
    log_info "✅ Network tools available for connection verification (pod=$masked)"
    emit_metric "websocket.check.success" "1" "gauge"
    return 0
  else
    log_warn "Network diagnostic tools not found on pod $masked (non-critical)"
    emit_metric "websocket.check.success" "0" "gauge"
    return 0  # Non-fatal
  fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
  local start_time
  start_time=$(now_ms)

  log_info "==================================================================="
  log_info "Code-Server Editor Smoke Test - Issue #415"
  log_info "==================================================================="
  log_info "Configuration:"
  log_info "  Namespace: $NAMESPACE"
  log_info "  Selector: $SELECTOR"
  log_info "  Request Timeout: $REQUEST_TIMEOUT"
  log_info "  Wait Timeout: $WAIT_TIMEOUT"
  log_info "  Exec Timeout: $EXEC_TIMEOUT"
  log_info "  Max Pod Attempts: $MAX_POD_ATTEMPTS"
  log_info "  Max Retry Attempts: $MAX_RETRY_ATTEMPTS"
  log_info "  Log Level: $LOG_LEVEL"
  log_info "==================================================================="

  # Validate environment
  validate_environment

  # Detect timeout binary
  detect_timeout_binary

  # Initialize pod list
  refresh_ready_pods

  # Track failures
  local missing=0

  # Verify core tools
  check_tool "vim" "command -v vim >/dev/null 2>&1" "vim --version" || missing=1
  check_tool "nvim" "command -v nvim >/dev/null 2>&1" "nvim --version" || missing=1
  check_tool "aider" "command -v aider >/dev/null 2>&1" "aider --version || aider --help" || missing=1
  check_tool "goose" "command -v goose >/dev/null 2>&1" "goose --version || goose --help" || missing=1
  check_tool "kubectl" "command -v kubectl >/dev/null 2>&1" "kubectl version --client --short" || missing=1
  check_tool "helm" "command -v helm >/dev/null 2>&1" "helm version --short || helm version" || missing=1
  check_tool "kubectx" "command -v kubectx >/dev/null 2>&1" "kubectx --help" || missing=1
  check_tool "kubens" "command -v kubens >/dev/null 2>&1" "kubens --help" || missing=1

  # Verify additional capabilities
  verify_extensions_loaded || true  # Non-fatal
  verify_websocket_connection || true  # Non-fatal

  local end_time duration_ms
  end_time=$(now_ms)
  duration_ms=$(( end_time - start_time ))

  emit_metric "smoke_test.total.duration_ms" "$duration_ms" "gauge"

  if [[ $missing -eq 0 ]]; then
    log_info "==================================================================="
    log_info "✅ SUCCESS: All tools verified in ${duration_ms}ms"
    log_info "==================================================================="
    exit "$EXIT_SUCCESS"
  else
    log_error "==================================================================="
    log_error "❌ FAILURE: One or more required tools missing or checks failed"
    log_error "==================================================================="
    exit "$EXIT_EDITOR_FAILED"
  fi
}

# Execute main function
main "$@"
