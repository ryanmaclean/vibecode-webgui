# Changelog

All notable changes to VibeCode Services will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-01-17

### Fixed
- **Issue #790**: Fixed terminal commands failing in OpenVSCode Server with "not found" errors
  - Root cause: Node.js binary incompatibility (glibc vs musl) and PATH environment pollution
  - Solution 1: Replaced glibc Node.js with Alpine musl-compatible Node.js v25.3.0-r0
  - Solution 2: Implemented shell wrapper to restore correct PATH in terminal sessions
  - Impact: All standard commands (ls, cat, grep, etc.) now work correctly in OpenVSCode terminal

### Changed
- Updated build-unified-services-with-datadog.sh to use Alpine Node.js v25.3.0-r0 (musl-compatible)
- Enhanced Node.js replacement process with verification step
- Improved error handling for Node.js binary replacement

### Added
- Validation script validate-issue-790-fix.sh for automated testing of the fix
- Documentation of GAS (Generate-Assess-Synthesize) methodology used to solve Issue #790

## [1.4.0] - 2026-01-XX

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
