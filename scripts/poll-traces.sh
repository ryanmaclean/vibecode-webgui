#!/usr/bin/env bash
set -euo pipefail
DD_API_KEY=$(grep '^DD_API_KEY=' .env.local | cut -d= -f2)
DD_APP_KEY=$(grep '^DD_APP_KEY=' .env.local | cut -d= -f2)
QUERY=${1:-service:vibecode-webgui-smoke}
WINDOW=${2:-now-1h}

curl -s -X POST "https://api.datadoghq.com/api/v2/apm/traces/events/search" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filter":{"query":"'"$QUERY"'","from":"'"$WINDOW"'","to":"now"},"page":{"limit":5}}'
