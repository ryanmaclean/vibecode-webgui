#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Rebuild VMs with SSH pre-configured
# Uses cloud-init to inject SSH keys

# Initialize log aggregation
init_log_aggregation


SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Rebuilding VMs with SSH configuration..."
echo ""

# This would use the cloud-init/ssh-user-data.yaml
# Combined with build-vz-vms-with-datadog.sh approach

echo "Not yet implemented - requires VM rebuild workflow"
echo "See: config/cloud-init/ssh-user-data.yaml"
