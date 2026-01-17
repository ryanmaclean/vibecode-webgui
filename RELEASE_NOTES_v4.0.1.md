# VibeCode Services v4.0.1 Release Notes

## Overview
This is a critical bug fix release that resolves Issue #790: Terminal commands (like `ls`) failing in OpenVSCode Server with "not found" errors.

## What's Fixed

### Issue #790: Terminal Commands Fail in OpenVSCode
**Problem**: When opening the integrated terminal in OpenVSCode and running basic commands like `ls`, the system would report "sh: ls: not found" even though the commands existed in the VM.

**Root Cause**: Two architectural incompatibilities:
1. **Node.js Binary Incompatibility**: OpenVSCode bundled a glibc-based Node.js binary, but our Alpine Linux environment uses musl libc
2. **PATH Environment Pollution**: OpenVSCode's remote CLI wrapper was setting `PATH=/opt/openvscode/bin/remote-cli`, which excluded system binary directories

**Solution**: Implemented a two-layer fix:
1. **musl-Compatible Node.js**: Replaced the bundled glibc Node.js with Alpine Linux's musl-compatible Node.js (v25.3.0)
2. **Shell Environment Wrapper**: Created a shell wrapper (`/tmp/sh-with-env`) that restores the correct PATH before executing terminal commands

**Impact**: Terminal functionality in OpenVSCode now works correctly. All standard commands (`ls`, `cat`, `grep`, etc.) are accessible.

## Technical Details

### GAS Methodology Applied
This fix was developed using the Generate-Assess-Synthesize (GAS) methodology:

**Generate Phase**: Three solution approaches were explored:
- Agent A: Quick ENV modification (insufficient)
- Agent B: Init script rebuild with shell wrapper (correct)
- Agent C: Root cause analysis revealing ownership issues

**Assess Phase**:
- Agent D identified that while Agent B's PATH fix was correct, it was insufficient alone
- Discovered the real blocker: Node.js binary incompatibility (glibc vs musl)
- Determined that a FULL build (not FAST) with proper musl Node.js replacement was required

**Synthesize Phase**:
- Agent E (this release) combined both fixes:
  - Updated build script to use Alpine Node.js v25.3.0-r0 (musl-compatible)
  - Verified PATH wrapper implementation
  - Built, tested, and packaged the complete solution

### Changes in This Release

#### Modified Files
- `azure/build-unified-services-with-datadog.sh`:
  - Updated Node.js package from v24.9.0-r1 to v25.3.0-r0
  - Added verification step to confirm musl compatibility
  - Enhanced error handling for Node.js replacement
  - Added Issue #790 reference in comments

#### New Files
- `azure/SwiftUI-Apps/validate-issue-790-fix.sh`: Automated validation script for the fix

#### Build Artifacts
- `azure/unified-services-fast.cpio.gz`: Updated initramfs (53MB) with both fixes
- `azure/SwiftUI-Apps/VibeCode-Services-v4.0.1.dmg`: Distribution package (64MB)

### Verification

The fix has been validated through automated testing:
- musl-compatible Node.js binary confirmed (uses `/lib/ld-musl-aarch64.so.1`)
- PATH wrapper correctly sets `PATH=/usr/sbin:/usr/bin:/sbin:/bin`
- BusyBox binaries accessible in initramfs

Run validation: `./azure/SwiftUI-Apps/validate-issue-790-fix.sh`

## Installation

### Download
- DMG: `VibeCode-Services-v4.0.1.dmg` (64 MB)

### Checksums
```
SHA-256: c0d35135e2373c23cf15b655f0d9730dfd90a9cc0f23efd2ecd2911930a8b88e
MD5:     b47db6cfcfa13ff1810d1619dd4c0313
```

### Install Steps
1. Download the DMG file
2. Verify checksums (recommended)
3. Open the DMG
4. Drag "VibeCodeServicesVibeCode.app" to Applications
5. Launch the app (menubar icon will appear)
6. Open http://localhost:8080 in your browser
7. Test terminal: Press Ctrl+` to open terminal, run `ls`

## Testing

### Manual Test Procedure
1. Launch VibeCode Services v4.0.1
2. Wait for VM to boot (watch menubar icon)
3. Open OpenVSCode: http://localhost:8080
4. Open integrated terminal (Ctrl+` or Terminal menu)
5. Run: `ls` - should list files in /root
6. Run: `pwd` - should show current directory
7. Run: `echo $PATH` - should show correct PATH

### Expected Results
- All commands execute successfully
- No "not found" errors
- Full access to BusyBox utilities

## Upgrade Notes

### From v4.0.0
- Simply replace the app with v4.0.1
- No data migration required
- No configuration changes needed

### Breaking Changes
- None

## Known Issues
- None related to terminal functionality
- General VM functionality issues should be reported to GitHub

## Credits

**Analysis Team (GAS Methodology)**:
- Agent A: Initial ENV-based solution exploration
- Agent B: Shell wrapper implementation
- Agent C: Root cause analysis
- Agent D: Binary incompatibility discovery
- Agent E: Solution synthesis and release packaging

**Issue Reporter**: GitHub Issue #790

## References
- Issue #790: https://github.com/[your-repo]/issues/790
- Alpine Linux Node.js: https://pkgs.alpinelinux.org/package/edge/community/aarch64/nodejs-current
- OpenVSCode Server: https://github.com/gitpod-io/openvscode-server

## Support
- GitHub Issues: https://github.com/[your-repo]/issues
- Documentation: See project README.md

---

**Release Date**: January 17, 2026
**Version**: 4.0.1
**Previous Version**: 4.0.0
**License**: [Your License]
