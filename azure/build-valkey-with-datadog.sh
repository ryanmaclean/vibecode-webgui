#!/bin/bash
# Build Valkey VM with Datadog Integration
# Creates a minimal Alpine Linux initramfs with:
#   - Valkey server (in-memory key-value store)
#   - Datadog lightweight StatsD bridge for observability
#   - BusyBox for essential utilities
#   - Dropbear SSH server for remote access
#
# Target Size: 50-100MB compressed CPIO archive
# Architecture: ARM64 (Apple Silicon)
# Base: Alpine Linux (musl libc)

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# Configuration
WORK_DIR="/tmp/valkey-datadog-build-$$"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${SCRIPT_DIR}/valkey-with-datadog.cpio.gz"

# Versions - use latest stable
ALPINE_VERSION="3.19"
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine"
VALKEY_VERSION="8.0.1"
BUSYBOX_VERSION="1.37.0-r29"
DROPBEAR_VERSION="2025.88-r1"

# Alpine packages needed (ARM64 architecture)
ARCH="aarch64"

log "========================================="
log "  Valkey VM with Datadog Integration"
log "========================================="
log "Working directory: $WORK_DIR"
log "Output file: $OUTPUT_FILE"
log "Architecture: $ARCH"
log "Alpine version: $ALPINE_VERSION"
log ""

#############################################
# Dependency Check
#############################################
check_dependencies() {
    log "=== Checking Build Dependencies ==="

    local missing=()
    for cmd in wget tar gzip cpio python3; do
        if ! command -v $cmd &>/dev/null; then
            missing+=($cmd)
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing required commands: ${missing[*]}\nInstall with: brew install ${missing[*]}"
    fi

    # Check for Docker (required for cross-compilation)
    if ! command -v docker &> /dev/null; then
        error "Docker is required for cross-compilation\nInstall Docker Desktop for Mac: https://www.docker.com/products/docker-desktop"
    fi

    # ldd is optional (not available on macOS)
    if ! command -v ldd &>/dev/null; then
        warn "ldd not available (optional, skipping library checks)"
    fi

    log "✓ All dependencies present"
}

#############################################
# Setup Working Directory
#############################################
setup_workdir() {
    log "=== Setting Up Working Directory ==="

    mkdir -p "$WORK_DIR"/{downloads,extract,rootfs}
    cd "$WORK_DIR"

    log "✓ Working directory created"
}

#############################################
# Download Alpine Packages
#############################################
download_alpine_packages() {
    log "=== Downloading Alpine Linux Packages ==="

    cd "$WORK_DIR/downloads"

    # BusyBox - essential Unix utilities
    if [ ! -f "busybox-${BUSYBOX_VERSION}.apk" ]; then
        info "Downloading BusyBox ${BUSYBOX_VERSION}..."
        wget -q --show-progress \
            "${ALPINE_MIRROR}/edge/main/${ARCH}/busybox-${BUSYBOX_VERSION}.apk" \
            || error "Failed to download BusyBox"
        log "✓ BusyBox downloaded"
    fi

    # Dropbear SSH server
    if [ ! -f "dropbear-${DROPBEAR_VERSION}.apk" ]; then
        info "Downloading Dropbear SSH ${DROPBEAR_VERSION}..."
        wget -q --show-progress \
            "${ALPINE_MIRROR}/edge/main/${ARCH}/dropbear-${DROPBEAR_VERSION}.apk" \
            || error "Failed to download Dropbear"
        log "✓ Dropbear downloaded"
    fi

    # musl libc (required for all binaries)
    if [ ! -f "musl-1.2.5-r21.apk" ]; then
        info "Downloading musl libc..."
        wget -q --show-progress \
            "${ALPINE_MIRROR}/edge/main/${ARCH}/musl-1.2.5-r21.apk" \
            || error "Failed to download musl"
        log "✓ musl libc downloaded"
    fi

    # Python 3 (for Datadog StatsD bridge)
    if [ ! -f "python3-3.12.12-r0.apk" ]; then
        info "Downloading Python 3..."
        wget -q --show-progress \
            "${ALPINE_MIRROR}/edge/main/${ARCH}/python3-3.12.12-r0.apk" \
            || error "Failed to download Python"
        log "✓ Python 3 downloaded"
    fi

    log "✓ All Alpine packages downloaded"
}

