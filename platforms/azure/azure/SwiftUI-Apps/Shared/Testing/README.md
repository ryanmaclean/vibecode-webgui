# Testing Components

**Purpose:** Shared test utilities and mocks
**Status:** Phase 4 - Testing Infrastructure

---

## Overview

Testing components for shared infrastructure:

- **MockVMManager**: Mock BaseVMManager for UI testing
- **MockNetworkingStrategy**: Mock network strategy
- **MockObservabilityProvider**: Mock observability
- **TestHelpers**: Common test utilities

---

## MockVMManager

Mock VM manager for testing SwiftUI views:

```swift
import XCTest
@testable import VibeCodeKit

final class MyViewTests: XCTestCase {
    func testViewWithRunningVM() {
        let mockVM = MockVMManager()
        mockVM.isRunning = true
        mockVM.status = "Running"
        mockVM.serverURL = "http://localhost:3000"

        let view = MyView(vmManager: mockVM)
        // Test view behavior
    }
}
```

---

## MockNetworkingStrategy

Mock networking for testing BaseVMManager subclasses:

```swift
final class MockNetworkingStrategy: NetworkingStrategy {
    var configureCallCount = 0
    var setupCallCount = 0

    func configure(_ config: VZVirtualMachineConfiguration) throws {
        configureCallCount += 1
    }

    func setupConnectivity(_ manager: BaseVMManager) {
        setupCallCount += 1
    }

    func teardown() {}
    func getMACAddress() -> String { "00:00:00:00:00:00" }
}
```

---

## Best Practices

### DO ✅
- Use mocks for unit testing
- Test public interfaces only
- Use real components for integration tests
- Verify mock behavior matches real implementations

### DON'T ❌
- Don't test implementation details
- Don't skip integration tests
- Don't assume mocks match reality

---

## Reference

Phase 4 implementation coming soon.
