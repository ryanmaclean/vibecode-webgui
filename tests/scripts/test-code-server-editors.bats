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
  unset MOCK_KUBECTL_GET_EMPTY
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
  unset MOCK_KUBECTL_GET_EMPTY
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

@test "emits structured telemetry for each tool" {
  run "$SCRIPT"
  [ "$status" -eq 0 ]
  for tool in vim nvim aider goose kubectl helm kubectx kubens; do
    [[ "$output" == *"tool=$tool status=ok"* ]]
  done
  [[ "$output" =~ tool=vim\ status=ok\ duration_ms=[0-9]+ ]]
  [[ "$output" =~ pod=pod-\*\*\*r-0 ]]
}

@test "emits retry telemetry before recovering" {
  export MOCK_KUBECTL_GET_SEQUENCE='pod-alpha|pod-beta'
  export MOCK_KUBECTL_EXEC_FAIL_ONCE='pod-alpha'
  run "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"tool=vim status=retry"* ]]
  [[ "$output" == *"tool=vim status=ok"* ]]
}

@test "masks secrets inside telemetry messages" {
  export MOCK_KUBECTL_EXEC_FAIL=1
  export MOCK_KUBECTL_EXEC_FAIL_MSG='kubectl exec failure password=supersecret token=abc123'
  run "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"password=***"* ]]
  [[ "$output" == *"token=***"* ]]
  [[ "$output" != *"supersecret"* ]]
  [[ "$output" != *"abc123"* ]]
}

@test "fails immediately when kubectl missing from PATH" {
  PATH="/usr/bin:/bin"
  run "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"kubectl is required but not found in PATH"* ]]
}

@test "exhausts Ready pods before reporting missing tool" {
  export MOCK_KUBECTL_GET_SEQUENCE='pod-alpha|pod-beta|pod-gamma'
  export MOCK_TOOL_MISSING=vim
  run "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"tool=vim status=retry"* ]]
  [[ "$output" == *"pod=pod-***mma"* ]]
  [[ "$output" == *"vim check failed"* ]]
}

@test "handles empty Ready pod list gracefully" {
  export MOCK_KUBECTL_GET_EMPTY=1
  run "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"No Ready pods found for selector"* ]]
}
