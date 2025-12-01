#!/bin/bash

# Agent F2 - Proper VM Test Suite (handles console log UUIDs correctly)

set +e

echo "===================================="
echo "AGENT F2 - COMPREHENSIVE VM TEST SUITE"
echo "===================================="
echo "Date: $(date)"
echo ""

cd /Users/ryan.maclean/vibecode-webgui/azure

# Clean up
killall NodeJS ValkeyVibeCode PostgreSQL 2>/dev/null
sleep 3

# Results tracking
NODEJS_RESULT="NOT_TESTED"
VALKEY_RESULT="NOT_TESTED"
POSTGRESQL_RESULT="NOT_TESTED"
UNIFIED_RESULT="NOT_TESTED"

# ============================================
# TEST 1: Node.js VM (Reference)
# ============================================
echo "===================================="
echo "Test 1: Node.js VM (Reference)"
echo "===================================="

if [ -f nodejs-complete.cpio.gz ]; then
    # Get baseline log count
    BEFORE_COUNT=$(ls -1 /tmp/vibecode-console-*.log 2>/dev/null | wc -l)

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode > /dev/null 2>&1 &
    NODEJS_PID=$!
    echo "Started Node.js VM (PID: $NODEJS_PID)"

    # Wait for console log to be created
    sleep 5

    # Find the new console log
    AFTER_COUNT=$(ls -1 /tmp/vibecode-console-*.log 2>/dev/null | wc -l)
    NEW_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -n "$NEW_LOG" ]; then
        echo "Console log: $NEW_LOG"
        echo "Waiting 30 seconds for VM boot..."
        sleep 25

        # Check for IP
        VM_IP=$(tail -100 "$NEW_LOG" | grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | awk '{print $2}' | head -1)

        if [ -n "$VM_IP" ]; then
            echo "VM IP: $VM_IP"

            # Test Node.js on port 3000
            if timeout 5 nc -zv "$VM_IP" 3000 2>&1 | grep -q succeeded; then
                echo "✓ Port 3000 OPEN"

                HTTP_RESPONSE=$(timeout 5 curl -s "http://$VM_IP:3000" 2>/dev/null)
                if echo "$HTTP_RESPONSE" | grep -qi "node\|hello\|welcome"; then
                    echo "✓ HTTP response OK"
                    NODEJS_RESULT="PASS"
                else
                    echo "✗ HTTP response invalid"
                    echo "Response: $(echo "$HTTP_RESPONSE" | head -c 100)"
                    NODEJS_RESULT="FAIL"
                fi
            else
                echo "✗ Port 3000 not accessible"
                NODEJS_RESULT="FAIL"
            fi
        else
            echo "✗ VM IP not found in console"
            echo "Last 20 lines:"
            tail -20 "$NEW_LOG"
            NODEJS_RESULT="FAIL"
        fi
    else
        echo "✗ Console log not created"
        NODEJS_RESULT="FAIL"
    fi

    # Cleanup
    kill $NODEJS_PID 2>/dev/null
    sleep 3
    echo "Node.js VM: $NODEJS_RESULT"
else
    echo "✗ nodejs-complete.cpio.gz not found"
    NODEJS_RESULT="NOT_FOUND"
fi

echo ""

# ============================================
# TEST 2: Valkey VM
# ============================================
echo "===================================="
echo "Test 2: Valkey VM"
echo "===================================="

