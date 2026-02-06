#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build multiple VZ VMs with Datadog in PARALLEL
# Uses GNU parallel or xargs for concurrent builds

# Initialize log aggregation
init_log_aggregation


set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_ROOT}/dist/vm-images"
LOG_DIR="${PROJECT_ROOT}/logs"
EFI_HELPER="${PROJECT_ROOT}/scripts/vfkit/create-efi-variable-store.sh"

echo "======================================================================"
echo "  Parallel VZ VM Builder with Datadog"
echo "======================================================================"
echo ""

# Check if running with secure key
if [ -z "$DATADOG_API_KEY" ]; then
    echo "❌ Error: This script must be run via run-with-secure-datadog-key.sh"
    echo ""
    echo "Usage: ./scripts/run-with-secure-datadog-key.sh ./scripts/build-vz-vms-parallel.sh"
    exit 1
fi

MASKED_KEY="${DATADOG_API_KEY:0:10}..."
echo "Using key: $MASKED_KEY"
echo "Site: $DATADOG_SITE"
echo ""

# Detect CPU cores
CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
# Use 75% of cores, minimum 2, maximum 6 (for 6 VMs)
PARALLEL_JOBS=$(( CORES * 3 / 4 ))
[ $PARALLEL_JOBS -lt 2 ] && PARALLEL_JOBS=2
[ $PARALLEL_JOBS -gt 6 ] && PARALLEL_JOBS=6

echo "System: $CORES CPU cores detected"
echo "Parallel builds: $PARALLEL_JOBS concurrent jobs"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"
mkdir -p "$LOG_DIR"

# Define VMs to build
declare -a VMS=(
    "vibecode-postgresql:PostgreSQL Database"
    "vibecode-valkey:Valkey Cache"
    "vibecode-nodejs:Node.js Runtime"
    "vibecode-codeserver:IDE Server"
    "vibecode-redis:Redis Cache"
    "vibecode-mysql:MySQL Database"
)

# Alpine base image
ALPINE_IMAGE="https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.0-aarch64-uefi-cloudinit-r0.qcow2"
ALPINE_SHA="sha512:30b347397387926eeb939d93c926e09833f5b49c6c6de5cc225ccdfe6e54aba88251c71da264c7e4260e78132b50e34b93409c8b4da2e843e68a4dc35fc6b155"

