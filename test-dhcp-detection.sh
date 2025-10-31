#!/bin/bash

echo "=== VibeCode VM IP Detection Test Suite ==="
echo ""

# Test 1: Check if DHCP leases file exists
echo "Test 1: Checking DHCP leases file..."
if [ -f /var/db/dhcpd_leases ]; then
    echo "✓ DHCP leases file exists"
    echo "  File: /var/db/dhcpd_leases"
    ls -la /var/db/dhcpd_leases
else
    echo "✗ DHCP leases file not found"
    exit 1
fi

echo ""

# Test 2: Read DHCP leases file
echo "Test 2: Reading DHCP leases..."
cat /var/db/dhcpd_leases

echo ""

# Test 3: Extract all IP addresses from DHCP leases
echo "Test 3: Extracting all IPs from leases..."
grep -o 'ip_address=[^[:space:]]*' /var/db/dhcpd_leases | cut -d= -f2

echo ""

# Test 4: Look for target MAC address
echo "Test 4: Searching for VM MAC (52:54:00:12:34:90)..."
TARGET_MAC="52:54:00:12:34:90"
if grep -q "$TARGET_MAC" /var/db/dhcpd_leases; then
    echo "✓ Found target MAC in leases"
    # Extract the IP for this MAC
    VM_IP=$(grep -B2 -A2 "$TARGET_MAC" /var/db/dhcpd_leases | grep ip_address | cut -d= -f2)
    echo "  VM IP Address: $VM_IP"
else
    echo "✗ Target MAC not found in leases"
    echo "  This might mean:"
    echo "  1. VM hasn't been assigned an IP yet"
    echo "  2. VM is using a different MAC address"
    echo "  3. VM is not connected to NAT"
fi

echo ""

# Test 5: Check if we can connect to localhost:3000 (for reference)
echo "Test 5: Network connectivity test..."
if [ -z "$VM_IP" ]; then
    echo "Skipping connection test (no VM IP found)"
else
    echo "Attempting to connect to http://$VM_IP:3000..."
    if timeout 2 curl -s "http://$VM_IP:3000" > /dev/null 2>&1; then
        echo "✓ Connection successful!"
    else
        echo "✗ Connection failed (VM might not be running or server not listening)"
        echo "  This is expected if OpenVSCode server isn't started yet"
    fi
fi

echo ""

# Test 6: Display implementation summary
echo "Test 6: Implementation Summary"
echo "  Files modified:"
echo "    - BasicVibeCodeApp.swift (added DHCP detection)"
echo "    - LiquidGlassVibeCodeApp.swift (added DHCP detection)"
echo "  New files:"
echo "    - DHCPLeaseParser.swift (DHCP parsing logic)"
echo "    - TestDHCPParser.swift (Swift test utility)"
echo ""

echo "=== Test Suite Complete ==="
