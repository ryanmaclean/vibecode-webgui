#!/usr/bin/env bash
set -euo pipefail

# Deprecated: Datadog setup is handled by scripts/datadog_setup.py

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON=${PYTHON:-python3}

cat <<'MSG'
[aks-datadog-setup] NOTICE: this script is deprecated.
Please invoke scripts/datadog_setup.py directly.
Proceeding by delegating to the Python helper...
MSG

"$PYTHON" "$SCRIPT_DIR/datadog_setup.py" "$@"
