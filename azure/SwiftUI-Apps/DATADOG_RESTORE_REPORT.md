# Datadog Extension Restore Report

## Mission Status: BLOCKED

**Agent**: Agent N
**Date**: 2026-01-14
**Objective**: Restore Datadog extension to working v3.2.1 initramfs
**Status**: ⚠️ **BLOCKED** - VM won't boot with any initramfs configuration

---

## Summary

Attempted to restore the Datadog extension (v2.0.0, 41 MB) to the working initramfs, but discovered a **critical blocking issue**: The UnifiedServicesVibeCode VM does not boot with ANY initramfs configuration, including previously working versions. This is a systemic boot failure that must be resolved before Datadog restoration can proceed.

---

## Findings

### 1. Available Initramfs Backups

Found multiple initramfs versions in `/tmp`:

| File | Size | OpenVSCode | Node.js | Datadog | Status |
|------|------|------------|---------|---------|--------|
| `unified-vm-initramfs-with-datadog.cpio.gz` | 120 MB | v1.95.3 | 63MB musl | ✅ Yes | Won't boot |
| `unified-vm-initramfs.cpio.gz.backup` (Resources) | 112 MB | v1.95.3 | 63MB musl | ❌ No | Won't boot |
| `unified-vm-initramfs-v1.106.3.cpio.gz` | 143 MB | v1.106.3 | 115MB glibc | ❌ No | Won't boot |
| Current (in .app bundle) | 144 MB | v1.106.3 | 115MB glibc | ❌ No | Won't boot |

### 2. Kernel Versions

Two kernel versions available in `/Users/ryan.maclean/vibecode-webgui/azure/kernel-build/`:

- **Linux 6.1** (16 MB): `vmlinux-6.1-arm64` (MD5: `15fd41988b98acd0c1b52025a3b990bf`)
- **Linux 6.8** (55 MB): `vmlinux-6.8-arm64` (MD5: `67ac161cdac06911e5fdd7802164dc01`)

Currently deployed: **Linux 6.8** (updated 2026-01-14 08:45 by Agent M)

### 3. OpenVSCode Version Differences

**v1.95.3** (old, with Datadog):
- Node.js: 63 MB, musl-based (Alpine-compatible)
- Wrapper script: Simple 14-line busybox-compatible script
- No glibc patching required

