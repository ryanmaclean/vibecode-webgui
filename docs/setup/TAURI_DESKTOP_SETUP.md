# Tauri Desktop Setup Guide

> **📌 Canonical Guide**: This is the official and canonical guide for Tauri desktop development setup. For all desktop development with Tauri, always refer to this guide as the authoritative source.

This guide provides detailed platform-specific instructions for setting up a Tauri desktop development environment, including Rust installation, npm configuration, and comprehensive build troubleshooting.

## Prerequisites

### System Requirements

**Minimum Requirements**:
- RAM: 8GB (16GB recommended)
- Disk: 5GB free space for dependencies and build artifacts
- Internet connection for downloading dependencies

**Supported Platforms**:
- **macOS**: 10.13 (High Sierra) or later (Intel and Apple Silicon)
- **Windows**: Windows 10 or later (64-bit)
- **Linux**: Ubuntu 20.04+, Fedora 35+, or equivalent

## Rust Installation

Rust is a core requirement for Tauri development. The following sections provide platform-specific installation instructions.

### macOS

#### Step 1: Install Xcode Command Line Tools

Xcode Command Line Tools are required for compiling Rust code on macOS.

```bash
# Install Command Line Tools
xcode-select --install
```

A dialog will appear - click "Install" and accept the license agreement.

**Verify installation**:
```bash
xcode-select -p
```

Expected output:
```
/Library/Developer/CommandLineTools
```

#### Step 2: Install Rust via rustup

```bash
# Download and run rustup installer
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

During installation:
1. Select option `1) Proceed with installation (default)`
2. Wait for installation to complete
3. Source the environment:

```bash
source $HOME/.cargo/env
```

**Verify installation**:
```bash
rustc --version
cargo --version
```

Expected output:
```
rustc 1.75.0 (or higher)
cargo 1.75.0 (or higher)
```

#### Apple Silicon Considerations

For M1/M2/M3 Macs, ensure you're using the correct toolchain:

```bash
# Check architecture
uname -m  # Should show: arm64

# Rust automatically installs the correct target
rustup show
```

Expected output should include:
```
Default host: aarch64-apple-darwin
```

### Windows

#### Step 1: Install Microsoft C++ Build Tools

Rust on Windows requires the Microsoft C++ build tools.

**Option 1: Visual Studio Build Tools (Recommended)**

1. Download [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. Run the installer
3. Select "Desktop development with C++"
4. Ensure these components are checked:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows 10/11 SDK
   - C++ CMake tools for Windows
5. Install (requires ~7GB disk space)

**Option 2: Visual Studio Community**

If you prefer a full IDE:
1. Download [Visual Studio Community](https://visualstudio.microsoft.com/vs/community/)
2. During installation, select "Desktop development with C++"

#### Step 2: Install Rust via rustup

```powershell
# Download rustup-init.exe and run it
# Visit: https://rustup.rs/

# Or use PowerShell to download and run:
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "rustup-init.exe"
.\rustup-init.exe
```

During installation:
1. Select option `1) Proceed with installation (default)`
2. Restart your terminal after installation

**Verify installation**:
```powershell
rustc --version
cargo --version
```

#### Step 3: Install WebView2 Runtime

WebView2 is usually pre-installed on Windows 10/11, but verify:

```powershell
# Check if WebView2 is installed
Get-AppxPackage -Name "Microsoft.WebView2"
```

If not installed, download from [Microsoft WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### Linux

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install required dependencies
sudo apt install -y \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libwebkit2gtk-4.1-dev

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Source environment
source $HOME/.cargo/env
```

#### Fedora/RHEL

```bash
# Install dependencies
sudo dnf install -y \
    gcc \
    gcc-c++ \
    make \
    openssl-devel \
    gtk3-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel \
    webkit2gtk4.1-devel

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Source environment
source $HOME/.cargo/env
```

#### Arch Linux

```bash
# Install dependencies
sudo pacman -S --needed \
    base-devel \
    curl \
    wget \
    openssl \
    gtk3 \
    libappindicator-gtk3 \
    librsvg \
    webkit2gtk-4.1

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Source environment
source $HOME/.cargo/env
```

**Verify installation (all distributions)**:
```bash
rustc --version
cargo --version
pkg-config --modversion gtk+-3.0
pkg-config --modversion webkit2gtk-4.1
```

## npm Setup

### Installing Node.js and npm

Tauri requires Node.js v18.18.0 or higher.

#### Using Node Version Manager (nvm) - Recommended

**macOS/Linux**:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Restart terminal or source profile
source ~/.bashrc  # or ~/.zshrc

# Install latest LTS Node.js
nvm install --lts

