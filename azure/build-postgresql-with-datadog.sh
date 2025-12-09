#!/bin/bash
#
# PostgreSQL VM with Datadog Integration Builder
# WITH LINUX COMPATIBILITY FIXES
#
# Purpose: Build a minimal PostgreSQL-only initramfs (CPIO archive) with
#          integrated Datadog StatsD bridge for observability.
#
# Architecture: ARM64 (aarch64)
# Base OS: Alpine Linux (musl-based for minimal size)
# Target Size: 80-150MB
# Components:
#   - PostgreSQL 16+ server
#   - BusyBox (minimal utilities)
#   - Dropbear SSH server
#   - Python 3 (for Datadog bridge)
#   - Datadog StatsD bridge script
#
# Fixes Applied:
# - Added shadow package for su command
# - Added coreutils for cut command
# - Added util-linux for additional utilities
# - Fixed BusyBox grep -P compatibility (replaced with grep -E)
# - Added kernel module awareness for virtio_net
# - Added validation checks for required commands
#
# Author: VibeCode Team
# Created: 2025-12-01
# Updated: 2025-12-01 (Linux compatibility fixes)
#

set -euo pipefail

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
section() { echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"; }

# Build configuration
WORK_DIR="/tmp/postgresql-vm-build-$$"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${SCRIPT_DIR}/postgresql-complete.cpio.gz"

# Alpine Linux package versions (update as needed)
ALPINE_VERSION="edge"  # Use edge for latest PostgreSQL
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine/${ALPINE_VERSION}/main/aarch64"
ALPINE_COMMUNITY="https://dl-cdn.alpinelinux.org/alpine/${ALPINE_VERSION}/community/aarch64"

# PostgreSQL configuration
PG_VERSION="16"  # Will use whatever PostgreSQL version is in Alpine repos
PG_PORT="5432"
PG_DATA_DIR="/var/lib/postgresql/data"
PG_USER="postgres"
PG_PASSWORD="postgres"  # Default password (should be changed in production)

# Datadog configuration
DD_BRIDGE_PORT="8125"  # StatsD port

section "PostgreSQL VM Build - Starting"

log "Configuration:"
log "  Work Directory: $WORK_DIR"
log "  Output File: $OUTPUT_FILE"
log "  Alpine Version: $ALPINE_VERSION"
log "  PostgreSQL Version: $PG_VERSION"
log "  Datadog Integration: Lightweight StatsD Bridge"

# ============================================================================
# Dependency Checks
# ============================================================================

check_dependencies() {
    section "Checking Dependencies"

    local missing=()
    for cmd in wget tar gzip cpio find python3; do
        if ! command -v $cmd &>/dev/null; then
            missing+=($cmd)
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing required commands: ${missing[*]}\n  Install with: brew install ${missing[*]}"
    fi

    log "✓ All dependencies present"
}

# ============================================================================
# Download Alpine Packages
# ============================================================================

download_alpine_packages() {
    section "Downloading Alpine Linux Packages"

    cd "$WORK_DIR"
    mkdir -p packages
    cd packages

    log "Downloading BusyBox..."
    wget -q --show-progress "${ALPINE_MIRROR}/busybox-1.37.0-r4.apk" || \
        wget -q --show-progress "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'busybox-[0-9][^"]*\.apk' | head -1)"

    log "Downloading musl libc..."
    wget -q --show-progress "${ALPINE_MIRROR}/musl-1.2.5-r8.apk" || \
        wget -q --show-progress "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'musl-[0-9][^"]*\.apk' | head -1)"

    log "Downloading PostgreSQL server..."
    wget -q --show-progress "${ALPINE_COMMUNITY}/postgresql${PG_VERSION}-16.6-r0.apk" || \
        wget -q --show-progress "${ALPINE_COMMUNITY}/$(wget -q -O- ${ALPINE_COMMUNITY}/ | grep -o "postgresql${PG_VERSION}-[0-9][^\"]*\.apk" | head -1)" || \
        wget -q --show-progress "${ALPINE_COMMUNITY}/$(wget -q -O- ${ALPINE_COMMUNITY}/ | grep -o 'postgresql-[0-9][^"]*\.apk' | head -1)"

    log "Downloading PostgreSQL client libraries..."
    wget -q --show-progress "${ALPINE_COMMUNITY}/postgresql${PG_VERSION}-client-16.6-r0.apk" || \
        wget -q --show-progress "${ALPINE_COMMUNITY}/$(wget -q -O- ${ALPINE_COMMUNITY}/ | grep -o "postgresql${PG_VERSION}-client-[0-9][^\"]*\.apk" | head -1)" || true

    log "Downloading Dropbear SSH..."
    wget -q --show-progress "${ALPINE_MIRROR}/dropbear-2024.86-r0.apk" || \
        wget -q --show-progress "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'dropbear-[0-9][^"]*\.apk' | head -1)"

    log "Downloading Python 3..."
    wget -q --show-progress "${ALPINE_MIRROR}/python3-3.12.8-r1.apk" || \
        wget -q --show-progress "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'python3-3\.1[0-9][^"]*\.apk' | head -1)"

    # Download PostgreSQL dependencies
    log "Downloading PostgreSQL runtime dependencies..."

    # Essential PostgreSQL dependencies
    for pkg in libpq icu-libs libxml2 readline ncurses-libs ncurses-terminfo-base openssl libcrypto3 libssl3 zlib; do
        log "  - $pkg"
        wget -q "${ALPINE_MIRROR}/${pkg}-"*.apk 2>/dev/null || \
        wget -q "${ALPINE_COMMUNITY}/${pkg}-"*.apk 2>/dev/null || \
        wget -q "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o "${pkg}-[0-9][^\"]*\.apk" | head -1)" 2>/dev/null || \
        warn "Could not download $pkg (may not be required)"
    done

    # COMPATIBILITY FIX: Add missing system utilities
    log "Downloading compatibility packages..."

    # Required libraries for coreutils
    log "  - acl (provides libacl.so.1)"
    wget -q "${ALPINE_MIRROR}/acl-"*.apk 2>/dev/null || \
    wget -q "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'acl-[0-9][^"]*\.apk' | head -1)" 2>/dev/null || \
    warn "Could not download acl package"

    log "  - attr (provides libattr.so.1)"
    wget -q "${ALPINE_MIRROR}/attr-"*.apk 2>/dev/null || \
    wget -q "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'attr-[0-9][^"]*\.apk' | head -1)" 2>/dev/null || \
    warn "Could not download attr package"

    log "  - skalibs (provides libutmps.so for su)"
    wget -q "${ALPINE_MIRROR}/skalibs-"*.apk 2>/dev/null || \
    wget -q "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'skalibs-[0-9][^"]*\.apk' | head -1)" 2>/dev/null || \
    warn "Could not download skalibs package"

    log "  - utmps (provides libutmps.so.0.1)"
    wget -q "${ALPINE_MIRROR}/utmps-"*.apk 2>/dev/null || \
    wget -q "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'utmps-[0-9][^"]*\.apk' | head -1)" 2>/dev/null || \
    warn "Could not download utmps package"

    log "  - shadow (provides su command)"
    wget -q "${ALPINE_MIRROR}/shadow-"*.apk 2>/dev/null || \
    wget -q "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'shadow-[0-9][^"]*\.apk' | head -1)" 2>/dev/null || \
    warn "Could not download shadow package"

    log "  - coreutils (provides cut, wc commands)"
    wget -q "${ALPINE_MIRROR}/coreutils-"*.apk 2>/dev/null || \
    wget -q "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'coreutils-[0-9][^"]*\.apk' | head -1)" 2>/dev/null || \
    warn "Could not download coreutils package"

    log "  - util-linux (additional utilities)"
    wget -q "${ALPINE_MIRROR}/util-linux-"*.apk 2>/dev/null || \
    wget -q "${ALPINE_MIRROR}/$(wget -q -O- ${ALPINE_MIRROR}/ | grep -o 'util-linux-[0-9][^"]*\.apk' | head -1)" 2>/dev/null || \
    warn "Could not download util-linux package"

    log "✓ Packages downloaded: $(ls -1 *.apk | wc -l) APK files"
}

