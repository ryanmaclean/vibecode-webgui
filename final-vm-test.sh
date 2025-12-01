#!/bin/bash

# Agent F2 - Final Comprehensive VM Test Suite
# Tests each VM in complete isolation with proper logging

set +e

echo "========================================="
echo "AGENT F2 - FINAL COMPREHENSIVE TEST SUITE"
echo "========================================="
echo "Date: $(date)"
echo ""

cd /Users/ryan.maclean/vibecode-webgui/azure

# Kill all VMs
echo "Cleaning up existing VMs..."
killall -9 NodeJS ValkeyVibeCode PostgreSQL 2>/dev/null
sleep 5

# Remove old console logs
rm -f /tmp/vibecode-console-*.log 2>/dev/null

# Test results
declare -A RESULTS
declare -A DETAILS

# ============================================
# TEST 1: Node.js VM
# ============================================
echo ""
echo "========================================="
echo "TEST 1: Node.js VM (Reference Baseline)"
echo "========================================="

# Ensure we have the original nodejs
if [ ! -f nodejs-backup-1764370357.cpio.gz ]; then
    echo "✗ Original Node.js backup not found"
    RESULTS[nodejs]="NOT_FOUND"
else
    cp nodejs-backup-1764370357.cpio.gz nodejs-complete.cpio.gz
    echo "✓ Restored original Node.js initramfs (58M)"

    # Start VM
    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode > /tmp/nodejs-vm-start.log 2>&1 &
    VM_PID=$!
    echo "Started Node.js VM (PID: $VM_PID)"

    # Wait for console log
    sleep 5
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ Console log not created after 5 seconds"
        RESULTS[nodejs]="FAIL"
        DETAILS[nodejs]="Console log not created"
    else
        echo "Console log: $CONSOLE_LOG"
        echo "Waiting 35 seconds for boot..."
        sleep 35

        # Extract IP
        VM_IP=$(grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" "$CONSOLE_LOG" | awk '{print $2}' | head -1)

        if [ -z "$VM_IP" ]; then
            echo "✗ No IP found in console"
            echo "Console output:"
            tail -20 "$CONSOLE_LOG"
            RESULTS[nodejs]="FAIL"
            DETAILS[nodejs]="No IP assigned"
        else
            echo "VM IP: $VM_IP"

            # Test port 3000
            if timeout 5 nc -zv "$VM_IP" 3000 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 3000 OPEN"

                # Test HTTP
                HTTP_RESP=$(timeout 5 curl -s "http://$VM_IP:3000" 2>/dev/null)
                if echo "$HTTP_RESP" | grep -Eqi "node|hello|express|welcome"; then
                    echo "✓ HTTP Response OK"
                    echo "Response preview: $(echo "$HTTP_RESP" | head -c 100)"
                    RESULTS[nodejs]="PASS"
                    DETAILS[nodejs]="Port 3000 open, HTTP responding"
                else
                    echo "⚠ HTTP response unexpected"
                    echo "Response: $(echo "$HTTP_RESP" | head -c 200)"
                    RESULTS[nodejs]="PARTIAL"
                    DETAILS[nodejs]="Port open but unexpected HTTP response"
                fi
            else
                echo "✗ Port 3000 CLOSED"
                RESULTS[nodejs]="FAIL"
                DETAILS[nodejs]="Port 3000 not accessible"
            fi
        fi
    fi

    # Cleanup
    echo "Stopping Node.js VM..."
    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
fi

echo "Node.js VM Result: ${RESULTS[nodejs]}"

# ============================================
# TEST 2: Valkey VM
# ============================================
echo ""
echo "========================================="
echo "TEST 2: Valkey VM (Standalone Cache)"
echo "========================================="

rm -f /tmp/vibecode-console-*.log

if [ ! -f valkey-standalone-complete.cpio.gz ]; then
    echo "✗ Valkey initramfs not found"
    RESULTS[valkey]="NOT_FOUND"
else
    cp valkey-standalone-complete.cpio.gz nodejs-complete.cpio.gz
    echo "✓ Loaded Valkey initramfs (32M)"

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode > /tmp/valkey-vm-start.log 2>&1 &
    VM_PID=$!
    echo "Started Valkey VM (PID: $VM_PID)"

    sleep 5
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ Console log not created"
        RESULTS[valkey]="FAIL"
        DETAILS[valkey]="Console log not created"
    else
        echo "Console log: $CONSOLE_LOG"
        echo "Waiting 40 seconds for boot..."
        sleep 40

        VM_IP=$(grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" "$CONSOLE_LOG" | awk '{print $2}' | head -1)

        if [ -z "$VM_IP" ]; then
            echo "✗ No IP found"
            tail -20 "$CONSOLE_LOG"
            RESULTS[valkey]="FAIL"
            DETAILS[valkey]="No IP assigned"
        else
            echo "VM IP: $VM_IP"

            # Test port 6379
            if timeout 5 nc -zv "$VM_IP" 6379 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 6379 OPEN"

                # Test PING if redis-cli available
                if command -v redis-cli &>/dev/null; then
                    if timeout 5 redis-cli -h "$VM_IP" -p 6379 PING 2>&1 | grep -q "PONG"; then
                        echo "✓ Valkey PING successful"
                        RESULTS[valkey]="PASS"
                        DETAILS[valkey]="Port 6379 open, PING successful"
                    else
                        echo "⚠ PING failed"
                        RESULTS[valkey]="PARTIAL"
                        DETAILS[valkey]="Port open but PING failed"
                    fi
                else
                    echo "⚠ redis-cli not installed (port test only)"
                    RESULTS[valkey]="PARTIAL"
                    DETAILS[valkey]="Port 6379 open (redis-cli N/A)"
                fi
            else
                echo "✗ Port 6379 CLOSED"
                RESULTS[valkey]="FAIL"
                DETAILS[valkey]="Port 6379 not accessible"
            fi
        fi
    fi

    echo "Stopping Valkey VM..."
    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
fi

echo "Valkey VM Result: ${RESULTS[valkey]}"

# ============================================
# TEST 3: PostgreSQL VM
# ============================================
echo ""
echo "========================================="
echo "TEST 3: PostgreSQL VM (Database Server)"
echo "========================================="

rm -f /tmp/vibecode-console-*.log

if [ ! -f /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQL ]; then
    echo "✗ PostgreSQL app not found"
    RESULTS[postgresql]="NOT_FOUND"
else
    echo "✓ Found PostgreSQL app"

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQL > /tmp/postgresql-vm-start.log 2>&1 &
    VM_PID=$!
    echo "Started PostgreSQL VM (PID: $VM_PID)"

    sleep 5
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ Console log not created"
        RESULTS[postgresql]="FAIL"
        DETAILS[postgresql]="Console log not created"
    else
        echo "Console log: $CONSOLE_LOG"
        echo "Waiting 60 seconds for boot..."
        sleep 60

        # Check for kernel panic
        if grep -qi "panic\|failed to execute" "$CONSOLE_LOG"; then
            echo "⚠ Warning: Potential boot issues detected"
        fi

        VM_IP=$(grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" "$CONSOLE_LOG" | awk '{print $2}' | head -1)

        if [ -z "$VM_IP" ]; then
            echo "✗ No IP found"
            echo "Last 30 lines of console:"
            tail -30 "$CONSOLE_LOG"
            RESULTS[postgresql]="FAIL"
            DETAILS[postgresql]="No IP assigned"
        else
            echo "VM IP: $VM_IP"

            # Test port 5432
            if timeout 5 nc -zv "$VM_IP" 5432 2>&1 | grep -q "succeeded"; then
                echo "✓ Port 5432 OPEN"

                # Test query if psql available
                if command -v psql &>/dev/null; then
                    if timeout 10 psql -h "$VM_IP" -U postgres -c "SELECT 1;" 2>&1 | grep -q "1 row"; then
                        echo "✓ PostgreSQL query successful"
                        RESULTS[postgresql]="PASS"
                        DETAILS[postgresql]="Port 5432 open, queries working"
                    else
                        echo "⚠ Query failed"
                        RESULTS[postgresql]="PARTIAL"
                        DETAILS[postgresql]="Port open but query failed"
                    fi
                else
                    echo "⚠ psql not installed (port test only)"
                    RESULTS[postgresql]="PARTIAL"
                    DETAILS[postgresql]="Port 5432 open (psql N/A)"
                fi
            else
                echo "✗ Port 5432 CLOSED"
                RESULTS[postgresql]="FAIL"
                DETAILS[postgresql]="Port 5432 not accessible"
            fi
        fi
    fi

    echo "Stopping PostgreSQL VM..."
    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
fi

echo "PostgreSQL VM Result: ${RESULTS[postgresql]}"

# ============================================
# TEST 4: Unified VM
# ============================================
echo ""
echo "========================================="
echo "TEST 4: Unified VM (Multi-Service)"
echo "========================================="

rm -f /tmp/vibecode-console-*.log

if [ ! -f unified-services-restored.cpio.gz ]; then
    echo "✗ Unified initramfs not found"
    RESULTS[unified]="NOT_FOUND"
else
    cp unified-services-restored.cpio.gz nodejs-complete.cpio.gz
    echo "✓ Loaded Unified initramfs (117M)"

    /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode > /tmp/unified-vm-start.log 2>&1 &
    VM_PID=$!
    echo "Started Unified VM (PID: $VM_PID)"

    sleep 5
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

    if [ -z "$CONSOLE_LOG" ]; then
        echo "✗ Console log not created"
        RESULTS[unified]="FAIL"
        DETAILS[unified]="Console log not created"
    else
        echo "Console log: $CONSOLE_LOG"
        echo "Waiting 60 seconds for boot..."
        sleep 60

        VM_IP=$(grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" "$CONSOLE_LOG" | awk '{print $2}' | head -1)

        if [ -z "$VM_IP" ]; then
            echo "✗ No IP found"
            tail -20 "$CONSOLE_LOG"
            RESULTS[unified]="FAIL"
            DETAILS[unified]="No IP assigned"
        else
            echo "VM IP: $VM_IP"

            SERVICES=0
            WORKING_SERVICES=""

            # Test Valkey (6379)
            if timeout 5 nc -zv "$VM_IP" 6379 2>&1 | grep -q "succeeded"; then
                echo "✓ Valkey (6379) WORKING"
                SERVICES=$((SERVICES + 1))
                WORKING_SERVICES="$WORKING_SERVICES Valkey"
            else
                echo "✗ Valkey (6379) FAILED"
            fi

            # Test OpenVSCode (8080)
            if timeout 5 nc -zv "$VM_IP" 8080 2>&1 | grep -q "succeeded"; then
                echo "✓ OpenVSCode (8080) WORKING"
                SERVICES=$((SERVICES + 1))
                WORKING_SERVICES="$WORKING_SERVICES OpenVSCode"
            else
                echo "✗ OpenVSCode (8080) FAILED"
            fi

            # Test SSH (22)
            if timeout 5 nc -zv "$VM_IP" 22 2>&1 | grep -q "succeeded"; then
                echo "✓ SSH (22) WORKING"
                SERVICES=$((SERVICES + 1))
                WORKING_SERVICES="$WORKING_SERVICES SSH"
            else
                echo "✗ SSH (22) FAILED"
            fi

            echo "Services operational: $SERVICES/3"

            if [ $SERVICES -eq 3 ]; then
                RESULTS[unified]="PASS"
                DETAILS[unified]="All 3 services working"
            elif [ $SERVICES -ge 1 ]; then
                RESULTS[unified]="PARTIAL"
                DETAILS[unified]="$SERVICES/3 services working:$WORKING_SERVICES"
            else
                RESULTS[unified]="FAIL"
                DETAILS[unified]="No services accessible"
            fi
        fi
    fi

    echo "Stopping Unified VM..."
    kill $VM_PID 2>/dev/null
    wait $VM_PID 2>/dev/null
    sleep 5
fi

echo "Unified VM Result: ${RESULTS[unified]}"

# ============================================
# FINAL REPORT
# ============================================
echo ""
echo "========================================="
echo "FINAL TEST RESULTS"
echo "========================================="

# Calculate statistics
TOTAL_TESTED=0
TOTAL_PASSED=0
TOTAL_PARTIAL=0
TOTAL_FAILED=0
TOTAL_NOT_FOUND=0

for vm in nodejs valkey postgresql unified; do
    case "${RESULTS[$vm]}" in
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
        NOT_FOUND)
            TOTAL_NOT_FOUND=$((TOTAL_NOT_FOUND + 1))
            ;;
    esac
done

if [ $TOTAL_TESTED -gt 0 ]; then
    SUCCESS_RATE=$((TOTAL_PASSED * 100 / TOTAL_TESTED))
else
    SUCCESS_RATE=0
fi

echo ""
echo "Summary:"
echo "- Total VMs tested: $TOTAL_TESTED"
echo "- Fully operational: $TOTAL_PASSED"
echo "- Partially operational: $TOTAL_PARTIAL"
echo "- Failed: $TOTAL_FAILED"
echo "- Not found: $TOTAL_NOT_FOUND"
echo "- Success rate: $SUCCESS_RATE%"
echo ""

echo "Detailed Results:"
echo ""
printf "%-15s %-15s %s\n" "VM" "Status" "Details"
printf "%-15s %-15s %s\n" "---------------" "---------------" "-----------------------------------"
printf "%-15s %-15s %s\n" "Node.js" "${RESULTS[nodejs]}" "${DETAILS[nodejs]}"
printf "%-15s %-15s %s\n" "Valkey" "${RESULTS[valkey]}" "${DETAILS[valkey]}"
printf "%-15s %-15s %s\n" "PostgreSQL" "${RESULTS[postgresql]}" "${DETAILS[postgresql]}"
printf "%-15s %-15s %s\n" "Unified" "${RESULTS[unified]}" "${DETAILS[unified]}"

echo ""
echo "Production-Ready VMs:"
for vm in nodejs valkey postgresql unified; do
    if [ "${RESULTS[$vm]}" = "PASS" ]; then
        echo "✓ $vm"
    fi
done

echo ""
echo "========================================="
echo "TEST SUITE COMPLETE"
echo "========================================="

# Restore nodejs
if [ -f nodejs-backup-1764370357.cpio.gz ]; then
    cp nodejs-backup-1764370357.cpio.gz nodejs-complete.cpio.gz
    echo "Restored original Node.js initramfs"
fi
