#!/usr/bin/env bash
# Build ALL 4 VMs for VibeCode
# 1. Valkey VM (port 6379)
# 2. PostgreSQL VM (port 5432)
# 3. PostgreSQL + pgvector VM (port 5433)
# 4. Node.js Dev VM (port 3000)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VFKIT_BINARY="$PROJECT_ROOT/src-tauri/resources/vfkit-aarch64-apple-darwin"
VM_BASE="${HOME}/.vfkit/vms"
KERNEL_BASE="${VM_BASE}/vibecode-alpine/kernel"

echo "======================================================================"
echo "  Building ALL 4 VMs for VibeCode with vfkit"
echo "======================================================================"
echo ""
echo "Target VMs:"
echo "  1. Valkey (port 6379) - 1GB RAM"
echo "  2. PostgreSQL (port 5432) - 2GB RAM"
echo "  3. PostgreSQL + pgvector (port 5433) - 8GB RAM"
echo "  4. Node.js Dev (port 3000) - 4GB RAM"
echo ""
echo "Estimated time: 2-3 hours for all 4 VMs"
echo ""

# Check vfkit exists
if [[ ! -x "$VFKIT_BINARY" ]]; then
    echo "❌ vfkit not found: $VFKIT_BINARY"
    exit 1
fi

echo "✅ vfkit found: $VFKIT_BINARY"

# Check kernel exists
KERNEL="${KERNEL_BASE}/vmlinux"
INITRAMFS="${KERNEL_BASE}/initramfs"

if [[ ! -f "$KERNEL" ]]; then
    echo "❌ Kernel not found: $KERNEL"
    echo "Run: ./02-download-alpine-kernel.sh"
    exit 1
fi

echo "✅ Kernel: $KERNEL ($(du -h "$KERNEL" | cut -f1))"
echo "✅ Initramfs: $INITRAMFS ($(du -h "$INITRAMFS" | cut -f1))"
echo ""

# ============================================================================
# PHASE 1: Build Valkey VM
# ============================================================================

echo "======================================================================"
echo "  PHASE 1: Building Valkey VM"
echo "======================================================================"
echo ""

VM_NAME="vibecode-valkey"
VM_DIR="${VM_BASE}/${VM_NAME}"
mkdir -p "${VM_DIR}"/{kernel,rootfs,disk,logs}

# Copy kernel
cp "$KERNEL" "${VM_DIR}/kernel/"
echo "✅ Kernel copied"

# Create Valkey-specific initramfs
echo "📦 Creating Valkey initramfs..."
WORK_DIR="/tmp/valkey-rootfs-$$"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Extract base Alpine initramfs
gunzip -c "$INITRAMFS" | cpio -idm 2>/dev/null
echo "✅ Base initramfs extracted"

# Ensure root directory exists
mkdir -p root

# Create Valkey build and run script
cat > root/start-valkey.sh <<'EOF'
#!/bin/sh
set -e

echo "=== Valkey VM Starting ==="

# Mount essential filesystems
/bin/busybox mount -t proc proc /proc
/bin/busybox mount -t sysfs sysfs /sys
/bin/busybox mount -t devtmpfs devtmpfs /dev
/bin/busybox mkdir -p /tmp /var /run
/bin/busybox mount -t tmpfs -o size=512M tmpfs /tmp
/bin/busybox mount -t tmpfs -o size=256M tmpfs /var

# Configure networking
echo "Configuring network..."
/sbin/ip link set lo up 2>/dev/null || /bin/busybox ifconfig lo up
/sbin/ip link set eth0 up 2>/dev/null || /bin/busybox ifconfig eth0 up
/sbin/udhcpc -i eth0 -n -q 2>/dev/null || /bin/busybox udhcpc -i eth0 -n -q

# Install Valkey
echo "Installing Valkey..."
apk add --no-cache --initdb valkey || {
    echo "⚠️  Valkey package not in repos, building from source..."
    apk add --no-cache --initdb build-base wget
    cd /tmp
    wget -q https://github.com/valkey-io/valkey/archive/refs/tags/8.1.0.tar.gz
    tar xzf 8.1.0.tar.gz
    cd valkey-8.1.0
    make -j$(nproc) MALLOC=libc USE_SYSTEMD=no BUILD_TLS=no
    cp src/valkey-server /usr/local/bin/
    cp src/valkey-cli /usr/local/bin/
    cd /
    rm -rf /tmp/valkey-*
}

