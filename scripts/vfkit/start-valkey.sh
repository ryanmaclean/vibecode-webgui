#!/usr/bin/env bash
# Start Valkey VM - In-memory cache for VibeCode sessions
# Port: 6379
# Memory: 1GB
# License: BSD-3-Clause (Linux Foundation)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/vm-manager.sh" start valkey
