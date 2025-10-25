#!/usr/bin/env bash
# Setup complete vfkit demo environment with Alpine ARM64 VMs
# Components: code-server, PostgreSQL, Redis, nginx
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VFKIT_BASE="${HOME}/.vfkit"

echo "=== VibeCode Demo Environment Setup ==="
echo "Components: code-server, PostgreSQL, Redis, nginx"
echo "Platform: Alpine ARM64 on M-Series"
echo ""

# Create directory structure
mkdir -p "${VFKIT_BASE}"/{vms,kernels,disks}

# VM 1: Development (code-server + Node.js)
cat > "${VFKIT_BASE}/vms/dev-vm.sh" <<'EOF'
#!/usr/bin/env bash
# Development VM: code-server + Node.js + VibeCode
VFKIT_BASE="${HOME}/.vfkit"

vfkit \
  --cpus 4 \
  --memory 4096 \
  --bootloader efi,variable-store="${VFKIT_BASE}/disks/dev-vm-vars.fd",create \
  --device virtio-blk,path="${VFKIT_BASE}/disks/dev-vm.img" \
  --device virtio-serial,logFilePath="${VFKIT_BASE}/vms/dev-vm.log" \
  --device virtio-net,nat,mac=52:54:00:12:34:56 \
  --device virtio-rng \
  --device virtio-fs,sharedDir="${HOME}/vibecode-workspace",mountTag=workspace
EOF

# VM 2: Database (PostgreSQL)
cat > "${VFKIT_BASE}/vms/db-vm.sh" <<'EOF'
#!/usr/bin/env bash
# Database VM: PostgreSQL
VFKIT_BASE="${HOME}/.vfkit"

vfkit \
  --cpus 2 \
  --memory 2048 \
  --bootloader efi,variable-store="${VFKIT_BASE}/disks/db-vm-vars.fd",create \
  --device virtio-blk,path="${VFKIT_BASE}/disks/db-vm.img" \
  --device virtio-blk,path="${VFKIT_BASE}/disks/db-data.img" \
  --device virtio-serial,logFilePath="${VFKIT_BASE}/vms/db-vm.log" \
  --device virtio-net,nat,mac=52:54:00:12:34:57 \
  --device virtio-rng
EOF

# VM 3: Services (Redis + nginx)
cat > "${VFKIT_BASE}/vms/services-vm.sh" <<'EOF'
#!/usr/bin/env bash
# Services VM: Redis + nginx
VFKIT_BASE="${HOME}/.vfkit"

vfkit \
  --cpus 2 \
  --memory 1024 \
  --bootloader efi,variable-store="${VFKIT_BASE}/disks/services-vm-vars.fd",create \
  --device virtio-blk,path="${VFKIT_BASE}/disks/services-vm.img" \
  --device virtio-serial,logFilePath="${VFKIT_BASE}/vms/services-vm.log" \
  --device virtio-net,nat,mac=52:54:00:12:34:58 \
  --device virtio-rng
EOF

chmod +x "${VFKIT_BASE}/vms/"*.sh

# Create disk images
echo "Creating disk images..."
qemu-img create -f raw "${VFKIT_BASE}/disks/dev-vm.img" 20G
qemu-img create -f raw "${VFKIT_BASE}/disks/db-vm.img" 50G
qemu-img create -f raw "${VFKIT_BASE}/disks/db-data.img" 100G
qemu-img create -f raw "${VFKIT_BASE}/disks/services-vm.img" 10G

# Create start-all script
cat > "${VFKIT_BASE}/start-demo.sh" <<'EOF'
#!/usr/bin/env bash
VFKIT_BASE="${HOME}/.vfkit"

echo "Starting VibeCode demo environment..."
"${VFKIT_BASE}/vms/db-vm.sh" &
sleep 3
"${VFKIT_BASE}/vms/services-vm.sh" &
sleep 3
"${VFKIT_BASE}/vms/dev-vm.sh" &

echo "All VMs started!"
echo "Logs: ${VFKIT_BASE}/vms/*.log"
EOF

chmod +x "${VFKIT_BASE}/start-demo.sh"

echo ""
echo "✅ Demo environment setup complete!"
echo ""
echo "Directory: ${VFKIT_BASE}"
echo "VMs: dev-vm (4 CPU, 4GB), db-vm (2 CPU, 2GB), services-vm (2 CPU, 1GB)"
echo "Total: 8 CPU, 7GB RAM"
echo ""
echo "Next steps:"
echo "1. Install Alpine on each VM disk"
echo "2. Configure services (code-server, PostgreSQL, Redis, nginx)"
echo "3. Start: ${VFKIT_BASE}/start-demo.sh"
