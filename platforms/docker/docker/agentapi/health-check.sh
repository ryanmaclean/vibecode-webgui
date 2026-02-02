#!/bin/bash
set -e

# Configuration
AGENTAPI_HOST="${AGENTAPI_HOST:-127.0.0.1}"
AGENTAPI_PORT="${AGENTAPI_PORT:-3284}"
TERMINAL_DIR="${AGENTAPI_TERMINAL_DIR:-/tmp/terminals}"
MAX_AGENTS="${AGENTAPI_MAX_CONCURRENT_AGENTS:-5}"
MAX_RESPONSE_TIME_MS=1000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Health check results
HEALTH_STATUS=0
HEALTH_MESSAGES=()

# Function to add health message
add_health_message() {
    local level=$1
    local message=$2
    HEALTH_MESSAGES+=("[$level] $message")
}

# 1. Check HTTP server responsiveness
start_time=$(date +%s%N)
response=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://${AGENTAPI_HOST}:${AGENTAPI_PORT}/health" 2>&1 || echo "000")
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [ "$response" != "200" ]; then
    add_health_message "ERROR" "HTTP health check failed: HTTP $response"
    HEALTH_STATUS=1
else
    if [ "$response_time" -gt "$MAX_RESPONSE_TIME_MS" ]; then
        add_health_message "WARN" "Slow response time: ${response_time}ms"
    else
        add_health_message "OK" "HTTP server healthy (${response_time}ms)"
    fi
fi

# 2. Check terminal directory accessibility
if [ ! -d "$TERMINAL_DIR" ]; then
    add_health_message "ERROR" "Terminal directory not accessible: $TERMINAL_DIR"
    HEALTH_STATUS=1
elif [ ! -w "$TERMINAL_DIR" ]; then
    add_health_message "ERROR" "Terminal directory not writable: $TERMINAL_DIR"
    HEALTH_STATUS=1
else
    terminal_count=$(find "$TERMINAL_DIR" -type f 2>/dev/null | wc -l)
    add_health_message "OK" "Terminal directory accessible ($terminal_count active terminals)"
fi

# 3. Check agent process health
agent_count=$(ps aux | grep -E 'aider|goose|cline|continue' | grep -v grep | wc -l)

if [ "$agent_count" -gt "$MAX_AGENTS" ]; then
    add_health_message "ERROR" "Too many agent processes: $agent_count (max: $MAX_AGENTS)"
    HEALTH_STATUS=1
else
    add_health_message "OK" "Agent count within limits: $agent_count/$MAX_AGENTS"
fi

# 4. Check for zombie processes
zombie_count=$(ps aux | awk '{if ($8=="Z") print}' | wc -l)
if [ "$zombie_count" -gt 0 ]; then
    add_health_message "WARN" "Zombie processes detected: $zombie_count"
fi

# 5. Check memory usage (if available)
if command -v ps >/dev/null 2>&1; then
    memory_usage=$(ps aux --no-headers -C python3 -o %mem 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
    memory_limit=80.0
    if command -v bc >/dev/null 2>&1; then
        if (( $(echo "$memory_usage > $memory_limit" | bc -l) )); then
            add_health_message "WARN" "High memory usage: ${memory_usage}%"
        fi
    fi
fi

# 6. Check disk space for terminal directory
disk_usage=$(df "$TERMINAL_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//' || echo "0")
disk_limit=90
if [ "$disk_usage" -gt "$disk_limit" ]; then
    add_health_message "ERROR" "Disk space critical: ${disk_usage}%"
    HEALTH_STATUS=1
fi

# Print health report (only errors to stdout for container health)
for message in "${HEALTH_MESSAGES[@]}"; do
    if [[ $message == *"ERROR"* ]]; then
        echo "$message" >&2
    fi
done

# Exit with health status
if [ "$HEALTH_STATUS" -eq 0 ]; then
    echo "AgentAPI is healthy"
    exit 0
else
    echo "AgentAPI health check failed"
    exit 1
fi
