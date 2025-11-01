# Build Instructions - VibeCode v0.9-beta

Complete guide to building VibeCode from source.

---

## System Requirements

### Hardware
- Mac with Apple Silicon (M1/M2/M3/M4) **OR** Intel processor
- 16GB RAM minimum (32GB recommended)
- 50GB free disk space
- SSD recommended for best VM performance

### Software
- macOS 15.0 (Sequoia) or later
- Xcode Command Line Tools (for Swift compiler)
- Git

### Install Xcode Command Line Tools

```bash
xcode-select --install
```

Verify installation:
```bash
swift --version
# Should show Swift 5.9 or later
```

---

## Quick Build

### One-Command Build and Launch

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
./scripts/launch-vibecode.sh
```

This handles everything:
- Swift build
- App bundle creation
- Code signing
- Application launch

---

## Manual Build (Step-by-Step)

### 1. Clone Repository

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
```

### 2. Build Swift Application

```bash
cd VibeCodeSwift
swift build -c release
```

**Expected output**:
```
Building for production...
Build complete! (5-10s)
```

**Build artifacts**:
- Binary: `.build/release/VibeCode`
- Debug symbols: `.build/release/VibeCode.dSYM`

### 3. Create App Bundle

```bash
# Create bundle structure
mkdir -p .build/release/VibeCode.app/Contents/MacOS
mkdir -p .build/release/VibeCode.app/Contents/Resources

# Copy binary
cp .build/release/VibeCode .build/release/VibeCode.app/Contents/MacOS/

# Copy Info.plist
cp Info.plist .build/release/VibeCode.app/Contents/
```

### 4. Sign with Entitlements

```bash
# Sign the binary
codesign --force --sign - \
  --entitlements VibeCode.entitlements \
  .build/release/VibeCode.app/Contents/MacOS/VibeCode
```

**Required entitlements**:
- `com.apple.security.virtualization` - For VM management
- `com.apple.security.network.client` - For network access
- `com.apple.security.files.user-selected.read-write` - For VM images

### 5. Verify Build

```bash
# Check binary exists
test -f .build/release/VibeCode && echo "✅ Binary built"

# Verify entitlements
codesign -d --entitlements - .build/release/VibeCode.app 2>&1 | \
  grep "com.apple.security.virtualization" && \
  echo "✅ Entitlements applied"

# Test launch
open .build/release/VibeCode.app
```

---

## Build Configurations

### Debug Build (For Development)

```bash
cd VibeCodeSwift
swift build -c debug
```

**Advantages**:
- Faster compilation
- Debug symbols included
- Better error messages

**Location**: `.build/debug/VibeCode`

### Release Build (For Distribution)

```bash
cd VibeCodeSwift
swift build -c release
```

**Advantages**:
- Optimized performance
- Smaller binary size
- Production-ready

**Location**: `.build/release/VibeCode`

---

## Build Options

### Clean Build

```bash
cd VibeCodeSwift
swift package clean
rm -rf .build
swift build -c release
```

Use when:
- Build errors occur
- Switching Swift versions
- Making major changes

### Build with Verbose Output

```bash
swift build -c release -v
```

Shows detailed compilation steps.

---

## Troubleshooting Build Issues

### "Module not found" Error

**Solution**: Clean and rebuild
```bash
swift package clean
swift build -c release
```

### "SDK not supported" Error

**Cause**: Swift toolchain mismatch

**Solution**:
```bash
# Clear Swift cache
rm -rf ~/Library/Caches/org.swift.swiftpm
swift build -c release
```

### Code Signing Fails

**Check**: Entitlements file exists
```bash
test -f VibeCode.entitlements && echo "✅ Found" || echo "❌ Missing"
```

**Fix**: Ensure entitlements file is present
```bash
# File should contain virtualization entitlement
cat VibeCode.entitlements | grep virtualization
```

### Build Takes Too Long

**Normal build time**:
- First build: 30-60 seconds
- Incremental: 5-10 seconds

**If slower**:
- Close other applications
- Check disk space
- Use SSD (not external HDD)

---

## Build Outputs

### File Structure

