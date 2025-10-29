# VM Infrastructure Test Suite

Comprehensive testing framework for VibeCode VM infrastructure on macOS ARM64.

## Overview

This test suite validates the complete VM infrastructure including:
- **Valkey VM** (Redis-compatible in-memory database)
- **PostgreSQL + pgvector VM** (Database with vector search capabilities)
- **Node.js Development VM** (Complete Node.js development environment)
- **Integration Testing** (All VMs working together)

## Quick Start

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

## Test Suite Structure

### 1. Test Framework (`test-framework.sh`)

Core testing utilities providing:
- **Assertions**: `assert_equals`, `assert_contains`, `assert_success`, `assert_port_open`
- **VM Management**: `wait_for_vm`, `wait_for_port`, `get_vm_stats`
- **Test Tracking**: Automatic test counting, pass/fail tracking, JSON export
- **Logging**: Color-coded output with different log levels

### 2. Valkey VM Tests (`test-valkey.test.sh`)

Tests the Valkey (Redis-compatible) VM:

#### Configuration Tests
- VM configuration file exists
- YAML syntax validation
- vfkit binary is executable

#### Runtime Tests
- VM starts successfully
- VM boots within timeout
- Port 6379 is accessible from host

#### Service Tests
- PING/PONG communication
- SET/GET operations
- Data persistence across restarts
- Memory management
- Password protection

#### Performance Tests
- Response time benchmarking
- Resource usage monitoring

**Expected Config:** `/Users/ryan.maclean/vibecode-webgui/config/vfkit/valkey-vm.yaml`

### 3. PostgreSQL VM Tests (`test-postgresql.test.sh`)

Tests the PostgreSQL + pgvector VM:

#### Configuration Tests
- VM configuration file exists
- YAML syntax validation

#### Runtime Tests
- VM starts successfully
- Port 5432 is accessible
- psql connection works

#### Database Tests
- pgvector extension is installed
- Vector data insertion works
- Similarity search functions
- HNSW index creation

#### Performance Tests
- Vector search performance (<100ms target)
- Resource usage monitoring
- Connection pool testing

**Expected Config:** `/Users/ryan.maclean/vibecode-webgui/config/vfkit/postgresql-vm.yaml`

### 4. Node.js Dev VM Tests (`test-nodejs-dev.test.sh`)

Tests the Node.js development VM:

#### Configuration Tests
- VM configuration file exists
- YAML syntax validation

#### Runtime Tests
- VM starts successfully
- SSH port 2222 is accessible

#### Development Environment Tests
- Node.js v24.x is installed
- npm/pnpm are available
- Package installation works
- TypeScript support

#### Application Tests
- Can deploy and run Express app
- HTTP endpoints accessible
- Shared workspace is writable

**Expected Config:** `/Users/ryan.maclean/vibecode-webgui/config/vfkit/nodejs-dev-vm.yaml`

### 5. Integration Tests (`integration-tests.sh`)

Tests all VMs working together:

#### Infrastructure Tests
- All VM configs exist
- All VMs start simultaneously
- No port conflicts
- All services are accessible

#### Inter-Service Tests
- Data storage in Valkey
- Data storage in PostgreSQL
- Application can connect to both services

#### Performance Tests
- Total resource usage (<50% CPU, <8GB RAM target)
- Simultaneous operations
- VM stability over time

## Configuration

### Environment Variables

Each test suite supports environment variables for customization:

**Valkey Tests:**
```bash
export VALKEY_CONFIG="/path/to/valkey-vm.yaml"
export VALKEY_HOST="localhost"
export VALKEY_PORT="6379"
export VALKEY_PASSWORD="vibecode123"
```

**PostgreSQL Tests:**
```bash
export PG_CONFIG="/path/to/postgresql-vm.yaml"
export PG_HOST="localhost"
export PG_PORT="5432"
export PG_USER="vibecode"
export PG_PASSWORD="vibecode123"
export PG_DATABASE="vibecode"
```

**Node.js Tests:**
```bash
export NODEJS_CONFIG="/path/to/nodejs-dev-vm.yaml"
export NODEJS_HOST="localhost"
export NODEJS_SSH_PORT="2222"
export NODEJS_APP_PORT="3000"
```

## Prerequisites

### Required
- macOS ARM64
- vfkit binary at: `/Users/ryan.maclean/vibecode-webgui/src-tauri/resources/vfkit-aarch64-apple-darwin`
- VM configuration files in `/Users/ryan.maclean/vibecode-webgui/config/vfkit/`

### Optional (for enhanced testing)
- `redis-cli` - For Valkey service tests
  ```bash
  brew install redis
  ```
