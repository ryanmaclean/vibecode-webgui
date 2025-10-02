# Code-Server QA Test Plan

**Date**: 2025-10-01  
**Issue**: #417  
**Status**: In Progress

## 🎯 Objective

Expand Bats test suite to cover:
1. Telemetry assertions (`tool=/status=/duration_ms=`)
2. Secret masking in logs
3. PATH-without-kubectl scenarios
4. Ready pod exhaustion handling

## 📋 Current Test Coverage

**Existing**: `tests/scripts/test-code-server-editors.bats`
- Basic tool availability checks
- Editor version verification
- kubectl connectivity

**Missing** (from issue #417):
- Telemetry format validation
- Secret sanitization
- Error handling for missing tools
- Pod retry logic

## 🧪 Test Specifications

### 1. Telemetry Assertions

**Requirement**: Verify structured logging format includes `tool=`, `status=`, `duration_ms=`

**Test Cases**:

```bash
@test "telemetry: vim check includes required fields" {
  run bash -c "source scripts/test-code-server-editors.sh && check_vim 2>&1"
  assert_success
  assert_output --regexp "tool=vim"
  assert_output --regexp "status=(success|failure)"
  assert_output --regexp "duration_ms=[0-9]+"
}

@test "telemetry: all tools emit structured logs" {
  for tool in "${tools[@]}"; do
    run bash -c "source scripts/test-code-server-editors.sh && check_${tool} 2>&1"
    assert_output --regexp "tool=${tool}"
    assert_output --regexp "status="
    assert_output --regexp "duration_ms="
  done
}

@test "telemetry: duration is reasonable" {
  run bash -c "source scripts/test-code-server-editors.sh && check_vim 2>&1"
  assert_success
  # Extract duration and verify it's > 0 and < 10000ms
  duration=$(echo "$output" | grep -oP 'duration_ms=\K[0-9]+')
  [ "$duration" -gt 0 ]
  [ "$duration" -lt 10000 ]
}
```

### 2. Secret Masking

**Requirement**: Ensure sensitive data is masked in logs

**Test Cases**:

```bash
@test "secret masking: API keys are redacted" {
  export TEST_API_KEY="sk-1234567890abcdef"
  run bash -c "echo 'Using key: $TEST_API_KEY' | source scripts/test-code-server-editors.sh && mask_secrets"
  assert_output --partial "Using key: ***REDACTED***"
  refute_output --partial "sk-1234567890"
}

@test "secret masking: pod names are masked" {
  run bash -c "echo 'Pod code-server-abc123-xyz' | source scripts/test-code-server-editors.sh && mask_pod_ids"
  assert_output --partial "Pod code-server-***"
  refute_output --partial "abc123-xyz"
}

@test "secret masking: kubectl output sanitized" {
  run bash -c "kubectl get pods 2>&1 | source scripts/test-code-server-editors.sh && sanitize_kubectl_output"
  refute_output --regexp "[a-f0-9]{8}-[a-f0-9]{4}-"
}

@test "secret masking: environment variables protected" {
  export DD_API_KEY="test_key_12345"
  export GITHUB_TOKEN="ghp_test_token"
  run bash -c "env | source scripts/test-code-server-editors.sh && mask_env_secrets"
  refute_output --partial "test_key_12345"
  refute_output --partial "ghp_test_token"
  assert_output --partial "DD_API_KEY=***"
  assert_output --partial "GITHUB_TOKEN=***"
}
```

### 3. PATH-Without-kubectl

**Requirement**: Handle missing kubectl gracefully

**Test Cases**:

```bash
@test "PATH error: kubectl missing returns proper error" {
  run bash -c "PATH=/usr/bin:/bin source scripts/test-code-server-editors.sh && check_kubectl"
  assert_failure
  assert_output --partial "tool=kubectl"
  assert_output --partial "status=failure"
  assert_output --partial "error=not_found_in_path"
}

@test "PATH error: script continues after kubectl failure" {
  run bash -c "PATH=/usr/bin:/bin source scripts/test-code-server-editors.sh && run_all_checks"
  # Should check other tools even if kubectl fails
  assert_output --partial "tool=vim"
  assert_output --partial "tool=nvim"
  assert_output --partial "tool=kubectl status=failure"
}

@test "PATH error: helpful message for missing tool" {
  run bash -c "PATH=/usr/bin:/bin source scripts/test-code-server-editors.sh && check_kubectl"
  assert_output --partial "kubectl not found in PATH"
  assert_output --partial "Install kubectl or add to PATH"
}

@test "PATH error: all tools checked even with failures" {
  # Simulate multiple missing tools
  run bash -c "PATH=/usr/bin source scripts/test-code-server-editors.sh && run_all_checks"
  local tool_count=$(echo "$output" | grep -c "tool=")
  [ "$tool_count" -ge 6 ]  # Should attempt all tools
}
```

### 4. Ready Pod Exhaustion

**Requirement**: Handle scenarios where no Ready pods are available

**Test Cases**:

```bash
@test "pod exhaustion: retry when no Ready pods" {
  # Mock kubectl to return no Ready pods
  function kubectl() {
    echo "No resources found"
    return 1
  }
  export -f kubectl
  
  run bash -c "source scripts/test-code-server-editors.sh && wait_for_ready_pod"
  assert_failure
  assert_output --partial "No Ready pods found"
  assert_output --partial "retry="
}

@test "pod exhaustion: max retries respected" {
  function kubectl() { return 1; }
  export -f kubectl
  
  run bash -c "MAX_RETRIES=3 source scripts/test-code-server-editors.sh && wait_for_ready_pod"
  retry_count=$(echo "$output" | grep -c "retry=")
  [ "$retry_count" -eq 3 ]
}

@test "pod exhaustion: backoff between retries" {
  function kubectl() { return 1; }
  export -f kubectl
  
  start=$(date +%s)
  run bash -c "MAX_RETRIES=2 RETRY_DELAY=1 source scripts/test-code-server-editors.sh && wait_for_ready_pod"
  end=$(date +%s)
  duration=$((end - start))
  [ "$duration" -ge 2 ]  # Should wait at least 2 seconds (2 retries * 1s)
}

@test "pod exhaustion: refreshes pod list between retries" {
  call_count=0
  function kubectl() {
    ((call_count++))
    echo "Attempt $call_count"
    return 1
  }
  export -f kubectl
  
  run bash -c "MAX_RETRIES=3 source scripts/test-code-server-editors.sh && wait_for_ready_pod"
  [ "$call_count" -eq 3 ]
}

@test "pod exhaustion: eventual success after retries" {
  call_count=0
  function kubectl() {
    ((call_count++))
    if [ "$call_count" -eq 3 ]; then
      echo "code-server-abc123 Ready"
      return 0
    fi
    return 1
  }
  export -f kubectl
  
  run bash -c "MAX_RETRIES=5 source scripts/test-code-server-editors.sh && wait_for_ready_pod"
  assert_success
  assert_output --partial "Ready"
}
```

## 🔧 Implementation Requirements

### Script Modifications Needed

**File**: `scripts/test-code-server-editors.sh`

1. **Add Telemetry Function**:
```bash
emit_telemetry() {
  local tool=$1
  local status=$2
  local duration_ms=$3
  local error=${4:-""}
  
  echo "tool=${tool} status=${status} duration_ms=${duration_ms}${error:+ error=${error}}" >&2
}
```

2. **Add Secret Masking**:
```bash
mask_secrets() {
  sed -E 's/(api[_-]?key|token|password)=[^ ]+/\1=***/gi' | \
  sed -E 's/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/***-***-***-***-***/g'
}
```

3. **Add PATH Error Handling**:
```bash
check_tool_in_path() {
  local tool=$1
  if ! command -v "$tool" &> /dev/null; then
    emit_telemetry "$tool" "failure" 0 "not_found_in_path"
    echo "ERROR: $tool not found in PATH" >&2
    echo "Install $tool or add to PATH" >&2
    return 1
  fi
  return 0
}
```

4. **Add Pod Retry Logic**:
```bash
wait_for_ready_pod() {
  local max_retries=${MAX_RETRIES:-5}
  local retry_delay=${RETRY_DELAY:-2}
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    if kubectl get pods -l app=code-server --field-selector=status.phase=Running 2>&1 | grep -q "Ready"; then
      return 0
    fi
    ((retry++))
    echo "No Ready pods found, retry=$retry/$max_retries" >&2
    [ $retry -lt $max_retries ] && sleep $retry_delay
  done
  
  emit_telemetry "kubectl" "failure" 0 "no_ready_pods_after_retries"
  return 1
}
```

## 📊 Test Execution Plan

### Phase 1: Implement Telemetry Tests
```bash
# Create test file
touch tests/scripts/test-telemetry.bats

# Run tests
bats tests/scripts/test-telemetry.bats
```

### Phase 2: Implement Secret Masking Tests
```bash
# Create test file
touch tests/scripts/test-secret-masking.bats

# Run tests
bats tests/scripts/test-secret-masking.bats
```

### Phase 3: Implement PATH Tests
```bash
# Create test file
touch tests/scripts/test-path-errors.bats

# Run tests
bats tests/scripts/test-path-errors.bats
```

### Phase 4: Implement Pod Exhaustion Tests
```bash
# Create test file
touch tests/scripts/test-pod-exhaustion.bats

# Run tests
bats tests/scripts/test-pod-exhaustion.bats
```

### Phase 5: CI Integration
```yaml
# Add to .github/workflows/ci.yml
- name: Run script tests
  run: npm run test:scripts
```

## ✅ Success Criteria

- [ ] All telemetry tests pass
- [ ] All secret masking tests pass
- [ ] All PATH error tests pass
- [ ] All pod exhaustion tests pass
- [ ] `npm run test:scripts` added to CI
- [ ] Test coverage > 80%
- [ ] All tests documented

## 📈 Metrics

**Target Coverage**:
- Telemetry: 100% of tool checks
- Secret Masking: All sensitive patterns
- Error Handling: All failure modes
- Retry Logic: All edge cases

**Estimated Effort**:
- Telemetry tests: 4 hours
- Secret masking tests: 3 hours
- PATH error tests: 2 hours
- Pod exhaustion tests: 3 hours
- CI integration: 1 hour
- **Total**: ~13 hours

## 🔗 Related

- Issue #417
- `tests/scripts/test-code-server-editors.bats`
- `scripts/test-code-server-editors.sh`
- VERIFICATION_GUIDE.md
