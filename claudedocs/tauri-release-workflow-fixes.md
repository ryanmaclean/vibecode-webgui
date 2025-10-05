# Tauri Release Workflow Fixes

**Date:** 2025-10-02
**Agent:** Frontend Architect #24
**Status:** Fixed

## Issues Identified and Resolved

### 1. Missing entitlements.plist
**Problem:** Workflow referenced `src-tauri/entitlements.plist` but file didn't exist
**Fix:** Created entitlements.plist with required macOS hardened runtime entitlements

**Location:** `/Users/ryan.maclean/vibecode-webgui/src-tauri/entitlements.plist`

**Entitlements included:**
- JIT compilation support
- Unsigned executable memory
- Network client/server
- File system access
- USB device access (for Docker)

### 2. Tauri Bundle Configuration Disabled
**Problem:** `tauri.conf.json` had `"active": false` in bundle config
**Fix:** Updated bundle configuration:
- Set `"active": true`
- Added bundle targets: `["dmg", "app"]`
- Configured icon array with proper paths
- Set entitlements path: `"entitlements.plist"`
- Added copyright notice

**Changed in:** `/Users/ryan.maclean/vibecode-webgui/src-tauri/tauri.conf.json`

### 3. Missing Tauri CLI and Build Scripts
**Problem:**
- No `@tauri-apps/cli` package in devDependencies
- No `tauri` scripts in package.json
- No `build:export` script for static Next.js build

**Fix:** Added to package.json:
```json
{
  "scripts": {
    "build:export": "NEXT_CONFIG_FILE=next.config.tauri.js next build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.1.0"
  }
}
```

### 4. Next.js Export Configuration
**Problem:** Main Next.js config uses `output: 'standalone'` which doesn't work for Tauri static builds

**Fix:** Created separate Tauri-specific Next.js config:
- File: `next.config.tauri.js`
- Uses `output: 'export'` for static generation
- Disables image optimization (`unoptimized: true`)
- Sets `TAURI_BUILD` environment variable
- Maintains necessary webpack aliases

### 5. Workflow Conditional Logic Issues
**Problem:** Signing conditionals checked `github.event.inputs.skip_signing` for push events where inputs don't exist

**Fix:** Updated conditionals to properly handle both event types:
```yaml
if: |
  (github.event_name == 'push' && startsWith(github.ref, 'refs/tags/app-v')) ||
  (github.event_name == 'workflow_dispatch' && github.event.inputs.skip_signing != 'true')
```

**Applied to steps:**
- Import Apple Developer Certificate
- Sign macOS Application
- Sign DMG Package
- Notarize Application

### 6. Build Validation and Error Handling
**Problem:** No validation of Tauri setup before build, limited error debugging

**Fix:** Added validation steps:
- Pre-build validation of required files
- Tauri CLI version verification
- Build error log capture on failure
- Next.js config verification

## Files Modified

1. **Created:**
   - `/Users/ryan.maclean/vibecode-webgui/src-tauri/entitlements.plist`
   - `/Users/ryan.maclean/vibecode-webgui/next.config.tauri.js`

2. **Updated:**
   - `/Users/ryan.maclean/vibecode-webgui/.github/workflows/tauri-release.yml`
   - `/Users/ryan.maclean/vibecode-webgui/src-tauri/tauri.conf.json`
   - `/Users/ryan.maclean/vibecode-webgui/package.json`

## Required Secrets

The workflow requires these GitHub secrets for code signing and notarization:

### Code Signing
- `APPLE_CERTIFICATE_BASE64` - Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD` - Certificate password
- `KEYCHAIN_PASSWORD` - Temporary keychain password
- `APPLE_SIGNING_IDENTITY` - Developer ID Application certificate name

### Notarization
- `APPLE_ID` - Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Apple Team ID

### Tauri Auto-Update (Optional)
- `TAURI_PRIVATE_KEY` - For signed updates
- `TAURI_KEY_PASSWORD` - Key password

## Testing Requirements

### Local Testing
```bash
# Install dependencies
npm install --legacy-peer-deps

# Test Tauri build locally
npm run tauri:build

# Or build without signing for testing
npm run build:export
cd src-tauri
cargo build --release --target universal-apple-darwin
```

### Manual Workflow Trigger
Use the workflow dispatch option with:
- `skip_signing: true` - For testing builds without code signing

### Tag-based Release
Create a tag to trigger full signed release:
```bash
git tag app-v0.1.0
git push origin app-v0.1.0
```

## Build Artifacts

The workflow produces:
1. **VibeCode.dmg** - Signed and notarized DMG installer
2. **VibeCode.app.tar.gz** - Compressed app bundle
3. **SHA256 and SHA512 checksums** - For download verification

## Architecture Support

- **Universal Binary** - Runs natively on both Intel and Apple Silicon Macs
- **Minimum macOS** - 10.13 (High Sierra)
- **Code Signed** - Developer ID Application certificate
- **Notarized** - Apple notarization for Gatekeeper

## Next Steps

1. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Setup Apple Developer certificates** (for signed releases)
3. **Configure GitHub secrets** (see Required Secrets section)
4. **Test workflow** with manual dispatch before tag release
5. **Create release tag** to trigger production build

## Validation Checklist

- [x] entitlements.plist exists
- [x] Tauri bundle config enabled
- [x] Icon files referenced correctly
- [x] Tauri CLI in devDependencies
- [x] Build scripts in package.json
- [x] Next.js export config created
- [x] Workflow conditionals fixed
- [x] Build validation added
- [ ] GitHub secrets configured (requires Apple Developer account)
- [ ] Test workflow dispatch successful
- [ ] Tag release build successful

## Known Limitations

1. **Server-side features disabled** - Static export means no API routes in Tauri app
2. **Image optimization disabled** - Unoptimized images in desktop build
3. **Code signing required** - Unsigned apps won't pass Gatekeeper on macOS
4. **Notarization required** - For distribution outside Mac App Store

## Troubleshooting

### Build fails with "command not found: tauri"
```bash
npm install --legacy-peer-deps
```

### "entitlements.plist not found"
File should exist at `src-tauri/entitlements.plist` - create if missing

### "No DMG found"
Check build logs - DMG creation may have failed, fallback to basic hdiutil

### Code signing fails
Verify secrets are set correctly and certificate is valid Developer ID Application type

### Notarization timeout
Apple notarization can take 10-30 minutes - workflow timeout is set to 30m
