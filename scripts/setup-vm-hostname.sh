#!/bin/bash
# Setup VM hostname on host machine
# Usage: sudo ./setup-vm-hostname.sh [ip_address]
#
# This script adds the vibecode-vm hostname to /etc/hosts so you can access
# the VM using: ssh root@vibecode-vm, redis-cli -h vibecode-vm, etc.

VM_IP="${1:-192.168.64.10}"
VM_HOSTNAME="vibecode-vm"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0 $VM_IP"
    exit 1
fi

# Remove old entry if exists
sed -i.bak "/$VM_HOSTNAME/d" /etc/hosts

# Add new entry
echo "$VM_IP $VM_HOSTNAME" >> /etc/hosts

echo "Added $VM_HOSTNAME -> $VM_IP to /etc/hosts"
echo ""
echo "You can now access the VM using:"
echo "  ssh root@$VM_HOSTNAME"
echo "  redis-cli -h $VM_HOSTNAME -p 6379"
echo "  psql -h $VM_HOSTNAME -U postgres"
echo "  http://$VM_HOSTNAME:8080 (OpenVSCode)"
echo ""
echo "To find the actual VM IP, check the VM console or run:"
echo "  ping -c1 $VM_HOSTNAME"


