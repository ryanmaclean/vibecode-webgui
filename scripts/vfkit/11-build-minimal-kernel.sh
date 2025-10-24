#!/usr/bin/env bash
# Build custom minimal Linux kernel for M1/Apple Silicon + vfkit
# Linux From Scratch style - strip everything unnecessary
# Target: 8-12MB kernel (vs 33MB stock)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${HOME}/.vfkit/kernel-build"
KERNEL_VERSION="6.12.7"  # Latest in 6.12 LTS series
KERNEL_MAJOR="6.12"
OUTPUT_DIR="${HOME}/.vfkit/vms/vibecode-alpine/kernel"

echo "════════════════════════════════════════════════════════"
echo "  Building Minimal Kernel for M1/vfkit"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Target: Linux ${KERNEL_VERSION}"
echo "Arch: ARM64 (aarch64)"
echo "Optimized for: Apple Silicon M1/M2/M3 + vfkit"
echo "Goal: ~8-12MB (vs 33MB stock Alpine virt kernel)"
echo ""
echo "What we're removing:"
echo "  ❌ KVM support (guest, not host)"
echo "  ❌ USB drivers"
echo "  ❌ GPU/DRM drivers"
echo "  ❌ Physical ARM platforms (RPi, Tegra, etc.)"
echo "  ❌ Storage controllers (SATA, NVMe, SCSI)"
echo "  ❌ Network cards (WiFi, BT, Ethernet)"
echo "  ❌ GPIO, I2C, SPI, PWM"
echo "  ❌ MMC/SD cards"
echo ""
echo "What we're keeping:"
echo "  ✅ virtio drivers (blk, net, console, rng, vsock, fs)"
echo "  ✅ ARM64 core"
echo "  ✅ Basic filesystems (ext4, tmpfs, proc, sysfs)"
echo "  ✅ Minimal networking"
echo ""

# Check for cross-compilation tools
if ! command -v aarch64-linux-gnu-gcc &> /dev/null; then
    echo "❌ ARM64 cross-compiler not found"
    echo ""
    echo "Install it:"
    echo "  brew install aarch64-elf-gcc  # or"
    echo "  brew install messense/macos-cross-toolchains/aarch64-unknown-linux-gnu"
    echo ""
    echo "Or use Docker to build:"
    echo "  docker run --rm -v \$PWD:/build alpine:edge sh -c 'apk add build-base linux-headers && cd /build && make'"
    echo ""
    read -p "Continue anyway and build natively? (may fail) (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    CROSS_COMPILE=""
else
    CROSS_COMPILE="aarch64-linux-gnu-"
    echo "✅ Found ARM64 cross-compiler: $(which aarch64-linux-gnu-gcc)"
fi

echo ""
echo "Build directory: ${BUILD_DIR}"
echo ""

# Create build directory
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

# Download kernel source
echo "📥 Downloading Linux kernel ${KERNEL_VERSION}..."
KERNEL_URL="https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.xz"

if [[ ! -f "linux-${KERNEL_VERSION}.tar.xz" ]]; then
    curl -L -O "${KERNEL_URL}"
    echo "✅ Downloaded: linux-${KERNEL_VERSION}.tar.xz"
else
    echo "✅ Using cached: linux-${KERNEL_VERSION}.tar.xz"
fi

# Extract
echo "📦 Extracting kernel source..."
tar -xJf "linux-${KERNEL_VERSION}.tar.xz"
cd "linux-${KERNEL_VERSION}"

echo "✅ Kernel source ready"
echo ""

# Create minimal config
echo "⚙️  Creating minimal M1/vfkit kernel configuration..."

# Start with ARM64 defconfig as base
make ARCH=arm64 CROSS_COMPILE=${CROSS_COMPILE} defconfig

# Now create our minimal config
cat > .config.minimal << 'EOF'
#
# Minimal Linux Kernel for M1/Apple Silicon + vfkit
# Optimized for virtualization only - no physical hardware
#

