#!/usr/bin/env bash
set -euo pipefail

: "${DD_API_KEY:?DD_API_KEY required}"
: "${DD_APP_KEY:?DD_APP_KEY required}"
DD_SITE=${DD_SITE:-datadoghq.com}
API_BASE="https://api.${DD_SITE}"

upsert_metric() {
  local metric_id="$1"
  local filter_query="$2"
  local group_by_json="$3"

  local payload
  payload=$(jq -n \
    --arg id "$metric_id" \
    --arg filter "$filter_query" \
    --argjson group_by "$group_by_json" \
    '{
      data: {
        id: $id,
        type: "logs_metrics",
        attributes: {
          compute: {
            aggregation_type: "count"
          },
          filter: {
            query: $filter
          },
          group_by: $group_by
        }
      }
    }')

  local existing
  existing=$(curl -s -H "DD-API-KEY: ${DD_API_KEY}" -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
    "${API_BASE}/api/v2/logs/config/metrics")
  if echo "$existing" | jq -e --arg id "$metric_id" '.data[] | select(.id == $id)' >/dev/null 2>&1; then
    response=$(curl -s -X PATCH "${API_BASE}/api/v2/logs/config/metrics/${metric_id}" \
      -H "DD-API-KEY: ${DD_API_KEY}" \
      -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload")
  else
    response=$(curl -s -X POST "${API_BASE}/api/v2/logs/config/metrics" \
      -H "DD-API-KEY: ${DD_API_KEY}" \
      -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload")
  fi

  if echo "$response" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$response" | jq -c '{status:"error", errors:.errors}'
    return 1
  fi
  echo "$response" | jq -r '.data.id'
}

role_group_by='[
  {"path":"@role","tag_name":"role"},
  {"path":"@source","tag_name":"source"},
  {"path":"@rig","tag_name":"rig"},
  {"path":"service","tag_name":"service"}
]'

bead_group_by='[
  {"path":"@stage","tag_name":"stage"},
  {"path":"@role","tag_name":"role"},
  {"path":"@source","tag_name":"source"},
  {"path":"@rig","tag_name":"rig"},
  {"path":"service","tag_name":"service"}
]'

upsert_metric "gastown.role_activity.count" "event_type:role_activity service:vibecode-webgui" "$role_group_by"
upsert_metric "gastown.bead_provenance.count" "event_type:bead_provenance service:vibecode-webgui" "$bead_group_by"
