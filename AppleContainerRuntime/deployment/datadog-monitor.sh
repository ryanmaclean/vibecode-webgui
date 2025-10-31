#!/bin/bash
# VibeCode Apple Container Datadog Monitoring
# Sends container metrics to Datadog

set -e

# Configuration
DD_API_KEY="${DD_API_KEY:-}"
DD_SITE="${DD_SITE:-datadoghq.com}"
HOSTNAME="${HOSTNAME:-$(hostname)}"

if [[ -z "$DD_API_KEY" ]]; then
  echo "❌ Error: DD_API_KEY environment variable required"
  echo "Export it: export DD_API_KEY=your_key_here"
  exit 1
fi

echo "=== VibeCode Apple Container Datadog Monitor ==="
echo "Hostname: $HOSTNAME"
echo "Datadog Site: $DD_SITE"
echo ""

# Function to send metrics to Datadog
send_metric() {
  local metric_name="$1"
  local value="$2"
  local tags="$3"
  local timestamp=$(date +%s)
  
  curl -X POST "https://api.${DD_SITE}/api/v2/series" \
    -H "Content-Type: application/json" \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -d "{
      \"series\": [{
        \"metric\": \"${metric_name}\",
        \"type\": 0,
        \"points\": [{
          \"timestamp\": ${timestamp},
          \"value\": ${value}
        }],
        \"tags\": [${tags}]
      }]
    }" > /dev/null 2>&1
}

# Monitor loop
echo "Starting monitoring (Ctrl+C to stop)..."
while true; do
  # Get container stats
  CONTAINER_COUNT=$(container list --format json 2>/dev/null | jq '. | length' || echo 0)
  RUNNING_COUNT=$(container list --format json 2>/dev/null | jq '[.[] | select(.state == "running")] | length' || echo 0)
  
  # Send metrics
  send_metric "vibecode.apple_container.total" "$CONTAINER_COUNT" "\"platform:macos\",\"runtime:apple_container\",\"host:${HOSTNAME}\""
  send_metric "vibecode.apple_container.running" "$RUNNING_COUNT" "\"platform:macos\",\"runtime:apple_container\",\"host:${HOSTNAME}\""
  
  # Get individual container metrics
  container list --format json 2>/dev/null | jq -r '.[] | "\(.id),\(.state),\(.image)"' | while IFS=',' read -r id state image; do
    if [[ "$state" == "running" ]]; then
      send_metric "vibecode.apple_container.container.up" "1" "\"container_id:${id}\",\"image:${image}\",\"platform:macos\""
    fi
  done
  
  echo "$(date): Sent metrics - Total: $CONTAINER_COUNT, Running: $RUNNING_COUNT"
  sleep 60
done
