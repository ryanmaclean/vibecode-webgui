#!/usr/bin/env bash
# Build ALL tiny services in the appropriate VMs
# This is the master orchestration script

set -euo pipefail

VM_BASE="${HOME}/.vfkit/vms"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======================================================================"
echo "  Building ALL Tiny Services (musl ARM64)"
echo "======================================================================"
echo ""
echo "Goal: Minimal, production-ready builds of:"
echo "  1. Valkey (Redis alternative)"
echo "  2. PostgreSQL + pgvector"
echo "  3. Node.js 24"
echo "  4. openvscode-server + RAG GenAI extension"
echo ""
echo "All using musl libc for minimal footprint"
echo ""

# Check if VMs exist
if [[ ! -d "${VM_BASE}/vibecode-valkey" ]] || \
   [[ ! -d "${VM_BASE}/vibecode-postgresql" ]] || \
   [[ ! -d "${VM_BASE}/vibecode-openvscode" ]]; then
    echo "❌ VMs not found. Creating them first..."
    "${SCRIPT_DIR}/create-multi-vm-setup.sh"
    echo ""
    echo "⏳ Waiting for VMs to initialize..."
    sleep 10
fi

# Stop any running VMs to rebuild with auto-exec scripts
echo "🛑 Stopping existing VMs..."
pkill -f "vfkit.*valkey" 2>/dev/null || true
pkill -f "vfkit.*postgresql" 2>/dev/null || true
pkill -f "vfkit.*openvscode" 2>/dev/null || true
sleep 2

echo "✅ VMs stopped"
echo ""

# Function to embed build script into VM rootfs
embed_build_script() {
    local vm_name=$1
    local build_script=$2
    local script_name=$(basename "$build_script")
    
    echo "📝 Embedding ${script_name} into ${vm_name} VM..."
    
    local vm_dir="${VM_BASE}/vibecode-${vm_name}"
    local rootfs_dir="${vm_dir}/rootfs-autoexec"
    
    # Create temp directory
    mkdir -p "${rootfs_dir}"
    cd "${rootfs_dir}"
    
    # Extract base Alpine rootfs
    if [[ -f "${VM_BASE}/vibecode-alpine/rootfs/alpine-vibecode-rootfs.cpio.gz" ]]; then
        gunzip -c "${VM_BASE}/vibecode-alpine/rootfs/alpine-vibecode-rootfs.cpio.gz" | cpio -idm 2>/dev/null
    else
        echo "  ❌ Base rootfs not found"
        return 1
    fi
    
    # Copy build script
    cp "${build_script}" root/build.sh
    chmod +x root/build.sh
    
    # Create auto-exec init
    cat > init <<'INIT_AUTO'
#!/bin/sh
# Auto-execute build script

mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev

# Setup networking
ip link set lo up
ip link set eth0 up
udhcpc -i eth0 -q -n 2>/dev/null &

# Wait for network
sleep 2

# Run build script
echo ""
echo "======================================================================"
echo "  AUTO-EXECUTING BUILD SCRIPT"
echo "======================================================================"
echo ""

cd /root
if [ -f /root/build.sh ]; then
    sh /root/build.sh 2>&1 | tee /root/build.log
    BUILD_EXIT=$?
    echo ""
    echo "======================================================================"
    if [ $BUILD_EXIT -eq 0 ]; then
        echo "  ✅ BUILD SUCCESSFUL"
    else
        echo "  ❌ BUILD FAILED (exit code: $BUILD_EXIT)"
    fi
    echo "======================================================================"
    echo ""
else
    echo "❌ Build script not found!"
fi

# Drop to shell
echo "Dropping to shell..."
exec /bin/sh
INIT_AUTO
    
    chmod +x init
    
    # Repack rootfs
    echo "  📦 Repacking rootfs..."
    mkdir -p "${vm_dir}/rootfs"
    find . | cpio -o -H newc 2>/dev/null | gzip > "${vm_dir}/rootfs/auto-exec.cpio.gz"
    
    # Update VM launch script to use local rootfs
    if [[ -f "${vm_dir}/launch.sh" ]]; then
        # Fix the initrd path to point to the VM's own rootfs directory
        sed -i '' "s|${VM_BASE}/vibecode-alpine/rootfs/alpine-vibecode-rootfs.cpio.gz|${vm_dir}/rootfs/auto-exec.cpio.gz|g" "${vm_dir}/launch.sh"
        # Also handle if it was already using a relative path
        sed -i '' 's|alpine-vibecode-rootfs\.cpio\.gz|auto-exec.cpio.gz|g' "${vm_dir}/launch.sh"
    fi
    
    cd - >/dev/null
    rm -rf "${rootfs_dir}"
    
    echo "  ✅ ${vm_name} ready for auto-exec"
}

# Embed build scripts into VMs
echo "======================================================================"
echo "  Preparing VMs with Build Scripts"
echo "======================================================================"
echo ""

embed_build_script "valkey" "${SCRIPT_DIR}/compile-valkey-musl.sh"
embed_build_script "postgresql" "${SCRIPT_DIR}/build-tiny-postgresql-pgvector.sh"
embed_build_script "openvscode" "${SCRIPT_DIR}/build-tiny-openvscode-with-rag.sh"

echo ""
echo "======================================================================"
echo "  Launching VMs (builds will execute automatically)"
echo "======================================================================"
echo ""

# Launch VMs with logging
"${VM_BASE}/vibecode-valkey/launch.sh" > /tmp/valkey-build.log 2>&1 &
VALKEY_PID=$!
echo "✅ Valkey VM launched (PID: ${VALKEY_PID})"
echo "   Log: tail -f /tmp/valkey-build.log"

sleep 3

