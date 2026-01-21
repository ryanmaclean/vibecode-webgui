#!/bin/bash
# SSH Tunnel Script for OpenVSCode Access
# This script establishes an SSH tunnel from host to VM to access OpenVSCode

set -e

# Configuration
VM_IP="${1:-192.168.64.3}"
LOCAL_PORT="${2:-3000}"
REMOTE_PORT="3000"
SSH_USER="root"
SSH_PASS="password"

echo "=== SSH Tunnel Setup for OpenVSCode ==="
echo "VM IP: $VM_IP"
echo "Local Port: $LOCAL_PORT"
echo "Remote Port: $REMOTE_PORT"
echo ""

# Check if VM is reachable
echo "Testing VM connectivity..."
if ! ping -c 1 -W 2 "$VM_IP" >/dev/null 2>&1; then
    echo "ERROR: Cannot reach VM at $VM_IP"
    echo "Please check that:"
    echo "  1. The VM is running"
    echo "  2. The VM has network connectivity"
    echo "  3. The IP address is correct (check VM logs)"
    exit 1
fi
echo "VM is reachable!"
echo ""

# Check if SSH port is open
echo "Testing SSH connectivity..."
if ! nc -z -w 2 "$VM_IP" 22 2>/dev/null; then
    echo "ERROR: SSH port 22 is not open on $VM_IP"
    echo "Please check that:"
    echo "  1. The VM has booted completely (check logs)"
    echo "  2. Dropbear SSH server is running in the VM"
    echo "  3. The firewall is not blocking port 22"
    exit 1
fi
echo "SSH port is open!"
echo ""

# Check if local port is already in use
if lsof -Pi :$LOCAL_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "WARNING: Local port $LOCAL_PORT is already in use"
    echo "Checking if it's an existing SSH tunnel..."
    if ps aux | grep -q "[s]sh.*$VM_IP.*$LOCAL_PORT"; then
        echo "An SSH tunnel to $VM_IP is already active."
        echo "You can access OpenVSCode at: http://localhost:$LOCAL_PORT"
        exit 0
    else
        echo "ERROR: Port $LOCAL_PORT is in use by another process"
        echo "Please close the other process or use a different port:"
        echo "  $0 $VM_IP <different_port>"
        exit 1
    fi
fi

echo "Creating SSH tunnel..."
echo "Command: ssh -L $LOCAL_PORT:127.0.0.1:$REMOTE_PORT $SSH_USER@$VM_IP"
echo ""
echo "Default password: $SSH_PASS"
echo ""
echo "Once connected:"
echo "  - Keep this terminal open to maintain the tunnel"
echo "  - Access OpenVSCode at: http://localhost:$LOCAL_PORT"
echo "  - Press Ctrl+C to close the tunnel"
echo ""

# Create SSH tunnel
# -L: Local port forwarding
# -N: Don't execute remote commands (just forward ports)
# -v: Verbose (for debugging)
ssh -L "$LOCAL_PORT:127.0.0.1:$REMOTE_PORT" \
    -o "StrictHostKeyChecking=no" \
    -o "UserKnownHostsFile=/dev/null" \
    -o "ServerAliveInterval=60" \
    -o "ServerAliveCountMax=3" \
    "$SSH_USER@$VM_IP"
