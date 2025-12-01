#!/bin/bash
# One-Click VibeCode Launcher
# Launches VM, waits for boot, extracts token, and opens browser automatically

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== VibeCode One-Click Launcher ===${NC}"
echo ""

# Configuration
APP_PATH="/Applications/BasicVibeCode.app"
CONSOLE_LOG_PATTERN="/tmp/vibecode-console-*.log"
VM_IP="192.168.64.3"
VM_PORT="8080"
BOOT_WAIT_TIME=30

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo -e "${YELLOW}⚠ App not found at $APP_PATH${NC}"
    echo "Looking for app in build directory..."
    APP_PATH="$HOME/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app"

    if [ ! -d "$APP_PATH" ]; then
        echo -e "${YELLOW}⚠ App not found. Please build first:${NC}"
        echo "  cd ~/vibecode-webgui/azure/SwiftUI-Apps"
        echo "  bash bundle-apps.sh"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Found app at: $APP_PATH"

# Check if VM is already running
if ps aux | grep -v grep | grep -q "BasicVibeCode"; then
    echo -e "${YELLOW}⚠ VM is already running${NC}"
    echo ""
    echo "Choose an option:"
    echo "  1) Open browser to existing VM"
    echo "  2) Restart VM"
    echo "  3) Exit"
    echo -n "Choice [1/2/3]: "
    read -r choice

    case "$choice" in
        1)
            echo -e "${BLUE}Opening browser...${NC}"
            ;;
        2)
            echo -e "${BLUE}Restarting VM...${NC}"
            killall BasicVibeCode 2>/dev/null || true
            sleep 3
            ;;
        *)
            echo "Exiting."
            exit 0
            ;;
    esac
fi

# Launch VM if not running
if ! ps aux | grep -v grep | grep -q "BasicVibeCode"; then
    echo -e "${BLUE}▸ Launching VM...${NC}"
    "$APP_PATH/Contents/MacOS/BasicVibeCode" > /dev/null 2>&1 &

    echo -e "${YELLOW}⏳ Waiting ${BOOT_WAIT_TIME} seconds for boot...${NC}"

    # Progress indicator
    for i in $(seq 1 $BOOT_WAIT_TIME); do
        printf "\r   %2d/%2d seconds" "$i" "$BOOT_WAIT_TIME"
        sleep 1
    done
    echo ""
fi

# Wait for console log to appear
echo -e "${BLUE}▸ Checking VM status...${NC}"
MAX_WAIT=10
for i in $(seq 1 $MAX_WAIT); do
    if ls $CONSOLE_LOG_PATTERN 1> /dev/null 2>&1; then
        break
    fi
    if [ "$i" -eq "$MAX_WAIT" ]; then
        echo -e "${YELLOW}⚠ Console log not found${NC}"
        echo "Opening browser with default URL..."
        break
    fi
    sleep 1
done

# Check network status
if ls $CONSOLE_LOG_PATTERN 1> /dev/null 2>&1; then
    LATEST_LOG=$(ls -t $CONSOLE_LOG_PATTERN | head -1)

    if grep -q "eth0.*UP" "$LATEST_LOG" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Network interface UP"
    else
        echo -e "${YELLOW}⚠ Network might not be ready${NC}"
    fi

    if grep -q "DHCP successful" "$LATEST_LOG" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} DHCP configured"
    fi

    if grep -q "TCP relay active" "$LATEST_LOG" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} TCP relay active"
    fi
fi

# Test port accessibility
echo -e "${BLUE}▸ Testing connectivity...${NC}"
if nc -zv -w 3 "$VM_IP" "$VM_PORT" 2>&1 | grep -q "succeeded"; then
    echo -e "${GREEN}✓${NC} VM is accessible on $VM_IP:$VM_PORT"
else
    echo -e "${YELLOW}⚠ Port $VM_PORT not yet accessible (might need more time)${NC}"
fi

# Extract token if available
TOKEN=""
if ls $CONSOLE_LOG_PATTERN 1> /dev/null 2>&1; then
    LATEST_LOG=$(ls -t $CONSOLE_LOG_PATTERN | head -1)
    TOKEN=$(grep "Web UI available" "$LATEST_LOG" 2>/dev/null | tail -1 | grep -oE 'tkn=[a-f0-9-]+' | cut -d= -f2)
fi

# Build URL
if [ -n "$TOKEN" ]; then
    URL="http://${VM_IP}:${VM_PORT}?tkn=${TOKEN}"
    echo -e "${GREEN}✓${NC} Found access token"
else
    URL="http://${VM_IP}:${VM_PORT}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}      OpenVSCode is Ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  ${BLUE}URL:${NC} $URL"
echo ""
echo -e "${BLUE}▸ Opening browser...${NC}"

# Open browser
open "$URL"

echo ""
echo -e "${GREEN}✓ Done!${NC}"
echo ""
echo "Tip: Bookmark this URL for quick access"
echo ""

# Optional: Copy URL to clipboard
echo -n "Copy URL to clipboard? [y/N]: "
read -r copy_choice
if [[ "$copy_choice" =~ ^[Yy]$ ]]; then
    echo "$URL" | pbcopy
    echo -e "${GREEN}✓${NC} URL copied to clipboard"
fi

echo ""
echo "To stop the VM: killall BasicVibeCode"

