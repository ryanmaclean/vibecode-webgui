#!/bin/bash
#
# Run Datadog Experiments
#
# This script runs all 3 experiments and tracks results to Datadog LLM Observability
#

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Datadog LLM Observability - Experiments Runner         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if Datadog is configured
if [ -z "$NEXT_PUBLIC_DATADOG_CLIENT_TOKEN" ] && ! grep -q "DATADOG_CLIENT_TOKEN" .env.local 2>/dev/null; then
    echo "⚠️  Warning: Datadog credentials not found"
    echo "   Data will be logged locally but not sent to Datadog"
    echo ""
fi

# Run the experiments
NUM_USERS=${1:-5}

echo "🚀 Running experiments for $NUM_USERS test users..."
echo ""

npx tsx scripts/test-datadog-experiments.ts $NUM_USERS

echo ""
echo "✅ Experiment run complete!"
echo ""
