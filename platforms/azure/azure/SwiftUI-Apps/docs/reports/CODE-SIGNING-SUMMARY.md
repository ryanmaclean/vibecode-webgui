# Code Signing Fix Summary

## Date: 2025-11-25

## Problem Overview

Both BasicVibeCode and LiquidGlassVibeCode apps had code signing issues:
- **BasicVibeCode.app**: Only had 1 of 4 required entitlements (missing network entitlements)
- **LiquidGlassVibeCode.app**: Was properly signed but inconsistent with BasicVibeCode
- **Test failures**: 3 failures in BasicVibeCode tests, 2 in LiquidGlassVibeCode tests
- **Root cause**: Apps were crashing on launch due to missing/invalid signatures

## Entitlements File

Location: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/entitlements.plist`

The entitlements file contains all required entitlements for Virtualization.framework:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
    <key>com.apple.security.hypervisor</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
</dict>
</plist>
```

## Required Entitlements

All four entitlements are required for proper VM operation:

1. **com.apple.security.virtualization** - Core Virtualization.framework access
2. **com.apple.security.hypervisor** - Hypervisor capabilities
3. **com.apple.security.network.client** - Network client access for VM networking
4. **com.apple.security.network.server** - Network server access for VM networking

## Changes Made

### 1. Re-signed Both Applications

Re-signed both apps with all required entitlements using ad-hoc signing:

```bash
codesign --force --deep --sign - --entitlements entitlements.plist BasicVibeCode.app
codesign --force --deep --sign - --entitlements entitlements.plist LiquidGlassVibeCode.app
```

### 2. Updated bundle-apps.sh

Enhanced the bundling script to include signature verification:
- Already had proper signing command (line 69)
- Added verification section at the end to display:
  - Signature validity
  - Applied entitlements

Location: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/bundle-apps.sh`

### 3. Updated build-vsock-app.sh

Added code signing step for VsockVibeCode app:
- Step 6: Code signing with entitlements
- Automatic entitlements.plist detection
- Signature verification after signing

Location: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/build-vsock-app.sh`

### 4. Created build-apps.sh

New compilation script for BasicVibeCode and LiquidGlassVibeCode executables:
- Compiles both apps from source
- Uses proper compiler flags for arm64-apple-macos13.0
- Links SwiftUI, Virtualization, and Network frameworks

Location: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/build-apps.sh`

### 5. Fixed Test Scripts

Updated test scripts to check for correct entitlement keys:
- Changed from `com.apple.vm.hypervisor` to `com.apple.security.hypervisor|com.apple.security.virtualization`
- Fixed in:
  - `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-basicvibecode.sh` (line 166)
  - `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-vibecode-multivm.sh` (line 419)

## Current Signing Status

### BasicVibeCode.app

```
Identifier: com.vibecode.basic
Format: app bundle with Mach-O thin (arm64)
Signature: adhoc (local development)
Status: valid on disk, satisfies Designated Requirement

Entitlements:
✓ com.apple.security.hypervisor
✓ com.apple.security.network.client
✓ com.apple.security.network.server
✓ com.apple.security.virtualization
```

### LiquidGlassVibeCode.app

```
Identifier: com.vibecode.liquidglass
Format: app bundle with Mach-O thin (arm64)
Signature: adhoc (local development)
Status: valid on disk, satisfies Designated Requirement

Entitlements:
✓ com.apple.security.hypervisor
✓ com.apple.security.network.client
✓ com.apple.security.network.server
✓ com.apple.security.virtualization
```

## Verification Commands

To verify signing status of either app:

```bash
# Verify signature validity
codesign --verify --deep --strict --verbose=2 BasicVibeCode.app
codesign --verify --deep --strict --verbose=2 LiquidGlassVibeCode.app

# View signature details and entitlements
codesign -dv --entitlements - BasicVibeCode.app
codesign -dv --entitlements - LiquidGlassVibeCode.app
```

## Build Workflow

Recommended workflow for rebuilding apps:

```bash
# 1. Compile executables (if source changed)
./build-apps.sh

# 2. Create signed .app bundles
./bundle-apps.sh

# The bundle-apps.sh script will:
#   - Create .app bundle structure
#   - Copy executables and resources
#   - Create Info.plist
#   - Sign with entitlements
#   - Verify signatures
```

## Testing Status

**Note**: As requested, tests were NOT run yet. The apps are now properly signed and ready for testing.

Next step: Run the test scripts to verify:
```bash
./test-basicvibecode.sh
./test-vibecode-multivm.sh
```

## Ad-hoc Signing for Local Development

Both apps use ad-hoc signing (the `-` sign identity), which is appropriate for:
- Local development and testing
- Apps not distributed outside the development machine
- Apps that don't need App Store or notarization

For distribution, you would need:
- A valid Apple Developer certificate
- Replace `--sign -` with `--sign "Developer ID Application: Your Name"`
- Notarize the app for distribution outside App Store

## Issues Encountered

### Issue 1: BasicVibeCode had incomplete entitlements
**Problem**: BasicVibeCode.app was signed with only 1 entitlement instead of all 4
**Cause**: App was signed at a different time, possibly with an older/incomplete entitlements file
**Solution**: Re-signed with complete entitlements.plist file

### Issue 2: Test scripts checking wrong entitlement key
**Problem**: Tests were checking for `com.apple.vm.hypervisor` which doesn't exist
**Cause**: Incorrect entitlement key in test scripts
**Solution**: Updated to check for `com.apple.security.hypervisor` or `com.apple.security.virtualization`

### Issue 3: build-vsock-app.sh didn't sign apps
**Problem**: VsockVibeCode.app creation script didn't include signing
**Cause**: Script was created before signing requirements were established
**Solution**: Added Step 6 with signing and verification

## Related Files

- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/entitlements.plist` - Entitlements definition
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/bundle-apps.sh` - Main bundling script with signing
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/build-apps.sh` - Compilation script (new)
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/build-vsock-app.sh` - Vsock app build script (updated)
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-basicvibecode.sh` - Test script (updated)
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-vibecode-multivm.sh` - Multi-VM test script (updated)

## Conclusion

✅ Both BasicVibeCode.app and LiquidGlassVibeCode.app are now properly signed
✅ All four required entitlements are present on both apps
✅ Signatures are valid and verified
✅ Build scripts updated to maintain proper signing
✅ Test scripts updated to check correct entitlement keys
✅ Ready for testing (tests not yet run per instructions)
