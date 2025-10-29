#!/bin/bash
# Master Test Runner
# Runs all VM tests and generates a comprehensive report

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results (using indexed arrays and parallel tracking)
TEST_NAMES=()
TEST_RESULTS=()
TEST_DURATIONS=()

# Output file
REPORT_FILE="/Users/ryan.maclean/vibecode-webgui/docs/VM_TESTING_RESULTS.md"
START_TIME=$(date +%s)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VM Infrastructure Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Start time: $(date)"
echo ""

# Run a test suite
run_test_suite() {
    local test_name="$1"
    local test_script="$2"

    echo -e "${BLUE}Running $test_name...${NC}"
    echo "----------------------------------------"

    local start=$(date +%s)

    TEST_NAMES+=("$test_name")

    if [[ ! -f "$test_script" ]]; then
        echo -e "${RED}Test script not found: $test_script${NC}"
        TEST_RESULTS+=("SKIPPED")
        TEST_DURATIONS+=(0)
        return 1
    fi

    if bash "$test_script" > "/tmp/${test_name}.log" 2>&1; then
        local end=$(date +%s)
        local duration=$((end - start))
        echo -e "${GREEN}✓ PASSED${NC} (${duration}s)"
        TEST_RESULTS+=("PASSED")
        TEST_DURATIONS+=($duration)
        echo ""
        return 0
    else
        local end=$(date +%s)
        local duration=$((end - start))
        echo -e "${RED}✗ FAILED${NC} (${duration}s)"
        TEST_RESULTS+=("FAILED")
        TEST_DURATIONS+=($duration)
        echo ""
        return 1
    fi
}

# Run all test suites
echo "=== Individual VM Tests ==="
echo ""

run_test_suite "Valkey_VM" "$SCRIPT_DIR/test-valkey.test.sh" || true
run_test_suite "PostgreSQL_VM" "$SCRIPT_DIR/test-postgresql.test.sh" || true
run_test_suite "NodeJS_Dev_VM" "$SCRIPT_DIR/test-nodejs-dev.test.sh" || true

echo "=== Integration Tests ==="
echo ""

run_test_suite "Integration" "$SCRIPT_DIR/integration-tests.sh" || true

# Calculate summary
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

