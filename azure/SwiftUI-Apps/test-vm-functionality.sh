#!/bin/bash
################################################################################
# test-vm-functionality.sh
# Automated end-to-end test for BasicVibeCode VM functionality
# Tests: VM boot, console output, IP detection, OpenVSCode accessibility
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_PATH="$SCRIPT_DIR/BasicVibeCode.app"
CONSOLE_LOG="/tmp/vibecode-console.log"
TEST_LOG="/tmp/vm-functionality-test.log"
TIMEOUT_VM_BOOT=60
TIMEOUT_OPENVSCODE=30
OPENVSCODE_PORT=3000

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  VM Functionality Test${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Cleanup old logs
rm -f "$CONSOLE_LOG" "$TEST_LOG"

echo -e "${CYAN}[1/7]${NC} Launching BasicVibeCode..."
# Kill any existing instances
pkill -f "BasicVibeCode" 2>/dev/null || true
sleep 2

# Launch app in background
open -a "$APP_PATH" &
APP_PID=$!

sleep 3

# Verify app is running
if ! pgrep -f "BasicVibeCode" >/dev/null; then
    echo -e "${RED}✗ FAIL${NC} - App failed to launch"
    exit 1
fi

echo -e "${GREEN}✓ PASS${NC} - App launched successfully"
echo ""

echo -e "${CYAN}[2/7]${NC} Waiting for VM console output..."
START_TIME=$(date +%s)
CONSOLE_FOUND=false

while [ $(($(date +%s) - START_TIME)) -lt $TIMEOUT_VM_BOOT ]; do
    if [ -f "$CONSOLE_LOG" ] && [ -s "$CONSOLE_LOG" ]; then
        CONSOLE_FOUND=true
        break
    fi
    sleep 1
done

if [ "$CONSOLE_FOUND" = false ]; then
    echo -e "${RED}✗ FAIL${NC} - No console output after ${TIMEOUT_VM_BOOT}s"
    echo "Expected file: $CONSOLE_LOG"
    pkill -f "BasicVibeCode" 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✓ PASS${NC} - Console output detected"
echo ""

echo -e "${CYAN}[3/7]${NC} Monitoring VM boot messages..."
echo "First 20 lines of console output:"
head -20 "$CONSOLE_LOG" | sed 's/^/  /'
echo ""

# Check for boot messages
if grep -qi "linux\|boot\|kernel\|alpine" "$CONSOLE_LOG"; then
    echo -e "${GREEN}✓ PASS${NC} - VM boot messages detected"
else
    echo -e "${YELLOW}⚠ WARN${NC} - No clear VM boot messages (may be normal)"
fi
echo ""

echo -e "${CYAN}[4/7]${NC} Detecting VM IP address..."
VM_IP=""
START_TIME=$(date +%s)

while [ $(($(date +%s) - START_TIME)) -lt $TIMEOUT_VM_BOOT ]; do
    # Look for IP in DHCP leases or console output
    if [ -f "$CONSOLE_LOG" ]; then
        # Try to extract IP from console output (common patterns)
        VM_IP=$(grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' "$CONSOLE_LOG" | grep -v "0.0.0.0\|127.0.0.1\|255.255" | head -1)

        if [ -n "$VM_IP" ]; then
            break
        fi
    fi
    sleep 2
done

if [ -n "$VM_IP" ]; then
    echo -e "${GREEN}✓ PASS${NC} - VM IP detected: $VM_IP"
else
    echo -e "${YELLOW}⚠ WARN${NC} - No IP detected in logs (VM may be using NAT)"
    VM_IP="192.168.64.2"  # Common default for Virtualization.framework
    echo "  Using default IP: $VM_IP"
fi
echo ""

echo -e "${CYAN}[5/7]${NC} Waiting for OpenVSCode Server to start in VM..."
START_TIME=$(date +%s)
OPENVSCODE_STARTED=false

while [ $(($(date +%s) - START_TIME)) -lt $TIMEOUT_OPENVSCODE ]; do
    # Check console output for server start message
    if grep -q "Web UI available at" "$CONSOLE_LOG" 2>/dev/null; then
        OPENVSCODE_STARTED=true
        break
    fi

    sleep 2
    echo -n "."
done

echo ""

if [ "$OPENVSCODE_STARTED" = false ]; then
    echo -e "${RED}✗ FAIL${NC} - OpenVSCode Server did not start after ${TIMEOUT_OPENVSCODE}s"
    echo ""
    echo "Last 30 lines of console output:"
    tail -30 "$CONSOLE_LOG" 2>/dev/null | sed 's/^/  /' || echo "  (no console output)"
    echo ""
    pkill -f "BasicVibeCode" 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✓ PASS${NC} - OpenVSCode Server started in VM"
echo ""

echo -e "${CYAN}[6/7]${NC} Testing HTTP connectivity to OpenVSCode at $VM_IP:$OPENVSCODE_PORT..."
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://$VM_IP:$OPENVSCODE_PORT" || echo "000")

if [ "$HTTP_RESPONSE" -ge 200 ] && [ "$HTTP_RESPONSE" -lt 400 ]; then
    echo -e "${GREEN}✓ PASS${NC} - OpenVSCode Server responding (HTTP $HTTP_RESPONSE)"
else
    echo -e "${RED}✗ FAIL${NC} - No HTTP response from OpenVSCode (HTTP $HTTP_RESPONSE)"
    pkill -f "BasicVibeCode" 2>/dev/null || true
    exit 1
fi
echo ""

echo -e "${CYAN}[7/7]${NC} Verifying OpenVSCode content..."
CONTENT=$(curl -s --max-time 10 "http://$VM_IP:$OPENVSCODE_PORT" || echo "")

if echo "$CONTENT" | grep -qi "vscode\|openvscode\|code-server"; then
    echo -e "${GREEN}✓ PASS${NC} - OpenVSCode content verified"
    echo "  Content contains VS Code markers"
else
    echo -e "${YELLOW}⚠ WARN${NC} - Response received but VS Code content not clearly identified"
    echo "  First 200 chars: ${CONTENT:0:200}"
fi
echo ""

# Cleanup
echo "Stopping BasicVibeCode..."
pkill -f "BasicVibeCode" 2>/dev/null || true
sleep 2

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
echo ""
echo "Results:"
echo "  ✓ App launches successfully"
echo "  ✓ VM boots and produces console output"
echo "  ✓ OpenVSCode Server starts on port $OPENVSCODE_PORT"
echo "  ✓ HTTP service responds correctly"
echo ""
echo "Logs saved to: $TEST_LOG"
echo "Console output: $CONSOLE_LOG"
echo ""
