#!/bin/bash
# Option 1: Fresh Ubuntu 24.04 base initramfs
set -e

echo "=== Option 1: Building fresh Ubuntu 24.04 initramfs ==="

WORKDIR=/tmp/ubuntu24-initramfs
rm -rf $WORKDIR
mkdir -p $WORKDIR
cd $WORKDIR

# Download Ubuntu 24.04 base
echo "Downloading Ubuntu 24.04 base..."
curl -L -o base.tar.gz "http://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release/ubuntu-base-24.04.1-base-arm64.tar.gz"

echo "Extracting..."
mkdir rootfs
cd rootfs
tar -xzf ../base.tar.gz

# Copy our services
echo "Copying services..."
cp -r /tmp/glibc-check/bin/valkey-server bin/ 2>/dev/null || true
cp -r /tmp/glibc-check/opt/openvscode opt/ 2>/dev/null || true
mkdir -p etc/dropbear usr/bin usr/sbin

# Install PostgreSQL via chroot would need qemu - skip for now
# Instead copy binaries
cp /tmp/glibc-check/usr/bin/postgres usr/bin/ 2>/dev/null || true
cp /tmp/glibc-check/usr/bin/initdb usr/bin/ 2>/dev/null || true

# Copy kernel modules
cp -r /tmp/glibc-check/lib/modules lib/ 2>/dev/null || true

# Create init
cat > init << 'EOF'
#!/bin/sh
exec /sbin/init
EOF
chmod +x init

echo "Building initramfs..."
find . -print0 | cpio --null -ov --format=newc 2>/dev/null | gzip -9 > /Users/ryan.maclean/vibecode-webgui/azure/unified-services-ubuntu24.cpio.gz

echo "✅ Option 1 complete"
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/unified-services-ubuntu24.cpio.gz


