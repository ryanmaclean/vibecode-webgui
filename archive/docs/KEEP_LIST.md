# KEEP LIST - Essential Files for VibeCode Menubar

**Generated:** 2026-01-14
**Purpose:** The ONLY files that should remain in the cleaned-up repository

---

## Summary

These files represent the **absolute minimum** needed to build and run VibeCode:
A macOS menubar app that boots OpenVSCode Server in a VM.

**Total Files:** ~50 essential files
**Total Size:** ~15MB (without build artifacts)

---

## File Inventory

### Root Directory (6 files)

```
/Users/studio/Documents/vibecode-webgui/
├── README.md                    # NEW: 50-line overview
├── CHANGELOG.md                 # KEEP: Version history
├── LICENSE                      # KEEP: MIT license
├── package.json                 # SIMPLIFY: 20 lines, build scripts only
├── .gitignore                   # SIMPLIFY: Essential ignores only
└── .gitmodules                  # KEEP: vfkit submodule reference
```

**Actions:**
- **README.md** - Rewrite to 50 lines (see template below)
- **CHANGELOG.md** - Keep as-is
- **LICENSE** - Keep as-is
- **package.json** - Simplify to 20 lines (see template below)
- **.gitignore** - Simplify to essentials (see template below)
- **.gitmodules** - Keep for vfkit submodule

---

## menubar/ Directory (formerly azure/SwiftUI-Apps/)

### Action Required
```bash
mv azure/SwiftUI-Apps menubar
rm -rf azure
```

### Files to Keep

#### Apps/UnifiedVibeCode/ (2 files)
```
menubar/Apps/UnifiedVibeCode/
├── UnifiedVibeCodeApp.swift         # Main app entry point
└── UnifiedVMManager.swift           # VM lifecycle management
```

**Paths:**
- `/Users/studio/Documents/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVibeCodeApp.swift`
- `/Users/studio/Documents/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVMManager.swift`

**Rename:**
- `UnifiedServicesVibeCodeApp.swift` → `UnifiedVibeCodeApp.swift`
- `UnifiedServicesVMManager.swift` → `UnifiedVMManager.swift`
- Directory: `UnifiedServicesVibeCodeApp/` → `UnifiedVibeCode/`

#### Shared/Core/ (3 files)
```
menubar/Shared/Core/
├── BaseVMManager.swift              # Base VM abstraction
├── VMLogger.swift                   # Logging functionality
└── PTYManager.swift                 # PTY/console handling
```

**Paths:**
- `/Users/studio/Documents/vibecode-webgui/azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift`
- `/Users/studio/Documents/vibecode-webgui/azure/SwiftUI-Apps/Shared/Core/VMLogger.swift`
- `/Users/studio/Documents/vibecode-webgui/azure/SwiftUI-Apps/Shared/Core/PTYManager.swift`

#### Resources/ (3 files)
```
menubar/Resources/
├── vmlinuz                          # Linux kernel (~10MB)
├── initramfs.cpio.gz                # Root filesystem with OpenVSCode (~200MB)
└── datadog-extension.vsix           # Datadog VSCode extension (~5MB)
```

**Note:** These files may not exist yet - they need to be built.

#### Build Files (2 files)
```
menubar/
├── build-unified-menubar.sh         # Build script
└── entitlements.plist               # macOS entitlements
```

**Paths:**
- `/Users/studio/Documents/vibecode-webgui/azure/SwiftUI-Apps/build-unified-menubar.sh`
- `/Users/studio/Documents/vibecode-webgui/azure/SwiftUI-Apps/entitlements.plist`

#### Project File (1 directory - keep entire structure)
```
menubar/VibeCode.xcodeproj/          # Xcode project (generated/managed)
```

**Note:** May need to be regenerated or renamed from existing project.

**Total in menubar/:** ~11 files + xcodeproj

---

## vm/ Directory (formerly platforms/macos/vm/)

### Action Required
```bash
mv platforms/macos/vm vm
rm -rf platforms
```

### Files to Keep

