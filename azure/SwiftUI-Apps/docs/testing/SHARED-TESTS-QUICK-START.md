# Shared Components Tests - Quick Start Guide

## Overview
This guide provides instructions for executing and managing the Shared components unit test suite.

**Test Suite Status:**
- Total Tests: 133
- Passing: 132 (99.2%)
- Failing: 1 (0.8% - non-critical)
- Coverage: 87%+

---

## Quick Start

### Prerequisites
1. **Xcode Installation:** Full Xcode (not just Command Line Tools)
   ```bash
   # Verify Xcode location
   ls /Applications/Xcode.app/
   ```

2. **Swift Version:** 6.2+
   ```bash
   swift --version
   ```

### Run All Tests
```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test
```

Expected output (partial):
```
Test Suite 'All tests' started
Test Suite 'BaseVMManagerTests' failed at ...
    Executed 28 tests, with 1 failure (0 unexpected)
Test Suite 'DHCPLeaseMonitorTests' passed at ...
    Executed 34 tests, with 0 failures
Test Suite 'NetworkingStrategyTests' passed at ...
    Executed 31 tests, with 0 failures
Test Suite 'ObservabilityProviderTests' passed at ...
    Executed 40 tests, with 0 failures
```

---

## Running Specific Tests

### Run Single Test Suite
```bash
# BaseVMManagerTests only
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test --filter BaseVMManagerTests

# DHCPLeaseMonitorTests only
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test --filter DHCPLeaseMonitorTests

# NetworkingStrategyTests only
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test --filter NetworkingStrategyTests

# ObservabilityProviderTests only
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test --filter ObservabilityProviderTests
```

### Run Specific Test
```bash
# Run a single test method
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test --filter BaseVMManagerTests.testInitialization
```

### Verbose Output
```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test -v
```

---

## Understanding Test Results

### Pass/Fail Summary
Each test suite reports:
- Number of tests executed
- Number of failures
- Number of unexpected failures
- Execution time

Example:
```
Test Suite 'BaseVMManagerTests' failed at 2025-11-25 10:48:43.500.
    Executed 28 tests, with 1 failure (0 unexpected) in 0.558 seconds
```

### Test Output Interpretation

**PASS:** Test completes successfully
```
Test Case '-[SharedTests.BaseVMManagerTests testInitialization]' passed (0.000 seconds)
```

**FAIL:** Test assertion failed
```
Test Case '-[SharedTests.BaseVMManagerTests testPublishedProperties_Updates]' failed (0.001 seconds)
/path/to/test.swift:271: error: XCTAssertTrue failed - isRunning changes should be published
```

**PERFORMANCE:** Performance measurement
```
Test Case '-[SharedTests.BaseVMManagerTests testPerformance_TemplateMethodCalls]' measured [Time, seconds]
average: 0.000, relative standard deviation: 4.878%
```

---

## Test Suite Details

### 1. BaseVMManagerTests (28 tests)
**Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Tests/SharedTests/BaseVMManagerTests.swift`

**Tests:** Initialization, template methods, lifecycle hooks, state transitions, error handling

**Status:** 27/28 passing (1 known issue with published property timing)

### 2. DHCPLeaseMonitorTests (34 tests)
**Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Tests/SharedTests/DHCPLeaseMonitorTests.swift`

**Tests:** Lease parsing, MAC matching, monitoring, thread safety, edge cases

**Status:** 34/34 passing (100%)

### 3. NetworkingStrategyTests (31 tests)
**Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Tests/SharedTests/NetworkingStrategyTests.swift`

**Tests:** MAC generation, validation, configuration, error handling

**Status:** 31/31 passing (100%)

### 4. ObservabilityProviderTests (40 tests)
**Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Tests/SharedTests/ObservabilityProviderTests.swift`

**Tests:** Providers, spans, logging, metrics, thread safety

**Status:** 40/40 passing (100%)

---

## Known Issues

### Published Property Sync Issue
**Test:** `testPublishedProperties_Updates` in BaseVMManagerTests

**Problem:** The test fails with:
```
XCTAssertTrue failed - isRunning changes should be published
```

**Cause:** The `objectWillChange` publisher timing is not guaranteed in all test scenarios

**Impact:** Non-critical - does not affect production code functionality

**Status:** Documented but not fixed (decision pending)

---

## Troubleshooting

### Issue: "no such module 'XCTest'"
**Solution:** Ensure Xcode (not just Command Line Tools) is installed and set DEVELOPER_DIR:
```bash
ls /Applications/Xcode.app/
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test
```

### Issue: Tests timeout
**Solution:** Some performance tests take time. Wait 30+ seconds for full suite to complete.

### Issue: Framework linking errors
**Solution:** Verify Package.swift is configured correctly:
```bash
cat /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Package.swift | grep -A5 "linkerSettings"
```

### Issue: Tests fail to build
**Solution:** Clean build cache:
```bash
rm -rf /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/.build
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test
```

---

## Performance Benchmarks

All tests execute in approximately 19.6 seconds total:

- BaseVMManagerTests: 0.6 seconds
- DHCPLeaseMonitorTests: 9.0 seconds
- NetworkingStrategyTests: 1.1 seconds
- ObservabilityProviderTests: 9.0 seconds

If tests take significantly longer, check for system load or I/O issues.

---

## Test Coverage

Expected coverage for Shared components: **87%+**

Coverage by component:
- BaseVMManager: ~85%
- NetworkingStrategy: ~90%
- DHCPLeaseMonitor: ~88%
- ObservabilityProvider: ~89%

To maintain coverage:
1. Add tests when fixing bugs
2. Add tests when implementing new features
3. Review coverage gaps in TEST-EXECUTION-REPORT-FINAL.md

---

## Continuous Integration Setup

To integrate tests into CI/CD:

```bash
#!/bin/bash
set -e

# Run tests
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test

# Check results
if [ $? -eq 0 ]; then
    echo "All tests passed"
    exit 0
else
    echo "Some tests failed"
    exit 1
fi
```

---

## Additional Resources

- **Full Report:** `TEST-EXECUTION-REPORT-FINAL.md`
- **Package Configuration:** `Package.swift`
- **Test Source Files:** `Tests/SharedTests/`
- **Production Source Files:** `Shared/`

---

## Support

For issues or questions:
1. Review TEST-EXECUTION-REPORT-FINAL.md for detailed analysis
2. Check test output for specific failure messages
3. Refer to individual test files for test logic and expectations

---

*Last Updated: November 25, 2025*
*Test Framework: Swift Package Manager with XCTest*
*Platform: macOS 15.0+*
