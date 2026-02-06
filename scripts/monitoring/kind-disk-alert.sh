#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# KIND Cluster Disk Alert Script
# Sends alerts when disk usage exceeds thresholds
# Can be run via cron: */15 * * * * /path/to/kind-disk-alert.sh
#
# To install: crontab -e and add:
# */15 * * * * /Users/studio/gt/mbp_m1/crew/default/scripts/monitoring/kind-disk-alert.sh >> /tmp/kind-disk-alert.log 2>&1

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Configuration
WARNING_THRESHOLD=85
CRITICAL_THRESHOLD=90
EMERGENCY_THRESHOLD=95
LOG_FILE="/tmp/kind-disk-usage.log"
ALERT_FILE="/tmp/kind-disk-alert.status"

# Get current disk usage (any node will do - they share the same overlay)
DISK_USAGE=$(docker exec tundra-dome-control-plane df / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%' || echo "0")

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Log current state
echo "$TIMESTAMP - Disk: ${DISK_USAGE}%" >> "$LOG_FILE"

# Function to send alert (customize this for your notification system)
send_alert() {
    local level=$1
    local message=$2

    echo "[$level] $TIMESTAMP - $message"

    # Uncomment and customize for your alerting method:

    # Slack webhook example:
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"[$level] KIND Cluster: $message\"}" \
    #   "$SLACK_WEBHOOK_URL"

    # macOS notification:
    if command -v osascript &>/dev/null; then
        osascript -e "display notification \"$message\" with title \"KIND Cluster [$level]\"" 2>/dev/null || true
    fi

    # Write to alert file for external monitoring
    echo "$TIMESTAMP|$level|$DISK_USAGE|$message" >> "$ALERT_FILE"
}

# Function to auto-cleanup
auto_cleanup() {
    echo "$TIMESTAMP - Running automatic cleanup..."

    for node in tundra-dome-control-plane tundra-dome-worker gastown-control-plane gastown-worker gastown-worker2 vibecode-local-control-plane vibecode-local-worker; do
        docker exec "$node" crictl rmi --prune 2>/dev/null || true
    done

    # Re-check usage
    local new_usage
    new_usage=$(docker exec tundra-dome-control-plane df / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%' || echo "0")
    echo "$TIMESTAMP - Post-cleanup disk: ${new_usage}%"
}

# Check thresholds and alert
if [[ $DISK_USAGE -ge $EMERGENCY_THRESHOLD ]]; then
    send_alert "EMERGENCY" "Disk at ${DISK_USAGE}% - Pods may be evicted! Running auto-cleanup..."
    auto_cleanup
elif [[ $DISK_USAGE -ge $CRITICAL_THRESHOLD ]]; then
    send_alert "CRITICAL" "Disk at ${DISK_USAGE}% - Cleanup recommended"
    auto_cleanup
elif [[ $DISK_USAGE -ge $WARNING_THRESHOLD ]]; then
    send_alert "WARNING" "Disk at ${DISK_USAGE}% - Monitor closely"
fi

# Keep log file from growing indefinitely
if [[ -f "$LOG_FILE" ]] && [[ $(wc -l < "$LOG_FILE") -gt 1000 ]]; then
    tail -500 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

# Keep alert file trimmed
if [[ -f "$ALERT_FILE" ]] && [[ $(wc -l < "$ALERT_FILE") -gt 100 ]]; then
    tail -50 "$ALERT_FILE" > "${ALERT_FILE}.tmp" && mv "${ALERT_FILE}.tmp" "$ALERT_FILE"
fi
