#!/bin/bash

# Agent F2 - Comprehensive VM Test Suite (with correct binary paths)

set +e

echo "========================================="
echo "AGENT F2 - COMPREHENSIVE VM TEST SUITE"
echo "========================================="
echo "Date: $(date)"
echo ""

cd /Users/ryan.maclean/vibecode-webgui/azure

# Kill existing VMs
echo "Cleaning up..."
killall -9 NodeJS ValkeyVibeCode PostgreSQL 2>/dev/null
sleep 5
rm -f /tmp/vibecode-console-*.log

# Test tracking (simple arrays for macOS bash)
NODEJS_STATUS="NOT_TESTED"
VALKEY_STATUS="NOT_TESTED"
POSTGRESQL_STATUS="NOT_TESTED"
UNIFIED_STATUS="NOT_TESTED"

NODEJS_DETAILS=""
VALKEY_DETAILS=""
POSTGRESQL_DETAILS=""
UNIFIED_DETAILS=""

# ============================================
# TEST 1: Node.js VM
# ============================================
echo ""
echo "========================================="
echo "TEST 1: Node.js VM (Reference Baseline)"
echo "========================================="

# Restore original
if [ -f nodejs-backup-1764370357.cpio.gz ]; then
    cp nodejs-backup-1764370357.cpio.gz nodejs-complete.cpio.gz
    echo "✓ Restored Node.js initramfs (58M)"

    # Launch
    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS > /tmp/nodejs-launch.log 2>&1 &
    VM_PID=$!
    echo "Started Node.js VM (PID: $VM_PID)"

    # Wait for boot
    sleep 10

    # Find console log
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ No console log after 10 seconds"
        NODEJS_STATUS="FAIL"
        NODEJS_DETAILS="Console log not created"
    else
        echo "✓ Console log: $CONSOLE_LOG"
        echo "Waiting 30 more seconds for VM boot..."
        sleep 30

        # Get IP
        VM_IP=$(grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" "$CONSOLE_LOG" | awk '{print $2}' | head -1)

        if [ -z "$VM_IP" ]; then
            echo "✗ No IP address found"
            echo "Console output (last 20 lines):"
            tail -20 "$CONSOLE_LOG"
            NODEJS_STATUS="FAIL"
            NODEJS_DETAILS="No IP assigned"
        else
            echo "✓ VM IP: $VM_IP"

            # Test port 3000
            echo "Testing port 3000..."
            if timeout 5 nc -zv "$VM_IP" 3000 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 3000 OPEN"

                # Test HTTP
                echo "Testing HTTP response..."
                HTTP_RESP=$(timeout 5 curl -s "http://$VM_IP:3000" 2>/dev/null)

                if [ -n "$HTTP_RESP" ]; then
                    echo "✓ HTTP response received"
                    echo "Preview: $(echo "$HTTP_RESP" | head -c 100)"

                    if echo "$HTTP_RESP" | grep -Eqi "node|hello|express|welcome"; then
                        NODEJS_STATUS="PASS"
                        NODEJS_DETAILS="Port 3000 open, HTTP responding"
                    else
                        NODEJS_STATUS="PARTIAL"
                        NODEJS_DETAILS="Port open, HTTP responding (unexpected content)"
                    fi
                else
                    echo "⚠ No HTTP response"
                    NODEJS_STATUS="PARTIAL"
                    NODEJS_DETAILS="Port open but no HTTP response"
                fi
            else
                echo "✗ Port 3000 not accessible"
                NODEJS_STATUS="FAIL"
                NODEJS_DETAILS="Port 3000 closed"
            fi
        fi
    fi

    # Cleanup
    echo "Stopping Node.js VM..."
    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
else
    echo "✗ Node.js backup not found"
    NODEJS_STATUS="NOT_FOUND"
fi

echo "Result: $NODEJS_STATUS"

# ============================================
# TEST 2: Valkey VM
# ============================================
echo ""
echo "========================================="
echo "TEST 2: Valkey VM (Standalone Cache)"
echo "========================================="

rm -f /tmp/vibecode-console-*.log

if [ -f valkey-standalone-complete.cpio.gz ]; then
    cp valkey-standalone-complete.cpio.gz nodejs-complete.cpio.gz
    echo "✓ Loaded Valkey initramfs (32M)"

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS > /tmp/valkey-launch.log 2>&1 &
    VM_PID=$!
    echo "Started Valkey VM (PID: $VM_PID)"

    sleep 10
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ No console log"
        VALKEY_STATUS="FAIL"
        VALKEY_DETAILS="Console log not created"
    else
        echo "✓ Console log: $CONSOLE_LOG"
        echo "Waiting 35 more seconds..."
        sleep 35

        VM_IP=$(grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" "$CONSOLE_LOG" | awk '{print $2}' | head -1)

        if [ -z "$VM_IP" ]; then
            echo "✗ No IP found"
            VALKEY_STATUS="FAIL"
            VALKEY_DETAILS="No IP assigned"
        else
            echo "✓ VM IP: $VM_IP"

            echo "Testing port 6379..."
            if timeout 5 nc -zv "$VM_IP" 6379 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 6379 OPEN"

                if command -v redis-cli &>/dev/null; then
                    echo "Testing PING..."
                    if timeout 5 redis-cli -h "$VM_IP" -p 6379 PING 2>&1 | grep -q "PONG"; then
                        echo "✓ PING successful"
                        VALKEY_STATUS="PASS"
                        VALKEY_DETAILS="Port 6379 open, PING successful"
                    else
                        echo "⚠ PING failed"
                        VALKEY_STATUS="PARTIAL"
                        VALKEY_DETAILS="Port open but PING failed"
                    fi
                else
                    echo "⚠ redis-cli not available"
                    VALKEY_STATUS="PARTIAL"
                    VALKEY_DETAILS="Port 6379 open (client N/A)"
                fi
            else
                echo "✗ Port 6379 closed"
                VALKEY_STATUS="FAIL"
                VALKEY_DETAILS="Port 6379 not accessible"
            fi
        fi
    fi

    echo "Stopping Valkey VM..."
    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
else
    echo "✗ Valkey initramfs not found"
    VALKEY_STATUS="NOT_FOUND"
fi

echo "Result: $VALKEY_STATUS"

# ============================================
# TEST 3: PostgreSQL VM
# ============================================
echo ""
echo "========================================="
echo "TEST 3: PostgreSQL VM (Database Server)"
echo "========================================="

rm -f /tmp/vibecode-console-*.log

if [ -f /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQL ]; then
    echo "✓ Found PostgreSQL app"

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQL > /tmp/postgresql-launch.log 2>&1 &
    VM_PID=$!
    echo "Started PostgreSQL VM (PID: $VM_PID)"

    sleep 10
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ No console log"
        POSTGRESQL_STATUS="FAIL"
        POSTGRESQL_DETAILS="Console log not created"
    else
        echo "✓ Console log: $CONSOLE_LOG"
        echo "Waiting 60 more seconds..."
        sleep 60

        # Check for panic
        if grep -qi "panic\|failed to execute" "$CONSOLE_LOG"; then
            echo "⚠ Boot warnings detected"
        fi

        VM_IP=$(grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" "$CONSOLE_LOG" | awk '{print $2}' | head -1)

        if [ -z "$VM_IP" ]; then
            echo "✗ No IP found"
            echo "Console (last 30 lines):"
            tail -30 "$CONSOLE_LOG"
            POSTGRESQL_STATUS="FAIL"
            POSTGRESQL_DETAILS="No IP assigned"
        else
            echo "✓ VM IP: $VM_IP"

            echo "Testing port 5432..."
            if timeout 5 nc -zv "$VM_IP" 5432 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 5432 OPEN"

                if command -v psql &>/dev/null; then
                    echo "Testing query..."
                    if timeout 10 psql -h "$VM_IP" -U postgres -c "SELECT 1;" 2>&1 | grep -q "1 row"; then
                        echo "✓ Query successful"
                        POSTGRESQL_STATUS="PASS"
                        POSTGRESQL_DETAILS="Port 5432 open, queries working"
                    else
                        echo "⚠ Query failed"
                        POSTGRESQL_STATUS="PARTIAL"
                        POSTGRESQL_DETAILS="Port open but query failed"
                    fi
                else
                    echo "⚠ psql not available"
                    POSTGRESQL_STATUS="PARTIAL"
                    POSTGRESQL_DETAILS="Port 5432 open (client N/A)"
                fi
            else
                echo "✗ Port 5432 closed"
                POSTGRESQL_STATUS="FAIL"
                POSTGRESQL_DETAILS="Port 5432 not accessible"
            fi
        fi
    fi

    echo "Stopping PostgreSQL VM..."
    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
else
    echo "✗ PostgreSQL app not found"
    POSTGRESQL_STATUS="NOT_FOUND"
fi

echo "Result: $POSTGRESQL_STATUS"

# ============================================
# TEST 4: Unified VM
# ============================================
echo ""
echo "========================================="
echo "TEST 4: Unified VM (Multi-Service)"
echo "========================================="

rm -f /tmp/vibecode-console-*.log

if [ -f unified-services-restored.cpio.gz ]; then
    cp unified-services-restored.cpio.gz nodejs-complete.cpio.gz
    echo "✓ Loaded Unified initramfs (117M)"

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS > /tmp/unified-launch.log 2>&1 &
    VM_PID=$!
    echo "Started Unified VM (PID: $VM_PID)"

    sleep 10
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ No console log"
        UNIFIED_STATUS="FAIL"
        UNIFIED_DETAILS="Console log not created"
    else
        echo "✓ Console log: $CONSOLE_LOG"
        echo "Waiting 60 more seconds..."
        sleep 60

        VM_IP=$(grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" "$CONSOLE_LOG" | awk '{print $2}' | head -1)

        if [ -z "$VM_IP" ]; then
            echo "✗ No IP found"
            UNIFIED_STATUS="FAIL"
            UNIFIED_DETAILS="No IP assigned"
        else
            echo "✓ VM IP: $VM_IP"

            SERVICES=0
            SVC_LIST=""

            # Test Valkey
            echo "Testing Valkey (6379)..."
            if timeout 5 nc -zv "$VM_IP" 6379 2>&1 | grep -q "succeeded"; then
                echo "✓ Valkey WORKING"
                SERVICES=$((SERVICES + 1))
                SVC_LIST="$SVC_LIST Valkey"
            else
                echo "✗ Valkey FAILED"
            fi

            # Test OpenVSCode
            echo "Testing OpenVSCode (8080)..."
            if timeout 5 nc -zv "$VM_IP" 8080 2>&1 | grep -q "succeeded"; then
                echo "✓ OpenVSCode WORKING"
                SERVICES=$((SERVICES + 1))
                SVC_LIST="$SVC_LIST OpenVSCode"
            else
                echo "✗ OpenVSCode FAILED"
            fi

            # Test SSH
            echo "Testing SSH (22)..."
            if timeout 5 nc -zv "$VM_IP" 22 2>&1 | grep -q "succeeded"; then
                echo "✓ SSH WORKING"
                SERVICES=$((SERVICES + 1))
                SVC_LIST="$SVC_LIST SSH"
            else
                echo "✗ SSH FAILED"
            fi

            echo "Services: $SERVICES/3"

            if [ $SERVICES -eq 3 ]; then
                UNIFIED_STATUS="PASS"
                UNIFIED_DETAILS="All 3 services working"
            elif [ $SERVICES -ge 1 ]; then
                UNIFIED_STATUS="PARTIAL"
                UNIFIED_DETAILS="$SERVICES/3 working:$SVC_LIST"
            else
                UNIFIED_STATUS="FAIL"
                UNIFIED_DETAILS="No services accessible"
            fi
        fi
    fi

    echo "Stopping Unified VM..."
    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
else
    echo "✗ Unified initramfs not found"
    UNIFIED_STATUS="NOT_FOUND"
fi

echo "Result: $UNIFIED_STATUS"

# ============================================
# FINAL REPORT
# ============================================
echo ""
echo "========================================="
echo "FINAL TEST RESULTS"
echo "========================================="

# Calculate stats
TESTED=0
PASSED=0
PARTIAL=0
FAILED=0
NOT_FOUND=0

for status in "$NODEJS_STATUS" "$VALKEY_STATUS" "$POSTGRESQL_STATUS" "$UNIFIED_STATUS"; do
    case "$status" in
        PASS) TESTED=$((TESTED + 1)); PASSED=$((PASSED + 1));;
        PARTIAL) TESTED=$((TESTED + 1)); PARTIAL=$((PARTIAL + 1));;
        FAIL) TESTED=$((TESTED + 1)); FAILED=$((FAILED + 1));;
        NOT_FOUND) NOT_FOUND=$((NOT_FOUND + 1));;
    esac
