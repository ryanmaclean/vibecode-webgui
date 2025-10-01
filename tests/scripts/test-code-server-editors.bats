#!/usr/bin/env bats

setup() {
  export PATH="$(pwd)/tests/scripts/fixtures/bin:$PATH"
  export CODE_SERVER_NAMESPACE=test-namespace
  export CODE_SERVER_SELECTOR=app=code-server,tier=workspace
  export KUBE_REQUEST_TIMEOUT=2s
  export KUBE_WAIT_TIMEOUT=2s
  export EDITOR_EXEC_TIMEOUT=2s
  unset MOCK_TOOL_MISSING
  unset MOCK_KUBECTL_EXEC_FAIL
  unset MOCK_KUBECTL_EXEC_TIMEOUT
  unset MOCK_TIMEOUT_EXIT
}

teardown() {
  unset MOCK_TOOL_MISSING
  unset MOCK_KUBECTL_EXEC_FAIL
  unset MOCK_KUBECTL_EXEC_TIMEOUT
  unset MOCK_TIMEOUT_EXIT
}

@test "succeeds when all editors present" {
  run ./scripts/test-code-server-editors.sh
  [ "$status" -eq 0 ]
  [[ "$output" == *"All tools verified."* ]]
}

@test "fails when a tool is missing" {
  export MOCK_TOOL_MISSING=nvim
  run ./scripts/test-code-server-editors.sh
  [ "$status" -ne 0 ]
  [[ "$output" == *"nvim missing"* ]]
}

@test "surfaces kubectl exec failures" {
  export MOCK_KUBECTL_EXEC_FAIL=1
  run ./scripts/test-code-server-editors.sh
  [ "$status" -ne 0 ]
  [[ "$output" == *"kubectl exec failed"* ]]
}

@test "reports timeout when commands exceed limit" {
  export MOCK_TIMEOUT_EXIT=1
  run ./scripts/test-code-server-editors.sh
  [ "$status" -ne 0 ]
  [[ "$output" == *"timeout after"* ]]
}
