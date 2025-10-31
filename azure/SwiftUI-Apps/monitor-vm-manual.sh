#!/bin/bash
#
# VM Manual Test Monitor Script
# For use with manually started VMs
#
# Usage:
#   1. Open BasicVibeCode.app or LiquidGlassVibeCode.app
#   2. Click "Start" button in the app UI
#   3. Run this script: ./monitor-vm-manual.sh
#

set -e

CONSOLE_LOG="/tmp/vibecode-console.log"
DHCP_LEASES="/var/db/dhcpd_leases"
VM_MAC_ADDRESS="52:54:00:12:34:90"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VM Manual Test Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Instructions:"
echo "  1. Launch BasicVibeCode.app or LiquidGlassVibeCode.app"
echo "  2. Click the 'Start' button in the app"
echo "  3. This script will monitor the VM and report results"
echo ""
echo -e "${YELLOW}Waiting for VM to start...${NC}"
echo -e "(Watching for console log at $CONSOLE_LOG)"
echo ""

# Wait for console log to appear
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if [ -f "$CONSOLE_LOG" ]; then
        echo -e "${GREEN}✓ Console log detected - VM is starting!${NC}"
        break
    fi
    sleep 1
    ((elapsed++))

    # Show progress
    if [ $((elapsed % 10)) -eq 0 ]; then
        echo "  Still waiting... (${elapsed}s elapsed)"
    fi
done

if [ ! -f "$CONSOLE_LOG" ]; then
    echo -e "${RED}✗ Timeout waiting for console log${NC}"
    echo -e "${YELLOW}Did you click the 'Start' button in the app?${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Monitoring VM Boot Process${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: virtio_net driver
echo -e "${BLUE}[1/5]${NC} Checking for virtio_net driver..."
timeout=20
elapsed=0
found=false

while [ $elapsed -lt $timeout ]; do
    if grep -q "virtio_net" "$CONSOLE_LOG" 2>/dev/null; then
        echo -e "${GREEN}  ✓ virtio_net driver loaded${NC}"
        found=true
        break
    fi
    sleep 1
    ((elapsed++))
done

if ! $found; then
    echo -e "${RED}  ✗ virtio_net not detected${NC}"
fi

# Test 2: eth0 interface
echo -e "${BLUE}[2/5]${NC} Checking for eth0 network interface..."
timeout=20
elapsed=0
found=false

while [ $elapsed -lt $timeout ]; do
    if grep -q "eth0" "$CONSOLE_LOG" 2>/dev/null; then
        echo -e "${GREEN}  ✓ eth0 interface configured${NC}"
        found=true
        break
    fi
    sleep 1
    ((elapsed++))
done

if ! $found; then
    echo -e "${RED}  ✗ eth0 not detected${NC}"
fi

# Test 3: DHCP IP assignment
echo -e "${BLUE}[3/5]${NC} Checking DHCP IP assignment..."
timeout=30
elapsed=0
found_ip=""

while [ $elapsed -lt $timeout ]; do
    if [ -r "$DHCP_LEASES" ]; then
        # Parse DHCP leases
        current_mac=""
        while IFS= read -r line; do
            if [[ "$line" =~ hw_address=1,([0-9a-fA-F:]+) ]]; then
                current_mac="${BASH_REMATCH[1]}"
            fi
            if [[ "$line" =~ ip_address=([0-9.]+) ]]; then
                if [ "$current_mac" = "$VM_MAC_ADDRESS" ]; then
                    found_ip="${BASH_REMATCH[1]}"
                    break 2
                fi
            fi
            if [[ "$line" =~ ^\{ ]]; then
                current_mac=""
            fi
        done < "$DHCP_LEASES"
    fi
    sleep 1
    ((elapsed++))
done

if [ -n "$found_ip" ]; then
    echo -e "${GREEN}  ✓ IP assigned: $found_ip${NC}"
else
    echo -e "${RED}  ✗ No IP address assigned${NC}"
fi

# Test 4: OpenVSCode server startup
echo -e "${BLUE}[4/5]${NC} Checking for OpenVSCode server startup..."
timeout=60
elapsed=0
found=false

while [ $elapsed -lt $timeout ]; do
    if grep -q "Server will be available" "$CONSOLE_LOG" 2>/dev/null; then
        echo -e "${GREEN}  ✓ Server started${NC}"
        found=true
        break
    fi
    sleep 1
    ((elapsed++))

    # Show progress for long waits
    if [ $((elapsed % 15)) -eq 0 ]; then
        echo "    Still waiting for server... (${elapsed}s)"
    fi
done

if ! $found; then
    echo -e "${RED}  ✗ Server startup message not found${NC}"
fi

# Test 5: HTTP connectivity
echo -e "${BLUE}[5/5]${NC} Testing HTTP connectivity..."

if [ -n "$found_ip" ]; then
    # Give server a moment to fully start
    sleep 3

    if curl -s -m 5 "http://$found_ip:3000" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Server responding at http://$found_ip:3000${NC}"
    else
        echo -e "${YELLOW}  ? Server not responding yet (may still be starting)${NC}"
    fi
else
    echo -e "${YELLOW}  ? Cannot test - no IP address${NC}"
fi

# Display summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Console Log (last 40 lines)${NC}"
echo -e "${BLUE}========================================${NC}"
tail -n 40 "$CONSOLE_LOG" | sed 's/^/  /'

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Complete${NC}"
echo -e "${BLUE}========================================${NC}"

if [ -n "$found_ip" ]; then
    echo ""
    echo -e "${GREEN}VM is running successfully!${NC}"
    echo -e "VM IP: ${GREEN}$found_ip${NC}"
    echo -e "Server URL: ${GREEN}http://$found_ip:3000${NC}"
    echo ""
    echo "You can now:"
    echo "  • Open the server URL in your browser"
    echo "  • Access the app's UI to see the status"
    echo "  • Test VSCode functionality"
fi

echo ""
