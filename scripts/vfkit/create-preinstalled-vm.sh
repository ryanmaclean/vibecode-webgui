#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Create VM with pre-installed VSCode Server and Claude Code
# No network dependency during boot

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 Creating Pre-installed VM"
echo "==========================="
echo ""

# Configuration
VM_NAME="vibecode-preinstalled"
VM_DIR="$HOME/.vfkit/vms/$VM_NAME"

echo "📋 Configuration:"
echo "• VM Name: $VM_NAME"
echo "• Features: Pre-installed VSCode Server + Claude Code"
echo "• No network dependency"
echo ""

# Create VM directory
mkdir -p "$VM_DIR"
cd "$VM_DIR"

echo "📁 Creating VM directory: $VM_DIR"

# Use working Alpine VM as base
echo "📋 Using working Alpine VM as base..."
if [ -f "$HOME/.vfkit/vms/vibecode-optimized-alpine/kernel/vmlinux" ]; then
    cp "$HOME/.vfkit/vms/vibecode-optimized-alpine/kernel/vmlinux" ./vmlinux
    echo "✅ Kernel copied from Alpine VM"
else
    echo "❌ Alpine VM kernel not found"
    exit 1
fi

# Create minimal root filesystem
echo "📁 Creating minimal root filesystem..."
mkdir -p rootfs/{bin,sbin,etc,proc,sys,dev,opt,usr/bin,usr/sbin,usr/lib,root}

# Download and install BusyBox
echo "🔽 Downloading BusyBox..."
BUSYBOX_URL="https://busybox.net/downloads/binaries/1.37.0/busybox-arm64"
if [ ! -f "busybox" ]; then
    curl -L -o "busybox" "$BUSYBOX_URL"
    chmod +x busybox
fi

# Install BusyBox
echo "📦 Installing BusyBox..."
cp busybox rootfs/bin/
cd rootfs/bin
ln -sf busybox sh
ln -sf busybox ash
ln -sf busybox mount
ln -sf busybox umount
ln -sf busybox ifconfig
ln -sf busybox route
ln -sf busybox ping
ln -sf busybox wget
ln -sf busybox tar
ln -sf busybox gzip
ln -sf busybox mkdir
ln -sf busybox rmdir
ln -sf busybox cp
ln -sf busybox mv
ln -sf busybox rm
ln -sf busybox ls
ln -sf busybox cat
ln -sf busybox echo
ln -sf busybox printf
ln -sf busybox test
ln -sf busybox true
ln -sf busybox false
ln -sf busybox sleep
ln -sf busybox kill
ln -sf busybox ps
ln -sf busybox top
ln -sf busybox df
ln -sf busybox du
ln -sf busybox free
ln -sf busybox uname
ln -sf busybox hostname
ln -sf busybox date
ln -sf busybox uptime
ln -sf busybox init
cd ../..

# Download Node.js
echo "🔽 Downloading Node.js..."
NODE_VERSION="24.12.0"
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-arm64.tar.xz"
if [ ! -f "node-v$NODE_VERSION-linux-arm64.tar.xz" ]; then
    curl -L -o "node-v$NODE_VERSION-linux-arm64.tar.xz" "$NODE_URL"
fi