# Configure Valkey
mkdir -p /var/lib/valkey /var/log/valkey
cat > /etc/valkey.conf <<VCONF
bind 0.0.0.0
port 6379
protected-mode no
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
dir /var/lib/valkey
logfile /var/log/valkey/valkey.log
VCONF

# Start Valkey
echo "Starting Valkey on port 6379..."
valkey-server /etc/valkey.conf --daemonize yes

echo "✅ Valkey VM ready on port 6379"
echo "Keeping VM alive..."

# Keep alive
while true; do
    sleep 60
    valkey-cli ping > /dev/null 2>&1 || {
        echo "Valkey died, restarting..."
        valkey-server /etc/valkey.conf --daemonize yes
    }
done
EOF

chmod +x root/start-valkey.sh

# Modify init to run our script
cat > init <<'INITEOF'
#!/bin/busybox sh
exec /root/start-valkey.sh
INITEOF

chmod +x init

# Pack new initramfs
echo "Packing Valkey initramfs..."
find . | cpio -o -H newc 2>/dev/null | gzip -9 > "${VM_DIR}/rootfs/valkey-rootfs.cpio.gz"
echo "✅ Valkey initramfs created: $(du -h "${VM_DIR}/rootfs/valkey-rootfs.cpio.gz" | cut -f1)"

# Create launch script
cat > "${VM_DIR}/launch.sh" <<LAUNCH
#!/usr/bin/env bash
set -euo pipefail

echo "Starting Valkey VM..."

"${VFKIT_BINARY}" \\
  --cpus 2 \\
  --memory 1024 \\
  --kernel "${VM_DIR}/kernel/vmlinux" \\
  --initrd "${VM_DIR}/rootfs/valkey-rootfs.cpio.gz" \\
  --kernel-cmdline "console=hvc0 quiet" \\
  --device "virtio-net,nat,mac=52:54:00:12:34:59" \\
  --device "virtio-serial,logFilePath=${VM_DIR}/logs/console.log" \\
  --device "virtio-rng" &

VM_PID=\$!
echo \$VM_PID > "${VM_DIR}/vm.pid"
echo "✅ Valkey VM started (PID: \$VM_PID)"
echo "Log: ${VM_DIR}/logs/console.log"
LAUNCH

chmod +x "${VM_DIR}/launch.sh"

# Clean up
cd /
rm -rf "$WORK_DIR"

echo "✅ Valkey VM ready at: ${VM_DIR}/launch.sh"
echo ""

# ============================================================================
# PHASE 2: Build PostgreSQL VM
# ============================================================================

echo "======================================================================"
echo "  PHASE 2: Building PostgreSQL VM"
echo "======================================================================"
echo ""

VM_NAME="vibecode-postgresql"
VM_DIR="${VM_BASE}/${VM_NAME}"
mkdir -p "${VM_DIR}"/{kernel,rootfs,disk,logs}

cp "$KERNEL" "${VM_DIR}/kernel/"

# Create PostgreSQL initramfs
echo "📦 Creating PostgreSQL initramfs..."
WORK_DIR="/tmp/postgresql-rootfs-$$"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

gunzip -c "$INITRAMFS" | cpio -idm 2>/dev/null
mkdir -p root

cat > root/start-postgresql.sh <<'EOF'
#!/bin/sh
set -e

echo "=== PostgreSQL VM Starting ==="

# Mount essential filesystems
/bin/busybox mount -t proc proc /proc
/bin/busybox mount -t sysfs sysfs /sys
/bin/busybox mount -t devtmpfs devtmpfs /dev
/bin/busybox mkdir -p /tmp /var /run
/bin/busybox mount -t tmpfs -o size=1G tmpfs /tmp
/bin/busybox mount -t tmpfs -o size=512M tmpfs /var

