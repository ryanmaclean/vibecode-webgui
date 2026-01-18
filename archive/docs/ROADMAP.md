# VibeCode v1.6.0 Roadmap

**Target Release:** Q1 2026 (February 21, 2026)
**Focus:** Cross-platform support + Code signing
**Development Timeline:** 14 weeks (3.5 months)

## Executive Summary

VibeCode v1.6.0 will transform from a macOS Apple Silicon exclusive application to a full cross-platform developer tool supporting Intel Mac, Linux, and Windows. This expansion includes professional code signing, notarization, and preparation for app store distribution.

## Current State (v1.5.0)

- **Platform:** macOS Apple Silicon only (ARM64)
- **Binary Size:** ~5.8 MB
- **Architecture:** Tauri 2.9.1 + Next.js 16.0.1
- **Distribution:** Direct DMG download
- **Code Signing:** None (developer testing only)
- **Installed Targets:** aarch64-apple-darwin, x86_64-apple-darwin

## Major Features

### 1. Universal macOS Binary
**Timeline:** 2 weeks (Weeks 1-2)
**Priority:** High
**Complexity:** Low

Support both Apple Silicon and Intel Macs with a single universal binary.

**Implementation:**
- Leverage existing x86_64-apple-darwin target
- Configure Tauri for universal-apple-darwin target
- Build both architectures in parallel
- Combine with lipo into universal binary
- Update CI/CD pipeline for universal builds

**Expected Results:**
- Single .dmg for all Macs (2013+)
- Binary size: ~12 MB (combined)
- Performance: Native speed on both architectures
- Testing: Automated tests on both platforms

**Technical Details:**
```bash
# Both targets already installed
rustup target add x86_64-apple-darwin  # Already present
rustup target add aarch64-apple-darwin  # Already present

# Tauri configuration
{
  "bundle": {
    "targets": ["universal-apple-darwin"]
  }
}
```

### 2. Linux Support
**Timeline:** 4 weeks (Weeks 3-6)
**Priority:** High
**Complexity:** Medium

Support major Linux distributions with native package formats.

**Target Distributions:**
1. **Debian/Ubuntu** - .deb package (Primary)
2. **Fedora/RHEL** - .rpm package
3. **Universal** - AppImage (fallback)
4. **Snap Store** - Optional (future consideration)

**System Requirements:**
- glibc 2.31+ (Ubuntu 20.04+, Debian 11+)
- GTK 3.24+
- WebKit2GTK 4.1+
- X11 or Wayland

**Dependencies to Install:**
```bash
# Ubuntu/Debian
libwebkit2gtk-4.1-dev
build-essential
libssl-dev
libgtk-3-dev
libayatana-appindicator3-dev
librsvg2-dev

# Fedora/RHEL
webkit2gtk4.1-devel
openssl-devel
gtk3-devel
libappindicator-gtk3-devel
librsvg2-devel
```

**Package Configuration:**
```json
{
  "bundle": {
    "targets": ["deb", "rpm", "appimage"],
    "linux": {
      "deb": {
        "depends": [
          "libwebkit2gtk-4.1-0",
          "libgtk-3-0",
          "libssl3"
        ]
      }
    }
  }
}
```

**Challenges:**
- Docker container management on Linux (requires podman fallback)
- VM management (virt-manager/libvirt integration)
- System tray icon variations across desktop environments
- Package signing and repository hosting

### 3. Windows Support
**Timeline:** 4 weeks (Weeks 7-10)
**Priority:** High
**Complexity:** Medium-High

Support Windows 10/11 with professional installer packages.

**Target Formats:**
1. **MSI Installer** - Enterprise deployment (primary)
2. **NSIS Installer** - User-friendly (alternative)
3. **Portable EXE** - No installation required

**System Requirements:**
- Windows 10 build 1809+ (October 2018 Update)
- Windows 11 (all versions)
- WebView2 Runtime (auto-installed)
- Visual C++ Redistributable (bundled)

**Package Configuration:**
```json
{
  "bundle": {
    "targets": ["msi", "nsis"],
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      },
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

**Challenges:**
- Docker Desktop vs Docker Engine integration
- WSL2 VM management
- Windows Defender SmartScreen reputation
- Code signing certificate acquisition and renewal
- VM provisioning (Hyper-V vs VirtualBox vs VMware)

**Platform-Specific Code:**
The codebase already has Windows-specific code paths:
- `src-tauri/src/commands.rs` - Windows VM paths
- WebView2 instead of WebKit
- Different tray icon handling

### 4. Code Signing & Notarization
**Timeline:** 2 weeks setup + ongoing (Weeks 11-12)
**Priority:** Critical
**Complexity:** Medium

Professional code signing for all platforms to ensure user trust and security.

#### macOS Code Signing

**Requirements:**
- Apple Developer Account: $99/year
- Developer ID Application Certificate
- Notarization via notarytool
- Hardened runtime entitlements

**Process:**
```bash
# 1. Sign application
codesign --force --deep \
  --sign "Developer ID Application: VibeCode Team" \
  --options runtime \
  --entitlements entitlements.plist \
  --timestamp \
  VibeCode.app

