#!/usr/bin/env bash
set -euo pipefail

VM_BASE="${HOME}/.vfkit/vms"

echo "Starting all 4 VMs..."

"${VM_BASE}/vibecode-valkey/launch.sh"
sleep 2
"${VM_BASE}/vibecode-postgresql/launch.sh"
sleep 2
"${VM_BASE}/vibecode-pgvector/launch.sh"
sleep 2
"${VM_BASE}/vibecode-nodejs-dev/launch.sh"

echo ""
echo "✅ All VMs started!"
echo ""
echo "Check status:"
echo "  ps aux | grep vfkit"
echo ""
echo "View logs:"
echo "  tail -f ${VM_BASE}/vibecode-valkey/logs/console.log"
echo "  tail -f ${VM_BASE}/vibecode-postgresql/logs/console.log"
echo "  tail -f ${VM_BASE}/vibecode-pgvector/logs/console.log"
echo "  tail -f ${VM_BASE}/vibecode-nodejs-dev/logs/console.log"