# Set as default
nvm use --lts
nvm alias default node
```

**Windows**:

Download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases).

```powershell
# Install latest LTS
nvm install lts
nvm use lts
```

#### Using Official Installer

Alternatively, download from [nodejs.org](https://nodejs.org/):
- Choose the LTS (Long Term Support) version
- Run the installer
- Verify installation

**Verify installation (all platforms)**:
```bash
node --version   # Should be v18.18.0 or higher
npm --version    # Should be v9.0.0 or higher
```

### npm Configuration

#### Set npm Registry (if using private packages)

```bash
# Set registry
npm config set registry https://registry.npmjs.org/

# For private registries
npm config set registry https://your-private-registry.com/
```

#### Configure npm Cache

```bash
# Set cache location (optional)
npm config set cache ~/.npm-cache

# Verify cache
npm config get cache
```

#### Global Package Permissions (macOS/Linux)

To avoid permission errors with global packages:

```bash
# Create directory for global packages
mkdir ~/.npm-global

# Configure npm to use new directory
npm config set prefix '~/.npm-global'

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Install Tauri CLI

Choose one of the following methods:

**Option 1: Cargo (Recommended)**

```bash
cargo install tauri-cli

# Verify installation
cargo tauri --version
```

**Option 2: npm**

```bash
npm install -g @tauri-apps/cli

# Verify installation
npx tauri --version
```

**Expected output**:
```
tauri-cli 2.x.x
```

## Project Setup

### Clone and Initialize Project

```bash
# Clone repository
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Install dependencies
npm install

# Verify project structure
ls -la src-tauri/
```

### Initial Build Test

Test that everything is set up correctly:

```bash
# Build Next.js frontend
npm run build:export

# Build Tauri app (development mode)
cd src-tauri
cargo tauri dev
```

If the application window opens, your setup is complete!

## Build Troubleshooting

### Common Build Issues

#### Issue: `cargo: 'tauri' is not a cargo command`

**Cause**: Tauri CLI not installed or not in PATH

**Solution**:
```bash
# Reinstall Tauri CLI
cargo install tauri-cli --force

# Verify cargo bin directory is in PATH
echo $PATH | grep -q ".cargo/bin" && echo "✓ Cargo bin in PATH" || echo "✗ Add ~/.cargo/bin to PATH"

# Add to PATH if missing (macOS/Linux)
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Windows**:
```powershell
# Verify PATH
$env:Path -split ';' | Select-String -Pattern 'cargo\\bin'

# Add to PATH if missing (PowerShell as Admin)
[Environment]::SetEnvironmentVariable("Path", "$env:Path;$env:USERPROFILE\.cargo\bin", "User")
```

#### Issue: `error: linker 'cc' not found` (macOS)

**Cause**: Xcode Command Line Tools missing or outdated

**Solution**:
```bash
# Remove old tools
sudo rm -rf /Library/Developer/CommandLineTools

# Reinstall
xcode-select --install

# Verify
xcode-select -p
cc --version
```

#### Issue: `error: linking with 'link.exe' failed` (Windows)

**Cause**: Missing Microsoft C++ Build Tools

**Solution**:
1. Verify Visual Studio Build Tools installation
2. Ensure "Desktop development with C++" workload is installed
3. Restart terminal after installation
4. Try build again

```powershell
# Check if MSVC is in PATH
where link.exe
```

#### Issue: `Package gtk+-3.0 was not found` (Linux)

**Cause**: Missing system dependencies

**Solution (Ubuntu/Debian)**:
```bash
sudo apt install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libssl-dev

# Verify installation
pkg-config --modversion gtk+-3.0
```

#### Issue: `error: failed to run custom build command for openssl-sys`

**Cause**: Missing OpenSSL development libraries

**Solution (macOS)**:
```bash
# Install OpenSSL via Homebrew
brew install openssl@3

# Set environment variables
echo 'export OPENSSL_DIR="/opt/homebrew/opt/openssl@3"' >> ~/.zshrc
source ~/.zshrc
```

**Solution (Linux)**:
```bash
# Ubuntu/Debian
sudo apt install -y libssl-dev pkg-config

# Fedora
sudo dnf install -y openssl-devel
```

**Solution (Windows)**:
- OpenSSL should be included with Rust installation
- If errors persist, download from [OpenSSL for Windows](https://slproweb.com/products/Win32OpenSSL.html)

#### Issue: `npm ERR! code EACCES` (Permission Denied)

**Cause**: npm trying to install packages globally without permissions

**Solution (macOS/Linux)**:
```bash
# Fix npm permissions (recommended approach)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Try installation again
npm install -g @tauri-apps/cli
```

**Not recommended**: Using `sudo npm install` (can cause permission issues)

#### Issue: `error: could not compile due to previous error`

**Cause**: Compilation errors in Rust code

**Solution**:
```bash
# Clean build artifacts
cd src-tauri
cargo clean

# Update Rust toolchain
rustup update

# Try build again with verbose output
cargo build --verbose

# Check for specific error messages and address them
```

#### Issue: Frontend not bundling correctly

**Cause**: Next.js build errors or configuration issues

**Solution**:
```bash
# Clean Next.js cache and build artifacts
rm -rf .next out node_modules/.cache