**v1.106.3** (new, Agent M's update):
- Node.js: 115 MB, glibc-based with debug info
- Wrapper script: 25-line script with glibc patching logic
- Requires glibc compatibility symlinks (present in initramfs)

### 4. Boot Failure Analysis

**Symptoms**:
- App launches successfully (process runs)
- No console log files created in `/tmp/vibecode-console-*.log`
- No SSH port (2222) listening
- No OpenVSCode port (8080) listening
- No crash reports generated

**Tested Configurations** (ALL FAILED):
1. ❌ Linux 6.8 + v1.106.3 initramfs (current)
2. ❌ Linux 6.8 + v1.95.3 initramfs (Resources backup)
3. ❌ Linux 6.1 + v1.95.3 initramfs (downgraded kernel)
4. ❌ Linux 6.8 + v1.95.3 with Datadog initramfs

**Conclusion**: The failure occurs before any kernel output, suggesting an issue with:
- Virtualization framework initialization
- VM configuration in Swift code
- Code signing / entitlements
- Recent code changes breaking VM creation

---

## Actions Taken

### 1. Backup and Verification
✅ Located working Datadog initramfs: `/tmp/unified-vm-initramfs-with-datadog.cpio.gz`
✅ Verified Datadog extension present: `datadog.datadog-vscode-2.0.0` (41 MB, 27 files)
✅ Created backups of current state before modifications

### 2. Hybrid Approach
✅ Created new initramfs combining v1.106.3 OpenVSCode + Datadog extension
✅ Successfully merged: `/tmp/unified-vm-initramfs-v1.106.3-with-datadog.cpio.gz` (144 MB)
❌ Still won't boot (indicates deeper issue)

### 3. Kernel Downgrade
✅ Backed up Linux 6.8 kernel to `/tmp/vmlinux-6.8-backup`
✅ Installed Linux 6.1 kernel: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/vmlinux-raw`
❌ Still won't boot with ANY initramfs

### 4. Reference App Testing
✅ Located reference app: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode.app`
✅ Tested reference app with its own resources
❌ **Reference app also won't boot** - confirms systemic issue

---

## Root Cause Hypothesis

The VM boot failure affects ALL initramfs/kernel combinations, including the reference app. Possible causes:

### 1. Recent Code Changes (Most Likely)
- Swift source files were recompiled on 2026-01-14 08:45
- Changes to `BaseVMManager.swift` or `UnifiedServicesVMManager.swift`
- Changes to networking code (`DHCPLeaseMonitor.swift`, `VMPortForwarder.swift`)
- Modified git status shows changes to these files

### 2. Build Environment Issue
- App binary: 699 KB, built 2026-01-14 08:45
- Build may be incomplete or corrupted
- Missing dependencies or frameworks
- Code signing issue with entitlements

### 3. macOS Virtualization Framework Issue
- No error logs suggest framework not initializing
- Could be permissions/entitlements problem
- Could be Virtualization.framework API change

### 4. Disk Image Issue
- VirtioBlock device (`/dev/vda`) may not be configured
- Persistent storage mount failing silently
- Disk image file missing or corrupted

---

## Next Steps (CRITICAL)

### Option A: Debug VM Boot Failure (RECOMMENDED)
1. **Add debug logging** to Swift code to see where VM creation fails
2. **Check Virtualization framework errors** in `BaseVMManager.start()`
3. **Verify disk image** exists and is configured
4. **Test with minimal configuration** (no networking, no disk)
5. **Compare working vs non-working code** (git diff with last working commit)

### Option B: Restore from Known Working State
1. **Find last working commit** where VM actually booted
2. **Checkout that commit** and test
3. **Identify breaking change** via git bisect
4. **Revert or fix** the breaking change

### Option C: Use Alternative App
1. **Test other apps** (Valkey, PostgreSQL, Basic) to see if they boot
2. **If they work**, copy their VM configuration
3. **Rebuild UnifiedServices** using working template
4. **Add Datadog** once basic boot works

---

## Files Created

### Initramfs Artifacts
- `/tmp/unified-vm-initramfs-v1.106.3-with-datadog.cpio.gz` (144 MB) - v1.106.3 + Datadog hybrid
- `/tmp/initramfs-v1.106.3-check/` - Extracted v1.106.3 initramfs with Datadog added
- `/tmp/initramfs-datadog-verify/` - Extracted old Datadog initramfs for verification
- `/tmp/initramfs-resources-backup/` - Extracted Resources backup

### Kernel Backups
- `/tmp/vmlinux-6.8-backup` (55 MB) - Backup of Linux 6.8 kernel before downgrade

### Current State
- **App**: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app`
- **Initramfs**: 112 MB Resources backup (v1.95.3, no Datadog)
- **Kernel**: 16 MB Linux 6.1 (downgraded from 6.8)
- **Status**: Not booting

---

## Technical Details

### Datadog Extension Structure
```
opt/openvscode/extensions/datadog.datadog-vscode-2.0.0/
├── .output.bundle/
├── changelog.md
├── LICENSE-3RD-PARTY.txt
├── LICENSE.txt
├── package.json (202 KB)
├── package.nls.json
├── readme.md
└── resources/
    ├── css/
    │   ├── extension.css
    │   └── vscode-markdown.css
    ├── icons/
    │   ├── datadog/ (TTF, WOFF fonts)
    │   └── vscode-codicon/
    └── images/ (logos, SVG icons)
```

**Total Size**: 41 MB uncompressed
**File Count**: 27 files
**Version**: v2.0.0
**Last Known Working**: v3.2.1 (2026-01-14 08:13)

### Build Script Location
`/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/build-unified-menubar.sh`

### Git Modified Files
```
M azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVMManager.swift
M azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift
M azure/SwiftUI-Apps/Shared/Networking/DHCPLeaseMonitor.swift
M azure/SwiftUI-Apps/Shared/Networking/VMPortForwarder.swift
M azure/SwiftUI-Apps/entitlements.plist
```

---

## Recommendations

1. **URGENT**: Fix VM boot failure before attempting Datadog restoration
2. **Priority 1**: Add debug logging to identify where VM creation fails
3. **Priority 2**: Test if other VM apps (Valkey, PostgreSQL) still work
4. **Priority 3**: Review recent git commits for breaking changes
5. **Blocked**: Datadog extension restoration until VM boots

---

## Contact Next Agent

**To Agent O** (or whoever debugs this):

The Datadog extension is ready to restore (41 MB, verified intact in backups), but the VM won't boot at all. I've prepared:

1. Working Datadog initramfs: `/tmp/unified-vm-initramfs-with-datadog.cpio.gz`
2. Hybrid v1.106.3 + Datadog: `/tmp/unified-vm-initramfs-v1.106.3-with-datadog.cpio.gz`
3. All extraction directories in `/tmp/initramfs-*`

Once you fix the boot issue, just deploy one of these initramfs files to restore Datadog.

**The real problem is VM boot, not Datadog restoration.**

---

**End of Report**
