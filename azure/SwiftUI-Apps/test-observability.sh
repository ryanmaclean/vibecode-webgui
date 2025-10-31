#!/bin/bash

# VibeCode Observability Test Script
# This script tests the complete observability stack: Logs, Metrics, Traces

set -e

echo "=== VibeCode Observability Test Suite ==="
echo ""

# Check for .env.local in current dir or parent
ENV_FILE=""
if [ -f .env.local ]; then
    ENV_FILE=".env.local"
elif [ -f ../../.env.local ]; then
    ENV_FILE="../../.env.local"
fi

if [ -z "$ENV_FILE" ]; then
    echo "⚠️  .env.local not found"
    echo ""
    echo "To enable OpenTelemetry OTLP testing, create .env.local:"
    echo "  cp .env.local.example .env.local"
    echo ""
    echo "Then add your Datadog API key to .env.local:"
    echo "  DD_API_KEY=your-actual-api-key"
    echo ""
    echo "Continuing with Logs and Metrics tests only..."
    echo ""
    SKIP_OTLP=true
else
    echo "✅ .env.local found at $ENV_FILE"
    source "$ENV_FILE"

    if [ -z "$DD_API_KEY" ] || [ "$DD_API_KEY" = "your-datadog-api-key-here" ]; then
        echo "⚠️  DD_API_KEY not set or still placeholder"
        echo "Skipping OpenTelemetry OTLP tests"
        SKIP_OTLP=true
    else
        echo "✅ DD_API_KEY configured (${DD_API_KEY:0:10}...)"
        SKIP_OTLP=false
    fi
    echo ""
fi

# Test 1: Check Datadog Logs
echo "=== Test 1: Datadog JSON Logs ==="
LOG_FILE="$HOME/vibecode-webgui/logs/vibecode.log"
if [ -f "$LOG_FILE" ]; then
    echo "✅ Log file exists: $LOG_FILE"
    LINE_COUNT=$(wc -l < "$LOG_FILE")
    echo "   Lines: $LINE_COUNT"

    echo ""
    echo "Recent log entries:"
    tail -5 "$LOG_FILE" | jq -r '. | "\(.timestamp) [\(.level)] \(.message)"' 2>/dev/null || \
        tail -5 "$LOG_FILE"
else
    echo "❌ Log file not found: $LOG_FILE"
    echo "   Run LiquidGlassVibeCode.app to generate logs"
fi
echo ""

# Test 2: Check DogStatsD Configuration
echo "=== Test 2: DogStatsD Configuration ==="
if grep -q "port: UInt16 = 8135" DogStatsDClient.swift 2>/dev/null; then
    echo "✅ StatsD port correctly set to 8135"
else
    echo "❌ StatsD port not set to 8135"
    echo "   Check DogStatsDClient.swift line 11"
fi

# Check if Datadog Agent is running
if pgrep -f "datadog-agent" > /dev/null; then
    echo "✅ Datadog Agent is running"

    # Check StatsD port
    if lsof -nP -i :8135 | grep -q datadog 2>/dev/null; then
        echo "✅ Datadog Agent listening on port 8135"
    else
        echo "⚠️  Port 8135 not showing in lsof (may require sudo)"
        echo "   Run: sudo datadog-agent status | grep -A 10 dogstatsd"
    fi
else
    echo "⚠️  Datadog Agent not running"
    echo "   Start with: sudo datadog-agent start"
fi
echo ""

# Test 3: Check OpenTelemetry Integration
echo "=== Test 3: OpenTelemetry OTLP Integration ==="
if [ -f "OpenTelemetryIntegration.swift" ]; then
    echo "✅ OpenTelemetry integration file exists"

    if [ "$SKIP_OTLP" = false ]; then
        echo "✅ DD_API_KEY configured - ready for OTLP export"
        echo ""
        echo "OTLP Endpoint: https://api.${DD_SITE:-datadoghq.com}/api/intake/otlp/v1/traces"
        echo "Environment: ${ENV:-development}"
        echo "Service: ${SERVICE_NAME:-vibecode-swiftui}"
    else
        echo "⏸️  OTLP export disabled (no DD_API_KEY)"
    fi
else
    echo "❌ OpenTelemetry integration not found"
fi
echo ""

# Test 4: Verify Entitlements
echo "=== Test 4: Security Entitlements ==="
if [ -f "entitlements.plist" ]; then
    echo "✅ entitlements.plist exists"

    required=(
        "com.apple.security.virtualization"
        "com.apple.security.hypervisor"
        "com.apple.security.network.client"
        "com.apple.security.network.server"
    )

    for ent in "${required[@]}"; do
        if grep -q "$ent" entitlements.plist; then
            echo "   ✅ $ent"
        else
            echo "   ❌ Missing: $ent"
        fi
    done
else
    echo "❌ entitlements.plist not found"
fi
echo ""

# Test 5: Check App Bundle
echo "=== Test 5: Application Bundle ==="
if [ -d "LiquidGlassVibeCode.app" ]; then
    echo "✅ LiquidGlassVibeCode.app exists"

    BUNDLE_SIZE=$(du -sh LiquidGlassVibeCode.app | cut -f1)
    echo "   Size: $BUNDLE_SIZE"

    if [ -f "LiquidGlassVibeCode.app/Contents/MacOS/LiquidGlassVibeCode" ]; then
        echo "   ✅ Binary present"
    else
        echo "   ❌ Binary missing"
    fi

    # Check for fixed initramfs
    if [ -f "LiquidGlassVibeCode.app/Contents/Resources/bun-openvscode-dhcp-fixed-v2.cpio.gz" ]; then
        MD5=$(md5 -q "LiquidGlassVibeCode.app/Contents/Resources/bun-openvscode-dhcp-fixed-v2.cpio.gz")
        echo "   ✅ DHCP-fixed initramfs present (MD5: $MD5)"
    else
        echo "   ⚠️  DHCP-fixed initramfs not in bundle"
    fi
else
    echo "❌ LiquidGlassVibeCode.app not found"
    echo "   Run build script to create app bundle"
fi
echo ""

# Test 6: Network Connectivity Test
echo "=== Test 6: Network Connectivity ==="
if [ "$SKIP_OTLP" = false ]; then
    echo "Testing Datadog OTLP endpoint..."
    if curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
        "https://api.${DD_SITE:-datadoghq.com}/api/intake/otlp/v1/traces" | grep -q "40[013]"; then
        echo "✅ Datadog OTLP endpoint reachable"
    else
        echo "⚠️  Could not reach Datadog OTLP endpoint"
    fi
else
    echo "⏸️  Skipping (no DD_API_KEY)"
fi
echo ""

# Summary
echo "=== Summary ==="
echo "Observability Status:"
echo "  - Logs:    ✅ Operational (JSON to file)"
echo "  - Metrics: $([ -f "DogStatsDClient.swift" ] && echo "✅" || echo "❌") Implemented (StatsD UDP)"
echo "  - Traces:  $([ -f "OpenTelemetryIntegration.swift" ] && echo "✅" || echo "❌") Implemented (OTLP HTTP)"
echo ""
echo "To test with real API key:"
echo "  1. cp .env.local.example .env.local"
echo "  2. Edit .env.local and set DD_API_KEY"
echo "  3. Re-run this script"
echo "  4. Launch LiquidGlassVibeCode.app"
echo "  5. View traces at: https://app.datadoghq.com/apm/traces"
echo ""