# Configure networking
/sbin/ip link set lo up 2>/dev/null || /bin/busybox ifconfig lo up
/sbin/ip link set eth0 up 2>/dev/null || /bin/busybox ifconfig eth0 up
/sbin/udhcpc -i eth0 -n -q 2>/dev/null || /bin/busybox udhcpc -i eth0 -n -q

# Install PostgreSQL
echo "Installing PostgreSQL 16..."
apk add --no-cache --initdb postgresql16 postgresql16-contrib

# Initialize database
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql
su -c "initdb -D /var/lib/postgresql/data" postgres

# Configure PostgreSQL
cat >> /var/lib/postgresql/data/postgresql.conf <<PGCONF
listen_addresses = '*'
port = 5432
max_connections = 100
shared_buffers = 512MB
PGCONF

echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf

# Start PostgreSQL
echo "Starting PostgreSQL on port 5432..."
su -c "pg_ctl -D /var/lib/postgresql/data -l /var/log/postgresql.log start" postgres

echo "✅ PostgreSQL VM ready on port 5432"

# Keep alive
while true; do
    sleep 60
done
EOF

chmod +x root/start-postgresql.sh

cat > init <<'INITEOF'
#!/bin/busybox sh
exec /root/start-postgresql.sh
INITEOF

chmod +x init

find . | cpio -o -H newc 2>/dev/null | gzip -9 > "${VM_DIR}/rootfs/postgresql-rootfs.cpio.gz"
echo "✅ PostgreSQL initramfs created"

cat > "${VM_DIR}/launch.sh" <<LAUNCH
#!/usr/bin/env bash
set -euo pipefail

echo "Starting PostgreSQL VM..."

"${VFKIT_BINARY}" \\
  --cpus 2 \\
  --memory 2048 \\
  --kernel "${VM_DIR}/kernel/vmlinux" \\
  --initrd "${VM_DIR}/rootfs/postgresql-rootfs.cpio.gz" \\
  --kernel-cmdline "console=hvc0 quiet" \\
  --device "virtio-net,nat,mac=52:54:00:12:34:60" \\
  --device "virtio-serial,logFilePath=${VM_DIR}/logs/console.log" \\
  --device "virtio-rng" &

VM_PID=\$!
echo \$VM_PID > "${VM_DIR}/vm.pid"
echo "✅ PostgreSQL VM started (PID: \$VM_PID)"
LAUNCH

chmod +x "${VM_DIR}/launch.sh"

cd /
rm -rf "$WORK_DIR"

echo "✅ PostgreSQL VM ready at: ${VM_DIR}/launch.sh"
echo ""

# ============================================================================
# PHASE 3: Build pgvector VM
# ============================================================================

echo "======================================================================"
echo "  PHASE 3: Building PostgreSQL + pgvector VM"
echo "======================================================================"
echo ""

VM_NAME="vibecode-pgvector"
VM_DIR="${VM_BASE}/${VM_NAME}"
mkdir -p "${VM_DIR}"/{kernel,rootfs,disk,logs}

cp "$KERNEL" "${VM_DIR}/kernel/"

echo "📦 Creating pgvector initramfs..."
WORK_DIR="/tmp/pgvector-rootfs-$$"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

gunzip -c "$INITRAMFS" | cpio -idm 2>/dev/null
mkdir -p root

cat > root/start-pgvector.sh <<'EOF'
#!/bin/sh
set -e

echo "=== PostgreSQL + pgvector VM Starting ==="

/bin/busybox mount -t proc proc /proc
/bin/busybox mount -t sysfs sysfs /sys
/bin/busybox mount -t devtmpfs devtmpfs /dev
/bin/busybox mkdir -p /tmp /var /run
/bin/busybox mount -t tmpfs -o size=2G tmpfs /tmp
/bin/busybox mount -t tmpfs -o size=1G tmpfs /var

/sbin/ip link set lo up 2>/dev/null || /bin/busybox ifconfig lo up
/sbin/ip link set eth0 up 2>/dev/null || /bin/busybox ifconfig eth0 up
/sbin/udhcpc -i eth0 -n -q 2>/dev/null || /bin/busybox udhcpc -i eth0 -n -q

