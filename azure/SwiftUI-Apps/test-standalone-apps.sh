#!/bin/bash
# Test Standalone VM Apps
# Verifies that each standalone app loads the correct initramfs and is accessible

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=== Testing Standalone VM Apps ==="

# Function to kill all VMs
kill_all_vms() {
    echo "Killing all VMs..."
    killall -9 ValkeyVibeCode PostgreSQLVibeCode 2>/dev/null || true
    sleep 3
}

# Function to find VM IP by scanning ports
find_vm_ip() {
    local PORT=$1
    local TIMEOUT=60
    local ELAPSED=0

    echo "Scanning for VM on port $PORT..."
    while [ $ELAPSED -lt $TIMEOUT ]; do
        for ip in 192.168.64.{2..10}; do
            if nc -z -w 1 $ip $PORT 2>/dev/null; then
                echo $ip
                return 0
            fi
        done
        sleep 2
        ELAPSED=$((ELAPSED + 2))
    done

    echo ""
    return 1
}

# Function to check console log
check_console_log() {
    local EXPECTED_BOOT_MSG=$1
    local EXPECTED_INITRD_SIZE=$2

    # Find latest console log
    local CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ No console log found"
        return 1
    fi

    echo "Console log: $CONSOLE_LOG"
    echo ""

    # Check boot message
    echo "Checking boot message..."
    if head -50 "$CONSOLE_LOG" | grep -q "$EXPECTED_BOOT_MSG"; then
        echo "✓ Found expected boot message: $EXPECTED_BOOT_MSG"
    else
        echo "✗ Expected boot message not found: $EXPECTED_BOOT_MSG"
        echo "First 50 lines of console log:"
        head -50 "$CONSOLE_LOG"
        return 1
    fi

    # Check initrd size
    echo ""
    echo "Checking initrd size..."
    if grep -q "Freeing initrd memory: ${EXPECTED_INITRD_SIZE}K" "$CONSOLE_LOG"; then
        echo "✓ Found expected initrd size: ${EXPECTED_INITRD_SIZE}K"
    else
        echo "✗ Expected initrd size not found: ${EXPECTED_INITRD_SIZE}K"
        echo "Initrd memory lines:"
        grep "Freeing initrd memory:" "$CONSOLE_LOG" || echo "No initrd memory line found"
        return 1
    fi

    echo ""
    echo "First 30 lines of console log:"
    head -30 "$CONSOLE_LOG"

    return 0
}

# Test Valkey VM
echo ""
echo "========================================"
echo "Testing Valkey VM"
echo "========================================"

kill_all_vms
rm -f /tmp/vibecode-console-*.log

echo ""
echo "Launching Valkey VM..."
"$SCRIPT_DIR/ValkeyVibeCode.app/Contents/MacOS/ValkeyVibeCode" > /dev/null 2>&1 &
VALKEY_PID=$!
echo "Valkey PID: $VALKEY_PID"

echo ""
echo "Waiting 60 seconds for VM to boot..."
sleep 60

echo ""
echo "=== Checking Valkey Console Log ==="
if check_console_log "Booting Valkey VM" "32768"; then
    echo "✓ Console log verification passed"
else
    echo "✗ Console log verification failed"
    kill_all_vms
    exit 1
fi

echo ""
echo "=== Testing Valkey Network Access ==="
VM_IP=$(find_vm_ip 6379)
if [ -z "$VM_IP" ]; then
    echo "✗ Could not find Valkey VM on network"
    kill_all_vms
    exit 1
fi

echo "✓ Found Valkey VM at $VM_IP"

echo ""
echo "Testing Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli -h $VM_IP -p 6379 PING 2>&1 | grep -q "PONG"; then
        echo "✓ Valkey server responding"
        redis-cli -h $VM_IP -p 6379 INFO SERVER | head -5
    else
        echo "✗ Valkey server not responding"
        kill_all_vms
        exit 1
    fi
else
    echo "⚠ redis-cli not installed, skipping connection test"
    echo "Testing with netcat..."
    if echo "PING" | nc $VM_IP 6379 | grep -q "PONG"; then
        echo "✓ Valkey port accessible"
    else
        echo "✗ Valkey port not accessible"
        kill_all_vms
        exit 1
    fi
fi

echo ""
echo "✓✓✓ Valkey VM Test PASSED ✓✓✓"

kill_all_vms

# Test PostgreSQL VM
echo ""
echo "========================================"
echo "Testing PostgreSQL VM"
echo "========================================"

rm -f /tmp/vibecode-console-*.log

echo ""
echo "Launching PostgreSQL VM..."
"$SCRIPT_DIR/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQLVibeCode" > /dev/null 2>&1 &
POSTGRES_PID=$!
echo "PostgreSQL PID: $POSTGRES_PID"

echo ""
echo "Waiting 90 seconds for VM to boot..."
sleep 90

echo ""
echo "=== Checking PostgreSQL Console Log ==="
if check_console_log "Booting PostgreSQL VM" "59392"; then
    echo "✓ Console log verification passed"
else
    echo "✗ Console log verification failed"
    kill_all_vms
    exit 1
fi

echo ""
echo "=== Testing PostgreSQL Network Access ==="
VM_IP=$(find_vm_ip 5432)
if [ -z "$VM_IP" ]; then
    echo "✗ Could not find PostgreSQL VM on network"
    kill_all_vms
    exit 1
fi

echo "✓ Found PostgreSQL VM at $VM_IP"

echo ""
echo "Testing PostgreSQL connection..."
if command -v psql &> /dev/null; then
    if psql -h $VM_IP -U postgres -c "SELECT version();" 2>&1 | grep -q "PostgreSQL"; then
        echo "✓ PostgreSQL server responding"
        psql -h $VM_IP -U postgres -c "SELECT version();"
    else
        echo "✗ PostgreSQL server not responding"
        kill_all_vms
        exit 1
    fi
else
    echo "⚠ psql not installed, skipping connection test"
    echo "Testing with netcat..."
    if nc -z $VM_IP 5432; then
        echo "✓ PostgreSQL port accessible"
    else
        echo "✗ PostgreSQL port not accessible"
        kill_all_vms
        exit 1
    fi
fi

echo ""
echo "✓✓✓ PostgreSQL VM Test PASSED ✓✓✓"

kill_all_vms

# Summary
echo ""
echo "========================================"
echo "✓✓✓ ALL TESTS PASSED ✓✓✓"
echo "========================================"
echo ""
echo "Summary:"
echo "  ✓ Valkey VM loads correct 32MB initramfs"
echo "  ✓ Valkey accessible on port 6379"
echo "  ✓ PostgreSQL VM loads correct 58MB initramfs"
echo "  ✓ PostgreSQL accessible on port 5432"
echo ""
echo "Both standalone apps are working correctly!"