# 2. Create DMG
create-dmg \
  --volname "VibeCode" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  VibeCode.dmg \
  VibeCode.app

# 3. Notarize
xcrun notarytool submit VibeCode.dmg \
  --apple-id team@vibecode.com \
  --team-id <TEAM_ID> \
  --password <app-specific-password> \
  --wait

# 4. Staple notarization ticket
xcrun stapler staple VibeCode.app
xcrun stapler staple VibeCode.dmg
```

**Timeline to Deploy:**
- Developer account setup: 1-2 days
- Certificate generation: Immediate
- CI/CD integration: 1-2 days
- Per-release overhead: 5-10 minutes

#### Windows Code Signing

**Requirements:**
- Code Signing Certificate: $100-200/year (standard)
- EV Certificate: $300-500/year (recommended for SmartScreen)
- Hardware token for EV certificates
- Timestamp server for long-term verification

**Process:**
```bash
# Sign executable with signtool
signtool sign /f certificate.pfx \
  /p <password> \
  /fd SHA256 \
  /tr http://timestamp.digicert.com \
  /td SHA256 \
  /d "VibeCode" \
  /du "https://vibecode.app" \
  VibeCode.exe

# Sign installer
signtool sign /f certificate.pfx \
  /p <password> \
  /fd SHA256 \
  /tr http://timestamp.digicert.com \
  /td SHA256 \
  VibeCode-Setup.msi
```

**SmartScreen Reputation:**
- New certificates have no reputation (warnings shown)
- Build reputation through downloads over 3-6 months
- EV certificates get immediate reputation
- Alternative: Submit to Microsoft for analysis

#### Linux Package Signing

**Requirements:**
- GPG key pair (free)
- Public key distribution
- Package repository (GitHub Releases or custom)

**Process:**
```bash
# Generate GPG key
gpg --full-generate-key

# Sign .deb package
dpkg-sig --sign builder vibecode_1.6.0_amd64.deb

# Sign .rpm package
rpm --addsign vibecode-1.6.0-1.x86_64.rpm

# Export public key
gpg --armor --export team@vibecode.com > vibecode-signing-key.asc
```

**Cost Summary:**
- macOS: $99/year (Apple Developer)
- Windows: $300-500/year (EV certificate recommended)
- Linux: $0 (GPG)
- **Total Annual Cost:** ~$400-600/year

### 5. App Store Distribution (Optional - v1.7.0)
**Timeline:** 6-8 weeks (Future release)
**Priority:** Medium
**Complexity:** High

This is planned for v1.7.0 after v1.6.0 stabilizes.

**Potential Stores:**
1. **Mac App Store** - Requires sandboxing, entitlements, different signing
2. **Microsoft Store** - Requires Windows app certification
3. **Snap Store** - Linux universal packaging
4. **Flathub** - Flatpak distribution

**Challenges:**
- Sandboxing restrictions (Docker/VM access limited)
- App review processes and guidelines
- Subscription/purchase integration
- In-app purchase setup
- Reduced functionality in sandboxed environment

**Decision:** Postpone to v1.7.0 to focus on direct distribution first.

## Performance Improvements

### Startup Time Optimization
**Target:** <1 second cold start
**Current:** ~2-3 seconds

**Optimizations:**
- Lazy load ML models
- Defer Docker connection until needed
- Optimize Rust binary size
- Preload critical resources
- Use splash screen for perceived performance

### Memory Footprint Reduction
**Target:** <150 MB idle memory
**Current:** ~200-250 MB

**Optimizations:**
- Release unused VM resources
- Optimize WebView memory usage
- Reduce bundle size
- Implement proper cleanup on window close

### VM Management
**Improvements:**
- Faster VM provisioning (<30s for new environments)
- Better resource limits and detection
- Improved error handling and recovery
- Platform-specific VM backends (vfkit, WSL2, virt-manager)

## Bug Fixes

### Production Build Issues
- **Turbopack compatibility:** Fix production build with Turbopack
- **Worker threads:** Ensure compatibility across all platforms
- **WebSocket connections:** Stable connections on all platforms

### Performance Metrics
- **Lighthouse LCP:** Fix measurement methodology
- **Core Web Vitals:** Improve FCP, LCP, CLS scores
- **Performance monitoring:** Cross-platform metrics collection

### Platform-Specific Bugs
- macOS: VM restart reliability
- Linux: System tray icon on different DEs
- Windows: Docker Desktop integration

## Documentation

### User Documentation
1. **Installation Guides**
   - macOS (Universal binary)
   - Linux (Debian, Ubuntu, Fedora, Arch)
   - Windows (10, 11)
   - System requirements per platform

2. **Platform-Specific Guides**
   - Docker/VM setup on each platform
   - Troubleshooting common issues
   - Performance optimization tips

3. **Migration Guides**
   - v1.5.0 → v1.6.0 upgrade path
   - Data migration (settings, projects)
   - Platform switching (e.g., macOS → Linux)

### Developer Documentation
1. **Build Instructions**
   - Cross-compilation setup
   - Building for all platforms
   - Testing multi-platform builds

2. **Code Signing Documentation**
   - Certificate acquisition and setup
   - Signing process for each platform
   - CI/CD integration

3. **Distribution Best Practices**
   - Release checklist
   - Update mechanisms
   - Analytics and crash reporting

## CI/CD Enhancements

### Multi-Platform Build Pipeline

```yaml
name: Build Cross-Platform

