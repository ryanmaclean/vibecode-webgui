#!/usr/bin/env bash
# VM Health Check - Verify all VMs are running and healthy
# Checks: Process status, port availability, service connectivity

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/vm-manager.sh" health