echo "Installing PostgreSQL and pgvector..."
apk add --no-cache --initdb postgresql16 postgresql16-contrib postgresql16-dev build-base git

# Build pgvector
cd /tmp
wget -q https://github.com/pgvector/pgvector/archive/refs/tags/v0.8.0.tar.gz
tar xzf v0.8.0.tar.gz
cd pgvector-0.8.0
make -j$(nproc)
make install

mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql
su -c "initdb -D /var/lib/postgresql/data" postgres

cat >> /var/lib/postgresql/data/postgresql.conf <<PGCONF
listen_addresses = '*'
port = 5432
max_connections = 100
shared_buffers = 2GB
shared_preload_libraries = 'vector'
PGCONF

echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf

echo "Starting PostgreSQL with pgvector..."
su -c "pg_ctl -D /var/lib/postgresql/data -l /var/log/postgresql.log start" postgres

# Create extension
sleep 3
su -c "psql -c 'CREATE EXTENSION IF NOT EXISTS vector;'" postgres

echo "✅ PostgreSQL + pgvector VM ready on port 5432"

while true; do
    sleep 60
done
EOF

chmod +x root/start-pgvector.sh

cat > init <<'INITEOF'
#!/bin/busybox sh
exec /root/start-pgvector.sh
INITEOF

chmod +x init

find . | cpio -o -H newc 2>/dev/null | gzip -9 > "${VM_DIR}/rootfs/pgvector-rootfs.cpio.gz"
echo "✅ pgvector initramfs created"

cat > "${VM_DIR}/launch.sh" <<LAUNCH
#!/usr/bin/env bash
set -euo pipefail

echo "Starting pgvector VM..."

"${VFKIT_BINARY}" \\
  --cpus 4 \\
  --memory 8192 \\
  --kernel "${VM_DIR}/kernel/vmlinux" \\
  --initrd "${VM_DIR}/rootfs/pgvector-rootfs.cpio.gz" \\
  --kernel-cmdline "console=hvc0 quiet" \\
  --device "virtio-net,nat,mac=52:54:00:12:34:61" \\
  --device "virtio-serial,logFilePath=${VM_DIR}/logs/console.log" \\
  --device "virtio-rng" &

VM_PID=\$!
echo \$VM_PID > "${VM_DIR}/vm.pid"
echo "✅ pgvector VM started (PID: \$VM_PID)"
LAUNCH

chmod +x "${VM_DIR}/launch.sh"

cd /
rm -rf "$WORK_DIR"

echo "✅ pgvector VM ready at: ${VM_DIR}/launch.sh"
echo ""

# ============================================================================
# PHASE 4: Build Node.js Dev VM
# ============================================================================

echo "======================================================================"
echo "  PHASE 4: Building Node.js Dev VM"
echo "======================================================================"
echo ""

VM_NAME="vibecode-nodejs-dev"
VM_DIR="${VM_BASE}/${VM_NAME}"
mkdir -p "${VM_DIR}"/{kernel,rootfs,disk,logs}

cp "$KERNEL" "${VM_DIR}/kernel/"

echo "📦 Creating Node.js Dev initramfs..."
WORK_DIR="/tmp/nodejs-rootfs-$$"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

gunzip -c "$INITRAMFS" | cpio -idm 2>/dev/null
mkdir -p root

cat > root/start-nodejs.sh <<'EOF'
#!/bin/sh
set -e

echo "=== Node.js Dev VM Starting ==="

/bin/busybox mount -t proc proc /proc
/bin/busybox mount -t sysfs sysfs /sys
/bin/busybox mount -t devtmpfs devtmpfs /dev
/bin/busybox mkdir -p /tmp /var /run
/bin/busybox mount -t tmpfs -o size=2G tmpfs /tmp
/bin/busybox mount -t tmpfs -o size=512M tmpfs /var

/sbin/ip link set lo up 2>/dev/null || /bin/busybox ifconfig lo up
/sbin/ip link set eth0 up 2>/dev/null || /bin/busybox ifconfig eth0 up
/sbin/udhcpc -i eth0 -n -q 2>/dev/null || /bin/busybox udhcpc -i eth0 -n -q

