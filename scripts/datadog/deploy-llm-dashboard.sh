#!/bin/bash
set -e

# Source monitoring library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/lib/datadog-monitoring.sh" 2>/dev/null || true
init_monitoring "$(basename "$0")"
trap 'finalize_monitoring $?' EXIT INT TERM

# Deploy Enhanced LLM Observability Dashboard to Datadog
# Uses the production-ready dashboard from monitoring/datadog/dashboards/

DASHBOARD_FILE="$REPO_ROOT/monitoring/datadog/dashboards/llm-observability-enhanced.json"

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    cat << 'EOF'
Deploy Enhanced LLM Observability Dashboard to Datadog

Usage:
  deploy-llm-dashboard.sh [--update DASHBOARD_ID]

Options:
  --update ID    Update existing dashboard instead of creating new one

Description:
  Deploys the comprehensive LLM observability dashboard with:
  - Core LLM Metrics: Token usage, costs, latency percentiles, error rates
  - Model Performance: Side-by-side comparison, response time vs cost
  - Provider Health: Availability, rate limits, retry/fallback metrics
  - Business Intelligence: Cost per user, budget burn rate, projections
  - Advanced Features: Anomaly detection, forecasting, A/B testing

Dashboard File:
  monitoring/datadog/dashboards/llm-observability-enhanced.json

Environment variables:
  DD_API_KEY   - Datadog API key (required)
  DD_APP_KEY   - Datadog application key (required)
  DD_SITE      - Datadog site (default: datadoghq.com)

Examples:
  # Deploy new dashboard
  deploy-llm-dashboard.sh

  # Update existing dashboard
  deploy-llm-dashboard.sh --update abc-123-def
EOF
    exit 0
fi

# Check required environment variables
if [ -z "$DD_API_KEY" ] || [ -z "$DD_APP_KEY" ]; then
    echo "[ERROR] DD_API_KEY and DD_APP_KEY must be set" >&2
    exit 1
fi

DD_SITE=${DD_SITE:-datadoghq.com}

# Check dashboard file exists
if [ ! -f "$DASHBOARD_FILE" ]; then
    echo "[ERROR] Dashboard file not found: $DASHBOARD_FILE" >&2
    exit 1
fi

start_operation "deploy_llm_dashboard"

# Parse arguments
UPDATE_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --update)
            UPDATE_ID="$2"
            shift 2
            ;;
        *)
            echo "[ERROR] Unknown argument: $1" >&2
            end_operation "error" "error:unknown_argument"
            exit 1
            ;;
    esac
done

echo "[INFO] Deploying Enhanced LLM Observability Dashboard" >&2
echo "[INFO] Dashboard file: $DASHBOARD_FILE" >&2
echo "" >&2

# Read dashboard JSON
DASHBOARD_JSON=$(cat "$DASHBOARD_FILE")

if [ -n "$UPDATE_ID" ]; then
    # Update existing dashboard
    echo "[INFO] Updating existing dashboard: $UPDATE_ID" >&2

    RESPONSE=$(curl -s -X PUT "https://api.${DD_SITE}/api/v1/dashboard/${UPDATE_ID}" \
        -H "DD-API-KEY: ${DD_API_KEY}" \
        -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
        -H "Content-Type: application/json" \
        -d "$DASHBOARD_JSON")

    ACTION="updated"
else
    # Create new dashboard
    echo "[INFO] Creating new dashboard..." >&2

    RESPONSE=$(curl -s -X POST "https://api.${DD_SITE}/api/v1/dashboard" \
        -H "DD-API-KEY: ${DD_API_KEY}" \
        -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
        -H "Content-Type: application/json" \
        -d "$DASHBOARD_JSON")

    ACTION="created"
fi

# Check for errors
if echo "$RESPONSE" | jq -e '.errors' > /dev/null 2>&1; then
    echo "[ERROR] API error:" >&2
    echo "$RESPONSE" | jq '.errors' >&2
    end_operation "error" "error:api_error"
    exit 1
fi

DASHBOARD_ID=$(echo "$RESPONSE" | jq -r '.id')
DASHBOARD_URL=$(echo "$RESPONSE" | jq -r '.url // empty')

if [ -z "$DASHBOARD_URL" ]; then
    DASHBOARD_URL="https://app.${DD_SITE}/dashboard/${DASHBOARD_ID}"
fi

echo "" >&2
echo "[OK] Dashboard ${ACTION} successfully" >&2
echo "[INFO] Dashboard ID: $DASHBOARD_ID" >&2
echo "[INFO] URL: $DASHBOARD_URL" >&2
echo "" >&2
echo "[INFO] Dashboard includes:" >&2
echo "  - 41 widgets across 5 sections" >&2
echo "  - Template variables: env, service, model_provider, model_family, model, user" >&2
echo "  - SLA markers and conditional formatting" >&2
echo "  - Anomaly detection and forecasting" >&2
echo "" >&2

send_metric "llm_dashboard.deploy.count" "1" "action:$ACTION"
end_operation "ok"

# Output JSON
echo "$RESPONSE" | jq '{
  id: .id,
  title: .title,
  url: (.url // "https://app.'${DD_SITE}'/dashboard/" + .id),
  action: "'${ACTION}'",
  status: "success"
}'
