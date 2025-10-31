#!/usr/bin/env bash
# Launch Valkey VM for testing
# Uses existing Alpine infrastructure with port forwarding for Valkey

set -euo pipefail

VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
KERNEL="${VM_DIR}/kernel/vmlinux"
INITRAMFS="${VM_DIR}/kernel/initramfs"
DISK="${VM_DIR}/disk/root.img"
LOG="/tmp/valkey-vm.log"

echo "=== Launching Valkey VM Test ==="
echo "Kernel: ${KERNEL}"
echo "Initrd: ${INITRAMFS}"
echo "Disk: ${DISK}"
echo "Log: ${LOG}"
echo ""

# Verify files exist
if [[ ! -f "$KERNEL" ]]; then
    echo "ERROR: Kernel not found: $KERNEL"
    exit 1
fi

if [[ ! -f "$INITRAMFS" ]]; then
    echo "ERROR: Initramfs not found: $INITRAMFS"
    exit 1
fi

if [[ ! -f "$DISK" ]]; then
    echo "ERROR: Disk not found: $DISK"
    exit 1
fi

# Launch VM with vfkit
/Users/ryan.maclean/vibecode-webgui/src-tauri/resources/vfkit-aarch64-apple-darwin \
    --cpus 2 \
    --memory 1024 \
    --kernel "$KERNEL" \
    --initrd "$INITRAMFS" \
    --kernel-cmdline "console=hvc0 root=/dev/vda rw quiet" \
    --device "virtio-blk,path=$DISK" \
    --device "virtio-net,nat,mac=52:54:00:12:34:59" \
    --device "virtio-serial,logFilePath=$LOG" \
    --device "virtio-rng" \
    > /tmp/valkey-vm-stdout.log 2>&1 &

VM_PID=$!
echo "VM started with PID: $VM_PID"
echo "Waiting for boot..."
sleep 10

if ps -p $VM_PID > /dev/null 2>&1; then
    echo "VM is running!"
    echo "Check console log: $LOG"
    echo "Check stdout: /tmp/valkey-vm-stdout.log"
    echo ""
    echo "To stop: kill $VM_PID"
else
    echo "VM failed to start"
    echo "Check logs:"
    cat /tmp/valkey-vm-stdout.log
    exit 1
fi
