# VZ Scripts - Virtualization Framework

Swift scripts and tools for running VMs using Apple's native Virtualization.framework.

## Scripts

### ValkeyVM.swift (in Sources/VibeCode/Virtualization/)

Production-ready Swift class for managing Valkey VMs.

### test-valkey-vm.swift

Standalone test script for Valkey VM. **Note:** Requires entitlements, currently has runtime issues.

### valkey-vm-launcher.sh

Build and launch script with automatic entitlement signing. **Status:** Compiles but encounters runtime issues.

### demo-tahoe-vms.swift

Main orchestration demo showing unified VM management.

**Usage**:
```bash
# Direct execution
./demo-tahoe-vms.swift

# Or via Swift
swift demo-tahoe-vms.swift
```

**Features**:
- Starts 3 VMs in dependency order (Valkey → PostgreSQL → Node.js)
- Tracks startup performance metrics
- Displays connection information
- Performs graceful shutdown
- Simulates full VM lifecycle

**Output Example**:
```
╔══════════════════════════════════════════════════════════╗
║  VibeCode - macOS 26 Tahoe Exclusive Demo               ║
╚══════════════════════════════════════════════════════════╝

🚀 Starting all VMs in dependency order...
  ✅ Valkey VM started (2.13s)
  ✅ PostgreSQL VM started (3.19s)
  ✅ Node.js VM started (2.03s)

⚡ Total startup time: 7.35s

📡 Connection Information:
  valkey: redis://:vibecode@127.0.0.1:6379/0
  postgresql: postgresql://vibecode:***@127.0.0.1:5432/vibecode
  nodejs: http://127.0.0.1:3000 (debug: 9229)

✅ All VMs started successfully!
```

## Architecture

The demo implements a simplified version of the full VMOrchestrator:

```
demo-tahoe-vms.swift
├── VMProtocol
│   ├── start() async throws
│   ├── stop() async throws
│   ├── healthCheck() async -> Bool
│   └── connectionString: String
├── ValkeyVM: VMProtocol
├── PostgreSQLVM: VMProtocol
├── NodeJSVM: VMProtocol
└── VMOrchestrator
    ├── startAll()
    ├── stopAll()
    └── getConnectionInfo()
```

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| VM Protocol | ✅ Complete | Common interface for all VMs |
| Orchestrator | ✅ Complete | Dependency-aware startup |
| Valkey VM | ✅ Simulated | Stub implementation |
| PostgreSQL VM | ✅ Simulated | Stub implementation |
| Node.js VM | ✅ Simulated | Stub implementation |
| Performance Metrics | ✅ Complete | Tracks startup times |
| Health Checks | ✅ Complete | Returns stub data |

## Next Steps

1. **Replace Stubs**: Update with real Virtualization.framework code
2. **Add Error Handling**: Better error messages and recovery
3. **Progress Reporting**: Show VM startup progress
4. **Resource Monitoring**: Track CPU/memory usage
5. **Network Configuration**: Configure VM networking

## Real VM Implementation

The stubs in `demo-tahoe-vms.swift` will be replaced with real implementations from:
- `../Sources/VibeCode/Virtualization/ValkeyVM.swift`
- `../Sources/VibeCode/Virtualization/PostgreSQLVM.swift`
- `../Sources/VibeCode/Virtualization/NodeJSVM.swift`

These use actual `Virtualization.framework` APIs:
```swift
let config = VZVirtualMachineConfiguration()
config.cpuCount = 2
config.memorySize = 2 * 1024 * 1024 * 1024

let vm = VZVirtualMachine(configuration: config)
try await vm.start()
```

## Testing

### Manual Testing

```bash
# Run demo
./demo-tahoe-vms.swift

# Expected: All VMs start and stop successfully
# Expected: Performance metrics displayed
# Expected: Connection info shown
```

### Integration Testing

Once real VMs are available:

```bash
# Test Valkey
redis-cli -h 127.0.0.1 -p 6379 PING

# Test PostgreSQL
psql -h 127.0.0.1 -U vibecode -d vibecode -c "SELECT version()"

# Test Node.js
curl http://127.0.0.1:3000/health
```

## Performance Targets

| Metric | Target | Current (Simulated) |
|--------|--------|---------------------|
| Valkey startup | <5s | 2.1s |
| PostgreSQL startup | <10s | 3.2s |
| Node.js startup | <8s | 2.0s |
| Total startup | <30s | 7.4s |
| Memory usage | <8GB | 7GB |

## References

- Main integration: `../VM_INTEGRATION_REPORT.md`
- VM implementations: `../Sources/VibeCode/Virtualization/`
- Swift package: `../VibeCode-VMs/`

## Troubleshooting

### Script won't execute
```bash
chmod +x demo-tahoe-vms.swift
```

### Swift version errors
```bash
swift --version  # Should be 5.9+
```

### Virtualization.framework not found
Requires macOS 14+ (Sonoma). The Containerization.framework requires macOS 26 (Tahoe).

---

*Part of VibeCode VM Integration Project*
