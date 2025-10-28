#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ARCH=$(uname -m)
CHROME_APP=${CHROMIUM_APP_PATH:-"/Applications/Google Chrome.app"}
PROFILE_DIR=${CHROMIUM_PROFILE_DIR:-"$REPO_ROOT/.chrome-code-server"}

log() { printf '[universal-ide] %s\n' "$*"; }

if [[ ! -d "$CHROME_APP" ]]; then
  log "error: Chrome/Chromium missing at $CHROME_APP"
  exit 1
fi

launch_chrome() {
  local url=$1
  open -a "$CHROME_APP" --args --kiosk --app="$url" --disable-translate --no-first-run --user-data-dir="$PROFILE_DIR"
}

start_vfkit() {
  log "Detected arm64 + vfkit; launching fast microVM"
  export MICROVM_ARCH=${MICROVM_ARCH:-x86_64}
  scripts/benchmarks/vscode_microvm.sh start
  log "Waiting for http://127.0.0.1:3600/healthz"
  until curl -fsS http://127.0.0.1:3600/healthz >/dev/null 2>&1; do sleep 1; done
  launch_chrome "http://127.0.0.1:3600"
}

start_lima() {
  log "Using Lima microVM"
  scripts/dev/start-chromium-ide.sh
}

start_host() {
  log "Lima/vfkit not available; falling back to host mode"
  LIMA_DISABLED=1 scripts/dev/start-chromium-ide.sh
}

if [[ $ARCH == "arm64" && $(command -v vfkit >/dev/null 2>&1 && echo 1 || echo 0) == 1 ]]; then
  start_vfkit
elif command -v limactl >/dev/null 2>&1; then
  start_lima
else
  start_host
fi
