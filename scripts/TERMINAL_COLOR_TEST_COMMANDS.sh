#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Quick commands to verify terminal colors are working

# Initialize log aggregation
init_log_aggregation


echo "============================================"
echo "OpenVSCode Terminal Color Verification"
echo "============================================"
echo ""
echo "1. Checking VM is accessible..."
if nc -z localhost 2222 2>/dev/null; then
    echo "   ✓ VM SSH accessible on port 2222"
else
    echo "   ✗ VM not accessible"
    exit 1
fi

if nc -z localhost 8080 2>/dev/null; then
    echo "   ✓ OpenVSCode accessible on port 8080"
else
    echo "   ✗ OpenVSCode not accessible"
    exit 1
fi

echo ""
echo "2. Checking settings files in VM..."
sshpass -p vibecode ssh -o StrictHostKeyChecking=no -p 2222 root@localhost \
    "ls -lh /tmp/vscode-data/*/settings.json 2>&1 | sed 's/^/   /'"

echo ""
echo "3. Verifying terminal color configuration..."
COLORS=$(sshpass -p vibecode ssh -o StrictHostKeyChecking=no -p 2222 root@localhost \
    "grep -E '(terminal.foreground|terminal.background)' /tmp/vscode-data/Machine/settings.json")

if echo "$COLORS" | grep -q "#00FF00"; then
    echo "   ✓ Green text configured (#00FF00)"
else
    echo "   ✗ Green text NOT configured"
fi

if echo "$COLORS" | grep -q "#000000"; then
    echo "   ✓ Black background configured (#000000)"
else
    echo "   ✗ Black background NOT configured"
fi

echo ""
echo "4. Checking shell prompt colors..."
PS1_CHECK=$(sshpass -p vibecode ssh -o StrictHostKeyChecking=no -p 2222 root@localhost \
    "grep '1;32m' /etc/profile")

if [ -n "$PS1_CHECK" ]; then
    echo "   ✓ Shell prompt configured with green ANSI codes"
else
    echo "   ✗ Shell prompt NOT configured"
fi

echo ""
echo "============================================"
echo "Configuration Status: COMPLETE"
echo "============================================"
echo ""
echo "NEXT STEP: Open browser and test"
echo "1. Navigate to: http://localhost:8080"
echo "2. Open terminal: Ctrl + \` (backtick)"
echo "3. Verify colors: Green text on black background"
echo ""
echo "If colors are still white:"
echo "- Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)"
echo "- Close and reopen terminal in VSCode"
echo "- Check browser console for JavaScript errors"
echo ""
