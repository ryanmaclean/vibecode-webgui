#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# VibeCode Service Tests
# Tests that VM services are actually accessible

# Initialize log aggregation
init_log_aggregation


set -e

echo "VibeCode Service Availability Tests"
echo "===================================="
echo ""

FAILED=0

test_service() {
    local name=$1
    local host=$2
    local port=$3
    local timeout=5
    
    echo -n "Testing $name ($host:$port)... "
    
    if timeout $timeout bash -c "echo > /dev/tcp/$host/$port" 2>/dev/null; then
        echo "PASS"
        return 0
    else
        echo "FAIL"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "Checking for running Lima VMs..."
if command -v limactl &> /dev/null; then
    RUNNING=$(limactl list 2>/dev/null | grep Running | wc -l | tr -d ' ')
    echo "Found $RUNNING running Lima VMs"
    echo ""
    
    if [ "$RUNNING" -gt 0 ]; then
        echo "Testing Lima VM Services:"
        
        # PostgreSQL
        if limactl list | grep -q "vibecode-pgvector.*Running"; then
            test_service "PostgreSQL" "127.0.0.1" "5432"
        fi
        
        # Valkey/Redis
        if limactl list | grep -q "vibecode-valkey.*Running"; then
            test_service "Valkey" "127.0.0.1" "6379"
        fi
        
        # Node.js
        if limactl list | grep -q "vibecode-nodejs.*Running"; then
            test_service "Node.js" "127.0.0.1" "3000"
        fi
        
        # OpenVSCode Server
        CODESERVER_IP=$(limactl list | grep nodejs | awk '{print $3}' | cut -d: -f1)
        if [ -n "$CODESERVER_IP" ]; then
            test_service "OpenVSCode" "$CODESERVER_IP" "8080"
        fi
    fi
else
    echo "Lima not available - testing VZ VMs only"
fi

echo ""
echo "Checking VZ VM status..."
if ps aux | grep -v grep | grep -q VibeCode; then
    echo "VibeCode app is running"
    
    # Check if VMs are configured for port forwarding
    echo ""
    echo "Expected services (when VMs fully configured):"
    echo "  - PostgreSQL: 127.0.0.1:5432"
    echo "  - Valkey: 127.0.0.1:6379"
    echo "  - Node.js: 127.0.0.1:3000"
    echo "  - OpenVSCode: 127.0.0.1:8080"
    echo ""
    echo "Note: VZ VMs need port forwarding configuration"
    echo "      This is not yet implemented in current version"
else
    echo "VibeCode app not running"
fi

echo ""
echo "===================================="
if [ $FAILED -eq 0 ]; then
    echo "Service tests: All accessible services working"
    exit 0
else
    echo "Service tests: $FAILED services unavailable"
    echo ""
    echo "This is expected if:"
    echo "  - VMs are not running"
    echo "  - Port forwarding not configured"
    echo "  - Services not yet started in VMs"
    exit 1
fi

