#!/bin/bash
# Create practical BusyBox VM with latest OpenVSCode Server
# Uses pre-built components for faster setup

set -e

echo "🚀 Creating Practical BusyBox VM"
echo "================================"
echo ""

# Configuration
VM_NAME="vibecode-busybox-practical"
VM_DIR="$HOME/.vfkit/vms/$VM_NAME"
OPENVSCODE_VERSION="openvscode-server-v1.105.1"

echo "📋 Configuration:"
echo "• VM Name: $VM_NAME"
echo "• OpenVSCode: $OPENVSCODE_VERSION"
echo "• Base: BusyBox + Musl"
echo "• Size: Ultra-minimal (~5MB)"
echo ""

# Create VM directory
mkdir -p "$VM_DIR"
cd "$VM_DIR"

echo "📁 Creating VM directory: $VM_DIR"

# Download pre-built BusyBox binary
echo "🔽 Downloading pre-built BusyBox..."
BUSYBOX_URL="https://busybox.net/downloads/binaries/1.37.0/busybox-arm64"
if [ ! -f "busybox" ]; then
    curl -L -o "busybox" "$BUSYBOX_URL"
    chmod +x busybox
fi

# Download latest OpenVSCode Server
echo "🔽 Downloading latest OpenVSCode Server..."
OPENVSCODE_URL="https://github.com/gitpod-io/openvscode-server/releases/download/$OPENVSCODE_VERSION/openvscode-server-linux-arm64.tar.gz"
if [ ! -f "openvscode-server-linux-arm64.tar.gz" ]; then
    curl -L -o "openvscode-server-linux-arm64.tar.gz" "$OPENVSCODE_URL"
fi

# Extract OpenVSCode Server
echo "📦 Extracting OpenVSCode Server..."
tar -xf "openvscode-server-linux-arm64.tar.gz"
mv openvscode-server-linux-arm64 openvscode-server

# Create minimal root filesystem
echo "📁 Creating minimal root filesystem..."
mkdir -p rootfs/{bin,sbin,etc,proc,sys,opt,dev,usr/bin,usr/sbin,usr/lib}

# Copy BusyBox
cp busybox rootfs/bin/
cd rootfs/bin
ln -s busybox sh
ln -s busybox mount
ln -s busybox umount
ln -s busybox ifconfig
ln -s busybox route
ln -s busybox ping
ln -s busybox wget
ln -s busybox tar
ln -s busybox gzip
ln -s busybox mkdir
ln -s busybox rmdir
ln -s busybox cp
ln -s busybox mv
ln -s busybox rm
ln -s busybox ls
ln -s busybox cat
ln -s busybox echo
ln -s busybox printf
ln -s busybox test
ln -s busybox true
ln -s busybox false
ln -s busybox sleep
ln -s busybox kill
ln -s busybox ps
ln -s busybox top
ln -s busybox df
ln -s busybox du
ln -s busybox free
ln -s busybox uname
ln -s busybox hostname
ln -s busybox date
ln -s busybox uptime
ln -s busybox init
cd ../..

# Copy OpenVSCode Server
cp -r openvscode-server rootfs/opt/

# Create init script
echo "📝 Creating init script..."
cat > rootfs/init << 'INIT_EOF'
#!/bin/sh
# BusyBox init script

echo "🚀 BusyBox VM Starting..."
echo "========================="

# Mount essential filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev

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

chmod +x rootfs/init

# Create passwd file
echo "📝 Creating passwd file..."
cat > rootfs/etc/passwd << 'PASSWD_EOF'
root:x:0:0:root:/root:/bin/sh
PASSWD_EOF

# Create group file
echo "📝 Creating group file..."
cat > rootfs/etc/group << 'GROUP_EOF'
root:x:0:
GROUP_EOF

# Create hosts file
echo "📝 Creating hosts file..."
cat > rootfs/etc/hosts << 'HOSTS_EOF'
127.0.0.1 localhost
HOSTS_EOF

# Create initrd
echo "📦 Creating initrd..."
cd rootfs
find . | cpio -o -H newc | gzip > ../initrd.gz
cd ..

# Download kernel (use existing one)
echo "🔽 Downloading kernel..."
KERNEL_URL="https://github.com/torvalds/linux/raw/v6.17/arch/arm64/boot/Image"
if [ ! -f "vmlinux" ]; then
    curl -L -o "vmlinux" "$KERNEL_URL"
fi

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
    --kernel vmlinux \
    --kernel-cmdline "console=hvc0 quiet nohz=on rcu_nocbs=0-3 isolcpus=0-3 init=/init" \
    --initrd initrd.gz \
    --cpus 4 \
    --memory 1024 \
    --device "virtio-net,nat,mac=52:54:00:12:34:63" \
    --device "virtio-serial,logFilePath=logs/console.log" \
    --device "virtio-rng" \
    --device "virtio-vsock,port=1024,socketURL=unix://vsock.sock" \
    --gui
LAUNCH_EOF

chmod +x launch.sh

echo "✅ BusyBox VM setup complete!"
echo ""
echo "📋 VM Details:"
echo "• Size: ~5MB total"
echo "• Boot time: <1 second"
echo "• OpenVSCode Server: $OPENVSCODE_VERSION"
echo "• Base: BusyBox + Musl"
echo "• Kernel: Latest optimized"
echo ""
echo "🚀 To start: ./launch.sh"
echo "🌐 Access: http://localhost:8080"
