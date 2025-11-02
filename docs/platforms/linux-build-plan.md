# Linux Build Support Plan

**Status:** Planning phase
**Priority:** High
**Timeline:** 4 weeks
**Complexity:** Medium

## Overview

Add comprehensive Linux support for VibeCode, targeting major distributions with native package formats (.deb, .rpm) and a universal AppImage for maximum compatibility.

## Target Distributions

### Primary Targets (Tier 1)
1. **Ubuntu 22.04 LTS** - Most popular desktop Linux
2. **Ubuntu 24.04 LTS** - Latest LTS release
3. **Debian 12 (Bookworm)** - Stable base for many distros
4. **Fedora 39/40** - Cutting-edge GNOME desktop
5. **Arch Linux** - Rolling release, developer-focused

### Secondary Targets (Tier 2)
6. **Linux Mint 21** - Ubuntu-based, user-friendly
7. **Pop!_OS 22.04** - System76's developer-focused distro
8. **openSUSE Tumbleweed** - Rolling release alternative
9. **Manjaro** - Arch-based, user-friendly

### Universal Fallback
10. **AppImage** - Works on all distributions (glibc 2.31+)

## System Requirements

### Minimum Requirements
- **Kernel:** Linux 5.10+ (for modern VM features)
- **glibc:** 2.31+ (Ubuntu 20.04+, Debian 11+)
- **GTK:** 3.24+
- **WebKit:** WebKit2GTK 4.1+
- **Display Server:** X11 or Wayland
- **CPU:** x86_64 (64-bit)
- **RAM:** 4 GB minimum, 8 GB recommended
- **Disk:** 500 MB for application + space for VMs

### Desktop Environments Tested
- GNOME 40+ (Primary)
- KDE Plasma 5.24+ (Primary)
- XFCE 4.16+
- Cinnamon 5.2+
- MATE 1.26+

## Dependencies

### Build Dependencies

#### Debian/Ubuntu
```bash
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libwebkit2gtk-4.1-dev \
  patchelf
```

#### Fedora/RHEL
```bash
sudo dnf install -y \
  gcc \
  gcc-c++ \
  make \
  cmake \
  openssl-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  webkit2gtk4.1-devel \
  patchelf
```

#### Arch Linux
```bash
sudo pacman -S --needed \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  gtk3 \
  libappindicator-gtk3 \
  librsvg \
  webkit2gtk-4.1
```

### Runtime Dependencies

#### .deb Package Dependencies
```json
{
  "bundle": {
    "linux": {
      "deb": {
        "depends": [
          "libwebkit2gtk-4.1-0 (>= 2.38)",
          "libgtk-3-0 (>= 3.24)",
          "libayatana-appindicator3-1",
          "librsvg2-2",
          "libssl3 | libssl1.1"
        ],
        "section": "devel",
        "priority": "optional"
      }
    }
  }
}
```

#### .rpm Package Dependencies
```spec
Requires: webkit2gtk4.1
Requires: gtk3
Requires: libappindicator-gtk3
Requires: librsvg2
Requires: openssl-libs
```

## Platform-Specific Features

### Docker/Container Management

#### Option 1: Docker Engine (Default)
```bash
# Check for Docker
if command -v docker &> /dev/null; then
    echo "Docker detected"
    CONTAINER_RUNTIME="docker"
fi
```

#### Option 2: Podman (Rootless alternative)
```bash
# Check for Podman
if command -v podman &> /dev/null; then
    echo "Podman detected"
    CONTAINER_RUNTIME="podman"
fi
```

**Implementation Strategy:**
- Auto-detect available runtime (Docker > Podman)
- Allow manual selection in settings
- Use compatible API subset (works with both)
- Test with both runtimes in CI

### VM Management

#### Option 1: QEMU/KVM (Primary)
```bash
# Check for KVM support
if [ -r /dev/kvm ]; then
    echo "KVM available"
    VM_BACKEND="kvm"
fi
```

**VibeCode VM Integration:**
- Use libvirt for VM management
- QEMU with KVM acceleration
- virt-manager for advanced users
- Custom VM provisioning for VibeCode environments

#### Option 2: VirtualBox (Alternative)
```bash
# Check for VirtualBox
if command -v vboxmanage &> /dev/null; then
    echo "VirtualBox available"
    VM_BACKEND="virtualbox"
fi
```

### System Tray Integration

Linux system trays vary by desktop environment:

#### Implementation
```rust
use tauri::tray::{TrayIcon, TrayIconBuilder};

// Create tray icon with fallbacks
let tray = TrayIconBuilder::new()
    .icon(include_bytes!("../icons/icon.png"))
    .tooltip("VibeCode")
    .build(app)?;
```

