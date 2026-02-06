#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Create super-simple Alpine VM with fun weather demo
# One-liner ready: curl -fsSL https://... | bash

# Initialize log aggregation
init_log_aggregation


set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🌤️  VibeCode Fun Demo VM - Super Quick Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Configuration
ALPINE_VERSION="3.22"
ALPINE_RELEASE="3.22.2"
ALPINE_ARCH="aarch64"
ROOTFS_DIR="$HOME/.vfkit/vms/vibecode-alpine/rootfs"
BUILD_DIR="/tmp/vibecode-fun-demo-build-$$"

mkdir -p "$ROOTFS_DIR"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cd "$BUILD_DIR"

echo -e "${GREEN}📦 Downloading Alpine minirootfs...${NC}"
ALPINE_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ALPINE_ARCH}/alpine-minirootfs-${ALPINE_RELEASE}-${ALPINE_ARCH}.tar.gz"
curl -# -L -o alpine-minirootfs.tar.gz "$ALPINE_URL"

echo -e "${GREEN}📦 Extracting rootfs...${NC}"
mkdir -p rootfs
cd rootfs
tar -xzf ../alpine-minirootfs.tar.gz

echo -e "${GREEN}🌤️  Creating weather script...${NC}"

# Create weather script for BusyBox
mkdir -p usr/local/bin
cat > usr/local/bin/weather << 'WEATHEREOF'
#!/bin/sh
# Fun weather script using wttr.in

LOC="${1:-}"
echo ""
echo "🌤️  Weather Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -z "$LOC" ]; then
    # Auto-detect
    wget -qO- "wttr.in/?format=v2" 2>/dev/null || echo "❌ Can't fetch weather (no network?)"
else
    wget -qO- "wttr.in/${LOC}?format=v2" 2>/dev/null || echo "❌ Can't fetch weather for $LOC"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Usage: weather [location]"
echo ""
echo "Examples:"
echo "  weather              # Auto-detect location"
echo "  weather Tokyo        # Weather in Tokyo"
echo "  weather London       # Weather in London"
echo "  weather Moon         # Try this! 🌙"
echo "  weather Everest      # Weather on Everest"
echo ""
WEATHEREOF
chmod +x usr/local/bin/weather

echo -e "${GREEN}⚡ Creating demo script...${NC}"

cat > usr/local/bin/demo << 'DEMOEOF'
#!/bin/sh
# Quick demo script

clear
cat << 'BANNER'
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║        ⚡ VibeCode Demo VM                            ║
║                                                       ║
║        Alpine 3.22 • vfkit • Apple Silicon           ║
║        Boot time: ~2 seconds 🚀                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
BANNER

echo ""
echo "🌤️  Let's check the weather..."
echo ""
weather

echo ""
echo "💡 Try these commands:"
echo "  weather Moon       # Fun! 🌙"
echo "  weather Everest    # Mt. Everest weather"
echo "  weather Mars       # Yes, Mars weather!"
echo "  uname -a           # System info"
echo "  free -h            # Memory usage"
echo ""
DEMOEOF
chmod +x usr/local/bin/demo

echo -e "${GREEN}🎨 Creating welcome banner...${NC}"

# Create custom init script
cat > init << 'INITEOF'
#!/bin/sh
# Minimal init script

# Mount essential filesystems
mount -t proc proc /proc 2>/dev/null
mount -t sysfs sysfs /sys 2>/dev/null
mount -t devtmpfs devtmpfs /dev 2>/dev/null
mkdir -p /dev/pts /dev/shm
mount -t devpts devpts /dev/pts 2>/dev/null
mount -t tmpfs tmpfs /dev/shm 2>/dev/null

# Setup networking
ip link set lo up 2>/dev/null
ip link set eth0 up 2>/dev/null
udhcpc -i eth0 -s /usr/share/udhcpc/default.script -q -n -f >/dev/null 2>&1 &

# Setup hostname
hostname vibecode-demo 2>/dev/null

# Clear screen and show welcome
clear
cat << 'BANNER'
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║        ⚡ VibeCode Demo VM                            ║
║                                                       ║
║        Alpine 3.22 • BusyBox • vfkit                 ║
║        Boot time: ~2 seconds 🚀                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝

BANNER

echo "🌤️  Today's Weather:"
weather 2>/dev/null || echo "   (Network not ready yet - try 'weather' in a moment)"
echo ""

echo "💡 Fun commands to try:"
echo "  demo             # Run full demo"
echo "  weather Moon     # Weather on the Moon! 🌙"
echo "  weather Mars     # Weather on Mars!"
echo "  weather Everest  # Mt. Everest weather"
echo ""

# Start shell
exec /bin/sh
INITEOF
chmod +x init

echo -e "${GREEN}📦 Building initramfs...${NC}"

# Build the cpio archive
find . -print0 | cpio --null --create --format=newc 2>/dev/null | gzip -9 > "$ROOTFS_DIR/fun-demo-rootfs.cpio.gz"

ROOTFS_SIZE=$(du -h "$ROOTFS_DIR/fun-demo-rootfs.cpio.gz" | cut -f1)

echo ""
echo -e "${GREEN}✅ Fun demo rootfs created!${NC}"
echo "   Size: $ROOTFS_SIZE"
echo "   Location: $ROOTFS_DIR/fun-demo-rootfs.cpio.gz"

echo ""
echo -e "${GREEN}🚀 Creating launch script...${NC}"

# Create launch script
cat > "$HOME/.vfkit/vms/vibecode-alpine/launch-fun-demo.sh" << 'LAUNCHEOF'
#!/bin/bash
# Launch VibeCode Fun Demo VM

KERNEL="$HOME/.vfkit/vms/vibecode-alpine/kernel/vmlinux"
ROOTFS="$HOME/.vfkit/vms/vibecode-alpine/rootfs/fun-demo-rootfs.cpio.gz"

echo "🚀 Launching VibeCode Fun Demo VM..."
echo ""

# Start time
START=$(date +%s.%N)

vfkit \
  --cpus 2 \
  --memory 1024 \
  --device virtio-net,nat \
  --device virtio-rng \
  --device virtio-serial,logFilePath=/dev/stdout \
  --bootloader linux,kernel="$KERNEL",initrd="$ROOTFS",cmdline="console=hvc0 quiet"

END=$(date +%s.%N)
DURATION=$(echo "$END - $START" | bc)
echo ""
echo "⏱️  VM ran for ${DURATION}s"
LAUNCHEOF
chmod +x "$HOME/.vfkit/vms/vibecode-alpine/launch-fun-demo.sh"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Fun Demo VM ready!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📝 What you got:${NC}"
echo "  • Ultra-minimal Alpine 3.22 ($ROOTFS_SIZE)"
echo "  • Fun weather command (try: weather Moon)"
echo "  • ~2 second boot time 🚀"
echo "  • BusyBox utilities"
echo ""
echo -e "${YELLOW}🚀 To launch:${NC}"
echo "  $HOME/.vfkit/vms/vibecode-alpine/launch-fun-demo.sh"
echo ""
echo -e "${YELLOW}Or use the short command:${NC}"
echo "  ~/.vfkit/vms/vibecode-alpine/launch-fun-demo.sh"
echo ""
echo -e "${YELLOW}💡 Inside VM try:${NC}"
echo "  demo             # Run full demo"
echo "  weather          # Your weather"
echo "  weather Moon     # Moon weather! 🌙"
echo "  weather Mars     # Mars weather!"
echo ""

# Cleanup
cd - > /dev/null
rm -rf "$BUILD_DIR"
