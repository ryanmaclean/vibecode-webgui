#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Install Datadog agent in running VibeCode VMs via SSH
# Agent: DevOps Engineer

# Initialize log aggregation
init_log_aggregation


set -e

DATADOG_API_KEY="${DATADOG_API_KEY:-}"
DATADOG_SITE="${DATADOG_SITE:-datadoghq.com}"

if [ -z "$DATADOG_API_KEY" ]; then
    echo "❌ Error: DATADOG_API_KEY environment variable not set"
    echo ""
    echo "Usage: DATADOG_API_KEY=your-key-here ./scripts/install-datadog-in-vms.sh"
    exit 1
fi

echo "======================================================================"
echo "  Installing Datadog Agents in Running VMs"
echo "======================================================================"
echo ""
echo "📋 This will install Datadog agent in each running VM"
echo "   Site: $DATADOG_SITE"
echo ""

# Function to check if VM is accessible via SSH
check_vm_ssh() {
    local vm_name=$1
    local vm_ip=$2
    local vm_port=${3:-22}
    
    echo "🔍 Checking SSH access to $vm_name ($vm_ip:$vm_port)..."
    
    # Try to connect (timeout after 5 seconds)
    if timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
        -p "$vm_port" "root@$vm_ip" "echo 'SSH OK'" 2>/dev/null; then
        echo "✅ SSH accessible"
        return 0
    else
        echo "❌ SSH not accessible"
        return 1
    fi
}

# Function to install Datadog in a VM
install_datadog_in_vm() {
    local vm_name=$1
    local vm_ip=$2
    local vm_port=${3:-22}
    
    echo ""
    echo "======================================================================"
    echo "  Installing Datadog in $vm_name"
    echo "======================================================================"
    
    if ! check_vm_ssh "$vm_name" "$vm_ip" "$vm_port"; then
        echo "⚠️  Skipping $vm_name - SSH not available"
        echo "   Make sure the VM is running and SSH is configured"
        return 1
    fi
    
    echo "📥 Installing Datadog agent..."
    
    # Create installation script
    cat > /tmp/datadog-install-${vm_name}.sh <<INSTALL_SCRIPT
#!/bin/sh
set -e

echo "Installing prerequisites..."
apk add --no-cache curl bash

echo "Downloading Datadog installer..."
DD_API_KEY="${DATADOG_API_KEY}" \
DD_SITE="${DATADOG_SITE}" \
bash -c "\$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"

echo "Configuring Datadog agent..."
cat > /etc/datadog-agent/datadog.yaml <<EOF
api_key: ${DATADOG_API_KEY}
site: ${DATADOG_SITE}
hostname: ${vm_name}
tags:
  - env:vibecode
  - vm:${vm_name}
  - platform:apple-vz

logs_enabled: true

apm_config:
  enabled: true
  apm_non_local_traffic: true

dogstatsd_config:
  non_local_traffic: true
EOF

echo "Starting Datadog agent..."
service datadog-agent start
service datadog-agent status || true

echo "✅ Datadog agent installed and running"
INSTALL_SCRIPT
    
    # Copy and execute installation script
    scp -o StrictHostKeyChecking=no -P "$vm_port" \
        /tmp/datadog-install-${vm_name}.sh "root@${vm_ip}:/tmp/install-dd.sh"
    
    ssh -o StrictHostKeyChecking=no -p "$vm_port" "root@${vm_ip}" \
        "chmod +x /tmp/install-dd.sh && /tmp/install-dd.sh"
    
    echo "✅ Datadog installed in $vm_name"
    rm /tmp/datadog-install-${vm_name}.sh
}

# =============================================================================
# Detect Running VMs
# =============================================================================

echo "🔍 Detecting running VMs..."
echo ""

# Method 1: Check if Lima VMs are running
if command -v limactl &> /dev/null; then
    echo "Checking Lima VMs..."
    while IFS= read -r line; do
        if echo "$line" | grep -q "Running"; then
            vm_name=$(echo "$line" | awk '{print $1}')
            echo "  Found Lima VM: $vm_name"
            
            # Get Lima VM IP and SSH port
            vm_ip=$(limactl show "$vm_name" | grep "SSH Local Port" | awk '{print $NF}' | cut -d: -f1)
            vm_port=$(limactl show "$vm_name" | grep "SSH Local Port" | awk '{print $NF}' | cut -d: -f2)
            
            if [ -n "$vm_ip" ] && [ -n "$vm_port" ]; then
                install_datadog_in_vm "$vm_name" "127.0.0.1" "$vm_port" || true
            fi
        fi
    done < <(limactl list | tail -n +2)
fi

# Method 2: VZ VMs (currently running through VibeCode app)
# These need network configuration first - for now, document the process
echo ""
echo "======================================================================"
echo "  VZ VMs (Running in VibeCode App)"
echo "======================================================================"
echo ""
echo "⚠️  The VZ VMs running in VibeCode app don't have SSH configured yet."
echo ""
echo "To enable SSH in VZ VMs:"
echo "  1. VMs need cloud-init or manual SSH setup"
echo "  2. Network port forwarding needs to be configured"
echo "  3. See Solution 2 (cloud-init) for pre-configured SSH"
echo ""

echo ""
echo "======================================================================"
echo "  Installation Complete"
echo "======================================================================"
echo ""
echo "✅ Datadog agents installed where accessible"
echo ""
echo "📊 Check Datadog dashboard:"
echo "   https://app.${DATADOG_SITE}/infrastructure"
echo ""
echo "🔍 Verify agents are reporting:"
echo "   datadog-agent status"
echo ""