# Reinstall dependencies
npm install

# Build with verbose output
npm run build:export -- --debug

# Verify output directory
ls -la out/

# Check tauri.conf.json frontendDist path
cat src-tauri/tauri.conf.json | grep frontendDist
```

### Build Performance Issues

#### Slow Compilation Times

**Rust compilation can be slow. Optimize with**:

```bash
# Install sccache (shared compilation cache)
cargo install sccache

# Configure Rust to use sccache
echo '[build]' >> ~/.cargo/config.toml
echo 'rustc-wrapper = "sccache"' >> ~/.cargo/config.toml

# Verify sccache is working
sccache --show-stats
```

**Increase parallel compilation** (use with caution - high memory usage):

```bash
# Edit or create ~/.cargo/config.toml
[build]
jobs = 4  # Adjust based on CPU cores
```

#### Out of Disk Space

**Clean build artifacts**:

```bash
# Clean Rust artifacts (can free several GB)
cd src-tauri
cargo clean

# Clean Next.js artifacts
cd ..
rm -rf .next out

# Clean npm cache
npm cache clean --force

# Clean Cargo cache (use sparingly)
cargo cache --autoclean
```

### Platform-Specific Build Issues

#### macOS: Code Signing Errors

```bash
# For development builds, disable code signing verification
export MACOSX_DEPLOYMENT_TARGET=10.13

# Build in development mode (no signing required)
cargo tauri dev
```

For release builds, see [Code Signing Guide](../tauri/CODE_SIGNING.md).

#### Windows: Antivirus Blocking Builds

Some antivirus software blocks Rust compilation:

1. Add exclusions for:
   - `C:\Users\<YourUser>\.cargo\`
   - `<ProjectDir>\src-tauri\target\`
2. Temporarily disable real-time protection during builds
3. Use Windows Security exclusions rather than disabling

#### Linux: Missing WebView2GTK

```bash
# Ubuntu 22.04+
sudo apt install -y webkit2gtk-4.1-dev

# Ubuntu 20.04 (older version)
sudo apt install -y webkit2gtk-4.0-dev
```

### Debugging Build Process

#### Enable Verbose Output

```bash
# Cargo verbose output
cargo build --verbose

# Tauri verbose output
cargo tauri build -v

# Environment variable for detailed logs
export RUST_BACKTRACE=1
cargo tauri build
```

#### Check Dependency Versions

```bash
# List installed Cargo packages
cargo install --list

# Check Rust version
rustc --version
rustup show

# Check Node.js versions
node --version
npm --version

# Check Tauri CLI version
cargo tauri --version
```

## Verification Checklist

After completing setup, verify everything is working:

- [ ] Rust and Cargo installed and in PATH
- [ ] `rustc --version` returns v1.70 or higher
- [ ] Node.js installed and in PATH
- [ ] `node --version` returns v18.18.0 or higher
- [ ] npm configured correctly
- [ ] Tauri CLI installed
- [ ] `cargo tauri --version` works
- [ ] System dependencies installed (platform-specific)
- [ ] Project dependencies installed (`npm install` completes)
- [ ] Development build succeeds (`cargo tauri dev`)
- [ ] Production build succeeds (`cargo tauri build`)

## Next Steps

Once your environment is set up:

1. **Start Development**: See [Getting Started Guide](../tauri/GETTING_STARTED.md)
2. **Build Configuration**: Review [Build Configuration](../tauri/BUILD_CONFIGURATION.md)
3. **Development Workflow**: Read [Development Guide](../DEVELOPMENT.md)
4. **Troubleshooting**: Consult [Troubleshooting Guide](../TROUBLESHOOTING.md)

## Additional Resources

### Official Documentation

- [Rust Installation Guide](https://www.rust-lang.org/tools/install)
- [Tauri Prerequisites](https://tauri.app/v2/guides/prerequisites/)
- [Node.js Downloads](https://nodejs.org/)
- [npm Documentation](https://docs.npmjs.com/)

### Platform-Specific Resources

- **macOS**: [Xcode Command Line Tools](https://developer.apple.com/xcode/)
- **Windows**: [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
- **Linux**: [WebKitGTK](https://webkitgtk.org/)

### Community Resources

- [Tauri Discord](https://discord.com/invite/tauri)
- [GitHub Discussions](https://github.com/tauri-apps/tauri/discussions)
- [Stack Overflow - Tauri Tag](https://stackoverflow.com/questions/tagged/tauri)

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting Guide](../TROUBLESHOOTING.md)
2. Search [existing GitHub issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
3. Ask in [Tauri Discord](https://discord.com/invite/tauri)
4. Open a new issue with:
   - Operating system and version
   - Rust version (`rustc --version`)
   - Node.js version (`node --version`)
   - Tauri CLI version (`cargo tauri --version`)
   - Full error output
   - Steps to reproduce

---

**Last Updated**: 2025-02-21
**Tauri Version**: 2.x
**Status**: Active Development
