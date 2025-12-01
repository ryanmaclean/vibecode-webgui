#!/bin/bash
# ============================================================================
# View VibeCode VM Logs
# ============================================================================
# VMLogger writes to FileManager.default.temporaryDirectory which is:
# /var/folders/{random}/T/ (user's private temp directory)
# ============================================================================

set -euo pipefail

echo "=== VibeCode VM Logs ==="
echo ""

# Find VM log files
VM_LOGS=$(find /var/folders -name "vibecode-vm*.log" -mmin -60 2>/dev/null | sort -r)

if [ -z "$VM_LOGS" ]; then
    echo "No recent VM logs found (last 60 minutes)"
    echo ""
    echo "VMLogger writes to: \$(FileManager.default.temporaryDirectory)/vibecode-vm.log"
    echo "Example: /var/folders/{user-hash}/T/vibecode-vm.log"
    exit 1
fi

echo "Found VM logs:"
echo "$VM_LOGS" | while read -r log; do
    echo "  - $log ($(wc -l < "$log") lines, $(du -h "$log" | cut -f1))"
done
echo ""

# Show content of most recent log
LATEST_LOG=$(echo "$VM_LOGS" | head -1)
echo "=== Latest Log: $LATEST_LOG ==="
echo ""

if [ "${1:-}" = "-f" ] || [ "${1:-}" = "--follow" ]; then
    echo "Following log (Ctrl+C to stop)..."
    tail -f "$LATEST_LOG"
else
    tail -100 "$LATEST_LOG"
    echo ""
    echo "Tip: Use '$0 -f' to follow logs in real-time"
fi