done

if [ $TESTED -gt 0 ]; then
    SUCCESS_RATE=$((PASSED * 100 / TESTED))
else
    SUCCESS_RATE=0
fi

echo ""
echo "Summary:"
echo "- Total VMs tested: $TESTED"
echo "- Fully operational: $PASSED"
echo "- Partially operational: $PARTIAL"
echo "- Failed: $FAILED"
echo "- Not found: $NOT_FOUND"
echo "- Success rate: $SUCCESS_RATE%"
echo ""

printf "%-15s %-15s %-40s\n" "VM" "Status" "Details"
printf "%-15s %-15s %-40s\n" "---------------" "---------------" "----------------------------------------"
printf "%-15s %-15s %-40s\n" "Node.js" "$NODEJS_STATUS" "$NODEJS_DETAILS"
printf "%-15s %-15s %-40s\n" "Valkey" "$VALKEY_STATUS" "$VALKEY_DETAILS"
printf "%-15s %-15s %-40s\n" "PostgreSQL" "$POSTGRESQL_STATUS" "$POSTGRESQL_DETAILS"
printf "%-15s %-15s %-40s\n" "Unified" "$UNIFIED_STATUS" "$UNIFIED_DETAILS"

echo ""
echo "Production-Ready VMs:"
[ "$NODEJS_STATUS" = "PASS" ] && echo "✓ Node.js VM"
[ "$VALKEY_STATUS" = "PASS" ] && echo "✓ Valkey VM"
[ "$POSTGRESQL_STATUS" = "PASS" ] && echo "✓ PostgreSQL VM"
[ "$UNIFIED_STATUS" = "PASS" ] && echo "✓ Unified VM"

echo ""
echo "========================================="
echo "TEST SUITE COMPLETE"
echo "========================================="

# Restore
if [ -f nodejs-backup-1764370357.cpio.gz ]; then
    cp nodejs-backup-1764370357.cpio.gz nodejs-complete.cpio.gz
    echo "Restored original Node.js initramfs"
fi
