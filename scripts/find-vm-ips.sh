#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Find IP addresses of running VZ VMs
# Experiment 8: Network Diagnostics

# Initialize log aggregation
init_log_aggregation


echo "=================================="
echo "VM IP Discovery"
echo "=================================="
echo ""

echo "[1/3] Scanning bridge100 network..."
# VZ VMs typically get IPs in 192.168.64.x range
if command -v nmap &>/dev/null; then
    nmap -sn 192.168.64.0/24 2>&1 | grep "192.168.64"
else
    echo "  nmap not installed, using arp..."
    arp -a | grep "192.168.64"
fi

echo ""
echo "[2/3] Checking ARP table..."
arp -an | grep "192.168.64" | sort

echo ""
echo "[3/3] Scanning common service ports..."
for ip in 192.168.64.{2..10}; do
    echo -n "Checking $ip... "
    
    # Quick check for any services
    SERVICES=""
    nc -z -w 1 "$ip" 5432 2>/dev/null && SERVICES="$SERVICES PostgreSQL:5432"
    nc -z -w 1 "$ip" 6379 2>/dev/null && SERVICES="$SERVICES Valkey:6379"
    nc -z -w 1 "$ip" 3000 2>/dev/null && SERVICES="$SERVICES Node:3000"
    nc -z -w 1 "$ip" 8080 2>/dev/null && SERVICES="$SERVICES VSCode:8080"
    
    if [ -n "$SERVICES" ]; then
        echo "FOUND - Services:$SERVICES"
    else
        echo "no services"
    fi
done

echo ""
echo "=================================="
echo "To test a specific VM:"
echo "  ./test-service-health.sh <ip-address>"
echo "=================================="

