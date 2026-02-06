#!/bin/bash
# Datadog APM tracing wrapper for Gas Town agents
# Usage: trace-agent.sh <agent-type> <bead-id> <command...>

set -e

AGENT_TYPE="${1:-unknown}"
BEAD_ID="${2:-none}"
shift 2 || true

# Datadog trace context
export DD_SERVICE="${DD_SERVICE:-gastown-agents}"
export DD_ENV="${DD_ENV:-studio}"
export DD_VERSION="${DD_VERSION:-0.4.0}"
export DD_AGENT_HOST="${DD_AGENT_HOST:-localhost}"
export DD_TRACE_AGENT_PORT="${DD_TRACE_AGENT_PORT:-8126}"

# Custom tags for agent work
export DD_TAGS="agent_type:${AGENT_TYPE},bead_id:${BEAD_ID},team:vibecode"

# Generate trace ID
TRACE_ID=$(date +%s%N | cut -c1-16)
SPAN_ID=$(date +%s%N | cut -c1-16)
START_TIME=$(date +%s%N)

# Log span start
log_span_start() {
    curl -s -X PUT "http://${DD_AGENT_HOST}:${DD_TRACE_AGENT_PORT}/v0.4/traces" \
        -H "Content-Type: application/json" \
        -d "[{
            \"trace_id\": ${TRACE_ID},
            \"span_id\": ${SPAN_ID},
            \"name\": \"agent.execute\",
            \"resource\": \"${BEAD_ID}\",
            \"service\": \"${DD_SERVICE}\",
            \"type\": \"custom\",
            \"start\": ${START_TIME},
            \"meta\": {
                \"agent.type\": \"${AGENT_TYPE}\",
                \"bead.id\": \"${BEAD_ID}\",
                \"env\": \"${DD_ENV}\"
            }
        }]" 2>/dev/null || true
}

# Log span end
log_span_end() {
    local exit_code=$1
    local end_time=$(date +%s%N)
    local duration=$((end_time - START_TIME))
    local error_flag=0
    [[ $exit_code -ne 0 ]] && error_flag=1

    curl -s -X PUT "http://${DD_AGENT_HOST}:${DD_TRACE_AGENT_PORT}/v0.4/traces" \
        -H "Content-Type: application/json" \
        -d "[{
            \"trace_id\": ${TRACE_ID},
            \"span_id\": ${SPAN_ID},
            \"name\": \"agent.execute\",
            \"resource\": \"${BEAD_ID}\",
            \"service\": \"${DD_SERVICE}\",
            \"type\": \"custom\",
            \"start\": ${START_TIME},
            \"duration\": ${duration},
            \"error\": ${error_flag},
            \"meta\": {
                \"agent.type\": \"${AGENT_TYPE}\",
                \"bead.id\": \"${BEAD_ID}\",
                \"exit_code\": \"${exit_code}\",
                \"env\": \"${DD_ENV}\"
            }
        }]" 2>/dev/null || true
}

# Emit custom metric
emit_metric() {
    local metric_name=$1
    local value=$2
    echo "MONITORING|$(date +%s)|${value}|gauge|${metric_name}|#agent_type:${AGENT_TYPE},bead_id:${BEAD_ID}" | nc -u -w1 ${DD_AGENT_HOST} 8125 2>/dev/null || true
}

# Start tracing
log_span_start
emit_metric "gastown.agent.started" 1

# Execute the command
"$@"
EXIT_CODE=$?

# End tracing
log_span_end $EXIT_CODE
emit_metric "gastown.agent.completed" 1
[[ $EXIT_CODE -ne 0 ]] && emit_metric "gastown.agent.errors" 1

exit $EXIT_CODE
