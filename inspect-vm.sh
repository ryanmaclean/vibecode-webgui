#!/bin/bash

cd /Users/ryan.maclean/vibecode-webgui/azure
rm -f /tmp/vibecode-console-*.log

echo "Starting Node.js VM..."
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS > /tmp/test-nodejs.log 2>&1 &
VM_PID=$!

echo "PID: $VM_PID"
echo "Waiting 45 seconds..."
sleep 45

LOGFILE=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

if [ -n "$LOGFILE" ]; then
    echo "Console log: $LOGFILE"
    echo ""
    echo "=== Last 50 lines ==="
    tail -50 "$LOGFILE"
else
    echo "No console log found"
fi

echo ""
echo "Killing VM..."
kill $VM_PID 2>/dev/null
