#!/usr/bin/env bash
# Generate synthetic traffic against the vibechat Azure App Service to exercise Datadog instrumentation.

set -euo pipefail

BASE_URL=${BASE_URL:-"https://vibechat.azurewebsites.net"}
USER_AGENT="vibecode-observability-harness/1.0"
AUTH_BEARER=${AUTH_BEARER:-""}
HARNESS_EMAIL=${HARNESS_EMAIL:-${TEST_EMAIL:-""}}
HARNESS_PASSWORD=${HARNESS_PASSWORD:-${TEST_PASSWORD:-""}}
COOKIE_JAR=""

cleanup() {
  if [[ -n "$COOKIE_JAR" && -f "$COOKIE_JAR" ]]; then
    rm -f "$COOKIE_JAR"
  fi
}
trap cleanup EXIT

log_step() {
  printf '\n[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

curl_json() {
  local method=$1
  local path=$2
  local body=${3:-}
  local tmp_response
  tmp_response=$(mktemp)

  local -a curl_cmd=(curl -sS -o "$tmp_response" -w '%{http_code}' -X "$method" "$BASE_URL$path" -H "User-Agent: $USER_AGENT")
  if [[ -n "$AUTH_BEARER" ]]; then
    curl_cmd+=(-H "Authorization: Bearer $AUTH_BEARER")
  fi
  if [[ -n "$COOKIE_JAR" ]]; then
    curl_cmd+=(-b "$COOKIE_JAR" -c "$COOKIE_JAR")
  fi
  if [[ -n "$body" ]]; then
    curl_cmd+=(-H 'Content-Type: application/json' --data "$body")
  fi

  local status
  status=$("${curl_cmd[@]}")

  printf ' %s %s -> %s\n' "$method" "$path" "$status"
  if command -v jq >/dev/null 2>&1; then
    jq '.' "$tmp_response" 2>/dev/null || cat "$tmp_response"
  else
    cat "$tmp_response"
  fi

  rm -f "$tmp_response"
}

perform_login() {
  if [[ -z "$HARNESS_EMAIL" || -z "$HARNESS_PASSWORD" ]]; then
    log_step "Skipping login (HARNESS_EMAIL/HARNESS_PASSWORD not set)"
    return 0
  fi

  COOKIE_JAR=$(mktemp)

  log_step "Fetching CSRF token"
  local csrf_response
  csrf_response=$(curl -sS -X GET -H "User-Agent: $USER_AGENT" -c "$COOKIE_JAR" "$BASE_URL/api/auth/csrf")
  local csrf_token
  csrf_token=$(printf '%s' "$csrf_response" | jq -r '.csrfToken' 2>/dev/null || true)
  if [[ -z "$csrf_token" || "$csrf_token" == "null" ]]; then
    echo "Failed to obtain CSRF token" >&2
    return 1
  fi

  log_step "Logging in"
  local login_status
  login_status=$(curl -sS -o /tmp/harness-login.json -w '%{http_code}' \
    -X POST "$BASE_URL/api/auth/callback/credentials?json=true" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -H "User-Agent: $USER_AGENT" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    --data "csrfToken=$csrf_token&callbackUrl=/&json=true&email=$HARNESS_EMAIL&password=$HARNESS_PASSWORD")

  if [[ "$login_status" != "200" ]]; then
    echo "Login failed with status $login_status" >&2
    cat /tmp/harness-login.json >&2 || true
    return 1
  fi

  jq '.' /tmp/harness-login.json 2>/dev/null || cat /tmp/harness-login.json
  rm -f /tmp/harness-login.json
}

log_step "Loading landing page"
curl_json GET /

log_step "Fetching frontend settings"
curl_json GET /frontend_settings

log_step "Listing conversation history"
curl_json GET '/history/list?offset=0'

log_step "Ensuring history store is initialised"
curl_json GET /history/ensure

perform_login || log_step "Login skipped/failed; continuing without session"

log_step "Posting chat message"
CHAT_BODY=$(cat <<'JSON'
{
  "messages": [
    {
      "role": "user",
      "content": "Hello from the automated Datadog harness. Please respond with a short acknowledgement."
    }
  ]
}
JSON
)
curl_json POST /conversation "$CHAT_BODY"

log_step "Traffic generation complete"
