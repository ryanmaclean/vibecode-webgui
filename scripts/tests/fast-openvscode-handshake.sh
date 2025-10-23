#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${FAST_OPENVSCODE_HOST:-}" ]]; then
  echo "FAST_OPENVSCODE_HOST not set (e.g., http://localhost:8080)" >&2
  exit 1
fi

ATTEMPTS=${HANDSHAKE_ATTEMPTS:-3}
SLEEP=${HANDSHAKE_SLEEP:-1}
LOG_DIR=${HANDSHAKE_LOG_DIR:-./artifacts}
mkdir -p "$LOG_DIR"

for i in $(seq 1 "$ATTEMPTS"); do
  timestamp=$(date -u +"%Y%m%dT%H%M%SZ")
  logfile="$LOG_DIR/handshake_${timestamp}_$i.log"
  echo "Attempt $i/$ATTEMPTS" | tee "$logfile"
  curl -sv --max-time 2 "$FAST_OPENVSCODE_HOST" >"$logfile.out" 2>>"$logfile" || true
  if grep -q "HTTP/1.1 200" "$logfile"; then
    echo "Handshake succeeded on attempt $i" | tee -a "$logfile"
    exit 0
  fi
  sleep "$SLEEP"
Done
done

echo "Handshake failed after $ATTEMPTS attempts" >&2
exit 1
