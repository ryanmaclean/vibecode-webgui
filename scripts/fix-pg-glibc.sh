#!/bin/bash
set -e

cd /tmp/ubuntu24-libs
rm -f *.deb *.tar* debian-binary control.tar*

echo "=== Downloading Ubuntu 24.04 libs ==="

# Get correct URLs
curl -L -o libsystemd.deb "http://ports.ubuntu.com/pool/main/s/systemd/libsystemd0_255.4-1ubuntu8.4_arm64.deb"
curl -L -o libp11kit.deb "http://ports.ubuntu.com/pool/main/p/p11-kit/libp11-kit0_0.25.3-4ubuntu2_arm64.deb"
curl -L -o libtasn1.deb "http://ports.ubuntu.com/pool/main/libt/libtasn1-6/libtasn1-6_4.19.0-3build1_arm64.deb"
curl -L -o libsasl2.deb "http://ports.ubuntu.com/pool/main/c/cyrus-sasl2/libsasl2-2_2.1.28+dfsg1-3ubuntu1_arm64.deb"
curl -L -o libldap.deb "http://ports.ubuntu.com/pool/main/o/openldap/libldap-2.5-0_2.5.18+dfsg-0ubuntu0.24.04.1_arm64.deb"
curl -L -o liblber.deb "http://ports.ubuntu.com/pool/main/o/openldap/liblber-2.5-0_2.5.18+dfsg-0ubuntu0.24.04.1_arm64.deb"

echo "=== Checking downloads ==="
ls -la *.deb
for f in *.deb; do
    file "$f"
done

echo "=== Extracting libs ==="
mkdir -p extracted
cd extracted
for deb in ../*.deb; do
    echo "Extracting $deb..."
    ar x "$deb" 2>/dev/null || continue
    if [ -f data.tar.zst ]; then
        zstd -d -f data.tar.zst
        tar -xf data.tar
    elif [ -f data.tar.xz ]; then
        xz -d -f data.tar.xz
        tar -xf data.tar
    elif [ -f data.tar.gz ]; then
        tar -xzf data.tar.gz
    fi
    rm -f data.tar* control.tar* debian-binary
done

echo "=== Found libs ==="
find . -name "*.so*" | head -20

echo "=== Copying to initramfs ==="
find . -name "*.so*" -exec cp -v {} /tmp/glibc-check/usr/lib/aarch64-linux-gnu/ \; 2>/dev/null || true

echo "=== Updating init script ==="
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
if [ -f /usr/bin/postgres ]; then
    /usr/bin/postgres --version 2>&1 || echo "postgres version check failed"
    id postgres >/dev/null 2>&1 || adduser -D -H -s /bin/sh postgres 2>/dev/null || true
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql 2>/dev/null || true
    chmod 777 /run/postgresql
    
    if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
        echo "Initializing DB..."
        su postgres -c "/usr/bin/initdb -D /var/lib/postgresql/data" 2>&1 | tail -3
        echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf
        echo "listen_addresses = '*'" >> /var/lib/postgresql/data/postgresql.conf
    fi
    
    su postgres -c "/usr/bin/postgres -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
    sleep 3
    ps | grep -v grep | grep -q "postgres" && echo "PostgreSQL OK on port 5432" || { echo "PostgreSQL FAIL"; cat /tmp/postgresql.log | head -10; }
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

echo "=== Rebuilding initramfs ==="
cd /tmp/glibc-check
find . -print0 | cpio --null -ov --format=newc 2>/dev/null | gzip -9 > /Users/ryan.maclean/vibecode-webgui/azure/unified-services-glibc-fixed.cpio.gz

echo "✅ Done! Rebuilt initramfs with glibc 2.39"
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/unified-services-glibc-fixed.cpio.gz
