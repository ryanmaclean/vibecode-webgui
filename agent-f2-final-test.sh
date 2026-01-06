#!/bin/bash

# Agent F2 - FINAL Comprehensive VM Test Suite
# Fixed IP extraction and proper initramfs handling

set +e

echo "========================================="
echo "AGENT F2 - COMPREHENSIVE VM TEST SUITE"
echo "========================================="
echo "Date: $(date)"
echo "Testing ALL VMs with proper validation"
echo ""

cd /Users/ryan.maclean/vibecode-webgui/azure

# Kill all VMs
killall -9 NodeJS ValkeyVibeCode PostgreSQL 2>/dev/null
sleep 5

# Results
NODEJS_STATUS="NOT_TESTED"
VALKEY_STATUS="NOT_TESTED"
POSTGRESQL_STATUS="NOT_TESTED"
UNIFIED_STATUS="NOT_TESTED"

NODEJS_IP=""
VALKEY_IP=""
POSTGRESQL_IP=""
UNIFIED_IP=""

# Function to extract VM IP (skip loopback)
extract_vm_ip() {
    local log_file="$1"
    # Look for the actual VM IP message, not boot messages
    grep -E "Connect via:|OpenVSCode: http://|Valkey: redis-cli -h" "$log_file" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | grep -v "127.0.0.1" | head -1
}

# ============================================
# TEST 1: Node.js VM
# ============================================
echo "========================================="
echo "TEST 1: Node.js VM (Reference Baseline)"
echo "========================================="

# Check if we have the TRUE nodejs (should be ~58M)
if [ ! -f nodejs-backup-1764370357.cpio.gz ]; then
    echo "✗ Original Node.js backup not found"
    NODEJS_STATUS="NOT_FOUND"
else
    # Restore
    cp nodejs-backup-1764370357.cpio.gz nodejs-complete.cpio.gz
    ACTUAL_SIZE=$(ls -lh nodejs-complete.cpio.gz | awk '{print $5}')
    echo "✓ Restored Node.js initramfs ($ACTUAL_SIZE)"

    rm -f /tmp/vibecode-console-*.log

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS &
    VM_PID=$!
    echo "Started VM (PID: $VM_PID)"

    sleep 10
    CONSOLE=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE" ]; then
        echo "✗ Console log not created"
        NODEJS_STATUS="FAIL"
    else
        echo "✓ Console: $CONSOLE"
        echo "Waiting 35 seconds for boot..."
        sleep 35

        # Extract VM IP
        NODEJS_IP=$(extract_vm_ip "$CONSOLE")

        if [ -z "$NODEJS_IP" ]; then
            # Fallback: try grep for any non-localhost IP
            NODEJS_IP=$(grep -oE "192\.168\.[0-9]+\.[0-9]+" "$CONSOLE" | head -1)
        fi

        if [ -z "$NODEJS_IP" ]; then
            echo "✗ No VM IP found"
            echo "Console output:"
            tail -30 "$CONSOLE"
            NODEJS_STATUS="FAIL"
        else
            echo "✓ VM IP: $NODEJS_IP"

            # Test port 3000
            if timeout 5 nc -zv "$NODEJS_IP" 3000 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 3000 OPEN"

                HTTP=$(timeout 5 curl -s "http://$NODEJS_IP:3000" 2>/dev/null)
                if [ -n "$HTTP" ]; then
                    echo "✓ HTTP responding"
                    echo "Preview: $(echo "$HTTP" | head -c 80)"
                    NODEJS_STATUS="PASS"
                else
                    echo "⚠ No HTTP response"
                    NODEJS_STATUS="PARTIAL"
                fi
            else
                echo "✗ Port 3000 not accessible"
                NODEJS_STATUS="FAIL"
            fi
        fi
    fi

    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
fi

echo "Result: $NODEJS_STATUS"
echo ""

# ============================================
# TEST 2: Valkey VM
# ============================================
echo "========================================="
echo "TEST 2: Valkey VM (Standalone Cache)"
echo "========================================="

if [ ! -f valkey-standalone-complete.cpio.gz ]; then
    echo "✗ Valkey initramfs not found"
    VALKEY_STATUS="NOT_FOUND"
