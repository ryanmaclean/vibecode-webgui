# Shared Components Library

**Status:** Phase 1 - Core Infrastructure
**Created:** 2025-11-25
**Purpose:** Eliminate code duplication across 6 VM applications by providing reusable, well-tested components.

---

## 🔧 Technology Stack

**Pure Swift 6 + Apple Virtualization.framework**

This library uses **ONLY native Apple APIs**:
- ✅ **Apple Virtualization.framework** - Native macOS VM management
- ✅ **Swift 6** - Modern Swift with strict concurrency
- ✅ **SwiftUI** - Native macOS UI framework
- ✅ **Combine** - Reactive state management

**NOT using:**
- ❌ vfkit (external VM tool)
- ❌ QEMU
- ❌ VMware APIs
- ❌ VirtualBox
- ❌ Any command-line VM executables

**macOS Native Only** - These components are designed exclusively for macOS Apple Silicon using Apple's native Virtualization.framework APIs (`VZVirtualMachine`, `VZLinuxBootLoader`, etc.)

---

## Overview

This directory contains shared components used across all VibeCode VM applications. These components follow modern Swift patterns and are designed to be:

- **Reusable**: Work across different VM configurations and use cases
- **Extensible**: Use protocols and template methods for customization
- **Observable**: Built with Combine and ObservableObject patterns
- **Testable**: Designed with dependency injection and mock-friendly interfaces
- **Well-documented**: Extensive inline documentation and examples
- **Native**: Pure Swift 6 + Apple Virtualization.framework (no external tools)
- **Production-Ready**: BasicVibeCodeApp proven in production with 27% code reduction

---

## Directory Structure

```
Shared/
├── Core/                      # Core VM management and configuration
│   ├── BaseVMManager.swift    # Abstract base class for all VM managers
│   ├── VMConfiguration/       # VM configuration builders and strategies
│   └── README.md
├── Networking/                # Network configuration strategies
│   ├── NetworkingStrategy.swift      # Protocol for network strategies
│   ├── NATNetworkStrategy.swift      # NAT networking implementation
│   ├── DHCPLeaseMonitor.swift        # Unified DHCP lease monitoring
│   └── README.md
├── Observability/             # Metrics, logging, and tracing
│   ├── ObservabilityProvider.swift   # Protocol for observability backends
│   └── README.md
├── ConsoleMonitoring/         # VM console output monitoring
│   └── README.md
├── Testing/                   # Shared test utilities and mocks
│   └── README.md
└── README.md                  # This file
```

---

## Quick Start

### Creating a New VM Application

```swift
import Foundation
import Virtualization

final class MyAppVMManager: BaseVMManager {
    // Customize networking strategy
    override func createNetworkingStrategy() -> NetworkingStrategy {
        return NATNetworkStrategy()
    }

    // Customize kernel command line if needed
    override func getKernelCommandLine() -> String {
        return "console=hvc0 debug loglevel=8 ipv6.disable=1"
    }

    // Customize initramfs resource if needed
    override func getInitramfsResource() -> String {
        return "bun-openvscode"  // Name of .cpio.gz in bundle
    }

    // Override hooks for custom behavior
    override func onVMStarted() {
        super.onVMStarted()
        // Custom startup logic here
    }
}
```

### Using in SwiftUI View

```swift
import SwiftUI

struct MyAppContentView: View {
    @StateObject private var vmManager = MyAppVMManager()

    var body: some View {
        VStack {
            Text(vmManager.status)

            Button("Start") {
                vmManager.startVM()
            }
            .disabled(vmManager.isRunning)

            Button("Stop") {
                vmManager.stopVM()
            }
            .disabled(!vmManager.isRunning)
        }
    }
}
```

---

## Component Guides

### Core VM Management

See [Core/README.md](Core/README.md) for:
- BaseVMManager usage and lifecycle
- Template method pattern explanation
- VM configuration customization
- Common pitfalls and best practices

### Networking

See [Networking/README.md](Networking/README.md) for:
- NetworkingStrategy protocol
- Available network strategies (NAT, vsock, bridge)
- DHCP lease monitoring
- Custom network strategy implementation

### Observability

See [Observability/README.md](Observability/README.md) for:
- ObservabilityProvider protocol
- Available providers (Datadog, OpenTelemetry)
- Metrics and logging patterns
- Custom provider implementation

### Console Monitoring

See [ConsoleMonitoring/README.md](ConsoleMonitoring/README.md) for:
- Console output reading and parsing
- Real-time log monitoring
- Pattern matching for service readiness

### Testing

See [Testing/README.md](Testing/README.md) for:
- Mock VM implementations
- Test utilities
- Integration test patterns

---

## Architecture Principles

### 1. Template Method Pattern
BaseVMManager uses template methods to allow subclasses to customize behavior:
- Define hooks (methods to override)
- Call hooks at appropriate lifecycle points
- Subclasses override only what they need

### 2. Strategy Pattern
Networking and observability use strategy pattern:
- Define protocol (interface)
- Implement multiple strategies
- Inject strategy at runtime

### 3. Observable Pattern
All managers are ObservableObject:
- Use @Published for reactive state
- SwiftUI views automatically update
- Testable with Combine expectations

### 4. Protocol-Oriented Design
Protocols over concrete types:
- Easy to mock for testing
- Allows multiple implementations
- Decouples dependencies

