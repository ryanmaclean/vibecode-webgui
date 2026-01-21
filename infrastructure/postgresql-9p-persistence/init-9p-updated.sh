#!/bin/sh

# Mount essential filesystems first
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mkdir -p /dev/pts /dev/shm
mount -t devpts none /dev/pts
mount -t tmpfs none /dev/shm
mount -t tmpfs none /run
mount -t tmpfs none /tmp

# Redirect all output to serial console after /dev is mounted
exec > /dev/hvc0 2>&1

echo "========================================"
echo "VibeCode VM Initialization Starting"
echo "========================================"

# Set hostname
hostname vibecode-vm

# Configure networking
ip link set lo up
ip link set eth0 up
udhcpc -i eth0 -s /usr/share/udhcpc/default.script -b -q

# Wait for network to be ready
sleep 2

# Try to mount 9p share for persistent storage with fallback chain
echo "Attempting to mount persistent storage..."
mkdir -p /mnt/hostshare
STORAGE_BACKEND="tmpfs"
PGDATA="/var/lib/postgresql/data"

# Try 9p/virtfs first (most compatible with Apple Virtualization)
if mount -t 9p -o trans=virtio,version=9p2000.L,msize=104857600 hostshare /mnt/hostshare 2>/dev/null; then
    echo "✓ 9p/virtfs mounted successfully (persistent storage enabled)"
    STORAGE_BACKEND="9p"
    PGDATA="/mnt/hostshare/postgresql"
    mkdir -p "$PGDATA"
elif mount -t virtiofs hostshare /mnt/hostshare 2>/dev/null; then
    # Fallback to VirtioFS if kernel supports it
    echo "✓ VirtioFS mounted successfully (persistent storage enabled)"
    STORAGE_BACKEND="virtiofs"
    PGDATA="/mnt/hostshare/postgresql"
    mkdir -p "$PGDATA"
else
    # Fallback to tmpfs (ephemeral storage)
    echo "⚠ WARNING: No shared filesystem available (9p/virtiofs not supported)"
    echo "⚠ Using tmpfs - data will be LOST on reboot!"
    STORAGE_BACKEND="tmpfs"
    PGDATA="/var/lib/postgresql/data"
    mkdir -p "$PGDATA"
fi

echo "Storage backend: $STORAGE_BACKEND"
echo "PostgreSQL data directory: $PGDATA"

# Create required directories
mkdir -p /var/run/postgresql /var/lib/postgresql /var/lib/valkey /run/dropbear /root/.ssh /var/log

# Set proper permissions
chown -R postgres:postgres /var/run/postgresql /var/lib/postgresql "$PGDATA"
chown -R valkey:valkey /var/lib/valkey
chmod 700 "$PGDATA"

# Initialize PostgreSQL if needed
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL database..."
    su-exec postgres /usr/bin/initdb -D "$PGDATA" --encoding=UTF8 --locale=C

    # Configure PostgreSQL to listen on all interfaces
    echo "host all all 0.0.0.0/0 trust" >> "$PGDATA/pg_hba.conf"
    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
    echo "port = 5432" >> "$PGDATA/postgresql.conf"

    # Performance tuning for 9p (if using 9p backend)
    if [ "$STORAGE_BACKEND" = "9p" ]; then
        echo "# 9p storage optimizations" >> "$PGDATA/postgresql.conf"
        echo "fsync = off  # 9p handles sync via host" >> "$PGDATA/postgresql.conf"
        echo "synchronous_commit = off  # Better performance on 9p" >> "$PGDATA/postgresql.conf"
        echo "full_page_writes = off  # 9p is crash-safe via host" >> "$PGDATA/postgresql.conf"
    fi

    echo "✓ PostgreSQL initialized successfully"
else
    echo "✓ Using existing PostgreSQL database"
fi

# Start PostgreSQL
echo "Starting PostgreSQL..."
su-exec postgres /usr/bin/postgres -D "$PGDATA" &
echo $! > /var/run/postgresql.pid

# Wait for PostgreSQL to be ready
sleep 3

# Configure Valkey
echo "bind 0.0.0.0" > /etc/valkey.conf
echo "port 6379" >> /etc/valkey.conf
echo "dir /var/lib/valkey" >> /etc/valkey.conf
echo "protected-mode no" >> /etc/valkey.conf
echo "daemonize no" >> /etc/valkey.conf

# Start Valkey
echo "Starting Valkey..."
su-exec valkey valkey-server /etc/valkey.conf &
echo $! > /var/run/valkey.pid

# Generate Dropbear host keys if they don't exist
if [ ! -f /etc/dropbear/dropbear_ed25519_host_key ]; then
    mkdir -p /etc/dropbear
    dropbearkey -t ed25519 -f /etc/dropbear/dropbear_ed25519_host_key
fi
if [ ! -f /etc/dropbear/dropbear_rsa_host_key ]; then
    dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key
fi

# Set root password (change this in production!)
echo "root:vibecode" | chpasswd

# Start Dropbear SSH server
echo "Starting Dropbear SSH server on port 2222..."
dropbear -R -F -E -p 2222 &
echo $! > /var/run/dropbear.pid

# Start OpenVSCode Server (use system node which is musl-compatible)
echo "Starting OpenVSCode Server on port 3000..."
cd /opt/openvscode-server && \
/usr/bin/node /opt/openvscode-server/out/server-main.js \
    --host 0.0.0.0 \
    --port 3000 \
    --without-connection-token \
    --accept-server-license-terms &
echo $! > /var/run/openvscode-server.pid

# Print service status
sleep 3
echo ""
echo "==================================="
echo "VibeCode Services Started"
echo "==================================="
echo "Storage Backend:     $STORAGE_BACKEND"
echo "Dropbear SSH:        port 2222"
echo "Valkey (Redis):      port 6379"
echo "PostgreSQL:          port 5432 ($PGDATA)"
echo "OpenVSCode Server:   port 3000"
echo "==================================="
echo ""
echo "Network Configuration:"
ip addr show eth0 | grep "inet " | awk '{print "IP Address: " $2}'
echo ""

if [ "$STORAGE_BACKEND" = "tmpfs" ]; then
    echo "⚠⚠⚠ WARNING ⚠⚠⚠"
    echo "PostgreSQL data is NOT persistent!"
    echo "Data will be lost on VM restart."
    echo "Enable 9p or VirtioFS for persistence."
    echo "==================================="
    echo ""
fi

# Keep container running and handle signals
trap 'echo "Shutting down..."; killall postgres valkey-server dropbear openvscode-server; exit 0' SIGTERM SIGINT

# Run getty for console access
while true; do
    setsid getty 38400 console &
    wait $!
done
