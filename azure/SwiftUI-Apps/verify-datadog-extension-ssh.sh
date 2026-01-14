#!/bin/bash
#
# verify-datadog-extension-ssh.sh
# VibeCode Post-Build Verification: SSH-based Datadog Extension Check
#
# Purpose: Verify Datadog extension files exist in VM via SSH
# Requirements:
#   - VM must be running
#   - SSH must be accessible on port 2222
#   - Default credentials: root / vibecode
#
# Usage:
#   ./verify-datadog-extension-ssh.sh
#   ./verify-datadog-extension-ssh.sh --verbose
#
# Exit codes:
#   0 = All checks passed
#   1 = Verification failed
#   2 = SSH connection failed
#

set -euo pipefail

# Configuration
SSH_PORT="2222"
SSH_USER="root"
SSH_PASS="vibecode"
SSH_HOST="localhost"
EXTENSION_DIR="/root/.openvscode-server/extensions"
EXPECTED_EXTENSION="datadog.datadog-vscode-2.0.0"
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
if [[ "${1:-}" == "--verbose" ]]; then
  VERBOSE=true
fi

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test results
declare -a FAILED_TESTS=()

log() {
  local color="${2:-NC}"
  echo -e "${!color}$1${NC}"
}

log_test() {
  local name="$1"
  local status="$2"
  local details="${3:-}"

  TESTS_RUN=$((TESTS_RUN + 1))

  if [[ "$status" == "PASS" ]]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log "✓ [PASS] $name" "GREEN"
  elif [[ "$status" == "FAIL" ]]; then
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILED_TESTS+=("$name")
    log "✗ [FAIL] $name" "RED"
  else
    log "⊘ [SKIP] $name" "YELLOW"
  fi

  if [[ -n "$details" ]]; then
    echo "         $details"
  fi
}

# SSH helper function
run_ssh() {
  local cmd="$1"

  if [[ "$VERBOSE" == true ]]; then
    log "  SSH command: $cmd" "CYAN"
  fi

  # Use sshpass if available, otherwise expect password prompt
  if command -v sshpass &>/dev/null; then
    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      -o ConnectTimeout=5 -o LogLevel=ERROR \
      -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "$cmd" 2>/dev/null
  else
    # Fallback without sshpass (will require manual password entry or SSH keys)
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      -o ConnectTimeout=5 -o LogLevel=ERROR \
      -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "$cmd" 2>/dev/null
  fi
}

# Print header
print_header() {
  log "╔═══════════════════════════════════════════════════════════════╗" "BLUE"
  log "║  VibeCode Post-Build Verification: Datadog Extension (SSH)   ║" "BLUE"
  log "╚═══════════════════════════════════════════════════════════════╝" "BLUE"
  echo ""
  log "Timestamp:       $(date -u +"%Y-%m-%dT%H:%M:%SZ")" "CYAN"
  log "SSH target:      $SSH_USER@$SSH_HOST:$SSH_PORT" "CYAN"
  log "Extension dir:   $EXTENSION_DIR" "CYAN"
  log "Expected ext:    $EXPECTED_EXTENSION" "CYAN"
  echo ""
}

# Test 1: Check SSH connectivity
test_ssh_connectivity() {
  log "\n📋 TEST 1: Check SSH connectivity" "YELLOW"

  if run_ssh "echo 'SSH connection successful'" &>/dev/null; then
    log_test "SSH connectivity" "PASS" "Connected to $SSH_HOST:$SSH_PORT"
    return 0
  else
    log_test "SSH connectivity" "FAIL" "Cannot connect to $SSH_HOST:$SSH_PORT"
    log "\n💡 Troubleshooting tips:" "YELLOW"
    log "  1. Check if VM is running" "YELLOW"
    log "  2. Check if SSH port forwarding is active (port 2222)" "YELLOW"
    log "  3. Try: lsof -i :2222" "YELLOW"
    log "  4. Install sshpass for automated login: brew install hudochenkov/sshpass/sshpass" "YELLOW"
    return 1
  fi
}

