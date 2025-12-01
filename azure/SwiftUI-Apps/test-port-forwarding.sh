#!/bin/bash
# Test port forwarding in ValkeyVibeCode.app

cd ~/vibecode-webgui/azure/SwiftUI-Apps

# Kill any existing VM
killall ValkeyVibeCode 2>/dev/null
rm -f /tmp/vibecode-console-*.log

echo "Launching ValkeyVibeCode.app with port forwarding..."
./ValkeyVibeCode.app/Contents/MacOS/ValkeyVibeCode > /tmp/valkey-test-portforward.log 2>&1 &
VM_PID=$!
echo "VM PID: $VM_PID"
echo ""
echo "Waiting 45 seconds for VM to boot and port forwarding to start..."
sleep 45

echo ""
echo "=== Checking VM Access ==="
VM_IP=$(tail -50 /tmp/vibecode-console-*.log 2>/dev/null | grep -oE "192\.168\.64\.[0-9]+" | head -1 || echo "")
if [ -n "$VM_IP" ]; then
    echo "VM IP: $VM_IP"
    echo ""
    echo "1. Testing VM direct access ($VM_IP:6379):"
    redis-cli -h "$VM_IP" -p 6379 PING 2>&1 || echo "Failed"
else
    echo "Could not detect VM IP from console logs"
fi

echo ""
echo "2. Testing localhost port forwarding (localhost:6379):"
redis-cli -h localhost -p 6379 PING 2>&1 || echo "Failed"

echo ""
echo "3. Checking what's listening on localhost:6379:"
lsof -i :6379 -P -n | grep LISTEN || echo "Nothing listening on 6379"

echo ""
echo "4. Console log excerpts:"
tail -30 /tmp/vibecode-console-*.log 2>/dev/null | grep -E "(Valkey|SUCCESS|IP address|port)" || echo "(no Valkey messages)"

echo ""
echo "5. Application stdout/stderr:"
tail -20 /tmp/valkey-test-portforward.log
