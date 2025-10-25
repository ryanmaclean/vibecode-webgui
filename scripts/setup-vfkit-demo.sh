#!/usr/bin/env bash
# Setup vfkit-based VibeCode demo environment
# Alpine ARM64 VMs on M-Series hardware
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VFKIT_DIR="/opt/vibecode"

echo "=== VibeCode vfkit Demo Setup ==="
echo "Platform: M-Series (ARM64)"
echo "VMs: Alpine Linux minimal"
echo ""

# Check if running on M-Series
if [[ "$(uname -m)" != "arm64" ]]; then
  echo "❌ Error: This script requires Apple Silicon (ARM64)"
  exit 1
fi

# Check for vfkit
if ! command -v vfkit &> /dev/null; then
  echo "Installing vfkit..."
  brew install vfkit
fi

# Create directory structure
echo "Creating directory structure..."
sudo mkdir -p "${VFKIT_DIR}"/{kernels,initrd,disks,configs}
sudo chown -R "$(whoami)" "${VFKIT_DIR}"

# Download Alpine ARM64 kernel and initramfs
echo "Downloading Alpine ARM64 kernel..."
ALPINE_VERSION="3.19"
ALPINE_KERNEL_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/aarch64/alpine-virt-${ALPINE_VERSION}.1-aarch64.iso"

if [[ ! -f "${VFKIT_DIR}/kernels/alpine-arm64-virt" ]]; then
  curl -L "${ALPINE_KERNEL_URL}" -o /tmp/alpine.iso
  
  # Extract kernel and initramfs from ISO
  # (This is simplified - actual extraction would mount ISO and copy files)
  echo "⚠️  Manual step required:"
  echo "  1. Download Alpine virt ISO from: ${ALPINE_KERNEL_URL}"
  echo "  2. Mount ISO and extract:"
  echo "     - boot/vmlinuz-virt -> ${VFKIT_DIR}/kernels/alpine-arm64-virt"
  echo "     - boot/initramfs-virt -> ${VFKIT_DIR}/initrd/alpine-arm64-initramfs"
  echo ""
  echo "Or use pre-built kernel from Alpine repository"
fi

# Create base disk images
echo "Creating VM disk images..."
for vm in dev db services; do
  if [[ ! -f "${VFKIT_DIR}/disks/${vm}-vm.img" ]]; then
    echo "  Creating ${vm}-vm.img..."
    case "${vm}" in
      dev)
        qemu-img create -f raw "${VFKIT_DIR}/disks/${vm}-vm.img" 20G
        ;;
      db)
        qemu-img create -f raw "${VFKIT_DIR}/disks/${vm}-vm.img" 50G
        qemu-img create -f raw "${VFKIT_DIR}/disks/db-data.img" 100G
        ;;
      services)
        qemu-img create -f raw "${VFKIT_DIR}/disks/${vm}-vm.img" 10G
        ;;
    esac
  fi
done

# Copy vfkit configs
echo "Installing vfkit configurations..."
cp "${REPO_ROOT}/config/vfkit/"*.yaml "${VFKIT_DIR}/configs/"

# Create startup script
cat > "${VFKIT_DIR}/start-demo.sh" <<'EOF'
#!/usr/bin/env bash
# Start VibeCode demo VMs
set -euo pipefail

VFKIT_DIR="/opt/vibecode"

echo "=== Starting VibeCode Demo Environment ==="
echo ""

# Start PostgreSQL VM
echo "Starting PostgreSQL VM..."
vfkit --config "${VFKIT_DIR}/configs/demo-postgresql.yaml" &
PIDS[0]=$!
sleep 5

# Start Services VM (Redis + nginx)
echo "Starting Services VM..."
vfkit --config "${VFKIT_DIR}/configs/demo-services.yaml" &
PIDS[1]=$!
sleep 5

# Start Development VM (code-server)
echo "Starting Development VM..."
vfkit --config "${VFKIT_DIR}/configs/demo-code-server.yaml" &
PIDS[2]=$!

