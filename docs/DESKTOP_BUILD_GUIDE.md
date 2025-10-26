# VibeCode Desktop Build Guide

Complete guide for building VibeCode Desktop on all supported platforms.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Platform-Specific Builds](#platform-specific-builds)
  - [macOS](#macos)
  - [Linux](#linux)
  - [Windows](#windows)
- [Cross-Compilation](#cross-compilation)
- [Troubleshooting](#troubleshooting)
- [Release Process](#release-process)

## System Requirements

### All Platforms

- **Node.js:** 18.18.0 or higher (< 25.0.0)
- **npm:** 9.0.0 or higher
- **Rust:** Latest stable (installed via rustup)
- **Tauri CLI:** Installed via npm (included in dependencies)

### Platform-Specific Requirements

#### macOS
- **OS:** macOS 10.13 or later
- **Xcode Command Line Tools:** Required
  ```bash
  xcode-select --install
  ```
- **Additional Tools:**
  ```bash
  brew install pkg-config openssl@3
  ```

#### Linux (Ubuntu/Debian)
- **OS:** Ubuntu 20.04+ or Debian 11+
- **Build Dependencies:**
  ```bash
  sudo apt-get update
  sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    libssl-dev \
    pkg-config \
    build-essential \
    curl \
    wget \
    file
  ```

#### Linux (Fedora/RHEL)
- **OS:** Fedora 35+ or RHEL 8+
- **Build Dependencies:**
  ```bash
  sudo dnf install -y \
    webkit2gtk4.1-devel \
    openssl-devel \
    curl \
    wget \
    file \
    patchelf \
    librsvg2-devel \
    gcc \
    gcc-c++
  ```

#### Windows
- **OS:** Windows 10 (build 1809+) or Windows 11
- **Build Tools:**
  - Visual Studio 2019 or later with C++ build tools
  - Windows SDK
- **Additional Tools:**
  ```powershell
  # Install WiX Toolset for MSI creation
  dotnet tool install --global wix --version 5.0.0
  ```

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd vibecode-webgui
npm install --legacy-peer-deps
```

### 2. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable
```

### 3. Build for Your Platform

```bash
# Development build (faster, not optimized)
npm run tauri:build:debug

# Production build (optimized)
npm run tauri:build
```

Build artifacts will be in `src-tauri/target/release/bundle/`

## Platform-Specific Builds

### macOS

#### Universal Binary (Intel + Apple Silicon)

**Recommended for distribution:**

```bash
# Install both targets
rustup target add x86_64-apple-darwin aarch64-apple-darwin

# Build universal binary
npm run tauri build -- --target universal-apple-darwin
```

**Output:**
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/VibeCode_*.dmg`
- `src-tauri/target/universal-apple-darwin/release/bundle/macos/VibeCode.app`

#### Architecture-Specific Builds

**Intel (x86_64):**
```bash
npm run tauri build -- --target x86_64-apple-darwin
```

**Apple Silicon (ARM64):**
```bash
npm run tauri build -- --target aarch64-apple-darwin
```

#### Code Signing and Notarization

For distribution outside the App Store, you need to sign and notarize:

1. **Setup certificates:**
   ```bash
   # Import your Developer ID certificate
   # Use Xcode or Keychain Access
   ```

2. **Configure in `tauri.conf.json`:**
   ```json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name (TEAMID)"
       }
     }
   }
   ```

3. **Notarize after build:**
   ```bash
   # Submit for notarization
   xcrun notarytool submit \
     src-tauri/target/universal-apple-darwin/release/bundle/dmg/VibeCode_*.dmg \
     --apple-id "your@email.com" \
     --password "app-specific-password" \
     --team-id "TEAMID" \
     --wait

   # Staple the notarization
   xcrun stapler staple \
     src-tauri/target/universal-apple-darwin/release/bundle/dmg/VibeCode_*.dmg
   ```

### Linux

#### x86_64 Build (Native)

```bash
# Install target (usually already installed)
rustup target add x86_64-unknown-linux-gnu

# Build for x86_64
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

**Output:**
- `.deb` package: `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/`
- `.AppImage`: `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/`
- `.rpm` package: `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/rpm/`

#### ARM64 Build (Cross-compilation)

**On x86_64 host:**

```bash
# Install ARM64 toolchain
sudo dpkg --add-architecture arm64
sudo apt-get update
sudo apt-get install -y \
  gcc-aarch64-linux-gnu \
  g++-aarch64-linux-gnu \
  libc6-dev-arm64-cross

# Install Rust target
rustup target add aarch64-unknown-linux-gnu

# Configure cargo
mkdir -p ~/.cargo
cat >> ~/.cargo/config.toml << EOF
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
EOF

# Build
npm run tauri build -- --target aarch64-unknown-linux-gnu
```

**On ARM64 host (native):**

```bash
rustup target add aarch64-unknown-linux-gnu
npm run tauri build -- --target aarch64-unknown-linux-gnu
```

#### Package Installation

**Debian/Ubuntu (.deb):**
```bash
sudo dpkg -i VibeCode_*_amd64.deb
# Or for ARM64:
sudo dpkg -i VibeCode_*_arm64.deb
```

**Fedora/RHEL (.rpm):**
```bash
sudo rpm -i VibeCode-*.x86_64.rpm
```

**AppImage (any distro):**
```bash
chmod +x VibeCode_*_amd64.AppImage
./VibeCode_*_amd64.AppImage
```

### Windows

#### x86_64 Build

```bash
# Install target (usually already installed)
rustup target add x86_64-pc-windows-msvc

# Build
npm run tauri build -- --target x86_64-pc-windows-msvc
```

**Output:**
- MSI Installer: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/`
- NSIS Installer: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`

#### Code Signing

For Windows code signing, you need a code signing certificate:

1. **Import certificate:**
   ```powershell
   # Import PFX certificate
   $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
   $cert.Import("path\to\certificate.pfx", "password", "Exportable,PersistKeySet")
   ```

2. **Sign installer:**
   ```powershell
   # Sign MSI
   signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 VibeCode_*.msi

   # Sign NSIS
   signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 VibeCode_*-setup.exe
   ```

## Cross-Compilation

### Building for Multiple Platforms

You can build for multiple targets sequentially:

```bash
# Build for all macOS architectures
for target in x86_64-apple-darwin aarch64-apple-darwin; do
  npm run tauri build -- --target $target
done

# Build for all Linux architectures
for target in x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu; do
  npm run tauri build -- --target $target
done
```

### Using Docker for Cross-Platform Builds

**Linux builds from any platform:**

```bash
# Use official Tauri Docker image
docker run --rm -v $(pwd):/app -w /app \
  ghcr.io/tauri-apps/tauri-builder:latest \
  npm run tauri build
```

## Troubleshooting

### Common Issues

#### macOS: "Cannot find openssl"

**Solution:**
```bash
export PKG_CONFIG_PATH="/opt/homebrew/opt/openssl@3/lib/pkgconfig"
npm run tauri build
```

#### Linux: "webkit2gtk not found"

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel
```

#### Windows: "MSVC not found"

**Solution:**
- Install Visual Studio 2019+ with "Desktop development with C++" workload
- Or install "Build Tools for Visual Studio"

#### ARM64 Cross-compilation Fails

**Solution:**
```bash
# Ensure cross-compilation tools are installed
rustup target add aarch64-unknown-linux-gnu
sudo apt-get install gcc-aarch64-linux-gnu

# Verify cargo config
cat ~/.cargo/config.toml
```

### Build Size Optimization

The default release build is optimized for size in `src-tauri/Cargo.toml`:

```toml
[profile.release]
strip = true
lto = "thin"
opt-level = "z"
codegen-units = 1
panic = "abort"
```

**Further optimizations:**

1. **Reduce binary size:**
   - Remove unused dependencies
   - Use `cargo-bloat` to analyze binary size
   - Consider `upx` compression (use with caution)

2. **Improve build time:**
   - Use `sccache` for Rust compilation caching
   - Increase `codegen-units` for faster debug builds

### Debugging Build Issues

```bash
# Verbose build output
RUST_BACKTRACE=full npm run tauri build -- --verbose

# Check Tauri info
npm run tauri info

# Verify dependencies
npm run tauri deps
```

## Release Process

### 1. Version Bump

Update version in:
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `package.json`

```bash
# Example: bump to v1.0.0
vim src-tauri/tauri.conf.json  # Update version
vim src-tauri/Cargo.toml       # Update version
vim package.json               # Update version
```

### 2. Create Git Tag

```bash
git add .
git commit -m "chore: bump version to 1.0.0"
git tag desktop-v1.0.0
git push origin main --tags
```

### 3. Automated Build

The GitHub Actions workflow (`.github/workflows/desktop-build.yml`) will automatically:
- Build for all platforms
- Sign applications (if secrets are configured)
- Create GitHub release
- Upload artifacts

### 4. Manual Build and Release

If you prefer manual builds:

```bash
# Build for your platform
npm run tauri build

# Create checksums
cd src-tauri/target/release/bundle
for file in dmg/*.dmg deb/*.deb appimage/*.AppImage rpm/*.rpm msi/*.msi nsis/*.exe; do
  [ -f "$file" ] && shasum -a 256 "$file" > "$file.sha256"
done

# Create GitHub release manually
gh release create desktop-v1.0.0 \
  --title "VibeCode Desktop v1.0.0" \
  --notes "Release notes here" \
  dmg/*.dmg \
  deb/*.deb \
  appimage/*.AppImage \
  rpm/*.rpm \
  msi/*.msi \
  nsis/*.exe \
  **/*.sha256
```

## CI/CD Configuration

### GitHub Secrets Required

For automated releases, configure these secrets in your repository:

**macOS:**
- `APPLE_CERTIFICATE_BASE64`: Base64-encoded Developer ID certificate
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_ID`: Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Apple Developer Team ID
- `APPLE_SIGNING_IDENTITY`: Full signing identity name
- `KEYCHAIN_PASSWORD`: Temporary keychain password

**Windows:**
- `WINDOWS_CERTIFICATE_BASE64`: Base64-encoded code signing certificate
- `WINDOWS_CERTIFICATE_PASSWORD`: Certificate password

**Tauri Updates:**
- `TAURI_PRIVATE_KEY`: Private key for Tauri updater
- `TAURI_KEY_PASSWORD`: Password for private key

### Converting Certificates to Base64

**macOS:**
```bash
base64 -i certificate.p12 | pbcopy
# Paste into GitHub secret
```

**Windows:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Clipboard
# Paste into GitHub secret
```

## Platform Differences

### File Locations

**macOS:**
- App: `/Applications/VibeCode.app`
- Config: `~/Library/Application Support/com.vibecode.app/`
- Logs: `~/Library/Logs/VibeCode/`

**Linux:**
- App: `/usr/bin/vibecode` or `~/.local/share/applications/`
- Config: `~/.config/vibecode/`
- Logs: `~/.local/share/vibecode/logs/`

**Windows:**
- App: `C:\Program Files\VibeCode\` or `%LOCALAPPDATA%\Programs\VibeCode\`
- Config: `%APPDATA%\com.vibecode.app\`
- Logs: `%APPDATA%\VibeCode\logs\`

### Platform-Specific Features

**macOS:**
- Native menu bar integration
- Touch Bar support (if applicable)
- System tray icon
- Notification Center integration

**Linux:**
- System tray icon (distro-dependent)
- Desktop file integration
- DBus integration

**Windows:**
- System tray icon
- Jump list integration
- Windows notifications
- Auto-updater support

## Additional Resources

- **Tauri Documentation:** https://tauri.app/v2/
- **Rust Book:** https://doc.rust-lang.org/book/
- **Cross-compilation Guide:** https://rust-lang.github.io/rustup/cross-compilation.html
- **Code Signing Guide (macOS):** https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- **Code Signing Guide (Windows):** https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools

## Support

For build issues:
1. Check this guide's troubleshooting section
2. Review [GitHub Discussions](https://github.com/your-repo/discussions)
3. Create an [issue](https://github.com/your-repo/issues) with:
   - OS and version
   - Rust version (`rustc --version`)
   - Node version (`node --version`)
   - Full build log
   - `npm run tauri info` output
