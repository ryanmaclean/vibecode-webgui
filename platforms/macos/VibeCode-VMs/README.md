# VibeCode VMs - Swift Package

Swift-based VM orchestration for VibeCode using Apple's Virtualization.framework.

## Quick Start

```bash
# Build
swift build

# Run demo
.build/debug/vibecode-vms demo

# Install
swift build -c release
sudo cp .build/release/vibecode-vms /usr/local/bin/
```

## Commands

```bash
vibecode-vms demo      # Run interactive demo
vibecode-vms start     # Start all VMs
vibecode-vms stop      # Stop all VMs
vibecode-vms status    # Show VM status
vibecode-vms help      # Show help
```

## Architecture

Three VMs managed by unified orchestrator:

1. **Valkey** (Redis-compatible cache)
   - 2 CPUs, 1GB RAM
   - Port: 6379

2. **PostgreSQL** (with pgvector)
   - 2 CPUs, 2GB RAM
   - Port: 5432

3. **Node.js** (development environment)
   - 4 CPUs, 4GB RAM
   - Ports: 3000, 9229

## Integration

### Swift API

```swift
import VibeCodeVMs

let orchestrator = VMOrchestrator()

// Start all VMs
try await orchestrator.startAll()

// Get connection info
let connections = orchestrator.getConnectionInfo()

// Health checks
let health = await orchestrator.healthCheck()

// Stop all
try await orchestrator.stopAll()
```

### SwiftUI Integration

```swift
@StateObject var orchestrator = VMOrchestrator()

var body: some View {
    ForEach(orchestrator.status.sorted(by: <), id: \.key) { name, status in
        VMStatusRow(name: name, status: status)
    }
}
```

## File Locations

Main implementations:
- `../Sources/VibeCode/Virtualization/VMOrchestrator.swift`
- `../Sources/VibeCode/Virtualization/ValkeyVM.swift`
- `../Sources/VibeCode/Virtualization/PostgreSQLVM.swift`
- `../Sources/VibeCode/Virtualization/NodeJSVM.swift`

Demo scripts:
- `../scripts/vz/demo-tahoe-vms.swift`

## Requirements

- macOS 14.0+ (Sonoma)
- macOS 26.0+ for Containerization.framework (future)
- Apple Silicon (for Rosetta 2 support)
- Xcode Command Line Tools

## Performance

Target performance with real VMs:
- Valkey: <5s startup
- PostgreSQL: <10s startup
- Node.js: <8s startup
- **Total: <30s for full stack**

## Development

### Building

```bash
swift build                 # Debug build
swift build -c release      # Release build
```

### Testing

```bash
swift test                  # Run tests (when added)
```

### Cleaning

```bash
swift package clean
rm -rf .build/
```

## Status

Current: ✅ Demo working, stub implementations
Next: Complete VM builds in Alpine VM
Future: Migrate to Containerization.framework (macOS 26 Tahoe)

## Documentation

See `../VM_INTEGRATION_REPORT.md` for comprehensive documentation.

## License

Part of VibeCode project.
