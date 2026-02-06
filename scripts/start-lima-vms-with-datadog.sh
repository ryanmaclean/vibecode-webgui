#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Start Lima VMs with Datadog agents
# Agent: Platform Engineer

# Initialize log aggregation
init_log_aggregation


set -e

DATADOG_API_KEY="${DATADOG_API_KEY:-}"
DATADOG_SITE="${DATADOG_SITE:-datadoghq.com}"
CONFIG_DIR="$(cd "$(dirname "$0")/../config/lima" && pwd)"

if [ -z "$DATADOG_API_KEY" ]; then
    echo "❌ Error: DATADOG_API_KEY environment variable not set"
    echo ""
    echo "Usage: DATADOG_API_KEY=your-key-here ./scripts/start-lima-vms-with-datadog.sh"
    exit 1
fi

echo "======================================================================"
echo "  Starting Lima VMs with Datadog Agents"
echo "======================================================================"
echo ""
echo "📋 This will start Lima VMs with Datadog pre-configured"
echo "   Site: $DATADOG_SITE"
echo ""

# Export for Lima provisioning scripts
export DD_API_KEY="$DATADOG_API_KEY"
export DD_SITE="$DATADOG_SITE"

# Function to start a Lima VM
start_lima_vm() {
    local vm_name=$1
    local config_file=$2
    
    echo ""
    echo "======================================================================"
    echo "  Starting $vm_name"
    echo "======================================================================"
    
    if limactl list | grep -q "^${vm_name}.*Running"; then
        echo "✅ $vm_name is already running"
        return 0
    fi
    
    if limactl list | grep -q "^${vm_name}"; then
        echo "🔄 VM exists, deleting old instance..."
        limactl delete -f "$vm_name" 2>/dev/null || true
    fi
    
    echo "🚀 Creating and starting $vm_name..."
    limactl start --name="$vm_name" "$config_file"
    
    echo "✅ $vm_name started successfully"
}

# Start Valkey VM
if [ -f "$CONFIG_DIR/valkey-vm-datadog.yaml" ]; then
    start_lima_vm "vibecode-valkey-dd" "$CONFIG_DIR/valkey-vm-datadog.yaml"
else
    echo "⚠️  Valkey config not found, using standard config..."
    start_lima_vm "vibecode-valkey" "$CONFIG_DIR/valkey-vm.yaml"
    
    # Install Datadog after VM starts
    echo "📥 Installing Datadog in vibecode-valkey..."
    limactl shell vibecode-valkey bash <<INSTALL
set -e
sudo apk add --no-cache curl bash python3
DD_API_KEY="$DATADOG_API_KEY" DD_SITE="$DATADOG_SITE" bash -c "\$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"
sudo tee /etc/datadog-agent/datadog.yaml > /dev/null <<EOF
api_key: $DATADOG_API_KEY
site: $DATADOG_SITE
hostname: vibecode-valkey-lima
tags:
  - env:vibecode
  - vm:valkey
  - platform:lima
logs_enabled: true
EOF
sudo rc-update add datadog-agent default
sudo service datadog-agent start
INSTALL
fi

# Start Node.js VM
if limactl list | grep -q "^vibecode-nodejs"; then
    echo "✅ Node.js VM already exists"
else
    echo "🚀 Starting Node.js VM..."
    if [ -f "$CONFIG_DIR/nodejs-dev-vm.yaml" ]; then
        start_lima_vm "vibecode-nodejs" "$CONFIG_DIR/nodejs-dev-vm.yaml"
    fi
fi

# Start pgvector VM
if limactl list | grep -q "^vibecode-pgvector"; then
    echo "✅ pgvector VM already exists"
else
    echo "🚀 Starting pgvector VM..."
    if [ -f "$CONFIG_DIR/postgresql-pgvector-vm.yaml" ]; then
        start_lima_vm "vibecode-pgvector" "$CONFIG_DIR/postgresql-pgvector-vm.yaml"
    fi
fi

echo ""
echo "======================================================================"
echo "  Lima VMs Started"
echo "======================================================================"
echo ""
echo "✅ VMs running with Datadog:"
echo ""
limactl list
echo ""
echo "📊 Check Datadog dashboard:"
echo "   https://app.${DATADOG_SITE}/infrastructure"
echo ""
echo "🔍 Verify Datadog in a VM:"
echo "   limactl shell vibecode-valkey-dd datadog-agent status"
echo ""
echo "🛑 Stop all VMs:"
echo "   limactl stop vibecode-valkey-dd vibecode-nodejs vibecode-pgvector"
echo ""

