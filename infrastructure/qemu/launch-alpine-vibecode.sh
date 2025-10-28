#!/bin/bash
# Launch Alpine Linux ARM64 + VibeCode VM

set -euo pipefail

# Configuration
OUTPUT_DIR="output-alpine-vibecode"
VM_NAME="alpine-vibecode-arm64"
MEMORY="${MEMORY:-4096}"
CPUS="${CPUS:-2}"

# Check if VM image exists
if [ ! -f "$OUTPUT_DIR/$VM_NAME.qcow2" ]; then
    echo "ERROR: VM image not found!"
    echo "Run ./build-alpine-vibecode.sh first"
    exit 1
fi

echo "Launching Alpine Linux ARM64 + VibeCode..."
echo "VM: $OUTPUT_DIR/$VM_NAME.qcow2"
echo "SSH: ssh -p 2222 root@localhost (password: vibecode)"
echo "Web: http://localhost:3000"
echo

qemu-system-aarch64 \
    -machine virt \
    -cpu host \
    -accel hvf \
    -smp $CPUS \
    -m $MEMORY \
    -bios /opt/homebrew/share/qemu/edk2-aarch64-code.fd \
    -drive file="$OUTPUT_DIR/$VM_NAME.qcow2",if=virtio,format=qcow2 \
    -device virtio-net-pci,netdev=net0 \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::3000-:3000 \
    -serial mon:stdio \
    -display cocoa
