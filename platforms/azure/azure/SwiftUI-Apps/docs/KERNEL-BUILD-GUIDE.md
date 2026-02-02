# ARM64 Linux Kernel Build Guide for macOS

## Overview

This guide documents the process for building a minimal ARM64 Linux kernel with VIRTIO networking support on macOS. This kernel serves as a fallback option for network connectivity in virtualized environments.

**Target Configuration:**
- Architecture: ARM64 (aarch64)
- Primary Focus: VIRTIO networking (CONFIG_VIRTIO_NET=y)
- Build Environment: macOS 15.7.2 (arm64)
- Kernel Version: Latest LTS (6.6.x or 6.1.x recommended)

---

## Prerequisites

### System Requirements

- **macOS Version:** 10.15 (Catalina) or later
- **Architecture:** arm64 (Apple Silicon) or x86_64 (Intel)
- **Disk Space:** Minimum 20GB free (30GB recommended)
  - Kernel source: ~1.5GB
  - Build artifacts: ~5-10GB
  - Cross-compiler tools: ~500MB-1GB
- **RAM:** 8GB minimum (16GB recommended for parallel builds)
- **Time Estimate:** 30-60 minutes for full build (depending on CPU cores)

### Required Tools

#### 1. Homebrew Package Manager

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Verify installation
brew --version
```

#### 2. Xcode Command Line Tools

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p
# Should output: /Library/Developer/CommandLineTools
```

#### 3. ARM64 Cross-Compiler Toolchain

The primary tool needed is `aarch64-elf-gcc` which provides the GNU compiler collection for ARM64 bare-metal/Linux targets.

```bash
# Install ARM64 cross-compiler
brew install aarch64-elf-gcc

# Verify installation
aarch64-elf-gcc --version

# Additional optional tools
brew install aarch64-elf-binutils  # Usually installed as dependency
```

**Alternative: aarch64-linux-gnu toolchain**

For Linux-specific builds, you may also want:

```bash
# This requires adding a tap for Linux-specific toolchains
brew tap messense/macos-cross-toolchains
brew install aarch64-unknown-linux-gnu

# Or use Docker-based approach (see Alternative Methods section)
```

#### 4. Essential Build Tools

```bash
# Install essential build dependencies
brew install \
  make \
  bison \
  flex \
  bc \
  coreutils \
  ncurses \
  openssl@3 \
  wget \
  gnu-sed

# Create symlinks for GNU tools (required for kernel build)
export PATH="/opt/homebrew/opt/gnu-sed/libexec/gnubin:$PATH"
export PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH"
```

#### 5. Kernel Configuration Tools

```bash
# Install menuconfig dependencies
brew install ncurses

# Optional: Install Qt for xconfig GUI (if preferred)
brew install qt@5
```

---

## Kernel Source Preparation

### Download Kernel Source

```bash
# Create workspace directory
mkdir -p ~/kernel-build/arm64
cd ~/kernel-build/arm64

# Download latest LTS kernel (6.6.x recommended as of 2025)
KERNEL_VERSION="6.6.60"
wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.xz

# Verify checksum (optional but recommended)
wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.sign
# gpg --verify linux-${KERNEL_VERSION}.tar.sign

# Extract source
tar xf linux-${KERNEL_VERSION}.tar.xz
cd linux-${KERNEL_VERSION}
```

**Alternative: Clone from git (for latest stable)**

```bash
# Clone stable kernel tree (larger download ~2-3GB)
git clone --depth 1 --branch v6.6 \
  https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git \
  linux-6.6-stable
cd linux-6.6-stable
```

---

## Minimal Kernel Configuration

### Base Configuration Strategy

We'll start with a minimal ARM64 defconfig and add only essential VIRTIO support.

```bash
# Set up environment variables
export ARCH=arm64
export CROSS_COMPILE=aarch64-elf-
export KERNEL_SRC=$(pwd)

# Generate base ARM64 defconfig
make defconfig

# This creates a .config file with minimal ARM64 defaults
```

### Essential Configuration Options

The following configuration must be enabled for VIRTIO networking:

#### Core VIRTIO Support

```
CONFIG_VIRTIO=y                    # Core VIRTIO bus driver
CONFIG_VIRTIO_PCI=y                # VIRTIO PCI driver
CONFIG_VIRTIO_MMIO=y               # VIRTIO MMIO driver (for some VMs)
CONFIG_VIRTIO_NET=y                # VIRTIO network driver
```

