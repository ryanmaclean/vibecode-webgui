#!/bin/sh
# VibeCode Alpine VM initialization script
# This replaces the init script in the rootfs for VibeCode development

# Mount filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mkdir -p /dev/pts
mount -t devpts devpts /dev/pts
mount -t tmpfs tmpfs /tmp

# Set hostname
hostname -F /etc/hostname

# Configure networking (if virtio-net available)
if [ -d /sys/class/net/eth0 ]; then
    ip link set eth0 up
    udhcpc -i eth0 -f -q &
fi

# Mount VibeCode shared directory via virtiofs
echo "Mounting VibeCode shared directory..."
mkdir -p /mnt/vibecode
if mount -t virtiofs vibecode /mnt/vibecode 2>/dev/null; then
    echo "✅ VibeCode directory mounted at /mnt/vibecode"
else
    echo "⚠️  Failed to mount virtiofs share 'vibecode'"
    echo "   Ensure the VM was launched with virtio-fs device"
fi

# Display welcome message
cat << 'EOF'

==========================================
  VibeCode Alpine ARM64 Development VM
==========================================

Alpine Linux with Node.js, PostgreSQL, Redis
Optimized for Apple Silicon / ARM64

Quick Commands:
  node --version         - Check Node.js
  npm --version          - Check npm
  start-services         - Start PostgreSQL & Redis
  stop-services          - Stop all services
  supervisorctl status   - Check service status

Project Directory:
  /mnt/vibecode          - Shared with host

Setup Services:
  Run: /mnt/vibecode/scripts/vfkit/vm-setup-services.sh

==========================================

EOF

# Run startup scripts if any
if [ -d /etc/init.d ]; then
    for script in /etc/init.d/S*; do
        if [ -x "$script" ]; then
            $script start
        fi
    done
fi

# Start shell
exec /bin/sh
