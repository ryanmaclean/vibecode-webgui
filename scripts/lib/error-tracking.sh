#!/bin/bash
# Datadog Error Tracking Automation for Scripts
# This module provides automatic error tracking for all shell scripts

set -euo pipefail

# Error tracking configuration
DD_ERROR_TRACKING_ENABLED=${DD_ERROR_TRACKING_ENABLED:-true}
DD_SERVICE=${DD_SERVICE:-vibecode-webgui}
DD_ENV=${DD_ENV:-${NODE_ENV:-development}}
DD_VERSION=${DD_VERSION:-1.0.0}
DD_API_KEY=${DD_API_KEY:-}

# Script metadata
SCRIPT_NAME=${0##*/}
SCRIPT_DIR=${0%/*}
SCRIPT_PATH="$0"
SCRIPT_ARGS="$*"

# Error tracking functions
log_error_to_datadog() {
    local error_message="$1"
    local error_code="${2:-1}"
    local component="${3:-script}"
    local action="${4:-execution}"
    local additional_context="${5:-}"
    
    if [ "$DD_ERROR_TRACKING_ENABLED" = "true" ] && [ -n "$DD_API_KEY" ]; then
        # Create error payload
        local error_payload=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "service": "$DD_SERVICE",
    "env": "$DD_ENV",
    "version": "$DD_VERSION",
    "error": {
        "message": "$error_message",
        "type": "ScriptError",
        "stack": "Script: $SCRIPT_NAME\nArgs: $SCRIPT_ARGS\nExit Code: $error_code"
    },
    "context": {
        "component": "$component",
        "action": "$action",
        "script_name": "$SCRIPT_NAME",
        "script_path": "$SCRIPT_PATH",
        "script_args": "$SCRIPT_ARGS",
        "exit_code": "$error_code",
        "hostname": "$(hostname)",
        "user": "$(whoami)",
        "working_directory": "$(pwd)",
        "additional_context": "$additional_context"
    },
    "tags": [
        "service:$DD_SERVICE",
        "env:$DD_ENV",
        "component:$component",
        "script:$SCRIPT_NAME",
        "error_type:script_execution"
    ]
}
EOF
)
        
        # Send to Datadog (using curl as it's widely available)
        curl -s -X POST "https://http-intake.logs.datadoghq.com/v1/input/$DD_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$error_payload" \
            --max-time 5 \
            --retry 2 \
            --retry-delay 1 \
            >/dev/null 2>&1 || true
    fi
}

# Enhanced error handling with automatic tracking
handle_script_error() {
    local exit_code=$?
    local line_number=${1:-unknown}
    local error_message="Script '$SCRIPT_NAME' failed at line $line_number with exit code $exit_code"
    
    # Log to console
    echo "❌ ERROR: $error_message" >&2
    echo "   Script: $SCRIPT_PATH" >&2
    echo "   Args: $SCRIPT_ARGS" >&2
    echo "   Working Directory: $(pwd)" >&2
    
    # Track error in Datadog
    log_error_to_datadog "$error_message" "$exit_code" "script" "execution" "line:$line_number"
    
    # Exit with original code
    exit $exit_code
}

# Track script start
track_script_start() {
    local component="${1:-script}"
    local action="${2:-start}"
    
    if [ "$DD_ERROR_TRACKING_ENABLED" = "true" ] && [ -n "$DD_API_KEY" ]; then
        local start_payload=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "service": "$DD_SERVICE",
    "env": "$DD_ENV",
    "version": "$DD_VERSION",
    "message": "Script started: $SCRIPT_NAME",
    "context": {
        "component": "$component",
        "action": "$action",
        "script_name": "$SCRIPT_NAME",
        "script_path": "$SCRIPT_PATH",
        "script_args": "$SCRIPT_ARGS",
        "hostname": "$(hostname)",
        "user": "$(whoami)",
        "working_directory": "$(pwd)"
    },
    "tags": [
        "service:$DD_SERVICE",
        "env:$DD_ENV",
        "component:$component",
        "script:$SCRIPT_NAME",
        "event_type:script_start"
    ]
}
EOF
)
        
        curl -s -X POST "https://http-intake.logs.datadoghq.com/v1/input/$DD_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$start_payload" \
            --max-time 5 \
            --retry 2 \
            --retry-delay 1 \
            >/dev/null 2>&1 || true
    fi
}

# Track script completion
track_script_completion() {
    local exit_code=${1:-0}
    local component="${2:-script}"
    local action="${3:-completion}"
    local duration="${4:-unknown}"
    
    if [ "$DD_ERROR_TRACKING_ENABLED" = "true" ] && [ -n "$DD_API_KEY" ]; then
        local completion_payload=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "service": "$DD_SERVICE",
    "env": "$DD_ENV",
    "version": "$DD_VERSION",
    "message": "Script completed: $SCRIPT_NAME",
    "context": {
        "component": "$component",
        "action": "$action",
        "script_name": "$SCRIPT_NAME",
        "script_path": "$SCRIPT_PATH",
        "script_args": "$SCRIPT_ARGS",
        "exit_code": "$exit_code",
        "duration": "$duration",
        "hostname": "$(hostname)",
        "user": "$(whoami)",
        "working_directory": "$(pwd)"
    },
    "tags": [
        "service:$DD_SERVICE",
        "env:$DD_ENV",
        "component:$component",
        "script:$SCRIPT_NAME",
        "event_type:script_completion",
        "exit_code:$exit_code"
    ]
}
EOF
)
        
        curl -s -X POST "https://http-intake.logs.datadoghq.com/v1/input/$DD_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$completion_payload" \
            --max-time 5 \
            --retry 2 \
            --retry-delay 1 \
            >/dev/null 2>&1 || true
    fi
}

# Track command execution
track_command_execution() {
    local command="$1"
    local exit_code="${2:-0}"
    local component="${3:-script}"
    local action="${4:-command_execution}"
    local output="${5:-}"
    
    if [ "$DD_ERROR_TRACKING_ENABLED" = "true" ] && [ -n "$DD_API_KEY" ]; then
        local command_payload=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "service": "$DD_SERVICE",
    "env": "$DD_ENV",
    "version": "$DD_VERSION",
    "message": "Command executed: $command",
    "context": {
        "component": "$component",
        "action": "$action",
        "command": "$command",
        "exit_code": "$exit_code",
        "output": "$output",
        "script_name": "$SCRIPT_NAME",
        "hostname": "$(hostname)",
        "user": "$(whoami)",
        "working_directory": "$(pwd)"
    },
    "tags": [
        "service:$DD_SERVICE",
        "env:$DD_ENV",
        "component:$component",
        "script:$SCRIPT_NAME",
        "event_type:command_execution",
        "exit_code:$exit_code"
    ]
}
EOF
)
        
        curl -s -X POST "https://http-intake.logs.datadoghq.com/v1/input/$DD_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$command_payload" \
            --max-time 5 \
            --retry 2 \
            --retry-delay 1 \
            >/dev/null 2>&1 || true
    fi
}

# Safe command execution with error tracking
safe_execute() {
    local command="$1"
    local component="${2:-script}"
    local action="${3:-command_execution}"
    
    echo "🔧 Executing: $command"
    
    if eval "$command"; then
        track_command_execution "$command" "0" "$component" "$action"
        return 0
    else
        local exit_code=$?
        track_command_execution "$command" "$exit_code" "$component" "$action"
        return $exit_code
    fi
}

# Track performance metrics
track_performance_metric() {
    local metric_name="$1"
    local metric_value="$2"
    local component="${3:-script}"
    local unit="${4:-ms}"
    
    if [ "$DD_ERROR_TRACKING_ENABLED" = "true" ] && [ -n "$DD_API_KEY" ]; then
        local metric_payload=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "service": "$DD_SERVICE",
    "env": "$DD_ENV",
    "version": "$DD_VERSION",
    "message": "Performance metric: $metric_name = $metric_value $unit",
    "context": {
        "component": "$component",
        "metric_name": "$metric_name",
        "metric_value": "$metric_value",
        "metric_unit": "$unit",
        "script_name": "$SCRIPT_NAME",
        "hostname": "$(hostname)",
        "user": "$(whoami)",
        "working_directory": "$(pwd)"
    },
    "tags": [
        "service:$DD_SERVICE",
        "env:$DD_ENV",
        "component:$component",
        "script:$SCRIPT_NAME",
        "metric_name:$metric_name",
        "event_type:performance_metric"
    ]
}
EOF
)
        
        curl -s -X POST "https://http-intake.logs.datadoghq.com/v1/input/$DD_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$metric_payload" \
            --max-time 5 \
            --retry 2 \
            --retry-delay 1 \
            >/dev/null 2>&1 || true
    fi
}

# Initialize error tracking for script
init_error_tracking() {
    local component="${1:-script}"
    
    # Set up error trap
    trap 'handle_script_error $LINENO' ERR
    
    # Track script start
    track_script_start "$component" "start"
    
    # Set up completion tracking
    trap 'track_script_completion $? "$component" "completion" "$(date +%s)"' EXIT
}

# Utility function to check if error tracking is available
check_error_tracking_availability() {
    if [ "$DD_ERROR_TRACKING_ENABLED" = "true" ] && [ -n "$DD_API_KEY" ]; then
        return 0
    else
        echo "⚠️  Datadog Error Tracking is disabled or not configured"
        echo "   Set DD_ERROR_TRACKING_ENABLED=true and DD_API_KEY to enable"
        return 1
    fi
}

# Export functions for use in other scripts
export -f log_error_to_datadog
export -f handle_script_error
export -f track_script_start
export -f track_script_completion
export -f track_command_execution
export -f safe_execute
export -f track_performance_metric
export -f init_error_tracking
export -f check_error_tracking_availability

# If this script is sourced, initialize error tracking
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    # Script is being sourced
    echo "📊 Datadog Error Tracking module loaded for $SCRIPT_NAME"
    check_error_tracking_availability
fi
