#!/bin/bash
set -euo pipefail
ENV_FILE="/Users/studio/gt/daemon/gt-event-emitter.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi
set -a
. "$ENV_FILE"
set +a
exec /Users/studio/gt/daemon/gt-event-emitter.py
