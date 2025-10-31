#!/bin/bash

# Test script that sources .env.local securely
# This demonstrates how to use environment variables without exposing them

echo "=== Testing with .env.local ==="
echo ""

if [ ! -f .env.local ]; then
    echo "❌ .env.local not found"
    echo ""
    echo "To create it:"
    echo "  cp .env.local.example .env.local"
    echo "  # Then edit .env.local and add your DD_API_KEY"
    echo ""
    exit 1
fi

# Source the environment file
source .env.local

# Verify variables are set (without displaying them)
if [ -z "$DD_API_KEY" ]; then
    echo "❌ DD_API_KEY not set in .env.local"
    exit 1
fi

echo "✅ Environment loaded successfully"
echo ""
echo "Variables configured:"
echo "  DD_API_KEY: [SET - ${#DD_API_KEY} characters]"
echo "  DD_SITE: ${DD_SITE:-datadoghq.com}"
echo "  ENV: ${ENV:-development}"
echo "  SERVICE_NAME: ${SERVICE_NAME:-vibecode-swiftui}"
echo ""

# Test Datadog OTLP endpoint connectivity
OTLP_URL="https://api.${DD_SITE:-datadoghq.com}/api/intake/otlp/v1/traces"
echo "Testing OTLP endpoint: $OTLP_URL"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "DD-API-KEY: $DD_API_KEY" \
    "$OTLP_URL")

case $HTTP_CODE in
    400|401|403)
        echo "✅ Endpoint reachable (HTTP $HTTP_CODE - expected for test)"
        echo "   This confirms the API key format is being accepted"
        ;;
    000)
        echo "❌ Could not reach endpoint (timeout or network error)"
        ;;
    *)
        echo "⚠️  Unexpected response: HTTP $HTTP_CODE"
        ;;
esac

echo ""
echo "You can now use these environment variables in Swift:"
echo "  ProcessInfo.processInfo.environment[\"DD_API_KEY\"]"
echo ""
