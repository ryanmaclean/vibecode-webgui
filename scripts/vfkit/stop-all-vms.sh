#!/usr/bin/env bash
# Stop All VMs - Graceful shutdown in reverse dependency order
# Order: nodejs-dev -> postgresql -> valkey

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/vm-manager.sh" stop-all