TOTAL_TESTS=${#TEST_NAMES[@]}
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

for ((i=0; i<${#TEST_RESULTS[@]}; i++)); do
    case "${TEST_RESULTS[$i]}" in
        PASSED)
            PASSED_TESTS=$((PASSED_TESTS + 1))
            ;;
        FAILED)
            FAILED_TESTS=$((FAILED_TESTS + 1))
            ;;
        SKIPPED)
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
            ;;
    esac
done

# Display summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Total Duration: ${TOTAL_DURATION}s"
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED_TESTS${NC}"
echo ""

# Show individual test results
echo "Individual Test Results:"
for ((i=0; i<${#TEST_NAMES[@]}; i++)); do
    test_name="${TEST_NAMES[$i]}"
    result="${TEST_RESULTS[$i]}"
    duration="${TEST_DURATIONS[$i]}"

    case "$result" in
        PASSED)
            echo -e "  ${GREEN}✓${NC} $test_name (${duration}s)"
            ;;
        FAILED)
            echo -e "  ${RED}✗${NC} $test_name (${duration}s)"
            ;;
        SKIPPED)
            echo -e "  ${YELLOW}⊘${NC} $test_name (skipped)"
            ;;
    esac
done

echo ""

# Generate markdown report
echo "Generating test report..."

SUCCESS_RATE=0
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
fi

cat > "$REPORT_FILE" <<EOF
# VM Testing Results

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Platform:** macOS ARM64
**Repository:** /Users/ryan.maclean/vibecode-webgui

---

## Executive Summary

This report documents the comprehensive testing of the VibeCode VM infrastructure, including:
- Valkey (Redis-compatible) VM
- PostgreSQL with pgvector extension VM
- Node.js Development VM
- Integration testing of all VMs working together

### Test Results Summary

| Metric | Value |
|--------|-------|
| **Total Test Suites** | $TOTAL_TESTS |
| **Passed** | $PASSED_TESTS |
| **Failed** | $FAILED_TESTS |
| **Skipped** | $SKIPPED_TESTS |
| **Total Duration** | ${TOTAL_DURATION}s |
| **Success Rate** | ${SUCCESS_RATE}% |

---

## Individual Test Suite Results

EOF

# Add each test suite results
for ((i=0; i<${#TEST_NAMES[@]}; i++)); do
    test_name="${TEST_NAMES[$i]}"
    result="${TEST_RESULTS[$i]}"
    duration="${TEST_DURATIONS[$i]}"

    # Convert underscores to spaces for display
    display_name="${test_name//_/ }"

    cat >> "$REPORT_FILE" <<EOF
### $display_name Tests

**Status:** $result
**Duration:** ${duration}s

EOF

    # Add detailed log if available
    if [[ -f "/tmp/${test_name}.log" ]]; then
        echo "<details>" >> "$REPORT_FILE"
        echo "<summary>View detailed test output</summary>" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        tail -100 "/tmp/${test_name}.log" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        echo "</details>" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi

    # Add JSON results if available
    json_file_name=$(echo "$test_name" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
    json_file="/tmp/${json_file_name}-test-results.json"
    if [[ -f "$json_file" ]]; then
        echo "<details>" >> "$REPORT_FILE"
        echo "<summary>View JSON results</summary>" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo '```json' >> "$REPORT_FILE"
        cat "$json_file" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        echo "</details>" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
done

# Add findings and recommendations
cat >> "$REPORT_FILE" <<EOF

---

## Current Status

EOF

if [[ $PASSED_TESTS -eq $TOTAL_TESTS ]] && [[ $TOTAL_TESTS -gt 0 ]]; then
    cat >> "$REPORT_FILE" <<EOF
### ✅ All Tests Passed

All VM infrastructure tests passed successfully. The system is ready for production use.

EOF
elif [[ $SKIPPED_TESTS -eq $TOTAL_TESTS ]]; then
    cat >> "$REPORT_FILE" <<EOF
### ⚠️ Tests Skipped - Setup Required

All tests were skipped because the VM configurations are not yet in place.

**Required Actions:**
1. Create Valkey VM configuration at: \`config/vfkit/valkey-vm.yaml\`
2. Create PostgreSQL VM configuration at: \`config/vfkit/postgresql-vm.yaml\`
3. Create Node.js Dev VM configuration at: \`config/vfkit/nodejs-dev-vm.yaml\`
4. Ensure VM setup scripts are created
5. Re-run tests after setup is complete

**Expected VM Configurations:**

#### Valkey VM (\`valkey-vm.yaml\`)
- Port 6379 forwarded to host
- 1GB RAM
- 2 vCPUs
- Password authentication enabled
- Persistence enabled

#### PostgreSQL VM (\`postgresql-vm.yaml\`)
- Port 5432 forwarded to host
- 2GB RAM
- 2 vCPUs
- pgvector extension installed
- Optimized for vector operations

#### Node.js Dev VM (\`nodejs-dev-vm.yaml\`)
- SSH port 2222 forwarded to host
- Node.js v24.x installed
- npm and pnpm available
- TypeScript support
- Shared workspace directory

EOF
else
    cat >> "$REPORT_FILE" <<EOF
### ⚠️ Some Tests Failed

Some tests failed or were skipped. Review the detailed logs above for specific issues.

**Common Issues to Check:**
1. VM configurations exist and have correct syntax
2. vfkit binary is executable and has correct permissions
3. Required ports are not already in use
4. Sufficient system resources available
5. Network connectivity is working correctly

EOF
fi

cat >> "$REPORT_FILE" <<'EOF'

---

## Test Reproduction

To reproduce these tests:

```bash
# Run all tests
cd /Users/ryan.maclean/vibecode-webgui/tests/vm
./run-all-tests.sh

# Run individual test suites
./test-valkey.test.sh
./test-postgresql.test.sh
./test-nodejs-dev.test.sh
./integration-tests.sh
```

---

## Performance Metrics

### Expected Resource Usage (All VMs Running)

| Resource | Target | Notes |
|----------|--------|-------|
| **Total CPU** | < 50% | Combined CPU usage of all VMs |
| **Total RAM** | < 8GB | Combined memory usage of all VMs |
| **Disk I/O** | < 100MB/s | Normal operation disk I/O |
| **Network** | < 10Mbps | Inter-VM communication |

### Expected Performance

| Metric | Target | Notes |
|--------|--------|-------|
| **Valkey Response Time** | < 1ms | PING command |
| **PostgreSQL Query Time** | < 10ms | Simple SELECT |
| **Vector Search Time** | < 100ms | HNSW index search |
| **VM Boot Time** | < 30s | From start to service ready |

---

## Recommendations for Production Deployment

1. **Resource Allocation:**
   - Ensure host system has at least 16GB RAM
   - Allocate at least 4 CPU cores
   - Provide at least 100GB disk space for VM images

2. **Network Configuration:**
   - Verify port forwarding rules are correct
   - Ensure firewall rules allow required ports
   - Test network connectivity between VMs

3. **Security:**
   - Change default passwords in production
   - Enable SSL/TLS for PostgreSQL connections
   - Implement proper authentication for all services
   - Regularly update VM images and packages

4. **Monitoring:**
   - Set up resource monitoring for all VMs
   - Implement health checks for all services
   - Configure alerting for service failures
   - Monitor disk usage and set up rotation

5. **Backup and Recovery:**
   - Implement regular database backups
   - Test restore procedures
   - Document recovery processes
   - Consider VM snapshot functionality

6. **Performance Tuning:**
   - Adjust PostgreSQL shared_buffers based on workload
   - Configure Valkey maxmemory based on usage patterns
   - Tune kernel parameters for VM performance
   - Monitor and optimize HNSW index parameters

---

## Test Infrastructure Details

### Test Framework
- Location: `tests/vm/test-framework.sh`
- Features: Assertions, port checking, VM management, resource monitoring
- Output: Color-coded console output + JSON results

### Test Suites

1. **Valkey VM Tests** (`test-valkey.test.sh`)
   - Configuration validation
   - VM startup and boot
   - Port accessibility
   - PING/PONG communication
   - SET/GET operations
   - Persistence testing
   - Memory management
   - Security (password protection)
   - Performance benchmarking

2. **PostgreSQL VM Tests** (`test-postgresql.test.sh`)
   - Configuration validation
   - VM startup and boot
   - Database connectivity
   - pgvector extension verification
   - Vector data insertion
   - Similarity search
   - HNSW index creation
   - Performance testing
   - Resource usage

3. **Node.js Dev VM Tests** (`test-nodejs-dev.test.sh`)
   - Configuration validation
   - VM startup and boot
   - SSH accessibility
   - Node.js version verification
   - npm/pnpm availability
   - Package installation
   - TypeScript support
   - Application deployment
   - Shared workspace access

4. **Integration Tests** (`integration-tests.sh`)
   - All VMs start together
   - No port conflicts
   - Inter-service communication
   - Application connectivity
   - Resource usage monitoring
   - Simultaneous operations
   - System stability

---

## Appendix: Test Logs

Test logs are available in `/tmp/`:
- `/tmp/Valkey_VM.log`
- `/tmp/PostgreSQL_VM.log`
- `/tmp/NodeJS_Dev_VM.log`
- `/tmp/Integration.log`

JSON results:
- `/tmp/valkey-test-results.json`
- `/tmp/postgresql-test-results.json`
- `/tmp/nodejs-test-results.json`
- `/tmp/integration-test-results.json`

---

**End of Report**
EOF

echo -e "${GREEN}Test report generated: $REPORT_FILE${NC}"
echo ""

# Final exit code
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Tests completed with failures.${NC}"
    exit 1
else
    echo -e "${GREEN}All tests completed successfully!${NC}"
    exit 0
fi