# Test 2: Check extension directory exists
test_extension_dir_exists() {
  log "\n📋 TEST 2: Check extension directory exists" "YELLOW"

  if run_ssh "test -d '$EXTENSION_DIR' && echo 'exists'"; then
    log_test "Extension directory exists" "PASS" "$EXTENSION_DIR"
    return 0
  else
    log_test "Extension directory exists" "FAIL" "$EXTENSION_DIR not found"
    return 1
  fi
}

# Test 3: List installed extensions
test_list_extensions() {
  log "\n📋 TEST 3: List installed extensions" "YELLOW"

  local extensions
  extensions=$(run_ssh "ls -1 '$EXTENSION_DIR' 2>/dev/null" || echo "")

  if [[ -z "$extensions" ]]; then
    log_test "List extensions" "FAIL" "No extensions found or directory not accessible"
    return 1
  fi

  local count
  count=$(echo "$extensions" | wc -l | tr -d ' ')
  log_test "List extensions" "PASS" "Found $count extension(s)"

  echo ""
  log "  Installed extensions:" "CYAN"
  echo "$extensions" | while read -r ext; do
    echo "    - $ext"
  done

  return 0
}

# Test 4: Check for Datadog extension
test_datadog_extension_exists() {
  log "\n📋 TEST 4: Check for Datadog extension" "YELLOW"

  local extensions
  extensions=$(run_ssh "ls -1 '$EXTENSION_DIR' 2>/dev/null" || echo "")

  if echo "$extensions" | grep -q "datadog"; then
    local datadog_ext
    datadog_ext=$(echo "$extensions" | grep "datadog")
    log_test "Datadog extension exists" "PASS" "Found: $datadog_ext"

    if echo "$datadog_ext" | grep -q "$EXPECTED_EXTENSION"; then
      log "  ✓ Extension version matches expected: $EXPECTED_EXTENSION" "GREEN"
    else
      log "  ⚠ Extension version differs from expected: $EXPECTED_EXTENSION" "YELLOW"
      log "  Found: $datadog_ext" "YELLOW"
    fi

    return 0
  else
    log_test "Datadog extension exists" "FAIL" "Datadog extension not found"
    return 1
  fi
}

# Test 5: Check extension file structure
test_extension_structure() {
  log "\n📋 TEST 5: Check extension file structure" "YELLOW"

  # Find the actual Datadog extension directory
  local datadog_dir
  datadog_dir=$(run_ssh "ls -d $EXTENSION_DIR/datadog.datadog-vscode-* 2>/dev/null | head -1" || echo "")

  if [[ -z "$datadog_dir" ]]; then
    log_test "Extension structure" "FAIL" "Could not find Datadog extension directory"
    return 1
  fi

  log "  Checking structure of: $datadog_dir" "CYAN"

  # Check for key files
  local all_found=true
  declare -a key_files=(
    "package.json"
    "extension.js"
  )

  for file in "${key_files[@]}"; do
    if run_ssh "test -f '$datadog_dir/$file' && echo 'exists'" &>/dev/null; then
      log "  ✓ Found: $file" "GREEN"
    else
      log "  ✗ Missing: $file" "RED"
      all_found=false
    fi
  done

  if [[ "$all_found" == true ]]; then
    log_test "Extension structure" "PASS" "All key files present"
    return 0
  else
    log_test "Extension structure" "FAIL" "Some files missing"
    return 1
  fi
}

# Test 6: Check extension size
test_extension_size() {
  log "\n📋 TEST 6: Check extension size" "YELLOW"

  local datadog_dir
  datadog_dir=$(run_ssh "ls -d $EXTENSION_DIR/datadog.datadog-vscode-* 2>/dev/null | head -1" || echo "")

  if [[ -z "$datadog_dir" ]]; then
    log_test "Extension size" "SKIP" "Could not find Datadog extension directory"
    return 0
  fi

  local size
  size=$(run_ssh "du -sh '$datadog_dir' 2>/dev/null | cut -f1" || echo "unknown")

  if [[ "$size" != "unknown" && "$size" != "0" ]]; then
    log_test "Extension size" "PASS" "Extension size: $size"
    return 0
  else
    log_test "Extension size" "FAIL" "Extension appears to be empty or inaccessible"
    return 1
  fi
}