else
    cp valkey-standalone-complete.cpio.gz nodejs-complete.cpio.gz
    ACTUAL_SIZE=$(ls -lh nodejs-complete.cpio.gz | awk '{print $5}')
    echo "✓ Loaded Valkey ($ACTUAL_SIZE)"

    rm -f /tmp/vibecode-console-*.log

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS &
    VM_PID=$!
    echo "Started VM (PID: $VM_PID)"

    sleep 10
    CONSOLE=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE" ]; then
        echo "✗ Console log not created"
        VALKEY_STATUS="FAIL"
    else
        echo "✓ Console: $CONSOLE"
        echo "Waiting 40 seconds..."
        sleep 40

        VALKEY_IP=$(extract_vm_ip "$CONSOLE")
        if [ -z "$VALKEY_IP" ]; then
            VALKEY_IP=$(grep -oE "192\.168\.[0-9]+\.[0-9]+" "$CONSOLE" | head -1)
        fi

        if [ -z "$VALKEY_IP" ]; then
            echo "✗ No VM IP"
            VALKEY_STATUS="FAIL"
        else
            echo "✓ VM IP: $VALKEY_IP"

            if timeout 5 nc -zv "$VALKEY_IP" 6379 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 6379 OPEN"

                if command -v redis-cli &>/dev/null; then
                    if timeout 5 redis-cli -h "$VALKEY_IP" -p 6379 PING 2>&1 | grep -q "PONG"; then
                        echo "✓ PING successful"
                        VALKEY_STATUS="PASS"
                    else
                        echo "⚠ PING failed"
                        VALKEY_STATUS="PARTIAL"
                    fi
                else
                    echo "⚠ redis-cli N/A"
                    VALKEY_STATUS="PARTIAL"
                fi
            else
                echo "✗ Port 6379 closed"
                VALKEY_STATUS="FAIL"
            fi
        fi
    fi

    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
fi

echo "Result: $VALKEY_STATUS"
echo ""

# ============================================
# TEST 3: PostgreSQL VM
# ============================================
echo "========================================="
echo "TEST 3: PostgreSQL VM (Database)"
echo "========================================="

if [ ! -f /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQL ]; then
    echo "✗ PostgreSQL app not found"
    POSTGRESQL_STATUS="NOT_FOUND"
else
    echo "✓ Found PostgreSQL app"

    rm -f /tmp/vibecode-console-*.log

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQL &
    VM_PID=$!
    echo "Started VM (PID: $VM_PID)"

    sleep 10
    CONSOLE=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE" ]; then
        echo "✗ Console log not created"
        POSTGRESQL_STATUS="FAIL"
    else
        echo "✓ Console: $CONSOLE"
        echo "Waiting 70 seconds..."
        sleep 70

        POSTGRESQL_IP=$(extract_vm_ip "$CONSOLE")
        if [ -z "$POSTGRESQL_IP" ]; then
            POSTGRESQL_IP=$(grep -oE "192\.168\.[0-9]+\.[0-9]+" "$CONSOLE" | head -1)
        fi

        if [ -z "$POSTGRESQL_IP" ]; then
            echo "✗ No VM IP"
            echo "Console:"
            tail -40 "$CONSOLE"
            POSTGRESQL_STATUS="FAIL"
        else
            echo "✓ VM IP: $POSTGRESQL_IP"

            if timeout 5 nc -zv "$POSTGRESQL_IP" 5432 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 5432 OPEN"

                if command -v psql &>/dev/null; then
                    if timeout 10 psql -h "$POSTGRESQL_IP" -U postgres -c "SELECT 1;" 2>&1 | grep -q "1 row"; then
                        echo "✓ Query successful"
                        POSTGRESQL_STATUS="PASS"
                    else
                        echo "⚠ Query failed"
                        POSTGRESQL_STATUS="PARTIAL"
                    fi
                else
                    echo "⚠ psql N/A"
                    POSTGRESQL_STATUS="PARTIAL"
                fi
            else
                echo "✗ Port 5432 closed"
                POSTGRESQL_STATUS="FAIL"
            fi
        fi
    fi

    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
fi

echo "Result: $POSTGRESQL_STATUS"
echo ""

# ============================================
# TEST 4: Unified VM
# ============================================
echo "========================================="
echo "TEST 4: Unified VM (Multi-Service)"
echo "========================================="

if [ ! -f unified-services-restored.cpio.gz ]; then
    echo "✗ Unified initramfs not found"
    UNIFIED_STATUS="NOT_FOUND"
