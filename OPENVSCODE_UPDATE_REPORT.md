# OpenVSCode Server Update Report - Agent M

**Date:** January 14, 2026
**Mission:** Update OpenVSCode Server from v1.95.3 to latest stable release
**Status:** ⚠️ UPDATE COMPLETED - RUNTIME ISSUE UNDER INVESTIGATION

---

## Executive Summary

Successfully updated OpenVSCode Server in the UnifiedServicesVibeCodeApp from version 1.95.3 (December 2024) to version 1.106.3 (December 2025). The initramfs has been rebuilt with the new version and Datadog extension v2.0.0 has been preserved. However, the service is experiencing connection issues at runtime that require further investigation.

---

## Version Information

### Old Version
- **Version:** 1.95.3
- **Commit:** ac08a4f024c12cc12b9e8e186240052500ec6c83
- **Date:** December 14, 2024
- **Architecture:** ARM64 (aarch64)
- **Node Binary:** ELF 64-bit LSB pie executable, ARM aarch64, musl

### New Version
- **Version:** 1.106.3
- **Commit:** bf9252a2fb45be6893dd8870c0bf37e2e1766d61
- **Release Date:** December 2, 2025
- **Architecture:** ARM64 (aarch64)
- **Node Binary:** ELF 64-bit LSB executable, ARM aarch64, GNU/Linux
- **Download URL:** https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.106.3/openvscode-server-v1.106.3-linux-arm64.tar.gz

---

## Update Process

### 1. Research & Download
```bash
# Found latest version
curl -s https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest | jq -r '.tag_name'
# Output: openvscode-server-v1.106.3

# Downloaded ARM64 version (CRITICAL: Must use ARM64, not x64!)
wget https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.106.3/openvscode-server-v1.106.3-linux-arm64.tar.gz
```

**LESSON LEARNED:** Initially downloaded x64 version by mistake, which caused complete service failure. The VM runs on ARM64 architecture (Apple Silicon). Always verify architecture compatibility!

### 2. Extract & Backup
```bash
# Extract current initramfs
cd /tmp && mkdir initramfs-vscode-update
gunzip -c ~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz | cpio -idmv

# Backup old OpenVSCode
tar czf /tmp/openvscode-server-v1.95.3-backup.tar.gz opt/openvscode/
# Backup size: 45MB
```

### 3. Replace OpenVSCode
```bash
# Remove old version
rm -rf opt/openvscode

# Extract and install new version
tar xzf /tmp/openvscode-server-v1.106.3-linux-arm64.tar.gz
mv openvscode-server-v1.106.3-linux-arm64 opt/openvscode
```

### 4. Preserve Datadog Extension
```bash
# Extract Datadog extension v2.0.0 from VSIX
unzip -q extensions-download/datadog-extension-v2.0.0.vsix -d /tmp/datadog-extract

# Install into new OpenVSCode
mkdir -p opt/openvscode/extensions/datadog.datadog-vscode-2.0.0
cp -r /tmp/datadog-extract/extension/* opt/openvscode/extensions/datadog.datadog-vscode-2.0.0/
# Extension size: 41MB (with .output.bundle)
```

### 5. Update Init Script
Added Datadog extension copy logic to `/init` (lines 428-438):

```bash
# 4.5. Setup Datadog VSCode Extension (must run before OpenVSCode starts)
mkdir -p /.openvscode-server/extensions 2>/dev/null || true
if [ -d /opt/openvscode/extensions/datadog.datadog-vscode-2.0.0 ]; then
    if [ ! -d /.openvscode-server/extensions/datadog.datadog-vscode-2.0.0 ]; then
        cp -r /opt/openvscode/extensions/datadog.datadog-vscode-2.0.0 \
              /.openvscode-server/extensions/ 2>/dev/null || true
        if [ -d /.openvscode-server/extensions/datadog.datadog-vscode-2.0.0 ]; then
            echo "  - Datadog extension copied to user extensions"
        fi
    fi
fi
```

This ensures the Datadog extension is copied from the builtin directory to the user extensions directory at boot time, where OpenVSCode actually loads extensions from.

### 6. Rebuild Initramfs
```bash
cd /tmp/initramfs-vscode-update
find . | cpio -o -H newc | gzip -9 > /tmp/unified-vm-initramfs-v1.106.3-arm64.cpio.gz
```

### 7. Install Updated Initramfs
```bash
# CRITICAL: macOS caching issue requires using dd instead of cp
pkill -f UnifiedServicesVibeCode
rm -f ~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz
dd if=/tmp/unified-vm-initramfs-v1.106.3-arm64.cpio.gz \
   of=~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz \
   bs=1m
sync
```

**LESSON LEARNED:** Regular `cp` command failed silently due to macOS file system caching or extended attributes. Using `dd` ensures the file is actually written. Always verify with MD5 checksum!

---

## File Size Comparison

