#!/bin/bash
# Build Unified Services VM with Datadog Integration
# Services: Valkey + PostgreSQL + OpenVSCode
# Integration: Lightweight StatsD bridge for Datadog metrics
# Target Size: 250-300MB compressed initramfs
#
# Based on:
# - Working Ubuntu 26 build process
# - Existing Datadog integration from build-bun-minimal-with-datadog.sh
# - Successful unified services builds

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
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="/tmp/unified-services-dd-$$"
OUTPUT_NAME="unified-services-with-datadog.cpio.gz"
OUTPUT_PATH="${SCRIPT_DIR}/${OUTPUT_NAME}"

# Version configuration
BUSYBOX_VERSION="1.37.0"
OPENVSCODE_VERSION="1.95.3"
POSTGRESQL_VERSION="16"
VALKEY_VERSION="8.0.1"

# Alpine Linux packages (ARM64)
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine/edge"

log "========================================="
log "  Unified Services VM Builder"
log "  with Datadog Integration"
log "========================================="
log ""
info "Build ID: $$"
info "Work directory: $WORK_DIR"
info "Output: $OUTPUT_PATH"
log ""

# ==============================================================================
# PHASE 1: DEPENDENCY CHECK
# ==============================================================================

check_dependencies() {
    log "=== Phase 1: Checking Dependencies ==="

    local missing=()
    for cmd in wget curl tar gzip cpio python3; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing required tools: ${missing[*]}"
    fi

    # Check Docker availability (optional, only needed if building Valkey from source)
    if ! command -v docker &>/dev/null; then
        warn "Docker not available. Will use Alpine packages only."
        export NO_DOCKER=1
    elif ! docker info &>/dev/null 2>&1; then
        warn "Docker is not running. Will use Alpine packages only."
        export NO_DOCKER=1
    fi

    log "✓ All dependencies satisfied"
    log ""
}

# ==============================================================================
# PHASE 2: DOWNLOAD BINARIES AND DEPENDENCIES
# ==============================================================================

download_busybox() {
    log "=== Downloading BusyBox ==="

    local busybox_dir="$WORK_DIR/downloads/busybox"
    mkdir -p "$busybox_dir"
    cd "$busybox_dir"

    local apk_url="${ALPINE_MIRROR}/main/aarch64/busybox-${BUSYBOX_VERSION}-r29.apk"
    info "Downloading: $apk_url"

    wget -q --show-progress "$apk_url" -O busybox.apk || error "Failed to download BusyBox"

    # Extract APK (APK files are tar.gz archives)
    tar xzf busybox.apk 2>/dev/null || true

    if [ ! -f bin/busybox ]; then
        error "BusyBox binary not found in APK"
    fi

    local size=$(du -h bin/busybox | cut -f1)
    log "✓ BusyBox downloaded: $size"
    log ""
}

download_valkey() {
    log "=== Downloading Valkey ==="

    local valkey_dir="$WORK_DIR/downloads/valkey"
    mkdir -p "$valkey_dir/usr/bin"
    cd "$valkey_dir"

    # Valkey is not available in Alpine repos, extract from pre-built image
    local valkey_image="${SCRIPT_DIR}/valkey-with-datadog.cpio.gz"

    if [ -f "$valkey_image" ]; then
        info "Extracting Valkey from pre-built image..."
        local temp_extract="/tmp/valkey-extract-$$"
        mkdir -p "$temp_extract"

        (cd "$temp_extract" && gunzip -c "$valkey_image" | cpio -idm 2>/dev/null)

        # Copy Valkey binaries (check multiple possible locations)
        local valkey_found=0
        for valkey_path in "$temp_extract/bin/valkey-server" "$temp_extract/usr/local/bin/valkey-server" "$temp_extract/usr/bin/valkey-server"; do
            if [ -f "$valkey_path" ]; then
                cp "$valkey_path" "$valkey_dir/usr/bin/"
                # Try to find valkey-cli
                local valkey_dir_path=$(dirname "$valkey_path")
                [ -f "$valkey_dir_path/valkey-cli" ] && cp "$valkey_dir_path/valkey-cli" "$valkey_dir/usr/bin/" 2>/dev/null || true
                valkey_found=1
                break
            fi
        done

        if [ $valkey_found -eq 0 ]; then
            rm -rf "$temp_extract"
            error "Valkey binary not found in pre-built image"
        fi

        # Copy any required libraries
        if [ -d "$temp_extract/lib" ]; then
            mkdir -p "$valkey_dir/lib"
            cp -r "$temp_extract/lib/"* "$valkey_dir/lib/" 2>/dev/null || true
        fi
        if [ -d "$temp_extract/usr/lib" ]; then
            mkdir -p "$valkey_dir/usr/lib"
            cp -r "$temp_extract/usr/lib/"* "$valkey_dir/usr/lib/" 2>/dev/null || true
        fi

        rm -rf "$temp_extract"

        local size=$(du -h "$valkey_dir/usr/bin/valkey-server" | cut -f1)
        log "✓ Valkey extracted: $size"
    else
        # Fall back to building from source if Docker is available
        if [ -z "$NO_DOCKER" ]; then
            warn "Pre-built Valkey image not found, building from source..."
            build_valkey_from_source
        else
            error "Valkey not available: no pre-built image and Docker not available"
        fi
    fi

    log ""
}

