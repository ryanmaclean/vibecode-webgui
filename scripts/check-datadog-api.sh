#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Check Datadog API for VibeCode metrics and logs

# Initialize log aggregation
init_log_aggregation


set -e

# Get API keys from datadog config
DD_API_KEY=$(grep api_key /opt/datadog-agent/etc/datadog.yaml | head -1 | awk '{print $2}')
DD_APP_KEY=$(grep app_key /opt/datadog-agent/etc/datadog.yaml | head -1 | awk '{print $2}')

if [ -z "$DD_API_KEY" ] || [ -z "$DD_APP_KEY" ]; then
    echo "ERROR: Could not find Datadog API keys"
    exit 1
fi

echo "Datadog API Check"
echo "================="
echo ""

# Test API connectivity
echo "[1/5] Testing API connectivity..."
VALIDATE=$(curl -s -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}")

if echo "$VALIDATE" | jq -e '.valid' > /dev/null 2>&1; then
    echo "  PASS: API keys valid"
else
    echo "  FAIL: Invalid API keys"
    exit 1
fi

# Check for vibecode metrics
echo ""
echo "[2/5] Searching for vibecode metrics..."
METRICS=$(curl -s -X GET "https://api.datadoghq.com/api/v1/metrics?filter=vibecode" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}")

METRIC_COUNT=$(echo "$METRICS" | jq -r '.metrics[]?' | wc -l | tr -d ' ')
if [ "$METRIC_COUNT" -gt 0 ]; then
    echo "  PASS: Found $METRIC_COUNT vibecode metrics"
    echo "$METRICS" | jq -r '.metrics[]?'
else
    echo "  INFO: No vibecode metrics found yet"
fi

# Query specific metric
echo ""
echo "[3/5] Querying vibecode.vm.discovered_count..."
FROM_TIME=$(($(date +%s) - 600))
TO_TIME=$(date +%s)

QUERY=$(curl -s -X GET "https://api.datadoghq.com/api/v1/query?from=${FROM_TIME}&to=${TO_TIME}&query=vibecode.vm.discovered_count{*}" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}")

if echo "$QUERY" | jq -e '.series[]?' > /dev/null 2>&1; then
    echo "  PASS: Metric data found"
    echo "$QUERY" | jq '.series[] | {metric: .metric, points: .pointlist[-1]}'
else
    echo "  INFO: No data points yet"
    echo "$QUERY" | jq '.'
fi

# Check logs
echo ""
echo "[4/5] Checking vibecode logs..."
LOGS=$(curl -s -X POST "https://api.datadoghq.com/api/v2/logs/events/search" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": {
      \"query\": \"service:vibecode\",
      \"from\": \"${FROM_TIME}000\",
      \"to\": \"now\"
    },
    \"page\": {
      \"limit\": 5
    }
  }")

LOG_COUNT=$(echo "$LOGS" | jq -r '.data[]?' | wc -l | tr -d ' ')
if [ "$LOG_COUNT" -gt 0 ]; then
    echo "  PASS: Found $LOG_COUNT log entries"
    echo "$LOGS" | jq -r '.data[] | .attributes.attributes.message' | head -5
else
    echo "  INFO: No vibecode logs found"
fi

# Check agent status
echo ""
echo "[5/5] Checking local agent..."
if datadog-agent status 2>&1 | grep -q "Forwarder"; then
    QUEUED=$(datadog-agent status 2>&1 | grep "Transactions" | head -1)
    echo "  PASS: Agent running - $QUEUED"
else
    echo "  WARN: Cannot read agent status"
fi

echo ""
echo "================="
echo "Summary:"
echo "  - API: Valid"
echo "  - Metrics: $METRIC_COUNT found"
echo "  - Logs: $LOG_COUNT found"
echo ""
echo "View in Datadog:"
echo "  Metrics: https://app.datadoghq.com/metric/summary?filter=vibecode"
echo "  Logs: https://app.datadoghq.com/logs?query=service%3Avibecode"