if [ -f valkey-standalone-complete.cpio.gz ]; then
    # Backup and swap
    cp nodejs-complete.cpio.gz nodejs-backup-test.cpio.gz 2>/dev/null
    cp valkey-standalone-complete.cpio.gz nodejs-complete.cpio.gz

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode > /dev/null 2>&1 &
    VALKEY_PID=$!
    echo "Started Valkey VM (PID: $VALKEY_PID)"

    sleep 5
    NEW_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -n "$NEW_LOG" ]; then
        echo "Console log: $NEW_LOG"
        echo "Waiting 35 seconds for VM boot..."
        sleep 30

        VM_IP=$(tail -100 "$NEW_LOG" | grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | awk '{print $2}' | head -1)

        if [ -n "$VM_IP" ]; then
            echo "VM IP: $VM_IP"

            if timeout 5 nc -zv "$VM_IP" 6379 2>&1 | grep -q succeeded; then
                echo "✓ Port 6379 OPEN"

                if command -v redis-cli >/dev/null; then
                    if timeout 5 redis-cli -h "$VM_IP" -p 6379 PING 2>&1 | grep -q PONG; then
                        echo "✓ PING successful"
                        VALKEY_RESULT="PASS"
                    else
                        echo "✗ PING failed"
                        VALKEY_RESULT="FAIL"
                    fi
                else
                    echo "⚠ redis-cli not available, port test only"
                    VALKEY_RESULT="PARTIAL"
                fi
            else
                echo "✗ Port 6379 not accessible"
                VALKEY_RESULT="FAIL"
            fi
        else
            echo "✗ VM IP not found"
            VALKEY_RESULT="FAIL"
        fi
    else
        echo "✗ Console log not created"
        VALKEY_RESULT="FAIL"
    fi

    kill $VALKEY_PID 2>/dev/null
    mv nodejs-backup-test.cpio.gz nodejs-complete.cpio.gz 2>/dev/null
    sleep 3
    echo "Valkey VM: $VALKEY_RESULT"
else
    echo "✗ valkey-standalone-complete.cpio.gz not found"
    VALKEY_RESULT="NOT_FOUND"
fi

echo ""

# ============================================
# TEST 3: PostgreSQL VM
# ============================================
echo "===================================="
echo "Test 3: PostgreSQL VM"
echo "===================================="

# Use dedicated PostgreSQL app if available
if [ -f /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQL ]; then
    echo "Using dedicated PostgreSQL app"

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQL > /dev/null 2>&1 &
    PG_PID=$!
    echo "Started PostgreSQL VM (PID: $PG_PID)"

    sleep 5
    NEW_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -n "$NEW_LOG" ]; then
        echo "Console log: $NEW_LOG"
        echo "Waiting 60 seconds for VM boot..."
        sleep 55

        # Check for panic
        if grep -qi "panic\|failed" "$NEW_LOG"; then
            echo "⚠ Warning messages in console"
        fi

        VM_IP=$(tail -100 "$NEW_LOG" | grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | awk '{print $2}' | head -1)

        if [ -n "$VM_IP" ]; then
            echo "VM IP: $VM_IP"

            if timeout 5 nc -zv "$VM_IP" 5432 2>&1 | grep -q succeeded; then
                echo "✓ Port 5432 OPEN"

                if command -v psql >/dev/null; then
                    if timeout 10 psql -h "$VM_IP" -U postgres -c "SELECT 1;" 2>&1 | grep -q "1 row"; then
                        echo "✓ Query successful"
                        POSTGRESQL_RESULT="PASS"
                    else
                        echo "✗ Query failed"
                        POSTGRESQL_RESULT="FAIL"
                    fi
                else
                    echo "⚠ psql not available, port test only"
                    POSTGRESQL_RESULT="PARTIAL"
                fi
            else
                echo "✗ Port 5432 not accessible"
                POSTGRESQL_RESULT="FAIL"
            fi
        else
            echo "✗ VM IP not found"
            tail -30 "$NEW_LOG"
            POSTGRESQL_RESULT="FAIL"
        fi
    else
        echo "✗ Console log not created"
        POSTGRESQL_RESULT="FAIL"
    fi

    kill $PG_PID 2>/dev/null
    sleep 3
    echo "PostgreSQL VM: $POSTGRESQL_RESULT"
else
    echo "✗ PostgreSQL app not found"
    POSTGRESQL_RESULT="NOT_FOUND"
fi

echo ""

# ============================================
# TEST 4: Unified VM
# ============================================
echo "===================================="
echo "Test 4: Unified VM"
echo "===================================="

