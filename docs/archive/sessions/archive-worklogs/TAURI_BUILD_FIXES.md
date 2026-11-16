# Tauri Build Fixes - Issue Resolution Log

**Date**: October 25, 2025
**Issue**: #685 - Build Tauri Desktop App MVP

## Problems Encountered and Solutions

### Issue 1: Invalid NSIS installMode Value

#### Error Message
```
unknown variant `perUser`, expected one of `currentUser`, `perMachine`, `both`
```

#### Root Cause
The `tauri.conf.json` file contained an invalid value for the NSIS installer configuration. Tauri v2 changed the accepted values for `installMode`.

#### Location
`src-tauri/tauri.conf.json` line 46

#### Original Code
```json
"nsis": {
  "license": null,
  "installerIcon": "icons/icon.ico",
  "headerImage": null,
  "sidebarImage": null,
  "installMode": "perUser"
}
```

#### Fix Applied
```json
"nsis": {
  "installerIcon": "icons/icon.ico",
  "installMode": "currentUser"
}
```

#### Changes Made
1. Changed `"perUser"` to `"currentUser"`
2. Removed `"license": null` (deprecated field)
3. Removed `"headerImage": null` (deprecated field)
4. Removed `"sidebarImage": null` (deprecated field)

#### Verification
```bash
cd src-tauri && cargo build
# Build now proceeds past configuration validation
```

---

### Issue 2: Deprecated Configuration Fields

#### Error Message
```
unknown field `license`, expected one of `template`, `header-image`, `headerImage`,
`sidebar-image`, `sidebarImage`, `install-icon`, `installerIcon`, `install-mode`,
`installMode`, `languages`, `customLanguageFiles`, `display-language-selector`,
`displayLanguageSelector`, `compression`, `start-menu-folder`, `startMenuFolder`,
`installer-hooks`, `installerHooks`, `minimum-webview2-version`, `minimumWebview2Version`

found an unknown configuration field. This usually means that you are using a CLI
version that is newer than `tauri-build` and is incompatible. Please try updating
the Rust crates by running `cargo update`
```

#### Root Cause
The configuration file contained fields from Tauri v1 that were removed or renamed in Tauri v2. The error message correctly suggested running `cargo update`.

#### Solution Steps