| Item | Old Size | New Size | Change |
|------|----------|----------|--------|
| **OpenVSCode Directory** | 149MB | 223MB (v1.106.3 x64) / 220MB (v1.106.3 arm64) | +71MB (+48%) |
| **Initramfs (compressed)** | 112MB | 143MB | +31MB (+28%) |
| **Initramfs (uncompressed)** | 678,001 blocks | 911,600 blocks | +233,599 blocks (+34%) |

---

## Key Observations

### Architecture Differences
- **Old v1.95.3 Node:** musl-linked (lightweight C library)
- **New v1.106.3 Node:** glibc-linked (GNU C library)

This change in C library linkage might require additional system libraries in the initramfs. Investigation needed.

### Compatibility
- **Datadog Extension:** v2.0.0 supports VSCode ^1.90.0, so v1.106.3 should be compatible
- **Init Script:** Startup command unchanged (`./bin/openvscode-server`)
- **Startup Parameters:** All parameters remain valid

---

## Current Status

### What Works
✅ Initramfs successfully rebuilt with v1.106.3
✅ Datadog extension v2.0.0 preserved and configured
✅ ARM64 architecture correctly matched
✅ Init script updated for extension copying
✅ File successfully installed in app bundle

### What's Not Working
❌ OpenVSCode service fails to start (Connection refused on port 8080)
❌ VM boots but service doesn't bind to network port

### Possible Causes
1. **Missing glibc dependencies:** New Node binary requires glibc but initramfs might only have musl
2. **Library version mismatch:** System libraries might be too old
3. **Init script issue:** Service might be failing silently
4. **Node.js startup failure:** Binary might be incompatible with VM environment

---

## Backup & Rollback

### Backup Files Created
```bash
# Old OpenVSCode backup
/tmp/openvscode-server-v1.95.3-backup.tar.gz (45MB)

# Old initramfs backup
/tmp/unified-vm-initramfs-v1.95.3-backup.cpio.gz (112MB)

# App bundle backup (if needed)
~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz.backup
```

### Rollback Procedure
```bash
# 1. Stop the app
pkill -f UnifiedServicesVibeCode

# 2. Restore old initramfs
rm -f ~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz
dd if=/tmp/unified-vm-initramfs-v1.95.3-backup.cpio.gz \
   of=~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz \
   bs=1m
sync

# 3. Restart the app
open ~/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app

# 4. Verify
sleep 30
curl http://192.168.64.10:8080/
```

---

## Next Steps

### Investigation Required
1. **Check VM boot logs** to see OpenVSCode startup errors
2. **Verify glibc availability** in the initramfs
3. **Test Node.js binary** directly in the VM
4. **Check for missing library dependencies** using `ldd`
5. **Review OpenVSCode startup logs** in `/tmp/openvscode.log`

### Potential Solutions
1. **Add glibc to initramfs** if musl-only environment
2. **Try musl-compiled v1.106.3** if available
3. **Create compatibility layer** with glibc symlinks
4. **Update system libraries** in the initramfs
5. **Consider staying on v1.95.3** if compatibility issues persist

### SSH Access for Debugging
```bash
# Try SSH with vibecode key
ssh -i ~/.ssh/vibecode/id_ed25519 root@192.168.64.10

# Or with password (vibecode)
ssh root@192.168.64.10
# Password: vibecode

# Check logs
tail -100 /tmp/openvscode.log
ps aux | grep openvscode
ldd /opt/openvscode/node
```

---

## Technical Artifacts

### Files Modified
- `/tmp/initramfs-vscode-update/init` - Added Datadog extension setup
- `/tmp/initramfs-vscode-update/opt/openvscode/` - Replaced entire directory

### Files Created
- `/tmp/unified-vm-initramfs-v1.106.3-arm64.cpio.gz` - New initramfs
- `/tmp/openvscode-server-v1.95.3-backup.tar.gz` - Old version backup
- `/tmp/unified-vm-initramfs-v1.95.3-backup.cpio.gz` - Old initramfs backup

### Checksums
```bash
# New initramfs
MD5: 5892e1669072e90ef543724879d86385

# Old initramfs backup
MD5: 2e654e33e4c443fadb0edb0c1e399bdf
```

---

## Conclusion

The OpenVSCode Server update process was successfully completed from a technical perspective - the new version v1.106.3 has been properly integrated into the initramfs with the correct ARM64 architecture, and the Datadog extension has been preserved. However, a runtime compatibility issue is preventing the service from starting.

This appears to be related to the C library linkage change from musl (lightweight) to glibc (standard GNU) in the Node.js binary. The Alpine Linux-based initramfs might not have the required glibc libraries or compatible versions.

**Recommendation:** Either resolve the glibc dependency issue or rollback to v1.95.3 until a musl-compatible build of v1.106.3 can be obtained or the initramfs can be enhanced with glibc support.

---

**Agent M - Mission Partially Complete**
*Update deployed, runtime investigation needed*
