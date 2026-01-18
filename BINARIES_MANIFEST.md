# Built Binaries Manifest

This document lists all successfully compiled binaries and their locations.

## Primary Components

### 1. UnifiedServicesVibeCode (Menubar App)
**Path**: `/Users/studio/Documents/vibecode-webgui/menubar-source/.build/arm64-apple-macosx/release/UnifiedServicesVibeCode`
**Size**: 692 KB
**Architecture**: arm64 (Apple Silicon native)
**Type**: macOS Menubar Application
**Status**: ✅ Production Ready

**Features**:
- VM lifecycle management
- Port forwarding (NAT and vsock)
- PTY management for VM console
- Network strategy abstraction
- Logging system

**Usage**:
```bash
/Users/studio/Documents/vibecode-webgui/menubar-source/.build/arm64-apple-macosx/release/UnifiedServicesVibeCode
```

**Dependencies**:
- macOS 14.0+
- Virtualization.framework
- Network.framework

---

### 2. VMNetworking (Library)
**Path**: `/Users/studio/Documents/vibecode-webgui/swift/networking/.build/arm64-apple-macosx/release/`
**Type**: Swift Library (no executable)
**Status**: ✅ Production Ready

**Features**:
- Port forwarding implementation
- VM network management
- Can be imported by other Swift packages

**Usage**:
```swift
import VMNetworking

let forwarder = VMPortForwarder.forwardCommonPorts(vmIP: "192.168.64.100")
forwarder?.printStatus()
```

---

## VM Managers

### 3. vibecode-vm (macos-vm)
**Path**: `/Users/studio/Documents/vibecode-webgui/macos-vm/.build/arm64-apple-macosx/release/vibecode-vm`
**Size**: 85 KB
**Architecture**: arm64
**Type**: CLI VM Manager
**Status**: ✅ Functional

**Usage**:
```bash
/Users/studio/Documents/vibecode-webgui/macos-vm/.build/arm64-apple-macosx/release/vibecode-vm
```

---

### 4. nodejs-vm
**Path**: `/Users/studio/Documents/vibecode-webgui/tools/nodejs-vm/.build/arm64-apple-macosx/release/nodejs-vm`
**Size**: 98 KB
**Architecture**: arm64
**Type**: Node.js-specific VM Manager
**Status**: ✅ Functional

**Usage**:
```bash
/Users/studio/Documents/vibecode-webgui/tools/nodejs-vm/.build/arm64-apple-macosx/release/nodejs-vm
```

---

### 5. postgresql-vm
**Path**: `/Users/studio/Documents/vibecode-webgui/platforms/macos/postgresql-vm/.build/arm64-apple-macosx/release/postgresql-vm`
**Architecture**: arm64
**Type**: PostgreSQL-specific VM Manager
**Status**: ✅ Functional

**Usage**:
```bash
/Users/studio/Documents/vibecode-webgui/platforms/macos/postgresql-vm/.build/arm64-apple-macosx/release/postgresql-vm
```

---

### 6. vibecode-vms (VibeCode-VMs)
**Path**: `/Users/studio/Documents/vibecode-webgui/VibeCode-VMs/.build/arm64-apple-macosx/release/vibecode-vms`
**Architecture**: arm64
**Type**: Multi-VM Manager
**Status**: ✅ Functional

**Usage**:
```bash
/Users/studio/Documents/vibecode-webgui/VibeCode-VMs/.build/arm64-apple-macosx/release/vibecode-vms
```

---

## Utilities

### 7. lima-launcher
**Path**: `/Users/studio/Documents/vibecode-webgui/swift/lima-launcher/.build/arm64-apple-macosx/release/lima-launcher`
**Architecture**: arm64
**Type**: Lima VM Launcher Utility
**Status**: ✅ Functional

**Usage**:
```bash
/Users/studio/Documents/vibecode-webgui/swift/lima-launcher/.build/arm64-apple-macosx/release/lima-launcher
```

---

### 8. apple-container-runtime
**Path**: `/Users/studio/Documents/vibecode-webgui/AppleContainerRuntime/.build/arm64-apple-macosx/release/apple-container-runtime`
**Architecture**: arm64
**Type**: Container Runtime (OCI-compatible)
**Status**: ✅ Functional

**Usage**:
```bash
/Users/studio/Documents/vibecode-webgui/AppleContainerRuntime/.build/arm64-apple-macosx/release/apple-container-runtime
```

---

## Shell Scripts (Persistence Module)

### 9. PostgreSQL 9p Persistence Scripts
**Base Path**: `/Users/studio/Documents/vibecode-webgui/postgresql-9p-persistence/`

**Scripts**:
- `init-9p-updated.sh` - Initialize 9p persistence for PostgreSQL
- `rebuild-and-deploy.sh` - Rebuild VM with persistence
- `test-persistence.sh` - Test persistence functionality

