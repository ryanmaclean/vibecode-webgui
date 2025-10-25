#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
USER_DATA_DIR=${CHROMIUM_PROFILE_DIR:-"$REPO_ROOT/.chrome-code-server"}
CODE_SERVER_URL=${CODE_SERVER_URL:-"http://127.0.0.1:8080"}
CHROME_APP=${CHROMIUM_APP_PATH:-"/Applications/Google Chrome.app"}
HEALTH_PATH=${CODE_SERVER_HEALTH:-"$CODE_SERVER_URL/healthz"}
WAIT_SECONDS=${CHROMIUM_IDE_WAIT:-60}
CODE_SERVER_VERSION=${CODE_SERVER_VERSION:-"4.105.1"}

log() {
  printf '[chromium-ide] %s\n' "$*"
}

start_host_codeserver() {
  if command -v code-server >/dev/null 2>&1; then
    pkill -f 'code-server --bind-addr 127.0.0.1:8080' >/dev/null 2>&1 || true
    nohup code-server --bind-addr 127.0.0.1:8080 --auth none --disable-telemetry >/tmp/host-code-server.log 2>&1 &
    HOST_PID=$!
    log "Started host code-server fallback (pid $HOST_PID)"
    echo $HOST_PID > /tmp/host-code-server.pid
    return 0
  fi

  if command -v npx >/dev/null 2>&1; then
    pkill -f 'code-server --bind-addr 127.0.0.1:8080' >/dev/null 2>&1 || true
    nohup npx --yes code-server@$CODE_SERVER_VERSION --bind-addr 127.0.0.1:8080 --auth none --disable-telemetry >/tmp/npx-code-server.log 2>&1 &
    HOST_PID=$!
    log "Started code-server via npx (pid $HOST_PID)"
    echo $HOST_PID > /tmp/host-code-server.pid
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    docker rm -f vibecode-kiosk-code-server >/dev/null 2>&1 || true
    docker run -d --name vibecode-kiosk-code-server \
      -p 127.0.0.1:8080:8080 \
      codercom/code-server:latest \
      --auth none --disable-telemetry >/tmp/docker-code-server.log 2>&1
    log "Started code-server via Docker (vibecode-kiosk-code-server)"
    return 0
  fi

  log "error: host code-server binary not found and Docker unavailable"
  return 1
}

if [[ ! -d "$CHROME_APP" ]]; then
  log "error: Chromium/Chrome app not found at $CHROME_APP"
  log "Set CHROMIUM_APP_PATH to your browser app (e.g., /Applications/Chromium.app)"
  exit 1
fi

log "Starting Lima VM via npm run lima:start"
( cd "$REPO_ROOT" && npm run --silent lima:start ) >/dev/null

log "Ensuring code-server is installed and running inside ide-lima"
limactl shell ide-lima -- sudo env CODE_SERVER_VERSION="'$CODE_SERVER_VERSION'" ash -c '
  set -e
  VERSION="${CODE_SERVER_VERSION:-4.105.1}"
  if ! command -v code-server >/dev/null 2>&1; then
    echo "[ide-lima] Installing code-server v$VERSION"
    apk add --no-cache curl tar
    TMP=$(mktemp -d)
    cd "$TMP"
    curl -fsSLo code-server.tgz "https://github.com/coder/code-server/releases/download/v$VERSION/code-server-$VERSION-linux-amd64.tar.gz"
    tar -xzf code-server.tgz
    install -m 0755 "code-server-$VERSION-linux-amd64/bin/code-server" /usr/local/bin/code-server
    rm -rf "$TMP"
  fi
  pkill code-server >/dev/null 2>&1 || true
  nohup code-server --bind-addr 0.0.0.0:8080 --auth none --disable-telemetry >/tmp/code-server.log 2>&1 &
'

log "Waiting for code-server at $HEALTH_PATH (timeout ${WAIT_SECONDS}s)"
deadline=$((SECONDS + WAIT_SECONDS))
ready_source="lima"
until curl -fsS "$HEALTH_PATH" >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    log "Lima code-server did not start within ${WAIT_SECONDS}s; attempting host fallback"
    if start_host_codeserver; then
      ready_source="host"
      deadline=$((SECONDS + WAIT_SECONDS))
      continue
    fi
    log "error: code-server failed to start"
    exit 1
  fi
  sleep 1
  printf '.'
  (( (SECONDS % 50) == 0 )) && printf '\n'
done
printf '\n'
log "code-server ready (${ready_source})"

log "Launching Chromium kiosk"
open -a "$CHROME_APP" --args \
  --kiosk \
  --app="$CODE_SERVER_URL" \
  --disable-translate \
  --no-first-run \
  --user-data-dir="$USER_DATA_DIR"

log "Tip: close the browser window when finished, then run npm run lima:stop"