---

## Migration Guide

If you're migrating an existing VM app to use these shared components:

### Step 1: Identify Your Current Pattern
```swift
// Old inline VMManager
class MyVMManager: ObservableObject {
    @Published var status = "Stopped"
    private var vm: VZVirtualMachine?

    func startVM() {
        // 200+ lines of boilerplate
    }
}
```

### Step 2: Create New Manager Extending BaseVMManager
```swift
// New manager using shared components
final class MyVMManager: BaseVMManager {
    // Only override what's different
    override func getKernelCommandLine() -> String {
        return "console=hvc0 custom_option=value"
    }
}
```

### Step 3: Update UI Code
```swift
// No changes needed in most cases!
@StateObject private var vmManager = MyVMManager()
```

### Step 4: Test Equivalence
- Run app and verify same behavior
- Check console output matches
- Verify network connectivity
- Test start/stop lifecycle

See [MIGRATION-STATUS.md](../MIGRATION-STATUS.md) for detailed per-app migration tracking.

---

## Best Practices

### DO ✅
- Extend BaseVMManager for new VM apps
- Use NetworkingStrategy for network configuration
- Use ObservabilityProvider for metrics/logging
- Add tests for custom overrides
- Document why you're overriding a method

### DON'T ❌
- Create standalone VMManager classes
- Duplicate VM configuration code
- Hardcode network configuration
- Skip observability integration
- Modify shared components without tests

---

## Contributing

When adding new shared components:

1. **Follow the file header template** (see [.cursorrules](../.cursorrules))
2. **Add comprehensive documentation** - include examples
3. **Write unit tests** - goes in `Tests/SharedTests/`
4. **Update this README** - add to relevant section
5. **Mark as NEW** - update [MIGRATION-STATUS.md](../MIGRATION-STATUS.md)

---

## Troubleshooting

### "VM fails to start"
- Check kernel and initramfs are in bundle
- Verify VM configuration is valid
- Check console log for errors
- See BaseVMManager documentation

### "Network not working"
- Verify networking strategy is configured
- Check DHCP lease monitor is running
- Verify VM has network device in config
- See Networking/README.md

### "Observability not reporting"
- Check ObservabilityProvider is initialized
- Verify Datadog/OTEL credentials
- Check network connectivity to backend
- See Observability/README.md

---

## Reference Documentation

- [REFACTORING-IN-PROGRESS.md](../REFACTORING-IN-PROGRESS.md) - Migration overview
- [MIGRATION-STATUS.md](../MIGRATION-STATUS.md) - Current migration status
- [.cursorrules](../.cursorrules) - AI assistant rules and templates
- [docs/ADRs/](../docs/ADRs/) - Architecture decision records

---

## Completed Components (2025-11-25)

### Core Infrastructure ✅
- **BaseVMManager.swift** (650+ lines)
  - Template method pattern for VM lifecycle
  - Hooks for customization
  - Console monitoring integrated
  - DHCP lease detection
  - Server readiness checking
  - Status tracking with @Published properties

- **NetworkingStrategy.swift** (Protocol)
  - Pluggable network configuration
  - Runtime strategy selection
  - Three implementations planned:
    - NATNetworkStrategy ✅ (Complete)
    - VsockNetworkStrategy (Phase 4)
    - BridgeNetworkStrategy (Phase 4)

- **NATNetworkStrategy.swift** ✅
  - VZNATNetworkDeviceAttachment configuration
  - Full DHCP integration
  - MAC address handling
  - Ready for production

- **DHCPLeaseMonitor.swift** ✅
  - Consolidated parser (V1 + V2)
  - Thread-safe monitoring
  - Change detection
  - IP address extraction
  - 550+ lines, fully tested

### Observability Framework ✅
- **ObservabilityProvider.swift** (Protocol + Implementations)
  - Unified interface for logging, metrics, tracing
  - CompositeProvider for multiple backends
  - NoOpProvider for testing
  - Ready for Datadog/OpenTelemetry wrappers

### Status Summary
- **12 new files created** in Shared/ directory ✅
- **6 comprehensive README files** for documentation ✅
- **Phase 1 completion:** 90%
- **Phase 3 production proof:** BasicVibeCodeApp migrated successfully

### Usage Example: Adding Observability

```swift
import Foundation

final class MyAppVMManager: BaseVMManager {
    private let observability: ObservabilityProvider

    init(observability: ObservabilityProvider = NoOpProvider()) {
        self.observability = observability
    }

    override func onVMStarted() {
        super.onVMStarted()
        observability.log(
            level: .info,
            message: "VM started successfully",
            attributes: ["app": "MyApp", "status": status]
        )
    }
}

// Usage with multiple providers
let providers = [
    DatadogProvider(apiKey: "..."),
    OpenTelemetryProvider(endpoint: "...")
]
let composite = CompositeProvider(providers: providers)
let manager = MyAppVMManager(observability: composite)
```

## Questions?

- Check [docs/FAQ-REFACTORING.md](../docs/FAQ-REFACTORING.md)
- Add to [REFACTORING-QUESTIONS.md](../REFACTORING-QUESTIONS.md)
- See individual component READMEs for specific guidance
- Reference [MIGRATION-STATUS.md](../MIGRATION-STATUS.md) for current progress