#### Required Networking Stack

```
CONFIG_NET=y                       # Networking support
CONFIG_INET=y                      # TCP/IP networking
CONFIG_PACKET=y                    # Packet socket
CONFIG_UNIX=y                      # Unix domain sockets
CONFIG_NETDEVICES=y                # Network device support
```

#### Essential Kernel Features

```
CONFIG_64BIT=y                     # 64-bit kernel
CONFIG_ARM64=y                     # ARM64 architecture
CONFIG_MMU=y                       # Memory Management Unit
CONFIG_PCI=y                       # PCI bus support
CONFIG_PCI_HOST_GENERIC=y          # Generic PCI host controller
CONFIG_BINFMT_ELF=y                # ELF binary support
CONFIG_DEVTMPFS=y                  # Device manager daemon
CONFIG_DEVTMPFS_MOUNT=y            # Auto-mount devtmpfs
CONFIG_PROC_FS=y                   # /proc filesystem
CONFIG_SYSFS=y                     # /sys filesystem
CONFIG_TMPFS=y                     # Temporary filesystem
CONFIG_BLK_DEV_INITRD=y            # Initial RAM disk support
```

#### Optional but Recommended

```
CONFIG_VIRTIO_BLK=y                # VIRTIO block device
CONFIG_VIRTIO_CONSOLE=y            # VIRTIO console
CONFIG_HW_RANDOM_VIRTIO=y          # VIRTIO RNG
CONFIG_EXT4_FS=y                   # EXT4 filesystem
CONFIG_SQUASHFS=y                  # SquashFS (common for initrd)
CONFIG_OVERLAY_FS=y                # Overlay filesystem
```

### Applying Configuration

#### Method 1: Manual Configuration via menuconfig

```bash
# Interactive configuration (recommended for first-time setup)
make menuconfig

# Navigate to enable required options:
# [*] Virtualization
#     └─ [*] Kernel support for paravirtualization
# Device Drivers --->
#     [*] Virtio drivers --->
#         <*> Platform bus driver for memory mapped virtio devices
#         <*> PCI driver for virtio devices
#     [*] Network device support --->
#         <*> Virtio network driver
# Networking support --->
#     [*] Networking options
#         [*] TCP/IP networking
```

#### Method 2: Configuration Fragment File

Create a configuration fragment for VIRTIO support:

```bash
# Create virtio.config fragment
cat > virtio.config << 'EOF'
# VIRTIO Core Support
CONFIG_VIRTIO=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_MMIO=y
CONFIG_VIRTIO_MMIO_CMDLINE_DEVICES=y

# VIRTIO Drivers
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_BLK=y
CONFIG_VIRTIO_CONSOLE=y
CONFIG_HW_RANDOM_VIRTIO=y

# Networking Stack
CONFIG_NET=y
CONFIG_INET=y
CONFIG_PACKET=y
CONFIG_UNIX=y
CONFIG_NETDEVICES=y
CONFIG_NET_CORE=y

# PCI Support (required for VIRTIO-PCI)
CONFIG_PCI=y
CONFIG_PCI_HOST_GENERIC=y

# Essential Features
CONFIG_64BIT=y
CONFIG_ARM64=y
CONFIG_MMU=y
CONFIG_BINFMT_ELF=y
CONFIG_DEVTMPFS=y
CONFIG_DEVTMPFS_MOUNT=y
CONFIG_PROC_FS=y
CONFIG_SYSFS=y
CONFIG_TMPFS=y
CONFIG_BLK_DEV_INITRD=y

# Filesystem Support
CONFIG_EXT4_FS=y
CONFIG_EXT4_FS_POSIX_ACL=y
CONFIG_EXT4_FS_SECURITY=y
EOF

# Merge fragment with base config
scripts/kconfig/merge_config.sh .config virtio.config

# Alternatively, append to existing .config
cat virtio.config >> .config
make olddefconfig  # Resolve dependencies
```

#### Method 3: Complete Minimal Config Template

Save this as `minimal-arm64-virtio.config`:

```
#
# Minimal ARM64 Kernel Configuration with VIRTIO Support
# Target: Virtualized ARM64 environments
# Focus: Minimal size with networking capability
#

# Architecture
CONFIG_ARM64=y
CONFIG_64BIT=y
CONFIG_MMU=y
CONFIG_ARM64_PAGE_SHIFT=12
CONFIG_ARM64_VA_BITS=39

# Core Kernel Features
CONFIG_LOCALVERSION="-virtio-minimal"
CONFIG_DEFAULT_HOSTNAME="arm64-vm"
CONFIG_SWAP=n
CONFIG_SYSVIPC=y
CONFIG_POSIX_MQUEUE=y
CONFIG_CROSS_MEMORY_ATTACH=y
CONFIG_IKCONFIG=y
CONFIG_IKCONFIG_PROC=y
CONFIG_LOG_BUF_SHIFT=17

# Kernel Hacking (disable for production)
CONFIG_DEBUG_KERNEL=n
CONFIG_DEBUG_INFO=n

# CPU/Platform Support
CONFIG_NR_CPUS=8
CONFIG_SCHED_MC=y
CONFIG_SCHED_SMT=y

# Binary Formats
CONFIG_BINFMT_ELF=y
CONFIG_BINFMT_SCRIPT=y

# PCI Bus Support (required for VIRTIO-PCI)
CONFIG_PCI=y
CONFIG_PCI_HOST_GENERIC=y
CONFIG_PCI_DOMAINS=y

# VIRTIO Support
CONFIG_VIRTIO=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_PCI_LEGACY=y
CONFIG_VIRTIO_MMIO=y
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_BLK=y
CONFIG_VIRTIO_CONSOLE=y
CONFIG_HW_RANDOM_VIRTIO=y
CONFIG_VIRTIO_BALLOON=y

# Networking
CONFIG_NET=y
CONFIG_INET=y
CONFIG_IP_PNP=y
CONFIG_IP_PNP_DHCP=y
CONFIG_PACKET=y
CONFIG_UNIX=y
CONFIG_NETDEVICES=y
CONFIG_NET_CORE=y

# Block Devices
CONFIG_BLK_DEV=y
CONFIG_BLK_DEV_LOOP=y
CONFIG_BLK_DEV_INITRD=y

# Device Drivers
CONFIG_DEVTMPFS=y
CONFIG_DEVTMPFS_MOUNT=y

# TTY and Serial
CONFIG_TTY=y
CONFIG_SERIAL_8250=y
CONFIG_SERIAL_8250_CONSOLE=y
CONFIG_SERIAL_AMBA_PL011=y
CONFIG_SERIAL_AMBA_PL011_CONSOLE=y

# Filesystems
CONFIG_EXT4_FS=y
CONFIG_EXT4_FS_POSIX_ACL=y
CONFIG_EXT4_FS_SECURITY=y
CONFIG_PROC_FS=y
CONFIG_PROC_SYSCTL=y
CONFIG_SYSFS=y
CONFIG_TMPFS=y
CONFIG_TMPFS_POSIX_ACL=y
CONFIG_DEVPTS_FS=y
CONFIG_SQUASHFS=y
CONFIG_OVERLAY_FS=y

# Disable Unnecessary Features
CONFIG_MODULES=n
CONFIG_SUSPEND=n
CONFIG_HIBERNATION=n
CONFIG_WIRELESS=n
CONFIG_WLAN=n
CONFIG_BT=n
CONFIG_SOUND=n
CONFIG_USB=n
CONFIG_STAGING=n
```

Apply the template:

```bash
# Copy template to .config
cp minimal-arm64-virtio.config .config

# Resolve dependencies and set defaults
make ARCH=arm64 CROSS_COMPILE=aarch64-elf- olddefconfig
```

---

## Build Process

### Step-by-Step Build Instructions

#### 1. Set Environment Variables

```bash
# Essential environment variables
export ARCH=arm64
export CROSS_COMPILE=aarch64-elf-
export KERNEL_SRC=$(pwd)

# Optional: Optimization flags
export KCFLAGS="-O2 -march=armv8-a"

# Optional: Number of parallel jobs (use CPU cores + 1)
export JOBS=$(sysctl -n hw.ncpu)
```

#### 2. Clean Build (if needed)

```bash
# Clean previous build artifacts
make mrproper

# Or for incremental builds
make clean
```

#### 3. Prepare Configuration

```bash
# Load your configuration
make defconfig
# OR
cp minimal-arm64-virtio.config .config
make olddefconfig

# Verify critical options
scripts/config --state CONFIG_VIRTIO_NET
scripts/config --state CONFIG_VIRTIO_PCI
scripts/config --state CONFIG_ARM64
```

