#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Option 3: Use statically compiled PostgreSQL

# Initialize log aggregation
init_log_aggregation

set -e

echo "=== Option 3: Statically compiled PostgreSQL ==="

WORKDIR=/tmp/static-pg
rm -rf $WORKDIR
mkdir -p $WORKDIR
cd $WORKDIR

# Try to get a statically compiled PostgreSQL or build one
# First, check if there's a pre-built static version available

echo "Checking for Alpine PostgreSQL (musl-based, more portable)..."

# Download Alpine's PostgreSQL which uses musl (same as our valkey)
curl -L -o postgresql.apk "https://dl-cdn.alpinelinux.org/alpine/v3.19/main/aarch64/postgresql16-16.6-r0.apk"
curl -L -o postgresql-client.apk "https://dl-cdn.alpinelinux.org/alpine/v3.19/main/aarch64/postgresql16-client-16.6-r0.apk"

echo "Checking downloads..."
ls -la *.apk
file *.apk

echo "Extracting..."
mkdir -p extracted
cd extracted

for apk in ../*.apk; do
    echo "Processing $apk..."
    tar -xzf "$apk" 2>/dev/null || true
done

echo "Found binaries:"
find . -name "postgres*" -o -name "initdb" | head -10

echo "Checking binary type..."
find . -name "postgres" -exec file {} \;

# Copy to initramfs
echo "Copying to initramfs..."
find . -name "postgres" -exec cp {} /tmp/glibc-check/usr/bin/postgres-alpine \; 2>/dev/null || true
find . -name "initdb" -exec cp {} /tmp/glibc-check/usr/bin/initdb-alpine \; 2>/dev/null || true

# Also copy Alpine's PostgreSQL libs
find . -name "libpq*" -exec cp {} /tmp/glibc-check/lib/ \; 2>/dev/null || true

# Update init to try alpine postgres first
cat > /tmp/glibc-check/init << 'INITEOF'
#!/bin/busybox sh
echo "=== Booting Unified Services VM ==="

/bin/busybox --install -s /bin

mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
mkdir -p /tmp && mount -t tmpfs tmp /tmp

insmod /lib/modules/5.15.0-161-generic/kernel/net/core/failover.ko 2>/dev/null || true
insmod /lib/modules/5.15.0-161-generic/kernel/drivers/net/net_failover.ko 2>/dev/null || true
insmod /lib/modules/5.15.0-161-generic/kernel/drivers/net/virtio_net.ko 2>/dev/null || true
sleep 2

mkdir -p /etc /var/log /home /etc/dropbear /root /var/lib/postgresql/data /run/postgresql
echo "127.0.0.1 localhost" > /etc/hosts
hostname unified-vm
chmod 700 /var/lib/postgresql/data

mknod -m 666 /dev/null c 1 3 2>/dev/null || true
mknod -m 666 /dev/zero c 1 5 2>/dev/null || true
mknod -m 666 /dev/random c 1 8 2>/dev/null || true
mknod -m 666 /dev/urandom c 1 9 2>/dev/null || true

echo ""
echo "=== Network ==="
ip link set lo up

FOUND_IFACE=""
for iface in eth0 eth1 enp0s1 enp0s5; do
    ip link show "$iface" >/dev/null 2>&1 && FOUND_IFACE="$iface" && break
done
[ -z "$FOUND_IFACE" ] && sleep 2 && for iface in eth0 eth1 enp0s1 enp0s5; do
    ip link show "$iface" >/dev/null 2>&1 && FOUND_IFACE="$iface" && break
done

VM_IP="localhost"
if [ -n "$FOUND_IFACE" ]; then
    echo "Interface: $FOUND_IFACE"
    ip link set "$FOUND_IFACE" up
    sleep 1
    udhcpc -i "$FOUND_IFACE" -s /etc/udhcpc.script -n -q 2>&1
    sleep 1
    VM_IP=$(ip addr show "$FOUND_IFACE" 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    echo "IP: $VM_IP"
fi
echo ""

export LD_LIBRARY_PATH=/lib:/lib/aarch64-linux-gnu:/usr/lib:/usr/lib/aarch64-linux-gnu
export HOME=/root
export PS1='unified-vm# '

echo "=== Valkey ==="
/bin/valkey-server --bind 0.0.0.0 --port 6379 --daemonize no > /tmp/valkey.log 2>&1 &
sleep 2
ps | grep -v grep | grep -q valkey && echo "Valkey OK on port 6379" || { echo "Valkey FAIL"; cat /tmp/valkey.log | head -5; }
echo ""

echo "=== PostgreSQL ==="
# Try Alpine postgres first (musl-based)
POSTGRES_BIN=""
if [ -f /usr/bin/postgres-alpine ]; then
    /usr/bin/postgres-alpine --version 2>&1 && POSTGRES_BIN="/usr/bin/postgres-alpine"
fi
# Fall back to glibc postgres
if [ -z "$POSTGRES_BIN" ] && [ -f /usr/bin/postgres ]; then
    /usr/bin/postgres --version 2>&1 && POSTGRES_BIN="/usr/bin/postgres"
fi

if [ -n "$POSTGRES_BIN" ]; then
    echo "Using: $POSTGRES_BIN"
    id postgres >/dev/null 2>&1 || adduser -D -H -s /bin/sh postgres 2>/dev/null || true
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql 2>/dev/null || true
    chmod 777 /run/postgresql
    
    INITDB_BIN=$(echo $POSTGRES_BIN | sed 's/postgres/initdb/')
    if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
        echo "Initializing DB..."
        su postgres -c "$INITDB_BIN -D /var/lib/postgresql/data" 2>&1 | tail -3
        echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf
        echo "listen_addresses = '*'" >> /var/lib/postgresql/data/postgresql.conf
    fi
    
    su postgres -c "$POSTGRES_BIN -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
    sleep 3
    ps | grep -v grep | grep -q "postgres" && echo "PostgreSQL OK on port 5432" || { echo "PostgreSQL FAIL"; cat /tmp/postgresql.log | head -10; }
else
    echo "PostgreSQL not available"
fi
echo ""

echo "=== OpenVSCode ==="
mkdir -p /tmp/vscode-data
cd /opt/openvscode
./bin/openvscode-server --host 0.0.0.0 --port 8080 --without-connection-token --accept-server-license-terms --user-data-dir /tmp/vscode-data > /tmp/openvscode.log 2>&1 &
sleep 3
ps | grep -v grep | grep -q "node" && echo "OpenVSCode OK at http://$VM_IP:8080" || { echo "OpenVSCode FAIL"; cat /tmp/openvscode.log | head -5; }
echo ""

echo "========================================="
echo "  Services: Valkey:6379 PostgreSQL:5432 OpenVSCode:8080"
echo "  IP: $VM_IP"
echo "========================================="

while true; do /bin/sh -i 2>&1; sleep 1; done
INITEOF
chmod +x /tmp/glibc-check/init

echo "Rebuilding initramfs..."
cd /tmp/glibc-check
find . -print0 | cpio --null -ov --format=newc 2>/dev/null | gzip -9 > /Users/ryan.maclean/vibecode-webgui/azure/unified-services-alpine-pg.cpio.gz

echo "✅ Option 3 complete"
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/unified-services-alpine-pg.cpio.gz


