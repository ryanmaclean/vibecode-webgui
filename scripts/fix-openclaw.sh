#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Fix OpenClaw local service

# Initialize log aggregation
init_log_aggregation


set -e

echo "=== OpenClaw Local Service Fix ==="
echo ""

# 1. Ensure log directory exists
mkdir -p /tmp/openclaw
echo "✅ Log directory: /tmp/openclaw"

# 2. Check if app exists
if [ ! -d "/Applications/OpenClaw.app" ]; then
    echo "❌ OpenClaw.app not found in /Applications"
    echo "Please install OpenClaw first"
    exit 1
fi
echo "✅ OpenClaw.app found"

# 3. Ensure plist exists
PLIST="$HOME/Library/LaunchAgents/ai.openclaw.mac.plist"
if [ ! -f "$PLIST" ]; then
    echo "Creating plist file..."
    cat > "$PLIST" << 'PLISTEOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.openclaw.mac</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Applications/OpenClaw.app/Contents/MacOS/OpenClaw</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/studio</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/openclaw/openclaw-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/openclaw/openclaw-stderr.log</string>
</dict>
</plist>
PLISTEOF
    chmod 644 "$PLIST"
    echo "✅ Created plist file"
else
    echo "✅ Plist file exists"
fi

# 4. Unload if loaded
if launchctl list | grep -q "ai.openclaw.mac"; then
    echo "Unloading existing service..."
    launchctl unload "$PLIST" 2>/dev/null || true
    sleep 1
fi

# 5. Load service
echo "Loading service..."
launchctl load "$PLIST" 2>&1 || true
sleep 2

# 6. Kickstart to ensure it runs
echo "Starting service..."
launchctl kickstart -k gui/501/ai.openclaw.mac 2>&1 || true
sleep 3

# 7. Verify it's running
echo ""
echo "=== Verification ==="
if ps aux | grep -i "[O]penClaw" > /dev/null; then
    PID=$(ps aux | grep -i "[O]penClaw" | grep -v grep | awk '{print $2}' | head -1)
    echo "✅ OpenClaw is running (PID: $PID)"
    
    # Check if service is loaded
    if launchctl list | grep -q "ai.openclaw.mac"; then
        echo "✅ Service is loaded"
    else
        echo "⚠️  Service not in launchctl list (may be running as app)"
    fi
    
    # Show recent logs
    echo ""
    echo "=== Recent Logs ==="
    if [ -f /tmp/openclaw/openclaw-stdout.log ]; then
        tail -5 /tmp/openclaw/openclaw-stdout.log | head -5
    fi
    if [ -f /tmp/openclaw/openclaw-stderr.log ]; then
        echo "Errors:"
        tail -5 /tmp/openclaw/openclaw-stderr.log | head -5
    fi
else
    echo "❌ OpenClaw is not running"
    echo ""
    echo "Checking logs for errors..."
    if [ -f /tmp/openclaw/openclaw-stderr.log ]; then
        tail -20 /tmp/openclaw/openclaw-stderr.log
    fi
    exit 1
fi

echo ""
echo "=== Fix Complete ==="
echo "OpenClaw should now be running locally"
echo "Check logs at: /tmp/openclaw/"
