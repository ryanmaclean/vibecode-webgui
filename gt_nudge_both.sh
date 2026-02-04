#!/usr/bin/env bash
set -euo pipefail

MSG=${*:-"status check"}
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Local
if command -v gt >/dev/null 2>&1; then
  gt nudge mayor -m "${MSG} (${TS})" >/dev/null 2>&1 || true
  gt nudge deacon -m "${MSG} (${TS})" >/dev/null 2>&1 || true
fi

# Remote (studio)
ssh studio "cd /Users/studio/gt && if command -v gt >/dev/null 2>&1; then gt nudge mayor -m '${MSG} (${TS})' >/dev/null 2>&1 || true; gt nudge deacon -m '${MSG} (${TS})' >/dev/null 2>&1 || true; fi" || true