else
    cp unified-services-restored.cpio.gz nodejs-complete.cpio.gz
    ACTUAL_SIZE=$(ls -lh nodejs-complete.cpio.gz | awk '{print $5}')
    echo "✓ Loaded Unified ($ACTUAL_SIZE)"

    rm -f /tmp/vibecode-console-*.log

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS &
    VM_PID=$!
    echo "Started VM (PID: $VM_PID)"

    sleep 10
    CONSOLE=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE" ]; then
        echo "✗ Console log not created"
        UNIFIED_STATUS="FAIL"
    else
        echo "✓ Console: $CONSOLE"
        echo "Waiting 70 seconds..."
        sleep 70

        UNIFIED_IP=$(extract_vm_ip "$CONSOLE")
        if [ -z "$UNIFIED_IP" ]; then
            UNIFIED_IP=$(grep -oE "192\.168\.[0-9]+\.[0-9]+" "$CONSOLE" | head -1)
        fi

        if [ -z "$UNIFIED_IP" ]; then
            echo "✗ No VM IP"
            UNIFIED_STATUS="FAIL"
        else
            echo "✓ VM IP: $UNIFIED_IP"

            SERVICES=0

            # Test Valkey
            if timeout 5 nc -zv "$UNIFIED_IP" 6379 2>&1 | grep -q "succeeded"; then
                echo "✓ Valkey (6379) WORKING"
                SERVICES=$((SERVICES + 1))
            else
                echo "✗ Valkey (6379) FAILED"
            fi

            # Test OpenVSCode
            if timeout 5 nc -zv "$UNIFIED_IP" 8080 2>&1 | grep -q "succeeded"; then
                echo "✓ OpenVSCode (8080) WORKING"
                SERVICES=$((SERVICES + 1))
            else
                echo "✗ OpenVSCode (8080) FAILED"
            fi

            # Test SSH
            if timeout 5 nc -zv "$UNIFIED_IP" 22 2>&1 | grep -q "succeeded"; then
                echo "✓ SSH (22) WORKING"
                SERVICES=$((SERVICES + 1))
            else
                echo "✗ SSH (22) FAILED"
            fi

            echo "Services: $SERVICES/3"

            if [ $SERVICES -eq 3 ]; then
                UNIFIED_STATUS="PASS"
            elif [ $SERVICES -ge 1 ]; then
                UNIFIED_STATUS="PARTIAL"
            else
                UNIFIED_STATUS="FAIL"
            fi
        fi
    fi

    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
fi

echo "Result: $UNIFIED_STATUS"
echo ""

# ============================================
# FINAL REPORT
# ============================================
echo "========================================="
echo "FINAL TEST RESULTS"
echo "========================================="

TESTED=0
PASSED=0
PARTIAL=0
FAILED=0

for status in "$NODEJS_STATUS" "$VALKEY_STATUS" "$POSTGRESQL_STATUS" "$UNIFIED_STATUS"; do
    case "$status" in
        PASS) TESTED=$((TESTED + 1)); PASSED=$((PASSED + 1));;
        PARTIAL) TESTED=$((TESTED + 1)); PARTIAL=$((PARTIAL + 1));;
        FAIL) TESTED=$((TESTED + 1)); FAILED=$((FAILED + 1));;
    esac
done

SUCCESS_RATE=0
[ $TESTED -gt 0 ] && SUCCESS_RATE=$((PASSED * 100 / TESTED))

echo ""
printf "%-15s %-12s %-20s\n" "VM" "Status" "IP Address"
printf "%-15s %-12s %-20s\n" "---------------" "------------" "--------------------"
printf "%-15s %-12s %-20s\n" "Node.js" "$NODEJS_STATUS" "$NODEJS_IP"
printf "%-15s %-12s %-20s\n" "Valkey" "$VALKEY_STATUS" "$VALKEY_IP"
printf "%-15s %-12s %-20s\n" "PostgreSQL" "$POSTGRESQL_STATUS" "$POSTGRESQL_IP"
printf "%-15s %-12s %-20s\n" "Unified" "$UNIFIED_STATUS" "$UNIFIED_IP"

echo ""
echo "Summary:"
echo "- Total tested: $TESTED"
echo "- Fully operational: $PASSED"
echo "- Partially operational: $PARTIAL"
echo "- Failed: $FAILED"
echo "- Success rate: $SUCCESS_RATE%"

echo ""
echo "Production-Ready VMs:"
[ "$NODEJS_STATUS" = "PASS" ] && echo "✓ Node.js VM (nodejs-backup-1764370357.cpio.gz)"
[ "$VALKEY_STATUS" = "PASS" ] && echo "✓ Valkey VM (valkey-standalone-complete.cpio.gz)"
[ "$POSTGRESQL_STATUS" = "PASS" ] && echo "✓ PostgreSQL VM"
[ "$UNIFIED_STATUS" = "PASS" ] && echo "✓ Unified VM (unified-services-restored.cpio.gz)"

echo ""
echo "========================================="
echo "TEST SUITE COMPLETE"
echo "========================================="

# Restore
cp nodejs-backup-1764370357.cpio.gz nodejs-complete.cpio.gz 2>/dev/null
