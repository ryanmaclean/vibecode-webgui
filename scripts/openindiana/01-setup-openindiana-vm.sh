#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

#
# OpenIndiana VM Setup Script for VibeCode
# Creates optimized VM for running VibeCode with ZFS and DTrace
#
# Platforms: UTM (macOS), VirtualBox (cross-platform), QEMU (Linux)
#

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Configuration
VM_NAME="vibecode-openindiana"
VM_CPUS=4
VM_MEMORY=8192  # MB
VM_DISK_SIZE="60G"
VM_NETWORK_MODE="bridged"  # or "nat"
ISO_URL="https://dlc.openindiana.org/isos/hipster/OI-hipster-gui-20231027.iso"
ISO_FILE="OI-hipster-gui-20231027.iso"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect host platform
detect_platform() {
    case "$(uname -s)" in
        Darwin*)
            PLATFORM="macos"
            HYPERVISOR="utm"
            ;;
        Linux*)
            PLATFORM="linux"
            if command -v virt-install >/dev/null 2>&1; then
                HYPERVISOR="kvm"
            elif command -v VBoxManage >/dev/null 2>&1; then
                HYPERVISOR="virtualbox"
            else
                log_error "No supported hypervisor found (KVM or VirtualBox)"
                exit 1
            fi
            ;;
        MINGW*|CYGWIN*)
            PLATFORM="windows"
            HYPERVISOR="virtualbox"
            ;;
        *)
            log_error "Unsupported platform: $(uname -s)"
            exit 1
            ;;
    esac

    log_info "Detected platform: $PLATFORM"
    log_info "Using hypervisor: $HYPERVISOR"
}

# Download OpenIndiana ISO
download_iso() {
    if [ -f "$ISO_FILE" ]; then
        log_info "ISO already downloaded: $ISO_FILE"
        return
    fi

    log_info "Downloading OpenIndiana ISO..."
    log_info "URL: $ISO_URL"

    if command -v curl >/dev/null 2>&1; then
        curl -L -o "$ISO_FILE" "$ISO_URL"
    elif command -v wget >/dev/null 2>&1; then
        wget -O "$ISO_FILE" "$ISO_URL"
    else
        log_error "Neither curl nor wget found. Please install one."
        exit 1
    fi

    log_info "ISO downloaded: $ISO_FILE"
}

