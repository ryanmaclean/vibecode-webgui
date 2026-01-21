#!/bin/bash
#
# vm-terminal-resize.sh
# VibeCode Terminal Resize Handler
#
# Purpose: Handle terminal resize events and propagate to VM PTY
# Usage: ./scripts/vm-terminal-resize.sh PTY_DEVICE
#

set -e

PTY_DEVICE=$1

if [ -z "$PTY_DEVICE" ]; then
    echo "Usage: $0 PTY_DEVICE"
    echo "Example: $0 /dev/ttys001"
    exit 1
fi

if [ ! -e "$PTY_DEVICE" ]; then
    echo "Error: PTY device does not exist: $PTY_DEVICE"
    exit 1
fi

# Function to get current terminal size and set PTY size
update_pty_size() {
    # Get current terminal dimensions
    local rows=$(tput lines)
    local cols=$(tput cols)

    echo "Setting PTY size: ${rows}x${cols}"

    # Use stty to set PTY size
    stty -F "$PTY_DEVICE" rows "$rows" cols "$cols" 2>/dev/null || \
    stty rows "$rows" cols "$cols" < "$PTY_DEVICE" 2>/dev/null || \
    echo "Warning: Could not set PTY size"
}

# Set initial size
update_pty_size

# Monitor for SIGWINCH (window change signal)
trap update_pty_size WINCH

echo "Monitoring terminal resize events for $PTY_DEVICE"
echo "Press Ctrl+C to stop"

# Keep script running
while true; do
    sleep 1
done
