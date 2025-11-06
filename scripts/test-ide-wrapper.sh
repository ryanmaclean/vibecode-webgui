#!/usr/bin/env bash
# Test the IDE wrapper behavior: start, health, stop (direct binary simulation)
set -euo pipefail

HOST=127.0.0.1
PORT=${PORT:-18081}
BIN=${VIBECODE_IDE_BIN:-}

log() { echo "[test-ide-wrapper] $*"; }

# Resolve IDE binary if not provided
if [[ -z "${BIN}" ]]; then
  for cand in \
    /opt/homebrew/bin/openvscode-server \
    /usr/local/bin/openvscode-server \
    /opt/homebrew/bin/code-server \
    /usr/local/bin/code-server; do
    if [[ -x "$cand" ]]; then BIN="$cand"; break; fi
  done
fi

if [[ -z "${BIN}" ]]; then
  log "ERROR: No IDE binary found. Set VIBECODE_IDE_BIN to the executable path."
  exit 1
fi

WORKDIR="${TMPDIR:-/tmp}/vibecode-ide-test"
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR/user-data" "$WORKDIR/extensions" "$WORKDIR/logs"
LOGFILE="$WORKDIR/logs/test-ide-wrapper.log"

# Launch
log "Launching: $BIN"
if [[ "$BIN" == *openvscode-server* ]]; then
  "$BIN" \
    --host "$HOST" \
    --port "$PORT" \
    --without-connection-token \
    --disable-telemetry \
    --user-data-dir "$WORKDIR/user-data" \
    --extensions-dir "$WORKDIR/extensions" \
    >"$LOGFILE" 2>&1 &
  PID=$!
else
  "$BIN" \
    --bind-addr "${HOST}:${PORT}" \
    --disable-telemetry \
    --user-data-dir "$WORKDIR/user-data" \
    --extensions-dir "$WORKDIR/extensions" \
    >"$LOGFILE" 2>&1 &
  PID=$!
fi

# Wait for health
ATTEMPTS=40
SLEEP=0.25
ok=false
for _ in $(seq 1 $ATTEMPTS); do
  if curl -fsS "http://${HOST}:${PORT}/" >/dev/null 2>&1; then ok=true; break; fi
  sleep "$SLEEP"
done

if [[ "$ok" != true ]]; then
  log "FAIL: Server did not become healthy on http://${HOST}:${PORT}/"
  tail -n +1 "$LOGFILE" || true
  kill $PID 2>/dev/null || true
  exit 1
fi
log "PASS: Health OK on http://${HOST}:${PORT}/"

# Stop
kill $PID
wait $PID || true
log "PASS: Stopped cleanly"

exit 0
