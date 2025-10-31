#!/usr/bin/env bash
# Create PROPER disk-based Alpine VMs with persistent filesystems
# This approach installs Alpine to disk, then adds build scripts

set -euo pipefail

VM_BASE="${HOME}/.vfkit/vms"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ALPINE_ISO="${VM_BASE}/alpine-virt-3.19.0-aarch64.iso"

echo "======================================================================"
echo "  Creating Disk-Based Alpine VMs for Service Builds"
echo "======================================================================"
echo ""
echo "Approach: Install Alpine to disk, then run build scripts"
echo "This ensures:"
echo "  ✅ Working networking (OpenRC)"
echo "  ✅ Package management (apk)"
echo "  ✅ Persistent storage"
echo "  ✅ Service persistence"
echo ""

# Check if Alpine ISO exists
if [[ ! -f "$ALPINE_ISO" ]]; then
    echo "📥 Downloading Alpine ISO..."
    cd "$(dirname "$ALPINE_ISO")"
    "${SCRIPT_DIR}/02-download-alpine-kernel.sh"
fi

# Function to create a disk-based VM
create_disk_vm() {
    local vm_name=$1
    local cpus=$2
    local memory=$3
    local disk_size=$4
    
    echo ""
    echo "======================================================================"
    echo "  Creating ${vm_name} VM"
    echo "======================================================================"
    echo ""
    
    local vm_dir="${VM_BASE}/disk-${vm_name}"
    mkdir -p "${vm_dir}/disk" "${vm_dir}/logs"
    
    # Create disk image
    local disk_img="${vm_dir}/disk/alpine.img"
    if [[ ! -f "$disk_img" ]]; then
        echo "Creating ${disk_size} disk image..."
        dd if=/dev/zero of="$disk_img" bs=1m count=$((disk_size * 1024)) 2>/dev/null || \
        dd if=/dev/zero of="$disk_img" bs=1M count=$((disk_size * 1024)) 2>/dev/null
        echo "✅ Disk created"
    fi
    
    # Create cloud-init user-data for auto-installation
    local user_data="${vm_dir}/user-data.txt"
    cat > "$user_data" <<USERDATA
#cloud-config
hostname: ${vm_name}
manage_etc_hosts: true

users:
  - name: root
    lock_passwd: false
    plain_text_passwd: 'alpine'

runcmd:
  - |
    # Setup networking
    setup-interfaces -a
    rc-service networking start
    
    # Basic Alpine setup
    setup-apkrepos -f
    apk update
    apk add bash curl wget aria2
    
    echo "✅ ${vm_name} VM ready for builds!"
USERDATA
    
    # Create launch script
    cat > "${vm_dir}/launch.sh" <<LAUNCH
#!/usr/bin/env bash
# Launch ${vm_name} VM

exec vfkit \\
    --cpus ${cpus} \\
    --memory ${memory} \\
    --bootloader efi,variable-store=${vm_dir}/efi-vars.fd,create \\
    --device virtio-blk,path=${disk_img} \\
    --device virtio-blk,path=${ALPINE_ISO},devName=cdrom \\
    --device virtio-net,nat,mac=52:54:00:12:34:$(printf '%02x' $((RANDOM % 256))) \\
    --device virtio-serial,logFilePath=${vm_dir}/logs/console.log \\
    --device virtio-rng
LAUNCH
    
    chmod +x "${vm_dir}/launch.sh"
    
    echo "✅ ${vm_name} VM created"
    echo "   Disk: ${disk_size} GB"
    echo "   CPUs: ${cpus}"
    echo "   RAM: ${memory} MB"
    echo "   Launch: ${vm_dir}/launch.sh"
}

# Create VMs
create_disk_vm "valkey" 2 1024 10
create_disk_vm "postgresql" 2 2048 15
create_disk_vm "openvscode" 4 4096 20

echo ""
echo "======================================================================"
echo "  VMs Created - Manual Setup Required"
echo "======================================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Launch each VM:"
echo "   ~/.vfkit/vms/disk-valkey/launch.sh &"
echo "   ~/.vfkit/vms/disk-postgresql/launch.sh &"
echo "   ~/.vfkit/vms/disk-openvscode/launch.sh &"
echo ""
echo "2. Access console (in another terminal):"
echo "   tail -f ~/.vfkit/vms/disk-valkey/logs/console.log"
echo ""
echo "3. Login as root (password: alpine)"
echo ""
echo "4. Run setup-alpine to install to disk:"
echo "   setup-alpine"
echo "   - Keyboard: us"
echo "   - Hostname: valkey (or postgresql/openvscode)"
echo "   - Network: dhcp"
echo "   - Root password: (set one)"
echo "   - Timezone: UTC"
echo "   - Proxy: none"
echo "   - Mirror: 1 (auto)"
echo "   - SSH: openssh"
echo "   - Disk: sda (sys mode)"
echo ""
echo "5. Reboot and remove ISO from launch script"
echo ""
echo "6. Copy and run build scripts!"
echo ""

echo "======================================================================"
echo "  Alternative: Use Docker Instead!"
echo "======================================================================"
echo ""
echo "For faster iteration, consider using Docker to build the services:"
echo ""
echo "  docker build -t valkey-musl -f Dockerfile.valkey ."
echo "  docker build -t postgres-pgvector -f Dockerfile.postgres ."
echo "  docker build -t openvscode-rag -f Dockerfile.openvscode ."
echo ""
echo "Then export to tar and run in minimal Alpine containers."
echo ""