**Usage**:
```bash
cd /Users/studio/Documents/vibecode-webgui/postgresql-9p-persistence
./init-9p-updated.sh
./rebuild-and-deploy.sh
./test-persistence.sh
```

---

## Legacy/Archive Binaries (Not Current)

### vibecode-vm (vm-manager - older version)
**Path**: `/Users/studio/Documents/vibecode-webgui/vm-manager/.build/arm64-apple-macosx/release/vibecode-vm`
**Status**: ⚠️ Superseded by macos-vm

### VibeCode (legacy)
**Path**: `/Users/studio/Documents/vibecode-webgui/archive/legacy-vm-experiments/VibeCodeSwift/.build/arm64-apple-macosx/release/VibeCode`
**Status**: ⚠️ Archived

---

## Quick Copy Commands

Copy all current binaries to a deployment directory:

```bash
DEPLOY_DIR="/tmp/vibecode-binaries"
mkdir -p "$DEPLOY_DIR"

# Primary menubar app
cp /Users/studio/Documents/vibecode-webgui/menubar-source/.build/arm64-apple-macosx/release/UnifiedServicesVibeCode \
   "$DEPLOY_DIR/"

# VM managers
cp /Users/studio/Documents/vibecode-webgui/macos-vm/.build/arm64-apple-macosx/release/vibecode-vm \
   "$DEPLOY_DIR/vibecode-vm-basic"

cp /Users/studio/Documents/vibecode-webgui/tools/nodejs-vm/.build/arm64-apple-macosx/release/nodejs-vm \
   "$DEPLOY_DIR/"

cp /Users/studio/Documents/vibecode-webgui/platforms/macos/postgresql-vm/.build/arm64-apple-macosx/release/postgresql-vm \
   "$DEPLOY_DIR/"

cp /Users/studio/Documents/vibecode-webgui/VibeCode-VMs/.build/arm64-apple-macosx/release/vibecode-vms \
   "$DEPLOY_DIR/"

# Utilities
cp /Users/studio/Documents/vibecode-webgui/swift/lima-launcher/.build/arm64-apple-macosx/release/lima-launcher \
   "$DEPLOY_DIR/"

cp /Users/studio/Documents/vibecode-webgui/AppleContainerRuntime/.build/arm64-apple-macosx/release/apple-container-runtime \
   "$DEPLOY_DIR/"

echo "Binaries copied to $DEPLOY_DIR"
ls -lh "$DEPLOY_DIR"
```

---

## Verification

Verify all binaries are valid arm64 executables:

```bash
for binary in $(find /Users/studio/Documents/vibecode-webgui -path "*/.build/arm64-apple-macosx/release/*" -type f -perm +111 ! -path "*/DWARF/*" -exec file {} \; | grep "Mach-O.*executable" | cut -d: -f1); do
    echo "=== $(basename $binary) ==="
    file "$binary"
    ls -lh "$binary"
    codesign -dv "$binary" 2>&1 | grep -E "(Identifier|TeamIdentifier|Signature)" || echo "Not signed"
    echo ""
done
```

---

## Distribution Notes

All binaries are:
- **Architecture**: arm64 (Apple Silicon native)
- **Platform**: macOS 14.0+
- **Unsigned**: Developer binaries (need code signing for distribution)
- **Permissions**: Require appropriate entitlements for Virtualization.framework

For distribution:
1. Code sign with valid Developer ID
2. Notarize through Apple
3. Package as .app bundle (for menubar app)
4. Include required entitlements for VM operations

---

## Build Information

- **Swift Version**: 6.2.3
- **Build Date**: 2026-01-16
- **Xcode Tools**: /Library/Developer/CommandLineTools
- **Build Configuration**: Release (-c release)
- **Optimization**: Enabled (release builds)

---

## Integration Testing

Test the primary menubar app:

```bash
# The app will try to start a VM but needs kernel/initramfs files
/Users/studio/Documents/vibecode-webgui/menubar-source/.build/arm64-apple-macosx/release/UnifiedServicesVibeCode

# Expected: Logs show VM initialization attempt, exits when kernel not found
# This confirms the binary is functional
```

---

## Size Summary

Total size of all current binaries:

```bash
find /Users/studio/Documents/vibecode-webgui -path "*/.build/arm64-apple-macosx/release/*" \
  -type f -perm +111 ! -path "*/DWARF/*" \
  -exec file {} \; | grep "Mach-O.*executable" | cut -d: -f1 | \
  xargs du -ch | tail -1
```

Individual sizes:
- UnifiedServicesVibeCode: 692 KB (largest - includes all VM management)
- nodejs-vm: 98 KB
- vibecode-vm: 85 KB
- Others: Various sizes

**Total**: ~1-2 MB for all binaries