# Test 7: Check package.json content
test_package_json() {
  log "\n📋 TEST 7: Check package.json content" "YELLOW"

  local datadog_dir
  datadog_dir=$(run_ssh "ls -d $EXTENSION_DIR/datadog.datadog-vscode-* 2>/dev/null | head -1" || echo "")

  if [[ -z "$datadog_dir" ]]; then
    log_test "package.json content" "SKIP" "Could not find Datadog extension directory"
    return 0
  fi

  local package_json
  package_json=$(run_ssh "cat '$datadog_dir/package.json' 2>/dev/null" || echo "")

  if [[ -z "$package_json" ]]; then
    log_test "package.json content" "FAIL" "Could not read package.json"
    return 1
  fi

  # Extract key fields
  local name version
  name=$(echo "$package_json" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  version=$(echo "$package_json" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

  if [[ -n "$name" && -n "$version" ]]; then
    log_test "package.json content" "PASS" "Name: $name, Version: $version"
    return 0
  else
    log_test "package.json content" "FAIL" "Could not parse package.json"
    return 1
  fi
}

# Test 8: Check file permissions
test_file_permissions() {
  log "\n📋 TEST 8: Check file permissions" "YELLOW"

  local datadog_dir
  datadog_dir=$(run_ssh "ls -d $EXTENSION_DIR/datadog.datadog-vscode-* 2>/dev/null | head -1" || echo "")

  if [[ -z "$datadog_dir" ]]; then
    log_test "File permissions" "SKIP" "Could not find Datadog extension directory"
    return 0
  fi

  local perms
  perms=$(run_ssh "ls -ld '$datadog_dir' 2>/dev/null" || echo "")

  if [[ -n "$perms" ]]; then
    log "  Permissions: $perms" "CYAN"

    # Check if directory is readable
    if run_ssh "test -r '$datadog_dir' && echo 'readable'" &>/dev/null; then
      log_test "File permissions" "PASS" "Directory is readable"
      return 0
    else
      log_test "File permissions" "FAIL" "Directory is not readable"
      return 1
    fi
  else
    log_test "File permissions" "FAIL" "Could not check permissions"
    return 1
  fi
}

# Main execution
main() {
  print_header

  # Check if sshpass is available
  if ! command -v sshpass &>/dev/null; then
    log "⚠ sshpass not found - SSH password automation not available" "YELLOW"
    log "  Install with: brew install hudochenkov/sshpass/sshpass" "YELLOW"
    log "  Or ensure SSH key authentication is set up" "YELLOW"
    echo ""
  fi

  # Run tests
  test_ssh_connectivity || exit 2
  test_extension_dir_exists || exit 1
  test_list_extensions
  test_datadog_extension_exists || exit 1
  test_extension_structure
  test_extension_size
  test_package_json
  test_file_permissions

  # Print summary
  echo ""
  log "╔═══════════════════════════════════════════════════════════════╗" "BLUE"
  log "║                      TEST SUMMARY                             ║" "BLUE"
  log "╚═══════════════════════════════════════════════════════════════╝" "BLUE"
  echo ""
  log "Total tests:  $TESTS_RUN" "CYAN"
  log "Passed:       $TESTS_PASSED" "GREEN"
  log "Failed:       $TESTS_FAILED" "$([ $TESTS_FAILED -eq 0 ] && echo "GREEN" || echo "RED")"
  echo ""

  if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
    log "Failed tests:" "RED"
    for test in "${FAILED_TESTS[@]}"; do
      echo "  ✗ $test"
    done
    echo ""
  fi

  # Exit code
  if [[ $TESTS_FAILED -eq 0 ]]; then
    log "✅ ALL TESTS PASSED" "GREEN"
    exit 0
  else
    log "❌ TESTS FAILED" "RED"
    exit 1
  fi
}

# Run main
main
