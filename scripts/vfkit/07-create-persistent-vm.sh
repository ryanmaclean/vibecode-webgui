#!/usr/bin/env bash
# Create a persistent Alpine installation on disk for VibeCode
# This allows full package installation and proper virtiofs support

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
KERNEL_DIR="${VM_DIR}/kernel"
DISK_DIR="${VM_DIR}/disk"

DISK_IMAGE="${DISK_DIR}/alpine-system.img"
DISK_SIZE="20G"

echo "=== Creating Persistent Alpine VM Disk ==="
echo ""

# Create disk directory
mkdir -p "${DISK_DIR}"

if [[ -f "$DISK_IMAGE" ]]; then
    echo "⚠️  Disk image already exists: $DISK_IMAGE"
    read -p "Delete and recreate? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted"
        exit 1
    fi
    rm -f "$DISK_IMAGE"
fi

echo "📀 Creating ${DISK_SIZE} disk image..."
if command -v qemu-img &> /dev/null; then
    qemu-img create -f raw "$DISK_IMAGE" "$DISK_SIZE"
else
    # Fallback: create sparse file
    dd if=/dev/zero of="$DISK_IMAGE" bs=1M count=0 seek=20480 2>/dev/null
fi

echo "✅ Created: $DISK_IMAGE"
echo ""

echo "=== Next Steps ==="
echo ""
echo "1. Boot Alpine installer:"
echo "   Use 04-launch-alpine-vm.sh to boot from ISO/initramfs"
echo ""
echo "2. In the VM, run Alpine setup:"
echo "   setup-alpine"
echo "   - Choose keyboard layout"
echo "   - Set hostname: vibecode-alpine"
echo "   - Initialize network: dhcp"
echo "   - Set root password"
echo "   - Set timezone"
echo "   - Install to disk: /dev/vda (sys mode)"
echo ""
echo "3. After installation, update launch script to boot from disk"
echo ""
echo "Alternative: Use pre-configured approach"
echo "This creates an Alpine cloud-init disk with:"
echo "  - Automatic virtiofs kernel module loading"
echo "  - Pre-installed packages (postgres, redis, build tools)"
echo "  - Auto-mount of /mnt/vibecode"
echo ""

# Ask if user wants to create cloud-init config
read -p "Create cloud-init configuration for automated setup? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Skipping cloud-init setup"
    exit 0
fi

echo ""
echo "📝 Creating cloud-init configuration..."

# Create cloud-init directory
CLOUD_INIT_DIR="${VM_DIR}/cloud-init"
mkdir -p "${CLOUD_INIT_DIR}"

# Create meta-data
cat > "${CLOUD_INIT_DIR}/meta-data" << 'EOF'
instance-id: vibecode-alpine-001
local-hostname: vibecode-alpine
EOF

# Create user-data with full setup
cat > "${CLOUD_INIT_DIR}/user-data" << 'EOF'
#cloud-config

# Hostname
hostname: vibecode-alpine
fqdn: vibecode-alpine.local

# Users
users:
  - name: vibecode
    gecos: VibeCode Developer
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    groups: wheel
    ssh_authorized_keys:
      - ssh-rsa REPLACE_WITH_YOUR_SSH_KEY

# Root password (disabled by default for security)
chpasswd:
  expire: false

# Package installation
packages:
  - bash
  - git
  - curl
  - wget
  - build-base
  - nodejs
  - npm
  - postgresql
  - postgresql-dev
  - postgresql-contrib
  - redis
  - python3
  - python3-dev
  - py3-pip
  - supervisor
  - ca-certificates
  - openssl

# Run commands on first boot
runcmd:
  # Load virtiofs module
  - modprobe virtiofs || true

  # Create mount point
  - mkdir -p /mnt/vibecode

  # Mount virtiofs share
  - mount -t virtiofs vibecode /mnt/vibecode || echo "Failed to mount virtiofs"

  # Add to fstab for persistence
  - echo "vibecode /mnt/vibecode virtiofs defaults 0 0" >> /etc/fstab

  # Initialize PostgreSQL
  - rc-service postgresql setup
  - rc-update add postgresql default
  - rc-service postgresql start

  # Configure PostgreSQL
  - su postgres -c "createdb vibecode"
  - su postgres -c "createuser vibecode"

  # Start Redis
  - rc-update add redis default
  - rc-service redis start

  # Create startup script
  - |
    cat > /usr/local/bin/start-vibecode << 'SCRIPT'
    #!/bin/bash
    cd /mnt/vibecode
    npm install
    npm run build
    npm start
    SCRIPT
  - chmod +x /usr/local/bin/start-vibecode

write_files:
  - path: /etc/motd
    content: |
      ==========================================
        VibeCode Alpine ARM64 Development VM
      ==========================================

      Project: /mnt/vibecode
      Services: PostgreSQL (5432), Redis (6379)

      Quick Start:
        cd /mnt/vibecode
        npm install
        npm run build
        npm start

      ==========================================

  - path: /etc/postgresql/postgresql.conf
    content: |
      listen_addresses = '*'
      port = 5432
      max_connections = 100
    append: true

  - path: /etc/redis.conf
    content: |
      bind 0.0.0.0
      port 6379
      protected-mode no

power_state:
  mode: reboot
  message: Initial setup complete, rebooting...
  timeout: 30
EOF

echo "✅ Cloud-init configuration created"
echo ""
echo "Files created:"
echo "  - ${CLOUD_INIT_DIR}/meta-data"
echo "  - ${CLOUD_INIT_DIR}/user-data"
echo ""
echo "⚠️  Note: Cloud-init requires Alpine Linux cloud image"
echo "    Regular Alpine ISO doesn't include cloud-init"
echo ""
echo "Alternative approach:"
echo "  Use scripts/vfkit/08-setup-from-iso.sh for manual installation"
echo ""