#
# General setup
#
CONFIG_KERNEL_XZ=y
CONFIG_DEFAULT_HOSTNAME="vibecode-alpine"
CONFIG_SYSVIPC=y
CONFIG_POSIX_MQUEUE=y
CONFIG_NO_HZ=y
CONFIG_HIGH_RES_TIMERS=y
CONFIG_PREEMPT_VOLUNTARY=y
CONFIG_BSD_PROCESS_ACCT=y
CONFIG_TASK_XACCT=y
CONFIG_TASK_IO_ACCOUNTING=y
CONFIG_IKCONFIG=y
CONFIG_IKCONFIG_PROC=y
CONFIG_LOG_BUF_SHIFT=18
CONFIG_CGROUPS=y
CONFIG_CGROUP_SCHED=y
CONFIG_BLK_CGROUP=y
CONFIG_NAMESPACES=y
CONFIG_USER_NS=y
CONFIG_SCHED_AUTOGROUP=y
CONFIG_BLK_DEV_INITRD=y
# CONFIG_RD_GZIP is not set
# CONFIG_RD_BZIP2 is not set
# CONFIG_RD_LZMA is not set
CONFIG_RD_XZ=y
# CONFIG_RD_LZO is not set
# CONFIG_RD_LZ4 is not set
CONFIG_CC_OPTIMIZE_FOR_SIZE=y

#
# ARM64 Architecture
#
CONFIG_ARM64=y
CONFIG_ARM64_PAGE_SHIFT=12
CONFIG_ARM64_CONT_SHIFT=4
CONFIG_ARM64_VA_BITS_48=y
CONFIG_ARM64_VA_BITS=48
CONFIG_ARM64_4K_PAGES=y
# CONFIG_ARM64_16K_PAGES is not set
# CONFIG_ARM64_64K_PAGES is not set
CONFIG_COMPAT=y
CONFIG_RANDOMIZE_BASE=y

#
# Platform selection - DISABLE ALL physical platforms
#
# CONFIG_ARCH_ACTIONS is not set
# CONFIG_ARCH_SUNXI is not set
# CONFIG_ARCH_ALPINE is not set
# CONFIG_ARCH_BCM2835 is not set
# CONFIG_ARCH_BCM_IPROC is not set
# CONFIG_ARCH_BERLIN is not set
# CONFIG_ARCH_BRCMSTB is not set
# CONFIG_ARCH_EXYNOS is not set
# CONFIG_ARCH_K3 is not set
# CONFIG_ARCH_LAYERSCAPE is not set
# CONFIG_ARCH_LG1K is not set
# CONFIG_ARCH_HISI is not set
# CONFIG_ARCH_MEDIATEK is not set
# CONFIG_ARCH_MESON is not set
# CONFIG_ARCH_MVEBU is not set
# CONFIG_ARCH_MXC is not set
# CONFIG_ARCH_QCOM is not set
# CONFIG_ARCH_REALTEK is not set
# CONFIG_ARCH_RENESAS is not set
# CONFIG_ARCH_ROCKCHIP is not set
# CONFIG_ARCH_SEATTLE is not set
# CONFIG_ARCH_SYNQUACER is not set
# CONFIG_ARCH_TEGRA is not set
# CONFIG_ARCH_SPRD is not set
# CONFIG_ARCH_THUNDER is not set
# CONFIG_ARCH_THUNDER2 is not set
# CONFIG_ARCH_UNIPHIER is not set
# CONFIG_ARCH_VEXPRESS is not set
# CONFIG_ARCH_XGENE is not set
# CONFIG_ARCH_ZX is not set
# CONFIG_ARCH_ZYNQMP is not set

#
# Virtualization - GUEST only (not host)
#
CONFIG_PARAVIRT=y
# CONFIG_KVM is not set
# CONFIG_HAVE_KVM is not set

#
# Bus support
#
CONFIG_PCI=y
CONFIG_PCIEPORTBUS=y
CONFIG_HOTPLUG_PCI=y
CONFIG_HOTPLUG_PCI_ACPI=y

