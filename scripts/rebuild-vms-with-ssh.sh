#!/bin/bash
# Rebuild VMs with SSH pre-configured
# Uses cloud-init to inject SSH keys

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Rebuilding VMs with SSH configuration..."
echo ""

# This would use the cloud-init/ssh-user-data.yaml
# Combined with build-vz-vms-with-datadog.sh approach

echo "Not yet implemented - requires VM rebuild workflow"
echo "See: config/cloud-init/ssh-user-data.yaml"
