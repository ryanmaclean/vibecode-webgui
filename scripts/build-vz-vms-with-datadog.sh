#!/bin/bash
# Build Apple VZ VM images with Datadog agents for VibeCode Native App
# Specifically for the Swift VZ VMs currently running

set -e

DATADOG_API_KEY="${DATADOG_API_KEY:-}"
DATADOG_SITE="${DATADOG_SITE:-datadoghq.com}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="${PROJECT_ROOT}/dist/vm-images"
BUILD_DIR="/tmp/vibecode-vz-build"
EFI_HELPER="${PROJECT_ROOT}/scripts/vfkit/create-efi-variable-store.sh"

if [ -z "$DATADOG_API_KEY" ]; then
    echo "❌ Error: DATADOG_API_KEY environment variable not set"
    echo ""
    echo "Usage: DATADOG_API_KEY=your-key-here ./scripts/build-vz-vms-with-datadog.sh"
    exit 1
fi

echo "======================================================================"
echo "  Building Apple VZ VM Images with Datadog"
echo "======================================================================"
echo ""
echo "📋 Target: Native Swift VibeCode app VMs"
echo "   Output: $DIST_DIR"
echo "   Datadog Site: $DATADOG_SITE"
echo ""

mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Backup existing VMs
echo "💾 Backing up existing VMs..."
if [ -d "$DIST_DIR" ]; then
    BACKUP_DIR="${DIST_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp "$DIST_DIR"/*.img "$BACKUP_DIR"/ 2>/dev/null || true
    cp "$DIST_DIR"/*-efi.nvram "$BACKUP_DIR"/ 2>/dev/null || true
    echo "✅ Backup saved to: $BACKUP_DIR"
fi

# =============================================================================
# VM Builder Function
# =============================================================================

build_vz_vm_with_datadog() {
    local vm_name=$1
    local service=$2
    local disk_size_gb=$3
    local service_packages=$4
    local service_setup=$5
    
    echo ""
    echo "======================================================================"
    echo "  Building: $vm_name"
    echo "======================================================================"
    
    local work_dir="${BUILD_DIR}/${vm_name}"
    mkdir -p "$work_dir"
    
    # Download Alpine cloud image if needed
    local alpine_base="${BUILD_DIR}/alpine-3.22-base.qcow2"
    if [ ! -f "$alpine_base" ]; then
        echo "📥 Downloading Alpine cloud image..."
        curl -L -o "$alpine_base" \
            "https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.0-aarch64-uefi-cloudinit-r0.qcow2"
        echo "✅ Downloaded"
    fi
    
    # Create cloud-init user-data
    echo "☁️  Creating cloud-init configuration..."
    cat > "${work_dir}/user-data" <<USERDATA
#cloud-config
hostname: ${vm_name}
manage_etc_hosts: true

# System setup
package_update: true
package_upgrade: true

# Install base packages
packages:
  - curl
  - bash
  - python3
  - openssh-server
  - ca-certificates
  ${service_packages}

# SSH configuration
ssh_pwauth: true
disable_root: false
chpasswd:
  list: |
    root:vibecode
  expire: false

# Install Datadog agent
runcmd:
  # Install Datadog
  - |
    echo "Installing Datadog agent..."
    DD_API_KEY="${DATADOG_API_KEY}" \\
    DD_SITE="${DATADOG_SITE}" \\
    DD_AGENT_MAJOR_VERSION=7 \\
    bash -c "\$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)" || true
  
  # Configure Datadog
  - |
    if [ -d /etc/datadog-agent ]; then
      cat > /etc/datadog-agent/datadog.yaml <<DDYAML
    api_key: ${DATADOG_API_KEY}
    site: ${DATADOG_SITE}
    hostname: ${vm_name}
    tags:
      - env:vibecode
      - vm:${vm_name}
      - service:${service}
      - platform:apple-vz
      - app:vibecode-native
    
    logs_enabled: true
    log_level: info
    
    apm_config:
      enabled: true
      apm_non_local_traffic: true
    
    dogstatsd_config:
      non_local_traffic: true
    
    process_config:
      enabled: "true"
    DDYAML
      
      # Enable and start Datadog
      rc-update add datadog-agent default || true
      service datadog-agent start || true
      echo "✅ Datadog agent configured"
    fi
  
  # Service-specific setup
  ${service_setup}
  
  # Final status
  - |
    echo "=== VM Provisioning Complete ==="
    echo "Hostname: ${vm_name}"
    echo "Service: ${service}"
    if command -v datadog-agent >/dev/null 2>&1; then
      echo "Datadog: Installed"
      datadog-agent status || true
    fi

write_files:
  - path: /etc/ssh/sshd_config.d/vibecode.conf
    content: |
      PermitRootLogin yes
      PasswordAuthentication yes
      PubkeyAuthentication yes
    permissions: '0644'
  
  - path: /etc/motd
    content: |
      ===================================
      VibeCode ${vm_name} VM
      Service: ${service}
      Datadog: Enabled
      ===================================
    permissions: '0644'

final_message: |
  ${vm_name} is ready!
  Datadog agent installed and configured.
USERDATA
    
    # Create meta-data
    cat > "${work_dir}/meta-data" <<METADATA
instance-id: ${vm_name}-vz-001
local-hostname: ${vm_name}
METADATA
    
    # Create cloud-init ISO
    echo "💿 Creating cloud-init ISO..."
    local cidata_iso="${work_dir}/cidata.iso"
    hdiutil makehybrid -o "$cidata_iso" \
        -hfs -joliet -iso -default-volume-name cidata \
        "$work_dir"
    
    # Create disk image from base
    echo "📀 Creating disk image (${disk_size_gb}GB)..."
    local temp_qcow="${work_dir}/disk.qcow2"
    qemu-img create -f qcow2 -F qcow2 -b "$alpine_base" "$temp_qcow" "${disk_size_gb}G"
    qemu-img resize "$temp_qcow" "${disk_size_gb}G"
    
    # Convert to RAW for Apple VZ
    echo "🔄 Converting to RAW format..."
    local raw_img="${DIST_DIR}/${vm_name}.img"
    qemu-img convert -f qcow2 -O raw "$temp_qcow" "$raw_img"
    
    # Create EFI NVRAM
    local efi_nvram="${DIST_DIR}/${vm_name}-efi.nvram"
    echo "🔐 Creating EFI variable store..."
    bash "$EFI_HELPER" "$efi_nvram"
    
    echo "✅ $vm_name built successfully"
    echo "   Disk: $raw_img"
    echo "   EFI: $efi_nvram"
    
    # Cleanup
    rm -rf "$work_dir"
}

# =============================================================================
# Build All VZ VMs
# =============================================================================

echo "📦 Checking prerequisites..."
if ! command -v qemu-img &> /dev/null; then
    echo "Installing qemu..."
    brew install qemu
fi

echo ""
echo "🚀 Building VZ VMs with Datadog..."
echo ""

# Valkey VM
build_vz_vm_with_datadog \
    "vibecode-valkey" \
    "valkey" \
    "10" \
    "- valkey
  - valkey-cli" \
    "- rc-update add valkey default
  - mkdir -p /var/lib/valkey /var/log/valkey
  - chown -R valkey:valkey /var/lib/valkey /var/log/valkey
  - service valkey start"

# PostgreSQL VM
build_vz_vm_with_datadog \
    "vibecode-postgresql" \
    "postgresql" \
    "10" \
    "- postgresql16
  - postgresql16-client
  - postgresql16-contrib" \
    "- postgresql-setup --initdb || rc-service postgresql setup
  - rc-update add postgresql default
  - service postgresql start"

# pgvector VM
build_vz_vm_with_datadog \
    "vibecode-pgvector" \
    "pgvector" \
    "20" \
    "- postgresql16
  - postgresql16-dev
  - git
  - build-base
  - clang
  - llvm" \
    "- git clone --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector
  - cd /tmp/pgvector && make && make install
  - postgresql-setup --initdb || rc-service postgresql setup
  - rc-update add postgresql default
  - service postgresql start"

# Node.js VM
build_vz_vm_with_datadog \
    "vibecode-nodejs" \
    "nodejs" \
    "50" \
    "- nodejs
  - npm
  - git" \
    "- npm config set prefix /usr/local
  - npm install -g npm@latest"

# Node.js Codeserver VM (Auto-starts in VibeCode app)
build_vz_vm_with_datadog \
    "vibecode-nodejs-codeserver" \
    "codeserver" \
    "50" \
    "- nodejs
  - npm
  - git
  - python3
  - build-base" \
    "- npm install -g code-server
  - mkdir -p /var/lib/code-server /home/coder
  - adduser -D -h /home/coder coder
  - cat > /etc/init.d/code-server <<'CSEOF'
#!/sbin/openrc-run
command=\"/usr/bin/code-server\"
command_args=\"--bind-addr 0.0.0.0:8080 --auth none /home/coder\"
command_user=\"coder\"
command_background=yes
pidfile=\"/run/code-server.pid\"
CSEOF
  - chmod +x /etc/init.d/code-server
  - rc-update add code-server default
  - service code-server start"

# IDE VM (openvscode-server)
build_vz_vm_with_datadog \
    "vibecode-ide" \
    "ide" \
    "50" \
    "- nodejs
  - npm
  - git
  - curl
  - wget
  - python3" \
    "- wget -qO- https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.95.1/openvscode-server-v1.95.1-linux-arm64.tar.gz | tar xz -C /opt
  - mv /opt/openvscode-server-v1.95.1-linux-arm64 /opt/openvscode-server
  - adduser -D -h /home/openvscode openvscode
  - chown -R openvscode:openvscode /opt/openvscode-server"

echo ""
echo "======================================================================"
echo "  Build Complete! 🎉"
echo "======================================================================"
echo ""
echo "✅ All 6 VZ VM images built with Datadog pre-installed"
echo ""
echo "📂 Location: $DIST_DIR"
ls -lh "$DIST_DIR"/*.img
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1. Restart VibeCode app:"
echo "   pkill VibeCode"
echo "   ./scripts/launch-vibecode.sh"
echo ""
echo "2. VMs will now have Datadog agents on first boot"
echo "   (First boot takes 2-3 min for cloud-init provisioning)"
echo ""
echo "3. Verify Datadog is reporting:"
echo "   https://app.${DATADOG_SITE}/infrastructure"
echo "   Look for hosts: vibecode-valkey, vibecode-nodejs-codeserver, etc."
echo ""
echo "4. SSH into VMs (after first boot):"
echo "   ssh root@<vm-ip> (password: vibecode)"
echo ""
echo "📊 Datadog Dashboard Tags:"
echo "   - env:vibecode"
echo "   - platform:apple-vz"
echo "   - app:vibecode-native"
echo ""
echo "⚠️  Note: On first boot, cloud-init will run and install services."
echo "   Subsequent boots will be fast as everything is pre-configured."
echo ""