#### 4. Build Kernel Image

```bash
# Build kernel (parallel build recommended)
time make -j${JOBS} Image

# Expected output location:
# arch/arm64/boot/Image (uncompressed)
```

#### 5. Build Compressed Image (optional)

```bash
# Build gzip compressed image
time make -j${JOBS} Image.gz

# Output: arch/arm64/boot/Image.gz
```

#### 6. Build Device Tree Blobs (if needed)

```bash
# Build device tree blobs for specific platforms
make -j${JOBS} dtbs

# Output: arch/arm64/boot/dts/**/*.dtb
```

#### 7. Verify Build Output

```bash
# Check kernel image
ls -lh arch/arm64/boot/Image*

# Expected size: 15-30MB (uncompressed), 5-10MB (compressed)

# Verify it's ARM64
file arch/arm64/boot/Image
# Should output: "Linux kernel ARM64 boot executable Image"

# Check for VIRTIO symbols in kernel
scripts/extract-vmlinux arch/arm64/boot/Image | \
  strings | grep -i virtio | head -20
```

---

## Build Time and Resource Estimates

### Performance Metrics

Based on typical macOS systems:

| System Configuration | Clean Build Time | Incremental Build | Disk Usage |
|---------------------|------------------|-------------------|------------|
| Apple M1 (8 cores) | 15-25 minutes | 2-5 minutes | ~8GB |
| Apple M2 (10 cores) | 12-20 minutes | 2-4 minutes | ~8GB |
| Apple M3 (12 cores) | 10-18 minutes | 2-3 minutes | ~8GB |
| Intel i7 (8 cores) | 30-45 minutes | 5-10 minutes | ~10GB |

### Output Sizes

| Component | Size (Minimal Config) | Size (Full Config) |
|-----------|----------------------|-------------------|
| Uncompressed Image | 15-25 MB | 30-50 MB |
| Compressed Image.gz | 5-10 MB | 10-20 MB |
| Source Tree | 1.5 GB | 1.5 GB |
| Build Artifacts | 3-5 GB | 8-12 GB |
| **Total Disk Usage** | **5-7 GB** | **10-15 GB** |

### Memory Usage

- Peak RAM during build: 4-8GB
- Recommended RAM: 8GB minimum, 16GB for comfortable parallel builds
- Swap usage: Minimal on systems with adequate RAM

---

## Troubleshooting

### Common Build Errors

#### Error: "aarch64-elf-gcc: command not found"

**Solution:**
```bash
# Install cross-compiler
brew install aarch64-elf-gcc

# Verify CROSS_COMPILE variable
echo $CROSS_COMPILE  # Should be: aarch64-elf-

# Check if compiler is in PATH
which aarch64-elf-gcc
```

#### Error: "GNU Make 4.x required"

**Solution:**
```bash
# Install GNU make via Homebrew
brew install make

# Use gmake instead of make
alias make='gmake'

# Or add to PATH
export PATH="/opt/homebrew/opt/make/libexec/gnubin:$PATH"
```

#### Error: "flex/bison not found"

**Solution:**
```bash
brew install flex bison

# Add to PATH (bison)
export PATH="/opt/homebrew/opt/bison/bin:$PATH"
```

#### Error: "openssl/opensslv.h: No such file or directory"

**Solution:**
```bash
brew install openssl@3

# Set OpenSSL paths
export LDFLAGS="-L/opt/homebrew/opt/openssl@3/lib"
export CPPFLAGS="-I/opt/homebrew/opt/openssl@3/include"
export PKG_CONFIG_PATH="/opt/homebrew/opt/openssl@3/lib/pkgconfig"
```

#### Error: "sed: illegal option"

macOS uses BSD sed, but kernel build needs GNU sed.

**Solution:**
```bash
brew install gnu-sed

# Add GNU sed to PATH (overrides BSD sed)
export PATH="/opt/homebrew/opt/gnu-sed/libexec/gnubin:$PATH"
```

### Verification Steps

#### 1. Verify Cross-Compiler

```bash
# Test cross-compiler
cat > test.c << 'EOF'
#include <stdio.h>
int main() { printf("ARM64 test\n"); return 0; }
EOF

aarch64-elf-gcc -static test.c -o test.elf
file test.elf
# Should show: ELF 64-bit LSB executable, ARM aarch64

rm test.c test.elf
```

