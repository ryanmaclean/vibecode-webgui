#!/usr/bin/env bash
# Monitor kernel build progress on M2 Ultra
set -euo pipefail

echo "=== M2 Ultra Kernel Build Monitor ==="
echo "Time: $(date)"
echo "VM: ubuntu-zfs (aarch64, 2 cores)"
echo ""

# Check if build is running
BUILD_PROCS=$(limactl shell ubuntu-zfs ps aux | grep -E "make|gcc|cc1" | grep -v grep | wc -l)
echo "Active build processes: ${BUILD_PROCS}"

if [ "$BUILD_PROCS" -gt 0 ]; then
    echo "Status: Building... 🔨"
else
    echo "Status: Build may be complete or not started"
fi

echo ""
echo "--- Last 40 lines of build log ---"
limactl shell ubuntu-zfs tail -40 /tmp/kernel-build-final.log 2>/dev/null || echo "Log not yet available"

echo ""
echo "--- Check for kernel image ---"
if limactl shell ubuntu-zfs ls /tmp/linux-6.6.52/arch/arm64/boot/Image 2>/dev/null; then
    echo "✅ Kernel built successfully!"
    limactl shell ubuntu-zfs ls -lh /tmp/linux-6.6.52/arch/arm64/boot/Image
else
    echo "⏳ Kernel not yet built (still compiling...)"
fi

echo ""
echo "Total log lines: $(limactl shell ubuntu-zfs wc -l /tmp/kernel-build-final.log 2>/dev/null | awk '{print $1}')"
echo ""
echo "To watch live: limactl shell ubuntu-zfs tail -f /tmp/kernel-build-final.log"
