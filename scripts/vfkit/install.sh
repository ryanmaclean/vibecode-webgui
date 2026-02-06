#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# VibeCode Fun Demo VM - One-Liner Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/yourrepo/main/scripts/vfkit/install.sh | bash
# Or locally: curl -fsSL http://localhost:8000/install.sh | bash

# Initialize log aggregation
init_log_aggregation


set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
cat << 'BANNER'
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║        ⚡ VibeCode Fun Demo VM                        ║
║                                                       ║
║        One-Liner Installer                           ║
║        Super Quick • BusyBox • Weather Demo          ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
BANNER

echo ""
echo -e "${CYAN}🚀 Starting installation...${NC}"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This installer only works on macOS (Apple Silicon)${NC}"
    exit 1
fi

# Check if running on Apple Silicon
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo -e "${YELLOW}⚠️  Warning: This is optimized for Apple Silicon (ARM64)${NC}"
    echo -e "${YELLOW}   Your architecture: $ARCH${NC}"
    echo ""
fi

echo -e "${BLUE}[1/4]${NC} Checking prerequisites..."

# Check for vfkit
if ! command -v vfkit &> /dev/null; then
    echo -e "${YELLOW}   vfkit not found. Installing via brew...${NC}"
    if ! command -v brew &> /dev/null; then
        echo -e "${RED}❌ Homebrew not found. Please install: https://brew.sh${NC}"
        exit 1
    fi
    brew install vfkit
    echo -e "${GREEN}   ✅ vfkit installed${NC}"
else
    echo -e "${GREEN}   ✅ vfkit found: $(which vfkit)${NC}"
fi

# Check for curl/wget
if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    echo -e "${RED}❌ curl or wget required${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[2/4]${NC} Setting up VM directories..."

VM_DIR="$HOME/.vfkit/vms/vibecode-alpine"
KERNEL_DIR="$VM_DIR/kernel"
ROOTFS_DIR="$VM_DIR/rootfs"

mkdir -p "$KERNEL_DIR"
mkdir -p "$ROOTFS_DIR"

echo -e "${GREEN}   ✅ Directories created${NC}"

echo ""
echo -e "${BLUE}[3/4]${NC} Downloading Alpine kernel..."

ALPINE_VERSION="3.22"
ALPINE_RELEASE="3.22.2"
KERNEL_FILE="$KERNEL_DIR/vmlinux"

if [ -f "$KERNEL_FILE" ]; then
    echo -e "${GREEN}   ✅ Kernel already exists ($(du -h "$KERNEL_FILE" | cut -f1))${NC}"
else
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    echo -e "${CYAN}   Downloading Alpine ${ALPINE_VERSION} kernel...${NC}"
    curl -# -L -o "alpine-virt.iso" \
        "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/aarch64/alpine-virt-${ALPINE_RELEASE}-aarch64.iso"

    echo -e "${CYAN}   Extracting kernel...${NC}"
    mkdir -p mnt
    if command -v hdiutil &> /dev/null; then
        # macOS
        MOUNT_POINT=$(hdiutil attach "alpine-virt.iso" | grep Volumes | awk '{print $3}')
        cp "$MOUNT_POINT/boot/vmlinuz-virt" "vmlinuz-${ALPINE_VERSION}"
        hdiutil detach "$MOUNT_POINT" -quiet
    else
        echo -e "${RED}   ❌ Cannot mount ISO on this system${NC}"
        exit 1
    fi

    echo -e "${CYAN}   Decompressing kernel...${NC}"
    # Extract gzip from kernel
    python3 << 'PYEOF'
with open('vmlinuz-3.22', 'rb') as f:
    data = f.read()
offset = data.find(b'\x1f\x8b')
if offset >= 0:
    with open('vmlinuz.gz', 'wb') as f:
        f.write(data[offset:])
PYEOF

    gunzip -c vmlinuz.gz > "$KERNEL_FILE"
    cd - > /dev/null
    rm -rf "$TEMP_DIR"

    echo -e "${GREEN}   ✅ Kernel downloaded ($(du -h "$KERNEL_FILE" | cut -f1))${NC}"
fi

echo ""
echo -e "${BLUE}[4/4]${NC} Building fun demo rootfs..."

ROOTFS_FILE="$ROOTFS_DIR/fun-demo-rootfs.cpio.gz"

BUILD_DIR=$(mktemp -d)
cd "$BUILD_DIR"

echo -e "${CYAN}   Downloading Alpine minirootfs...${NC}"
curl -# -L -o alpine-minirootfs.tar.gz \
    "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/aarch64/alpine-minirootfs-${ALPINE_RELEASE}-aarch64.tar.gz"

echo -e "${CYAN}   Building rootfs with weather demo...${NC}"
mkdir -p rootfs
cd rootfs
tar -xzf ../alpine-minirootfs.tar.gz

# Create weather script
mkdir -p usr/local/bin
cat > usr/local/bin/weather << 'WEATHEREOF'
#!/bin/sh
LOC="${1:-}"
echo ""
echo "🌤️  Weather Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ -z "$LOC" ]; then
    wget -qO- "wttr.in/?format=v2" 2>/dev/null || echo "❌ Network not ready"