#### 2. Verify Kernel Configuration

```bash
# Check enabled options
grep CONFIG_VIRTIO .config
grep CONFIG_ARM64 .config

# Verify no module support (if building monolithic)
grep CONFIG_MODULES .config
# Should show: # CONFIG_MODULES is not set  (for minimal build)
```

#### 3. Test Kernel Image

```bash
# Extract kernel version
strings arch/arm64/boot/Image | grep "Linux version" | head -1

# Check size
ls -lh arch/arm64/boot/Image

# Verify ARM64 format
file arch/arm64/boot/Image
```

---

## Alternative Build Methods

### Option 1: Docker-Based Build

For a more Linux-like environment:

```bash
# Use official kernel build container
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  --platform linux/arm64 \
  ubuntu:22.04 bash

# Inside container:
apt-get update
apt-get install -y build-essential bc bison flex libssl-dev \
  libelf-dev libncurses-dev wget
wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.6.60.tar.xz
tar xf linux-6.6.60.tar.xz
cd linux-6.6.60
make defconfig
# ... continue with build steps
```

### Option 2: Lima VM (Linux on Mac)

```bash
# Install Lima
brew install lima

# Start Ubuntu ARM64 VM
limactl start --arch aarch64 default

# Enter VM
lima

# Build kernel inside VM (native ARM64)
# No cross-compiler needed!
```

---

## Testing the Kernel

### Using QEMU

```bash
# Install QEMU
brew install qemu

# Test kernel with minimal rootfs
qemu-system-aarch64 \
  -machine virt \
  -cpu cortex-a57 \
  -smp 2 \
  -m 1024 \
  -kernel arch/arm64/boot/Image \
  -append "console=ttyAMA0 root=/dev/vda" \
  -nographic \
  -netdev user,id=net0 \
  -device virtio-net-pci,netdev=net0

# To exit QEMU: Ctrl-A then X
```

### Verify VIRTIO Network Driver

Inside the booted kernel:

```bash
# Check if virtio_net module is loaded
cat /proc/modules | grep virtio

# Check network interfaces
ip link show

# Should see virtio network device (e.g., eth0, enp0s1)
dmesg | grep -i virtio
# Should show: "virtio_net virtio0 eth0: registered"
```

---

## Deployment

### Extracting the Kernel

```bash
# Copy kernel image to deployment location
cp arch/arm64/boot/Image ~/kernel-output/vmlinuz-arm64-virtio-$(date +%Y%m%d)

# Compress for distribution
gzip -k arch/arm64/boot/Image
# Creates: arch/arm64/boot/Image.gz

# Create tarball with kernel and config
tar czf kernel-arm64-virtio-$(date +%Y%m%d).tar.gz \
  arch/arm64/boot/Image* \
  .config \
  arch/arm64/boot/dts/
```

### Integration with Existing System

To use this kernel as a fallback:

1. **Place in boot directory:**
   ```bash
   # On target ARM64 Linux system
   sudo cp Image /boot/vmlinuz-arm64-virtio-fallback
   ```

2. **Update bootloader (GRUB):**
   ```bash
   # Add entry to /etc/grub.d/40_custom
   menuentry 'Linux ARM64 VIRTIO Fallback' {
     linux /boot/vmlinuz-arm64-virtio-fallback root=/dev/vda console=ttyAMA0
   }

   # Update GRUB
   sudo update-grub
   ```

3. **Test in VM:**
   ```bash
   # Use new kernel in QEMU/KVM
   qemu-system-aarch64 ... -kernel /boot/vmlinuz-arm64-virtio-fallback
   ```

---

## Optimization Tips

### Size Optimization

To further reduce kernel size:

```bash
# Disable debugging symbols
scripts/config --disable CONFIG_DEBUG_INFO
scripts/config --disable CONFIG_DEBUG_KERNEL

# Disable unneeded features
scripts/config --disable CONFIG_MODULES
scripts/config --disable CONFIG_SUSPEND
scripts/config --disable CONFIG_HIBERNATION
scripts/config --disable CONFIG_WIRELESS
scripts/config --disable CONFIG_USB

# Use aggressive optimization
export KCFLAGS="-Os -march=armv8-a"
make -j${JOBS} Image
```

### Build Speed Optimization

