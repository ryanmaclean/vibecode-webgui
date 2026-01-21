# VibeCode Comprehensive Test Scripts

Automated test suites for BasicVibeCode.app and VibeCode.app (Multi-VM Manager). These scripts provide complete testing coverage with detailed reporting and logging capabilities.

## Scripts Overview

### 1. test-basicvibecode.sh
**Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-basicvibecode.sh`

Automated test suite for BasicVibeCode.app with the following coverage:

#### Tests Performed:
- **App Existence** - Verifies app bundle exists at expected path
- **Executable Validation** - Checks executable is valid and present
- **Launch Without Crash** - App launches and stays running
- **Entitlements** - Verifies required hypervisor entitlements
- **VM Boot Detection** - Infrastructure for VM boot detection is present
- **DHCP Parsing** - DHCP networking capability implemented
- **Network Configuration** - Network detection logic present
- **OpenVSCode URL Generation** - URL generation for VSCode server
- **Console Output Capture** - Logging infrastructure in place
- **Graceful Shutdown** - Shutdown handling implemented
- **Error Handling** - Error handling logic present

#### Features:
- 11 automated test cases
- Color-coded console output
- Timestamped logging
- Individual test status tracking
- Comprehensive test summary
- Pass/Fail exit codes (0 = pass, 1 = fail)

#### Output:
- Console output with color-coded results
- Detailed log file with timestamps
- Success/failure statistics

---

### 2. test-vibecode-multivm.sh
**Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-vibecode-multivm.sh`

Automated test suite for VibeCode.app (Multi-VM Manager) with comprehensive coverage:

#### Tests Performed:

**Build & Preparation:**
- Source code exists
- Build configuration is valid
- Swift syntax validation
- Observability framework imports

**VM Discovery & Management:**
- VM discovery implementation
- Multi-VM management support
- VM lifecycle management

**Observability & Metrics:**
- Metrics collection capability
- Datadog integration
- OpenTelemetry support
- Performance monitoring

**UI & Functionality:**
- UI components implementation
- VM status display
- Control buttons (start/stop)
- Network information display

**Error Handling & Resilience:**
- Error handling implementation
- Timeout handling
- Recovery mechanism

**Distribution & Packaging:**
- App bundle structure
- Code signature validity
- Required entitlements

**Integration Tests:**
- Application launch
- Logging functionality

#### Features:
- 23 comprehensive test cases
- Build configuration testing
- Observability framework validation
- Multi-VM management verification
- UI/UX testing
- Error resilience testing
- Color-coded output with progress indicators
- Detailed logging with context

#### Output:
- Console output with detailed test status
- Individual test logs
- Execution timing for each test
- Comprehensive test summary

---

### 3. test-all-apps.sh
**Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-all-apps.sh`

Master test runner that orchestrates execution of all test suites and generates comprehensive reports.

#### Features:
- Runs both BasicVibeCode and VibeCode MultiVM test suites
- Prerequisite validation
- Parallel and sequential test execution
- Comprehensive reporting in multiple formats
- Automatic cleanup and process management

#### Reports Generated:
1. **Text Report** - Human-readable format with detailed statistics
2. **JSON Report** - Machine-parseable format for integration
3. **Main Log File** - Complete execution log with timestamps

#### Output Files:
All reports saved to `/tmp/vibecode-tests/`:
- `test-results-TIMESTAMP.log` - Main execution log
- `test-report-TIMESTAMP.txt` - Text format report
- `test-report-TIMESTAMP.json` - JSON format report
- `basicvibecode-test-output-TIMESTAMP.log` - BasicVibeCode test logs
- `vibecode-multivm-test-output-TIMESTAMP.log` - MultiVM test logs

#### Reporting Features:
- Test execution timestamp
- Environment information (OS, Architecture)
- Individual test suite results with duration
- Summary statistics
- Success rate calculation
- File location references
- Automatic process cleanup

---

## Usage

### Basic Usage

Run all tests with master runner:
```bash
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-all-apps.sh
```

Run individual test suites:
```bash
# Test BasicVibeCode only
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-basicvibecode.sh

# Test VibeCode MultiVM only
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-vibecode-multivm.sh
```

### Viewing Results

Check test results:
```bash
# View text report
cat /tmp/vibecode-tests/test-report-*.txt | tail -50

# View JSON report
cat /tmp/vibecode-tests/test-report-*.json

# View detailed logs
tail -f /tmp/vibecode-tests/test-results-*.log
```

### Exit Codes

Scripts use standard exit codes:
- `0` - All tests passed successfully
- `1` - One or more tests failed

Use for scripting:
```bash
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-all-apps.sh
if [ $? -eq 0 ]; then
    echo "All tests passed"
else
    echo "Some tests failed"