#
# virtio drivers - ONLY what we need
#
CONFIG_VIRTIO=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_PCI_LEGACY=y
CONFIG_VIRTIO_MMIO=y
CONFIG_VIRTIO_MMIO_CMDLINE_DEVICES=y
CONFIG_VIRTIO_BLK=y
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_CONSOLE=y
CONFIG_VIRTIO_RNG=y
CONFIG_VIRTIO_BALLOON=y
CONFIG_VIRTIO_VSOCKETS=y
CONFIG_VIRTIO_FS=y

#
# Block devices - virtio only
#
CONFIG_BLK_DEV=y
CONFIG_BLK_DEV_LOOP=y
CONFIG_BLK_DEV_RAM=y
# CONFIG_ATA is not set
# CONFIG_SCSI is not set
# CONFIG_MD is not set
# CONFIG_NVME_CORE is not set

#
# Networking
#
CONFIG_NET=y
CONFIG_PACKET=y
CONFIG_UNIX=y
CONFIG_INET=y
CONFIG_IP_MULTICAST=y
CONFIG_IP_ADVANCED_ROUTER=y
CONFIG_IP_PNP=y
CONFIG_IP_PNP_DHCP=y
CONFIG_IP_PNP_BOOTP=y
CONFIG_NETFILTER=y
CONFIG_NETFILTER_ADVANCED=y
CONFIG_NF_CONNTRACK=y
CONFIG_NETFILTER_XT_TARGET_MASQUERADE=y
CONFIG_IP_NF_IPTABLES=y
CONFIG_IP_NF_FILTER=y
CONFIG_IP_NF_NAT=y
CONFIG_TCP_CONG_CUBIC=y

#
# Network device support - virtio only
#
CONFIG_NETDEVICES=y
CONFIG_NET_CORE=y
# CONFIG_NET_VENDOR_3COM is not set
# CONFIG_NET_VENDOR_ADAPTEC is not set
# (disable ALL physical network vendors)
# CONFIG_WLAN is not set
# CONFIG_WIRELESS is not set
# CONFIG_BT is not set

#
# Filesystems
#
CONFIG_EXT4_FS=y
CONFIG_EXT4_FS_POSIX_ACL=y
CONFIG_EXT4_FS_SECURITY=y
CONFIG_TMPFS=y
CONFIG_TMPFS_POSIX_ACL=y
CONFIG_PROC_FS=y
CONFIG_PROC_KCORE=y
CONFIG_PROC_SYSCTL=y
CONFIG_SYSFS=y
CONFIG_DEVTMPFS=y
CONFIG_DEVTMPFS_MOUNT=y
# CONFIG_ISO9660_FS is not set
# CONFIG_VFAT_FS is not set
# CONFIG_NTFS_FS is not set
# CONFIG_NFS_FS is not set

#
# Disable EVERYTHING we don't need
#
# CONFIG_USB_SUPPORT is not set
# CONFIG_MMC is not set
# CONFIG_NEW_LEDS is not set
# CONFIG_DRM is not set
# CONFIG_FB is not set
# CONFIG_SOUND is not set
# CONFIG_HID_SUPPORT is not set
# CONFIG_GPIO is not set
# CONFIG_I2C is not set
# CONFIG_SPI is not set
# CONFIG_PWM is not set
# CONFIG_SENSORS_HWMON is not set
# CONFIG_THERMAL is not set
# CONFIG_WATCHDOG is not set
# CONFIG_MFD_SUPPORT is not set
# CONFIG_REGULATOR is not set
# CONFIG_MEDIA_SUPPORT is not set
# CONFIG_INPUT_TOUCHSCREEN is not set
# CONFIG_INPUT_MISC is not set
# CONFIG_SERIO is not set
# CONFIG_GAMEPORT is not set

#
# TTY/Serial - console only
#
CONFIG_TTY=y
CONFIG_VT=y
CONFIG_VT_CONSOLE=y
CONFIG_HW_CONSOLE=y
CONFIG_SERIAL_8250=y
CONFIG_SERIAL_8250_CONSOLE=y