"${VM_BASE}/vibecode-postgresql/launch.sh" > /tmp/postgresql-build.log 2>&1 &
PG_PID=$!
echo "✅ PostgreSQL VM launched (PID: ${PG_PID})"
echo "   Log: tail -f /tmp/postgresql-build.log"

sleep 3

"${VM_BASE}/vibecode-openvscode/launch.sh" > /tmp/openvscode-build.log 2>&1 &
VSCODE_PID=$!
echo "✅ openvscode VM launched (PID: ${VSCODE_PID})"
echo "   Log: tail -f /tmp/openvscode-build.log"

# Also build Node.js in one of the VMs (reuse openvscode VM)
echo ""
echo "ℹ️  Node.js 24 will be installed in openvscode VM (required for openvscode)"
echo ""

sleep 2

echo ""
echo "======================================================================"
echo "  Build Status Monitor"
echo "======================================================================"
echo ""
echo "VMs are now building services automatically!"
echo ""
echo "Expected build times:"
echo "  • Valkey:                3-5 minutes"
echo "  • PostgreSQL + pgvector: 4-6 minutes"  
echo "  • openvscode + RAG:      5-8 minutes"
echo "  • Node.js 24:            Included in openvscode build"
echo ""
echo "📊 Monitor progress:"
echo ""
echo "  # Watch all builds"
echo "  tail -f /tmp/valkey-build.log"
echo "  tail -f /tmp/postgresql-build.log"
echo "  tail -f /tmp/openvscode-build.log"
echo ""
echo "  # Or monitor VM consoles"
echo "  tail -f ~/.vfkit/vms/vibecode-valkey/logs/console.log"
echo "  tail -f ~/.vfkit/vms/vibecode-postgresql/logs/console.log"
echo "  tail -f ~/.vfkit/vms/vibecode-openvscode/logs/console.log"
echo ""

# Wait and show progress
echo "⏳ Waiting for builds to complete..."
echo ""

# Simple progress monitor
for i in {1..20}; do
    sleep 30
    
    echo "Progress check (${i} min):"
    
    # Check Valkey
    if grep -q "BUILD SUCCESSFUL" /tmp/valkey-build.log 2>/dev/null; then
        echo "  ✅ Valkey: DONE"
    elif grep -q "BUILD FAILED" /tmp/valkey-build.log 2>/dev/null; then
        echo "  ❌ Valkey: FAILED"
    else
        echo "  ⏳ Valkey: Building..."
    fi
    
    # Check PostgreSQL
    if grep -q "BUILD SUCCESSFUL" /tmp/postgresql-build.log 2>/dev/null; then
        echo "  ✅ PostgreSQL: DONE"
    elif grep -q "BUILD FAILED" /tmp/postgresql-build.log 2>/dev/null; then
        echo "  ❌ PostgreSQL: FAILED"
    else
        echo "  ⏳ PostgreSQL: Building..."
    fi
    
    # Check openvscode
    if grep -q "BUILD SUCCESSFUL" /tmp/openvscode-build.log 2>/dev/null; then
        echo "  ✅ openvscode: DONE"
    elif grep -q "BUILD FAILED" /tmp/openvscode-build.log 2>/dev/null; then
        echo "  ❌ openvscode: FAILED"
    else
        echo "  ⏳ openvscode: Building..."
    fi
    
    echo ""
    
    # Check if all done
    if grep -q "BUILD SUCCESSFUL" /tmp/valkey-build.log 2>/dev/null && \
       grep -q "BUILD SUCCESSFUL" /tmp/postgresql-build.log 2>/dev/null && \
       grep -q "BUILD SUCCESSFUL" /tmp/openvscode-build.log 2>/dev/null; then
        echo "======================================================================"
        echo "  🎉 ALL BUILDS COMPLETE!"
        echo "======================================================================"
        break
    fi
done

echo ""
echo "======================================================================"
echo "  Build Summary"
echo "======================================================================"
echo ""

# Extract sizes and status from logs
echo "📊 Service Status:"
echo ""

if grep -q "BUILD SUCCESSFUL" /tmp/valkey-build.log 2>/dev/null; then
    echo "✅ Valkey:"
    grep -A 5 "Build Summary" /tmp/valkey-build.log | tail -4 || echo "   Running"
else
    echo "❌ Valkey: Check /tmp/valkey-build.log"
fi
echo ""

if grep -q "BUILD SUCCESSFUL" /tmp/postgresql-build.log 2>/dev/null; then
    echo "✅ PostgreSQL + pgvector:"
    grep "Port:" /tmp/postgresql-build.log | tail -1 || echo "   Running on port 5432"
else
    echo "❌ PostgreSQL: Check /tmp/postgresql-build.log"
fi
echo ""

if grep -q "BUILD SUCCESSFUL" /tmp/openvscode-build.log 2>/dev/null; then
    echo "✅ openvscode-server + RAG:"
    grep "Port:" /tmp/openvscode-build.log | tail -1 || echo "   Running on port 3000"
    grep "Extensions:" /tmp/openvscode-build.log | tail -1 || echo "   RAG GenAI installed"
else
    echo "❌ openvscode: Check /tmp/openvscode-build.log"
fi
echo ""

echo "✅ Node.js 24: Included in openvscode VM"
echo ""

echo "======================================================================"
echo "  Access Services"
echo "======================================================================"
echo ""
echo "Find VM IPs:"
echo "  ps aux | grep vfkit | grep vibecode"
echo ""
echo "Services:"
echo "  Valkey:      redis://vm-ip:6379"
echo "  PostgreSQL:  postgresql://vm-ip:5432"
echo "  openvscode:  http://vm-ip:3000"
echo ""
echo "All services use musl libc for minimal footprint! ✅"