echo "Installing Node.js and development tools..."
apk add --no-cache --initdb nodejs npm yarn git bash

echo "Versions:"
node --version
npm --version

echo "✅ Node.js Dev VM ready"
echo "Starting shell..."

while true; do
    sleep 60
done
EOF

chmod +x root/start-nodejs.sh

cat > init <<'INITEOF'
#!/bin/busybox sh
exec /root/start-nodejs.sh
INITEOF

chmod +x init

find . | cpio -o -H newc 2>/dev/null | gzip -9 > "${VM_DIR}/rootfs/nodejs-rootfs.cpio.gz"
echo "✅ Node.js initramfs created"

cat > "${VM_DIR}/launch.sh" <<LAUNCH
#!/usr/bin/env bash
set -euo pipefail

echo "Starting Node.js Dev VM..."

"${VFKIT_BINARY}" \\
  --cpus 4 \\
  --memory 4096 \\
  --kernel "${VM_DIR}/kernel/vmlinux" \\
  --initrd "${VM_DIR}/rootfs/nodejs-rootfs.cpio.gz" \\
  --kernel-cmdline "console=hvc0 quiet" \\
  --device "virtio-net,nat,mac=52:54:00:12:34:62" \\
  --device "virtio-serial,logFilePath=${VM_DIR}/logs/console.log" \\
  --device "virtio-rng" &

VM_PID=\$!
echo \$VM_PID > "${VM_DIR}/vm.pid"
echo "✅ Node.js Dev VM started (PID: \$VM_PID)"
LAUNCH

chmod +x "${VM_DIR}/launch.sh"

cd /
rm -rf "$WORK_DIR"

echo "✅ Node.js Dev VM ready at: ${VM_DIR}/launch.sh"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "======================================================================"
echo "  ✅ ALL 4 VMS BUILT SUCCESSFULLY!"
echo "======================================================================"
echo ""
echo "VM Launch Scripts Created:"
echo ""
echo "1. Valkey:      ${VM_BASE}/vibecode-valkey/launch.sh"
echo "2. PostgreSQL:  ${VM_BASE}/vibecode-postgresql/launch.sh"
echo "3. pgvector:    ${VM_BASE}/vibecode-pgvector/launch.sh"
echo "4. Node.js Dev: ${VM_BASE}/vibecode-nodejs-dev/launch.sh"
echo ""
echo "To start ALL VMs:"
echo ""
echo "  ${VM_BASE}/vibecode-valkey/launch.sh"
echo "  ${VM_BASE}/vibecode-postgresql/launch.sh"
echo "  ${VM_BASE}/vibecode-pgvector/launch.sh"
echo "  ${VM_BASE}/vibecode-nodejs-dev/launch.sh"
echo ""
echo "Or use the start-all script:"
echo ""

# Create start-all script
cat > "$SCRIPT_DIR/start-all-vms.sh" <<STARTALL
#!/usr/bin/env bash
set -euo pipefail

echo "Starting all 4 VMs..."
echo ""

${VM_BASE}/vibecode-valkey/launch.sh
${VM_BASE}/vibecode-postgresql/launch.sh
${VM_BASE}/vibecode-pgvector/launch.sh
${VM_BASE}/vibecode-nodejs-dev/launch.sh

echo ""
echo "✅ All 4 VMs started!"
echo ""
echo "Logs:"
echo "  Valkey:      tail -f ${VM_BASE}/vibecode-valkey/logs/console.log"
echo "  PostgreSQL:  tail -f ${VM_BASE}/vibecode-postgresql/logs/console.log"
echo "  pgvector:    tail -f ${VM_BASE}/vibecode-pgvector/logs/console.log"
echo "  Node.js Dev: tail -f ${VM_BASE}/vibecode-nodejs-dev/logs/console.log"
STARTALL

chmod +x "$SCRIPT_DIR/start-all-vms.sh"

echo "  $SCRIPT_DIR/start-all-vms.sh"
echo ""
echo "======================================================================"
echo "  COMPLETE!"
echo "======================================================================"

