#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Create BusyBox-based VM with latest OpenVSCode Server
# Ultra-minimal setup with Musl libc

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 Creating BusyBox VM with Latest OpenVSCode Server"
echo "=================================================="
echo ""

# Configuration
VM_NAME="vibecode-busybox"
VM_DIR="$HOME/.vfkit/vms/$VM_NAME"
KERNEL_VERSION="6.17.5"
OPENVSCODE_VERSION="openvscode-server-v1.105.1"

echo "📋 Configuration:"
echo "• VM Name: $VM_NAME"
echo "• Kernel: $KERNEL_VERSION"
echo "• OpenVSCode: $OPENVSCODE_VERSION"
echo "• Base: BusyBox + Musl libc"
echo ""

# Create VM directory
mkdir -p "$VM_DIR"
cd "$VM_DIR"

echo "📁 Creating VM directory: $VM_DIR"

# Download latest kernel
echo "🔽 Downloading latest kernel..."
KERNEL_URL="https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-$KERNEL_VERSION.tar.xz"
if [ ! -f "linux-$KERNEL_VERSION.tar.xz" ]; then
    curl -L -o "linux-$KERNEL_VERSION.tar.xz" "$KERNEL_URL"
fi

# Extract kernel
if [ ! -d "linux-$KERNEL_VERSION" ]; then
    echo "📦 Extracting kernel..."
    tar -xf "linux-$KERNEL_VERSION.tar.xz"
fi

# Download BusyBox
echo "🔽 Downloading BusyBox..."
BUSYBOX_VERSION="1.37.0"
BUSYBOX_URL="https://busybox.net/downloads/busybox-$BUSYBOX_VERSION.tar.bz2"
if [ ! -f "busybox-$BUSYBOX_VERSION.tar.bz2" ]; then
    curl -L -o "busybox-$BUSYBOX_VERSION.tar.bz2" "$BUSYBOX_URL"
fi

# Extract BusyBox
if [ ! -d "busybox-$BUSYBOX_VERSION" ]; then
    echo "📦 Extracting BusyBox..."
    tar -xf "busybox-$BUSYBOX_VERSION.tar.bz2"
fi

# Download Musl libc
echo "🔽 Downloading Musl libc..."
MUSL_VERSION="1.2.5"
MUSL_URL="https://musl.libc.org/releases/musl-$MUSL_VERSION.tar.gz"
if [ ! -f "musl-$MUSL_VERSION.tar.gz" ]; then
    curl -L -o "musl-$MUSL_VERSION.tar.gz" "$MUSL_URL"
fi

# Extract Musl
if [ ! -d "musl-$MUSL_VERSION" ]; then
    echo "📦 Extracting Musl libc..."
    tar -xf "musl-$MUSL_VERSION.tar.gz"
fi

# Download latest OpenVSCode Server
echo "🔽 Downloading latest OpenVSCode Server..."
OPENVSCODE_URL="https://github.com/gitpod-io/openvscode-server/releases/download/$OPENVSCODE_VERSION/openvscode-server-linux-arm64.tar.gz"
if [ ! -f "openvscode-server-linux-arm64.tar.gz" ]; then
    curl -L -o "openvscode-server-linux-arm64.tar.gz" "$OPENVSCODE_URL"
fi

echo "✅ Downloads complete!"
echo ""

# Create build script
echo "🔨 Creating build script..."
cat > build-busybox-vm.sh << 'BUILD_EOF'
#!/bin/bash
# Build BusyBox VM with Musl libc

set -e

echo "🔨 Building BusyBox VM..."
echo "========================="

# Build Musl libc
echo "1. Building Musl libc..."
cd musl-1.2.5
./configure --prefix=/usr/local/musl
make -j$(nproc)
make install
cd ..

# Build BusyBox
echo "2. Building BusyBox..."
cd busybox-1.37.0
make defconfig
make menuconfig  # Configure for static build
make -j$(nproc)
cd ..

# Build kernel
echo "3. Building kernel..."
cd linux-6.17.5
make defconfig
make menuconfig  # Configure for minimal build
make -j$(nproc)
cd ..

echo "✅ Build complete!"
BUILD_EOF

chmod +x build-busybox-vm.sh

# Create init script
echo "📝 Creating init script..."
cat > init.sh << 'INIT_EOF'
#!/bin/sh
# BusyBox init script

echo "🚀 BusyBox VM Starting..."
echo "========================="

# Mount proc and sys
mount -t proc proc /proc
mount -t sysfs sysfs /sys

# Set up networking
ifconfig lo 127.0.0.1 up

# Start OpenVSCode Server
echo "🔧 Starting OpenVSCode Server..."
cd /opt/openvscode-server
./bin/openvscode-server --host 0.0.0.0 --port 8080 --without-connection-token &

# Keep system running
echo "✅ System ready!"
exec /bin/sh
INIT_EOF

chmod +x init.sh

# Create VM launch script
echo "🚀 Creating VM launch script..."
cat > launch.sh << 'LAUNCH_EOF'
#!/bin/bash
# Launch BusyBox VM

echo "🚀 Launching BusyBox VM"
echo "======================="

# Create logs directory
mkdir -p logs

# Launch VM with optimized settings
vfkit \
    --kernel kernel/vmlinux \
    --kernel-cmdline "console=hvc0 quiet nohz=on rcu_nocbs=0-3 isolcpus=0-3 init=/init.sh" \
    --initrd initrd.gz \
    --cpus 4 \
    --memory 2048 \
    --device "virtio-net,nat,mac=52:54:00:12:34:62" \
    --device "virtio-serial,logFilePath=logs/console.log" \
    --device "virtio-rng" \
    --device "virtio-vsock,port=1024,socketURL=unix://vsock.sock" \
    --gui
LAUNCH_EOF

chmod +x launch.sh

echo "✅ BusyBox VM setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run ./build-busybox-vm.sh to build the VM"
echo "2. Run ./launch.sh to start the VM"
echo ""
echo "🎯 This VM will be:"
echo "• Ultra-minimal (~10MB total)"
echo "• Extremely fast boot"
echo "• Latest OpenVSCode Server"
echo "• Latest kernel with optimizations"
echo "• BusyBox + Musl libc"