if [ -f unified-services-restored.cpio.gz ]; then
    cp nodejs-complete.cpio.gz nodejs-backup-test.cpio.gz 2>/dev/null
    cp unified-services-restored.cpio.gz nodejs-complete.cpio.gz

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode > /dev/null 2>&1 &
    UNIFIED_PID=$!
    echo "Started Unified VM (PID: $UNIFIED_PID)"

    sleep 5
    NEW_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -n "$NEW_LOG" ]; then
        echo "Console log: $NEW_LOG"
        echo "Waiting 60 seconds for VM boot..."
        sleep 55

        VM_IP=$(tail -100 "$NEW_LOG" | grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | awk '{print $2}' | head -1)

        if [ -n "$VM_IP" ]; then
            echo "VM IP: $VM_IP"
            SERVICES=0

            echo "Testing Valkey (6379)..."
            if timeout 5 nc -zv "$VM_IP" 6379 2>&1 | grep -q succeeded; then
                echo "✓ Valkey WORKING"
                SERVICES=$((SERVICES + 1))
            else
                echo "✗ Valkey FAILED"
            fi

            echo "Testing OpenVSCode (8080)..."
            if timeout 5 nc -zv "$VM_IP" 8080 2>&1 | grep -q succeeded; then
                echo "✓ OpenVSCode WORKING"
                SERVICES=$((SERVICES + 1))
            else
                echo "✗ OpenVSCode FAILED"
            fi

            echo "Testing SSH (22)..."
            if timeout 5 nc -zv "$VM_IP" 22 2>&1 | grep -q succeeded; then
                echo "✓ SSH WORKING"
                SERVICES=$((SERVICES + 1))
            else
                echo "✗ SSH FAILED"
            fi

            echo "Services: $SERVICES/3"

            if [ $SERVICES -eq 3 ]; then
                UNIFIED_RESULT="PASS"
            elif [ $SERVICES -ge 1 ]; then
                UNIFIED_RESULT="PARTIAL"
            else
                UNIFIED_RESULT="FAIL"
            fi
        else
            echo "✗ VM IP not found"
            UNIFIED_RESULT="FAIL"
        fi
    else
        echo "✗ Console log not created"
        UNIFIED_RESULT="FAIL"
    fi

    kill $UNIFIED_PID 2>/dev/null
    mv nodejs-backup-test.cpio.gz nodejs-complete.cpio.gz 2>/dev/null
    sleep 3
    echo "Unified VM: $UNIFIED_RESULT"
else
    echo "✗ Unified initramfs not found"
    UNIFIED_RESULT="NOT_FOUND"
fi

echo ""

# ============================================
# RESULTS
# ============================================
echo "===================================="
echo "FINAL TEST RESULTS"
echo "===================================="

TOTAL_TESTED=0
TOTAL_PASSED=0
TOTAL_PARTIAL=0
TOTAL_FAILED=0

for result in "$NODEJS_RESULT" "$VALKEY_RESULT" "$POSTGRESQL_RESULT" "$UNIFIED_RESULT"; do
    case "$result" in
        PASS)
            TOTAL_TESTED=$((TOTAL_TESTED + 1))
            TOTAL_PASSED=$((TOTAL_PASSED + 1))
            ;;
        PARTIAL)
            TOTAL_TESTED=$((TOTAL_TESTED + 1))
            TOTAL_PARTIAL=$((TOTAL_PARTIAL + 1))
            ;;
        FAIL)
            TOTAL_TESTED=$((TOTAL_TESTED + 1))
            TOTAL_FAILED=$((TOTAL_FAILED + 1))
            ;;
    esac
done

SUCCESS_RATE=0
if [ $TOTAL_TESTED -gt 0 ]; then
    SUCCESS_RATE=$((TOTAL_PASSED * 100 / TOTAL_TESTED))
fi

echo "Total tested: $TOTAL_TESTED"
echo "Passed: $TOTAL_PASSED"
echo "Partial: $TOTAL_PARTIAL"
echo "Failed: $TOTAL_FAILED"
echo "Success rate: $SUCCESS_RATE%"
echo ""

echo "| VM          | Status         |"
echo "|-------------|----------------|"
echo "| Node.js     | $NODEJS_RESULT |"
echo "| Valkey      | $VALKEY_RESULT |"
echo "| PostgreSQL  | $POSTGRESQL_RESULT |"
echo "| Unified     | $UNIFIED_RESULT |"

echo ""
echo "Test complete!"
