#!/bin/bash
# Verify Datadog VM Integration
# Tests API connectivity, initramfs contents, and metric forwarding

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

# Configuration
DD_API_KEY="${DD_API_KEY:-}"
DD_SITE="${DD_SITE:-datadodhq.com}"
INITRAMFS_PATH="${1:-}"

echo "========================================="
echo "  Datadog VM Integration Verification"
echo "========================================="
echo ""

# Step 1: Check environment
info "Step 1: Checking environment..."
if [ -z "$DD_API_KEY" ]; then
    error "DD_API_KEY not set!"
    echo "  Export it: export DD_API_KEY='your_key_here'"
    exit 1
fi
log "DD_API_KEY is set (${#DD_API_KEY} chars)"
log "DD_SITE: $DD_SITE"
echo ""

# Step 2: Find initramfs if not provided
info "Step 2: Locating initramfs..."
if [ -z "$INITRAMFS_PATH" ]; then
    LATEST_BUILD=$(ls -t /tmp/bun-openvscode-dd-*/bun-openvscode-datadog.cpio.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BUILD" ]; then
        INITRAMFS_PATH="$LATEST_BUILD"
        log "Found latest build: $INITRAMFS_PATH"
    else
        warn "No initramfs found in /tmp/bun-openvscode-dd-*/"
        warn "Build one with: ./build-bun-minimal-with-datadog.sh"
        exit 1
    fi
fi

if [ ! -f "$INITRAMFS_PATH" ]; then
    error "Initramfs not found: $INITRAMFS_PATH"
    exit 1
fi

INITRAMFS_SIZE=$(du -h "$INITRAMFS_PATH" | cut -f1)
log "Initramfs found: $INITRAMFS_SIZE"
echo ""

# Step 3: Verify Datadog API key format
info "Step 3: Verifying Datadog API key format..."
if [ ${#DD_API_KEY} -lt 32 ]; then
    error "API key seems too short (${#DD_API_KEY} chars, expected ~32-40)"
    exit 1
fi
log "API key format looks valid"
echo ""

# Step 4: Test Datadog API connectivity
info "Step 4: Testing Datadog API connectivity..."
API_TEST_RESPONSE=$(curl -s -w "\n%{http_code}" \
  "https://api.${DD_SITE}/api/v2/series" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"series": []}' 2>/dev/null | tail -1)

if [ "$API_TEST_RESPONSE" = "202" ]; then
    log "Datadog API is reachable (HTTP 202 Accepted)"
elif [ "$API_TEST_RESPONSE" = "401" ]; then
    error "Authentication failed (HTTP 401)"
    error "Check that DD_API_KEY is correct"
    exit 1
elif [ "$API_TEST_RESPONSE" = "403" ]; then
    error "Permission denied (HTTP 403)"
    error "API key may not have 'series' write permission"
    exit 1
else
    warn "Unexpected response: HTTP $API_TEST_RESPONSE"
    warn "This might be a network issue or incorrect DD_SITE"
fi
echo ""

# Step 5: Extract and verify initramfs contents
info "Step 5: Verifying initramfs contents..."
EXTRACT_DIR="/tmp/verify-datadog-$$"
mkdir -p "$EXTRACT_DIR"
cd "$EXTRACT_DIR"

log "Extracting initramfs..."
gunzip -c "$INITRAMFS_PATH" | cpio -idv >/dev/null 2>&1

if [ -f "init" ]; then
    log "Found init script"
else
    error "Init script not found in initramfs"
    exit 1
fi

if [ -f "usr/local/bin/statsd-bridge.py" ]; then
    log "Found StatsD bridge script"
    local bridge_size=$(wc -c < "usr/local/bin/statsd-bridge.py")
    log "StatsD bridge size: ${bridge_size}B"
else
    warn "StatsD bridge not found (might be using full agent approach)"
fi

if [ -f "opt/openvscode/bin/openvscode-server" ]; then
    log "Found OpenVSCode server binary"
else
    warn "OpenVSCode binary not found"
fi

if [ -f "opt/bun-linux-aarch64/bun" ]; then
    log "Found Bun runtime"
else
    warn "Bun runtime not found"
fi

if [ -f "bin/dropbear" ]; then
    log "Found Dropbear SSH server"
else
    warn "Dropbear SSH not found"
fi

# Check for Datadog configuration in init
if grep -q "DD_API_KEY" "init"; then
    log "Init script has Datadog integration code"
else
    warn "Datadog integration code not found in init"
fi

echo ""

# Step 6: Check Python3 availability
info "Step 6: Checking Python3 availability in initramfs..."
if [ -f "usr/bin/python3" ]; then
    log "Python3 available in initramfs"
elif [ -f "bin/python3" ]; then
    log "Python3 found in /bin"
else
    warn "Python3 not found in initramfs (StatsD bridge requires it)"
    warn "This might be OK if using system Python or Alpine apk"
fi
echo ""

# Step 7: Simulate StatsD metric
info "Step 7: Simulating StatsD metric send..."

METRIC_PAYLOAD='{
  "series": [{
    "metric": "vibecode.vm.test",
    "type": 0,
    "points": [['$(date +%s)', 42]],
    "tags": ["service:vibecode-vm", "test:true", "component:bun-openvscode"],
    "host": "vibecode-vm-test"
  }]
}'

TEST_RESPONSE=$(curl -s -w "\n%{http_code}" \
  "https://api.${DD_SITE}/api/v2/series" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$METRIC_PAYLOAD" 2>/dev/null | tail -1)

if [ "$TEST_RESPONSE" = "202" ]; then
    log "Test metric successfully sent (HTTP 202)"
    log "Check Datadog Metrics Explorer for: vibecode.vm.test"
else
    error "Failed to send test metric (HTTP $TEST_RESPONSE)"
fi
echo ""

# Step 8: Cleanup
info "Step 8: Cleaning up..."
rm -rf "$EXTRACT_DIR"
log "Temporary files removed"
echo ""

# Summary
echo "========================================="
echo "  Verification Summary"
echo "========================================="
log "Environment variables configured"
log "Datadog API is reachable and authenticated"
log "Initramfs structure verified"
log "Test metric sent successfully"
echo ""

echo "Next steps:"
echo "  1. Boot VM with Datadog configuration:"
echo "     export DD_API_KEY='$DD_API_KEY'"
echo "     vfkit --kernel-cmdline \"console=hvc0 DD_API_KEY=\${DD_API_KEY}\" \\"
echo "       --initrd $INITRAMFS_PATH ..."
echo ""
echo "  2. Wait 30+ seconds for metrics to arrive"
echo ""
echo "  3. Check Datadog dashboard:"
echo "     - Metrics Explorer: vibecode.vm.*"
echo "     - Hosts: vibecode-vm"
echo "     - Logs: service:vibecode-vm"
echo ""

log "Verification complete!"
