# VibeCode Tests

Root test directory for all VibeCode test suites.

## Test Suites

### SharedTests/
Unit tests for the Shared infrastructure components.

**Components Tested:**
- `BaseVMManager` - Abstract base class for VM managers
- `NetworkingStrategy` - Network configuration protocol and implementations
- `NATNetworkStrategy` - NAT networking implementation
- `DHCPLeaseMonitor` - DHCP lease parsing and IP detection
- `ObservabilityProvider` - Observability abstraction (logging, metrics, tracing)

**Test Files:**
- `BaseVMManagerTests.swift` (~30 tests)
- `NetworkingStrategyTests.swift` (~35 tests)
- `DHCPLeaseMonitorTests.swift` (~40 tests)
- `ObservabilityProviderTests.swift` (~40 tests)

**Total:** ~145 tests

See [SharedTests/README.md](SharedTests/README.md) for detailed coverage.

## Running Tests

### Quick Start
```bash
# Run all tests
swift test

# Run with verbose output
swift test --verbose

# Run specific test suite
swift test --filter SharedTests
```

### Run Specific Tests
```bash
# Run one test file
swift test --filter BaseVMManagerTests

# Run one test case
swift test --filter BaseVMManagerTests.testInitialization
```

### Code Coverage
```bash
# Enable coverage tracking
swift test --enable-code-coverage

# View coverage report
# (Coverage data stored in .build/debug/codecov/)
```

## Test Organization

```
Tests/
├── README.md                    # This file
└── SharedTests/
    ├── README.md                # Detailed test documentation
    ├── BaseVMManagerTests.swift
    ├── NetworkingStrategyTests.swift
    ├── DHCPLeaseMonitorTests.swift
    └── ObservabilityProviderTests.swift
```

## Test Coverage Summary

| Component | Tests | Coverage | Status |
|-----------|-------|----------|--------|
| BaseVMManager | ~30 | High | ✅ |
| NetworkingStrategy | ~35 | High | ✅ |
| DHCPLeaseMonitor | ~40 | High | ✅ |
| ObservabilityProvider | ~40 | High | ✅ |
| **Total** | **~145** | **High** | **✅** |

## Test Categories

### Unit Tests
- Test individual components in isolation
- Use mocks and test doubles for dependencies
- Fast execution (<1 second per test)
- 100% of current tests

### Integration Tests
- Test component interactions
- Use real implementations where possible
- Moderate execution time
- Included in unit test suites

### Performance Tests
- Benchmark critical operations
- Measure execution time
- Detect performance regressions
- ~20% of tests

### Edge Case Tests
- Boundary conditions
- Error handling
- Invalid inputs
- Concurrent access
- ~30% of tests

## Test Framework

**XCTest** (Apple's built-in testing framework)

Features used:
- `XCTestCase` - Base test class
- `XCTAssert*` - Assertions
- `measure {}` - Performance testing
- `XCTestExpectation` - Async testing
- `setUp()` / `tearDown()` - Test lifecycle

## Continuous Testing

### Pre-commit Hook
```bash
#!/bin/bash
# Run tests before commit
swift test || exit 1
```

### CI Pipeline
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - run: swift test --enable-code-coverage
      - run: bash <(curl -s https://codecov.io/bash)
```

## Writing New Tests

### 1. Choose Test Location
- Shared infrastructure → `Tests/SharedTests/`
- App-specific → `Tests/<AppName>Tests/`

### 2. Follow Naming Convention
```swift
// File: <Component>Tests.swift
// Class: <Component>Tests
// Methods: test<Component>_<Scenario>
```

### 3. Test Structure
```swift
import XCTest
@testable import Shared

final class MyComponentTests: XCTestCase {
    // MARK: - Mock Classes
    class MockDependency { ... }

    // MARK: - Helper Methods
    func createTestData() { ... }

    // MARK: - Test Initialization
    func testInitialization() { ... }

    // MARK: - Test Core Functionality
    func testCoreFeature() { ... }

    // MARK: - Test Edge Cases
    func testEdgeCase_Invalid() { ... }

    // MARK: - Performance Tests
    func testPerformance_Operation() { ... }
}
```

### 4. Test Best Practices
- ✅ One assertion per test (when possible)
- ✅ Test both success and failure paths
- ✅ Use descriptive test names
- ✅ Add comments for complex scenarios
- ✅ Clean up resources in tearDown()
- ✅ Use mocks to isolate components
- ✅ Test edge cases and boundaries
- ✅ Add performance tests for critical paths

### 5. Example Test
```swift
func testNATStrategy_Configuration() {
    // Given: A NAT strategy with custom MAC
    let strategy = NATNetworkStrategy(macAddress: "52:54:00:12:34:90")
    let config = VZVirtualMachineConfiguration()

    // When: Configuration is applied
    XCTAssertNoThrow(try strategy.configure(config))

    // Then: Network device should be configured correctly
    XCTAssertEqual(config.networkDevices.count, 1)
    XCTAssertEqual(config.networkDevices[0].macAddress.string, "52:54:00:12:34:90")
    XCTAssertTrue(config.networkDevices[0].attachment is VZNATNetworkDeviceAttachment)
}
```

## Debugging Tests

### Run Single Test with Debugger
```bash
# In Xcode: Click on test diamond in gutter
# Or use lldb:
lldb .build/debug/<PackageName>PackageTests.xctest
```

### Print Debug Output
```swift
func testDebugExample() {
    let value = computeSomething()
    print("DEBUG: value = \(value)")  // Shows in test output
    XCTAssertEqual(value, 42)
}
```

### Conditional Breakpoints
```swift
func testWithBreakpoint() {
    for i in 0..<100 {
        let result = compute(i)
        // Set breakpoint here with condition: i == 50
        XCTAssertNotNil(result)
    }
}
```

## Test Reporting

### Console Output
```bash
$ swift test
Test Suite 'All tests' started at 2025-11-25 10:00:00.000
Test Suite 'SharedTests' started at 2025-11-25 10:00:00.000
Test Case 'BaseVMManagerTests.testInitialization' passed (0.001 seconds)
...
Test Suite 'SharedTests' passed at 2025-11-25 10:00:05.000
     145 tests, 0 failures, 0 errors
```

### JUnit XML (CI)
```bash
swift test --xunit-output test-results.xml
```

### Coverage Reports
```bash
swift test --enable-code-coverage
# Results in: .build/debug/codecov/
```

## Known Issues

1. **DHCPLeaseMonitor Tests**: Require access to /var/db/dhcpd_leases (read-only)
2. **VM Creation Tests**: Cannot create real VMs without kernel/initramfs files
3. **Performance Tests**: May vary based on system load

## Future Test Additions

- [ ] App-specific test suites (BasicVibeCode, LiquidGlass, etc.)
- [ ] UI tests with SwiftUI testing framework
- [ ] Snapshot tests for UI consistency
- [ ] End-to-end tests with real VMs
- [ ] Stress tests for resource limits
- [ ] Fuzz tests for parser robustness

## Resources

- [XCTest Documentation](https://developer.apple.com/documentation/xctest)
- [Swift Testing Best Practices](https://swift.org/documentation/testing/)
- [Virtualization Framework Docs](https://developer.apple.com/documentation/virtualization)

## Contributing

1. Write tests for all new features
2. Maintain >80% code coverage
3. Run tests before committing
4. Add test documentation to README files
5. Review test failures in CI pipeline

## Questions?

- See component-specific README files
- Check test comments for scenario explanations
- Ask team for guidance on complex test cases
