#!/bin/bash
# Datadog Logging Library for Bash Scripts
# Usage: source scripts/lib/datadog-logging.sh

# Datadog configuration
DD_API_KEY="${DD_API_KEY:-${DATADOG_API_KEY:-}}"
DD_SITE="${DD_SITE:-datadoghq.com}"
DD_SERVICE="${DD_SERVICE:-vibecode-bash-scripts}"
DD_ENV="${DD_ENV:-${NODE_ENV:-development}}"
DD_VERSION="${DD_VERSION:-1.0.0}"

# Log levels
DD_LOG_LEVEL_DEBUG=0
DD_LOG_LEVEL_INFO=1
DD_LOG_LEVEL_WARN=2
DD_LOG_LEVEL_ERROR=3

# Current log level (default: INFO)
DD_CURRENT_LOG_LEVEL=${DD_CURRENT_LOG_LEVEL:-$DD_LOG_LEVEL_INFO}

# Send log to Datadog
# Usage: dd_log <level> <message> [tags...]
dd_log() {
    local level="$1"
    local message="$2"
    shift 2
    local tags="$*"

    # Skip if DD_API_KEY not set
    if [ -z "$DD_API_KEY" ]; then
        echo "[DD-BASH] $level: $message" >&2
        return 0
    fi

    # Create JSON payload
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local hostname=$(hostname)
    local script_name=$(basename "$0")

    local json_payload=$(cat <<EOF
{
  "ddsource": "bash",
  "ddtags": "env:$DD_ENV,service:$DD_SERVICE,version:$DD_VERSION,script:$script_name,$tags",
  "hostname": "$hostname",
  "message": "$message",
  "level": "$level",
  "timestamp": "$timestamp"
}
EOF
)

    # Send to Datadog (async, don't block script execution)
    curl -X POST "https://http-intake.logs.$DD_SITE/v1/input/$DD_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        --max-time 5 \
        --silent \
        --show-error \
        > /dev/null 2>&1 &

    # Also log locally
    echo "[DD-BASH] $level: $message"
}

# Convenience functions
dd_debug() {
    [ $DD_CURRENT_LOG_LEVEL -le $DD_LOG_LEVEL_DEBUG ] && dd_log "debug" "$@"
}

dd_info() {
    [ $DD_CURRENT_LOG_LEVEL -le $DD_LOG_LEVEL_INFO ] && dd_log "info" "$@"
}

dd_warn() {
    [ $DD_CURRENT_LOG_LEVEL -le $DD_LOG_LEVEL_WARN ] && dd_log "warn" "$@"
}

dd_error() {
    [ $DD_CURRENT_LOG_LEVEL -le $DD_LOG_LEVEL_ERROR ] && dd_log "error" "$@"
}

# Send metric to Datadog
# Usage: dd_metric <metric_name> <value> <type> [tags...]
dd_metric() {
    local metric_name="$1"
    local value="$2"
    local type="${3:-gauge}"  # gauge, count, histogram
    shift 3
    local tags="$*"

    # Skip if DD_API_KEY not set
    if [ -z "$DD_API_KEY" ]; then
        echo "[DD-METRIC] $metric_name = $value ($type)" >&2
        return 0
    fi

    local timestamp=$(date +%s)
    local hostname=$(hostname)
    local script_name=$(basename "$0")

    local json_payload=$(cat <<EOF
{
  "series": [{
    "metric": "$metric_name",
    "points": [[$timestamp, $value]],
    "type": "$type",
    "host": "$hostname",
    "tags": ["env:$DD_ENV", "service:$DD_SERVICE", "script:$script_name", $tags]
  }]
}
EOF
)

    # Send to Datadog (async)
    curl -X POST "https://api.$DD_SITE/api/v1/series" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DD_API_KEY" \
        -d "$json_payload" \
        --max-time 5 \
        --silent \
        --show-error \
        > /dev/null 2>&1 &

    echo "[DD-METRIC] $metric_name = $value"
}

# Export functions
export -f dd_log dd_debug dd_info dd_warn dd_error dd_metric