**Desktop-Specific Considerations:**
- **GNOME:** Requires AppIndicator extension
- **KDE Plasma:** Native tray support
- **XFCE:** Native tray support
- **Cinnamon:** Native tray support

**Solution:** Use libayatana-appindicator3 for cross-DE compatibility

### File Paths and Permissions

#### Configuration Directory
```bash
# XDG Base Directory specification
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/vibecode"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/vibecode"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/vibecode"
```

#### Application Installation
- **.deb:** `/opt/vibecode/` (application files)
- **.rpm:** `/opt/vibecode/` (application files)
- **AppImage:** User-selectable location
- **Desktop file:** `/usr/share/applications/vibecode.desktop`
- **Icons:** `/usr/share/icons/hicolor/*/apps/vibecode.png`

## Package Formats

### .deb (Debian/Ubuntu)

#### Tauri Configuration
```json
{
  "bundle": {
    "targets": ["deb"],
    "linux": {
      "deb": {
        "depends": [
          "libwebkit2gtk-4.1-0",
          "libgtk-3-0",
          "libayatana-appindicator3-1",
          "librsvg2-2"
        ],
        "section": "devel",
        "priority": "optional",
        "files": {
          "/usr/share/applications/vibecode.desktop": "assets/vibecode.desktop",
          "/usr/share/icons/hicolor/256x256/apps/vibecode.png": "icons/icon.png"
        }
      }
    }
  }
}
```

#### Build Command
```bash
npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles deb
```

#### Installation
```bash
# Install .deb
sudo dpkg -i vibecode_1.6.0_amd64.deb

# Fix dependencies if needed
sudo apt-get install -f
```

#### Desktop Entry
**File:** `assets/vibecode.desktop`
```ini
[Desktop Entry]
Type=Application
Name=VibeCode
GenericName=AI-Powered Development Environment
Comment=VibeCode provides an AI-powered development environment
Exec=/opt/vibecode/vibecode
Icon=vibecode
Terminal=false
Categories=Development;IDE;
Keywords=code;development;ide;ai;docker;
StartupWMClass=VibeCode
```

### .rpm (Fedora/RHEL)

#### Tauri Configuration
```json
{
  "bundle": {
    "targets": ["rpm"],
    "linux": {
      "rpm": {
        "depends": [
          "webkit2gtk4.1",
          "gtk3",
          "libappindicator-gtk3"
        ],
        "release": "1",
        "epoch": 0,
        "license": "MIT",
        "files": {
          "/usr/share/applications/vibecode.desktop": "assets/vibecode.desktop",
          "/usr/share/icons/hicolor/256x256/apps/vibecode.png": "icons/icon.png"
        }
      }
    }
  }
}
```

#### Build Command
```bash
npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles rpm
```

#### Installation
```bash
# Fedora
sudo dnf install vibecode-1.6.0-1.x86_64.rpm

# RHEL/CentOS
sudo yum install vibecode-1.6.0-1.x86_64.rpm
```

### AppImage (Universal)

#### Tauri Configuration
```json
{
  "bundle": {
    "targets": ["appimage"],
    "linux": {
      "appimage": {
        "bundleMediaFramework": false,
        "files": {}
      }
    }
  }
}
```

#### Build Command
```bash
npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles appimage
```

#### Usage
```bash
# Make executable
chmod +x VibeCode-1.6.0.AppImage

# Run
./VibeCode-1.6.0.AppImage

# Optional: Integrate with desktop
./VibeCode-1.6.0.AppImage --appimage-extract
# Then move to ~/.local/share/applications/
```

#### AppImage Benefits
- No installation required
- Works on any distribution (glibc 2.31+)
- Self-contained with all dependencies
- Easy updates (replace file)
- No root privileges needed

### Flatpak (Future - v1.7.0)

**Benefits:**
- Sandboxed security
- Flathub distribution
- Automatic updates
- Desktop integration

**Challenges:**
- Docker access in sandbox
- VM management restrictions
- Filesystem permissions

**Decision:** Defer to v1.7.0 after evaluating sandbox limitations.

## Build Process

### Development Build
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add Linux target
rustup target add x86_64-unknown-linux-gnu

# Install system dependencies
sudo apt install libwebkit2gtk-4.1-dev  # Ubuntu/Debian
# OR
sudo dnf install webkit2gtk4.1-devel    # Fedora

# Install npm dependencies
npm ci

# Build for Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

