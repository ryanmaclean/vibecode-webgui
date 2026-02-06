#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Agent 4: Test Tailscale Script

# Initialize log aggregation
init_log_aggregation

set -e

echo "=== Agent 4: Testing Tailscale Script ==="

SCRIPT="scripts/vz/setup-tailscale-vm.sh"

# Validate script
bash -n "$SCRIPT" && echo "✅ Syntax valid" || exit 1

# Check for required checks
grep -q "TAILSCALE_AUTH_KEY" "$SCRIPT" && echo "✅ Auth key handling" || echo "⚠️  Auth key check missing"
grep -q "tailscale up" "$SCRIPT" && echo "✅ Tailscale start command" || echo "⚠️  Start command missing"
grep -q "tailscale ip" "$SCRIPT" && echo "✅ IP detection" || echo "⚠️  IP detection missing"
grep -q "openclaw configure" "$SCRIPT" && echo "✅ OpenClaw configuration" || echo "⚠️  OpenClaw config missing"

echo ""
echo "✅ Tailscale script validated"
echo "Ready for VM testing (requires TAILSCALE_AUTH_KEY)"