echo ""
echo "✅ All VMs started!"
echo ""
echo "Services available:"
echo "  code-server: http://localhost:8080 (password: vibecode)"
echo "  PostgreSQL:  localhost:5432 (user: vibecode, password: vibecode)"
echo "  Redis:       localhost:6379"
echo "  nginx:       http://localhost:80"
echo ""
echo "VM PIDs: ${PIDS[@]}"
echo "To stop: kill ${PIDS[@]}"
echo ""
echo "Monitor logs:"
echo "  tail -f /opt/vibecode/logs/*.log"
EOF

chmod +x "${VFKIT_DIR}/start-demo.sh"

# Create stop script
cat > "${VFKIT_DIR}/stop-demo.sh" <<'EOF'
#!/usr/bin/env bash
# Stop VibeCode demo VMs
set -euo pipefail

echo "Stopping VibeCode demo VMs..."
pkill -f "vfkit.*vibecode" || true
echo "✅ All VMs stopped"
EOF

chmod +x "${VFKIT_DIR}/stop-demo.sh"

# Create monitoring script
cat > "${VFKIT_DIR}/monitor-demo.sh" <<'EOF'
#!/usr/bin/env bash
# Monitor VibeCode demo VMs
set -euo pipefail

echo "=== VibeCode Demo Status ==="
echo ""

# Check VM processes
echo "VM Processes:"
ps aux | grep -E "[v]fkit.*vibecode" || echo "  No VMs running"
echo ""

# Check services
echo "Service Health:"
curl -s http://localhost:80/health && echo "  ✅ nginx: healthy" || echo "  ❌ nginx: down"
redis-cli -h localhost ping &>/dev/null && echo "  ✅ Redis: healthy" || echo "  ❌ Redis: down"
pg_isready -h localhost -p 5432 &>/dev/null && echo "  ✅ PostgreSQL: healthy" || echo "  ❌ PostgreSQL: down"
curl -s http://localhost:8080 &>/dev/null && echo "  ✅ code-server: healthy" || echo "  ❌ code-server: down"
echo ""

# Resource usage
echo "Resource Usage:"
echo "  Memory: $(ps aux | grep -E "[v]fkit" | awk '{sum+=$6} END {print sum/1024 " MB"}')"
echo "  CPU: $(ps aux | grep -E "[v]fkit" | awk '{sum+=$3} END {print sum "%"}')"
EOF

chmod +x "${VFKIT_DIR}/monitor-demo.sh"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Directory structure:"
echo "  ${VFKIT_DIR}/"
echo "    ├── kernels/        # Alpine ARM64 kernels"
echo "    ├── initrd/         # Alpine initramfs"
echo "    ├── disks/          # VM disk images"
echo "    ├── configs/        # vfkit YAML configs"
echo "    ├── start-demo.sh   # Start all VMs"
echo "    ├── stop-demo.sh    # Stop all VMs"
echo "    └── monitor-demo.sh # Monitor VM status"
echo ""
echo "Next steps:"
echo "  1. Download Alpine kernel and initramfs (see instructions above)"
echo "  2. Start demo: ${VFKIT_DIR}/start-demo.sh"
echo "  3. Monitor: ${VFKIT_DIR}/monitor-demo.sh"
echo ""
echo "VM Configuration:"
echo "  - Development VM: 4 CPU, 4GB RAM, 20GB disk"
echo "  - Database VM: 2 CPU, 2GB RAM, 50GB+100GB disks"
echo "  - Services VM: 2 CPU, 1GB RAM, 10GB disk"
echo "  Total: 8 CPU, 7GB RAM (of 24 CPU, 64GB available)"
echo ""
echo "M-Series Optimization:"
echo "  - Native ARM64 (no emulation)"
echo "  - Alpine Linux (minimal footprint)"
echo "  - vfkit (Apple Virtualization framework)"
echo "  - Fast boot times (<5s per VM)"