```
vm/
├── Package.swift                    # Swift package definition
└── Sources/
    └── main.swift                   # Native VM runner
```

**Paths:**
- `/Users/studio/Documents/vibecode-webgui/platforms/macos/vm/Package.swift`
- `/Users/studio/Documents/vibecode-webgui/platforms/macos/vm/Sources/main.swift`

**Total in vm/:** 2 files

---

## scripts/ Directory (consolidated from multiple locations)

### Action Required
```bash
mkdir scripts
cp scripts/initramfs-builder/02-download-alpine-kernel.sh scripts/download-kernel.sh
cp scripts/initramfs-builder/12-create-vscode-server-rootfs.sh scripts/build-initramfs.sh
cp scripts/initramfs-builder/13-launch-vscode-server-vm.sh scripts/launch-vm.sh
# Install script may need to be created
```

### Files to Keep (4-5 files)

```
scripts/
├── download-kernel.sh               # Download Alpine Linux kernel
├── build-initramfs.sh               # Build initramfs with OpenVSCode
├── launch-vm.sh                     # Test VM launch
├── install-datadog.sh               # Install Datadog extension (may need creation)
└── build-all.sh                     # Optional: orchestrate full build
```

**Source Paths:**
- `/Users/studio/Documents/vibecode-webgui/scripts/initramfs-builder/02-download-alpine-kernel.sh`
- `/Users/studio/Documents/vibecode-webgui/scripts/initramfs-builder/12-create-vscode-server-rootfs.sh`
- `/Users/studio/Documents/vibecode-webgui/scripts/initramfs-builder/13-launch-vscode-server-vm.sh`

**Total in scripts/:** 4-5 files

---

## vendor/ Directory (git submodule)

### Files to Keep

```
vendor/vfkit/                        # vfkit CLI tool (git submodule)
```

**Path:**
- `/Users/studio/Documents/vibecode-webgui/vendor/vfkit/` (submodule)

**Keep as git submodule** - managed by `.gitmodules`

---

## Complete File Tree

```
vibecode-menubar/
├── README.md                                    # 1
├── CHANGELOG.md                                 # 2
├── LICENSE                                      # 3
├── package.json                                 # 4
├── .gitignore                                   # 5
├── .gitmodules                                  # 6
│
├── menubar/                                     # Renamed from azure/SwiftUI-Apps
│   ├── Apps/
│   │   └── UnifiedVibeCode/
│   │       ├── UnifiedVibeCodeApp.swift        # 7
│   │       └── UnifiedVMManager.swift          # 8
│   ├── Shared/
│   │   └── Core/
│   │       ├── BaseVMManager.swift             # 9
│   │       ├── VMLogger.swift                  # 10
│   │       └── PTYManager.swift                # 11
│   ├── Resources/
│   │   ├── vmlinuz                             # 12 (~10MB)
│   │   ├── initramfs.cpio.gz                   # 13 (~200MB)
│   │   └── datadog-extension.vsix              # 14 (~5MB)
│   ├── VibeCode.xcodeproj/                     # 15 (project bundle)
│   ├── build-unified-menubar.sh                # 16
│   └── entitlements.plist                      # 17
│
├── vm/                                          # Moved from platforms/macos/vm
│   ├── Package.swift                           # 18
│   └── Sources/
│       └── main.swift                          # 19
│
├── scripts/                                     # Consolidated
│   ├── download-kernel.sh                      # 20
│   ├── build-initramfs.sh                      # 21
│   ├── launch-vm.sh                            # 22
│   └── install-datadog.sh                      # 23
│
└── vendor/                                      # Git submodule
    └── vfkit/                                   # 24 (submodule)
```

**Total: 24 essential files + xcodeproj + vfkit submodule**

---

## File Templates

### README.md (50 lines)

```markdown
# VibeCode

**OpenVSCode Server in a macOS Menubar**

A simple macOS menubar app that runs OpenVSCode Server in a VM using Apple's Virtualization framework.

## What It Does

- Boots an Alpine Linux VM instantly
- Runs OpenVSCode Server with Datadog extension
- Accessible from menubar icon
- Launches in ~3 seconds

## Requirements

- macOS 13.0 or later
- Xcode 15.0 or later
- 2GB available RAM

## Quick Start

```bash
# Build the menubar app
./menubar/build-unified-menubar.sh

