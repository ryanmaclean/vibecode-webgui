# Quick Test Guide - Unified Services VM

Quick reference for running automated tests on the unified services VM.

## Prerequisites

```bash
brew install vfkit redis postgresql@16 hudochenkov/sshpass/sshpass
```

## Quick Commands

### Run All Tests
```bash
cd azure && ./test-suite.sh -v all
```

### Run By Category
```bash
./test-suite.sh unit          # Unit tests only (~1 min)
./test-suite.sh integration   # Integration tests (~1 min)
./test-suite.sh performance   # Performance tests (~2 min)
./test-suite.sh reliability   # Reliability tests (~5 min)
```

### Quick Test (Skip Slow Tests)
```bash
./test-suite.sh -q all        # Skip long-running tests (~2 min)
```

### CI/CD Output Formats
```bash
./test-suite.sh -f tap all    # TAP output (default)
./test-suite.sh -f junit all  # JUnit XML
./test-suite.sh -f both all   # Both formats
```

## Individual Test Execution

```bash
# Run single test
cd azure/tests/unit
bash test_ssh_connection.sh 192.168.64.10

# With debugging
bash -x test_valkey_operations.sh 192.168.64.10
```

## Environment Variables

```bash
export VM_IP=192.168.64.10        # VM IP address
export VERBOSE=true               # Verbose output
export QUICK=true                 # Skip slow tests
export OUTPUT_FORMAT=junit        # Output format
```

## Test Categories

| Category | Tests | Time | Description |
|----------|-------|------|-------------|
| **unit** | 28 | ~1 min | Individual service tests |
| **integration** | 8 | ~1 min | Service interaction tests |
| **performance** | 9 | ~2 min | Performance benchmarks |
| **reliability** | 8 | ~5 min | Stability and fault tolerance |

## Expected Results

### Successful Run
```
TAP version 13
1..13
ok 1 - test_ssh_connection
ok 2 - test_valkey_operations
ok 3 - test_postgresql_database
ok 4 - test_openvscode_http
...
ok 13 - test_network_failure

Total Tests:  13
Passed:       13
Failed:       0
Skipped:      0
Status: ALL TESTS PASSED
```

### Partial Skip (Missing Tools)
```
ok 1 - test_ssh_connection # SKIP sshpass not available
ok 2 - test_valkey_operations # SKIP redis-cli not available
ok 3 - test_postgresql_database # SKIP psql not available
ok 4 - test_openvscode_http
...
```

## Common Issues

### VM Already Running
```bash
# Stop existing VM
killall vfkit

# Clean up stale PIDs
rm -f azure/test-results/*.pid
```

### Port Conflicts
```bash
# Check ports
lsof -i :8080 :6379 :5432 :22
```

### Missing Tools
```bash
# Check what's available
command -v redis-cli && echo "Redis: OK" || echo "Redis: MISSING"
command -v psql && echo "PostgreSQL: OK" || echo "PostgreSQL: MISSING"
command -v sshpass && echo "SSH: OK" || echo "SSH: MISSING"
```

## Test Results Location

```bash
# View test logs
ls -lh azure/test-results/

# Check JUnit XML
cat azure/test-results/junit.xml

# View individual test logs
cat azure/test-results/test_ssh_connection.log
```

## Quick Debugging

```bash
# Check VM status
nc -zv 192.168.64.10 8080        # OpenVSCode
nc -zv 192.168.64.10 6379        # Valkey
nc -zv 192.168.64.10 5432        # PostgreSQL
nc -zv 192.168.64.10 22          # SSH

# Manual service tests
curl http://192.168.64.10:8080
redis-cli -h 192.168.64.10 PING
psql -h 192.168.64.10 -U postgres -d postgres -c "SELECT 1;"
sshpass -p vibecode ssh root@192.168.64.10 "uname -a"
```

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Boot Time | <10s | ~52s ⚠️ |
| SSH Response | <100ms | <50ms ✅ |
| Valkey Response | <10ms | <5ms ✅ |
| PostgreSQL Response | <50ms | <30ms ✅ |
| OpenVSCode Response | <1000ms | <500ms ✅ |

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Tests
  run: cd azure && ./test-suite.sh -f junit all

- name: Upload Results
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: azure/test-results/
```

### GitLab CI
```yaml
test:
  script:
    - cd azure && ./test-suite.sh -f junit all
  artifacts:
    reports:
      junit: azure/test-results/junit.xml
```

## Getting Help

**Full Documentation**: `/Users/ryan.maclean/vibecode-webgui/AGENT-V-TESTING-FRAMEWORK.md`

**Test Suite**: `/Users/ryan.maclean/vibecode-webgui/azure/test-suite.sh`

**Test Files**: `/Users/ryan.maclean/vibecode-webgui/azure/tests/`
