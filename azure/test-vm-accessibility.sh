#!/bin/bash
# Test script to verify OpenVSCode server is accessible from host
# This tests that the server binds to 0.0.0.0 (all interfaces) instead of 127.0.0.1

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[TEST]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Configuration
VM_IP="${VM_IP:-192.168.64.3}"
VM_PORT="${VM_PORT:-3000}"
MAX_WAIT="${MAX_WAIT:-60}"

log "=== OpenVSCode Server Accessibility Test ==="
log "Testing connection to: http://${VM_IP}:${VM_PORT}"
log ""

# Step 1: Check if VM IP is reachable
log "Step 1: Checking if VM IP is reachable..."
if ping -c 1 -W 2 "$VM_IP" >/dev/null 2>&1; then
    success "VM IP $VM_IP is reachable"
else
    error "VM IP $VM_IP is NOT reachable"
    error "Make sure the VM is running and has obtained a DHCP lease"
    exit 1
fi

# Step 2: Wait for port to be open
log ""
log "Step 2: Waiting for port $VM_PORT to be open (max ${MAX_WAIT}s)..."
WAIT=0
while [ $WAIT -lt $MAX_WAIT ]; do
    if nc -z -w 2 "$VM_IP" "$VM_PORT" 2>/dev/null; then
        success "Port $VM_PORT is open after ${WAIT}s"
        break
    fi

    if [ $((WAIT % 10)) -eq 0 ]; then
        log "  Still waiting... (${WAIT}/${MAX_WAIT}s)"
    fi

    sleep 1
    WAIT=$((WAIT + 1))
done

if [ $WAIT -ge $MAX_WAIT ]; then
    error "Port $VM_PORT did not open within ${MAX_WAIT}s"
    error "Check VM console output for errors"
    exit 1
fi

# Step 3: Test HTTP connection
log ""
log "Step 3: Testing HTTP connection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${VM_IP}:${VM_PORT}" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
    error "Failed to connect to HTTP server"
    error "The port is open but not responding to HTTP requests"
    exit 1
elif [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "301" ]; then
    success "HTTP server responded with code: $HTTP_CODE"
else
    warn "HTTP server responded with unexpected code: $HTTP_CODE"
fi

# Step 4: Fetch server info
log ""
log "Step 4: Fetching server information..."
RESPONSE=$(curl -s --max-time 5 "http://${VM_IP}:${VM_PORT}" 2>/dev/null | head -c 500 || echo "")

if echo "$RESPONSE" | grep -q "vscode\|openvscode\|OpenVSCode"; then
    success "OpenVSCode server detected!"
    log "Server is responding correctly"
else
    warn "Response received but OpenVSCode signature not found"
    log "Response preview: ${RESPONSE:0:100}"
fi

# Summary
log ""
log "=== Test Summary ==="
success "VM is accessible at http://${VM_IP}:${VM_PORT}"
success "Server is binding to 0.0.0.0 (all interfaces) as configured"
log ""
log "You can now access OpenVSCode from your browser:"
log "  http://${VM_IP}:${VM_PORT}"
log ""

# Additional commands
log "Useful debugging commands:"
log "  Check DHCP leases:  sudo cat /var/db/dhcpd_leases"
log "  Test connection:    curl -v http://${VM_IP}:${VM_PORT}"
log "  Watch console:      tail -f /tmp/vibecode-console-*.log"
log ""
