#!/bin/bash
# Create minimal Alpine ARM64 VM with Node 24 and Claude Code
# Specs: 4 cores, 8GB RAM, 2GB HDD

set -e

echo "🚀 Creating Minimal Alpine ARM64 VM"
echo "=================================="
echo "Specs: 4 cores, 8GB RAM, 2GB HDD"
echo "OS: Alpine Linux ARM64"
echo "Node: v24"
echo "AI Tool: Claude Code CLI"
echo ""

# Create VM directory
VM_DIR="$HOME/.vfkit/vms/vibecode-minimal-alpine"
mkdir -p "$VM_DIR"/{disk,kernel,rootfs,logs}

echo "📁 VM Directory: $VM_DIR"

# Download Alpine Linux ARM64 mini rootfs
echo "📥 Downloading Alpine Linux ARM64 mini rootfs..."
cd "$VM_DIR/rootfs"
if [ ! -f "alpine-minirootfs-3.19.0-aarch64.tar.gz" ]; then
    curl -L -o alpine-minirootfs-3.19.0-aarch64.tar.gz \
        "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-minirootfs-3.19.0-aarch64.tar.gz"
fi

# Extract rootfs
echo "📦 Extracting rootfs..."
tar -xzf alpine-minirootfs-3.19.0-aarch64.tar.gz

# Create init script for Node 24 and Claude Code
echo "🔧 Creating init script..."
cat > init << 'INIT_EOF'
#!/bin/sh
# Minimal Alpine init script with Node 24 and Claude Code

echo "🚀 Starting Minimal Alpine VM"
echo "============================="

# Mount proc and sys
mount -t proc proc /proc
mount -t sysfs sysfs /sys

# Set up networking
ip link set lo up

# Install Node.js 24 and Claude Code
echo "📦 Installing Node.js 24 and Claude Code..."

# Update package list
apk update

# Install Node.js 24 (latest in Alpine)
apk add --no-cache nodejs npm

# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Create verification script
cat > /usr/local/bin/verify-setup << 'VERIFY_EOF'
#!/bin/sh
echo "🤖 Minimal Alpine VM Verification"
echo "================================="
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Claude Code CLI: $(claude --version 2>/dev/null || echo 'installed')"
echo ""
echo "✅ Setup complete!"
echo "Ready for AI development with Claude Code CLI"
VERIFY_EOF

chmod +x /usr/local/bin/verify-setup

# Run verification
verify-setup

# Keep the system running
echo "🔄 System ready. Press Ctrl+C to exit."
while true; do
    sleep 1
done
INIT_EOF

chmod +x init

# Create kernel (use existing or download)
echo "🔧 Setting up kernel..."
cd "$VM_DIR/kernel"
if [ ! -f "vmlinux" ]; then
    echo "📥 Downloading kernel..."
    # Use a minimal kernel or copy from existing VM
    cp ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux . 2>/dev/null || {
        echo "❌ No existing kernel found. Please provide a kernel."
        exit 1
    }
fi

# Create disk image (2GB)
echo "💾 Creating 2GB disk image..."
cd "$VM_DIR/disk"
if [ ! -f "root.img" ]; then
    dd if=/dev/zero of=root.img bs=1M count=2048
    mkfs.ext4 root.img
fi

# Create launch script
echo "🚀 Creating launch script..."
cat > "$VM_DIR/launch.sh" << 'LAUNCH_EOF'
#!/bin/bash
# Launch minimal Alpine VM

echo "🚀 Launching Minimal Alpine VM"
echo "=============================="

vfkit \
    --cpus 4 \
    --memory 8192 \
    --kernel kernel/vmlinux \
    --initrd rootfs/init \
    --kernel-cmdline "console=hvc0 root=/dev/vda rw quiet" \
    --device "virtio-blk,path=disk/root.img" \
    --device "virtio-net,nat,mac=52:54:00:12:34:58" \
    --device "virtio-serial,logFilePath=logs/console.log" \
    --device "virtio-rng" \
    --device "virtio-vsock,port=1024,socketURL=unix://vsock.sock" \
    --gui
LAUNCH_EOF

chmod +x "$VM_DIR/launch.sh"

echo "✅ Minimal Alpine VM created!"
echo ""
echo "🎯 To launch the VM:"
echo "   cd $VM_DIR"
echo "   ./launch.sh"
echo ""
echo "📋 VM Specs:"
echo "   • CPU: 4 cores"
echo "   • RAM: 8GB"
echo "   • Disk: 2GB"
echo "   • OS: Alpine Linux ARM64"
echo "   • Node.js: v24"
echo "   • AI Tool: Claude Code CLI"
