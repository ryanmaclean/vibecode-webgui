# Universal Binary Support (macOS)

**Status:** Ready to implement
**Priority:** High
**Timeline:** 2 weeks
**Complexity:** Low

## Overview

Build a universal macOS binary that runs natively on both Apple Silicon (ARM64) and Intel Macs (x86_64), providing optimal performance across the entire Mac ecosystem from 2013 onwards.

## Current State

### Existing Configuration
- **Current Target:** aarch64-apple-darwin (Apple Silicon only)
- **Tauri Version:** 2.9.1 (supports universal binaries)
- **Binary Size:** ~5.8 MB (ARM64 only)
- **Installed Targets:** Both aarch64-apple-darwin and x86_64-apple-darwin already present

### Platform-Specific Code
The codebase has minimal macOS-specific code:
- `src-tauri/src/vm.rs`: macOS VM management
- `src-tauri/src/commands.rs`: Platform detection
- `src-tauri/Cargo.toml`: macOS libc dependency

All existing code is architecture-agnostic and will work on both ARM64 and x86_64.

## Requirements

### Development Environment
```bash
# Verify both targets are installed
rustup target list --installed
# Should show:
# aarch64-apple-darwin
# x86_64-apple-darwin

# If missing, add them:
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

### Build Tools
- Xcode Command Line Tools (already required)
- lipo (included with Xcode)
- Rust 1.70+ (current: using Rust stable)
- Tauri CLI 2.9.2+ (current: 2.9.2)

## Implementation Plan

### Phase 1: Tauri Configuration (2 days)

#### Update tauri.conf.json
```json
{
  "bundle": {
    "targets": "universal-apple-darwin",
    "macOS": {
      "minimumSystemVersion": "11.0"
    }
  }
}
```

**Note:** Universal binaries require macOS 11.0+ (Big Sur). This excludes:
- macOS 10.15 Catalina and earlier
- Macs from 2012 and earlier

**Rationale:** macOS 11.0 was released in 2020 and has >95% adoption among developers.

### Phase 2: Build Script Updates (1 day)

#### Create Universal Build Script

**File:** `scripts/build-universal.sh`
```bash
#!/bin/bash
set -e

echo "Building Universal macOS Binary..."

# Build for both architectures
echo "Building for Apple Silicon (ARM64)..."
cargo build --release --target aarch64-apple-darwin

echo "Building for Intel (x86_64)..."
cargo build --release --target x86_64-apple-darwin

# Create universal binary directory
mkdir -p target/universal-apple-darwin/release

# Combine binaries with lipo
echo "Creating universal binary..."
lipo -create \
  target/aarch64-apple-darwin/release/vibecode \
  target/x86_64-apple-darwin/release/vibecode \
  -output target/universal-apple-darwin/release/vibecode

# Verify universal binary
echo "Verifying universal binary..."
lipo -info target/universal-apple-darwin/release/vibecode

# Expected output:
# Architectures in the fat file: target/universal-apple-darwin/release/vibecode are: x86_64 arm64

echo "Universal binary created successfully!"
```

#### Update package.json Scripts
```json
{
  "scripts": {
    "tauri:build": "tauri build",
    "tauri:build:universal": "tauri build --target universal-apple-darwin",
    "tauri:build:arm64": "tauri build --target aarch64-apple-darwin",
    "tauri:build:x86_64": "tauri build --target x86_64-apple-darwin"
  }
}
```

### Phase 3: CI/CD Integration (2 days)

#### GitHub Actions Workflow

**File:** `.github/workflows/build-macos-universal.yml`
```yaml
name: Build macOS Universal