# ============================================================================
# Create Initramfs Structure
# ============================================================================

create_initramfs_structure() {
    section "Creating Initramfs Structure"

    cd "$WORK_DIR"
    mkdir -p initramfs
    cd initramfs

    # Create standard Linux filesystem hierarchy
    log "Creating directory structure..."
    mkdir -p {bin,sbin,lib,usr/bin,usr/sbin,usr/lib,usr/local/bin}
    mkdir -p {etc,etc/init.d,etc/postgresql,etc/dropbear,etc/ssl/certs}
    mkdir -p {dev,proc,sys,tmp,run}
    mkdir -p {root,root/.ssh}
    mkdir -p {var,var/lib,var/lib/postgresql,var/run,var/log}
    mkdir -p {home}

    log "✓ Directory structure created"
}

# ============================================================================
# Extract and Install Kernel Modules
# ============================================================================

install_kernel_modules() {
    section "Installing Kernel Modules"

    cd "$WORK_DIR/initramfs"

    # Check for kernel modules tarball
    local MODULE_TARBALL="/tmp/vibecode-kernel-modules.tar.gz"
    local MODULE_DIR="/tmp/vibecode-kernel-modules"

    if [ ! -f "$MODULE_TARBALL" ] && [ ! -d "$MODULE_DIR" ]; then
        warn "Kernel modules not found at $MODULE_TARBALL"
        warn "VM will require kernel with built-in virtio_net support"
        mkdir -p lib/modules
        return 0
    fi

    log "Extracting kernel modules..."

    # Create modules directory
    mkdir -p lib/modules

    # Extract from tarball if it exists
    if [ -f "$MODULE_TARBALL" ]; then
        log "  Extracting from tarball: $MODULE_TARBALL"
        tar -xzf "$MODULE_TARBALL" -C lib/modules/ 2>/dev/null || {
            warn "Failed to extract kernel modules from tarball"
            return 0
        }
    elif [ -d "$MODULE_DIR" ]; then
        log "  Copying from directory: $MODULE_DIR"
        cp -r "$MODULE_DIR"/* lib/modules/ 2>/dev/null || {
            warn "Failed to copy kernel modules from directory"
            return 0
        }
    fi

    # Verify modules were installed
    local module_count=$(find lib/modules -name "*.ko" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$module_count" -gt 0 ]; then
        log "✓ Installed $module_count kernel module(s)"

        # List the installed modules
        find lib/modules -name "*.ko" | while read module; do
            local module_name=$(basename "$module")
            local module_size=$(du -h "$module" | cut -f1)
            log "    - $module_name ($module_size)"
        done
    else
        warn "No kernel modules found after extraction"
        warn "VM will require kernel with built-in virtio_net support"
    fi

    log "✓ Kernel module installation complete"
}

# ============================================================================
# Extract and Install Packages
# ============================================================================

install_packages() {
    section "Installing Packages to Initramfs"

    cd "$WORK_DIR/initramfs"

    log "Extracting Alpine packages..."

    for apk in "$WORK_DIR/packages"/*.apk; do
        local pkg_name=$(basename "$apk" .apk)
        log "  - $pkg_name"
        tar xzf "$apk" 2>/dev/null || warn "Failed to extract $pkg_name"
    done

    # Clean up Alpine package metadata
    rm -rf .PKGINFO .SIGN.* var/cache

    log "✓ Packages extracted"
}

# ============================================================================
# Configure Shared Libraries
# ============================================================================

configure_libraries() {
    section "Configuring Shared Libraries"

    cd "$WORK_DIR/initramfs"

    log "Setting up musl dynamic linker..."

    # Create primary linker symlink
    if [ -f "lib/ld-musl-aarch64.so.1" ]; then
        log "  ✓ ld-musl-aarch64.so.1 already present"
    elif [ -f "lib/libc.musl-aarch64.so.1" ]; then
        ln -sf libc.musl-aarch64.so.1 lib/ld-musl-aarch64.so.1
        log "  ✓ Created ld-musl-aarch64.so.1 symlink"
    else
        warn "  ⚠ musl linker not found, binaries may not execute"
    fi

    # Create standard libc symlink
    if [ ! -e "lib/libc.so" ]; then
        ln -sf ld-musl-aarch64.so.1 lib/libc.so 2>/dev/null || true
    fi

    # Copy essential libraries to /lib for runtime
    log "Copying shared libraries to /lib..."
    find usr/lib -name "*.so*" -type f -exec cp -v {} lib/ \; 2>/dev/null || true

    log "✓ Library configuration complete"
}

# ============================================================================
# Configure BusyBox
# ============================================================================

configure_busybox() {
    section "Configuring BusyBox"

    cd "$WORK_DIR/initramfs"

    log "Creating BusyBox symlinks..."

    if [ ! -f "bin/busybox" ]; then
        error "BusyBox binary not found"
    fi

    chmod +x bin/busybox

    # Create essential symlinks
    local symlinks="sh ash mount umount ip ifconfig route udhcpc nc netstat ps kill pidof mkdir rm cp mv ln cat grep sed awk head tail less vi dd chmod chown chgrp ls pwd cd echo sleep date hostname dmesg"

    for cmd in $symlinks; do
        ln -sf busybox "bin/$cmd" 2>/dev/null || true
    done

    # Additional symlinks in /sbin
    for cmd in ifconfig route; do
        ln -sf ../bin/busybox "sbin/$cmd" 2>/dev/null || true
    done

    log "✓ BusyBox configured with $(ls bin/ | wc -l) commands"
}

# ============================================================================
# Configure PostgreSQL
# ============================================================================

configure_postgresql() {
    section "Configuring PostgreSQL"

    cd "$WORK_DIR/initramfs"

    log "Setting up PostgreSQL binaries..."

    # Find and make PostgreSQL binaries executable
    find usr/bin usr/lib/postgresql* -type f -executable -exec chmod +x {} \; 2>/dev/null || true
    find usr/bin -name "postgres*" -o -name "initdb" -o -name "pg_*" | while read binary; do
        chmod +x "$binary" 2>/dev/null || true
        log "  - $(basename $binary)"
    done

    # Create postgres user entry
    log "Creating postgres user..."
    cat > etc/passwd << 'EOF'
root:x:0:0:root:/root:/bin/sh
postgres:x:70:70:PostgreSQL:/var/lib/postgresql:/bin/sh
EOF

    cat > etc/group << 'EOF'
root:x:0:
postgres:x:70:
EOF

    # Set password for root (password: root)
    cat > etc/shadow << 'EOF'
root:$6$xyz$/pdZy4hazXmqu1t0TACitLlKZPD4bFyRUw6ycXiOTdf4kcnkmpgmtg9zUpEE8rG9KtOWwX7kp1Gl96NCGbDk60:19000:0:99999:7:::
postgres:!:19000:0:99999:7:::
EOF
    chmod 600 etc/shadow

    # Create PostgreSQL configuration directory
    mkdir -p etc/postgresql

    # Create basic postgresql.conf template (will be populated by initdb)
    cat > etc/postgresql/postgresql.conf.template << EOF
# PostgreSQL Configuration
listen_addresses = '*'
port = ${PG_PORT}
max_connections = 100
shared_buffers = 128MB
dynamic_shared_memory_type = posix
log_destination = 'stderr'
logging_collector = off
log_timezone = 'UTC'
datestyle = 'iso, mdy'
timezone = 'UTC'
lc_messages = 'C'
lc_monetary = 'C'
lc_numeric = 'C'
lc_time = 'C'
default_text_search_config = 'pg_catalog.english'
EOF

    # Create pg_hba.conf for authentication (allow all connections)
    cat > etc/postgresql/pg_hba.conf.template << EOF
# PostgreSQL Client Authentication Configuration
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             0.0.0.0/0               md5
host    all             all             ::0/0                   md5
EOF

    log "✓ PostgreSQL configuration complete"
}

# ============================================================================
# Configure Dropbear SSH
# ============================================================================

configure_ssh() {
    section "Configuring Dropbear SSH"

    cd "$WORK_DIR/initramfs"

    log "Setting up Dropbear..."

    # Make dropbear binaries executable
    if [ -f "usr/sbin/dropbear" ]; then
        chmod +x usr/sbin/dropbear
        ln -sf ../usr/sbin/dropbear bin/dropbear
    fi

    if [ -f "usr/bin/dropbearkey" ]; then
        chmod +x usr/bin/dropbearkey
        ln -sf ../usr/bin/dropbearkey bin/dropbearkey
    fi

    mkdir -p etc/dropbear root/.ssh
    chmod 700 root/.ssh

    log "✓ Dropbear SSH configured"
}

# ============================================================================
# Create Datadog StatsD Bridge
# ============================================================================

create_datadog_bridge() {
    section "Creating Datadog StatsD Bridge"

    cd "$WORK_DIR/initramfs"

    log "Creating statsd-bridge.py..."

    cat > usr/local/bin/statsd-bridge.py << 'EOFPYTHON'
#!/usr/bin/env python3
"""
Lightweight StatsD bridge for Datadog metrics collection.

This script runs in the background and collects PostgreSQL metrics via StatsD,
then forwards them to Datadog's HTTP API every 30 seconds.

Features:
- Minimal dependencies (stdlib only)
- Low memory footprint (~5-10MB)
- Automatic PostgreSQL-specific metric tagging
- Graceful error handling

Environment Variables:
- DD_API_KEY: Datadog API key (required)
- DD_SITE: Datadog site (default: datadoghq.com)
- DD_HOSTNAME: Custom hostname (default: vibecode-postgresql-vm)
- DD_ENVIRONMENT: Environment tag (default: production)
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
    """StatsD server that forwards metrics to Datadog."""

    def __init__(self):
        self.dd_api_key = os.environ.get('DD_API_KEY', '')
        self.dd_site = os.environ.get('DD_SITE', 'datadoghq.com')
        self.hostname = os.environ.get('DD_HOSTNAME', 'vibecode-postgresql-vm')
        self.environment = os.environ.get('DD_ENVIRONMENT', 'production')

        self.tags = {
            'service': 'vibecode-postgresql',
            'component': 'postgresql-vm',
            'integration': 'datadog-lightweight',
            'environment': self.environment
        }

        # Metric storage
        self.metrics = {}
        self.running = True

        # UDP socket for StatsD
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(('127.0.0.1', 8125))

    def parse_statsd_line(self, line):
        """Parse StatsD metric: metric_name:value|type|#tags"""
        try:
            parts = line.split(':')
            if len(parts) < 2:
                return None

            metric_name = parts[0]
            rest = ':'.join(parts[1:])

            # Extract value and type
            type_parts = rest.split('|')
            value = float(type_parts[0])
            metric_type = type_parts[1] if len(type_parts) > 1 else 'g'

            # Parse tags if present
            tags = {}
            if len(type_parts) > 2 and type_parts[2].startswith('#'):
                tag_str = type_parts[2][1:]  # Remove '#'
                for tag in tag_str.split(','):
                    if ':' in tag:
                        k, v = tag.split(':', 1)
                        tags[k] = v

            return {
                'name': metric_name,
                'value': value,
                'type': metric_type,
                'timestamp': int(time.time()),
                'tags': tags
            }
        except Exception as e:
            print(f'[DD] Parse error: {e}', file=sys.stderr)
            return None

    def send_to_datadog(self):
        """Send accumulated metrics to Datadog API."""
        if not self.dd_api_key:
            return

        if not self.metrics:
            return

        url = f'https://api.{self.dd_site}/api/v2/series'
        headers = {
            'DD-API-KEY': self.dd_api_key,
            'Content-Type': 'application/json'
        }

        # Convert metrics to Datadog format
        series = []
        for metric_name, metric_data in self.metrics.items():
            value, timestamp, extra_tags = metric_data

            # Merge default tags with metric-specific tags
            all_tags = {**self.tags, **extra_tags}
            tag_list = [f'{k}:{v}' for k, v in all_tags.items()]

            series.append({
                'metric': metric_name,
                'type': 0,  # gauge
                'points': [[timestamp, value]],
                'tags': tag_list,
                'host': self.hostname
            })

        try:
            data = json.dumps({'series': series}).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers=headers, method='POST')

            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 202:
                    print(f'[DD] ✓ Sent {len(series)} metrics to Datadog')
                else:
                    print(f'[DD] ⚠ Unexpected response: {response.status}', file=sys.stderr)
        except urllib.error.HTTPError as e:
            print(f'[DD] ✗ HTTP error: {e.code} - {e.reason}', file=sys.stderr)
        except urllib.error.URLError as e:
            print(f'[DD] ✗ Network error: {e.reason}', file=sys.stderr)
        except Exception as e:
            print(f'[DD] ✗ Unexpected error: {e}', file=sys.stderr)

    def receive_metrics(self):
        """Background thread: receive StatsD metrics via UDP."""
        print(f'[DD] StatsD bridge listening on 127.0.0.1:8125')
        print(f'[DD] Forwarding to {self.dd_site}')
        print(f'[DD] Hostname: {self.hostname}')

        while self.running:
            try:
                data, addr = self.sock.recvfrom(1024)
                line = data.decode('utf-8').strip()

                metric = self.parse_statsd_line(line)
                if metric:
                    # Store metric with timestamp and tags
                    self.metrics[metric['name']] = (
                        metric['value'],
                        metric['timestamp'],
                        metric.get('tags', {})
                    )
            except socket.timeout:
                pass
            except Exception as e:
                print(f'[DD] Receive error: {e}', file=sys.stderr)

    def run(self):
        """Main loop: receive metrics and send to Datadog periodically."""
        self.sock.settimeout(1.0)

        # Start receiver thread
        receiver = threading.Thread(target=self.receive_metrics, daemon=True)
        receiver.start()

        print('[DD] StatsD bridge started')
        print('[DD] Metrics will be sent every 30 seconds')

        # Main loop: flush metrics every 30 seconds
        try:
            while self.running:
                time.sleep(30)
                if self.metrics:
                    self.send_to_datadog()
                    # Clear metrics after sending
                    self.metrics.clear()
        except KeyboardInterrupt:
            print('\n[DD] Shutting down gracefully...')
            self.running = False
        finally:
            self.sock.close()
            print('[DD] Stopped')

if __name__ == '__main__':
    # Check for API key
    if not os.environ.get('DD_API_KEY'):
        print('[DD] Warning: DD_API_KEY not set, metrics will not be sent', file=sys.stderr)
        print('[DD] Set DD_API_KEY in kernel command line or environment', file=sys.stderr)

    bridge = DatadogStatsDBridge()
    bridge.run()
EOFPYTHON

    chmod +x usr/local/bin/statsd-bridge.py

    log "✓ Datadog StatsD bridge created (~8KB)"
}

# ============================================================================
# Create Init Script
# ============================================================================

create_init_script() {
    section "Creating Init Script"

    cd "$WORK_DIR/initramfs"

    log "Writing /init..."

    cat > init << 'EOFINIT'
#!/bin/sh
#
# PostgreSQL VM Init Script
# Boots minimal Linux system with PostgreSQL and Datadog integration
#

echo "========================================"
echo "  VibeCode PostgreSQL VM"
echo "========================================"
echo ""

# Mount essential filesystems
echo "Mounting filesystems..."
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
mount -t tmpfs tmp /tmp
mount -t tmpfs run /run

# Create essential device nodes if needed
[ ! -e /dev/null ] && mknod -m 666 /dev/null c 1 3
[ ! -e /dev/zero ] && mknod -m 666 /dev/zero c 1 5
[ ! -e /dev/random ] && mknod -m 444 /dev/random c 1 8

echo "✓ Filesystems mounted"

# Load kernel modules for networking
echo ""
echo "Loading kernel modules..."

# Check if modules are available
if [ -d /lib/modules ]; then
    MODULE_COUNT=$(find /lib/modules -name "*.ko" 2>/dev/null | wc -l)
    if [ "$MODULE_COUNT" -gt 0 ]; then
        echo "Found $MODULE_COUNT kernel module(s)"

        # Load virtio and network modules in correct order
        for module in failover net_failover virtio_net; do
            MODULE_PATH=$(find /lib/modules -name "${module}.ko" 2>/dev/null | head -1)
            if [ -n "$MODULE_PATH" ]; then
                echo "  Loading $module..."
                insmod "$MODULE_PATH" 2>/dev/null && echo "    ✓ $module loaded" || echo "    ⚠ $module load failed"
            fi
        done

        # Wait for modules to initialize
        echo "Waiting for network hardware to initialize..."
        sleep 2
        echo "✓ Kernel modules loaded"
    else
        echo "⚠ No kernel modules found (using built-in drivers)"
    fi
else
    echo "⚠ No /lib/modules directory (using built-in drivers)"
fi

# Configure network
echo ""
echo "Configuring network..."
ip link set lo up

# Bring up eth0
ip link set eth0 up 2>/dev/null || echo "Warning: eth0 not found"

# Create simple DHCP script
cat > /tmp/udhcpc.sh << 'DHCPEOF'
#!/bin/sh
case "$1" in
    bound|renew)
        [ -n "$ip" ] && ip addr add $ip/${mask:-24} dev $interface
        [ -n "$router" ] && ip route add default via $router dev $interface
        echo "Network configured: $ip"
        ;;
esac
DHCPEOF
chmod +x /tmp/udhcpc.sh

# Get IP via DHCP
udhcpc -i eth0 -n -q -s /tmp/udhcpc.sh 2>/dev/null &

# Wait for network to be ready
sleep 3

# Get IP address
IP=$(ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
if [ -n "$IP" ]; then
    echo "✓ Network ready: $IP"
else
    echo "⚠ Network: DHCP pending..."
    IP="(pending)"
fi

# Parse kernel command line for Datadog configuration
echo ""
echo "Checking for Datadog configuration..."

if [ -f /proc/cmdline ]; then
    # Extract DD_API_KEY
    DD_API_KEY=$(cat /proc/cmdline | grep -o 'DD_API_KEY=[^ ]*' | cut -d= -f2)
    if [ -n "$DD_API_KEY" ]; then
        export DD_API_KEY
        echo "✓ DD_API_KEY configured (${#DD_API_KEY} chars)"
    fi

    # Extract DD_SITE
    DD_SITE=$(cat /proc/cmdline | grep -o 'DD_SITE=[^ ]*' | cut -d= -f2)
    if [ -n "$DD_SITE" ]; then
        export DD_SITE
        echo "✓ DD_SITE: $DD_SITE"
    else
        export DD_SITE="datadoghq.com"
    fi

    # Extract DD_HOSTNAME
    DD_HOSTNAME=$(cat /proc/cmdline | grep -o 'DD_HOSTNAME=[^ ]*' | cut -d= -f2)
    if [ -n "$DD_HOSTNAME" ]; then
        export DD_HOSTNAME
    else
        export DD_HOSTNAME="vibecode-postgresql-vm"
    fi
fi

# Start Datadog StatsD bridge if API key is present
if [ -n "$DD_API_KEY" ] && [ -f /usr/local/bin/statsd-bridge.py ]; then
    echo ""
    echo "Starting Datadog StatsD bridge..."
    /usr/local/bin/statsd-bridge.py > /tmp/datadog-bridge.log 2>&1 &
    BRIDGE_PID=$!
    echo "✓ StatsD bridge started (PID: $BRIDGE_PID)"
    echo "  Listening on: 127.0.0.1:8125"
    echo "  Logs: /tmp/datadog-bridge.log"
else
    echo "⚠ Datadog integration disabled (no DD_API_KEY)"
fi

# Generate SSH host keys
echo ""
echo "Configuring SSH..."
if [ ! -f /etc/dropbear/dropbear_rsa_host_key ]; then
    mkdir -p /etc/dropbear
    /bin/dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key -s 2048 >/dev/null 2>&1
    /bin/dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key >/dev/null 2>&1
    echo "✓ SSH host keys generated"
fi

# Start Dropbear SSH server
/bin/dropbear -r /etc/dropbear/dropbear_rsa_host_key \
              -r /etc/dropbear/dropbear_ecdsa_host_key \
              -p 22 -F -E >/dev/null 2>&1 &
echo "✓ SSH server started on port 22"
echo "  Access: ssh root@${IP} (password: root)"

# Initialize PostgreSQL
echo ""
echo "========================================"
echo "  PostgreSQL Initialization"
echo "========================================"

# Create postgres data directory
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql

# Check if database is already initialized
if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
    echo "Initializing PostgreSQL database..."

    # Initialize database as postgres user
    su postgres -c '/usr/bin/initdb -D /var/lib/postgresql/data' 2>&1 | grep -v "^$"

    if [ $? -eq 0 ]; then
        echo "✓ Database initialized"

        # Copy configuration templates
        if [ -f /etc/postgresql/postgresql.conf.template ]; then
            cp /etc/postgresql/postgresql.conf.template /var/lib/postgresql/data/postgresql.conf
            chown postgres:postgres /var/lib/postgresql/data/postgresql.conf
        fi

        if [ -f /etc/postgresql/pg_hba.conf.template ]; then
            cp /etc/postgresql/pg_hba.conf.template /var/lib/postgresql/data/pg_hba.conf
            chown postgres:postgres /var/lib/postgresql/data/pg_hba.conf
        fi
    else
        echo "✗ Database initialization failed"
        echo "  Check logs: /var/lib/postgresql/data/log/"
    fi
else
    echo "✓ Database already initialized"
fi

# Start PostgreSQL
echo ""
echo "Starting PostgreSQL server..."
su postgres -c '/usr/bin/postgres -D /var/lib/postgresql/data' >/tmp/postgresql.log 2>&1 &
PG_PID=$!

# Wait for PostgreSQL to start
echo "Waiting for PostgreSQL to accept connections..."
sleep 3

# Check if PostgreSQL is running
if kill -0 $PG_PID 2>/dev/null; then
    echo "✓ PostgreSQL server started (PID: $PG_PID)"
    echo ""
    echo "========================================"
    echo "  PostgreSQL VM Ready!"
    echo "========================================"
    echo ""
    echo "Connection Information:"
    echo "  Host: $IP"
    echo "  Port: 5432"
    echo "  Username: postgres"
    echo "  Database: postgres"
    echo ""
    echo "SSH Access:"
    echo "  ssh root@${IP} (password: root)"
    echo ""
    echo "Datadog Monitoring:"
    if [ -n "$DD_API_KEY" ]; then
        echo "  ✓ Enabled"
        echo "  Site: $DD_SITE"
        echo "  Hostname: $DD_HOSTNAME"
    else
        echo "  ✗ Disabled (pass DD_API_KEY in kernel cmdline)"
    fi
    echo ""
    echo "Logs:"
    echo "  PostgreSQL: /tmp/postgresql.log"
    echo "  Datadog: /tmp/datadog-bridge.log"
    echo ""
    echo "========================================"

    # Send startup metric to Datadog
    if [ -n "$DD_API_KEY" ]; then
        echo "vibecode.postgresql.startup:1|c" | nc -u 127.0.0.1 8125 2>/dev/null
    fi
else
    echo "✗ PostgreSQL failed to start"
    echo "Check logs: /tmp/postgresql.log"
    cat /tmp/postgresql.log
fi

# Keep system running
echo ""
echo "VM is running. Logs will appear below."
echo "----------------------------------------"
echo ""

# Tail PostgreSQL logs
tail -f /tmp/postgresql.log 2>/dev/null &

# Keep init running
while true; do
    sleep 3600
done
EOFINIT

    chmod +x init

    # COMPATIBILITY FIX: Replace grep -P with grep -E for BusyBox compatibility
    # BusyBox grep doesn't support -P (Perl regex), use -E (extended regex) instead
    log "Applying BusyBox compatibility fixes..."
    sed -i '' 's/grep -P/grep -E/g' init 2>/dev/null || sed -i 's/grep -P/grep -E/g' init

    # Also fix the grep -oP pattern to work with grep -E
    # grep -oP '(?<=inet\s)\d+(\.\d+){3}' becomes grep -o and awk
    sed -i '' 's/grep -oP '\''(?<=inet\\s)\\d\+(\\\.\\d\+)\{3\}'\''/grep -o '\''[0-9]\+\\.[0-9]\+\\.[0-9]\+\\.[0-9]\+'\''/g' init 2>/dev/null || \
    sed -i 's/grep -oP '\''(?<=inet\\s)\\d\+(\\\.\\d\+)\{3\}'\''/grep -o '\''[0-9]\+\\.[0-9]\+\\.[0-9]\+\\.[0-9]\+'\''/g' init

    log "✓ Init script created and marked executable"
    log "✓ BusyBox compatibility fixes applied"
}

# ============================================================================
# Add Kernel Module Awareness
# ============================================================================

add_kernel_module_awareness() {
    section "Kernel Module Configuration"

    cd "$WORK_DIR/initramfs"

    log "Checking kernel module requirements..."

    # Create a kernel modules directory (even if empty, for documentation)
    mkdir -p lib/modules

    # Check if we can determine kernel version from common locations
    local KERNEL_VERSION=""
    local KERNEL_PATHS=(
        "$HOME/.vfkit/vms/vibecode-valkey/kernel/vmlinux"
        "$SCRIPT_DIR/linux-kernel-arm64"
        "$SCRIPT_DIR/vmlinux-cloud"
        "/tmp/vmlinux"
    )

    for kernel_path in "${KERNEL_PATHS[@]}"; do
        if [ -f "$kernel_path" ]; then
            log "Found kernel at: $kernel_path"
            # Try to extract version from kernel file
            KERNEL_VERSION=$(file "$kernel_path" 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1 || true)
            if [ -n "$KERNEL_VERSION" ]; then
                log "  Detected kernel version: $KERNEL_VERSION"
                break
            fi
        fi
    done

    if [ -z "$KERNEL_VERSION" ]; then
        warn "Could not detect kernel version from available kernels"
    fi

    # Create a README about kernel requirements
    cat > lib/modules/README.txt << 'EOFKERNELREADME'
Kernel Module Requirements for PostgreSQL VM
=============================================

IMPORTANT: This VM requires a kernel with networking support.

Required Kernel Features:
- virtio_net (VirtIO network driver) - MUST be built-in or loaded
- virtio_pci (VirtIO PCI transport)
- virtio (VirtIO base support)

Recommended Kernel Config:
- CONFIG_VIRTIO=y (built-in)
- CONFIG_VIRTIO_NET=y (built-in)
- CONFIG_VIRTIO_PCI=y (built-in)

If using modular kernel:
- Ensure modules are available in /lib/modules/<version>/
- Init script should load: modprobe virtio_net

Current Status:
- This initramfs does NOT include kernel modules
- Kernel MUST have virtio_net built-in
- Use a cloud kernel or kernel with CONFIG_VIRTIO_NET=y

Alternative:
- Build in a Linux environment with access to kernel modules
- Use unified-services-restored.cpio.gz which has working configuration
EOFKERNELREADME

    log "✓ Kernel module awareness documentation added"
    warn "NOTE: Kernel must have virtio_net built-in or as loadable module"
    warn "      If networking fails, use a different kernel with built-in networking"
}

# ============================================================================
# Validate Required Commands
# ============================================================================

validate_commands() {
    section "Validating Required Commands"

    cd "$WORK_DIR/initramfs"

    log "Checking for essential commands..."

    local required_cmds="su cut grep mount umount ip ifconfig sh"
    local missing_cmds=()

    for cmd in $required_cmds; do
        local found=false

        # Check multiple locations
        for location in bin/$cmd sbin/$cmd usr/bin/$cmd usr/sbin/$cmd; do
            if [ -f "$location" ] || [ -L "$location" ]; then
                log "  ✓ $cmd found at $location"
                found=true
                break
            fi
        done

        if [ "$found" = false ]; then
            warn "  ✗ $cmd NOT FOUND"
            missing_cmds+=("$cmd")
        fi
    done

    # Check library dependencies
    log "Checking dynamic linker..."
    if [ -f "lib/ld-musl-aarch64.so.1" ] || [ -L "lib/ld-musl-aarch64.so.1" ]; then
        log "  ✓ Dynamic linker present"
    else
        warn "  ✗ Dynamic linker missing (binaries may not execute)"
    fi

    # Check PostgreSQL binaries
    log "Checking PostgreSQL binaries..."
    for pgbin in postgres initdb pg_ctl psql; do
        if [ -f "usr/bin/$pgbin" ] || [ -f "usr/lib/postgresql*/$pgbin" ]; then
            log "  ✓ $pgbin found"
        else
            warn "  ✗ $pgbin NOT FOUND"
        fi
    done

    if [ ${#missing_cmds[@]} -gt 0 ]; then
        warn "Missing commands: ${missing_cmds[*]}"
        warn "These commands are required by the init script"
        warn "Build may fail at runtime!"
    else
        log "✓ All required commands present"
    fi
}

# ============================================================================
# Package Initramfs
# ============================================================================

package_initramfs() {
    section "Packaging Initramfs"

    cd "$WORK_DIR/initramfs"

    log "Creating CPIO archive..."
    log "  Finding all files..."

    # Count files
    local file_count=$(find . | wc -l)
    log "  Total files: $file_count"

    # Create CPIO archive
    find . -print0 | cpio --null --create --format=newc 2>/dev/null | gzip -9 > "$OUTPUT_FILE"

    if [ $? -eq 0 ]; then
        local size=$(du -h "$OUTPUT_FILE" | cut -f1)
        log "✓ Initramfs created: $size"
    else
        error "Failed to create CPIO archive"
    fi
}

# ============================================================================
# Verify Build
# ============================================================================

verify_build() {
    section "Verifying Build"

    log "Checking output file..."

    if [ ! -f "$OUTPUT_FILE" ]; then
        error "Output file not found: $OUTPUT_FILE"
    fi

    local size=$(du -h "$OUTPUT_FILE" | cut -f1)
    local size_bytes=$(du -b "$OUTPUT_FILE" | cut -f1)

    log "  File: $OUTPUT_FILE"
    log "  Size: $size ($size_bytes bytes)"

    # Check if size is reasonable (50MB - 200MB)
    if [ $size_bytes -lt 52428800 ]; then
        warn "  ⚠ File seems small (<50MB), might be incomplete"
    elif [ $size_bytes -gt 209715200 ]; then
        warn "  ⚠ File seems large (>200MB), might include unnecessary files"
    else
        log "  ✓ Size looks reasonable"
    fi

    # Test CPIO extraction
    log "Testing CPIO archive integrity..."
    if gzip -t "$OUTPUT_FILE" 2>/dev/null; then
        log "  ✓ GZIP compression valid"
    else
        error "  ✗ GZIP compression invalid"
    fi

    # Extract and check init script
    log "Verifying init script..."
    local temp_test="/tmp/initramfs-test-$$"
    mkdir -p "$temp_test"
    cd "$temp_test"

    if gzip -dc "$OUTPUT_FILE" | cpio -idm ./init 2>/dev/null; then
        if [ -f "init" ] && [ -x "init" ]; then
            log "  ✓ Init script present and executable"
            local shebang=$(head -1 init)
            if [[ "$shebang" == "#!/bin/sh" ]] || [[ "$shebang" == "#!/bin/bash" ]]; then
                log "  ✓ Shebang correct: $shebang"
            else
                warn "  ⚠ Unexpected shebang: $shebang"
            fi
        else
            error "  ✗ Init script missing or not executable"
        fi
    else
        error "  ✗ Failed to extract init script"
    fi

    rm -rf "$temp_test"

    log "✓ Build verification complete"
}

# ============================================================================
# Cleanup
# ============================================================================

cleanup() {
    if [ -d "$WORK_DIR" ]; then
        log "Cleaning up work directory..."
        rm -rf "$WORK_DIR"
        log "✓ Cleanup complete"
    fi
}

# ============================================================================
# Show Usage Instructions
# ============================================================================

show_instructions() {
    section "Build Complete!"

    local size=$(du -h "$OUTPUT_FILE" | cut -f1)

    echo -e "${GREEN}✓ PostgreSQL VM initramfs built successfully${NC}"
    echo ""
    echo "Output File:"
    echo "  Location: $OUTPUT_FILE"
    echo "  Size: $size"
    echo ""
    echo "Components Included:"
    echo "  ✓ PostgreSQL 16+ server"
    echo "  ✓ BusyBox utilities"
    echo "  ✓ Dropbear SSH server"
    echo "  ✓ Python 3 runtime"
    echo "  ✓ Datadog StatsD bridge"
    echo "  ✓ musl libc"
    echo ""
    echo "To Boot the VM:"
    echo ""
    echo -e "${BLUE}# Set Datadog API key (optional)${NC}"
    echo "export DD_API_KEY='your_api_key_here'"
    echo ""
    echo -e "${BLUE}# Boot with vfkit${NC}"
    echo "vfkit \\"
    echo "  --cpus 2 \\"
    echo "  --memory 1024 \\"
    echo "  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \\"
    echo "  --initrd $OUTPUT_FILE \\"
    echo "  --kernel-cmdline \"console=hvc0 DD_API_KEY=\${DD_API_KEY} DD_SITE=datadoghq.com\" \\"
    echo "  --device virtio-net,nat,mac=52:54:00:12:34:93 \\"
    echo "  --device virtio-rng"
    echo ""
    echo "Default Credentials:"
    echo "  SSH: root/root"
    echo "  PostgreSQL: postgres/(no password by default)"
    echo ""
    echo "Services:"
    echo "  PostgreSQL: port 5432"
    echo "  SSH: port 22"
    echo "  StatsD: port 8125 (internal)"
    echo ""
    echo "Datadog Integration:"
    echo "  - Pass DD_API_KEY in kernel command line to enable"
    echo "  - Metrics sent every 30 seconds"
    echo "  - View in Datadog dashboard: search for 'vibecode-postgresql-vm'"
    echo ""
    echo "Next Steps:"
    echo "  1. Copy initramfs to SwiftUI app Resources:"
    echo "     cp $OUTPUT_FILE ~/vibecode-webgui/azure/SwiftUI-Apps/Apps/PostgreSQLVibeCodeApp/Resources/"
    echo ""
    echo "  2. Rebuild SwiftUI app:"
    echo "     cd ~/vibecode-webgui/azure/SwiftUI-Apps"
    echo "     ./build-apps.sh PostgreSQLVibeCodeApp"
    echo ""
    echo "  3. Test VM boot and verify PostgreSQL starts"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  ALTERNATIVE APPROACH${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo "If this build fails or VM doesn't boot properly, consider:"
    echo ""
    echo "1. Use pre-built working initramfs:"
    echo "   - unified-services-restored.cpio.gz (contains PostgreSQL + more)"
    echo "   - This includes all necessary utilities and working kernel modules"
    echo ""
    echo "2. Build in a native Linux environment:"
    echo "   - Use a Linux ARM64 system or container"
    echo "   - Access to proper kernel modules and toolchain"
    echo "   - Easier dependency resolution"
    echo ""
    echo "3. Use a cloud kernel with built-in virtio_net:"
    echo "   - vmlinux-cloud (if available in azure/ directory)"
    echo "   - Ubuntu cloud kernel with CONFIG_VIRTIO_NET=y"
    echo ""
    echo "Known Issues with Cross-Compilation:"
    echo "  - Missing kernel modules (virtio_net)"
    echo "  - BusyBox vs GNU utilities incompatibility"
    echo "  - Library dependency resolution on macOS"
    echo ""
    echo "For production use, the unified-services VM is recommended."
    echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Trap errors and cleanup
    trap cleanup EXIT
    trap 'error "Build interrupted"' INT TERM

    # Create work directory
    mkdir -p "$WORK_DIR"

    # Execute build steps
    check_dependencies
    download_alpine_packages
    create_initramfs_structure
    install_kernel_modules
    install_packages
    configure_libraries
    configure_busybox
    configure_postgresql
    configure_ssh
    create_datadog_bridge
    create_init_script
    add_kernel_module_awareness
    validate_commands
    package_initramfs
    verify_build

    # Show usage instructions
    show_instructions
}

# Run main function
main "$@"