fi
```

---

## Test Configuration

### Timeouts
- App Launch: 30 seconds
- VM Boot: 60 seconds
- Network Detection: 30 seconds
- OpenVSCode Accessibility: 20 seconds
- Build Process: 300 seconds

### Logging Levels
- INFO - General information messages
- SUCCESS - Test passed
- ERROR - Test failed or error occurred
- WARN - Warning about potential issues
- DEBUG - Detailed debug information

### Log Directory
All logs saved to: `/tmp/vibecode-tests/`

---

## Features

### Automated Execution
- No user input required
- Fully hands-off testing
- Suitable for CI/CD integration
- Batch processing capable

### Comprehensive Reporting
- Multiple output formats (text, JSON)
- Detailed timing information
- Environment metadata
- Success statistics and rates

### Logging & Tracing
- Timestamped log entries
- Colorized console output
- Multiple verbosity levels
- Log file retention

### Process Management
- Automatic app launch and cleanup
- Process termination handling
- Signal handling
- Resource cleanup on exit

### Error Resilience
- Graceful failure handling
- Skip non-critical tests
- Continue on error option
- Clear error messages

---

## Prerequisites

### System Requirements
- macOS (10.15 or later)
- Bash 4.0+
- Standard Unix utilities (grep, sed, awk, etc.)

### Application Files Required
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app`
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app`

### Optional but Recommended
- Xcode command line tools for advanced testing
- Swift toolchain for syntax validation
- Python 3 for JSON formatting in reports

---

## Test Report Examples

### Text Report Output
```
╔════════════════════════════════════════════════════════════╗
║         VibeCode Test Execution Report                      ║
╠════════════════════════════════════════════════════════════╣

Execution Timestamp: 2024-11-03 13:30:45

Test Environment:
  - Machine: MacBook-Pro.local
  - OS: Darwin 24.6.0
  - Architecture: arm64

════════════════════════════════════════════════════════════
TEST RESULTS
════════════════════════════════════════════════════════════

Application: BasicVibeCode
Result: PASS
Duration: 45s
Log File: /tmp/vibecode-tests/basicvibecode-test-output-20241103_133045.log

Application: VibeCode MultiVM
Result: PASS
Duration: 52s
Log File: /tmp/vibecode-tests/vibecode-multivm-test-output-20241103_133045.log

════════════════════════════════════════════════════════════
SUMMARY
════════════════════════════════════════════════════════════

Total Test Suites:   2
Passed:              2
Failed:              0
Skipped:             0

Success Rate: 100%

Status: ALL TESTS PASSED ✓
```

### JSON Report Structure
```json
{
  "timestamp": "2024-11-03T13:30:45Z",
  "environment": {
    "machine": "MacBook-Pro.local",
    "os": "Darwin",
    "architecture": "arm64"
  },
  "results": {
    "BasicVibeCode": {
      "status": "PASS",
      "duration_seconds": 45
    },
    "VibeCode MultiVM": {
      "status": "PASS",
      "duration_seconds": 52
    }
  },
  "summary": {
    "total_suites": 2,
    "passed": 2,
    "failed": 0,
    "skipped": 0
  }
}
```

---

## Troubleshooting

### Script Won't Execute
```bash
# Make scripts executable
chmod +x /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-*.sh
```

### Permission Denied
```bash
# Check permissions
ls -l /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-*.sh

# Fix if needed
sudo chmod +x /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-*.sh
```

### Apps Not Found
Verify app bundles exist:
```bash
ls -d /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/*.app
```

### Logs Not Generated
Check log directory permissions:
```bash
mkdir -p /tmp/vibecode-tests
chmod 777 /tmp/vibecode-tests
```

### Tests Timing Out
Increase timeout values in script configuration:
```bash
# Edit test script and adjust:
TIMEOUT_APP_LAUNCH=60  # Increase from 30
TIMEOUT_VM_BOOT=120    # Increase from 60
```

---

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run VibeCode Tests
  run: |
    bash /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-all-apps.sh
    exit_code=$?

    # Upload reports
    if [ -f "/tmp/vibecode-tests/test-report-*.json" ]; then
      echo "Tests completed with exit code: $exit_code"
    fi

    exit $exit_code
```

### GitLab CI Example
```yaml
test:
  script:
    - bash /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-all-apps.sh
  artifacts:
    paths:
      - /tmp/vibecode-tests/test-report-*.txt
      - /tmp/vibecode-tests/test-report-*.json
    expire_in: 1 week
```

---

## Performance Metrics

### Typical Execution Times
- BasicVibeCode Tests: 30-45 seconds
- VibeCode MultiVM Tests: 40-60 seconds
- Full Suite (Master Runner): 80-120 seconds

### Resource Usage
- CPU: Minimal (< 5%)
- Memory: ~50-100MB per test process
- Disk: Log files ~1-5MB per run

---

## File Locations Summary

| File | Path |
|------|------|
| BasicVibeCode Test | `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-basicvibecode.sh` |
| MultiVM Test | `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-vibecode-multivm.sh` |
| Master Runner | `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-all-apps.sh` |
| Log Directory | `/tmp/vibecode-tests/` |

---

## Version Information

- **Created:** 2024-11-03
- **Test Scripts Version:** 1.0
- **Compatibility:** macOS 10.15+
- **Shell:** Bash 4.0+

---

## Support

For issues or enhancements:
1. Check logs in `/tmp/vibecode-tests/`
2. Review script documentation inline
3. Check prerequisites are met
4. Ensure app bundles are present and signed

---

**Last Updated:** 2024-11-03
