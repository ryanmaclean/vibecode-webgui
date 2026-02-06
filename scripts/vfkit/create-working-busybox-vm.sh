#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Create working BusyBox VM with VSCode Server and Claude Code
# Uses Alpine's initrd as base and adds BusyBox components

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 Creating Working BusyBox VM"
echo "============================="
echo ""

# Configuration
VM_NAME="vibecode-busybox-working"
VM_DIR="$HOME/.vfkit/vms/$VM_NAME"

echo "📋 Configuration:"
echo "• VM Name: $VM_NAME"
echo "• Base: Alpine initrd + BusyBox + VSCode Server"
echo "• Features: Claude Code, AI tools"
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

# Extract Alpine initrd and modify it
echo "📦 Extracting Alpine initrd..."
if [ -f "$HOME/.vfkit/vms/vibecode-optimized-alpine/initrd.gz" ]; then
    cp "$HOME/.vfkit/vms/vibecode-optimized-alpine/initrd.gz" ./alpine-initrd.gz
    mkdir -p alpine-rootfs
    cd alpine-rootfs
    zcat ../alpine-initrd.gz | cpio -id
    echo "✅ Alpine initrd extracted"
else
    echo "❌ Alpine initrd not found"
    exit 1
fi

# Download and install BusyBox
echo "🔽 Downloading BusyBox..."
BUSYBOX_URL="https://busybox.net/downloads/binaries/1.37.0/busybox-arm64"
if [ ! -f "busybox" ]; then
    curl -L -o "busybox" "$BUSYBOX_URL"
    chmod +x busybox
fi

# Install BusyBox
echo "📦 Installing BusyBox..."
cp busybox bin/
cd bin
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
cd ..

# Download latest OpenVSCode Server
echo "🔽 Downloading latest OpenVSCode Server..."
OPENVSCODE_VERSION="openvscode-server-v1.105.1"
OPENVSCODE_URL="https://github.com/gitpod-io/openvscode-server/releases/download/$OPENVSCODE_VERSION/openvscode-server-linux-arm64.tar.gz"
if [ ! -f "openvscode-server-linux-arm64.tar.gz" ]; then
    curl -L -o "openvscode-server-linux-arm64.tar.gz" "$OPENVSCODE_URL"
fi

# Extract OpenVSCode Server
echo "📦 Extracting OpenVSCode Server..."
tar -xf "openvscode-server-linux-arm64.tar.gz"
mv openvscode-server-linux-arm64 opt/openvscode-server

# Install Node.js for Claude Code
echo "🔽 Installing Node.js..."
NODE_VERSION="24.12.0"
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-arm64.tar.xz"
if [ ! -f "node-v$NODE_VERSION-linux-arm64.tar.xz" ]; then
    curl -L -o "node-v$NODE_VERSION-linux-arm64.tar.xz" "$NODE_URL"
fi

# Extract Node.js
echo "📦 Extracting Node.js..."
tar -xf "node-v$NODE_VERSION-linux-arm64.tar.xz"
cp -r node-v$NODE_VERSION-linux-arm64/* usr/

# Create Claude Code installation script
echo "📝 Creating Claude Code installation script..."
cat > opt/install-claude-code.sh << 'CLAUDE_EOF'
#!/bin/sh
# Install Claude Code in BusyBox VM

echo "🔧 Installing Claude Code..."

# Set up Node.js path
export PATH="/usr/bin:$PATH"

# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

echo "✅ Claude Code installed!"
echo "Run 'claude' to use Claude Code"
CLAUDE_EOF

chmod +x opt/install-claude-code.sh

# Create enhanced init script
echo "📝 Creating enhanced init script..."
cat > init << 'INIT_EOF'
#!/bin/sh
# Enhanced BusyBox init script with VSCode Server

echo "🚀 BusyBox VM Starting..."
echo "========================="

# Mount essential filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev

# Set up networking
ifconfig lo 127.0.0.1 up

# Set up Node.js path
export PATH="/usr/bin:$PATH"

# Install Claude Code
echo "🔧 Installing Claude Code..."
cd /opt
./install-claude-code.sh

# Start OpenVSCode Server
echo "🔧 Starting OpenVSCode Server..."
cd /opt/openvscode-server
./bin/openvscode-server --host 0.0.0.0 --port 8080 --without-connection-token &

# Keep system running
echo "✅ System ready!"
echo "🌐 VSCode Server: http://localhost:8080"
echo "🤖 Claude Code: Run 'claude' command"
exec /bin/sh
INIT_EOF

chmod +x init

# Create new initrd
echo "📦 Creating new initrd..."
find . | cpio -o -H newc | gzip > ../initrd.gz
cd ..

# Create VM launch script
echo "🚀 Creating VM launch script..."
cat > launch.sh << 'LAUNCH_EOF'
#!/bin/bash
# Launch Working BusyBox VM

echo "🚀 Launching Working BusyBox VM"
echo "==============================="

# Create logs directory
mkdir -p logs

# Launch VM with optimized settings
vfkit \
    --kernel vmlinux \
    --kernel-cmdline "console=hvc0 quiet nohz=on rcu_nocbs=0-3 isolcpus=0-3 init=/init" \
    --initrd initrd.gz \
    --cpus 4 \
    --memory 1024 \
    --device "virtio-net,nat,mac=52:54:00:12:34:65" \
    --device "virtio-serial,logFilePath=logs/console.log" \
    --device "virtio-rng" \
    --device "virtio-vsock,port=1024,socketURL=unix://vsock.sock" \
    --gui
LAUNCH_EOF

chmod +x launch.sh

echo "✅ Working BusyBox VM setup complete!"
echo ""
echo "📋 VM Features:"
echo "• BusyBox utilities"
echo "• OpenVSCode Server v1.105.1"
echo "• Node.js v24.12.0"
echo "• Claude Code CLI"
echo "• Optimized kernel"
echo ""
echo "🚀 To start: ./launch.sh"
echo "🌐 VSCode Server: http://localhost:8080"
echo "🤖 Claude Code: Run 'claude' command in VM"