# Run
open ./menubar/build/VibeCode.app
```

## Architecture

- **SwiftUI menubar app** - Native macOS interface
- **Virtualization.framework** - Apple's native VM framework
- **Alpine Linux VM** - Minimal Linux (50MB initramfs)
- **OpenVSCode Server** - Browser-based VSCode
- **Datadog extension** - Pre-installed monitoring

## Build from Scratch

```bash
# 1. Download kernel
./scripts/download-kernel.sh

# 2. Build initramfs (includes OpenVSCode + Datadog)
./scripts/build-initramfs.sh

# 3. Build menubar app
./menubar/build-unified-menubar.sh
```

## License

MIT - See [LICENSE](LICENSE)
```

---

### package.json (20 lines)

```json
{
  "name": "vibecode-menubar",
  "version": "1.0.0",
  "description": "OpenVSCode Server in a macOS menubar",
  "scripts": {
    "build:menubar": "./menubar/build-unified-menubar.sh",
    "build:initramfs": "./scripts/build-initramfs.sh",
    "build:vm": "swift build --package-path vm",
    "download:kernel": "./scripts/download-kernel.sh",
    "test:vm": "./scripts/launch-vm.sh",
    "build:all": "npm run download:kernel && npm run build:initramfs && npm run build:menubar"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/vibecode-menubar"
  },
  "license": "MIT",
  "author": "Your Name"
}
```

---

### .gitignore (essential only)

```gitignore
# Build artifacts
.build/
build/
DerivedData/
*.app
*.xcarchive

# Swift
*.swiftmodule
*.swiftdoc

# VM assets (large files - build locally)
menubar/Resources/vmlinuz
menubar/Resources/initramfs.cpio.gz
menubar/Resources/*.img

# Runtime
logs/
*.log

# macOS
.DS_Store
._*

# IDE
.vscode/
.idea/
```

---

## Migration Commands

### 1. Reorganize Directories

```bash
cd /Users/studio/Documents/vibecode-webgui

# Create new structure
mkdir -p menubar/Apps/UnifiedVibeCode
mkdir -p menubar/Shared/Core
mkdir -p menubar/Resources
mkdir -p vm/Sources
mkdir -p scripts

# Move menubar app
mv azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVibeCodeApp.swift \
   menubar/Apps/UnifiedVibeCode/UnifiedVibeCodeApp.swift
mv azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVMManager.swift \
   menubar/Apps/UnifiedVibeCode/UnifiedVMManager.swift

# Move shared code
mv azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift menubar/Shared/Core/
mv azure/SwiftUI-Apps/Shared/Core/VMLogger.swift menubar/Shared/Core/
mv azure/SwiftUI-Apps/Shared/Core/PTYManager.swift menubar/Shared/Core/

# Move build files
mv azure/SwiftUI-Apps/build-unified-menubar.sh menubar/
mv azure/SwiftUI-Apps/entitlements.plist menubar/

# Move VM
mv platforms/macos/vm/Package.swift vm/
mv platforms/macos/vm/Sources/main.swift vm/Sources/

# Move scripts
cp scripts/initramfs-builder/02-download-alpine-kernel.sh scripts/download-kernel.sh
cp scripts/initramfs-builder/12-create-vscode-server-rootfs.sh scripts/build-initramfs.sh
cp scripts/initramfs-builder/13-launch-vscode-server-vm.sh scripts/launch-vm.sh
chmod +x scripts/*.sh
```

### 2. Update Root Files

```bash
# Backup originals
mv README.md README.md.old
mv package.json package.json.old
mv .gitignore .gitignore.old

# Create new files (use templates above)
cat > README.md << 'EOF'
[paste README template]
EOF

cat > package.json << 'EOF'
[paste package.json template]
EOF

cat > .gitignore << 'EOF'
[paste .gitignore template]
EOF
```

