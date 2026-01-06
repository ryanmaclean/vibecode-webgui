# Shared Tests

Comprehensive unit tests for the Shared infrastructure components.

## Test Coverage

### BaseVMManagerTests.swift
Tests for the abstract base VM manager class.

**Coverage:**
- Initialization and default state
- Template method pattern (getCPUCount, getMemorySize, etc.)
- Lifecycle hooks (onVMStarted, onVMStopped, onVMError, etc.)
- @Published property updates and observation
- Server ready detection
- Error handling (VMError types)
- Start/Stop behavior and multiple call handling
- Networking strategy integration
- Console output management
- State transitions
- Performance benchmarks

**Test Count:** ~30 tests

**Key Test Scenarios:**
- Default vs custom template method values
- Hook invocation and ordering
- Published property change notifications
- Server URL construction with/without IP
- Thread safety and concurrent access
- Error propagation

### NetworkingStrategyTests.swift
Tests for network configuration strategies.

**Coverage:**
- NATNetworkStrategy initialization (default, custom, stable MAC)
- MAC address validation (valid/invalid formats)
- VZVirtualMachineConfiguration setup
- Pre-defined strategies (basicVibeCode, liquidGlass, networkTest)
- Connectivity setup and teardown
- NetworkError types and descriptions
- MAC address generation helpers (random, stable)
- Protocol conformance
- VZVirtualMachine integration
- Case insensitivity
- Performance benchmarks

**Test Count:** ~35 tests

**Key Test Scenarios:**
- MAC address format validation (regex patterns)
- Stable MAC generation (deterministic hashing)
- Configuration with invalid MAC addresses
- Multiple strategies with unique MACs
- Edge cases (empty, whitespace, special characters)

### DHCPLeaseMonitorTests.swift
Tests for DHCP lease monitoring and IP detection.

**Coverage:**
- Initialization
- Lease file parsing (single/multiple blocks)
- MAC address matching (case-insensitive)
- Monitoring start/stop
- Change detection callbacks
- Thread safety (concurrent access)
- Backward compatibility (Timer-based API)
- Static methods (findIPAddress, findMostRecentIP, getAllLeases)
- onNotFound callback
- Deinit cleanup
- Lease block parsing (nested braces, missing fields)
- Value extraction (ip_address, hw_address)
- Edge cases (empty MAC, invalid format, whitespace)
- Monitoring intervals (short, long, custom)
- Integration with BaseVMManager
- Real DHCP file format examples
- Performance benchmarks

**Test Count:** ~40 tests

**Key Test Scenarios:**
- Parsing of macOS /var/db/dhcpd_leases format
- Thread-safe concurrent monitoring
- Change detection (IP appears, changes, disappears)
- Multiple monitoring sessions
- Memory leak prevention (deinit)

### ObservabilityProviderTests.swift
Tests for observability abstraction (logging, metrics, tracing).

**Coverage:**
- NoOpProvider (silent operation)
- CompositeProvider (multiple backends)
- MockObservabilityProvider (test double)
- LogLevel (numeric values, comparison, raw values)
- Protocol extensions (convenience methods)
- SpanContext operations (attributes, events, errors, end)
- CompositeSpanContext (forwarding to multiple spans)
- Attributes (string, numeric, complex values)
- Tags (single, multiple, empty)
- Integration with BaseVMManager
- Span lifecycle (complete flow, error handling, nesting)
- Thread safety (concurrent logging, metrics)
- Edge cases (empty messages, long messages, special/unicode chars)
- Performance benchmarks

**Test Count:** ~40 tests

**Key Test Scenarios:**
- NoOpProvider does nothing (no side effects)
- CompositeProvider forwards to all backends
- Span parent-child relationships (trace ID inheritance)
- Concurrent observability calls (thread safety)
- Memory management (weak references, deallocation)

## Running Tests

### Run All Tests
```bash
swift test
```

### Run Specific Test Suite
```bash
swift test --filter BaseVMManagerTests
swift test --filter NetworkingStrategyTests
swift test --filter DHCPLeaseMonitorTests
swift test --filter ObservabilityProviderTests
```

### Run Specific Test Case
```bash
swift test --filter BaseVMManagerTests.testInitialization
swift test --filter NetworkingStrategyTests.testNATStrategy_Configuration
```

### Run with Verbose Output
```bash
swift test --verbose
```

### Generate Code Coverage
```bash
swift test --enable-code-coverage
```

## Test Structure

Each test file follows this structure:

1. **Mock Classes**: Test doubles for dependencies
2. **Helper Methods**: Utilities for creating test data
3. **Test Methods**: Organized by feature area
4. **Performance Tests**: Benchmark critical paths
5. **Integration Tests**: Test component interactions
6. **Edge Case Tests**: Boundary conditions and error cases

## Test Naming Conventions

- `test<Component>_<Scenario>`: Standard test
- `testPerformance_<Operation>`: Performance benchmark
- `testIntegration_<Components>`: Integration test
- `testEdgeCase_<Condition>`: Edge case test
- `testThreadSafety_<Operation>`: Concurrency test

## Coverage Goals

- **Line Coverage**: >80%
- **Branch Coverage**: >70%
- **API Coverage**: 100% (all public methods tested)

## Continuous Integration

Tests are run automatically on:
- Every commit (pre-commit hook)
- Pull requests (CI pipeline)
- Release builds (deployment gate)

## Test Dependencies

- **XCTest**: Apple's testing framework (built-in)
- **Virtualization**: For VM configuration testing
- **Foundation**: For basic utilities

No external test dependencies required!

## Known Limitations

1. **DHCPLeaseMonitor**: Tests require mocking /var/db/dhcpd_leases file path
2. **BaseVMManager**: Cannot fully test VM start/stop without actual kernel/initramfs
3. **VZVirtualMachine**: Cannot create real VM instances in tests (requires valid configuration)

## Future Improvements

- [ ] Add test coverage reports (SwiftCov, codecov.io)
- [ ] Add mutation testing (test quality validation)
- [ ] Add snapshot testing for UI components
- [ ] Add integration tests with real VMs (slower test suite)
- [ ] Add fuzz testing for parser robustness

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Add comments explaining complex test scenarios
3. Group related tests together
4. Include both positive and negative test cases
5. Add performance tests for critical paths
6. Update this README with coverage information

## Questions?

See main project README or contact the team.
