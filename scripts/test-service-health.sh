#!/bin/bash
# Generic service health check script
# Works with both Lima and VZ VMs
# Experiment 3: Service Health Scripts

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Usage: ./test-service-health.sh <vm-ip or lima-vm-name>
VM_TARGET="${1:-}"

if [ -z "$VM_TARGET" ]; then
    echo "Usage: $0 <vm-ip|lima-vm-name>"
    echo "Example: $0 192.168.64.2"
    echo "Example: $0 test-datadog"
    exit 1
fi

echo "=================================="
echo "Service Health Check"
echo "Target: $VM_TARGET"
echo "=================================="
echo ""

# Determine if Lima or direct IP
if [[ "$VM_TARGET" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # Direct IP - use SSH or network tools
    MODE="ip"
    VM_IP="$VM_TARGET"
else
    # Lima VM name
    MODE="lima"
    LIMA_NAME="$VM_TARGET"
fi

# Test 1: PostgreSQL
echo "[1/4] Testing PostgreSQL..."
if [ "$MODE" = "lima" ]; then
    if limactl shell "$LIMA_NAME" "command -v psql" &>/dev/null; then
        echo "  ✅ psql available"
        limactl shell "$LIMA_NAME" "psql --version" 2>&1 | head -1
    else
        echo "  ❌ psql not found"
    fi
elif nc -z "$VM_IP" 5432 2>/dev/null; then
    echo "  ✅ PostgreSQL port 5432 accessible"
    if command -v psql &>/dev/null; then
        psql -h "$VM_IP" -p 5432 -U postgres -c "SELECT version();" 2>&1 | head -3
    fi
else
    echo "  ❌ PostgreSQL port 5432 not accessible"
fi

# Test 2: Valkey/Redis
echo ""
echo "[2/4] Testing Valkey..."
if [ "$MODE" = "lima" ]; then
    if limactl shell "$LIMA_NAME" "command -v redis-cli" &>/dev/null; then
        echo "  ✅ redis-cli available"
        limactl shell "$LIMA_NAME" "redis-cli --version" 2>&1
    else
        echo "  ❌ redis-cli not found"
    fi
elif nc -z "$VM_IP" 6379 2>/dev/null; then
    echo "  ✅ Valkey port 6379 accessible"
    if command -v redis-cli &>/dev/null; then
        redis-cli -h "$VM_IP" -p 6379 PING 2>&1
    fi
else
    echo "  ❌ Valkey port 6379 not accessible"
fi

# Test 3: Node.js
echo ""
echo "[3/4] Testing Node.js..."
if [ "$MODE" = "lima" ]; then
    if limactl shell "$LIMA_NAME" "command -v node" &>/dev/null; then
        echo "  ✅ Node.js available"
        limactl shell "$LIMA_NAME" "node --version && npm --version" 2>&1
    else
        echo "  ❌ Node.js not found"
    fi
elif nc -z "$VM_IP" 3000 2>/dev/null; then
    echo "  ✅ Node.js port 3000 accessible"
    curl -s -m 5 "http://$VM_IP:3000/" | head -10
else
    echo "  ❌ Node.js port 3000 not accessible"
fi

# Test 4: OpenVSCode
echo ""
echo "[4/4] Testing OpenVSCode..."
if [ "$MODE" = "lima" ]; then
    if limactl shell "$LIMA_NAME" "command -v code-server" &>/dev/null; then
        echo "  ✅ code-server available"
        limactl shell "$LIMA_NAME" "code-server --version" 2>&1 | head -1
    else
        echo "  ❌ code-server not found"
    fi
elif nc -z "$VM_IP" 8080 2>/dev/null; then
    echo "  ✅ OpenVSCode port 8080 accessible"
    curl -s -m 5 "http://$VM_IP:8080/" | grep -o "<title>.*</title>" | head -1
else
    echo "  ❌ OpenVSCode port 8080 not accessible"
fi

echo ""
echo "=================================="
echo "Health check complete"
echo "=================================="