# Verify ISO checksum
verify_iso() {
    log_info "Verifying ISO checksum..."

    # Expected SHA256 (update this with actual checksum)
    # EXPECTED_SHA256="..."

    if command -v sha256sum >/dev/null 2>&1; then
        ACTUAL_SHA256=$(sha256sum "$ISO_FILE" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        ACTUAL_SHA256=$(shasum -a 256 "$ISO_FILE" | awk '{print $1}')
    else
        log_warn "No SHA256 tool found, skipping verification"
        return
    fi

    log_info "SHA256: $ACTUAL_SHA256"
    log_warn "Please verify checksum manually from https://www.openindiana.org/downloads/"
}

# Create VM with UTM (macOS)
create_utm_vm() {
    log_info "Creating VM with UTM..."
    log_warn "UTM requires manual VM creation through GUI"

    cat <<EOF

=====================================================
UTM VM Creation Instructions
=====================================================

1. Open UTM application
2. Click "Create a New Virtual Machine"
3. Select "Virtualize" (for x86_64)
4. Select "Other" as operating system
5. Configure:
   - Name: $VM_NAME
   - CPU Cores: $VM_CPUS
   - Memory: ${VM_MEMORY}MB
   - Storage: ${VM_DISK_SIZE}
6. Add CD/DVD drive with: $ISO_FILE
7. Network: Shared Network (or Bridged)
8. Click "Save" and start VM
9. Follow OpenIndiana installation wizard

Installation Tips:
- Use entire disk for ZFS
- Create root password
- Enable SSH server
- Set timezone appropriately

After installation:
- Boot into OpenIndiana
- Login as root
- Run: pkg install brand/lx git curl wget
- Continue with 02-configure-lx-zone.sh

=====================================================
EOF
}

# Create VM with VirtualBox
create_virtualbox_vm() {
    log_info "Creating VM with VirtualBox..."

    if ! command -v VBoxManage >/dev/null 2>&1; then
        log_error "VBoxManage not found. Please install VirtualBox."
        exit 1
    fi

    # Create VM
    VBoxManage createvm --name "$VM_NAME" --ostype "Solaris11_64" --register

    # Set VM parameters
    VBoxManage modifyvm "$VM_NAME" \
        --memory $VM_MEMORY \
        --cpus $VM_CPUS \
        --vram 128 \
        --graphicscontroller vmsvga \
        --boot1 dvd \
        --boot2 disk \
        --acpi on \
        --ioapic on \
        --rtcuseutc on \
        --hwvirtex on \
        --nestedpaging on \
        --largepages on \
        --pae on

    # Create disk
    VM_DIR=$(VBoxManage showvminfo "$VM_NAME" | grep "Config file:" | sed 's/.*: //' | xargs dirname)
    VBoxManage createhd \
        --filename "$VM_DIR/$VM_NAME.vdi" \
        --size $(echo $VM_DISK_SIZE | sed 's/G/000/') \
        --format VDI

    # Add storage controllers
    VBoxManage storagectl "$VM_NAME" \
        --name "SATA Controller" \
        --add sata \
        --controller IntelAhci \
        --portcount 2 \
        --bootable on

    # Attach disk
    VBoxManage storageattach "$VM_NAME" \
        --storagectl "SATA Controller" \
        --port 0 \
        --device 0 \
        --type hdd \
        --medium "$VM_DIR/$VM_NAME.vdi"

    # Attach ISO
    VBoxManage storageattach "$VM_NAME" \
        --storagectl "SATA Controller" \
        --port 1 \
        --device 0 \
        --type dvddrive \
        --medium "$(pwd)/$ISO_FILE"

    # Configure network
    if [ "$VM_NETWORK_MODE" = "bridged" ]; then
        VBoxManage modifyvm "$VM_NAME" --nic1 bridged --bridgeadapter1 "$(VBoxManage list bridgedifs | grep ^Name | head -1 | cut -d: -f2 | xargs)"
    else
        VBoxManage modifyvm "$VM_NAME" --nic1 nat
        VBoxManage modifyvm "$VM_NAME" --natpf1 "ssh,tcp,,2222,,22"
        VBoxManage modifyvm "$VM_NAME" --natpf1 "http,tcp,,3000,,3000"
    fi

    log_info "VM created successfully: $VM_NAME"

    cat <<EOF

=====================================================
VirtualBox VM Created: $VM_NAME
=====================================================

Start VM:
  VBoxManage startvm "$VM_NAME" --type gui

Installation:
1. Boot from ISO
2. Follow OpenIndiana installer
   - Use entire disk for ZFS
   - Set root password
   - Enable SSH
3. After installation:
   - Eject ISO from storage menu
   - Reboot
4. Login and run: pkg install brand/lx git curl wget
5. Continue with 02-configure-lx-zone.sh

Network Access:
$(if [ "$VM_NETWORK_MODE" = "nat" ]; then
    echo "  SSH: ssh -p 2222 root@localhost"
    echo "  Web: http://localhost:3000"
else
    echo "  Use VM's IP address (check with: ipadm show-addr)"
fi)

=====================================================
EOF
}

# Create VM with QEMU/KVM
create_kvm_vm() {
    log_info "Creating VM with QEMU/KVM..."

    if ! command -v virt-install >/dev/null 2>&1; then
        log_error "virt-install not found. Install: apt install virtinst"
        exit 1
    fi

    # Create disk image
    qemu-img create -f qcow2 "/var/lib/libvirt/images/${VM_NAME}.qcow2" "$VM_DISK_SIZE"

    # Create VM
    virt-install \
        --name "$VM_NAME" \
        --ram $VM_MEMORY \
        --vcpus $VM_CPUS \
        --disk path="/var/lib/libvirt/images/${VM_NAME}.qcow2",format=qcow2,bus=virtio \
        --cdrom "$(pwd)/$ISO_FILE" \
        --os-variant solaris11 \
        --network network=default,model=virtio \
        --graphics vnc,listen=0.0.0.0 \
        --console pty,target_type=serial \
        --noautoconsole

    log_info "VM created successfully: $VM_NAME"

    cat <<EOF

=====================================================
KVM VM Created: $VM_NAME
=====================================================

Connect to console:
  virt-viewer "$VM_NAME"

Or via VNC:
  virsh vncdisplay "$VM_NAME"

Installation:
1. Follow OpenIndiana installer
2. Use entire disk for ZFS
3. Set root password and enable SSH
4. After installation, start VM:
   virsh start "$VM_NAME"
5. Login and install packages:
   pkg install brand/lx git curl wget
6. Continue with 02-configure-lx-zone.sh

Manage VM:
  virsh list --all
  virsh start "$VM_NAME"
  virsh shutdown "$VM_NAME"

=====================================================
EOF
}

# Main
main() {
    log_info "VibeCode OpenIndiana VM Setup"
    log_info "=============================="

    detect_platform
    download_iso
    verify_iso

    case "$HYPERVISOR" in
        utm)
            create_utm_vm
            ;;
        virtualbox)
            create_virtualbox_vm
            ;;
        kvm)
            create_kvm_vm
            ;;
        *)
            log_error "Unsupported hypervisor: $HYPERVISOR"
            exit 1
            ;;
    esac

    log_info "VM setup complete!"
    log_info "Next steps:"
    log_info "  1. Install OpenIndiana from ISO"
    log_info "  2. Boot into installed system"
    log_info "  3. Run: ./02-configure-lx-zone.sh"
}

main "$@"