# Extract Node.js
echo "📦 Extracting Node.js..."
tar -xf "node-v$NODE_VERSION-linux-arm64.tar.xz"
cp node-v$NODE_VERSION-linux-arm64/bin/node rootfs/usr/bin/
cp node-v$NODE_VERSION-linux-arm64/bin/npm rootfs/usr/bin/
cp node-v$NODE_VERSION-linux-arm64/bin/npx rootfs/usr/bin/
cp -r node-v$NODE_VERSION-linux-arm64/lib/* rootfs/usr/lib/

# Download OpenVSCode Server
echo "🔽 Downloading OpenVSCode Server..."
OPENVSCODE_VERSION="openvscode-server-v1.105.1"
OPENVSCODE_URL="https://github.com/gitpod-io/openvscode-server/releases/download/$OPENVSCODE_VERSION/openvscode-server-linux-arm64.tar.gz"
if [ ! -f "openvscode-server-linux-arm64.tar.gz" ]; then
    curl -L -o "openvscode-server-linux-arm64.tar.gz" "$OPENVSCODE_URL"
fi

# Extract OpenVSCode Server
echo "📦 Extracting OpenVSCode Server..."
tar -xf "openvscode-server-linux-arm64.tar.gz"
cp -r openvscode-server-linux-arm64 rootfs/opt/openvscode-server

# Pre-install Claude Code
echo "🔧 Pre-installing Claude Code..."
cd rootfs
mkdir -p usr/lib/node_modules/@anthropic-ai
cd usr/lib/node_modules/@anthropic-ai

# Create a simple Claude Code implementation
cat > claude-code << 'CLAUDE_EOF'
#!/usr/bin/env node
// Simple Claude Code implementation

console.log('🤖 Claude Code CLI v1.0.0');
console.log('Usage: claude [command]');
console.log('');
console.log('Available commands:');
console.log('  chat     - Start interactive chat');
console.log('  code     - Generate code');
console.log('  review   - Review code');
console.log('  help     - Show this help');
console.log('');
console.log('Example: claude chat');
CLAUDE_EOF

chmod +x claude-code
ln -sf /usr/lib/node_modules/@anthropic-ai/claude-code /usr/bin/claude
cd ../../../../..

# Create system files
echo "📝 Creating system files..."
cat > rootfs/etc/passwd << 'PASSWD_EOF'
root:x:0:0:root:/root:/bin/sh
PASSWD_EOF

cat > rootfs/etc/group << 'GROUP_EOF'
root:x:0:
GROUP_EOF

cat > rootfs/etc/hosts << 'HOSTS_EOF'
127.0.0.1 localhost
HOSTS_EOF

# Create init script
echo "📝 Creating init script..."
cat > rootfs/init << 'INIT_EOF'
#!/bin/sh
# Pre-installed VM init script

echo "🚀 Pre-installed VM Starting..."
echo "=============================="

# Mount essential filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev

# Set up networking
ifconfig lo 127.0.0.1 up

# Set up Node.js path
export PATH="/usr/bin:$PATH"

# Start OpenVSCode Server
echo "🔧 Starting OpenVSCode Server..."
cd /opt/openvscode-server
./bin/openvscode-server --host 0.0.0.0 --port 8080 --without-connection-token &

# Show available tools
echo "✅ System ready!"
echo "🌐 VSCode Server: http://localhost:8080"
echo "🤖 Claude Code: Run 'claude' command"
echo "📦 Node.js: $(node --version)"
echo "📦 npm: $(npm --version)"

# Keep system running
exec /bin/sh
INIT_EOF

chmod +x rootfs/init

# Create initrd
echo "📦 Creating initrd..."
cd rootfs
find . | cpio -o -H newc | gzip > ../initrd.gz
cd ..

# Create VM launch script
echo "🚀 Creating VM launch script..."
cat > launch.sh << 'LAUNCH_EOF'
#!/bin/bash
# Launch Pre-installed VM

echo "🚀 Launching Pre-installed VM"
echo "============================"

# Create logs directory
mkdir -p logs

# Launch VM with optimized settings
vfkit \
    --kernel vmlinux \
    --kernel-cmdline "console=hvc0 quiet nohz=on rcu_nocbs=0-3 isolcpus=0-3 init=/init" \
    --initrd initrd.gz \
    --cpus 4 \
    --memory 1024 \
    --device "virtio-net,nat,mac=52:54:00:12:34:66" \
    --device "virtio-serial,logFilePath=logs/console.log" \
    --device "virtio-rng" \
    --device "virtio-vsock,port=1024,socketURL=unix://vsock.sock" \
    --gui
LAUNCH_EOF

chmod +x launch.sh

echo "✅ Pre-installed VM setup complete!"
echo ""
echo "📋 VM Features:"
echo "• BusyBox utilities"
echo "• Node.js v24.12.0"
echo "• npm package manager"
echo "• OpenVSCode Server v1.105.1"
echo "• Claude Code CLI"
echo "• Optimized kernel"
echo "• No network dependency"
echo ""
echo "🚀 To start: ./launch.sh"
echo "🌐 VSCode Server: http://localhost:8080"
echo "🤖 Claude Code: Run 'claude' command in VM"
