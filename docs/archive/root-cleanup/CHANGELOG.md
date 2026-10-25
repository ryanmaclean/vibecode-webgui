# Changelog

All notable changes to VibeCode Services will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-01-17

### Added
- **Apple Virtualization Framework**: Native macOS VM support with full Virtualization.framework integration (macOS 12.0+)
- **ASIF Disk Format**: Apple Sparse Image Format support on macOS 26+ Tahoe for 2-3x faster I/O (1.6 GB/s write, 3.7 GB/s read)
- **Multi-Runtime Abstraction**: Unified container runtime support for Docker, Podman, Kubernetes, and Apple Containers
- **VM Lifecycle Management**: Complete VM orchestration with JSON-RPC protocol between TypeScript and Swift
- **Linux GUI VMs**: Full graphics support with VirtIO GPU, EFI boot, and display management
- **Native VM Provider**: TypeScript provider implementation with Swift backend for direct Virtualization.framework access
- **VM Test Coverage**: Comprehensive unit tests for Apple container runtime and VM orchestration

### Fixed
- **Issue #790**: Fixed terminal commands failing in OpenVSCode Server with "not found" errors
  - Root cause: Node.js binary incompatibility (glibc vs musl) and PATH environment pollution
  - Solution 1: Replaced glibc Node.js with Alpine musl-compatible Node.js v25.3.0-r0
  - Solution 2: Implemented shell wrapper to restore correct PATH in terminal sessions
  - Impact: All standard commands (ls, cat, grep, etc.) now work correctly in OpenVSCode terminal

### Changed
- Updated build-unified-services-with-datadog.sh to use Alpine Node.js v25.3.0-r0 (musl-compatible)
  - Script location: `platforms/azure/azure/build-unified-services-with-datadog.sh`
- Enhanced Node.js replacement process with verification step
- Improved error handling for Node.js binary replacement

### Documentation
- Added comprehensive Apple Virtualization Framework feature documentation
- Created ASIF_VZ_STATUS.md for implementation status tracking
- Added apple-vf-fastboot.md for EFI-stub fast boot optimization guide
- Documented JSON-RPC protocol in NATIVE_VM_README.md
- Updated release notes with Platform & Virtualization section

## [1.4.0] - 2026-01-31

### Added
- Initial release of unified services VM
- OpenVSCode Server integration
- Valkey (Redis-compatible) service
- PostgreSQL database service
- Datadog monitoring integration
- SwiftUI menubar application for macOS
- Virtualization framework integration
- NAT networking with automatic IP detection
- DHCP lease monitoring

### Technical Details
- Alpine Linux-based initramfs
- BusyBox for core utilities
- musl libc environment
- ARM64 (Apple Silicon) architecture support
