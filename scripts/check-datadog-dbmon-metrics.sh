#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $(basename "$0") [-s service] [-w window] [-m metric]

Poll Datadog for recent PostgreSQL DBM metrics.

Options:
  -s service   Service tag to filter on (default: vibecode)
  -w window    Lookback window (e.g. 10m, 30m, 1h). Default: 15m
  -m metric    Metric query to run (default: pgvector bundle)

Environment:
  DD_API_KEY   Datadog API key (required)
  DD_APP_KEY   Datadog application key (required)
  DD_SITE      Datadog site (default: datadoghq.com)
USAGE
}

SERVICE_TAG="vibecode"
WINDOW="15m"
CUSTOM_QUERY=""

while getopts ":s:w:m:h" opt; do
  case "$opt" in
    s) SERVICE_TAG="$OPTARG" ;;
    w) WINDOW="$OPTARG" ;;
    m) CUSTOM_QUERY="$OPTARG" ;;
    h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done

: "${DD_API_KEY:?DD_API_KEY environment variable required}"
: "${DD_APP_KEY:?DD_APP_KEY environment variable required}"
SITE="${DD_SITE:-datadoghq.com}"
BASE_URL="https://api.${SITE}"

# convert window like 15m/1h into seconds
case "$WINDOW" in
  *m) WINDOW_SECONDS=$(( ${WINDOW%m} * 60 )) ;;
  *h) WINDOW_SECONDS=$(( ${WINDOW%h} * 3600 )) ;;
  *s) WINDOW_SECONDS=$(( ${WINDOW%s} )) ;;
  *) echo "Unsupported window format: $WINDOW" >&2; exit 1 ;;
esac

TO=$(date -u +%s)
FROM=$(( TO - WINDOW_SECONDS ))

run_query() {
  local query=$1
  curl -sS \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
    "${BASE_URL}/api/v1/query?from=${FROM}&to=${TO}&query=${query}"
}

print_series() {
  local metric=$1
  local label=$2
  local response=$3
  local value
  value=$(printf '%s' "$response" | jq -r '.series[0].pointlist[-1][1] // empty' 2>/dev/null || true)
  if [[ -z "$value" || "$value" == "null" ]]; then
    echo "[WARN] No recent data for ${label} (${metric})"
  else
    echo "[OK] ${label}: ${value}"
  fi
}

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this script" >&2
  exit 1
fi

if [[ -n "$CUSTOM_QUERY" ]]; then
  echo "Running custom query: ${CUSTOM_QUERY}"
  RESPONSE=$(run_query "$CUSTOM_QUERY") || {
    echo "Datadog API error" >&2
    exit 1
  }
  echo "$RESPONSE" | jq
  exit 0
fi

LABELS=(
  "Vector Count"
  "Vector Table Size"
  "Vector Index Reads"
  "DB Connections"
  "Query Duration"
)
METRICS=(
  "avg:postgresql.pgvector.vector_count{service:${SERVICE_TAG}}"
  "avg:postgresql.pgvector.table_size{service:${SERVICE_TAG}}"
  "avg:postgresql.pgvector.index.tuples_read{service:${SERVICE_TAG}}"
  "avg:postgresql.connections{service:${SERVICE_TAG}}"
  "avg:postgresql.query_duration{service:${SERVICE_TAG}}"
)

for i in "${!LABELS[@]}"; do
  label="${LABELS[$i]}"
  metric="${METRICS[$i]}"
  RESPONSE=$(run_query "$metric") || {
    echo "Datadog API error while querying ${metric}" >&2
    exit 1
  }
  print_series "$metric" "$label" "$RESPONSE"
done

exit 0