```
VibeCodeSwift/
└── .build/
    └── release/
        ├── VibeCode                    # Binary
        ├── VibeCode.dSYM/              # Debug symbols
        └── VibeCode.app/               # App bundle
            └── Contents/
                ├── MacOS/
                │   └── VibeCode        # Executable
                ├── Resources/
                └── Info.plist
```

### Binary Size

- **Debug build**: ~10-15 MB
- **Release build**: ~5-8 MB (optimized)

### Dependencies

All dependencies are managed by Swift Package Manager:
- Foundation (built-in)
- SwiftUI (built-in)
- Virtualization (built-in framework)
- Combine (built-in)

**No external dependencies required!**

---

## Automated Build Validation

### Run Build Tests

```bash
./scripts/regression-tests.sh
```

Validates:
- Build succeeds
- Binary created
- Entitlements applied
- VM images present
- Configuration valid

### CI/CD Build

GitHub Actions workflow:
```bash
# See: .github/workflows/vibecode-tests.yml
# Runs automatically on push to main
```

---

## Build for Distribution

### Create Distributable Package

```bash
# 1. Build release version
cd VibeCodeSwift
swift build -c release

# 2. Create app bundle with all resources
./build_app_bundle.sh

# 3. Create DMG (macOS disk image)
hdiutil create -volname "VibeCode" \
  -srcfolder .build/release/VibeCode.app \
  -ov -format UDZO \
  VibeCode-v0.9-beta.dmg
```

### Notarization (For Public Distribution)

For distribution outside the App Store:
1. Sign with Developer ID certificate
2. Notarize with Apple
3. Staple notarization ticket

**Note**: v0.9-beta uses ad-hoc signing (local development only)

---

## Build Performance

### Compilation Time

| Build Type | First Build | Incremental |
|------------|-------------|-------------|
| Debug | 30-45s | 5-10s |
| Release | 45-60s | 10-15s |

### Optimization

**Release builds use**:
- `-O` optimization level
- Whole-module optimization
- Dead code elimination

**Result**: 40-50% smaller binaries, 2-3x faster execution

---

## Platform-Specific Notes

### Apple Silicon (M1/M2/M3/M4)

```bash
# Native build (recommended)
swift build -c release

# Architecture
file .build/release/VibeCode
# Should show: arm64
```

### Intel Macs

```bash
# Native x86_64 build
swift build -c release --arch x86_64
```

**Note**: Apple Silicon recommended for best VM performance

### Universal Binary

```bash
# Build for both architectures
swift build -c release --arch arm64 --arch x86_64
```

Larger binary but runs natively on both platforms.

---

## Advanced Build Options

### Custom VM Image Location

Edit `VMManager.swift` to change VM search paths:
```swift
// Default paths checked:
1. Bundle.main.resourcePath/vms
2. /Users/<user>/vibecode-webgui/dist/vm-images
3. ~/Library/Application Support/VibeCode/vms
```

### Enable ASIF Format (macOS 26+ Tahoe)

Automatically detected! When running on Tahoe:
- VMs will use ASIF format (2-3x faster)
- No code changes needed
- See `DiskImageManager.swift`

### Custom Entitlements

Edit `VibeCode.entitlements` to add/remove permissions:
```xml
<key>com.apple.security.app-sandbox</key>
<false/>  <!-- Disabled for VM image access -->
```

---

## Verification

### Verify Complete Build

```bash
./scripts/complete-feature-validation.sh
```

Checks:
- Binary exists
- Entitlements applied
- VM images present
- Network configured
- App launches

### Test Installation

```bash
# Copy to Applications
cp -r VibeCodeSwift/.build/release/VibeCode.app /Applications/

# Launch from Applications
open /Applications/VibeCode.app
```

---

## Build Artifacts

After successful build:

```bash
# Binary
VibeCodeSwift/.build/release/VibeCode

# App Bundle
VibeCodeSwift/.build/release/VibeCode.app

# Logs
logs/vibecode.log

# Test Results  
logs/staff-test-results.txt
```

---

## Next Steps

After building:
1. Read [USAGE.md](USAGE.md) for how to use the app
2. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
3. Check [VMS_WORKING_STATUS.md](../../VMS_WORKING_STATUS.md) for current status

---

**Questions?** See the main documentation or file an issue on GitHub.

