#!/usr/bin/env bash
set -euo pipefail

echo "Starting all 4 VMs..."
echo ""

/Users/ryan.maclean/.vfkit/vms/vibecode-valkey/launch.sh
/Users/ryan.maclean/.vfkit/vms/vibecode-postgresql/launch.sh
/Users/ryan.maclean/.vfkit/vms/vibecode-pgvector/launch.sh
/Users/ryan.maclean/.vfkit/vms/vibecode-nodejs-dev/launch.sh

echo ""
echo "✅ All 4 VMs started!"
echo ""
echo "Logs:"
echo "  Valkey:      tail -f /Users/ryan.maclean/.vfkit/vms/vibecode-valkey/logs/console.log"
echo "  PostgreSQL:  tail -f /Users/ryan.maclean/.vfkit/vms/vibecode-postgresql/logs/console.log"
echo "  pgvector:    tail -f /Users/ryan.maclean/.vfkit/vms/vibecode-pgvector/logs/console.log"
echo "  Node.js Dev: tail -f /Users/ryan.maclean/.vfkit/vms/vibecode-nodejs-dev/logs/console.log"
