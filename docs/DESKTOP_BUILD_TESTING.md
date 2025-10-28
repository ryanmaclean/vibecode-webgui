# Desktop Build Testing Guide

Quick reference for testing VibeCode desktop builds on all platforms.

## Pre-Release Testing Checklist

### macOS Testing

#### On Intel Mac (x86_64)
```bash
# Download the universal DMG
curl -LO https://github.com/your-repo/releases/download/desktop-v0.1.0/VibeCode_universal.dmg

# Mount and verify
hdiutil attach VibeCode_universal.dmg

# Verify code signature
codesign --verify --deep --strict --verbose=2 /Volumes/VibeCode/VibeCode.app

# Check architecture
lipo -info /Volumes/VibeCode/VibeCode.app/Contents/MacOS/VibeCode

# Expected output: Architectures in the fat file: x86_64 arm64

# Verify notarization
spctl --assess --type open --context context:primary-signature --verbose=4 /Volumes/VibeCode/VibeCode.app

# Install and test
cp -R /Volumes/VibeCode/VibeCode.app /Applications/
open /Applications/VibeCode.app
```

**Test:**
- [ ] App launches without Gatekeeper warning
- [ ] App opens code-server interface
- [ ] No crash reports in Console.app
- [ ] System tray icon appears
- [ ] Menu bar integration works
- [ ] App can be quit normally

#### On Apple Silicon Mac (ARM64)
```bash
# Same steps as Intel, verify architecture:
arch -arm64 /Applications/VibeCode.app/Contents/MacOS/VibeCode

# Check for Rosetta (should NOT be using Rosetta)
ps aux | grep VibeCode
# Look for "translated" in Activity Monitor
```

**Test:**
- [ ] App runs natively (not under Rosetta)
- [ ] Performance is good (native speed)
- [ ] All features work as expected

### Linux Testing

#### Ubuntu 22.04 (x86_64)

**Test .deb package:**
```bash
# Download
curl -LO https://github.com/your-repo/releases/download/desktop-v0.1.0/VibeCode_0.1.0_amd64.deb

# Verify checksum
sha256sum -c VibeCode_0.1.0_amd64.deb.sha256

# Install
sudo dpkg -i VibeCode_0.1.0_amd64.deb

# Check dependencies
dpkg -s vibecode

# Launch
vibecode
# Or from GUI menu
```

**Test:**
- [ ] Package installs without errors
- [ ] Desktop file appears in application menu
- [ ] App launches from terminal
- [ ] App launches from GUI menu
- [ ] Icon appears in system tray
- [ ] All features work

**Test .AppImage:**
```bash
# Download
curl -LO https://github.com/your-repo/releases/download/desktop-v0.1.0/VibeCode_0.1.0_amd64.AppImage

# Verify checksum
sha256sum -c VibeCode_0.1.0_amd64.AppImage.sha256

# Make executable
chmod +x VibeCode_0.1.0_amd64.AppImage

# Run
./VibeCode_0.1.0_amd64.AppImage
```

**Test:**
- [ ] AppImage runs without installation
- [ ] All features work
- [ ] Can create desktop integration via AppImageLauncher

#### Fedora 38 (x86_64)

**Test .rpm package:**
```bash
# Download
curl -LO https://github.com/your-repo/releases/download/desktop-v0.1.0/VibeCode-0.1.0-1.x86_64.rpm

# Verify checksum
sha256sum -c VibeCode-0.1.0-1.x86_64.rpm.sha256

# Install
sudo rpm -i VibeCode-0.1.0-1.x86_64.rpm

# Launch
vibecode
```

**Test:**
- [ ] Package installs without errors
- [ ] Desktop file appears in application menu
- [ ] App launches successfully
- [ ] All features work

#### Raspberry Pi 4 / ARM64 Linux

**Test ARM64 .deb:**
```bash
# Download ARM64 deb
curl -LO https://github.com/your-repo/releases/download/desktop-v0.1.0/VibeCode_0.1.0_arm64.deb

# Verify architecture
dpkg --print-architecture
# Should show: arm64

# Install
sudo dpkg -i VibeCode_0.1.0_arm64.deb

# Launch
vibecode
```

**Test:**
- [ ] Package installs on ARM64
- [ ] App runs natively (check with `uname -m`)
- [ ] Performance is acceptable
- [ ] All features work

**Test ARM64 AppImage:**
```bash
curl -LO https://github.com/your-repo/releases/download/desktop-v0.1.0/VibeCode_0.1.0_arm64.AppImage
chmod +x VibeCode_0.1.0_arm64.AppImage
./VibeCode_0.1.0_arm64.AppImage
```

