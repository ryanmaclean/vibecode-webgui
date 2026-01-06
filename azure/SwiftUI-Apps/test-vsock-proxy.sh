#!/bin/bash
# Test script to verify vsock proxy server starts correctly
# Usage: ./test-vsock-proxy.sh

set -e

echo "================================================"
echo "Vsock Proxy Server Test"
echo "================================================"
echo ""

# Kill any existing BasicVibeCode instances
echo "[1] Cleaning up existing processes..."
pkill -9 BasicVibeCode || true
sleep 1

# Start the app in background
echo "[2] Starting BasicVibeCode app..."
open -a "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app" &
APP_PID=$!

echo "    App launched (PID: $APP_PID)"
echo ""

# Wait for VM to start and proxy to initialize
echo "[3] Waiting for VM to start (10 seconds)..."
for i in {1..10}; do
    echo -n "."
    sleep 1
done
echo ""
echo ""

# Check if port 3000 is listening
echo "[4] Checking if port 3000 is listening..."
if lsof -i :3000 -P -n | grep LISTEN; then
    echo "    ✓ Port 3000 is LISTENING!"
    echo ""

    # Try to connect
    echo "[5] Testing connection to localhost:3000..."
    if timeout 5 bash -c "echo > /dev/tcp/localhost/3000" 2>/dev/null; then
        echo "    ✓ Connection successful!"
        echo ""
        echo "================================================"
        echo "TEST PASSED: Vsock proxy is working!"
        echo "================================================"
    else
        echo "    ✗ Connection failed (timeout or refused)"
        echo ""
        echo "================================================"
        echo "TEST INCONCLUSIVE: Port listening but not accepting connections"
        echo "This may be normal if the guest service isn't ready yet"
        echo "================================================"
    fi
else
    echo "    ✗ Port 3000 is NOT listening"
    echo ""
    echo "================================================"
    echo "TEST FAILED: Proxy not started"
    echo "================================================"

    # Show relevant logs
    echo ""
    echo "Recent console logs:"
    log show --predicate 'subsystem == "com.apple.virtualization"' --last 30s 2>/dev/null | tail -20 || echo "  (Could not retrieve logs)"
fi

echo ""
echo "[6] Cleanup: Stopping app..."
pkill -9 BasicVibeCode || true

echo ""
echo "Test complete."