1. **Remove deprecated fields** (already done in Fix #1)

2. **Update Cargo dependencies**:
```bash
cd src-tauri
cargo update
```

#### Dependencies Updated

Major updates:
- `tauri`: 2.8.5 → 2.9.1
- `tauri-build`: 2.4.1 → 2.5.1
- `tauri-codegen`: 2.4.0 → 2.5.0
- `tauri-macros`: 2.4.0 → 2.5.0
- `tauri-plugin`: 2.4.0 → 2.5.1
- `tauri-runtime`: 2.8.0 → 2.9.1
- `tauri-runtime-wry`: 2.8.1 → 2.9.1
- `tauri-utils`: 2.7.0 → 2.8.0

Supporting crates:
- Multiple `objc2-*` crates: → 0.3.2
- `tokio`: 1.47.1 → 1.48.0
- `bitflags`: 2.9.4 → 2.10.0
- `tao`: 0.34.3 → 0.34.5
- `wry`: 0.53.3 → 0.53.5
- And 70+ transitive dependencies

Total: 84 packages locked to latest compatible versions

#### Verification
```bash
cargo build
# Build now completes successfully
```

---

### Issue 3: DMG Bundle Creation Failed

#### Error Message
```
failed to bundle project error running bundle_dmg.sh:
`failed to run /Users/studio/Documents/vibecode-webgui/src-tauri/target/release/bundle/dmg/bundle_dmg.sh`
```

#### Context
This error occurred during the final packaging step when creating the DMG installer.

#### Impact Analysis
- **Severity**: Low
- **Impact on MVP**: None - the .app bundle was created successfully
- **Impact on Distribution**: Low - DMG can be created manually

#### Root Cause
The automatic DMG creation script (`bundle_dmg.sh`) failed. Specific error not captured in output, but the .app bundle was created successfully before this step.

#### Status
- ✅ `.app` bundle: **Success** (4.9 MB, fully functional)
- ❌ `.dmg` installer: **Failed** (optional for MVP)
- 📄 Partial artifact: `rw.28958.VibeCode_0.1.0_aarch64.dmg` (29 MB, incomplete)

#### Workaround

**Option 1: Manual DMG creation with hdiutil**
```bash
cd src-tauri/target/release/bundle/macos
hdiutil create -volname "VibeCode" \
  -srcfolder VibeCode.app \
  -ov -format UDZO \
  VibeCode_0.1.0_aarch64.dmg
```

**Option 2: Disk Utility GUI**
1. Open Disk Utility
2. File → New Image → Image from Folder
3. Select `VibeCode.app`
4. Choose "compressed" format
5. Save as `VibeCode_0.1.0_aarch64.dmg`

**Option 3: Use create-dmg tool**
```bash
brew install create-dmg
create-dmg --volname "VibeCode" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "VibeCode.app" 200 190 \
  --hide-extension "VibeCode.app" \
  --app-drop-link 600 185 \
  "VibeCode_0.1.0_aarch64.dmg" \
  "VibeCode.app"
```

#### Recommendation
For MVP, distribute the `.app` bundle directly (zipped). Investigate DMG creation failure for future releases.

---

### Warning 1: Unused Import (Non-Breaking)

#### Warning Message
```
warning: unused import: `std::path::Path`
   --> src/commands.rs:170:9
    |
170 |     use std::path::Path;
    |         ^^^^^^^^^^^^^^^
```

#### Impact
None - compilation succeeds, warning only

#### Fix
```bash
cd src-tauri
cargo fix --bin "vibecode"
```

Or manually remove the import from `src/commands.rs:170`

---

### Warning 2: Dead Code (Non-Breaking)

#### Warning Message
```
warning: variants `NotAvailable` and `ConnectionError` are never constructed
  --> src/docker.rs:8:5
   |
6  | pub enum DockerError {
   |          ----------- variants in this enum
7  |     #[error("Docker is not available: {0}")]
8  |     NotAvailable(String),
   |     ^^^^^^^^^^^^
9  |     #[error("Docker connection error: {0}")]
10 |     ConnectionError(String),
   |     ^^^^^^^^^^^^^^^
```

#### Impact
None - these variants may be used in future error handling

#### Options

**Option 1**: Add `#[allow(dead_code)]` attribute
```rust
#[allow(dead_code)]
pub enum DockerError {
    NotAvailable(String),
    ConnectionError(String),
    // ...
}
```

**Option 2**: Use the variants in error handling
```rust
// Implement proper error handling that uses these variants
```

**Option 3**: Remove unused variants (not recommended if planned for future use)

#### Recommendation
Leave as-is for now, or add `#[allow(dead_code)]` if warnings are distracting.

---

### Warning 3: Bundle Identifier Ends with .app

#### Warning Message
```
Warn The bundle identifier "com.vibecode.app" set in `tauri.conf.json identifier`
ends with `.app`. This is not recommended because it conflicts with the application
bundle extension on macOS.
```

#### Impact
Cosmetic only - app functions normally

#### Current Value
```json
"identifier": "com.vibecode.app"
```

#### Recommended Fix
```json
"identifier": "com.vibecode.desktop"
```

#### Alternative Options
- `com.vibecode.client`
- `com.vibecode.application`
- `com.vibecode.dev`

#### When to Fix
Can be changed in next release. Changing the bundle identifier after distribution may affect:
- Saved preferences
- Keychain items
- App associations

---

## Summary of Fixes

| Issue | Severity | Status | Time to Fix |
|-------|----------|--------|-------------|
| Invalid installMode | Critical | ✅ Fixed | 2 minutes |
| Deprecated fields | Critical | ✅ Fixed | 2 minutes |
| Dependency versions | Critical | ✅ Fixed | 5 minutes (cargo update) |
| DMG creation | Low | ⏳ Workaround documented | N/A |
| Unused import warning | Info | 📝 Documented | 1 minute (optional) |
| Dead code warning | Info | 📝 Documented | 5 minutes (optional) |
| Bundle ID warning | Info | 📝 Documented | 2 minutes (future) |

## Lessons Learned

### 1. Configuration Validation
- Tauri build validates configuration during the build phase
- Errors are clear and indicate expected values
- Always check migration guides when upgrading major versions

### 2. Dependency Management
- `cargo update` is essential after Tauri version changes
- Compatible versions are locked automatically via Cargo.lock
- Update both Tauri CLI and Rust crates together

### 3. Build Warnings vs Errors
- Distinguish between blocking errors and informational warnings
- Non-blocking warnings can be addressed in future iterations
- Focus on getting the build working, then refine

### 4. DMG Creation
- DMG creation is separate from .app bundle creation
- .app bundle is the primary deliverable
- DMG is a convenience for distribution, not a requirement

### 5. Documentation
- Document fixes as you go
- Include error messages for searchability
- Provide multiple workaround options

## Verification Checklist

Use this checklist for future builds:

- [ ] Configuration file validates (`cargo build` passes config check)
- [ ] Dependencies are up to date (`cargo update` run recently)
- [ ] Release build completes (`cargo build --release`)
- [ ] .app bundle created (`npx @tauri-apps/cli build`)
- [ ] App launches successfully (`open *.app`)
- [ ] Process runs stably (check with `ps aux`)
- [ ] Bundle structure is valid (check Contents/Info.plist)
- [ ] Documentation updated

## References

- [Tauri v2 Migration Guide](https://v2.tauri.app/start/migrate/)
- [Tauri v2 Configuration Schema](https://schema.tauri.app/config/2)
- [Cargo Book - Dependencies](https://doc.rust-lang.org/cargo/reference/dependencies.html)
- [macOS Bundle Documentation](https://developer.apple.com/library/archive/documentation/CoreFoundation/Conceptual/CFBundles/)

---

**Document Version**: 1.0
**Last Updated**: October 25, 2025
**Status**: All critical issues resolved ✅
