#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Agent 1: Execute Linux VM Networking Test

# Initialize log aggregation
init_log_aggregation

set -e

echo "=== Agent 1: Linux VM Networking Test ==="
echo ""

# Check for Alpine kernel
KERNEL_PATH="$HOME/.alpinevm/vmlinuz"
if [ ! -f "$KERNEL_PATH" ]; then
    echo "⚠️  Alpine kernel not found at $KERNEL_PATH"
    echo "Checking alternative locations..."
    KERNEL_PATH=$(find ~ -name "vmlinuz" -type f 2>/dev/null | grep -i alpine | head -1)
    if [ -z "$KERNEL_PATH" ]; then
        echo "❌ No Alpine kernel found. Please download one first."
        exit 1
    fi
fi

echo "✅ Found kernel: $KERNEL_PATH"

# Create test VM directory
VM_NAME="test-networking-$(date +%s)"
VM_DIR="$HOME/.vfkit/vms/$VM_NAME"
KERNEL_DIR="$VM_DIR/kernel"
mkdir -p "$KERNEL_DIR"

echo "Creating test VM: $VM_NAME"
echo "VM directory: $VM_DIR"

# Copy kernel
cp "$KERNEL_PATH" "$KERNEL_DIR/vmlinuz"
echo "✅ Kernel copied"

# Build Swift VM tool
echo ""
echo "Building Swift VM tool..."
cd platforms/macos/vz-swift
swift build -c release 2>&1 | tail -5
cd - > /dev/null

VM_TOOL="./platforms/macos/vz-swift/.build/release/vibecode-vm-standalone"
if [ ! -f "$VM_TOOL" ]; then
    VM_TOOL="./platforms/macos/vz-swift/.build/debug/vibecode-vm-standalone"
fi

if [ ! -f "$VM_TOOL" ]; then
    echo "❌ VM tool not found. Build may have failed."
    exit 1
fi

echo "✅ VM tool ready: $VM_TOOL"

# Create test script that will run inside VM
cat > "$VM_DIR/test-networking.sh" << 'VMSCRIPT'
#!/bin/sh
echo "=== Inside VM: Testing Networking ==="
echo ""

# Wait for network
sleep 5

# Check eth0 interface
echo "Checking eth0 interface..."
if ip link show eth0 >/dev/null 2>&1; then
    echo "✅ eth0 interface exists"
    
    # Check carrier
    CARRIER=$(cat /sys/class/net/eth0/carrier 2>/dev/null || echo "0")
    if [ "$CARRIER" = "1" ]; then
        echo "✅ eth0 carrier=1 (connected)"
    else
        echo "❌ eth0 carrier=0 (not connected)"
        exit 1
    fi
    
    # Check IP
    IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    if [ -n "$IP" ]; then
        echo "✅ eth0 has IP: $IP"
    else
        echo "❌ eth0 has no IP address"
        exit 1
    fi
    
    # Test connectivity
    echo ""
    echo "Testing connectivity..."
    if ping -c 1 192.168.64.1 >/dev/null 2>&1; then
        echo "✅ Can ping gateway (192.168.64.1)"
    else
        echo "❌ Cannot ping gateway"
        exit 1
    fi
    
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        echo "✅ Can ping external DNS (8.8.8.8)"
    else
        echo "⚠️  Cannot ping external DNS (may be expected)"
    fi
    
    echo ""
    echo "✅ Networking test PASSED"
else
    echo "❌ eth0 interface not found"
    exit 1
fi
VMSCRIPT

echo ""
echo "=== Test VM Created ==="
echo "VM Name: $VM_NAME"
echo "VM Directory: $VM_DIR"
echo ""
echo "Next steps:"
echo "1. Boot the VM: $VM_TOOL linux $VM_NAME"
echo "2. Once booted, run: sh /test-networking.sh"
echo "3. Check results"
echo ""
echo "Or use automated test (requires VM to boot and run script):"
echo "  ./scripts/vz/agent-1-automated-test.sh $VM_NAME"
