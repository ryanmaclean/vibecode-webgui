#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

THRESHOLD=${DISK_USED_THRESHOLD:-90}
USED=$(df -k / | tail -1 | awk '{print $5}' | tr -d '%')
if [[ -z "$USED" ]]; then
  exit 0
fi

if (( USED >= THRESHOLD )); then
  msg="Disk usage high: ${USED}% used on $(hostname)."
  if command -v gt >/dev/null 2>&1; then
    gt nudge mayor -m "$msg" >/dev/null 2>&1 || true
  fi
  echo "$msg"
fi