### Production Build (CI/CD)
```yaml
build-linux:
  runs-on: ubuntu-22.04

  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Install dependencies
      run: |
        sudo apt update
        sudo apt install -y \
          libwebkit2gtk-4.1-dev \
          build-essential \
          libssl-dev \
          libgtk-3-dev \
          libayatana-appindicator3-dev \
          librsvg2-dev

    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: x86_64-unknown-linux-gnu

    - name: Install npm dependencies
      run: npm ci

    - name: Build packages
      run: |
        npm run tauri build -- \
          --target x86_64-unknown-linux-gnu \
          --bundles deb,rpm,appimage

    - name: Sign packages
      run: |
        # GPG sign .deb
        dpkg-sig --sign builder \
          src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/vibecode_*.deb

        # GPG sign .rpm
        rpm --addsign \
          src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/rpm/vibecode-*.rpm

    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      with:
        name: linux-packages
        path: |
          src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/*.deb
          src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/rpm/*.rpm
          src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/*.AppImage
```

## Testing Strategy

### Test Matrix

| Distribution | Version | DE | Docker | VM | Status |
|--------------|---------|-------|--------|-----|--------|
| Ubuntu | 22.04 LTS | GNOME | ✅ | KVM | Testing |
| Ubuntu | 24.04 LTS | GNOME | ✅ | KVM | Testing |
| Debian | 12 | GNOME | ✅ | KVM | Testing |
| Fedora | 39 | GNOME | ✅ | KVM | Testing |
| Fedora | 40 | GNOME | ✅ | KVM | Testing |
| Arch | Latest | KDE | ✅ | KVM | Testing |
| Linux Mint | 21 | Cinnamon | ✅ | KVM | Testing |
| Pop!_OS | 22.04 | GNOME | ✅ | KVM | Testing |

### Manual Testing Checklist

#### Installation
- [ ] .deb installs on Ubuntu
- [ ] .deb installs on Debian
- [ ] .rpm installs on Fedora
- [ ] AppImage runs on all distros
- [ ] Desktop entry created
- [ ] Icons display correctly
- [ ] Application appears in launcher

#### Functionality
- [ ] Application launches
- [ ] System tray icon works (all DEs)
- [ ] Docker containers managed correctly
- [ ] Podman works as alternative
- [ ] VM provisioning works (KVM)
- [ ] File permissions correct
- [ ] XDG directories used correctly
- [ ] Settings persist across restarts

#### Performance
- [ ] Startup time <2s
- [ ] Memory usage <200 MB idle
- [ ] CPU usage low when idle
- [ ] GPU acceleration works (if available)

#### Integration
- [ ] Dark mode follows system theme
- [ ] Notifications work
- [ ] File manager integration
- [ ] Protocol handlers work
- [ ] Wayland compatibility
- [ ] X11 compatibility

### Automated Testing
```bash
# Test .deb installation
docker run -it ubuntu:22.04 bash -c "
  apt update && \
  apt install -y ./vibecode_1.6.0_amd64.deb && \
  vibecode --version
"

# Test .rpm installation
docker run -it fedora:39 bash -c "
  dnf install -y ./vibecode-1.6.0-1.x86_64.rpm && \
  vibecode --version
"

# Test AppImage
docker run -it ubuntu:22.04 bash -c "
  chmod +x VibeCode-1.6.0.AppImage && \
  ./VibeCode-1.6.0.AppImage --version
"
```

## Platform-Specific Code

### Update src-tauri/src/commands.rs
```rust
#[cfg(target_os = "linux")]
fn get_docker_socket_path() -> &'static str {
    // Check for Docker socket
    if std::path::Path::new("/var/run/docker.sock").exists() {
        return "unix:///var/run/docker.sock";
    }

    // Check for Podman socket
    let podman_socket = format!(
        "unix://{}/podman/podman.sock",
        std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| "/run/user/1000".to_string())
    );

    if std::path::Path::new(&podman_socket.replace("unix://", "")).exists() {
        return &podman_socket;
    }

    // Default to Docker
    "unix:///var/run/docker.sock"
}

#[cfg(target_os = "linux")]
fn get_config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let xdg_config = std::env::var("XDG_CONFIG_HOME")
        .unwrap_or_else(|_| format!("{}/.config", home));

    PathBuf::from(xdg_config).join("vibecode")
}

#[cfg(target_os = "linux")]
fn get_vm_backend() -> String {
    // Check for KVM support
    if std::path::Path::new("/dev/kvm").exists() {
        return "kvm".to_string();
    }

    // Check for VirtualBox
    if Command::new("vboxmanage").arg("--version").output().is_ok() {
        return "virtualbox".to_string();
    }

    // No VM backend available
    "none".to_string()
}
```

### Update Cargo.toml Dependencies
```toml
[target.'cfg(target_os = "linux")'.dependencies]
# Linux-specific dependencies
gtk = "0.18"
webkit2gtk = "2.0"
```

## Distribution

