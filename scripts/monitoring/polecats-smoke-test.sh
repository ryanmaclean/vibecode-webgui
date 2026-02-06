#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -euo pipefail

# Polecats smoke test: emit logs/metrics/traces and verify via Datadog skill scripts.
# Requires: DD_API_KEY, DD_APP_KEY, DD_SITE, Datadog Agent (APM + DogStatsD).

# Initialize log aggregation
init_log_aggregation


SKILL_ROOT="${SKILL_ROOT:-$HOME/.agents/skills/datadog-operations}"
SCRIPTS_DIR="${SKILL_ROOT}/scripts"
LIB_DIR="${SCRIPTS_DIR}/lib"

if [ ! -f "${LIB_DIR}/datadog-monitoring.sh" ]; then
  echo "[ERROR] datadog-monitoring.sh not found at ${LIB_DIR}" >&2
  exit 1
fi

export DD_MONITORING_ENABLED=true

emit_openclaw() {
  export DD_MONITORING_SERVICE="openclaw"
  # shellcheck source=/dev/null
  source "${LIB_DIR}/datadog-monitoring.sh"
  send_metric openclaw.gateway.health 1 host:openclaw-vm env:${DD_ENV:-local}
  send_metric openclaw.tailscale.connected 1 host:openclaw-vm env:${DD_ENV:-local}
  send_log info "OpenClaw synthetic heartbeat" host:openclaw-vm env:${DD_ENV:-local}
  # Synthetic trace to APM agent
  send_trace "openclaw-smoke" "heartbeat" 25 "ok" "service:openclaw" "env:${DD_ENV:-local}"
}

emit_gastown() {
  export DD_MONITORING_SERVICE="gastown-sensei"
  # shellcheck source=/dev/null
  source "${LIB_DIR}/datadog-monitoring.sh"
  send_metric gastown.beads.hooked 1 rig:mbp_m1 agent_type:polecat env:${DD_ENV:-local}
  send_log info "Gastown synthetic bead hooked" rig:mbp_m1 agent_type:polecat env:${DD_ENV:-local}
  # Synthetic trace to APM agent
  send_trace "gastown-smoke" "bead_hooked" 30 "ok" "service:gastown-sensei" "env:${DD_ENV:-local}"
}

echo "[INFO] Emitting synthetic telemetry..."
emit_openclaw
emit_gastown

echo "[INFO] Waiting for ingestion..."
sleep "${SLEEP_SECS:-180}"

echo "[INFO] Verifying metrics..."
"${SCRIPTS_DIR}/query-metrics.sh" --metric "openclaw.gateway.health" --duration 1h
"${SCRIPTS_DIR}/query-metrics.sh" --metric "openclaw.tailscale.connected" --duration 1h
"${SCRIPTS_DIR}/query-metrics.sh" --metric "gastown.beads.hooked" --duration 1h --aggregation sum

echo "[INFO] Verifying logs..."
"${SCRIPTS_DIR}/search-logs.sh" --query "service:openclaw" --duration 1h
"${SCRIPTS_DIR}/search-logs.sh" --query "service:gastown-sensei" --duration 1h

echo "[INFO] Verifying traces..."
"${SCRIPTS_DIR}/query-apm.sh" --service "openclaw" --duration 1h --limit 5
"${SCRIPTS_DIR}/query-apm.sh" --service "gastown-sensei" --duration 1h --limit 5

echo "[OK] Smoke test complete."
