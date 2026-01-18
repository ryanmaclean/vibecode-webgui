# Legacy VM Experiments Archive

This directory contains early experiments with Apple Virtualization.framework, Lima, and Docker integration. These have been superseded by production implementations.

## Superseded By

- `/menubar/` - Production SwiftUI menubar apps using pure Apple Virtualization.framework
- `/AppleContainerRuntime/` - Native OCI container runtime (Docker-compatible, no Docker required)
- `/vm-manager/` - JSON-RPC VM control binary

## Archived Components

### Lima Integration (Superseded)

**`lima-launcher/`** - Lima CLI wrapper
- **What it was**: Swift wrapper around Lima VM launcher
- **Why archived**: Lima is a third-party tool that wraps vfkit/QEMU. We now use VZVirtualMachine directly.
- **Superseded by**: `/menubar/Shared/Core/VirtualizationManager.swift` - Direct VZ API usage

### Early VZ Experiments (Superseded)

**`vz-swift/`** - Early Virtualization.framework experiments
- **What it was**: Initial experiments with Apple's Virtualization.framework
- **Why archived**: Proof-of-concept code replaced by production implementation
- **Superseded by**: `/menubar/Shared/Core/BaseVMManager.swift` - Production VM template pattern

**`vz-test-scripts/`** - Test scripts (33 files, 728KB)
- **What it was**: Alpine VM demos, test VMs, initramfs experiments
- **Why archived**: Ad-hoc test scripts replaced by structured test suite
- **Superseded by**: `/menubar/Tests/` - Comprehensive test infrastructure

**`vm-native.swift`** - Standalone VM test script
- **What it was**: Single-file VM demonstration
- **Why archived**: Superseded by modular architecture
- **Superseded by**: BaseVMManager pattern with specialized apps

### Docker Integration (Superseded)

**`VibeCodeSwift/`** - Docker VM wrapper (491MB with build artifacts)
- **What it was**: Swift package wrapping Docker for macOS VM management
- **Why archived**: Docker dependency eliminated - native OCI runtime built instead
- **Superseded by**: `/AppleContainerRuntime/` - Native Swift OCI container runtime

**`platforms-macos-native-build/`** - Docker build integration
- **What it was**: Tool to integrate Docker builds with native macOS builds
- **Why archived**: No longer need Docker for builds
- **Superseded by**: Native Swift Package Manager builds in menubar apps

**`macos-native-build/`** - Dockerfile parser (104KB)
- **What it was**: Parsed Dockerfiles to extract build instructions for native builds
- **Why archived**: No Dockerfiles in production architecture
- **Superseded by**: Swift Package Manager with direct dependency management

### Specialized VM Experiments (Superseded)

**`nodejs-vm/`** - Node.js VM experiment
- **What it was**: Early experiment running Node.js in a dedicated VM
- **Why archived**: Replaced by production app with proper architecture
- **Superseded by**: `/menubar/Apps/NodeJSVibeCodeApp/` - Production Node.js menubar app

**`postgresql-vm/`** - PostgreSQL VM experiment
- **What it was**: Early experiment running PostgreSQL in a dedicated VM
- **Why archived**: Replaced by production app with proper architecture
- **Superseded by**: `/menubar/Apps/PostgreSQLVibeCodeApp/` - Production PostgreSQL menubar app

### Old VM Architecture (Superseded)

**`Sources/VibeCode/`** - Old VM classes
- **What it was**: Original VM implementation before menubar architecture
- **Why archived**: Monolithic design replaced by BaseVMManager template pattern
- **Superseded by**: `/menubar/Shared/Core/BaseVMManager.swift` - Reusable VM template

**`swift-vm/`** & **`swift-vm-orchestration/`**
- **What it was**: Early VM management and orchestration code
- **Why archived**: Ad-hoc implementations replaced by standardized patterns
- **Superseded by**: BaseVMManager with JSON-RPC control via `/vm-manager/`

**`lima-config/`** - Lima configuration files
- **What it was**: YAML configurations for Lima VMs
- **Why archived**: No longer using Lima
- **Superseded by**: Swift-based VM configuration in BaseVMManager

## Why Archived

1. **No external dependencies**: Native Virtualization.framework eliminates need for Lima/vfkit/Docker
2. **Better architecture**: BaseVMManager template pattern replaced ad-hoc implementations
3. **Container support**: AppleContainerRuntime provides Docker-like experience natively
4. **Production ready**: Menubar apps are tested, documented, and production-grade
5. **Reduced complexity**: 491MB+ of experimental code replaced by focused production code
6. **Single responsibility**: Each app has clear purpose instead of monolithic experiments

## Architecture Evolution

### Before (Archived)
```
- Lima (third-party) wraps vfkit/QEMU
- Docker Desktop required for containers
- Ad-hoc VM implementations per use case
- Monolithic VibeCode package
- Shell scripts for VM management
```

### After (Production)
```
- Direct VZVirtualMachine usage (Apple native)
- AppleContainerRuntime (Docker-compatible, no Docker needed)
- BaseVMManager template pattern
- Specialized menubar apps per service
- JSON-RPC vm-manager binary
```

## Key Production Components

### Menubar Apps (Keep)
- `/menubar/Apps/OpenVSCodeVibeCodeApp/` - OpenVSCode Server in VM
- `/menubar/Apps/PostgreSQLVibeCodeApp/` - PostgreSQL in VM
- `/menubar/Apps/NodeJSVibeCodeApp/` - Node.js in VM
- All use `BaseVMManager` template pattern
- All use pure Apple Virtualization.framework

### Core VM Infrastructure (Keep)
- `/menubar/Shared/Core/BaseVMManager.swift` - VM template pattern
- `/menubar/Shared/Core/VirtualizationManager.swift` - VZ lifecycle management
- `/vm-manager/` - JSON-RPC control binary
- `/scripts/initramfs-builder/` - Kernel/initramfs setup (still needed)

### Container Runtime (Keep)
- `/AppleContainerRuntime/` - Native OCI container runtime
- Docker-compatible API
- No Docker Desktop required
- Uses Virtualization.framework for isolation

## File Size Reduction

**Total archived**: ~492MB (primarily VibeCodeSwift .build artifacts)
- VibeCodeSwift: 491MB
- vz-test-scripts: 728KB
- Other directories: ~1MB

## Date Archived
2026-01-15 by AGENT 169

## Commit Reference
- Branch: main
- Before archival: 111,714 files (including node_modules, data, test-results)
- User confirmed: All archived code is no longer needed
- Reason: Native Apple Virtualization.framework implementations are production-ready

## How to Restore (If Needed)

If you need to reference this code:
```bash
# View archived code
cd archive/legacy-vm-experiments/

# Restore specific directory (creates new branch)
git checkout -b restore-xyz
git mv archive/legacy-vm-experiments/xyz ./xyz
git commit -m "Restore xyz from archive"
```

## Production Code Documentation

See production documentation:
- `/menubar/README.md` - Menubar apps overview
- `/menubar/docs/ARCHITECTURE.md` - BaseVMManager pattern
- `/AppleContainerRuntime/README.md` - OCI container runtime
- `/vm-manager/README.md` - JSON-RPC control protocol

## Questions?

If you're wondering whether to use archived code:
1. Check `/menubar/Apps/` first - likely already implemented
2. Check `/menubar/Shared/Core/BaseVMManager.swift` - template for new VMs
3. Check `/AppleContainerRuntime/` - for container-based workloads
4. Only restore from archive if absolutely necessary (rare)
