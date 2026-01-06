#!/bin/bash

VM_IP="192.168.64.3"

echo "Quick Test of Current VM"
echo "VM IP: $VM_IP"
echo ""

echo "Testing Valkey port 6379..."
if nc -zv -w 3 $VM_IP 6379 2>&1 | grep -q succeeded; then
    echo "PASS: Valkey port open"
else
    echo "FAIL: Valkey port closed"
fi

echo ""
echo "Testing OpenVSCode port 8080..."
if nc -zv -w 3 $VM_IP 8080 2>&1 | grep -q succeeded; then
    echo "PASS: OpenVSCode port open"
else
    echo "FAIL: OpenVSCode port closed"
fi

echo ""
echo "Testing SSH port 22..."
if nc -zv -w 3 $VM_IP 22 2>&1 | grep -q succeeded; then
    echo "PASS: SSH port open"
else
    echo "FAIL: SSH port closed"
fi

echo ""
echo "Testing HTTP response..."
HTTP_TEST=$(curl -s -m 3 http://$VM_IP:8080 2>/dev/null | head -c 100)
if [ -n "$HTTP_TEST" ]; then
    echo "PASS: HTTP response received"
    echo "Preview: $HTTP_TEST"
else
    echo "FAIL: No HTTP response"
fi
