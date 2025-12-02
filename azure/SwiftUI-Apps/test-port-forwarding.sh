#!/bin/bash

echo "=== VMPortForwarder Test Script ==="
echo ""

# Kill existing instances
echo "1. Stopping any existing ValkeyVibeCode instances..."
killall ValkeyVibeCode 2>/dev/null
sleep 2

# Start the app
echo "2. Starting ValkeyVibeCode app..."
open /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/ValkeyVibeCode.app
sleep 3

# Monitor for VM startup and IP detection
echo "3. Monitoring VM startup (waiting 30 seconds)..."
for i in {1..30}; do
    # Check if VM has an IP
    IP=$(for ip in 192.168.64.{2..15}; do nc -z -w 1 $ip 6379 2>/dev/null && echo $ip && break; done)

    if [ -n "$IP" ]; then
        echo "   ✓ Valkey VM detected at $IP:6379 (after ${i}s)"
        VALKEY_IP=$IP
        break
    fi

    if [ $((i % 5)) -eq 0 ]; then
        echo "   ... still waiting (${i}s)"
    fi
    sleep 1
done

if [ -z "$VALKEY_IP" ]; then
    echo "   ✗ ERROR: Valkey VM did not start within 30 seconds"
    exit 1
fi

echo ""
echo "4. Testing direct VM connection..."
if redis-cli -h $VALKEY_IP -p 6379 PING 2>&1 | grep -q PONG; then
    echo "   ✓ Direct connection to VM works: redis-cli -h $VALKEY_IP -p 6379"
else
    echo "   ✗ Direct connection to VM failed"
fi

echo ""
echo "5. Testing port forwarding on localhost:6379..."
sleep 2  # Give port forwarder time to start

# Check if port 6379 is listening on localhost
if lsof -i :6379 -n -P | grep -q LISTEN; then
    echo "   ✓ Port 6379 is listening on localhost"

    # Try to connect
    if redis-cli -h localhost -p 6379 PING 2>&1 | grep -q PONG; then
        echo "   ✓ Port forwarding WORKS! localhost:6379 → $VALKEY_IP:6379"
        echo ""
        echo "SUCCESS: VMPortForwarder is working correctly"
        exit 0
    else
        echo "   ✗ Port 6379 is listening but connection failed"
        echo "   (Port forwarder might be starting up...)"
    fi
else
    echo "   ✗ Port 6379 is NOT listening on localhost"
    echo "   This means VMPortForwarder.forwardService() was not called"
    echo "   or failed to start the listener"
fi

echo ""
echo "6. Checking for VMPortForwarder in running processes..."
if lsof -c ValkeyVibeCode -i :6379 2>&1 | grep -q LISTEN; then
    echo "   ✓ ValkeyVibeCode is listening on port 6379"
else
    echo "   ✗ ValkeyVibeCode is NOT listening on port 6379"
fi

echo ""
echo "7. Diagnosis:"
echo "   - VM IP: $VALKEY_IP"
echo "   - VM Valkey: Accessible at $VALKEY_IP:6379"
echo "   - Port Forward: NOT WORKING (localhost:6379)"
echo ""
echo "   Possible causes:"
echo "   a) onIPAddressDetected() callback not being fired"
echo "   b) VMPortForwarder.forwardService() failing silently"
echo "   c) Network framework listener not starting"
echo "   d) DHCP lease monitor not detecting IP"
echo ""
echo "FAILURE: VMPortForwarder is not forwarding ports"
exit 1
