#!/usr/bin/env bash
set -euo pipefail

# Datadog shell helpers
source scripts/lib/datadog-logging.sh
source scripts/lib/log-aggregation.sh
source scripts/lib/error-tracking.sh

SCRIPT_NAME="telemetry-smoke-test"
START_TIME=$(date +%s)

log_script_start "$SCRIPT_NAME" "$*"
dd_info "Telemetry smoke test started" "component:telemetry-smoke"
dd_metric "vibecode.telemetry.smoke" 1 "count" "component:telemetry-smoke"

if [ -z "${DD_API_KEY:-}" ] && [ -z "${DATADOG_API_KEY:-}" ]; then
  dd_warn "DD_API_KEY not set; Datadog API calls will be skipped" "component:telemetry-smoke"
fi

dd_info "Telemetry smoke test completed" "component:telemetry-smoke"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
log_script_end "$SCRIPT_NAME" 0 "$DURATION"
