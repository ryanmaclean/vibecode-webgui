#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
USER_DATA_DIR=${CHROMIUM_PROFILE_DIR:-"$REPO_ROOT/.chrome-code-server"}
CODE_SERVER_URL=${CODE_SERVER_URL:-"http://127.0.0.1:8080"}
CHROME_APP=${CHROMIUM_APP_PATH:-"/Applications/Google Chrome.app"}
HEALTH_PATH=${CODE_SERVER_HEALTH:-"$CODE_SERVER_URL/healthz"}
WAIT_SECONDS=${CHROMIUM_IDE_WAIT:-60}

log() {
  printf '[chromium-ide] %s\n' "$*"
}

if [[ ! -d "$CHROME_APP" ]]; then
  log "error: Chromium/Chrome app not found at $CHROME_APP"
  log "Set CHROMIUM_APP_PATH to your browser app (e.g., /Applications/Chromium.app)"
  exit 1
fi

log "Starting Lima VM via npm run lima:start"
( cd "$REPO_ROOT" && npm run --silent lima:start ) >/dev/null

log "Waiting for code-server at $HEALTH_PATH (timeout ${WAIT_SECONDS}s)"
deadline=$((SECONDS + WAIT_SECONDS))
until curl -fsS "$HEALTH_PATH" >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    log "error: code-server did not become ready within ${WAIT_SECONDS}s"
    exit 1
  fi
  sleep 1
  printf '.'
  (( (SECONDS % 50) == 0 )) && printf '\n'
done
printf '\n'
log "code-server ready"

log "Launching Chromium kiosk"
open -a "$CHROME_APP" --args \
  --kiosk \
  --app="$CODE_SERVER_URL" \
  --disable-translate \
  --no-first-run \
  --user-data-dir="$USER_DATA_DIR"

log "Tip: close the browser window when finished, then run npm run lima:stop"