#
# Security
#
CONFIG_SECURITYFS=y
CONFIG_SECURITY=y
CONFIG_SECURITY_NETWORK=y
CONFIG_SECURITY_PATH=y
# CONFIG_SECURITY_SELINUX is not set
# CONFIG_SECURITY_SMACK is not set
# CONFIG_SECURITY_APPARMOR is not set

#
# Crypto - minimal
#
CONFIG_CRYPTO=y
CONFIG_CRYPTO_AES=y
CONFIG_CRYPTO_SHA256=y
CONFIG_CRYPTO_RANDOM=y

#
# Debugging - disable for size
#
# CONFIG_DEBUG_KERNEL is not set
# CONFIG_DEBUG_INFO is not set
# CONFIG_FTRACE is not set

EOF

# Merge minimal config with defconfig
echo "✅ Created minimal configuration"
echo ""

# Apply the minimal config
scripts/kconfig/merge_config.sh -m .config .config.minimal

echo "📊 Configuration summary:"
echo "   Total config lines: $(wc -l < .config)"
echo "   Enabled features: $(grep -c "=y" .config || echo 0)"
echo "   Modules: $(grep -c "=m" .config || echo 0)"
echo ""

# Build the kernel
echo "🔨 Building minimal kernel..."
echo "   This will take 10-30 minutes on Apple Silicon..."
echo ""

# Determine number of cores
NCORES=$(sysctl -n hw.ncpu)
echo "Using ${NCORES} cores for parallel build"
echo ""

# Build
time make ARCH=arm64 CROSS_COMPILE=${CROSS_COMPILE} -j${NCORES} Image

if [[ ! -f "arch/arm64/boot/Image" ]]; then
    echo "❌ Kernel build failed"
    exit 1
fi

KERNEL_SIZE=$(du -h arch/arm64/boot/Image | cut -f1)
echo ""
echo "✅ Kernel built successfully!"
echo "   Size: ${KERNEL_SIZE}"
echo ""

# Copy to output directory
echo "📦 Installing kernel..."
cp arch/arm64/boot/Image "${OUTPUT_DIR}/vmlinux-minimal"

echo "✅ Installed to: ${OUTPUT_DIR}/vmlinux-minimal"
echo ""

# Compare sizes
echo "════════════════════════════════════════════════════════"
echo "  Size Comparison"
echo "════════════════════════════════════════════════════════"
echo ""

STOCK_SIZE=$(du -h "${OUTPUT_DIR}/vmlinux-3.22" | cut -f1)
MINIMAL_SIZE=$(du -h "${OUTPUT_DIR}/vmlinux-minimal" | cut -f1)

echo "Stock Alpine virt kernel:  ${STOCK_SIZE}"
echo "Custom minimal kernel:     ${MINIMAL_SIZE}"
echo ""

# Calculate savings
STOCK_BYTES=$(stat -f%z "${OUTPUT_DIR}/vmlinux-3.22")
MINIMAL_BYTES=$(stat -f%z "${OUTPUT_DIR}/vmlinux-minimal")
SAVED_BYTES=$((STOCK_BYTES - MINIMAL_BYTES))
SAVED_MB=$((SAVED_BYTES / 1024 / 1024))
PERCENT=$((100 * (STOCK_BYTES - MINIMAL_BYTES) / STOCK_BYTES))

echo "Savings: ${SAVED_MB}MB (${PERCENT}%)"
echo ""

echo "════════════════════════════════════════════════════════"
echo "  Build Complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Minimal kernel: ${OUTPUT_DIR}/vmlinux-minimal"
echo "Build directory: ${BUILD_DIR}"
echo ""
echo "To use the minimal kernel:"
echo "  cd ${OUTPUT_DIR}"
echo "  ln -sf vmlinux-minimal vmlinux"
echo "  ./scripts/vfkit/09-launch-node24-vm.sh"
echo ""
echo "To switch back to stock kernel:"
echo "  cd ${OUTPUT_DIR}"
echo "  ln -sf vmlinux-3.22 vmlinux"
echo ""
