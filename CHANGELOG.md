# Changelog

## [Unreleased] - 2025-10-31

### Added
- Native Swift 5 + SwiftUI macOS application for VM management
- Apple Virtualization.framework integration for running Linux VMs
- VM discovery system for automatic detection of VM images
- Auto-start functionality for designated VMs
- Datadog agent integration (3 solutions: SSH, cloud-init, Lima provisioning)
- Parallel VM build system for faster image creation
- Secure Datadog API key management

### Fixed
- VZ disk attachment configuration (now uses synchronizationMode)
- VM startup crashes by implementing dedicated serial dispatch queue
- EFI NVRAM file discovery with correct naming pattern
- App sandbox issues for VM image access
- SwiftUI state management for VM list updates

### Technical Details
- Uses VZDiskImageStorageDeviceAttachment with explicit synchronizationMode (.full)
- Implements proper VZVirtualMachine queue management
- Supports UEFI boot with VZEFIBootLoader
- RAW disk images with APFS sparse file support

### Dependencies
- macOS 13.0+ required
- Swift 5.9+
- Virtualization.framework entitlement

## VM Images
- vibecode-postgresql (10GB)
- vibecode-valkey (10GB)
- vibecode-nodejs (50GB)
- vibecode-nodejs-codeserver (50GB)
- vibecode-pgvector (20GB)
- vibecode-ide (50GB)

All VMs configured with:
- Alpine Linux 3.22
- UEFI boot
- Virtio block devices
- NAT networking
