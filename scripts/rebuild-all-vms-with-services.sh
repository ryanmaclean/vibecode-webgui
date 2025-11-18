#!/bin/bash
# Rebuild all 6 VMs with services installed
# Option A: Complete rebuild with proper configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=================================="
echo "Rebuild All VMs with Services"
echo "=================================="
echo ""

# Get SSH public key
PUBKEY=$(cat "$HOME/.ssh/vibecode/id_ed25519.pub" 2>/dev/null || echo "GENERATE_SSH_KEY_FIRST")

# Create output directory
mkdir -p "$PROJECT_ROOT/dist/vm-images"
mkdir -p "$PROJECT_ROOT/tmp/cloud-init"

# Function to build a VM
build_vm() {
    local VM_NAME=$1
    local CLOUD_INIT=$2
    local DISK_SIZE=${3:-10G}
    
    echo "Building $VM_NAME..."
    echo "===================="
    
    # Replace SSH key placeholder in cloud-init
    sed "s|__SSH_PUBKEY__|$PUBKEY|g" "$CLOUD_INIT" > "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-user-data.yaml"
    
    # Download Alpine cloud image if not exists
    if [ ! -f "$PROJECT_ROOT/tmp/alpine-virt-cloud.qcow2" ]; then
        echo "Downloading Alpine 3.19 cloud image (UEFI)..."
        curl -L -o "$PROJECT_ROOT/tmp/alpine-virt-cloud.qcow2" \
            "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/nocloud_alpine-3.19.0-aarch64-uefi-cloudinit-r0.qcow2"
        
        # Verify it's actually a QCOW2 image
        if ! qemu-img info "$PROJECT_ROOT/tmp/alpine-virt-cloud.qcow2" 2>/dev/null | grep -q "qcow2"; then
            echo "ERROR: Downloaded file is not a valid QCOW2 image"
            file "$PROJECT_ROOT/tmp/alpine-virt-cloud.qcow2"
            rm -f "$PROJECT_ROOT/tmp/alpine-virt-cloud.qcow2"
            return 1
        fi
        echo "✅ Alpine cloud image downloaded and verified"
    else
        echo "Using existing Alpine cloud image"
    fi
    
    # Convert to RAW
    echo "Converting to RAW format..."
    qemu-img convert -f qcow2 -O raw \
        "$PROJECT_ROOT/tmp/alpine-virt-cloud.qcow2" \
        "$PROJECT_ROOT/dist/vm-images/$VM_NAME.img"
    
    # Resize disk
    echo "Resizing disk to $DISK_SIZE..."
    qemu-img resize "$PROJECT_ROOT/dist/vm-images/$VM_NAME.img" "$DISK_SIZE"
    
    # Create cloud-init ISO
    echo "Creating cloud-init ISO..."
    mkdir -p "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed"
    cp "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-user-data.yaml" \
       "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed/user-data"
    
    cat > "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed/meta-data" << META
instance-id: ${VM_NAME}-001
local-hostname: ${VM_NAME}
META
    
    hdiutil makehybrid -o "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed.iso" \
        "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed" \
        -iso -joliet 2>/dev/null || \
    mkisofs -output "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed.iso" \
        -volid cidata -joliet -rock \
        "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed" 2>/dev/null || \
    genisoimage -output "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed.iso" \
        -volid cidata -joliet -rock \
        "$PROJECT_ROOT/tmp/cloud-init/${VM_NAME}-seed"
    
    # Create EFI NVRAM using Apple's Virtualization.framework API
    # This creates a properly initialized EFI variable store that VZ can boot from
    echo "Creating EFI variable store..."
    "$SCRIPT_DIR/init-efi-nvram.sh" "$PROJECT_ROOT/dist/vm-images/$VM_NAME-efi.nvram"
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create EFI NVRAM for $VM_NAME"
        return 1
    fi
    
    echo "✅ $VM_NAME built successfully"
    echo ""
}

# Build all VMs
echo "Starting VM builds..."
echo ""

build_vm "vibecode-postgresql" "$PROJECT_ROOT/config/cloud-init/postgresql-user-data.yaml" "15G"
build_vm "vibecode-valkey" "$PROJECT_ROOT/config/cloud-init/valkey-user-data.yaml" "10G"
build_vm "vibecode-nodejs" "$PROJECT_ROOT/config/cloud-init/nodejs-user-data.yaml" "15G"
build_vm "vibecode-nodejs-codeserver" "$PROJECT_ROOT/config/cloud-init/codeserver-user-data.yaml" "20G"

echo "=================================="
echo "VM Build Complete"
echo "=================================="
echo ""
echo "Built VMs:"
echo "  - vibecode-postgresql (PostgreSQL 15+ on port 5432)"
echo "  - vibecode-valkey (Redis/Valkey on port 6379)"
echo "  - vibecode-nodejs (Node.js with test server on port 3000)"
echo "  - vibecode-nodejs-codeserver (OpenVSCode on port 8080)"
echo ""
echo "Each VM includes:"
echo "  - Services configured and auto-start"
echo "  - SSH access (user: vibecode, key-based)"
echo "  - Network configured (DHCP)"
echo ""
echo "Next steps:"
echo "  1. Launch VibeCode app: ./scripts/launch-vibecode.sh"
echo "  2. VMs will auto-discover"
echo "  3. Start VMs from GUI"
echo "  4. Find IPs: ./scripts/find-vm-ips.sh"
echo "  5. Test services: ./scripts/test-service-health.sh <ip>"