#############################################
# Download and Build Valkey
#############################################
download_valkey() {
    log "=== Downloading Valkey Server ==="

    cd "$WORK_DIR/downloads"

    if [ ! -f "valkey-${VALKEY_VERSION}.tar.gz" ]; then
        info "Downloading Valkey ${VALKEY_VERSION}..."
        wget -q --show-progress \
            "https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_VERSION}.tar.gz" \
            -O "valkey-${VALKEY_VERSION}.tar.gz" \
            || error "Failed to download Valkey"
    fi

    log "✓ Valkey downloaded"
}

build_valkey() {
    log "=== Building Valkey Server ==="

    cd "$WORK_DIR/extract"

    if [ ! -f "valkey-server" ]; then
        info "Extracting Valkey source..."
        tar xzf "../downloads/valkey-${VALKEY_VERSION}.tar.gz"

        local VALKEY_SOURCE_DIR="$WORK_DIR/extract/valkey-${VALKEY_VERSION}"

        info "Compiling Valkey (this may take a few minutes)..."
        info "Using minimal build for size optimization..."

        # Cross-compile Valkey for Linux ARM64 using Docker
        # This ensures the binary will run on Linux, not just macOS
        info "Cross-compiling for Linux ARM64 with Docker..."
        docker run --rm --platform linux/arm64 \
            -v "$VALKEY_SOURCE_DIR:/valkey" \
            -w /valkey \
            alpine:latest \
            sh -c "apk add --no-cache gcc g++ make musl-dev linux-headers && \
                   make BUILD_TLS=no USE_SYSTEMD=no MALLOC=libc -j4 && \
                   strip src/valkey-server"

        if [ ! -f "$VALKEY_SOURCE_DIR/src/valkey-server" ]; then
            error "Valkey compilation failed"
        fi

        local size=$(du -h "$VALKEY_SOURCE_DIR/src/valkey-server" | cut -f1)
        log "✓ Valkey built successfully: $size"

        cp "$VALKEY_SOURCE_DIR/src/valkey-server" "$WORK_DIR/extract/"
    else
        log "✓ Valkey already built"
    fi
}