### GitHub Releases
Upload all package formats to GitHub Releases:
- `vibecode_1.6.0_amd64.deb` (Debian/Ubuntu)
- `vibecode-1.6.0-1.x86_64.rpm` (Fedora/RHEL)
- `VibeCode-1.6.0.AppImage` (Universal)
- `vibecode_1.6.0_amd64.deb.asc` (GPG signature)
- `vibecode-1.6.0-1.x86_64.rpm.asc` (GPG signature)

### Installation Instructions
```bash
# Debian/Ubuntu
wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.6.0/vibecode_1.6.0_amd64.deb
sudo dpkg -i vibecode_1.6.0_amd64.deb
sudo apt-get install -f  # Fix dependencies

# Fedora/RHEL
wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.6.0/vibecode-1.6.0-1.x86_64.rpm
sudo dnf install vibecode-1.6.0-1.x86_64.rpm

# AppImage (any distro)
wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.6.0/VibeCode-1.6.0.AppImage
chmod +x VibeCode-1.6.0.AppImage
./VibeCode-1.6.0.AppImage
```

### Package Repository (Future)
Consider hosting a package repository for easy updates:

#### APT Repository (Debian/Ubuntu)
```bash
# Add repository
echo "deb [signed-by=/usr/share/keyrings/vibecode-archive-keyring.gpg] https://packages.vibecode.app/apt stable main" | sudo tee /etc/apt/sources.list.d/vibecode.list

# Add GPG key
wget -qO- https://packages.vibecode.app/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/vibecode-archive-keyring.gpg

# Install
sudo apt update
sudo apt install vibecode
```

#### DNF/YUM Repository (Fedora/RHEL)
```bash
# Add repository
sudo tee /etc/yum.repos.d/vibecode.repo <<EOF
[vibecode]
name=VibeCode Repository
baseurl=https://packages.vibecode.app/rpm
enabled=1
gpgcheck=1
gpgkey=https://packages.vibecode.app/gpg.key
EOF

# Install
sudo dnf install vibecode
```

**Cost:** ~$10-20/month for package hosting (S3 + CloudFront)

## Known Limitations

### VM Management
- Requires KVM kernel module or VirtualBox
- KVM requires nested virtualization on VMs
- May need user to add themselves to `kvm` or `libvirt` group

### Docker/Podman
- Requires Docker daemon or Podman to be running
- Rootless Podman may have limitations
- Socket permissions may vary

### System Tray
- GNOME requires AppIndicator extension
- Some minimal window managers may not support tray icons

### File Permissions
- Application needs write access to config directories
- VM images need write access
- May need user to configure permissions

## Troubleshooting Guide

### Issue: "libwebkit2gtk-4.1.so not found"
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-0

# Fedora
sudo dnf install webkit2gtk4.1
```

### Issue: System tray icon not showing (GNOME)
```bash
# Install AppIndicator extension
gnome-extensions install appindicatorsupport@rgcjonas.gmail.com
gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com
```

### Issue: Docker permission denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker  # Or log out and back in
```

### Issue: KVM permission denied
```bash
# Add user to kvm group
sudo usermod -aG kvm $USER
newgrp kvm  # Or log out and back in
```

### Issue: AppImage won't run
```bash
# Check FUSE installation
sudo apt install fuse libfuse2  # Ubuntu/Debian
sudo dnf install fuse fuse-libs  # Fedora

# Enable FUSE
sudo modprobe fuse
```

## Success Criteria

- [ ] .deb package builds successfully
- [ ] .rpm package builds successfully
- [ ] AppImage builds successfully
- [ ] All packages install on target distros
- [ ] Application launches on all target distros
- [ ] Docker/Podman management works
- [ ] VM provisioning works on KVM
- [ ] System tray icon shows on all DEs
- [ ] XDG directories used correctly
- [ ] GPG signing implemented
- [ ] CI/CD pipeline produces all packages
- [ ] Documentation complete
- [ ] Performance meets targets

## Timeline

### Week 1: Setup and Configuration
- Install build dependencies
- Configure Tauri for Linux
- Set up development environment
- Test basic build

### Week 2: Platform Integration
- Implement Docker/Podman detection
- Implement VM backend detection
- Add system tray support
- Test on Ubuntu and Fedora

### Week 3: Packaging and Testing
- Create .deb packages
- Create .rpm packages
- Create AppImage
- Test on all target distributions

### Week 4: Polish and Release
- GPG package signing
- CI/CD integration
- Documentation
- Beta testing

## Conclusion

Linux support expands VibeCode's reach to the developer community. With comprehensive package formats and thorough testing, Linux users will have a first-class experience on par with macOS.

**Key Deliverables:**
- .deb packages for Debian/Ubuntu
- .rpm packages for Fedora/RHEL
- AppImage for universal compatibility
- Full Docker and Podman support
- KVM-based VM management
- Cross-DE system tray support
