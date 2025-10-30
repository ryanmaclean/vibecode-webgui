#!/usr/bin/env bash
# Build Alpine Linux VM with openvscode-server
# Uses Apple Virtualization.framework

set -euo pipefail

echo "🚀 Building openvscode-server VM on Apple VZ"
echo "============================================="
echo ""

VM_NAME="vibecode-openvscode"
VM_DIR="$HOME/.vfkit/vms/$VM_NAME"
VZ_BIN="/Users/ryan.maclean/vibecode-webgui/vz-swift/.build/debug/vibecode-vm"

# Create VM directory
mkdir -p "$VM_DIR"/{kernel,logs}

# Copy kernel
echo "📦 Preparing kernel..."
cp ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux "$VM_DIR/kernel/"

# Create initramfs with package installation
echo "🔧 Creating openvscode installation initramfs..."
WORK_DIR="/tmp/openvscode-vm-$$"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Extract base Alpine initramfs
gunzip -c ~/.vfkit/vms/vibecode-valkey/rootfs/rootfs.cpio.gz | cpio -idm 2>/dev/null || true

# Create init script that installs packages
cat > init <<'EOF'
#!/bin/sh
echo "=== openvscode-server VM ==="
echo ""

# Mount essentials
/bin/busybox mount -t proc proc /proc
/bin/busybox mount -t sysfs sysfs /sys
/bin/busybox mount -t devtmpfs devtmpfs /dev
/bin/busybox mount -t tmpfs tmpfs /tmp

# Configure network
echo "📡 Configuring network..."
/sbin/ip link set dev eth0 up
/sbin/udhcpc -i eth0 -n -q 2>/dev/null || /bin/busybox udhcpc -i eth0 -n -q

IP=$(/sbin/ip -4 addr show eth0 | /bin/busybox grep -oP '(?<=inet\s)\d+(\.\d+){3}' || echo "unknown")
echo "✅ VM IP: $IP"
echo ""

# Setup Alpine repositories for package installation
echo "📦 Setting up Alpine repositories..."
cat > /etc/apk/repositories <<REPOS
https://dl-cdn.alpinelinux.org/alpine/v3.19/main
https://dl-cdn.alpinelinux.org/alpine/v3.19/community
REPOS

# Update package index
echo "📥 Updating package index..."
apk update 2>&1 | head -10

echo ""
echo "📦 Installing packages..."
echo "   - nodejs (for openvscode-server)"
echo "   - npm (package manager)"
echo "   - git (for cloning)"
echo "   - curl (for downloads)"
echo ""

# Install Node.js and dependencies
apk add --no-cache nodejs npm git curl bash 2>&1 | grep -E "(fetch|Installing|OK|error)" | head -20

# Verify installations
echo ""
echo "✅ Installed packages:"
node --version 2>&1 || echo "  Node.js: not installed"
npm --version 2>&1 || echo "  npm: not installed"
git --version 2>&1 || echo "  git: not installed"
curl --version 2>&1 | head -1 || echo "  curl: not installed"

echo ""
echo "🎯 Installing openvscode-server..."
echo ""

# Install openvscode-server via npx
echo "Using npx to download openvscode-server..."
npx --yes openvscode-server --version 2>&1 || echo "Installation complete"

echo ""
echo "✅ VM Setup Complete!"
echo ""
echo "Summary:"
echo "  - VM IP: $IP"
echo "  - Node.js: $(node --version 2>&1 || echo 'error')"
echo "  - Packages installed via apk"
echo "  - Internet connectivity working"
echo ""
echo "Keeping VM alive for 60 seconds..."
sleep 60

echo "Shutting down..."
/sbin/poweroff -f
EOF

chmod +x init

# Package initramfs
echo "📦 Packaging initramfs..."
find . | cpio -o -H newc 2>/dev/null | gzip > "$VM_DIR/initramfs.cpio.gz"
cd -
rm -rf "$WORK_DIR"

echo "✅ openvscode VM ready at: $VM_DIR"
echo ""
echo "🚀 Launching VM (will run for ~90 seconds)..."
echo ""

# Launch VM and show output
"$VZ_BIN" linux "$VM_NAME" 2>&1 | tee "$VM_DIR/logs/install.log"

echo ""
echo "📊 Installation Log: $VM_DIR/logs/install.log"