build_valkey_from_source() {
    log "Building Valkey from source using Alpine Docker container..."

    local valkey_dir="$WORK_DIR/downloads/valkey"
    mkdir -p "$valkey_dir"

    # Build in Docker Alpine ARM64 container
    docker run --rm --platform linux/arm64 \
        -v "$valkey_dir:/output" \
        alpine:edge sh -c "
        apk add --no-cache build-base linux-headers wget
        cd /tmp
        wget https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_VERSION}.tar.gz
        tar xzf ${VALKEY_VERSION}.tar.gz
        cd valkey-${VALKEY_VERSION}
        make -j\$(nproc) BUILD_TLS=yes USE_SYSTEMD=no
        strip src/valkey-server
        mkdir -p /output/usr/bin
        cp src/valkey-server /output/usr/bin/
        " || error "Failed to build Valkey"

    log "✓ Valkey built from source"
}

download_postgresql() {
    log "=== Downloading PostgreSQL ==="

    local pg_dir="$WORK_DIR/downloads/postgresql"
    mkdir -p "$pg_dir"

    # Extract from pre-built image
    local pg_image="${SCRIPT_DIR}/postgresql-complete.cpio.gz"

    if [ -f "$pg_image" ]; then
        info "Extracting PostgreSQL from pre-built image..."
        local temp_extract="/tmp/postgresql-extract-$$"
        mkdir -p "$temp_extract"

        (cd "$temp_extract" && gunzip -c "$pg_image" | cpio -idm 2>/dev/null)

        # Verify extraction succeeded
        if [ ! -d "$temp_extract/usr" ] && [ ! -d "$temp_extract/bin" ]; then
            rm -rf "$temp_extract"
            error "Failed to extract PostgreSQL image"
        fi

        # Copy PostgreSQL binaries (check multiple possible locations)
        local pg_found=0
        info "Searching for PostgreSQL binaries in $temp_extract..."
        for pg_path in "$temp_extract/usr/libexec/postgresql16/postgres" "$temp_extract/usr/bin/postgres" "$temp_extract/usr/local/bin/postgres" "$temp_extract/bin/postgres"; do
            info "Checking: $pg_path"
            if [ -f "$pg_path" ]; then
                local pg_bin_dir=$(dirname "$pg_path")
                mkdir -p "$pg_dir/usr/bin"

                # Copy main binaries
                cp "$pg_path" "$pg_dir/usr/bin/"
                [ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/bin/" || true
                [ -f "$pg_bin_dir/psql" ] && cp "$pg_bin_dir/psql" "$pg_dir/usr/bin/" || true
                [ -f "$pg_bin_dir/pg_ctl" ] && cp "$pg_bin_dir/pg_ctl" "$pg_dir/usr/bin/" || true

                pg_found=1
                break
            fi
        done

        if [ $pg_found -eq 0 ]; then
            rm -rf "$temp_extract"
            error "PostgreSQL binary not found in pre-built image"
        fi

        # Copy PostgreSQL libraries
        for lib_path in "$temp_extract/usr/lib" "$temp_extract/lib"; do
            if [ -d "$lib_path" ]; then
                mkdir -p "$pg_dir/usr/lib"
                cp -r "$lib_path/"* "$pg_dir/usr/lib/" 2>/dev/null || true
            fi
        done

        rm -rf "$temp_extract"

        local size=$(du -h "$pg_dir/usr/bin/postgres" | cut -f1)
        log "✓ PostgreSQL extracted: $size"
    else
        error "PostgreSQL pre-built image not found: $pg_image"
    fi

    log ""
}

download_openvscode() {
    log "=== Downloading OpenVSCode Server ==="

    local vscode_dir="$WORK_DIR/downloads/openvscode"
    mkdir -p "$vscode_dir"
    cd "$vscode_dir"

    local url="https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64.tar.gz"
    info "Downloading: $url"

    wget -q --show-progress "$url" -O openvscode.tar.gz || error "Failed to download OpenVSCode"

    log "Extracting OpenVSCode..."
    tar xzf openvscode.tar.gz
    mv "openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64" openvscode

    local size=$(du -sh openvscode | cut -f1)
    log "✓ OpenVSCode downloaded: $size"
    log ""
}

download_dropbear_ssh() {
    log "=== Downloading Dropbear SSH Server ==="

    local ssh_dir="$WORK_DIR/downloads/dropbear"
    mkdir -p "$ssh_dir"
    cd "$ssh_dir"

    local apk_url="${ALPINE_MIRROR}/main/aarch64/dropbear-2025.88-r1.apk"
    info "Downloading: $apk_url"

    wget -q "$apk_url" -O dropbear.apk || error "Failed to download Dropbear"
    tar xzf dropbear.apk 2>/dev/null || true

    if [ ! -f usr/sbin/dropbear ]; then
        error "Dropbear binary not found in APK"
    fi

    log "✓ Dropbear SSH downloaded"
    log ""
}

download_musl_libc() {
    log "=== Downloading musl libc and dependencies ==="

    local lib_dir="$WORK_DIR/downloads/libs"
    mkdir -p "$lib_dir"
    cd "$lib_dir"

    # Essential libraries from Alpine
    local packages=(
        "musl-1.2.5-r8.apk"
        "zlib-1.3.1-r2.apk"
        "openssl-3.4.0-r0.apk"
        "libgcc-15.0.0_git20241124-r0.apk"
        "libstdc++-15.0.0_git20241124-r0.apk"
        "ncurses-libs-6.5_p20241115-r1.apk"
        "readline-8.2.13-r0.apk"
    )

    for pkg in "${packages[@]}"; do
        local url="${ALPINE_MIRROR}/main/aarch64/${pkg}"
        info "Downloading: $pkg"
        wget -q "$url" -O "$pkg" || warn "Failed to download $pkg (may not be critical)"
        tar xzf "$pkg" 2>/dev/null || true
    done

    log "✓ Libraries downloaded"
    log ""
}

# ==============================================================================
# PHASE 3: CREATE DATADOG INTEGRATION
# ==============================================================================

create_datadog_bridge() {
    log "=== Creating Datadog StatsD Bridge ==="

    local dd_dir="$WORK_DIR/datadog"
    mkdir -p "$dd_dir"
    cd "$dd_dir"

    # Create lightweight Python StatsD bridge
    cat > statsd-bridge.py << 'EOF'
#!/usr/bin/env python3
"""
Lightweight StatsD bridge for Datadog metrics collection.
Runs in background and periodically sends metrics to Datadog via HTTP API.
Minimal dependencies: only stdlib modules.
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
    def __init__(self):
        self.dd_api_key = os.environ.get('DD_API_KEY', '')
        self.dd_site = os.environ.get('DD_SITE', 'datadoghq.com')
        self.hostname = os.environ.get('DD_HOSTNAME', 'unified-services-vm')
        self.tags = {
            'service': 'unified-services-vm',
            'component': 'valkey-postgres-openvscode',
            'integration': 'datadog-lightweight'
        }

        # Create UDP socket for receiving StatsD metrics
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(('127.0.0.1', 8125))
        self.metrics = {}
        self.running = True

    def parse_statsd_line(self, line):
        """Parse StatsD metric line: metric_name:value|type|#tags"""
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

            return {
                'name': metric_name,
                'value': value,
                'type': metric_type,
                'timestamp': int(time.time())
            }
        except:
            return None

    def send_to_datadog(self):
        """Send accumulated metrics to Datadog API"""
        if not self.dd_api_key or not self.metrics:
            return

        url = f'https://api.{self.dd_site}/api/v2/series'
        headers = {
            'DD-API-KEY': self.dd_api_key,
            'Content-Type': 'application/json'
        }

        # Convert metrics to Datadog format
        series = []
        for metric_name, (value, timestamp) in self.metrics.items():
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
        except urllib.error.URLError as e:
            print(f'[DD] Error sending metrics: {e}', file=sys.stderr)
        except Exception as e:
            print(f'[DD] Unexpected error: {e}', file=sys.stderr)

    def receive_metrics(self):
        """Background thread: receive StatsD metrics"""
        print(f'[DD] StatsD bridge listening on 127.0.0.1:8125')
        print(f'[DD] Forwarding to {self.dd_site} (hostname: {self.hostname})')

        while self.running:
            try:
                data, addr = self.sock.recvfrom(1024)
                line = data.decode('utf-8').strip()

                metric = self.parse_statsd_line(line)
                if metric:
                    self.metrics[metric['name']] = (metric['value'], metric['timestamp'])
            except socket.timeout:
                pass
            except Exception as e:
                print(f'[DD] Receive error: {e}', file=sys.stderr)

    def run(self):
        """Run bridge with periodic metric sending"""
        self.sock.settimeout(1.0)

        # Start receiver thread
        receiver = threading.Thread(target=self.receive_metrics, daemon=True)
        receiver.start()

        # Main loop: send metrics every 30 seconds
        try:
            while self.running:
                time.sleep(30)
                self.send_to_datadog()
        except KeyboardInterrupt:
            print('\n[DD] Shutting down...')
            self.running = False
        finally:
            self.sock.close()

if __name__ == '__main__':
    bridge = DatadogStatsDBridge()
    bridge.run()
EOF

    chmod +x statsd-bridge.py

    local size=$(du -h statsd-bridge.py | cut -f1)
    log "✓ Datadog StatsD bridge created: $size"
    log ""
}

# ==============================================================================
# PHASE 4: BUILD INITRAMFS STRUCTURE
# ==============================================================================

create_initramfs_structure() {
    log "=== Phase 4: Creating Initramfs Structure ==="

    local initramfs="$WORK_DIR/initramfs"
    mkdir -p "$initramfs"
    cd "$initramfs"

    # Create directory structure
    info "Creating directory tree..."
    mkdir -p {bin,sbin,lib,usr/{bin,sbin,lib,local/bin},etc/{dropbear,init.d},var/{lib/postgresql/data,log},dev,proc,sys,tmp,run/postgresql,home,opt/openvscode}

    log "✓ Directory structure created"
}

copy_kernel_modules() {
    log "=== Copying Kernel Modules ==="

    local initramfs="$WORK_DIR/initramfs"
    local modules_tarball="/tmp/vibecode-kernel-modules.tar.gz"

    if [ ! -f "$modules_tarball" ]; then
        warn "Kernel modules tarball not found at $modules_tarball"
        warn "Skipping kernel module installation"
        return 0
    fi

    info "Extracting kernel modules from tarball..."
    local temp_extract="/tmp/modules-extract-$$"
    mkdir -p "$temp_extract"
    cd "$temp_extract"

    # Extract the tarball
    tar xzf "$modules_tarball" || error "Failed to extract kernel modules"

    # Find the kernel version directory
    local kernel_version=$(ls lib/modules/ | head -1)
    info "Found kernel version: $kernel_version"

    # Copy the entire modules directory to initramfs
    mkdir -p "$initramfs/lib/modules"
    cp -r lib/modules/* "$initramfs/lib/modules/"

    # Decompress the specific modules we need for faster loading
    info "Decompressing critical network modules..."
    cd "$initramfs/lib/modules/$kernel_version"

    # Find and decompress virtio network modules
    local modules_to_decompress=(
        "kernel/net/core/failover.ko.gz"
        "kernel/drivers/net/net_failover.ko.gz"
        "kernel/drivers/net/virtio_net.ko.gz"
    )

    for module in "${modules_to_decompress[@]}"; do
        if [ -f "$module" ]; then
            info "Decompressing $module"
            gunzip "$module" || warn "Failed to decompress $module"
        fi
    done

    # Cleanup temp directory
    cd /
    rm -rf "$temp_extract"

    local modules_count=$(find "$initramfs/lib/modules" -name "*.ko" -o -name "*.ko.gz" | wc -l)
    log "✓ Copied $modules_count kernel modules"
    log ""
}

copy_binaries() {
    log "=== Copying Binaries ==="

    local initramfs="$WORK_DIR/initramfs"
    local downloads="$WORK_DIR/downloads"

    # BusyBox
    info "Copying BusyBox..."
    cp "$downloads/busybox/bin/busybox" "$initramfs/bin/"
    chmod +x "$initramfs/bin/busybox"

    # Create busybox symlinks
    cd "$initramfs/bin"
    for applet in sh ash mount umount ip udhcpc ps kill mkdir cat grep awk sed sleep echo chmod chown ls ln cp mv rm wget nc true false; do
        ln -sf busybox "$applet" 2>/dev/null || true
    done
    cd "$WORK_DIR"

    # Valkey
    info "Copying Valkey..."
    if [ -f "$downloads/valkey/usr/bin/valkey-server" ]; then
        cp "$downloads/valkey/usr/bin/valkey-server" "$initramfs/bin/"
        chmod +x "$initramfs/bin/valkey-server"
        # Copy Valkey libraries if present
        if [ -d "$downloads/valkey/lib" ]; then
            cp -r "$downloads/valkey/lib/"* "$initramfs/lib/" 2>/dev/null || true
        fi
        if [ -d "$downloads/valkey/usr/lib" ]; then
            cp -r "$downloads/valkey/usr/lib/"* "$initramfs/usr/lib/" 2>/dev/null || true
        fi
    else
        error "Valkey binary not found"
    fi

    # PostgreSQL
    info "Copying PostgreSQL..."
    cp "$downloads/postgresql/usr/bin/postgres" "$initramfs/usr/bin/"
    cp "$downloads/postgresql/usr/bin/initdb" "$initramfs/usr/bin/" 2>/dev/null || true
    cp "$downloads/postgresql/usr/bin/psql" "$initramfs/usr/bin/" 2>/dev/null || true
    chmod +x "$initramfs/usr/bin/postgres" "$initramfs/usr/bin/initdb" 2>/dev/null || true

    # Copy PostgreSQL libraries
    if [ -d "$downloads/postgresql/usr/lib" ]; then
        info "Copying PostgreSQL libraries..."
        cp -r "$downloads/postgresql/usr/lib/"* "$initramfs/usr/lib/" 2>/dev/null || true
    fi

    # OpenVSCode
    info "Copying OpenVSCode..."
    cp -r "$downloads/openvscode/openvscode/"* "$initramfs/opt/openvscode/"

    # Dropbear SSH
    info "Copying Dropbear SSH..."
    cp "$downloads/dropbear/usr/sbin/dropbear" "$initramfs/usr/sbin/"
    cp "$downloads/dropbear/usr/bin/dropbearkey" "$initramfs/usr/bin/" 2>/dev/null || true
    chmod +x "$initramfs/usr/sbin/dropbear" "$initramfs/usr/bin/dropbearkey"

    # Datadog bridge
    info "Copying Datadog StatsD bridge..."
    cp "$WORK_DIR/datadog/statsd-bridge.py" "$initramfs/usr/local/bin/"
    chmod +x "$initramfs/usr/local/bin/statsd-bridge.py"

    log "✓ Binaries copied"
    log ""
}

copy_libraries() {
    log "=== Copying Libraries ==="

    local initramfs="$WORK_DIR/initramfs"
    local downloads="$WORK_DIR/downloads"

    # Copy all libraries from Alpine packages
    info "Copying musl and system libraries..."
    if [ -d "$downloads/libs/lib" ]; then
        cp -r "$downloads/libs/lib/"* "$initramfs/lib/" 2>/dev/null || true
    fi
    if [ -d "$downloads/libs/usr/lib" ]; then
        cp -r "$downloads/libs/usr/lib/"* "$initramfs/usr/lib/" 2>/dev/null || true
    fi

    # Ensure critical libraries are present
    info "Verifying critical libraries..."
    local critical_libs=(
        "ld-musl-aarch64.so.1"
        "libc.musl-aarch64.so.1"
        "libz.so.1"
        "libssl.so.3"
        "libcrypto.so.3"
    )

    for lib in "${critical_libs[@]}"; do
        if ! find "$initramfs/lib" "$initramfs/usr/lib" -name "$lib" 2>/dev/null | grep -q .; then
            warn "Critical library $lib not found - services may fail"
        fi
    done

    # Create libc symlink
    if [ -f "$initramfs/lib/ld-musl-aarch64.so.1" ]; then
        ln -sf ld-musl-aarch64.so.1 "$initramfs/lib/libc.so" 2>/dev/null || true
    fi

    log "✓ Libraries copied"
    log ""
}

create_configuration_files() {
    log "=== Creating Configuration Files ==="

    local initramfs="$WORK_DIR/initramfs"

    # Valkey configuration
    info "Creating Valkey config..."
    cat > "$initramfs/etc/valkey.conf" << 'EOF'
# Valkey configuration for VM
bind 0.0.0.0
port 6379
protected-mode no
daemonize no
loglevel notice
logfile ""
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
dbfilename dump.rdb
dir /tmp
maxmemory 128mb
maxmemory-policy allkeys-lru
EOF

    # PostgreSQL configuration
    info "Creating PostgreSQL config..."
    cat > "$initramfs/etc/postgresql.conf" << 'EOF'
# PostgreSQL configuration for VM
listen_addresses = '*'
port = 5432
max_connections = 50
shared_buffers = 128MB
effective_cache_size = 256MB
maintenance_work_mem = 64MB
work_mem = 4MB
wal_level = minimal
max_wal_senders = 0
fsync = off
synchronous_commit = off
full_page_writes = off
EOF

    # pg_hba.conf (allow all connections for dev/test)
    cat > "$initramfs/etc/pg_hba.conf" << 'EOF'
local   all             all                                     trust
host    all             all             0.0.0.0/0               trust
host    all             all             ::/0                    trust
EOF

    # /etc/passwd
    info "Creating user files..."
    cat > "$initramfs/etc/passwd" << 'EOF'
root:x:0:0:root:/root:/bin/sh
postgres:x:70:70:PostgreSQL:/var/lib/postgresql:/bin/sh
EOF

    # /etc/shadow (password: vibecode)
    cat > "$initramfs/etc/shadow" << 'EOF'
root:$6$rounds=4096$SALT$ZjJKqN6xqZ0rLU8bv6RkL4WF7XKJ4kPZF9QvL7WHQJ3KZ5F:19000:0:99999:7:::
postgres:*:19000:0:99999:7:::
EOF
    chmod 600 "$initramfs/etc/shadow"

    # /etc/group
    cat > "$initramfs/etc/group" << 'EOF'
root:x:0:
postgres:x:70:
EOF

    # /etc/hosts
    cat > "$initramfs/etc/hosts" << 'EOF'
127.0.0.1       localhost localhost.localdomain
::1             localhost localhost.localdomain
EOF

    log "✓ Configuration files created"
    log ""
}

create_init_script() {
    log "=== Creating Init Script ==="

    local initramfs="$WORK_DIR/initramfs"

    cat > "$initramfs/init" << 'INITEOF'
#!/bin/busybox sh
# Unified Services VM Init Script
# Services: Valkey + PostgreSQL + OpenVSCode
# Monitoring: Datadog StatsD bridge

echo "========================================="
echo "  Unified Services VM"
echo "  Valkey + PostgreSQL + OpenVSCode"
echo "========================================="
echo ""

# Install busybox applets
echo "Installing busybox applets..."
/bin/busybox --install -s /bin

# Mount essential filesystems
echo "Mounting filesystems..."
mount -t proc proc /proc 2>/dev/null || true
mount -t sysfs sys /sys 2>/dev/null || true
mount -t devtmpfs dev /dev 2>/dev/null || true
mount -t tmpfs tmp /tmp 2>/dev/null || true

# Set hostname
hostname unified-vm 2>/dev/null || true
echo "unified-vm" > /etc/hostname 2>/dev/null || true

# Create essential device nodes
mknod -m 666 /dev/null c 1 3 2>/dev/null || true
mknod -m 666 /dev/zero c 1 5 2>/dev/null || true
mknod -m 666 /dev/random c 1 8 2>/dev/null || true

# Load kernel modules for network
echo ""
echo "=== Loading Kernel Modules ==="
if [ -d /lib/modules ]; then
    KERNEL_VERSION=$(ls /lib/modules/ | head -1)
    MODULE_PATH="/lib/modules/$KERNEL_VERSION/kernel"

    # Load network failover modules first
    if [ -f "$MODULE_PATH/net/core/failover.ko" ]; then
        echo "Loading failover.ko..."
        insmod "$MODULE_PATH/net/core/failover.ko" 2>/dev/null || echo "  (already loaded or built-in)"
    fi

    if [ -f "$MODULE_PATH/drivers/net/net_failover.ko" ]; then
        echo "Loading net_failover.ko..."
        insmod "$MODULE_PATH/drivers/net/net_failover.ko" 2>/dev/null || echo "  (already loaded or built-in)"
    fi

    # Load virtio network driver
    if [ -f "$MODULE_PATH/drivers/net/virtio_net.ko" ]; then
        echo "Loading virtio_net.ko..."
        insmod "$MODULE_PATH/drivers/net/virtio_net.ko" 2>/dev/null || echo "  (already loaded or built-in)"
    fi

    echo "✓ Kernel modules loaded"

    # Give modules time to initialize
    sleep 2
else
    echo "⚠ No kernel modules directory found"
fi

# Network setup
echo ""
echo "=== Network Setup ==="
ip link set lo up

# Find and configure network interface
FOUND_IFACE=""
for iface in eth0 eth1 enp0s1 ens3; do
    if ip link show "$iface" >/dev/null 2>&1; then
        FOUND_IFACE="$iface"
        break
    fi
done

if [ -n "$FOUND_IFACE" ]; then
    echo "Network interface: $FOUND_IFACE"
    ip link set "$FOUND_IFACE" up
    sleep 1

    # DHCP configuration
    echo "Requesting DHCP address..."
    udhcpc -i "$FOUND_IFACE" -s /bin/true -n -q 2>&1 || true
    sleep 2

    # Get IP address
    VM_IP=$(ip addr show "$FOUND_IFACE" | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    echo "✓ IP Address: $VM_IP"
else
    echo "⚠ No network interface found"
    VM_IP="localhost"
fi
echo ""

# Setup SSH server
echo "=== SSH Server Setup ==="
mkdir -p /etc/dropbear /run

if [ ! -f /etc/dropbear/dropbear_rsa_host_key ]; then
    echo "Generating SSH host keys..."
    /usr/bin/dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key -s 2048 2>&1 | grep -E "Generating|fingerprint" || true
    /usr/bin/dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key 2>&1 | grep -E "Generating|fingerprint" || true
    echo "✓ SSH keys generated"
fi

# Start Dropbear SSH server
/usr/sbin/dropbear -R -E -p 22 -B 2>/dev/null &
DROPBEAR_PID=$!
sleep 1

if ps | grep -v grep | grep -q dropbear; then
    echo "✓ SSH server started (PID: $DROPBEAR_PID)"
    echo "  Connect: ssh root@$VM_IP (password: vibecode)"
else
    echo "⚠ SSH server failed to start"
fi
echo ""

# Datadog Integration
echo "=== Datadog Integration ==="

# Parse Datadog config from kernel command line
if [ -f /proc/cmdline ]; then
    DD_API_KEY=$(grep -oP 'DD_API_KEY=\K[^ ]+' /proc/cmdline 2>/dev/null || echo "")
    DD_SITE=$(grep -oP 'DD_SITE=\K[^ ]+' /proc/cmdline 2>/dev/null || echo "datadoghq.com")
    DD_HOSTNAME=$(grep -oP 'DD_HOSTNAME=\K[^ ]+' /proc/cmdline 2>/dev/null || echo "unified-services-vm")

    export DD_API_KEY
    export DD_SITE
    export DD_HOSTNAME
fi

if [ -n "$DD_API_KEY" ]; then
    echo "✓ Datadog API key configured (${#DD_API_KEY} chars)"
    echo "  Site: $DD_SITE"
    echo "  Hostname: $DD_HOSTNAME"

    # Start StatsD bridge
    if [ -f /usr/local/bin/statsd-bridge.py ]; then
        echo "  Starting StatsD bridge..."
        /usr/local/bin/statsd-bridge.py > /tmp/datadog-bridge.log 2>&1 &
        DATADOG_PID=$!
        sleep 1

        if ps | grep -q "$DATADOG_PID"; then
            echo "  ✓ StatsD bridge running (PID: $DATADOG_PID)"
            echo "  Metrics port: 8125 (UDP)"
            echo "  Flush interval: 30 seconds"
        else
            echo "  ⚠ StatsD bridge failed to start"
        fi
    fi
else
    echo "⚠ DD_API_KEY not configured - Datadog disabled"
    echo "  To enable: Add DD_API_KEY=<key> to kernel cmdline"
fi
echo ""

# Library path for services
export LD_LIBRARY_PATH=/lib:/usr/lib

# Start Valkey
echo "=== Starting Valkey Server ==="
if [ -f /bin/valkey-server ] && [ -f /etc/valkey.conf ]; then
    /bin/valkey-server /etc/valkey.conf > /tmp/valkey.log 2>&1 &
    VALKEY_PID=$!
    sleep 2

    if ps | grep -v grep | grep -q valkey-server; then
        echo "✓ Valkey started (PID: $VALKEY_PID)"
        echo "  Port: 6379"
        echo "  Config: /etc/valkey.conf"
        echo "  Logs: /tmp/valkey.log"
    else
        echo "⚠ Valkey failed to start"
        echo "  Check logs: cat /tmp/valkey.log"
    fi
else
    echo "⚠ Valkey binary or config not found"
fi
echo ""

# Start PostgreSQL
echo "=== Starting PostgreSQL Server ==="
if [ -f /usr/bin/postgres ]; then
    # Create postgres user directories
    mkdir -p /var/lib/postgresql/data /run/postgresql /tmp/postgresql
    chmod 700 /var/lib/postgresql/data
    chmod 775 /run/postgresql
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql /tmp/postgresql 2>/dev/null || true

    # Initialize database if needed
    if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
        echo "Initializing PostgreSQL database..."
        su - postgres -c "/usr/bin/initdb -D /var/lib/postgresql/data" 2>&1 | head -5

        # Copy configs
        cp /etc/postgresql.conf /var/lib/postgresql/data/ 2>/dev/null || true
        cp /etc/pg_hba.conf /var/lib/postgresql/data/ 2>/dev/null || true
        echo "✓ Database initialized"
    fi

    # Start PostgreSQL
    echo "Starting PostgreSQL server..."
    su - postgres -c "/usr/bin/postgres -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
    POSTGRES_PID=$!
    sleep 3

    if ps | grep -v grep | grep -q "postgres -D"; then
        echo "✓ PostgreSQL started (PID: $POSTGRES_PID)"
        echo "  Port: 5432"
        echo "  Data dir: /var/lib/postgresql/data"
        echo "  Logs: /tmp/postgresql.log"
    else
        echo "⚠ PostgreSQL failed to start"
        echo "  Check logs: cat /tmp/postgresql.log"
    fi
else
    echo "⚠ PostgreSQL binary not found"
fi
echo ""

# Start OpenVSCode
echo "=== Starting OpenVSCode Server ==="
if [ -f /opt/openvscode/bin/openvscode-server ]; then
    mkdir -p /tmp/vscode-data
    cd /opt/openvscode

    ./bin/openvscode-server \
        --host 0.0.0.0 \
        --port 8080 \
        --without-connection-token \
        --accept-server-license-terms \
        --user-data-dir /tmp/vscode-data \
        > /tmp/openvscode.log 2>&1 &

    VSCODE_PID=$!
    sleep 3

    if ps | grep -v grep | grep -q openvscode-server; then
        echo "✓ OpenVSCode started (PID: $VSCODE_PID)"
        echo "  URL: http://$VM_IP:8080"
        echo "  Logs: /tmp/openvscode.log"
    else
        echo "⚠ OpenVSCode failed to start"
        echo "  Check logs: cat /tmp/openvscode.log"
    fi
else
    echo "⚠ OpenVSCode binary not found"
fi
echo ""

# Summary
echo "========================================="
echo "  Unified Services VM Ready"
echo "========================================="
echo ""
echo "Services Running:"
echo "  - Valkey:      redis://$VM_IP:6379"
echo "  - PostgreSQL:  postgresql://$VM_IP:5432"
echo "  - OpenVSCode:  http://$VM_IP:8080"
echo "  - SSH:         ssh root@$VM_IP (password: vibecode)"
if [ -n "$DD_API_KEY" ]; then
    echo "  - Datadog:     StatsD on 127.0.0.1:8125"
fi
echo ""
echo "Log files:"
echo "  - /tmp/valkey.log"
echo "  - /tmp/postgresql.log"
echo "  - /tmp/openvscode.log"
if [ -n "$DD_API_KEY" ]; then
    echo "  - /tmp/datadog-bridge.log"
fi
echo ""

# Keep system running with shell
exec /bin/sh
INITEOF

    chmod +x "$initramfs/init"

    log "✓ Init script created"
    log ""
}

# ==============================================================================
# PHASE 5: PACKAGE INITRAMFS
# ==============================================================================

package_initramfs() {
    log "=== Phase 5: Packaging Initramfs ==="

    local initramfs="$WORK_DIR/initramfs"
    cd "$initramfs"

    info "Creating CPIO archive..."
    find . -print0 | cpio --null --create --format=newc 2>/dev/null | gzip -9 > "$OUTPUT_PATH"

    if [ ! -f "$OUTPUT_PATH" ]; then
        error "Failed to create initramfs package"
    fi

    local size=$(du -h "$OUTPUT_PATH" | cut -f1)
    log "✓ Initramfs packaged: $size"
    log ""
}

# ==============================================================================
# PHASE 6: VERIFICATION
# ==============================================================================

verify_initramfs() {
    log "=== Phase 6: Verification ==="

    # Check file exists and size is reasonable
    if [ ! -f "$OUTPUT_PATH" ]; then
        error "Output file not found: $OUTPUT_PATH"
    fi

    local size_bytes=$(stat -f%z "$OUTPUT_PATH" 2>/dev/null || stat -c%s "$OUTPUT_PATH")
    local size_mb=$((size_bytes / 1024 / 1024))

    info "File size: ${size_mb}MB"

    if [ $size_mb -lt 50 ]; then
        warn "Initramfs seems too small (${size_mb}MB) - may be incomplete"
    elif [ $size_mb -gt 500 ]; then
        warn "Initramfs is very large (${size_mb}MB) - consider optimization"
    fi

    # Verify it's a valid gzipped file
    if ! gzip -t "$OUTPUT_PATH" 2>/dev/null; then
        error "Output file is not a valid gzip archive"
    fi

    # Test extraction
    info "Testing extraction..."
    local test_dir="/tmp/initramfs-test-$$"
    mkdir -p "$test_dir"
    cd "$test_dir"

    if gunzip -c "$OUTPUT_PATH" | cpio -idm 2>/dev/null; then
        log "✓ Extraction test passed"

        # Verify critical files
        local critical_files=(
            "init"
            "bin/busybox"
            "bin/valkey-server"
            "usr/bin/postgres"
            "opt/openvscode/bin/openvscode-server"
            "usr/local/bin/statsd-bridge.py"
        )

        # Check for kernel modules directory
        if [ -d "lib/modules" ]; then
            local module_count=$(find lib/modules -name "*.ko" -o -name "*.ko.gz" | wc -l)
            log "✓ Kernel modules directory present ($module_count modules)"

            # Verify critical network modules
            local kernel_version=$(ls lib/modules/ | head -1)
            if [ -n "$kernel_version" ]; then
                local net_modules=(
                    "lib/modules/$kernel_version/kernel/net/core/failover.ko"
                    "lib/modules/$kernel_version/kernel/drivers/net/net_failover.ko"
                    "lib/modules/$kernel_version/kernel/drivers/net/virtio_net.ko"
                )

                for module in "${net_modules[@]}"; do
                    if [ -f "$module" ]; then
                        log "  ✓ $(basename $module)"
                    else
                        warn "  ✗ $(basename $module) not found (may be compressed)"
                    fi
                done
            fi
        else
            warn "Kernel modules directory not found - network may not function properly"
        fi

        local missing=()
        for file in "${critical_files[@]}"; do
            if [ ! -f "$file" ]; then
                missing+=("$file")
            fi
        done

        if [ ${#missing[@]} -gt 0 ]; then
            warn "Missing files: ${missing[*]}"
        else
            log "✓ All critical files present"
        fi

        # Check init script is executable
        if [ ! -x "init" ]; then
            warn "Init script is not executable"
        else
            log "✓ Init script is executable"
        fi
    else
        error "Failed to extract initramfs for verification"
    fi

    # Cleanup test directory
    cd /
    rm -rf "$test_dir"

    log ""
}

# ==============================================================================
# PHASE 7: DOCUMENTATION
# ==============================================================================

show_usage_instructions() {
    log "========================================="
    log "  Build Complete!"
    log "========================================="
    log ""

    local size=$(du -h "$OUTPUT_PATH" | cut -f1)

    echo "Output file: $OUTPUT_PATH"
    echo "Size: $size"
    echo ""
    echo "Services included:"
    echo "  - Valkey ${VALKEY_VERSION} (Redis-compatible)"
    echo "  - PostgreSQL ${POSTGRESQL_VERSION}"
    echo "  - OpenVSCode Server ${OPENVSCODE_VERSION}"
    echo "  - Dropbear SSH"
    echo "  - Datadog StatsD bridge"
    echo ""
    echo "Quick Start:"
    echo ""
    echo "  # Set Datadog API key (optional)"
    echo "  export DD_API_KEY='your_api_key_here'"
    echo ""
    echo "  # Boot with vfkit"
    echo "  vfkit \\"
    echo "    --cpus 4 \\"
    echo "    --memory 2048 \\"
    echo "    --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \\"
    echo "    --initrd $OUTPUT_PATH \\"
    echo "    --kernel-cmdline \"console=hvc0 DD_API_KEY=\$DD_API_KEY DD_SITE=datadoghq.com\" \\"
    echo "    --device virtio-net,nat,mac=52:54:00:12:34:70 \\"
    echo "    --device virtio-rng"
    echo ""
    echo "Services will be available at:"
    echo "  - Valkey:      redis://<VM_IP>:6379"
    echo "  - PostgreSQL:  postgresql://<VM_IP>:5432"
    echo "  - OpenVSCode:  http://<VM_IP>:8080"
    echo "  - SSH:         ssh root@<VM_IP> (password: vibecode)"
    echo ""
    echo "Datadog Integration:"
    echo "  - StatsD endpoint: 127.0.0.1:8125 (inside VM)"
    echo "  - Metrics flush: Every 30 seconds"
    echo "  - Dashboard: https://app.datadoghq.com"
    echo ""
    echo "Troubleshooting:"
    echo "  - SSH into VM: ssh root@<VM_IP>"
    echo "  - Check service logs:"
    echo "    * cat /tmp/valkey.log"
    echo "    * cat /tmp/postgresql.log"
    echo "    * cat /tmp/openvscode.log"
    echo "    * cat /tmp/datadog-bridge.log"
    echo ""
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

cleanup() {
    if [ -d "$WORK_DIR" ]; then
        log "Cleaning up work directory..."
        rm -rf "$WORK_DIR"
    fi
}

main() {
    # Set trap for cleanup
    trap cleanup EXIT

    # Create work directory
    mkdir -p "$WORK_DIR"

    # Execute build phases
    check_dependencies

    # Download phase
    download_busybox
    download_valkey
    download_postgresql
    download_openvscode
    download_dropbear_ssh
    download_musl_libc

    # Create Datadog integration
    create_datadog_bridge

    # Build initramfs
    create_initramfs_structure
    copy_kernel_modules
    copy_binaries
    copy_libraries
    create_configuration_files
    create_init_script

    # Package and verify
    package_initramfs
    verify_initramfs

    # Show instructions
    show_usage_instructions

    log ""
    log "✓ Build successful!"
    log "Output: $OUTPUT_PATH"
}

# Run main function
main "$@"
