#!/bin/bash

cd /Users/ryan.maclean/vibecode-webgui/azure

echo "Launching Node.js VM..."
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode > /tmp/test-vm-launch.log 2>&1 &
VM_PID=$!

echo "VM PID: $VM_PID"
echo "Waiting 15 seconds..."
sleep 15

echo ""
echo "Console logs:"
ls -lt /tmp/vibecode-console*.log 2>/dev/null | head -3

echo ""
echo "Checking if VM is running..."
ps aux | grep $VM_PID | grep -v grep

echo ""
echo "Stopping VM..."
kill $VM_PID 2>/dev/null
sleep 2

echo "Done"
