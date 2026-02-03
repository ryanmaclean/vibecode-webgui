#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_SCRIPT="$ROOT_DIR/scripts/build-unified-vm.sh"
LEGACY_SCRIPT="$HOME/vibecode-webgui/azure/build-unified-services-with-datadog.sh"

if [[ -x "$LOCAL_SCRIPT" ]]; then
  echo "Delegating to $LOCAL_SCRIPT"
  exec "$LOCAL_SCRIPT" "$@"
fi

if [[ -x "$LEGACY_SCRIPT" ]]; then
  echo "Delegating to $LEGACY_SCRIPT"
  exec "$LEGACY_SCRIPT" "$@"
fi

cat <<'ERROR_MSG'
ERROR: build-unified-services-with-datadog.sh not found.

This repository documents the unified VM build workflow, but the full build
script is not present here. To proceed:

1. Ensure the legacy repo is cloned at ~/vibecode-webgui
2. Run the build script from there:
   ~/vibecode-webgui/azure/build-unified-services-with-datadog.sh

If you expect a local build script, add it to:
  scripts/build-unified-vm.sh
or replace this wrapper with the full build implementation.
ERROR_MSG

exit 1
