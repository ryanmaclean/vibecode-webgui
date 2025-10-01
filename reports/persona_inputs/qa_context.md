# test-code-server-editors.bats excerpt
#!/usr/bin/env bats

setup() {
  export ROOT_DIR="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
  export SCRIPT="$ROOT_DIR/scripts/test-code-server-editors.sh"
  export PATH="$ROOT_DIR/tests/scripts/fixtures/bin:$PATH"
  export CODE_SERVER_NAMESPACE=test-namespace
  export CODE_SERVER_SELECTOR=app=code-server,tier=workspace
  export KUBE_REQUEST_TIMEOUT=2s
  export KUBE_WAIT_TIMEOUT=2s
  export EDITOR_EXEC_TIMEOUT=2s
  export MAX_POD_ATTEMPTS=3
  export MOCK_KUBECTL_STATE_DIR="$BATS_TEST_TMPDIR"
  unset MOCK_TOOL_MISSING
  unset MOCK_KUBECTL_EXEC_FAIL
  unset MOCK_KUBECTL_EXEC_TIMEOUT
  unset MOCK_KUBECTL_WAIT_FAIL
  unset MOCK_KUBECTL_GET_SEQUENCE
  unset MOCK_KUBECTL_EXEC_FAIL_ONCE
  unset MOCK_KUBECTL_EXEC_FAIL_MSG
  unset MOCK_TIMEOUT_EXIT
}

teardown() {
  rm -f "$MOCK_KUBECTL_STATE_DIR"/mock_*
  unset MOCK_TOOL_MISSING
  unset MOCK_KUBECTL_EXEC_FAIL
  unset MOCK_KUBECTL_EXEC_TIMEOUT
  unset MOCK_KUBECTL_WAIT_FAIL
  unset MOCK_KUBECTL_GET_SEQUENCE
  unset MOCK_KUBECTL_EXEC_FAIL_ONCE
  unset MOCK_KUBECTL_EXEC_FAIL_MSG
  unset MOCK_TIMEOUT_EXIT
}

@test "succeeds when all editors present" {
  run "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"All tools verified."* ]]
  [[ "$output" != *"pod-code-server-0"* ]]
}

@test "fails when a tool is missing" {
  export MOCK_TOOL_MISSING=nvim
  run "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"nvim check failed"* ]]
}

@test "surfaces kubectl exec failures with redacted tokens" {
  export MOCK_KUBECTL_EXEC_FAIL=1
  export MOCK_KUBECTL_EXEC_FAIL_MSG='kubectl exec error token=secret123'
  run "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"kubectl exec failed"* ]]
  [[ "$output" == *"token=***"* ]]
  [[ "$output" != *"secret123"* ]]
}

@test "reports timeout when commands exceed limit" {
  export MOCK_TIMEOUT_EXIT=1
  run "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"kubectl wait failed"* ]]
}

@test "fails fast when kubectl wait fails" {
  export MOCK_KUBECTL_WAIT_FAIL=1
  run "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"kubectl wait failed"* ]]
}

@test "rotates pods between retries and succeeds" {
  export MOCK_KUBECTL_GET_SEQUENCE='pod-alpha|pod-beta'
  export MOCK_KUBECTL_EXEC_FAIL_ONCE='pod-alpha'
  run "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"All tools verified."* ]]
  [[ "$output" != *"pod-alpha"* ]]
  [[ "$output" != *"pod-beta"* ]]
}

# test-code-server-editors.sh excerpt
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

# BUILD_STATUS QA excerpt
docker buildx ls
```

### Agent 2: QA Engineer (CAN START)
**Task**: Create verification scripts  
**Status**: Ready to start  
**GitHub**: Pending issue creation  
**Deliverable**: `scripts/verify-code-server-profiles.sh`

### Agent 3: Documentation (CAN START)
**Task**: Update docs for v1.1.0  
**Status**: Ready to start  
**GitHub**: Issue #411  
**Files to Update**:
- `docker/code-server/CHANGELOG.md` (create)
- `docker/code-server/DEPLOYMENT_REPORT.md` (update)
- `docker/code-server/VERIFICATION_GUIDE.md` (create)

### Agent 4: DevOps (BLOCKED)
**Task**: Test on Synology NAS  
**Status**: Waiting for builds to complete  
**Blocker**: Need all profiles pushed first  
**Commands Ready**:
```bash
ssh snas "docker pull ryanmaclean/vibecode-codeserver:1.1.0-standard"
```

### Agent 5: Coordinator (ACTIVE)
**Task**: Track progress and integration  
**Status**: Monitoring builds, updating TODO.md  
**Tools**: GitHub issues, TODO.md, sequential thinking

## 🔧 Technical Details

### What Was Fixed
