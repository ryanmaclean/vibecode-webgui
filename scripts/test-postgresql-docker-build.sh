#!/bin/bash
set -e

echo "=== Testing Docker-Built PostgreSQL Initramfs ==="
echo ""

AZURE_DIR="$HOME/vibecode-webgui/azure"
INITRAMFS="$AZURE_DIR/postgresql-standalone-complete.cpio.gz"

# Check if initramfs exists
if [ ! -f "$INITRAMFS" ]; then
    echo "ERROR: Initramfs not found: $INITRAMFS"
    echo "Run rebuild-postgresql-docker.sh first"
    exit 1
fi

echo "Testing initramfs: $INITRAMFS"
ls -lh "$INITRAMFS"

# Backup Node.js initramfs
echo ""
echo "Backing up nodejs-complete.cpio.gz..."
cp "$AZURE_DIR/nodejs-complete.cpio.gz" "$AZURE_DIR/nodejs-complete.cpio.gz.backup"

# Replace with Docker-built PostgreSQL
echo "Replacing with PostgreSQL initramfs..."
cp "$INITRAMFS" "$AZURE_DIR/nodejs-complete.cpio.gz"

# Kill any running VMs
echo "Stopping any running VMs..."
killall NodeJSVibeCode 2>/dev/null || true
sleep 3

# Clean console logs
rm -f /tmp/vibecode-console-*.log

# Launch VM
echo ""
echo "Launching PostgreSQL VM (Docker-built)..."
"$AZURE_DIR/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode" > /dev/null 2>&1 &
VM_PID=$!

echo "VM PID: $VM_PID"
echo "Waiting 50 seconds for PostgreSQL initialization..."
sleep 50

# Get console log
CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

if [ -z "$CONSOLE_LOG" ]; then
    echo "ERROR: Console log not found"
    killall NodeJSVibeCode 2>/dev/null || true
    mv "$AZURE_DIR/nodejs-complete.cpio.gz.backup" "$AZURE_DIR/nodejs-complete.cpio.gz"
    exit 1
fi

echo "Console log: $CONSOLE_LOG"
echo ""

echo "=== CRITICAL TEST: Kernel Boot ==="
if grep -q "kernel panic\|Initramfs unpacking failed\|junk within compressed archive" "$CONSOLE_LOG"; then
    echo "FAILED - Kernel rejected initramfs"
    echo ""
    echo "Error details:"
    tail -50 "$CONSOLE_LOG" | grep -A 5 -B 5 "panic\|Initramfs\|junk"

    # Cleanup
    killall NodeJSVibeCode 2>/dev/null || true
    mv "$AZURE_DIR/nodejs-complete.cpio.gz.backup" "$AZURE_DIR/nodejs-complete.cpio.gz"
    exit 1
else
    echo "SUCCESS - Kernel accepted initramfs, VM booted"
fi

# Extract VM IP
VM_IP=$(tail -100 "$CONSOLE_LOG" | grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | awk '{print $2}' | head -1)
echo "VM IP: $VM_IP"

echo ""
echo "=== Checking PostgreSQL Service ==="
if tail -100 "$CONSOLE_LOG" | grep -q "PostgreSQL\|postgres\|initdb\|database system\|ready to accept"; then
    echo "PostgreSQL messages found:"
    tail -100 "$CONSOLE_LOG" | grep -E "PostgreSQL|postgres|initdb|database system|ready to accept" | head -10
else
    echo "WARNING: No PostgreSQL messages found in console"
fi

echo ""
echo "=== Checking for Library Errors ==="
if tail -100 "$CONSOLE_LOG" | grep -q "error while loading\|symbol not found\|cannot open shared object"; then
    echo "FAILED - Library errors detected:"
    tail -100 "$CONSOLE_LOG" | grep "error while loading\|symbol not found"

    # Cleanup
    killall NodeJSVibeCode 2>/dev/null || true
    mv "$AZURE_DIR/nodejs-complete.cpio.gz.backup" "$AZURE_DIR/nodejs-complete.cpio.gz"
    exit 1
else
    echo "SUCCESS - No library errors"
fi

echo ""
echo "=== Testing PostgreSQL Connectivity ==="
if [ -n "$VM_IP" ]; then
    if nc -zv -w 3 "$VM_IP" 5432 2>&1 | grep -q "succeeded"; then
        echo "SUCCESS - Port 5432 is listening"

        if command -v psql >/dev/null 2>&1; then
            echo ""
            echo "=== Testing PostgreSQL Functionality ==="

            echo "1. Testing version query..."
            if psql -h "$VM_IP" -U postgres -t -c "SELECT version();" 2>&1 | grep -q "PostgreSQL"; then
                echo "   SUCCESS - Version query worked"
            else
                echo "   FAILED - Version query failed"
            fi

            echo "2. Creating test table..."
            if psql -h "$VM_IP" -U postgres -c "CREATE TABLE docker_test (id SERIAL, built_with TEXT, timestamp TIMESTAMP DEFAULT NOW());" 2>&1 | grep -q "CREATE TABLE"; then
                echo "   SUCCESS - Table created"
            else
                echo "   FAILED - Table creation failed"
            fi

            echo "3. Inserting test data..."
            if psql -h "$VM_IP" -U postgres -c "INSERT INTO docker_test (built_with) VALUES ('Linux-native cpio+gzip in Docker');" 2>&1 | grep -q "INSERT"; then
                echo "   SUCCESS - Data inserted"
            else
                echo "   FAILED - Data insertion failed"
            fi

            echo "4. Querying test data..."
            if psql -h "$VM_IP" -U postgres -t -c "SELECT * FROM docker_test;" 2>&1 | grep -q "Linux-native"; then
                echo "   SUCCESS - Data retrieved"
            else
                echo "   FAILED - Data retrieval failed"
            fi

            echo "5. Dropping test table..."
            if psql -h "$VM_IP" -U postgres -c "DROP TABLE docker_test;" 2>&1 | grep -q "DROP TABLE"; then
                echo "   SUCCESS - Table dropped"
            else
                echo "   FAILED - Table drop failed"
            fi
        else
            echo "WARNING: psql not available on host, skipping SQL tests"
        fi
    else
        echo "FAILED - Port 5432 not listening"
    fi
else
    echo "ERROR: Could not determine VM IP"
fi

# Cleanup
echo ""
echo "Cleaning up..."
killall NodeJSVibeCode 2>/dev/null || true
mv "$AZURE_DIR/nodejs-complete.cpio.gz.backup" "$AZURE_DIR/nodejs-complete.cpio.gz"

echo ""
echo "=== Test Complete ==="
