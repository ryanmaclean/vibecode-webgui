#!/bin/bash
# Datadog Log Aggregation Module
# Provides centralized logging functionality for all deployment scripts
# Usage: source scripts/lib/log-aggregation.sh

# Configuration
LOG_AGGREGATION_ENABLED=${DD_LOG_AGGREGATION_ENABLED:-true}
LOG_SERVICE_NAME=${DD_SERVICE:-"vibecode-webgui"}
LOG_ENVIRONMENT=${DD_ENV:-"development"}
LOG_VERSION=${DD_VERSION:-"1.0.0"}

# Log levels
LOG_LEVEL_DEBUG=0
LOG_LEVEL_INFO=1
LOG_LEVEL_WARN=2
LOG_LEVEL_ERROR=3

# Current log level (can be overridden)
CURRENT_LOG_LEVEL=${DD_LOG_LEVEL:-$LOG_LEVEL_INFO}

# Initialize log aggregation
init_log_aggregation() {
    if [ "$LOG_AGGREGATION_ENABLED" = "true" ]; then
        echo "🔍 Initializing Datadog log aggregation..."
        
        # Check required environment variables
        if [ -z "$DD_API_KEY" ]; then
            echo "⚠️ Warning: DD_API_KEY not set, log aggregation disabled"
            LOG_AGGREGATION_ENABLED=false
            return 1
        fi
        
        # Create log directory if it doesn't exist
        mkdir -p /tmp/datadog-logs
        
        # Initialize log file with metadata
        LOG_FILE="/tmp/datadog-logs/$(basename "$0")-$(date +%Y%m%d-%H%M%S).log"
        echo "{\"service\":\"$LOG_SERVICE_NAME\",\"env\":\"$LOG_ENVIRONMENT\",\"version\":\"$LOG_VERSION\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$LOG_FILE"
        
        echo "✅ Log aggregation initialized: $LOG_FILE"
        return 0
    else
        echo "ℹ️ Log aggregation disabled"
        return 1
    fi
}

# Send log to Datadog
send_log_to_datadog() {
    local level="$1"
    local message="$2"
    local context="$3"
    
    if [ "$LOG_AGGREGATION_ENABLED" != "true" ]; then
        return 0
    fi
    
    # Create log entry
    local log_entry
    log_entry=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "level": "$level",
    "message": "$message",
    "service": "$LOG_SERVICE_NAME",
    "env": "$LOG_ENVIRONMENT",
    "version": "$LOG_VERSION",
    "script": "$(basename "$0")",
    "context": $context
}
EOF
)
    
    # Write to local log file
    echo "$log_entry" >> "$LOG_FILE"
    
    # Send to Datadog Logs API
    curl -s -X POST "https://http-intake.logs.datadoghq.com/v1/input/$DD_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$log_entry" > /dev/null 2>&1 || true
    
    return 0
}

# Log functions
log_debug() {
    if [ $CURRENT_LOG_LEVEL -le $LOG_LEVEL_DEBUG ]; then
        echo "🔍 DEBUG: $1"
        send_log_to_datadog "DEBUG" "$1" "{\"component\":\"$(basename "$0")\"}"
    fi
}

log_info() {
    if [ $CURRENT_LOG_LEVEL -le $LOG_LEVEL_INFO ]; then
        echo "ℹ️ INFO: $1"
        send_log_to_datadog "INFO" "$1" "{\"component\":\"$(basename "$0")\"}"
    fi
}

log_warn() {
    if [ $CURRENT_LOG_LEVEL -le $LOG_LEVEL_WARN ]; then
        echo "⚠️ WARN: $1"
        send_log_to_datadog "WARN" "$1" "{\"component\":\"$(basename "$0")\"}"
    fi
}

log_error() {
    if [ $CURRENT_LOG_LEVEL -le $LOG_LEVEL_ERROR ]; then
        echo "❌ ERROR: $1"
        send_log_to_datadog "ERROR" "$1" "{\"component\":\"$(basename "$0")\",\"error\":true}"
    fi
}

# Structured logging functions
log_script_start() {
    local script_name="$1"
    local parameters="$2"
    
    log_info "Script started: $script_name"
    send_log_to_datadog "INFO" "Script execution started" "{\"script\":\"$script_name\",\"parameters\":\"$parameters\",\"event\":\"script_start\"}"
}

log_script_end() {
    local script_name="$1"
    local exit_code="$2"
    local duration="$3"
    
    if [ "$exit_code" = "0" ]; then
        log_info "Script completed successfully: $script_name (${duration}s)"
        send_log_to_datadog "INFO" "Script execution completed" "{\"script\":\"$script_name\",\"exit_code\":$exit_code,\"duration\":$duration,\"event\":\"script_end\"}"
    else
        log_error "Script failed: $script_name (exit code: $exit_code, duration: ${duration}s)"
        send_log_to_datadog "ERROR" "Script execution failed" "{\"script\":\"$script_name\",\"exit_code\":$exit_code,\"duration\":$duration,\"event\":\"script_end\",\"error\":true}"
    fi
}

log_deployment_event() {
    local event_type="$1"
    local component="$2"
    local status="$3"
    local details="$4"
    
    log_info "Deployment event: $event_type - $component ($status)"
    send_log_to_datadog "INFO" "Deployment event" "{\"event_type\":\"$event_type\",\"component\":\"$component\",\"status\":\"$status\",\"details\":\"$details\",\"event\":\"deployment\"}"
}

log_kubernetes_event() {
    local operation="$1"
    local resource="$2"
    local namespace="$3"
    local status="$4"
    
    log_info "Kubernetes event: $operation $resource in $namespace ($status)"
    send_log_to_datadog "INFO" "Kubernetes operation" "{\"operation\":\"$operation\",\"resource\":\"$resource\",\"namespace\":\"$namespace\",\"status\":\"$status\",\"event\":\"kubernetes\"}"
}

log_database_event() {
    local operation="$1"
    local database="$2"
    local status="$3"
    local details="$4"
    
    log_info "Database event: $operation on $database ($status)"
    send_log_to_datadog "INFO" "Database operation" "{\"operation\":\"$operation\",\"database\":\"$database\",\"status\":\"$status\",\"details\":\"$details\",\"event\":\"database\"}"
}

# Performance logging
log_performance_metric() {
    local metric_name="$1"
    local value="$2"
    local unit="$3"
    local tags="$4"
    
    log_debug "Performance metric: $metric_name = $value $unit"
    send_log_to_datadog "INFO" "Performance metric" "{\"metric_name\":\"$metric_name\",\"value\":$value,\"unit\":\"$unit\",\"tags\":\"$tags\",\"event\":\"performance\"}"
}

# Cleanup function
cleanup_log_aggregation() {
    if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
        # Send final summary log
        local line_count
        line_count=$(wc -l < "$LOG_FILE" 2>/dev/null || echo "0")
        
        send_log_to_datadog "INFO" "Script execution summary" "{\"total_log_entries\":$line_count,\"log_file\":\"$LOG_FILE\",\"event\":\"script_summary\"}"
        
        # Clean up old log files (keep last 10)
        find /tmp/datadog-logs -name "*.log" -type f -mtime +1 -delete 2>/dev/null || true
    fi
}

# Set up cleanup trap
trap cleanup_log_aggregation EXIT

# Auto-initialize if sourced
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    # Script is being executed directly
    init_log_aggregation
else
    # Script is being sourced
    init_log_aggregation
fi