### Windows Testing

#### Windows 10 (x86_64)

**Test MSI installer:**
```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/your-repo/releases/download/desktop-v0.1.0/VibeCode_0.1.0_x64.msi" -OutFile "VibeCode.msi"

# Verify checksum
Get-FileHash VibeCode.msi -Algorithm SHA256
# Compare with VibeCode_0.1.0_x64.msi.sha256

# Install (double-click or)
msiexec /i VibeCode.msi

# Launch
Start-Process -FilePath "$env:LOCALAPPDATA\Programs\VibeCode\VibeCode.exe"
```

**Test:**
- [ ] MSI installer runs without admin rights (per-user install)
- [ ] App installs to user directory
- [ ] Desktop shortcut created (if selected)
- [ ] Start menu entry created
- [ ] App launches successfully
- [ ] Windows Defender doesn't flag it (if signed)
- [ ] System tray icon appears
- [ ] All features work

**Test NSIS installer:**
```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/your-repo/releases/download/desktop-v0.1.0/VibeCode_0.1.0_x64-setup.exe" -OutFile "VibeCode-setup.exe"

# Run installer
.\VibeCode-setup.exe

# Launch
Start-Process -FilePath "$env:LOCALAPPDATA\Programs\VibeCode\VibeCode.exe"
```

**Test:**
- [ ] NSIS installer runs smoothly
- [ ] Installation completes without errors
- [ ] Uninstaller works correctly

#### Windows 11 (x86_64)

**Test both installers:**
- Repeat Windows 10 tests
- [ ] Windows 11 specific features work (if any)
- [ ] Modern context menus work
- [ ] Snap layouts work

## Functional Testing

### Core Features (All Platforms)

**Basic Functionality:**
- [ ] App launches successfully
- [ ] Window appears and is responsive
- [ ] Code-server interface loads
- [ ] Can create/edit files
- [ ] Can open terminal
- [ ] Can save files

**System Integration:**
- [ ] System tray icon works
- [ ] Can minimize to tray
- [ ] Native notifications work
- [ ] File associations work (if configured)
- [ ] Can open files from OS file manager

**Performance:**
- [ ] App launches in < 5 seconds
- [ ] Memory usage is reasonable (< 500MB idle)
- [ ] CPU usage is low when idle
- [ ] No memory leaks during extended use

**Stability:**
- [ ] No crashes during 1-hour usage
- [ ] Can handle large files
- [ ] Can switch between workspaces
- [ ] Graceful shutdown

## Regression Testing

### After Updates

**Update Process:**
- [ ] Auto-update notification appears
- [ ] Update downloads successfully
- [ ] Update installs without data loss
- [ ] Settings are preserved
- [ ] User data is intact

**Cross-Version:**
- [ ] Old version can be uninstalled
- [ ] New version installs over old version
- [ ] Data migration works correctly

## Security Testing

### Code Signing Verification

**macOS:**
```bash
# Verify signature
codesign --verify --deep --strict --verbose=2 /Applications/VibeCode.app

# Check notarization
spctl --assess --type execute --verbose=4 /Applications/VibeCode.app

# Verify DMG signature
codesign --verify --verbose=2 VibeCode.dmg
```

**Windows:**
```powershell
# Verify signature on MSI
Get-AuthenticodeSignature VibeCode.msi | Format-List

# Verify signature on EXE
Get-AuthenticodeSignature VibeCode-setup.exe | Format-List
```

**Expected:**
- [ ] Signatures are valid
- [ ] Certificates are not expired
- [ ] Trusted by OS

### Security Scan

**All Platforms:**
```bash
# Virus scan (example with ClamAV)
clamscan -r /Applications/VibeCode.app

# On Windows: use Windows Defender or VirusTotal
```

- [ ] No malware detected
- [ ] No suspicious network activity
- [ ] No unexpected file access

## Cross-Platform Consistency

### UI/UX Testing

Test the same workflow on all platforms:

1. **Launch app** → Should look consistent
2. **Open project** → Same behavior
3. **Edit file** → Same shortcuts work
4. **Terminal** → Same commands available
5. **Settings** → Same options available

**Checklist:**
- [ ] Consistent keyboard shortcuts
- [ ] Consistent menu structure
- [ ] Consistent appearance (accounting for OS differences)
- [ ] Feature parity across platforms

## Automated Testing Script

### Quick Test Script

Save as `test-desktop-build.sh`:

```bash
#!/bin/bash

PLATFORM=$(uname -s)
VERSION="0.1.0"

echo "Testing VibeCode Desktop v$VERSION on $PLATFORM"

case "$PLATFORM" in
  Darwin)
    echo "Testing macOS build..."

    # Verify app exists
    if [ ! -d "/Applications/VibeCode.app" ]; then
      echo "❌ VibeCode.app not found"
      exit 1
    fi

    # Check signature
    codesign --verify --deep --strict /Applications/VibeCode.app
    if [ $? -eq 0 ]; then
      echo "✅ Code signature valid"
    else
      echo "❌ Code signature invalid"
      exit 1
    fi

    # Launch app
    open /Applications/VibeCode.app
    sleep 5

    # Check if running
    if pgrep -x "VibeCode" > /dev/null; then
      echo "✅ App launched successfully"
    else
      echo "❌ App failed to launch"
      exit 1
    fi
    ;;

  Linux)
    echo "Testing Linux build..."

    # Check if installed
    if ! command -v vibecode &> /dev/null; then
      echo "❌ VibeCode not installed"
      exit 1
    fi

    # Launch app
    vibecode &
    APP_PID=$!
    sleep 5

    # Check if running
    if ps -p $APP_PID > /dev/null; then
      echo "✅ App launched successfully"
      kill $APP_PID
    else
      echo "❌ App failed to launch"
      exit 1
    fi
    ;;

  MINGW*|MSYS*)
    echo "Testing Windows build..."

    # Check if installed
    APP_PATH="$LOCALAPPDATA/Programs/VibeCode/VibeCode.exe"
    if [ ! -f "$APP_PATH" ]; then
      echo "❌ VibeCode not installed"
      exit 1
    fi

    # Launch app
    "$APP_PATH" &
    sleep 5

    # Check if running
    if tasklist | grep -q "VibeCode.exe"; then
      echo "✅ App launched successfully"
    else
      echo "❌ App failed to launch"
      exit 1
    fi
    ;;
esac

echo "✅ All tests passed"
```

## Reporting Issues

### Issue Template

When reporting build issues, include:

```markdown
**Platform:** macOS 13.5 / Ubuntu 22.04 / Windows 11
**Architecture:** x86_64 / ARM64
**Package Format:** .dmg / .deb / .msi / etc.
**Version:** 0.1.0

**Steps to Reproduce:**
1. Download package
2. Install package
3. Launch application

**Expected Behavior:**
App should launch successfully

**Actual Behavior:**
App crashes on launch

**Error Logs:**
- macOS: Console.app logs
- Linux: journalctl logs
- Windows: Event Viewer logs

**Screenshots:**
[Attach screenshots]

**Additional Context:**
Any other relevant information
```

## Performance Benchmarks

### Startup Time

Measure time from launch to ready:

```bash
# macOS
time open /Applications/VibeCode.app

# Linux
time vibecode

# Windows (PowerShell)
Measure-Command { Start-Process VibeCode.exe }
```

**Target:** < 5 seconds to ready state

### Memory Usage

```bash
# macOS
ps aux | grep VibeCode

# Linux
ps aux | grep vibecode

# Windows (PowerShell)
Get-Process VibeCode | Format-Table -Property Name,WS,CPU
```

**Target:** < 500MB idle, < 1GB under load

### Package Size

```bash
# Check installer size
ls -lh VibeCode_*
```

**Target:**
- macOS DMG: < 100MB
- Linux .deb/.rpm: < 80MB
- Linux .AppImage: < 100MB
- Windows MSI/NSIS: < 80MB

## Continuous Testing

### CI Integration

Add to `.github/workflows/desktop-test.yml`:

```yaml
name: Desktop Build Test

on:
  push:
    paths:
      - 'src-tauri/**'
  pull_request:
    paths:
      - 'src-tauri/**'

jobs:
  test-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and test
        run: |
          npm ci --legacy-peer-deps
          npm run tauri build
          # Run automated tests

  test-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and test
        run: |
          npm ci --legacy-peer-deps
          npm run tauri build
          # Run automated tests

  test-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and test
        run: |
          npm ci --legacy-peer-deps
          npm run tauri build
          # Run automated tests
```

## Summary

This testing guide ensures comprehensive validation of desktop builds across all platforms. Follow the checklist for each release to maintain quality and consistency.

**Quick Testing Command:**
```bash
# Download and run automated test
curl -sSL https://raw.githubusercontent.com/your-repo/main/scripts/test-desktop-build.sh | bash
```