```bash
# Use ccache
brew install ccache
export PATH="/opt/homebrew/opt/ccache/libexec:$PATH"

# Enable parallel build
export JOBS=$(sysctl -n hw.ncpu)
make -j${JOBS}

# Use ld.gold (faster linker)
scripts/config --enable CONFIG_LD_GOLD
```

---

## Maintenance and Updates

### Keeping Kernel Up-to-Date

```bash
# Check for latest stable version
curl -s https://www.kernel.org/ | grep -A1 "stable:"

# Download and verify
KERNEL_VERSION="6.6.61"  # Update as needed
wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.xz
wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.sign

# Reuse existing config
cd linux-${KERNEL_VERSION}
cp ~/kernel-build/arm64/linux-6.6.60/.config .
make olddefconfig
make -j$(sysctl -n hw.ncpu) Image
```

### Configuration Management

```bash
# Save current config
cp .config ~/kernel-configs/arm64-virtio-$(date +%Y%m%d).config

# Compare configs
scripts/diffconfig .config ~/kernel-configs/arm64-virtio-old.config

# Track changes in git
git init
git add .config
git commit -m "Initial ARM64 VIRTIO config"
```

---

## References

### Official Documentation

- [Linux Kernel Documentation](https://www.kernel.org/doc/html/latest/)
- [ARM64 Architecture](https://www.kernel.org/doc/html/latest/arch/arm64/index.html)
- [VIRTIO Specification](https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.html)
- [Kernel Build System](https://www.kernel.org/doc/html/latest/kbuild/index.html)

### Useful Resources

- [Cross-compilation Guide](https://www.kernel.org/doc/html/latest/kbuild/llvm.html)
- [Minimal Kernel Configurations](https://www.etalabs.net/sh_utils.html)
- [QEMU ARM64 Documentation](https://www.qemu.org/docs/master/system/target-arm.html)

### Community Support

- Linux Kernel Mailing List: https://lkml.org/
- ARM64 Linux: https://www.armlinux.org.uk/
- Homebrew Issues: https://github.com/Homebrew/homebrew-core/issues

---

## Quick Reference Card

### Essential Commands

```bash
# Environment setup
export ARCH=arm64
export CROSS_COMPILE=aarch64-elf-
export JOBS=$(sysctl -n hw.ncpu)

# Configuration
make defconfig
make menuconfig
make olddefconfig

# Build
make -j${JOBS} Image
make -j${JOBS} Image.gz
make -j${JOBS} dtbs

# Clean
make clean      # Clean build artifacts
make mrproper   # Clean everything including config

# Verification
file arch/arm64/boot/Image
ls -lh arch/arm64/boot/
scripts/config --state CONFIG_VIRTIO_NET
```

### Key Paths

- Kernel source: `~/kernel-build/arm64/linux-6.6.60/`
- Output image: `arch/arm64/boot/Image`
- Configuration: `.config`
- Device trees: `arch/arm64/boot/dts/`

### Critical Config Options

```
CONFIG_ARM64=y
CONFIG_VIRTIO=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_NET=y
CONFIG_NET=y
CONFIG_INET=y
CONFIG_PCI=y
```

---

## Appendix A: Complete Build Script

Save as `build-arm64-kernel.sh`:

```bash
#!/bin/bash
#
# ARM64 Linux Kernel Build Script for macOS
# Builds minimal kernel with VIRTIO networking support
#

set -euo pipefail

# Configuration
KERNEL_VERSION="${KERNEL_VERSION:-6.6.60}"
BUILD_DIR="${HOME}/kernel-build/arm64"
JOBS=$(sysctl -n hw.ncpu)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing=()

    command -v aarch64-elf-gcc >/dev/null 2>&1 || missing+=("aarch64-elf-gcc")
    command -v make >/dev/null 2>&1 || missing+=("make")
    command -v flex >/dev/null 2>&1 || missing+=("flex")
    command -v bison >/dev/null 2>&1 || missing+=("bison")
    command -v bc >/dev/null 2>&1 || missing+=("bc")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing prerequisites: ${missing[*]}"
        log_info "Install with: brew install aarch64-elf-gcc make flex bison bc"
        exit 1
    fi

    log_info "All prerequisites satisfied"
}

# Download kernel source
download_kernel() {
    log_info "Downloading kernel ${KERNEL_VERSION}..."

    mkdir -p "${BUILD_DIR}"
    cd "${BUILD_DIR}"

    local tarball="linux-${KERNEL_VERSION}.tar.xz"
    local url="https://cdn.kernel.org/pub/linux/kernel/v6.x/${tarball}"

    if [ ! -f "${tarball}" ]; then
        wget "${url}" || {
            log_error "Failed to download kernel"
            exit 1
        }
    else
        log_info "Kernel tarball already exists, skipping download"
    fi

    if [ ! -d "linux-${KERNEL_VERSION}" ]; then
        log_info "Extracting kernel source..."
        tar xf "${tarball}"
    else
        log_info "Kernel source already extracted"
    fi
}

# Configure kernel
configure_kernel() {
    log_info "Configuring kernel..."

    cd "${BUILD_DIR}/linux-${KERNEL_VERSION}"

    export ARCH=arm64
    export CROSS_COMPILE=aarch64-elf-

    # Start with defconfig
    make defconfig

    # Enable VIRTIO support
    scripts/config --enable CONFIG_VIRTIO
    scripts/config --enable CONFIG_VIRTIO_PCI
    scripts/config --enable CONFIG_VIRTIO_MMIO
    scripts/config --enable CONFIG_VIRTIO_NET
    scripts/config --enable CONFIG_VIRTIO_BLK
    scripts/config --enable CONFIG_VIRTIO_CONSOLE

    # Ensure networking is enabled
    scripts/config --enable CONFIG_NET
    scripts/config --enable CONFIG_INET
    scripts/config --enable CONFIG_PACKET
    scripts/config --enable CONFIG_UNIX
    scripts/config --enable CONFIG_NETDEVICES

    # Disable unnecessary features for minimal size
    scripts/config --disable CONFIG_MODULES
    scripts/config --disable CONFIG_DEBUG_INFO
    scripts/config --disable CONFIG_DEBUG_KERNEL

    # Resolve dependencies
    make olddefconfig

    log_info "Kernel configuration complete"
}

# Build kernel
build_kernel() {
    log_info "Building kernel (this may take 15-30 minutes)..."

    cd "${BUILD_DIR}/linux-${KERNEL_VERSION}"

    export ARCH=arm64
    export CROSS_COMPILE=aarch64-elf-

    # Clean previous build
    make clean

    # Build kernel image
    time make -j"${JOBS}" Image || {
        log_error "Kernel build failed"
        exit 1
    }

    log_info "Kernel build complete"
}

# Verify build
verify_build() {
    log_info "Verifying build output..."

    cd "${BUILD_DIR}/linux-${KERNEL_VERSION}"

    local image="arch/arm64/boot/Image"

    if [ ! -f "${image}" ]; then
        log_error "Kernel image not found at ${image}"
        exit 1
    fi

    local size=$(du -h "${image}" | cut -f1)
    log_info "Kernel image size: ${size}"

    local filetype=$(file "${image}")
    log_info "File type: ${filetype}"

    if ! echo "${filetype}" | grep -q "ARM aarch64"; then
        log_error "Kernel image is not ARM64 format"
        exit 1
    fi

    log_info "Build verification successful"
}

# Main execution
main() {
    log_info "Starting ARM64 kernel build process..."
    log_info "Kernel version: ${KERNEL_VERSION}"
    log_info "Build directory: ${BUILD_DIR}"
    log_info "Parallel jobs: ${JOBS}"

    check_prerequisites
    download_kernel
    configure_kernel
    build_kernel
    verify_build

    log_info "============================================"
    log_info "Build complete!"
    log_info "Kernel image: ${BUILD_DIR}/linux-${KERNEL_VERSION}/arch/arm64/boot/Image"
    log_info "Configuration: ${BUILD_DIR}/linux-${KERNEL_VERSION}/.config"
    log_info "============================================"
}

# Run main function
main "$@"
```

Make executable and run:

```bash
chmod +x build-arm64-kernel.sh
./build-arm64-kernel.sh
```

---

## Appendix B: Minimal Config Template File

Save as `minimal-arm64-virtio.config` (see complete template in "Minimal Kernel Configuration" section above).

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-26 | Initial documentation for ARM64 kernel build on macOS |

---

**Status:** Ready for implementation
**Next Steps:** Install prerequisites and verify toolchain before attempting build
**Estimated Build Time:** 15-30 minutes on Apple Silicon
**Estimated Disk Usage:** 5-7 GB for minimal build
