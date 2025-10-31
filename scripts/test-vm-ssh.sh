#!/bin/bash
# Test SSH connectivity to VMs

echo "Testing SSH to all VMs..."
echo ""

for vm in postgresql valkey nodejs codeserver ide pgvector; do
    echo -n "Testing vibecode-$vm... "
    if ssh -F ~/.ssh/vibecode/config -o ConnectTimeout=2 "vibecode-$vm" "hostname" 2>/dev/null; then
        echo "✅ Connected"
    else
        echo "❌ Not accessible"
    fi
done