#############################################
# Extract Alpine Packages
#############################################
extract_alpine_packages() {
    log "=== Extracting Alpine Packages ==="

    cd "$WORK_DIR/extract"

    # Extract all .apk files (they're just tar.gz archives)
    for apk in "$WORK_DIR/downloads"/*.apk; do
        local name=$(basename "$apk" .apk)
        info "Extracting $name..."
        tar xzf "$apk" 2>/dev/null || warn "Failed to extract $name"
    done

    log "✓ Alpine packages extracted"
}

#############################################
# Create Datadog StatsD Bridge
#############################################
create_datadog_bridge() {
    log "=== Creating Datadog StatsD Bridge ==="

    mkdir -p "$WORK_DIR/datadog"

    cat > "$WORK_DIR/datadog/statsd-bridge.py" << 'PYTHON_EOF'
#!/usr/bin/env python3
"""
Lightweight Datadog StatsD Bridge for VM Observability
Collects StatsD metrics and forwards to Datadog API
Minimal dependencies: Python 3 stdlib only
"""
import socket
import json
import urllib.request
import urllib.error
import os
import sys
import time
import threading
from datetime import datetime

class DatadogStatsDBridge:
    """Lightweight StatsD receiver that forwards metrics to Datadog API"""

    def __init__(self):
        # Read configuration from environment (set in init script)
        self.dd_api_key = os.environ.get('DD_API_KEY', '')
        self.dd_site = os.environ.get('DD_SITE', 'datadoghq.com')
        self.hostname = os.environ.get('DD_HOSTNAME', 'valkey-vm')

        # Tags for all metrics
        self.tags = {
            'service': 'vibecode-valkey',
            'component': 'valkey-server',
            'integration': 'datadog-lightweight',
            'environment': os.environ.get('DD_ENVIRONMENT', 'production')
        }

        # Create UDP socket for StatsD metrics
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(('127.0.0.1', 8125))
        self.metrics = {}
        self.running = True

        print(f'[DD] Initialized Datadog bridge')
        print(f'[DD] Site: {self.dd_site}')
        print(f'[DD] Hostname: {self.hostname}')
        print(f'[DD] Service: {self.tags["service"]}')

    def parse_statsd_line(self, line):
        """Parse StatsD metric line: metric_name:value|type|@sample_rate|#tags"""
        try:
            # Basic format: metric:value|type
            parts = line.split(':')
            if len(parts) < 2:
                return None

            metric_name = parts[0].strip()
            rest = ':'.join(parts[1:])

            # Split value and metadata
            components = rest.split('|')
            if len(components) < 2:
                return None

            value = float(components[0])
            metric_type = components[1]

            return {
                'name': metric_name,
                'value': value,
                'type': metric_type,
                'timestamp': int(time.time())
            }
        except Exception as e:
            print(f'[DD] Parse error: {e}', file=sys.stderr)
            return None

    def send_to_datadog(self):
        """Send accumulated metrics to Datadog API"""
        if not self.dd_api_key:
            print('[DD] No API key configured, skipping send', file=sys.stderr)
            return

        if not self.metrics:
            return

        url = f'https://api.{self.dd_site}/api/v2/series'
        headers = {
            'DD-API-KEY': self.dd_api_key,
            'Content-Type': 'application/json'
        }

        # Convert metrics to Datadog series format
        series = []
        for metric_name, (value, timestamp) in list(self.metrics.items()):
            tags = [f'{k}:{v}' for k, v in self.tags.items()]
            series.append({
                'metric': metric_name,
                'type': 0,  # gauge
                'points': [[timestamp, value]],
                'tags': tags,
                'host': self.hostname
            })

        try:
            data = json.dumps({'series': series}).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers=headers, method='POST')

            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 202:
                    print(f'[DD] Sent {len(series)} metrics to Datadog')
                    self.metrics.clear()
                else:
                    print(f'[DD] Unexpected response: {response.status}', file=sys.stderr)

        except urllib.error.URLError as e:
            print(f'[DD] Network error: {e}', file=sys.stderr)
        except Exception as e:
            print(f'[DD] Send error: {e}', file=sys.stderr)

    def receive_metrics(self):
        """Background thread: receive StatsD metrics on UDP port 8125"""
        print('[DD] StatsD listener started on 127.0.0.1:8125')

        while self.running:
            try:
                data, addr = self.sock.recvfrom(1024)
                line = data.decode('utf-8').strip()

                # Parse and store metric
                metric = self.parse_statsd_line(line)
                if metric:
                    self.metrics[metric['name']] = (metric['value'], metric['timestamp'])

            except socket.timeout:
                continue
            except Exception as e:
                print(f'[DD] Receive error: {e}', file=sys.stderr)

    def run(self):
        """Main loop: receive metrics and periodically send to Datadog"""
        self.sock.settimeout(1.0)

        # Start receiver thread
        receiver = threading.Thread(target=self.receive_metrics, daemon=True)
        receiver.start()

        print('[DD] Bridge running, sending metrics every 30 seconds')

        # Main loop: send metrics every 30 seconds
        try:
            while self.running:
                time.sleep(30)
                self.send_to_datadog()

        except KeyboardInterrupt:
            print('\n[DD] Shutting down gracefully...')
            self.running = False

        finally:
            self.sock.close()
            print('[DD] Bridge stopped')

if __name__ == '__main__':
    bridge = DatadogStatsDBridge()
    bridge.run()
PYTHON_EOF

    chmod +x "$WORK_DIR/datadog/statsd-bridge.py"

    local size=$(du -h "$WORK_DIR/datadog/statsd-bridge.py" | cut -f1)
    log "✓ Datadog StatsD bridge created: $size"
}

#############################################
# Create Initramfs Structure
#############################################
create_initramfs_structure() {
    log "=== Creating Initramfs Structure ==="

    local rootfs="$WORK_DIR/rootfs"

    # Create directory structure
    info "Creating directory tree..."
    mkdir -p "$rootfs"/{bin,sbin,lib,usr/{bin,sbin,lib,local/bin},etc/{init.d,dropbear},dev,proc,sys,tmp,var/{log,run},root/.ssh}

    # Copy BusyBox and create symlinks
    info "Installing BusyBox..."
    if [ -f "$WORK_DIR/extract/bin/busybox" ]; then
        cp "$WORK_DIR/extract/bin/busybox" "$rootfs/bin/"
        chmod +x "$rootfs/bin/busybox"

        # Create essential symlinks
        cd "$rootfs/bin"
        for cmd in sh ash mount umount mkdir mknod chmod chown \
                   ls cp mv rm cat echo grep sed awk \
                   ps kill sleep ln wget tar gzip \
                   ifconfig ip route udhcpc nc; do
            ln -sf busybox "$cmd" 2>/dev/null || true
        done
        cd "$WORK_DIR"
        log "✓ BusyBox installed with symlinks"
    else
        error "BusyBox binary not found"
    fi

    # Copy musl libc (required by all dynamically linked binaries)
    info "Installing musl libc..."
    if [ -f "$WORK_DIR/extract/lib/ld-musl-aarch64.so.1" ]; then
        cp "$WORK_DIR/extract/lib/ld-musl-aarch64.so.1" "$rootfs/lib/"
        chmod +x "$rootfs/lib/ld-musl-aarch64.so.1"

        # Create standard symlinks
        cd "$rootfs/lib"
        ln -sf ld-musl-aarch64.so.1 libc.so 2>/dev/null || true
        cd "$WORK_DIR"
        log "✓ musl libc installed"
    else
        error "musl libc not found"
    fi

    # Copy Valkey server
    info "Installing Valkey server..."
    if [ -f "$WORK_DIR/extract/valkey-server" ]; then
        cp "$WORK_DIR/extract/valkey-server" "$rootfs/usr/local/bin/"
        chmod +x "$rootfs/usr/local/bin/valkey-server"

        # Check and copy required libraries
        info "Checking Valkey dependencies..."
        if command -v ldd &>/dev/null; then
            ldd "$WORK_DIR/extract/valkey-server" 2>/dev/null || true
        fi

        log "✓ Valkey server installed"
    else
        error "Valkey server binary not found"
    fi

    # Copy Dropbear SSH server
    info "Installing Dropbear SSH..."
    if [ -f "$WORK_DIR/extract/usr/sbin/dropbear" ]; then
        cp "$WORK_DIR/extract/usr/sbin/dropbear" "$rootfs/sbin/"
        chmod +x "$rootfs/sbin/dropbear"
    fi
    if [ -f "$WORK_DIR/extract/usr/bin/dropbearkey" ]; then
        cp "$WORK_DIR/extract/usr/bin/dropbearkey" "$rootfs/bin/"
        chmod +x "$rootfs/bin/dropbearkey"
        log "✓ Dropbear SSH installed"
    fi

    # Copy Python 3 (for Datadog bridge)
    info "Installing Python 3..."
    if [ -f "$WORK_DIR/extract/usr/bin/python3" ]; then
        cp "$WORK_DIR/extract/usr/bin/python3"* "$rootfs/usr/bin/" 2>/dev/null || true
        chmod +x "$rootfs/usr/bin/python3"* 2>/dev/null || true

        # Copy Python libraries
        if [ -d "$WORK_DIR/extract/usr/lib/python3.12" ]; then
            mkdir -p "$rootfs/usr/lib"
            cp -r "$WORK_DIR/extract/usr/lib/python3.12" "$rootfs/usr/lib/" 2>/dev/null || true
        fi
        log "✓ Python 3 installed"
    fi

    # Copy Datadog StatsD bridge
    info "Installing Datadog StatsD bridge..."
    cp "$WORK_DIR/datadog/statsd-bridge.py" "$rootfs/usr/local/bin/"
    chmod +x "$rootfs/usr/local/bin/statsd-bridge.py"
    log "✓ Datadog bridge installed"

    log "✓ Initramfs structure created"
}

#############################################
# Create Configuration Files
#############################################
create_config_files() {
    log "=== Creating Configuration Files ==="

    local rootfs="$WORK_DIR/rootfs"

    # Create Valkey configuration
    info "Creating Valkey config..."
    cat > "$rootfs/etc/valkey.conf" << 'VALKEY_EOF'
# Valkey Configuration for VM
# Optimized for lightweight in-memory operation

# Network
bind 0.0.0.0
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# General
daemonize no
supervised no
pidfile /var/run/valkey.pid
loglevel notice
logfile ""

# Persistence (disabled for pure in-memory)
save ""
stop-writes-on-bgsave-error no
rdbcompression no
rdbchecksum no
dbfilename dump.rdb
dir /tmp

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Security
protected-mode no
# requirepass changeme

# Limits
maxclients 10000
VALKEY_EOF

    # Create passwd file for root user
    info "Creating user accounts..."
    cat > "$rootfs/etc/passwd" << 'PASSWD_EOF'
root:x:0:0:root:/root:/bin/sh
PASSWD_EOF

    # Create shadow file with password: root
    # Generated with: openssl passwd -6 root
    cat > "$rootfs/etc/shadow" << 'SHADOW_EOF'
root:$6$xyz$/pdZy4hazXmqu1t0TACitLlKZPD4bFyRUw6ycXiOTdf4kcnkmpgmtg9zUpEE8rG9KtOWwX7kp1Gl96NCGbDk60:19000:0:99999:7:::
SHADOW_EOF
    chmod 600 "$rootfs/etc/shadow"

    log "✓ Configuration files created"
}

#############################################
# Create Init Script
#############################################
create_init_script() {
    log "=== Creating Init Script ==="

    local rootfs="$WORK_DIR/rootfs"

    cat > "$rootfs/init" << 'INIT_EOF'
#!/bin/sh
# Valkey VM Init Script with Datadog Integration
# Mounts filesystems, configures networking, starts services

echo "========================================="
echo "  Valkey VM with Datadog Observability"
echo "========================================="
echo ""

# Mount essential filesystems
echo "[INIT] Mounting filesystems..."
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev 2>/dev/null || mknod -m 666 /dev/null c 1 3
mount -t tmpfs tmp /tmp

# Create essential device nodes if needed
[ -c /dev/null ] || mknod -m 666 /dev/null c 1 3
[ -c /dev/zero ] || mknod -m 666 /dev/zero c 1 5
[ -c /dev/random ] || mknod -m 444 /dev/random c 1 8
[ -c /dev/urandom ] || mknod -m 444 /dev/urandom c 1 9

echo "[INIT] Filesystems mounted"

# Configure hostname
echo "[INIT] Setting hostname..."
hostname valkey-vm
echo "valkey-vm" > /proc/sys/kernel/hostname

# Configure networking
echo "[INIT] Configuring network..."
ip link set lo up

# Try to bring up eth0 and get DHCP address
if ip link show eth0 >/dev/null 2>&1; then
    ip link set eth0 up

    # Create simple DHCP script for udhcpc
    cat > /tmp/udhcpc.sh << 'DHCP_SCRIPT'
#!/bin/sh
# Simple DHCP client script
[ -n "$ip" ] && ip addr add $ip/$mask dev $interface
[ -n "$router" ] && ip route add default via $router
[ -n "$dns" ] && echo "nameserver $dns" > /etc/resolv.conf
DHCP_SCRIPT
    chmod +x /tmp/udhcpc.sh

    # Run DHCP client
    udhcpc -i eth0 -n -q -s /tmp/udhcpc.sh >/dev/null 2>&1 &

    # Wait for network to be configured
    sleep 3

    # Get IP address
    IP=$(ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
    if [ -n "$IP" ]; then
        echo "[INIT] Network configured: $IP"
    else
        echo "[INIT] Network: DHCP pending..."
        IP="localhost"
    fi
else
    echo "[INIT] Warning: eth0 not found, skipping network configuration"
    IP="localhost"
fi

# Generate SSH host keys if needed
echo "[INIT] Setting up SSH..."
if [ ! -f /etc/dropbear/dropbear_rsa_host_key ]; then
    mkdir -p /etc/dropbear
    echo "[INIT] Generating SSH host keys (first boot)..."
    /bin/dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key -s 2048 >/dev/null 2>&1
    /bin/dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key >/dev/null 2>&1
    echo "[INIT] SSH keys generated"
fi

# Start SSH server
/sbin/dropbear -r /etc/dropbear/dropbear_rsa_host_key \
               -r /etc/dropbear/dropbear_ecdsa_host_key \
               -p 22 -F -E >/dev/null 2>&1 &

if [ $? -eq 0 ]; then
    echo "[INIT] SSH server started on port 22"
    echo "[INIT] SSH credentials: root / root"
else
    echo "[INIT] Warning: SSH server failed to start"
fi

# Initialize Datadog integration
echo ""
echo "[DATADOG] Initializing observability..."

# Read Datadog configuration from kernel command line
if [ -f /proc/cmdline ]; then
    # Extract DD_API_KEY
    DD_API_KEY=$(cat /proc/cmdline | grep -oP 'DD_API_KEY=\K[^ ]+' 2>/dev/null || echo "")

    # Extract DD_SITE (default: datadoghq.com)
    DD_SITE=$(cat /proc/cmdline | grep -oP 'DD_SITE=\K[^ ]+' 2>/dev/null || echo "datadoghq.com")

    # Extract DD_HOSTNAME (default: valkey-vm)
    DD_HOSTNAME=$(cat /proc/cmdline | grep -oP 'DD_HOSTNAME=\K[^ ]+' 2>/dev/null || echo "valkey-vm")

    # Export for Datadog bridge
    export DD_API_KEY
    export DD_SITE
    export DD_HOSTNAME
    export DD_ENVIRONMENT="${DD_ENVIRONMENT:-production}"
    export DD_SERVICE="vibecode-valkey"
fi

if [ -n "$DD_API_KEY" ]; then
    echo "[DATADOG] Configuration found"
    echo "[DATADOG]   API Key: ${DD_API_KEY:0:8}... (${#DD_API_KEY} chars)"
    echo "[DATADOG]   Site: $DD_SITE"
    echo "[DATADOG]   Hostname: $DD_HOSTNAME"
    echo "[DATADOG]   Service: $DD_SERVICE"

    # Start Datadog StatsD bridge
    if [ -f /usr/local/bin/statsd-bridge.py ] && [ -x /usr/bin/python3 ]; then
        echo "[DATADOG] Starting StatsD bridge..."
        /usr/bin/python3 /usr/local/bin/statsd-bridge.py > /var/log/datadog-bridge.log 2>&1 &
        BRIDGE_PID=$!

        # Wait a moment and check if it started
        sleep 1
        if ps | grep -q "^[ ]*${BRIDGE_PID} "; then
            echo "[DATADOG] StatsD bridge started (PID: $BRIDGE_PID)"
            echo "[DATADOG] Metrics will be sent every 30 seconds"
            echo "[DATADOG] Listening on UDP 127.0.0.1:8125"
        else
            echo "[DATADOG] Warning: StatsD bridge failed to start"
            echo "[DATADOG] Check /var/log/datadog-bridge.log for details"
        fi
    else
        echo "[DATADOG] Warning: Python3 or bridge script not found"
    fi
else
    echo "[DATADOG] No API key configured"
    echo "[DATADOG] To enable: Add DD_API_KEY=<key> to kernel command line"
    echo "[DATADOG] Example: --kernel-cmdline \"console=hvc0 DD_API_KEY=xxx\""
fi

echo ""
echo "[VALKEY] Starting Valkey server..."

# Create run directory for PID file
mkdir -p /var/run

# Start Valkey server in foreground
echo "[VALKEY] Configuration: /etc/valkey.conf"
echo "[VALKEY] Listening on: $IP:6379"
echo "[VALKEY] Memory limit: 256MB (LRU eviction)"
echo ""
echo "========================================="
echo "  Valkey VM Ready!"
echo "========================================="
echo "  Valkey:  $IP:6379"
echo "  SSH:     $IP:22 (root/root)"
echo "  StatsD:  127.0.0.1:8125"
echo "========================================="
echo ""

# Execute Valkey server (replace init process)
exec /usr/local/bin/valkey-server /etc/valkey.conf
INIT_EOF

    chmod +x "$rootfs/init"

    log "✓ Init script created and marked executable"
}

#############################################
# Verify Initramfs Contents
#############################################
verify_initramfs() {
    log "=== Verifying Initramfs Contents ==="

    local rootfs="$WORK_DIR/rootfs"
    local errors=0

    # Check essential files exist and are executable
    local required_files=(
        "init"
        "bin/busybox"
        "lib/ld-musl-aarch64.so.1"
        "usr/local/bin/valkey-server"
        "usr/local/bin/statsd-bridge.py"
    )

    for file in "${required_files[@]}"; do
        if [ ! -f "$rootfs/$file" ]; then
            error "Missing required file: $file"
            ((errors++))
        elif [[ "$file" != lib/* ]] && [ ! -x "$rootfs/$file" ]; then
            warn "File not executable: $file"
        fi
    done

    # Check architecture of binaries
    info "Checking binary architecture..."
    if command -v file &>/dev/null; then
        for binary in "$rootfs/bin/busybox" "$rootfs/usr/local/bin/valkey-server"; do
            if [ -f "$binary" ]; then
                local arch_info=$(file "$binary")
                # Verify it's a Linux ARM64 binary (ELF format)
                if echo "$arch_info" | grep -q "ELF.*aarch64"; then
                    info "✓ $binary: Linux ARM64 (ELF)"
                else
                    warn "Binary may not be Linux ARM64: $binary"
                    echo "  $arch_info"
                    if echo "$arch_info" | grep -q "Mach-O"; then
                        error "ERROR: Binary is macOS Mach-O format, not Linux ELF. Cross-compilation failed."
                    fi
                fi
            fi
        done
    fi

    # Report size of key components
    info "Component sizes:"
    [ -f "$rootfs/bin/busybox" ] && info "  BusyBox:  $(du -h $rootfs/bin/busybox | cut -f1)"
    [ -f "$rootfs/usr/local/bin/valkey-server" ] && info "  Valkey:   $(du -h $rootfs/usr/local/bin/valkey-server | cut -f1)"
    [ -f "$rootfs/usr/local/bin/statsd-bridge.py" ] && info "  StatsD:   $(du -h $rootfs/usr/local/bin/statsd-bridge.py | cut -f1)"

    if [ $errors -eq 0 ]; then
        log "✓ Initramfs verification passed"
    else
        error "Verification failed with $errors errors"
    fi
}

#############################################
# Package Initramfs
#############################################
package_initramfs() {
    log "=== Packaging Initramfs ==="

    local rootfs="$WORK_DIR/rootfs"

    cd "$rootfs"

    info "Creating CPIO archive..."
    find . -print0 | cpio --null --create --format=newc 2>/dev/null | gzip -9 > "$OUTPUT_FILE"

    if [ ! -f "$OUTPUT_FILE" ]; then
        error "Failed to create CPIO archive"
    fi

    local size=$(du -h "$OUTPUT_FILE" | cut -f1)
    log "✓ Initramfs packaged: $size"
}

#############################################
# Show Usage Instructions
#############################################
show_instructions() {
    local size=$(du -h "$OUTPUT_FILE" | cut -f1)

    echo ""
    log "========================================="
    log "  Build Complete!"
    log "========================================="
    echo ""
    log "Output file: $OUTPUT_FILE"
    log "Size: $size"
    echo ""
    log "To boot this VM:"
    echo ""
    echo "  # Set your Datadog API key"
    echo "  export DD_API_KEY='your_datadog_api_key_here'"
    echo ""
    echo "  # Boot with vfkit"
    echo "  vfkit \\"
    echo "    --cpus 2 \\"
    echo "    --memory 512 \\"
    echo "    --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \\"
    echo "    --initrd $OUTPUT_FILE \\"
    echo "    --kernel-cmdline \"console=hvc0 DD_API_KEY=\$DD_API_KEY DD_SITE=datadoghq.com\" \\"
    echo "    --device virtio-net,nat,mac=52:54:00:12:34:56 \\"
    echo "    --device virtio-rng"
    echo ""
    log "Features included:"
    log "  ✓ Valkey server 8.0.1 (in-memory key-value store)"
    log "  ✓ Datadog StatsD bridge (lightweight observability)"
    log "  ✓ BusyBox utilities (minimal Unix environment)"
    log "  ✓ Dropbear SSH server (remote access)"
    log "  ✓ Python 3 (for Datadog bridge)"
    log "  ✓ musl libc (ARM64 architecture)"
    echo ""
    log "Default credentials:"
    log "  SSH: root / root"
    log "  Valkey: no authentication (use requirepass in config)"
    echo ""
    log "Datadog configuration:"
    log "  Pass DD_API_KEY via kernel command line"
    log "  Optional: DD_SITE, DD_HOSTNAME, DD_ENVIRONMENT"
    log "  Metrics sent every 30 seconds to Datadog API"
    echo ""
    log "Verification:"
    log "  1. Boot VM and wait 30-60 seconds"
    log "  2. Check Datadog dashboard:"
    log "     - Infrastructure → Hosts → search 'valkey-vm'"
    log "     - Metrics → search 'vibecode.valkey'"
    log "     - Logs → filter 'service:vibecode-valkey'"
    echo ""
    log "========================================="
}

#############################################
# Cleanup
#############################################
cleanup() {
    if [ "${KEEP_WORKDIR:-0}" != "1" ]; then
        log "Cleaning up working directory..."
        rm -rf "$WORK_DIR"
    else
        log "Working directory preserved: $WORK_DIR"
    fi
}

#############################################
# Main Execution
#############################################
main() {
    check_dependencies
    setup_workdir
    download_alpine_packages
    download_valkey
    build_valkey
    extract_alpine_packages
    create_datadog_bridge
    create_initramfs_structure
    create_config_files
    create_init_script
    verify_initramfs
    package_initramfs
    show_instructions
    cleanup

    log ""
    log "✓ Build completed successfully!"
    log ""
}

# Error handling
trap 'error "Build interrupted or failed"' INT TERM ERR

# Run main
main "$@"