- `psql` - For PostgreSQL tests
  ```bash
  brew install postgresql@16
  ```
- `python3` with PyYAML - For YAML validation
  ```bash
  pip3 install pyyaml
  ```

## Test Output

### Console Output
Tests provide color-coded console output:
- 🟢 Green: Passed tests
- 🔴 Red: Failed tests
- 🟡 Yellow: Skipped tests
- 🔵 Blue: Informational messages

### Test Reports
- **Main Report**: `/Users/ryan.maclean/vibecode-webgui/docs/VM_TESTING_RESULTS.md`
- **Test Logs**: `/tmp/[TestName].log`
- **JSON Results**: `/tmp/[testname]-test-results.json`

### Example Output
```
========================================
VM Infrastructure Test Suite
========================================
Start time: Tue Oct 28 17:49:49 PDT 2025

=== Individual VM Tests ===

Running Valkey_VM...
----------------------------------------
✓ PASS: Valkey VM config file exists
✓ PASS: YAML syntax validation
✓ PASS: Valkey VM started successfully
✓ PASS: VM boot completed
✓ PASS: Valkey port 6379 is accessible
✓ PASS: PING returns PONG
✓ PASSED (15s)

...

========================================
Test Summary
========================================
Total Duration: 120s
Total Tests: 4
Passed: 4
Failed: 0
Skipped: 0
```

## Performance Targets

### Individual VM Targets

| VM | Metric | Target |
|----|--------|--------|
| Valkey | Boot Time | < 30s |
| Valkey | PING Response | < 1ms |
| Valkey | CPU Usage | < 20% |
| PostgreSQL | Boot Time | < 45s |
| PostgreSQL | Simple Query | < 10ms |
| PostgreSQL | Vector Search | < 100ms |
| PostgreSQL | CPU Usage | < 30% |
| Node.js Dev | Boot Time | < 30s |
| Node.js Dev | Package Install | < 60s |
| Node.js Dev | CPU Usage | < 25% |

### Combined System Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Total CPU | < 50% | All VMs combined |
| Total RAM | < 8GB | All VMs combined |
| Boot Time (All) | < 90s | All VMs started simultaneously |

## Troubleshooting

### Tests Fail with "Config file not found"
**Solution:** Ensure VM configs are created in `/Users/ryan.maclean/vibecode-webgui/config/vfkit/`:
```bash
ls -la /Users/ryan.maclean/vibecode-webgui/config/vfkit/
# Should show: valkey-vm.yaml, postgresql-vm.yaml, nodejs-dev-vm.yaml
```

### Tests Fail with "Port already in use"
**Solution:** Stop any existing VMs or services using the required ports:
```bash
# Check what's using the ports
lsof -i :6379  # Valkey
lsof -i :5432  # PostgreSQL
lsof -i :2222  # Node.js SSH
lsof -i :3000  # Node.js App

# Kill existing vfkit processes
pkill vfkit
```

### YAML Validation Fails
**Solution:** Install PyYAML:
```bash
pip3 install pyyaml
```

### Tests Timeout Waiting for VM
**Solution:** Check VM logs:
```bash
tail -f /tmp/valkey-vm.log
tail -f /tmp/postgresql-vm.log
tail -f /tmp/nodejs-vm.log
```

### Cannot SSH into Node.js VM
**Solution:** Ensure SSH keys are configured or password authentication is enabled in the VM config.

## CI/CD Integration

### GitHub Actions Example
```yaml
name: VM Tests
on: [push, pull_request]

jobs:
  test-vms:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Dependencies
        run: |
          brew install redis postgresql@16
          pip3 install pyyaml

      - name: Run VM Tests
        run: |
          cd tests/vm
          ./run-all-tests.sh

      - name: Upload Test Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-report
          path: docs/VM_TESTING_RESULTS.md
```

## Development

### Adding New Tests

1. Add test case to appropriate test file:
```bash
log_info "Test N: Description..."
assert_equals "expected" "actual" "Test description"
```

2. Run individual test:
```bash
./test-valkey.test.sh
```

3. Update this README with new test documentation

### Test Best Practices

1. **Always clean up**: Use trap to ensure cleanup happens
2. **No optimism bias**: Only mark tests as PASS if they actually work
3. **Meaningful messages**: Provide clear failure messages
4. **Idempotent tests**: Tests should be runnable multiple times
5. **No side effects**: Tests shouldn't affect each other

## Support

For issues or questions:
1. Check the test logs in `/tmp/`
2. Review the comprehensive test report at `docs/VM_TESTING_RESULTS.md`
3. Check VM configurations in `config/vfkit/`
4. Verify vfkit binary exists and is executable

## License

Part of the VibeCode WebGUI project.
