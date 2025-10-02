#!/bin/bash
# Test Datadog integration

set -e

echo "=== Testing Datadog Integration ===" && \
echo "" && \
echo "Checking container status..." && \
container list && \
echo "" && \
echo "Sending test metric to Datadog..." && \
CONTAINER_COUNT=$(container list --format json 2>/dev/null | jq '. | length' || echo 0) && \
echo "Container count: $CONTAINER_COUNT" && \
echo "" && \
if [[ -n "$DD_API_KEY" ]]; then
  curl -X POST "https://api.${DD_SITE:-datadoghq.com}/api/v2/series" \
    -H "Content-Type: application/json" \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -d "{
      \"series\": [{
        \"metric\": \"vibecode.apple_container.test\",
        \"type\": 0,
        \"points\": [{
          \"timestamp\": $(date +%s),
          \"value\": ${CONTAINER_COUNT}
        }],
        \"tags\": [\"platform:macos\",\"runtime:apple_container\",\"test:true\"]
      }]
    }"
  echo ""
  echo "✅ Test metric sent to Datadog"
  echo "Check your Datadog dashboard for: vibecode.apple_container.test"
else
  echo "⚠️  DD_API_KEY not set. Export it to test:"
  echo "   export DD_API_KEY=your_key_here"
fi