# Function to build a single VM
build_vm() {
    local VM_NAME=$1
    local VM_DESC=$2
    local LOG_FILE="${LOG_DIR}/build-${VM_NAME}.log"
    
    echo "[${VM_NAME}] Starting build at $(date +%H:%M:%S)" | tee -a "$LOG_FILE"
    
    {
        # Create temp directory for this VM
        VM_TEMP="/tmp/${VM_NAME}-build-$$"
        mkdir -p "$VM_TEMP"
        cd "$VM_TEMP"
        
        # Download base image (cached if already exists)
        CACHE_DIR="$HOME/.cache/vibecode/vm-images"
        mkdir -p "$CACHE_DIR"
        BASE_IMAGE="$CACHE_DIR/alpine-3.22-aarch64.qcow2"
        
        if [ ! -f "$BASE_IMAGE" ]; then
            echo "[${VM_NAME}] Downloading Alpine base image..."
            curl -L -o "$BASE_IMAGE" "$ALPINE_IMAGE"
        else
            echo "[${VM_NAME}] Using cached Alpine image"
        fi
        
        # Copy base image for this VM
        echo "[${VM_NAME}] Preparing disk image..."
        cp "$BASE_IMAGE" "${VM_NAME}.qcow2"
        
        # Convert QCOW2 to RAW
        echo "[${VM_NAME}] Converting to RAW format..."
        qemu-img convert -f qcow2 -O raw "${VM_NAME}.qcow2" "${VM_NAME}.img"
        
        # Resize to 10GB
        echo "[${VM_NAME}] Resizing to 10GB..."
        qemu-img resize -f raw "${VM_NAME}.img" 10G
        
        # Create cloud-init user-data
        echo "[${VM_NAME}] Generating cloud-init config..."
        cat > user-data.yaml <<EOF
#cloud-config
hostname: ${VM_NAME}
fqdn: ${VM_NAME}.local

users:
  - name: vibecode
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJqfWHQp7eDLKt9R6F5xL0Z8rJ9nP3rL6VzG5Q8K3jVm vibecode@local

packages:
  - curl
  - bash
  - python3
  - py3-pip
  - htop
  - vim

runcmd:
  - echo "Installing Datadog agent for ${VM_NAME}..."
  - export DD_API_KEY="${DATADOG_API_KEY}"
  - export DD_SITE="${DATADOG_SITE}"
  - bash -c "\$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)" || true
  - |
    if [ -d /etc/datadog-agent ]; then
      cat > /etc/datadog-agent/datadog.yaml <<DDEOF
    api_key: ${DATADOG_API_KEY}
    site: ${DATADOG_SITE}
    hostname: ${VM_NAME}
    tags:
      - env:vibecode
      - platform:apple-vz
      - service:${VM_NAME#vibecode-}
      - vm_type:${VM_DESC// /-}
    logs_enabled: true
    apm_config:
      enabled: true
    process_config:
      enabled: true
DDEOF
      rc-update add datadog-agent default || true
      service datadog-agent start || true
    fi
  - echo "Datadog agent installation complete"

power_state:
  mode: poweroff
  timeout: 300
EOF

        # Create cloud-init meta-data
        cat > meta-data.yaml <<EOF
instance-id: ${VM_NAME}-001
local-hostname: ${VM_NAME}
EOF

        # Create cloud-init ISO
        echo "[${VM_NAME}] Creating cloud-init ISO..."
        if command -v genisoimage &> /dev/null; then
            genisoimage -output cidata.iso -V cidata -r -J user-data.yaml meta-data.yaml 2>&1
        elif command -v mkisofs &> /dev/null; then
            mkisofs -output cidata.iso -V cidata -r -J user-data.yaml meta-data.yaml 2>&1
        else
            echo "[${VM_NAME}] ERROR: No ISO creation tool found (genisoimage or mkisofs)"
            return 1
        fi
        
        # Create EFI NVRAM
        echo "[${VM_NAME}] Creating EFI NVRAM..."
        bash "$EFI_HELPER" "${VM_NAME}-efi.nvram"
        
        # Copy files to output directory
        echo "[${VM_NAME}] Copying to dist/vm-images/..."
        cp "${VM_NAME}.img" "$OUTPUT_DIR/"
        cp "${VM_NAME}-efi.nvram" "$OUTPUT_DIR/"
        
        # Cleanup
        cd /
        rm -rf "$VM_TEMP"
        
        echo "[${VM_NAME}] ✅ Build complete at $(date +%H:%M:%S)"
        
    } >> "$LOG_FILE" 2>&1
    
    # Return status
    if [ $? -eq 0 ]; then
        echo "✅ ${VM_NAME} (${VM_DESC})"
        return 0
    else
        echo "❌ ${VM_NAME} (${VM_DESC}) - check ${LOG_FILE}"
        return 1
    fi
}

export -f build_vm
export DATADOG_API_KEY
export DATADOG_SITE

# Start parallel builds
echo "======================================================================"
echo "  Starting Parallel Builds"
echo "======================================================================"
echo ""

START_TIME=$(date +%s)

# Check if GNU parallel is available
if command -v parallel &> /dev/null; then
    echo "Using GNU parallel for builds..."
    echo ""
    
    # Use GNU parallel
    printf '%s\n' "${VMS[@]}" | parallel -j "$PARALLEL_JOBS" --colsep ':' 'build_vm {1} {2}'
    BUILD_EXIT=$?
    
elif command -v xargs &> /dev/null; then
    echo "Using xargs for builds..."
    echo ""
    
    # Use xargs (macOS compatible)
    printf '%s\n' "${VMS[@]}" | xargs -P "$PARALLEL_JOBS" -I {} bash -c 'IFS=":"; set -- {}; build_vm "$1" "$2"'
    BUILD_EXIT=$?
    
else
    echo "⚠️  No parallel tool found, building sequentially..."
    echo ""
    
    # Fallback to sequential
    BUILD_EXIT=0
    for VM_ENTRY in "${VMS[@]}"; do
        IFS=':' read -r VM_NAME VM_DESC <<< "$VM_ENTRY"
        build_vm "$VM_NAME" "$VM_DESC" || BUILD_EXIT=1
    done
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo "======================================================================"
echo "  Build Summary"
echo "======================================================================"
echo ""
echo "Total time: ${MINUTES}m ${SECONDS}s"
echo ""
echo "Built VMs:"
ls -lh "$OUTPUT_DIR"/*.img 2>/dev/null || echo "No VMs built"
echo ""
echo "Build logs: ${LOG_DIR}/build-*.log"
echo ""

if [ $BUILD_EXIT -eq 0 ]; then
    echo "🎉 All VMs built successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Start VibeCode app: ./scripts/launch-vibecode.sh"
    echo "  2. VMs will auto-discover from dist/vm-images/"
    echo "  3. Datadog agents will start on first boot"
    echo "  4. Check dashboard: https://app.${DATADOG_SITE}/infrastructure"
    echo ""
else
    echo "⚠️  Some builds failed - check logs above"
    exit 1
fi
