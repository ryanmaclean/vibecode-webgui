# Tauri Desktop App Build Guide

## Overview
This guide documents the build process for the VibeCode desktop application using Tauri v2.

## Build Date
October 25, 2025

## System Requirements
- macOS (tested on Darwin 24.6.0)
- Rust toolchain (latest stable)
- Node.js with npm
- Xcode Command Line Tools

## Prerequisites

### 1. Install Dependencies
```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node dependencies
npm install
```

### 2. Verify Tauri CLI
```bash
# Check if Tauri CLI is available
npm list --depth=0 | grep tauri
# Should show: @tauri-apps/cli@2.9.1
```

## Build Process

### Step 1: Initial Build Check
```bash
cd src-tauri
cargo build
```

### Step 2: Fix Configuration Issues

#### Issue 1: Invalid installMode
The original config had `"installMode": "perUser"` which is not valid in Tauri v2.
**Fix:** Changed to `"installMode": "currentUser"` in `src-tauri/tauri.conf.json`

#### Issue 2: Deprecated Fields
The NSIS config contained deprecated fields (`license`, `headerImage`, `sidebarImage`)
**Fix:** Removed deprecated fields from NSIS configuration

### Step 3: Update Dependencies
```bash
cd src-tauri
cargo update
```

This updated:
- Tauri from 2.8.5 → 2.9.1
- tauri-build from 2.4.1 → 2.5.1
- Multiple objc2 crates to v0.3.2
- Other dependencies to latest compatible versions

### Step 4: Build Release Version
```bash
cd src-tauri
cargo build --release
```

Build completed successfully with only minor warnings:
- Unused import in `src/commands.rs:170`
- Dead code warnings for unused enum variants

### Step 5: Package for macOS
```bash
npx @tauri-apps/cli build
```

This creates:
- `.app` bundle at: `src-tauri/target/release/bundle/macos/VibeCode.app`
- Attempted DMG creation (partial failure, but .app bundle is complete)

## Build Artifacts

### Successfully Created
- **App Bundle**: `/Users/studio/Documents/vibecode-webgui/src-tauri/target/release/bundle/macos/VibeCode.app`
  - Size: 4.9 MB
  - Binary MD5: `6c8025f18b5b85ebcf1a1f694d43d54c`
  - Architecture: aarch64 (Apple Silicon)

### Bundle Details
```
VibeCode.app/
├── Contents/
│   ├── Info.plist
│   ├── MacOS/
│   │   └── vibecode (binary)
│   └── Resources/
│       └── icon.icns
```

### Info.plist Configuration
- Bundle Identifier: `com.vibecode.app`
- Version: 0.1.0
- Display Name: VibeCode
- Category: Developer Tools
- Minimum macOS: 10.13

## Testing

### Test 1: Launch Application
```bash
open src-tauri/target/release/bundle/macos/VibeCode.app
```

**Result**: ✅ App launched successfully (PID 30178 in test run)

### Test 2: Process Verification
```bash
ps aux | grep -i vibecode | grep -v grep
```

**Result**: ✅ Application process running correctly

## Configuration Files Modified

### 1. src-tauri/tauri.conf.json
**Changes:**
- NSIS `installMode`: `perUser` → `currentUser`
- Removed deprecated fields: `license`, `headerImage`, `sidebarImage`

### 2. src-tauri/Cargo.lock
**Changes:**
- Updated via `cargo update` to resolve dependency versions

## Known Issues

### DMG Creation
The DMG bundling process encountered an error:
```
failed to bundle project error running bundle_dmg.sh
```

**Impact**: Low - The .app bundle works perfectly. DMG is just a distribution format.

**Workaround**: You can manually create a DMG using macOS Disk Utility:
1. Open Disk Utility
2. File → New Image → Image from Folder
3. Select `VibeCode.app`
4. Choose compressed format

### Bundle Identifier Warning
```
Warn The bundle identifier "com.vibecode.app" ends with `.app`.
This is not recommended because it conflicts with the application bundle extension on macOS.
```

**Impact**: Low - App works fine, but consider changing to `com.vibecode.desktop` in future

### Code Warnings
Minor Rust warnings that don't affect functionality:
- Unused import: `std::path::Path` in commands.rs
- Dead code: `DockerError::NotAvailable` and `DockerError::ConnectionError`

**Fix**: Run `cargo fix --bin "vibecode"` to auto-fix

## Build Optimization

The release profile in `Cargo.toml` is configured for size optimization:
```toml
[profile.release]
strip = true           # Remove debug symbols
lto = "thin"          # Link-time optimization
opt-level = "z"       # Optimize for size
codegen-units = 1     # Better optimization
panic = "abort"       # Smaller binary
```

**Result**: 4.9 MB app bundle (very compact)

## Distribution Checklist

- [x] Build completes without errors
- [x] App launches successfully
- [x] App bundle properly structured
- [x] Version info correct in Info.plist
- [x] Icon included
- [ ] DMG installer (optional)
- [ ] Code signing (required for distribution outside App Store)
- [ ] Notarization (required for macOS Gatekeeper)

## Next Steps for Production Release

### 1. Code Signing
```bash
# You'll need an Apple Developer account
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" \
  src-tauri/target/release/bundle/macos/VibeCode.app
```

### 2. Notarization
```bash
# Submit for notarization
xcrun notarytool submit VibeCode.dmg \
  --apple-id your@email.com \
  --password your-app-specific-password \
  --team-id YOUR_TEAM_ID
```

### 3. Create DMG Manually (if automatic creation fails)
```bash
# Using hdiutil
hdiutil create -volname "VibeCode" -srcfolder \
  src-tauri/target/release/bundle/macos/VibeCode.app \
  -ov -format UDZO VibeCode_0.1.0_aarch64.dmg
```

## Troubleshooting

### Build Fails with "unknown variant" Error
**Solution**: Update `tauri.conf.json` as documented in Step 2

### Cargo Update Fails
**Solution**: Check internet connection and cargo registry access

### App Won't Launch
**Solution**: Check Console.app for crash logs, verify code-server availability

### DMG Creation Fails
**Solution**: Use the manual DMG creation method above

## Build Time Metrics

- Initial cargo build: ~40 seconds
- Release build: ~1 minute 16 seconds
- Full package build: ~2 minutes total
- Bundle size: 4.9 MB (excellent)

## Support

For issues or questions:
- Check GitHub Issues
- Review Tauri v2 documentation: https://v2.tauri.app
- Verify Rust toolchain: `rustc --version`
- Verify Node version: `node --version`