on:
  push:
    tags:
      - 'v*'

jobs:
  build-macos-universal:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Rust
        run: |
          rustup target add aarch64-apple-darwin
          rustup target add x86_64-apple-darwin
      - name: Build universal
        run: npm run tauri build -- --target universal-apple-darwin
      - name: Sign and notarize
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
        run: ./scripts/sign-macos.sh
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-universal
          path: src-tauri/target/universal-apple-darwin/release/bundle/

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: |
          sudo apt update
          sudo apt install -y libwebkit2gtk-4.1-dev \
            build-essential libssl-dev libgtk-3-dev \
            libayatana-appindicator3-dev librsvg2-dev
      - name: Build
        run: npm run tauri build -- --target x86_64-unknown-linux-gnu
      - name: Sign packages
        env:
          GPG_PRIVATE_KEY: ${{ secrets.GPG_PRIVATE_KEY }}
        run: ./scripts/sign-linux.sh
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: linux-x86_64
          path: src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: npm run tauri build -- --target x86_64-pc-windows-msvc
      - name: Sign executables
        env:
          WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
          WINDOWS_PASSWORD: ${{ secrets.WINDOWS_PASSWORD }}
        run: .\scripts\sign-windows.ps1
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-x86_64
          path: src-tauri\target\x86_64-pc-windows-msvc\release\bundle\

  release:
    needs: [build-macos-universal, build-linux, build-windows]
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            macos-universal/**/*
            linux-x86_64/**/*
            windows-x86_64/**/*
          generate_release_notes: true