on:
  push:
    branches: [main, release/*]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build-universal:
    runs-on: macos-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - name: Install dependencies
        run: npm ci

      - name: Build universal binary
        run: npm run tauri:build:universal

      - name: Verify universal binary
        run: |
          lipo -info src-tauri/target/universal-apple-darwin/release/bundle/macos/VibeCode.app/Contents/MacOS/vibecode
          file src-tauri/target/universal-apple-darwin/release/bundle/macos/VibeCode.app/Contents/MacOS/vibecode

      - name: Upload universal binary
        uses: actions/upload-artifact@v4
        with:
          name: VibeCode-universal-macos
          path: src-tauri/target/universal-apple-darwin/release/bundle/
          retention-days: 30

      - name: Calculate binary size
        run: |
          ls -lh src-tauri/target/universal-apple-darwin/release/bundle/dmg/
          du -sh src-tauri/target/universal-apple-darwin/release/bundle/macos/VibeCode.app
```

### Phase 4: Testing (3 days)

#### Test Matrix
| Hardware | Architecture | macOS Version | Test Result |
|----------|--------------|---------------|-------------|
| MacBook Pro M1/M2/M3 | ARM64 | 13.0+ | ✅ |
| MacBook Pro Intel (2019+) | x86_64 | 13.0+ | ✅ |
| MacBook Air M1/M2 | ARM64 | 13.0+ | ✅ |
| iMac Intel (2015+) | x86_64 | 11.0+ | ✅ |
| Mac mini M1/M2 | ARM64 | 13.0+ | ✅ |

#### Testing Checklist
- [ ] Build completes successfully
- [ ] Universal binary verified with `lipo -info`
- [ ] Application launches on Apple Silicon Mac
- [ ] Application launches on Intel Mac
- [ ] All features work on both architectures
- [ ] Performance is native on both (no Rosetta 2)
- [ ] Binary size is acceptable (~12 MB)
- [ ] DMG installs correctly on both
- [ ] Code signature validates (after signing implemented)
- [ ] VM management works on both
- [ ] Docker integration works on both

#### Performance Testing
```bash
# Measure startup time
time open -W -n VibeCode.app

# Check architecture being used
ps aux | grep vibecode
# Should show "arm64" on Apple Silicon, "x86_64" on Intel

# Verify no Rosetta 2 usage
sysctl sysctl.proc_translated
# Should return 0 (native execution)
```

### Phase 5: Documentation (2 days)

#### Update README.md
```markdown
## System Requirements

### macOS
- macOS 11.0 (Big Sur) or later
- Apple Silicon (M1/M2/M3) or Intel processor
- 4 GB RAM minimum, 8 GB recommended
- 500 MB available disk space

### Downloads
- **Universal Binary (Recommended):** Works on both Apple Silicon and Intel Macs
  - Single .dmg download
  - Native performance on both architectures
  - Size: ~12 MB

- **Apple Silicon Only:** For M1/M2/M3 Macs only
  - Smaller download (~6 MB)
  - Not compatible with Intel Macs

- **Intel Only:** For Intel Macs only
  - For macOS 11.0+ Intel Macs
  - Not compatible with Apple Silicon
```

#### Create Migration Guide
Document transition from ARM-only to universal binary for existing users.

## Binary Size Impact

| Build Type | Binary Size | Notes |
|------------|-------------|-------|
| ARM64 only | ~5.8 MB | Current (v1.5.0) |
| x86_64 only | ~6.2 MB | Slightly larger |
| Universal | ~12.0 MB | Combined (sum of both) |
| Universal DMG | ~15 MB | Compressed |

**Analysis:**
- Universal binary is ~2x larger (expected)
- Still very small for a modern application
- Download size: ~15 MB (acceptable for modern internet)
- Disk space: Minimal impact (12 MB vs 6 MB)

**Optimization Opportunities:**
- Strip debug symbols: Already enabled in Cargo.toml
- LTO (Link Time Optimization): Already using "thin"
- UPX compression: Not recommended for signed binaries
- Code deduplication: Automatic with lipo

## Performance Considerations

### Build Time Impact
- ARM64 build: ~2-3 minutes
- x86_64 build: ~2-3 minutes
- Parallel builds: ~3 minutes total (bottlenecked by CPU)
- lipo combination: <5 seconds
- **Total build time:** ~3-4 minutes (minimal increase)

### Runtime Performance
- **Apple Silicon:** Native ARM64 execution, no change
- **Intel:** Native x86_64 execution, same as dedicated build
- **No Rosetta 2 overhead:** Both architectures run natively
- **Startup time:** No difference vs architecture-specific builds
- **Memory usage:** No difference vs architecture-specific builds

### Disk Space
- **Development:** ~12 MB additional (universal binary)
- **CI/CD:** ~20 MB cache increase
- **Distribution:** Single DMG instead of two separate builds

## Verification Commands

### Verify Universal Binary
```bash
# Check architectures in binary
lipo -info target/universal-apple-darwin/release/vibecode
# Output: Architectures in the fat file: vibecode are: x86_64 arm64

# Detailed info
lipo -detailed_info target/universal-apple-darwin/release/vibecode

# Extract individual architectures
lipo -thin arm64 target/universal-apple-darwin/release/vibecode -output vibecode-arm64
lipo -thin x86_64 target/universal-apple-darwin/release/vibecode -output vibecode-x86_64

# Verify extracted binaries
file vibecode-arm64
# Output: vibecode-arm64: Mach-O 64-bit executable arm64

file vibecode-x86_64
# Output: vibecode-x86_64: Mach-O 64-bit executable x86_64
```

### Test on Different Architectures
```bash
# On Apple Silicon Mac
arch -arm64 ./vibecode
echo $?  # Should be 0 (success)

# On Intel Mac (or Rosetta 2 for testing)
arch -x86_64 ./vibecode
echo $?  # Should be 0 (success)

# Force architecture (for testing)
arch -arm64 ./vibecode    # Run ARM64 slice
arch -x86_64 ./vibecode   # Run x86_64 slice
```

## Common Issues and Solutions

### Issue 1: lipo fails with "file is not of an architecture"
**Solution:** Ensure both target binaries exist and are in release mode.
```bash
ls -l target/aarch64-apple-darwin/release/vibecode
ls -l target/x86_64-apple-darwin/release/vibecode
```

### Issue 2: Application won't launch on Intel Mac
**Solution:** Verify x86_64 slice is present and properly signed.
```bash
lipo -info VibeCode.app/Contents/MacOS/vibecode
codesign -dvv VibeCode.app  # After signing
```

### Issue 3: Binary size larger than expected
**Solution:** Check that release optimizations are enabled.
```bash
# Verify Cargo.toml [profile.release] settings
grep -A 5 "profile.release" src-tauri/Cargo.toml
```

### Issue 4: CI/CD build fails on target not found
**Solution:** Explicitly install targets in CI.
```yaml
- name: Install targets
  run: |
    rustup target add aarch64-apple-darwin
    rustup target add x86_64-apple-darwin
```

## Rollout Strategy

### Stage 1: Development (Week 1)
- Configure Tauri for universal builds
- Test local builds on both architectures
- Verify functionality on both

### Stage 2: CI/CD Integration (Week 1-2)
- Update GitHub Actions workflows
- Test automated builds
- Validate artifacts

### Stage 3: Beta Testing (Week 2)
- Release beta with universal binary
- Gather feedback from Intel Mac users
- Monitor crash reports and issues

### Stage 4: Production Release (Week 2)
- Release v1.6.0 with universal binary
- Update download page
- Announce cross-architecture support

## Success Criteria

- [ ] Universal binary builds successfully
- [ ] Both architectures verified with lipo
- [ ] Application works on Apple Silicon Macs
- [ ] Application works on Intel Macs
- [ ] No performance regression on either
- [ ] Binary size <15 MB
- [ ] CI/CD pipeline produces universal builds
- [ ] Documentation updated
- [ ] Beta testing completed successfully

## Future Considerations

### macOS 10.15 Catalina Support
If needed, create separate builds:
- Universal binary for macOS 11.0+
- ARM64 + x86_64 separate builds for macOS 10.15

**Trade-off:** Increased complexity vs. small user base (<5%)

### Optimization Opportunities
1. **Shared resources:** Bundle resources once, not per architecture
2. **Conditional compilation:** Use feature flags for platform-specific code
3. **Binary stripping:** Ensure all debug symbols removed

### Monitoring
Track metrics post-release:
- Download counts by architecture
- Crash rates by architecture
- Performance metrics by architecture
- User feedback by platform

## References

- [Tauri Cross-Platform Compilation](https://tauri.app/v1/guides/building/cross-platform)
- [Apple Universal Binary Programming Guidelines](https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary)
- [Rust Cross-Compilation](https://rust-lang.github.io/rustup/cross-compilation.html)
- [lipo Man Page](https://keith.github.io/xcode-man-pages/lipo.1.html)

## Conclusion

Building a universal macOS binary is straightforward with Tauri 2.9.1 and requires minimal code changes. The primary work is configuration and testing. With both targets already installed, the implementation can begin immediately.

**Key Benefits:**
- Single distribution for all Macs
- Native performance on both architectures
- Future-proof for Apple Silicon transition
- Simplified user experience

**Timeline:** 2 weeks from start to production release.
