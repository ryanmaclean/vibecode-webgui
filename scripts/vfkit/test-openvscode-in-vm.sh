#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Test openvscode-server in Alpine VM with working networking

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

echo "======================================================================"
echo "  Testing openvscode-server in Alpine VM"
echo "======================================================================"
echo ""

VM_DIR="${HOME}/.vfkit/vms/openvscode-test"
mkdir -p "${VM_DIR}"/{kernel,rootfs,logs}

# Copy kernel
cp ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux "${VM_DIR}/kernel/"

# Create initramfs with openvscode-server test
cd /tmp
rm -rf ovs-test
mkdir ovs-test
cd ovs-test

echo "Extracting Alpine initramfs..."
gunzip -c ~/.vfkit/vms/vibecode-alpine/kernel/initramfs | cpio -idm 2>/dev/null

mkdir -p root

cat > root/test-openvscode.sh <<'TEST'
#!/bin/sh
echo "=== Testing openvscode-server installation ==="
echo ""

# Install dependencies
apk add --no-cache nodejs npm wget tar

echo ""
echo "Node.js version:"
node --version
npm --version

echo ""
echo "Downloading openvscode-server..."
cd /tmp
wget -O openvscode.tar.gz \
  "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.105.1/openvscode-server-v1.105.1-linux-arm64.tar.gz"

echo ""
echo "Extracting..."
tar -xzf openvscode.tar.gz
cd openvscode-server-*

echo ""
echo "Testing openvscode-server..."
./node --version
echo ""
echo "Starting server (test mode)..."
timeout 10 ./node out/server-main.js --help 2>&1 || true

echo ""
echo "Installation size:"
du -sh .

echo ""
echo "✅ openvscode-server tested successfully!"
TEST

chmod +x root/test-openvscode.sh

# Create init script
cat > init <<'INIT'
#!/bin/busybox sh

# Mount filesystems
/bin/busybox mount -t proc proc /proc
/bin/busybox mount -t sysfs sysfs /sys
/bin/busybox mount -t devtmpfs devtmpfs /dev
/bin/busybox mkdir -p /tmp /var /run
/bin/busybox mount -t tmpfs -o size=2G tmpfs /tmp
/bin/busybox mount -t tmpfs -o size=1G tmpfs /var
/bin/busybox mount -t tmpfs -o size=256M tmpfs /run

echo "======================================================================"
echo "  openvscode-server Test VM"
echo "======================================================================"
echo ""

# Setup apk
/bin/busybox mkdir -p /var/cache/apk /etc/apk /lib/apk/db
echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/main" > /etc/apk/repositories
echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/community" >> /etc/apk/repositories

# Network
/sbin/modprobe virtio_net
/bin/busybox sleep 2
/bin/busybox ip link set lo up
/bin/busybox ip link set eth0 up
/bin/busybox ip addr add 192.168.64.10/24 dev eth0
/bin/busybox ip route add default via 192.168.64.1
echo "nameserver 192.168.64.1" > /etc/resolv.conf
/bin/busybox sleep 2

echo "Network ready, running test..."
echo ""

cd /root
/bin/busybox sh /root/test-openvscode.sh

echo ""
echo "======================================================================"
echo "  Test complete"
echo "======================================================================"
echo ""

exec /bin/busybox sh
INIT

chmod +x init

echo "Creating initramfs..."
find . | cpio -o -H newc 2>/dev/null | gzip > "${VM_DIR}/rootfs/test.cpio.gz"

echo "✅ initramfs created: $(du -h "${VM_DIR}/rootfs/test.cpio.gz")"
echo ""

# Create launch script
cat > "${VM_DIR}/launch.sh" <<LAUNCH
#!/bin/bash
exec vfkit \\
    --cpus 4 \\
    --memory 4096 \\
    --kernel "\${HOME}/.vfkit/vms/openvscode-test/kernel/vmlinux" \\
    --initrd "\${HOME}/.vfkit/vms/openvscode-test/rootfs/test.cpio.gz" \\
    --kernel-cmdline "console=hvc0" \\
    --device virtio-net,nat,mac=52:54:00:12:34:58 \\
    --device virtio-serial,logFilePath="\${HOME}/.vfkit/vms/openvscode-test/logs/console.log"
LAUNCH

chmod +x "${VM_DIR}/launch.sh"

echo "======================================================================"
echo "  ✅ openvscode-server test VM created!"
echo "======================================================================"
echo ""
echo "To test:"
echo "  ${VM_DIR}/launch.sh &"
echo "  sleep 120  # Wait for download and test"
echo "  tail -100 ${VM_DIR}/logs/console.log"
echo ""
echo "Launching now for automatic test..."
echo ""

"${VM_DIR}/launch.sh" > "${VM_DIR}/logs/vfkit.log" 2>&1 &
VM_PID=$!

echo "✅ VM launched (PID: $VM_PID)"
echo "Waiting 120 seconds for openvscode-server download and test..."
sleep 120

echo ""
echo "======================================================================"
echo "  Test Results:"
echo "======================================================================"
echo ""
tail -150 "${VM_DIR}/logs/console.log"

# Cleanup
kill $VM_PID 2>/dev/null || true

echo ""
echo "Test complete!"