```

### Automated Testing

**Test Matrix:**
- macOS 13, 14, 15 (Intel + ARM)
- Ubuntu 20.04, 22.04, 24.04
- Windows 10 (latest), Windows 11
- Automated E2E tests on all platforms
- Performance benchmarks
- Security scans

## Breaking Changes

**None planned.** v1.6.0 maintains full backward compatibility with v1.5.0.

**Migration Path:** Seamless upgrade - settings, projects, and data are preserved.

## Release Timeline

| Milestone | Duration | Start Date | Target Date |
|-----------|----------|------------|-------------|
| **Phase 1: macOS Universal** | 2 weeks | 2025-11-01 | 2025-11-15 |
| - Add universal binary support | 1 week | 2025-11-01 | 2025-11-08 |
| - Update CI/CD for universal builds | 3 days | 2025-11-08 | 2025-11-11 |
| - Testing on both architectures | 4 days | 2025-11-11 | 2025-11-15 |
| **Phase 2: Linux Support** | 4 weeks | 2025-11-15 | 2025-12-13 |
| - Setup build environment | 1 week | 2025-11-15 | 2025-11-22 |
| - Implement Linux-specific features | 2 weeks | 2025-11-22 | 2025-12-06 |
| - Package and test distributions | 1 week | 2025-12-06 | 2025-12-13 |
| **Phase 3: Windows Support** | 4 weeks | 2025-12-13 | 2026-01-10 |
| - Setup build environment | 1 week | 2025-12-13 | 2025-12-20 |
| - Implement Windows-specific features | 2 weeks | 2025-12-20 | 2026-01-03 |
| - Package and test installers | 1 week | 2026-01-03 | 2026-01-10 |
| **Phase 4: Code Signing** | 2 weeks | 2026-01-10 | 2026-01-24 |
| - Acquire certificates | 3 days | 2026-01-10 | 2026-01-13 |
| - Implement signing pipelines | 1 week | 2026-01-13 | 2026-01-20 |
| - Test signed builds | 4 days | 2026-01-20 | 2026-01-24 |
| **Phase 5: Integration Testing** | 2 weeks | 2026-01-24 | 2026-02-07 |
| - Cross-platform testing | 1 week | 2026-01-24 | 2026-01-31 |
| - Performance validation | 1 week | 2026-01-31 | 2026-02-07 |
| **Phase 6: Documentation & Release** | 2 weeks | 2026-02-07 | 2026-02-21 |
| - Complete documentation | 1 week | 2026-02-07 | 2026-02-14 |
| - Release preparation | 1 week | 2026-02-14 | 2026-02-21 |
| **v1.6.0 Release** | - | - | **2026-02-21** |

**Total Development Time:** 14 weeks (3.5 months)

## Success Metrics

### Platform Support
- [ ] Universal macOS binary (ARM64 + x86_64) shipping
- [ ] Linux .deb, .rpm, AppImage available
- [ ] Windows MSI and NSIS installers available
- [ ] All platforms code signed and verified

### Quality Metrics
- [ ] <5% crash rate across all platforms
- [ ] >90 Lighthouse performance score
- [ ] <1s startup time on modern hardware
- [ ] <150 MB idle memory usage

### Distribution Metrics
- [ ] Automated release pipeline for all platforms
- [ ] Code signing integrated into CI/CD
- [ ] Notarization successful for macOS
- [ ] Windows SmartScreen warnings minimized

### Documentation Metrics
- [ ] Installation guide for each platform
- [ ] Platform-specific troubleshooting docs
- [ ] Developer build instructions complete
- [ ] Code signing guide published

## Risk Assessment

### High Risk
1. **Windows SmartScreen Reputation**
   - Mitigation: Use EV certificate, submit to Microsoft
   - Timeline: 3-6 months to build reputation

2. **Linux Distribution Variability**
   - Mitigation: Focus on major distros, provide AppImage fallback
   - Test on multiple environments

### Medium Risk
1. **Code Signing Certificate Costs**
   - Mitigation: Budget $500-600/year for certificates
   - ROI: Professional appearance, user trust

2. **Platform-Specific VM Backend Differences**
   - Mitigation: Abstract VM interface, test thoroughly
   - Fallback: Disable VM on unsupported platforms

### Low Risk
1. **Build Pipeline Complexity**
   - Mitigation: Incremental rollout, thorough testing
   - GitHub Actions supports all platforms

## Budget Estimate

### One-Time Costs
- Windows EV Code Signing Certificate: $350
- Testing hardware (if needed): $0-500
- **Total One-Time:** $350-850

### Annual Recurring Costs
- Apple Developer Program: $99/year
- Windows Code Signing Renewal: $300-400/year
- Infrastructure (CI minutes): $0 (GitHub Free tier sufficient)
- **Total Annual:** $400-500/year

### Development Time Cost
- 14 weeks @ 40 hours/week = 560 hours
- If contracted: ~$50-150/hour = $28k-84k
- If in-house: Opportunity cost of other features

## Post-Release Support (v1.6.1+)

### v1.6.1 (March 2026) - Patch Release
- Bug fixes discovered post-launch
- Performance improvements
- Platform-specific issue resolution

### v1.6.2 (April 2026) - Stability Release
- Enhanced cross-platform compatibility
- Additional Linux distribution support
- Windows SmartScreen reputation building

### v1.7.0 (Q2 2026) - App Store Release
- Mac App Store submission
- Microsoft Store submission
- Snap Store and Flatpak packages
- Sandboxing and entitlements work

## Conclusion

VibeCode v1.6.0 represents a major milestone in the project's evolution, transforming from a platform-specific tool to a truly cross-platform development environment. With comprehensive platform support, professional code signing, and robust CI/CD infrastructure, v1.6.0 will position VibeCode for wider adoption and enterprise use.

**Key Takeaways:**
- 3 new platforms supported (Intel Mac, Linux, Windows)
- Professional code signing on all platforms
- Maintained backward compatibility
- 14-week development timeline
- ~$400-600/year ongoing costs
- Foundation for future app store distribution

**Next Steps:**
1. Review and approve roadmap
2. Acquire code signing certificates
3. Begin Phase 1: Universal macOS binary
4. Set up cross-platform CI/CD pipeline
5. Plan v1.7.0 app store features