### 3. Update Swift Imports

Update imports in Swift files to reflect new structure:

```swift
// In UnifiedVibeCodeApp.swift
import SwiftUI

// In UnifiedVMManager.swift
import Foundation
import Virtualization

// Imports from Shared/Core should still work
// as they're in the same module
```

### 4. Update Build Script

Update `menubar/build-unified-menubar.sh` with new paths:

```bash
#!/bin/bash
set -e

PROJECT_ROOT="/Users/studio/Documents/vibecode-webgui"
MENUBAR_DIR="$PROJECT_ROOT/menubar"

# Update any paths that referenced azure/SwiftUI-Apps
# to use menubar/
```

---

## Verification Checklist

After reorganization, verify:

### File Structure
- [ ] Only 3 main directories: `menubar/`, `vm/`, `scripts/`
- [ ] Root has ~10 files
- [ ] No `src/`, `docker/`, `k8s/`, `tests/` directories
- [ ] `azure/` directory removed
- [ ] `platforms/` directory removed

### Build
- [ ] `./menubar/build-unified-menubar.sh` runs without errors
- [ ] Swift imports resolve correctly
- [ ] No missing file errors

### Files
- [ ] All 24 essential files present
- [ ] No extra files in root
- [ ] Resources directory exists (may be empty until built)

### Git
- [ ] `.gitignore` works (no ignored files in `git status`)
- [ ] `.gitmodules` references vfkit correctly
- [ ] Git history intact

---

## Why These Files?

### UnifiedVibeCodeApp.swift
**Reason:** Main entry point for the menubar app. Creates the menubar UI and coordinates with VMManager.

### UnifiedVMManager.swift
**Reason:** Manages VM lifecycle (start, stop, status). Interfaces with Virtualization.framework.

### BaseVMManager.swift
**Reason:** Abstract base class for VM management. Provides common functionality used by UnifiedVMManager.

### VMLogger.swift
**Reason:** Centralized logging for VM operations. Helps with debugging and monitoring.

### PTYManager.swift
**Reason:** Manages pseudo-terminal for VM console access. Needed for VM I/O.

### vmlinuz
**Reason:** Linux kernel binary. Required to boot the VM.

### initramfs.cpio.gz
**Reason:** Root filesystem containing OpenVSCode Server, Datadog extension, and all dependencies. This is the entire VM environment.

### datadog-extension.vsix
**Reason:** Datadog VSCode extension. Installed into OpenVSCode during initramfs build.

### VibeCode.xcodeproj
**Reason:** Xcode project file. Defines how to build the menubar app.

### build-unified-menubar.sh
**Reason:** Build automation for the menubar app. Simplifies the build process.

### entitlements.plist
**Reason:** macOS code signing entitlements. Required for Virtualization.framework access.

### Package.swift (vm/)
**Reason:** Defines the native VM runner as a Swift package. Allows CLI testing of VMs.

### main.swift (vm/)
**Reason:** Standalone VM runner. Useful for testing VMs without the full menubar app.

### Scripts
**Reason:** Build automation. Complex multi-step process to download kernel, build initramfs, install extensions.

### vfkit submodule
**Reason:** May be used by build scripts or as a reference. If not needed, can be removed.

---

## What We're NOT Keeping (Examples)

❌ **Next.js** - VibeCode is not a web app
❌ **Tauri** - We have a native SwiftUI app
❌ **Docker** - Desktop app doesn't need containers
❌ **Kubernetes** - Desktop app doesn't need orchestration
❌ **2,088 test files** - Keep only essential integration tests
❌ **10,523 markdown files** - Keep only README, CHANGELOG, LICENSE
❌ **node_modules/** - No Node.js dependencies needed

---

## Success Criteria

After keeping only these files:

✅ Menubar app builds successfully
✅ VM boots with OpenVSCode
✅ Datadog extension works
✅ Build time under 2 minutes
✅ Total repo size under 20MB (without build artifacts)
✅ Clear, understandable structure
✅ No confusion about project purpose

---

*End of KEEP_LIST.md*