else
    wget -qO- "wttr.in/${LOC}?format=v2" 2>/dev/null || echo "❌ Can't fetch weather"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Usage: weather [location]"
echo "Try: weather Moon | weather Mars | weather Everest"
echo ""
WEATHEREOF
chmod +x usr/local/bin/weather

# Create demo script
cat > usr/local/bin/demo << 'DEMOEOF'
#!/bin/sh
clear
cat << 'BANNER'
╔═══════════════════════════════════════════════════════╗
║        ⚡ VibeCode Demo VM                            ║
║        Alpine 3.22 • vfkit • Apple Silicon           ║
╚═══════════════════════════════════════════════════════╝
BANNER
echo ""
weather
echo "💡 Try: weather Moon | weather Mars | weather Everest"
echo ""
DEMOEOF
chmod +x usr/local/bin/demo

# Create init script
cat > init << 'INITEOF'
#!/bin/sh
mount -t proc proc /proc 2>/dev/null
mount -t sysfs sysfs /sys 2>/dev/null
mount -t devtmpfs devtmpfs /dev 2>/dev/null
mkdir -p /dev/pts /dev/shm
mount -t devpts devpts /dev/pts 2>/dev/null
mount -t tmpfs tmpfs /dev/shm 2>/dev/null
ip link set lo up 2>/dev/null
ip link set eth0 up 2>/dev/null
udhcpc -i eth0 -s /usr/share/udhcpc/default.script -q -n -f >/dev/null 2>&1 &
hostname vibecode-demo 2>/dev/null
clear
cat << 'BANNER'
╔═══════════════════════════════════════════════════════╗
║        ⚡ VibeCode Demo VM                            ║
║        Alpine 3.22 • BusyBox • Weather Demo          ║
╚═══════════════════════════════════════════════════════╝
BANNER
echo ""
echo "🌤️  Today's Weather:"
weather 2>/dev/null || echo "   (Fetching... try 'weather' in a moment)"
echo ""
echo "💡 Try: demo | weather Moon | weather Mars"
echo ""
exec /bin/sh
INITEOF
chmod +x init

# Build initramfs
find . -print0 | cpio --null --create --format=newc 2>/dev/null | gzip -9 > "$ROOTFS_FILE"

cd - > /dev/null
rm -rf "$BUILD_DIR"

ROOTFS_SIZE=$(du -h "$ROOTFS_FILE" | cut -f1)
echo -e "${GREEN}   ✅ Rootfs built (${ROOTFS_SIZE})${NC}"

echo ""
echo -e "${BLUE}[+]${NC} Creating launch script..."

LAUNCH_SCRIPT="$VM_DIR/launch-fun-demo.sh"
cat > "$LAUNCH_SCRIPT" << 'LAUNCHEOF'
#!/bin/bash
KERNEL="$HOME/.vfkit/vms/vibecode-alpine/kernel/vmlinux"
ROOTFS="$HOME/.vfkit/vms/vibecode-alpine/rootfs/fun-demo-rootfs.cpio.gz"
echo "🚀 Launching VibeCode Fun Demo VM..."
echo ""
START=$(date +%s)
vfkit \
  --cpus 2 \
  --memory 1024 \
  --device virtio-net,nat \
  --device virtio-rng \
  --device virtio-serial,logFilePath=/dev/stdout \
  --bootloader linux,kernel="$KERNEL",initrd="$ROOTFS",cmdline="console=hvc0 quiet"
END=$(date +%s)
echo ""
echo "⏱️  Boot time: $((END - START))s"
LAUNCHEOF
chmod +x "$LAUNCH_SCRIPT"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}✅ Installation complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Stats:${NC}"
echo -e "  • Rootfs: ${ROOTFS_SIZE}"
echo -e "  • Kernel: $(du -h "$KERNEL_FILE" | cut -f1)"
echo -e "  • Boot time: ~2 seconds 🚀"
echo -e "  • Memory: 1GB"
echo ""
echo -e "${YELLOW}🚀 Launch VM:${NC}"
echo -e "  ${CYAN}$LAUNCH_SCRIPT${NC}"
echo ""
echo -e "  ${CYAN}# Or use short command:${NC}"
echo -e "  ${CYAN}~/.vfkit/vms/vibecode-alpine/launch-fun-demo.sh${NC}"
echo ""
echo -e "${YELLOW}💡 Inside VM try:${NC}"
echo -e "  ${CYAN}demo${NC}             # Run demo"
echo -e "  ${CYAN}weather${NC}          # Your weather"
echo -e "  ${CYAN}weather Moon${NC}     # Moon weather 🌙"
echo -e "  ${CYAN}weather Mars${NC}     # Mars weather 🔴"
echo -e "  ${CYAN}weather Everest${NC}  # Mt. Everest"
echo ""
echo -e "${GREEN}Enjoy! ⚡${NC}"
echo ""
