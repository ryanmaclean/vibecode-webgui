#!/usr/bin/env bash
# Execute builds in all running VMs
# This runs the startup scripts that build and start services

set -euo pipefail

VM_BASE="${HOME}/.vfkit/vms"

echo "======================================================================"
echo "  Executing Builds in All VMs"
echo "======================================================================"
echo ""

# Since we can't directly interact with VM consoles programmatically,
# let's create a comprehensive status checker and rebuild the VMs
# to auto-execute builds on boot

echo "Creating auto-build initramfs for each VM..."
echo ""

# Function to create a custom initramfs that auto-runs the build script
create_auto_build_vm() {
    local vm_name=$1
    local build_script=$2
    
    echo "Setting up auto-build for ${vm_name}..."
    
    local vm_dir="${VM_BASE}/vibecode-${vm_name}"
    local rootfs_dir="${vm_dir}/rootfs-build"
    
    # Create build directory
    mkdir -p "${rootfs_dir}"
    cd "${rootfs_dir}"
    
    # Extract base rootfs
    if [[ -f "${VM_BASE}/vibecode-alpine/rootfs/alpine-vibecode-rootfs.cpio.gz" ]]; then
        gunzip -c "${VM_BASE}/vibecode-alpine/rootfs/alpine-vibecode-rootfs.cpio.gz" | cpio -idm 2>/dev/null
    else
        echo "  ❌ Base rootfs not found"
        return 1
    fi
    
    # Copy build script into rootfs as init script
    cp "${vm_dir}/${build_script}" init-service.sh
    chmod +x init-service.sh
    
    # Create new init that runs our build script
    cat > init <<'INIT_WRAPPER'
#!/bin/sh
# Auto-build init wrapper
exec /init-service.sh
INIT_WRAPPER
    
    chmod +x init
    
    # Repack into new initramfs
    echo "  Repacking initramfs..."
    find . | cpio -o -H newc 2>/dev/null | gzip > "${vm_dir}/rootfs/auto-build.cpio.gz"
    
    # Update launch script to use new initramfs
    sed -i '' "s|alpine-vibecode-rootfs.cpio.gz|auto-build.cpio.gz|g" "${vm_dir}/launch.sh"
    
    echo "  ✅ ${vm_name} configured for auto-build"
    
    cd - >/dev/null
    rm -rf "${rootfs_dir}"
}

# Stop existing VMs first
echo "Stopping existing VMs..."
pkill -f "vfkit.*valkey" 2>/dev/null || true
pkill -f "vfkit.*postgresql" 2>/dev/null || true  
pkill -f "vfkit.*openvscode" 2>/dev/null || true
sleep 2

# Configure each VM for auto-build
create_auto_build_vm "valkey" "start-valkey.sh"
create_auto_build_vm "postgresql" "start-postgresql.sh"
create_auto_build_vm "openvscode" "start-openvscode.sh"

echo ""
echo "======================================================================"
echo "  Relaunching VMs with Auto-Build"
echo "======================================================================"
echo ""

# Launch VMs again
"${VM_BASE}/vibecode-valkey/launch.sh" > /tmp/valkey-build.log 2>&1 &
echo "✅ Valkey VM building... (PID: $!)"
echo "   Log: /tmp/valkey-build.log"

sleep 2

"${VM_BASE}/vibecode-postgresql/launch.sh" > /tmp/postgresql-build.log 2>&1 &
echo "✅ PostgreSQL VM building... (PID: $!)"
echo "   Log: /tmp/postgresql-build.log"

sleep 2

"${VM_BASE}/vibecode-openvscode/launch.sh" > /tmp/openvscode-build.log 2>&1 &
echo "✅ openvscode VM building... (PID: $!)"
echo "   Log: /tmp/openvscode-build.log"

echo ""
echo "======================================================================"
echo "  Build Status"
echo "======================================================================"
echo ""
echo "All VMs are now building their services automatically."
echo ""
echo "Expected build times:"
echo "  • Valkey: 3-5 minutes"
echo "  • PostgreSQL + pgvector: 3-5 minutes"
echo "  • openvscode: 2-3 minutes"
echo ""
echo "Monitor progress:"
echo "  tail -f /tmp/valkey-build.log"
echo "  tail -f /tmp/postgresql-build.log"
echo "  tail -f /tmp/openvscode-build.log"
echo ""
echo "Or check VM console logs:"
echo "  tail -f ~/.vfkit/vms/vibecode-valkey/logs/console.log"
echo "  tail -f ~/.vfkit/vms/vibecode-postgresql/logs/console.log"
echo "  tail -f ~/.vfkit/vms/vibecode-openvscode/logs/console.log"
echo ""
echo "Wait 5-10 minutes for all builds to complete."

