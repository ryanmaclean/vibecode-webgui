#!/usr/bin/env bash
set -euo pipefail

# Deprecated: PostgreSQL setup is handled by scripts/postgres_setup.py

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON=${PYTHON:-python3}

cat <<'MSG'
[aks-postgresql-setup] NOTICE: this script is deprecated.
Please invoke scripts/postgres_setup.py directly.
Proceeding by delegating to the Python helper...
MSG

"$PYTHON" "$SCRIPT_DIR/postgres_setup.py" "$@"
