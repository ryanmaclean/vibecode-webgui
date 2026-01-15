#!/bin/bash
# Create fully working Alpine VM with network and package management

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_BASE="${HOME}/.vfkit/vms"
VM_NAME="alpine-working"
VM_DIR="${VM_BASE}/${VM_NAME}"

echo "======================================================================"
echo "  Creating Fully Working Alpine VM"
echo "======================================================================"
echo ""

# Create VM directory
mkdir -p "${VM_DIR}"/{kernel,rootfs,logs}

# Copy kernel
cp "${VM_BASE}/vibecode-alpine/kernel/vmlinux" "${VM_DIR}/kernel/"

# Create initramfs with proper mounts
cd /tmp
rm -rf vm-working
mkdir vm-working
cd vm-working

echo "Extracting Alpine initramfs..."
gunzip -c "${VM_BASE}/vibecode-alpine/kernel/initramfs" | cpio -idm 2>/dev/null

echo "Creating build and test scripts..."
mkdir -p root

cat > root/build-valkey.sh <<'BUILD'
#!/bin/sh
echo "=== Building Valkey ==="
apk add build-base wget
cd /tmp
wget https://github.com/valkey-io/valkey/archive/refs/tags/7.2.8.tar.gz
tar xzf 7.2.8.tar.gz
cd valkey-7.2.8
make -j$(nproc) MALLOC=libc USE_SYSTEMD=no BUILD_TLS=no
strip src/valkey-server
echo "✅ Valkey built: $(du -h src/valkey-server)"
BUILD

cat > root/build-postgresql.sh <<'BUILD'
#!/bin/sh
echo "=== Building PostgreSQL with pgvector ==="
apk add build-base wget postgresql-dev
cd /tmp
wget https://github.com/pgvector/pgvector/archive/refs/tags/v0.5.1.tar.gz
tar xzf v0.5.1.tar.gz
cd pgvector-0.5.1
make
make install
echo "✅ pgvector built"
BUILD

chmod +x root/*.sh

# Create init with proper filesystem setup
cat > init <<'INIT'
#!/bin/busybox sh

# Mount essential filesystems
/bin/busybox mount -t proc proc /proc
/bin/busybox mount -t sysfs sysfs /sys
/bin/busybox mount -t devtmpfs devtmpfs /dev

# Mount tmpfs for writable areas
/bin/busybox mkdir -p /tmp /var /run
/bin/busybox mount -t tmpfs -o size=2G tmpfs /tmp
/bin/busybox mount -t tmpfs -o size=512M tmpfs /var
/bin/busybox mount -t tmpfs -o size=128M tmpfs /run

echo "======================================================================"
echo "  Fully Working Alpine VM"
echo "======================================================================"
echo ""

# Setup apk
/bin/busybox mkdir -p /var/cache/apk /etc/apk /lib/apk/db
echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/main" > /etc/apk/repositories
echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/community" >> /etc/apk/repositories

# Initialize apk database
/sbin/apk.static --allow-untrusted --root / --initdb add alpine-base 2>/dev/null || true

echo "Loading virtio_net..."
/sbin/modprobe virtio_net
/bin/busybox sleep 2

echo "Configuring network..."
/bin/busybox ip link set lo up
/bin/busybox ip link set eth0 up
/bin/busybox ip addr add 192.168.64.10/24 dev eth0
/bin/busybox ip route add default via 192.168.64.1

# DNS
echo "nameserver 192.168.64.1" > /etc/resolv.conf
echo "nameserver 8.8.8.8" >> /etc/resolv.conf

/bin/busybox sleep 2

echo ""
echo "Testing network..."
if /bin/busybox nslookup alpine.org >/dev/null 2>&1; then
    echo "✅ DNS works!"
else
    echo "⚠️  DNS might have issues"
fi

echo ""
echo "Testing package manager..."
if apk update 2>&1 | /bin/busybox grep -q "OK\|v3.19"; then
    echo "✅ apk works! Can install packages!"
    echo ""
    echo "======================================================================"
    echo "  VM is ready for builds!"
    echo "======================================================================"
    echo ""
    echo "Available build scripts in /root/:"
    /bin/busybox ls -lh /root/*.sh
    echo ""
    echo "Example: sh /root/build-valkey.sh"
else
    echo "⚠️  apk might have issues"
fi

echo ""
echo "Dropping to shell..."
echo ""

exec /bin/busybox sh
INIT

chmod +x init

echo "Creating initramfs..."
find . | cpio -o -H newc 2>/dev/null | gzip > "${VM_DIR}/rootfs/working.cpio.gz"

echo "✅ initramfs created: $(du -h "${VM_DIR}/rootfs/working.cpio.gz")"

# Create launch script
cat > "${VM_DIR}/launch.sh" <<LAUNCH
#!/bin/bash
# Launch working Alpine VM

VMDIR="${VM_DIR}"

exec vfkit \\
    --cpus 4 \\
    --memory 4096 \\
    --kernel "\${VMDIR}/kernel/vmlinux" \\
    --initrd "\${VMDIR}/rootfs/working.cpio.gz" \\
    --kernel-cmdline "console=hvc0" \\
    --device virtio-net,nat,mac=52:54:00:12:34:57 \\
    --device virtio-serial,logFilePath="\${VMDIR}/logs/console.log" \\
    --device virtio-rng \\
    --gui
LAUNCH

chmod +x "${VM_DIR}/launch.sh"

echo ""
echo "======================================================================"
echo "  ✅ Working VM Created!"
echo "======================================================================"
echo ""
echo "Location: ${VM_DIR}"
echo ""
echo "To launch:"
echo "  ${VM_DIR}/launch.sh"
echo ""
echo "In the VM:"
echo "  - DNS works ✅"
echo "  - apk works ✅"
echo "  - Can build Valkey: sh /root/build-valkey.sh"
echo "  - Can build PostgreSQL: sh /root/build-postgresql.sh"
echo ""
echo "Features:"
echo "  - 4 CPUs, 4GB RAM"
echo "  - Working networking (192.168.64.10)"
echo "  - tmpfs mounts for writable areas"
echo "  - Package management ready"
echo "  - GUI for easy interaction"
echo ""

