#!/bin/bash
# Agent 3: Test Enhanced Installation Script
set -e

echo "=== Agent 3: Testing Installation Script ==="

SCRIPT="scripts/vz/install-openclaw-in-vm-enhanced.sh"

# Check script exists
if [ ! -f "$SCRIPT" ]; then
    echo "❌ Script not found: $SCRIPT"
    exit 1
fi

# Validate script syntax
echo "Validating script syntax..."
bash -n "$SCRIPT" && echo "✅ Syntax valid" || {
    echo "❌ Syntax error"
    exit 1
}

# Check for required functions
echo "Checking for required functions..."
grep -q "log()" "$SCRIPT" && echo "✅ log() function present" || echo "⚠️  log() function missing"
grep -q "error()" "$SCRIPT" && echo "✅ error() function present" || echo "⚠️  error() function missing"
grep -q "rollback()" "$SCRIPT" && echo "✅ rollback() function present" || echo "⚠️  rollback() function missing"
grep -q "trap rollback ERR" "$SCRIPT" && echo "✅ Error trap configured" || echo "⚠️  Error trap missing"

# Check for validation steps
echo "Checking validation steps..."
grep -q "openclaw --version" "$SCRIPT" && echo "✅ OpenClaw version check" || echo "⚠️  Version check missing"
grep -q "curl.*health" "$SCRIPT" && echo "✅ Health check" || echo "⚠️  Health check missing"

echo ""
echo "✅ Installation script validation complete"
echo "Script ready for VM testing"
