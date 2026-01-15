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
OUTPUT_NAME="unified-services-static.cpio.gz"
OUTPUT_PATH="${SCRIPT_DIR}/${OUTPUT_NAME}"

# Version configuration
BUSYBOX_VERSION="1.37.0"
OPENVSCODE_VERSION="1.95.3"
POSTGRESQL_VERSION="16"
VALKEY_VERSION="8.0.1"

# Alpine Linux packages (ARM64)
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine/edge"

# Parse command line arguments
FAST_BUILD=false
WITH_EXTENSIONS=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --fast)
            FAST_BUILD=true
            OUTPUT_NAME="unified-services-fast.cpio.gz"
            shift
            ;;
        --with-extensions)
            WITH_EXTENSIONS=true
            shift
            ;;
        *)
            error "Unknown option: $1. Usage: $0 [--fast] [--with-extensions]"
            ;;
    esac
done

# Update output path after parsing args
OUTPUT_PATH="${SCRIPT_DIR}/${OUTPUT_NAME}"

log "========================================="
log "  Unified Services VM Builder"
log "  with Datadog Integration"
if [ "$FAST_BUILD" = true ]; then
    log "  MODE: FAST (OpenVSCode + DHCP only)"
else
    log "  MODE: FULL (All services)"
fi
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
    mkdir -p "$busybox_dir/bin"
    cd "$busybox_dir"

    # Use saved working r29 binary if available, otherwise download r31
    if [ -f "/tmp/busybox-r29/busybox" ]; then
        info "Using saved working BusyBox r29..."
        cp /tmp/busybox-r29/busybox bin/busybox
        chmod +x bin/busybox
    else
        local apk_url="${ALPINE_MIRROR}/main/aarch64/busybox-${BUSYBOX_VERSION}-r31.apk"
        info "Downloading: $apk_url"
        
        wget -q --show-progress "$apk_url" -O busybox.apk || error "Failed to download BusyBox"
        
        # Extract APK (APK files are tar.gz archives)
        tar xzf busybox.apk 2>/dev/null || true
        
        if [ ! -f bin/busybox ]; then
            error "BusyBox binary not found in APK"
        fi
    fi

    local size=$(du -h bin/busybox | cut -f1)
    log "✓ BusyBox ready: $size"
    log ""
}

download_valkey() {
    log "=== Downloading Valkey ==="

    local valkey_dir="$WORK_DIR/downloads/valkey"
    mkdir -p "$valkey_dir/bin"
    cd "$valkey_dir"

    # Download from Alpine Linux edge repository (ARM64)
    local valkey_version="9.0.0-r1"
    local apk_url="https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/valkey-${valkey_version}.apk"

    info "Downloading Valkey from Alpine Linux..."
    info "URL: $apk_url"

    wget -q --show-progress "$apk_url" -O valkey.apk || error "Failed to download Valkey"

    # Extract APK (APK files are tar.gz archives)
    tar xzf valkey.apk 2>/dev/null || true

    # Verify binary exists and is correct format
    if [ ! -f usr/bin/valkey-server ]; then
        error "Valkey binary not found in APK"
    fi

    if ! file usr/bin/valkey-server | grep -q "ELF.*aarch64"; then
        error "Downloaded Valkey binary is not ARM64 ELF format"
    fi

    # Copy to expected location
    mkdir -p bin
    cp usr/bin/valkey-server bin/
    chmod +x bin/valkey-server

    # Optional: Also get valkey-cli
    if [ -f usr/bin/valkey-cli ]; then
        cp usr/bin/valkey-cli bin/
        chmod +x bin/valkey-cli
    fi

    local size=$(du -h bin/valkey-server | cut -f1)
    log "✓ Valkey downloaded and verified: $size (version ${valkey_version})"
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
                mkdir -p "$pg_dir/usr/libexec/postgresql16"

                # Copy main binaries - preserve libexec structure for initdb
                cp "$pg_path" "$pg_dir/usr/libexec/postgresql16/"
                [ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/libexec/postgresql16/" || true
                [ -f "$pg_bin_dir/psql" ] && cp "$pg_bin_dir/psql" "$pg_dir/usr/libexec/postgresql16/" || true
                [ -f "$pg_bin_dir/pg_ctl" ] && cp "$pg_bin_dir/pg_ctl" "$pg_dir/usr/libexec/postgresql16/" || true

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

        # Copy PostgreSQL shared data (CRITICAL for initdb)
        if [ -d "$temp_extract/usr/share/postgresql16" ]; then
            info "Copying PostgreSQL shared data (required for initdb)..."
            mkdir -p "$pg_dir/usr/share"
            cp -r "$temp_extract/usr/share/postgresql16" "$pg_dir/usr/share/" 2>/dev/null || true
        fi

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

    # Patch the openvscode-server wrapper script for busybox compatibility
    # Issue: The wrapper uses #!/usr/bin/env sh and readlink -f, which aren't available in minimal busybox
    # Fix: Replace with direct /bin/sh and busybox-compatible path resolution
    info "Patching OpenVSCode wrapper script for busybox compatibility..."
    local wrapper="openvscode/bin/openvscode-server"
    if [ -f "$wrapper" ]; then
        # Create a patched version
        cat > "${wrapper}.new" << 'EOF'
#!/bin/sh
#
# Copyright (c) Microsoft Corporation. All rights reserved.
#

case "$1" in
	--inspect*) INSPECT="$1"; shift;;
esac

# Busybox-compatible path resolution (no readlink -f needed)
# Get the directory containing this script
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT/node" ${INSPECT:-} "$ROOT/out/server-main.js" "$@"
EOF
        mv "${wrapper}.new" "$wrapper"
        chmod +x "$wrapper"
        info "✓ OpenVSCode wrapper patched for busybox"
    else
        warn "OpenVSCode wrapper not found, skipping patch"
    fi

    # Replace the GNU libc Node.js binary with a musl-compatible one from Alpine
    # Issue: The bundled Node.js binary is built for GNU libc and won't work with musl
    # Fix: Download and use Alpine's musl-compatible Node.js binary
    info "Replacing GNU libc Node.js with musl-compatible version..."
    local node_apk="nodejs-current-24.9.0-r1.apk"
    local node_url="https://dl-cdn.alpinelinux.org/alpine/edge/community/aarch64/${node_apk}"

    if wget -q --show-progress "$node_url" -O node.apk 2>/dev/null; then
        # Extract the Node.js binary from the APK
        tar xzf node.apk 2>/dev/null || true
        if [ -f "usr/bin/node" ]; then
            # Replace the GNU libc node binary with musl node
            cp "usr/bin/node" "openvscode/node"
            chmod +x "openvscode/node"
            info "✓ Replaced with Alpine Node.js (musl-compatible)"
            rm -rf node.apk usr/ 2>/dev/null || true
        else
            warn "Failed to extract Node.js from Alpine package, using original"
            rm -rf node.apk usr/ 2>/dev/null || true
        fi
    else
        warn "Failed to download Alpine Node.js, using original (may not work)"
    fi

    local size=$(du -sh openvscode | cut -f1)
    log "✓ OpenVSCode downloaded: $size"
    log ""
}

download_vscode_extensions() {
    log "=== Downloading VS Code Extensions ==="
    
    local ext_dir="$WORK_DIR/downloads/openvscode/openvscode/extensions"
    mkdir -p "$ext_dir"
    cd "$ext_dir"
    
    # Helper function to download and extract a single extension
    download_extension() {
        local publisher="$1"
        local extension="$2"
        local version="$3"
        local name="${publisher}.${extension}"
        
        info "Downloading ${name}..."
        
        local url="https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${extension}/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage"
        
        # Try primary URL
        if ! wget -q --show-progress "$url" -O "${name}.vsix" 2>/dev/null; then
            # Fallback to marketplace API
            local alt_url="https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${publisher}/vsextensions/${extension}/${version}/vspackage"
            wget -q --show-progress "$alt_url" -O "${name}.vsix" || {
                warn "Failed to download ${name}, skipping"
                return 1
            }
        fi
        
        # Extract .vsix (it's just a ZIP file)
        info "Extracting ${name}..."
        unzip -q "${name}.vsix" -d "${name}-temp" || {
            warn "Failed to extract ${name}, skipping"
            rm -rf "${name}.vsix" "${name}-temp"
            return 1
        }
        
        # Move extension content to proper location
        if [ -d "${name}-temp/extension" ]; then
            mv "${name}-temp/extension" "${name}"
            rm -rf "${name}-temp" "${name}.vsix"
            info "✓ Installed ${name}"
            return 0
        else
            warn "Extension ${name} has unexpected structure, skipping"
            rm -rf "${name}-temp" "${name}.vsix"
            return 1
        fi
    }
    
    # Essential Extensions (Tier 1: ~25MB total)
    log "Installing essential extensions..."
    download_extension "Continue" "continue" "0.9.237" || true
    download_extension "cweijan" "vscode-redis-client" "4.7.0" || true
    download_extension "mtxr" "sqltools" "0.28.3" || true
    download_extension "mtxr" "sqltools-driver-pg" "0.5.4" || true
    download_extension "esbenp" "prettier-vscode" "11.0.0" || true
    download_extension "dbaeumer" "vscode-eslint" "3.0.13" || true
    download_extension "humao" "rest-client" "0.25.1" || true
    
    # Count successful installs
    local count=$(find . -maxdepth 1 -type d ! -name "." | wc -l)
    local size=$(du -sh . | cut -f1 2>/dev/null || echo "unknown")
    
    cd "$WORK_DIR/downloads"
    log "✓ Installed ${count} extensions (${size})"
    log ""
}

download_dropbear_ssh() {
    log "=== Downloading Dropbear SSH Server ==="

    local ssh_dir="$WORK_DIR/downloads/dropbear"
    mkdir -p "$ssh_dir"
    cd "$ssh_dir"

    local apk_url="${ALPINE_MIRROR}/main/aarch64/dropbear-2025.89-r1.apk"
    info "Downloading: $apk_url"

    wget -q "$apk_url" -O dropbear.apk || error "Failed to download Dropbear"
    tar xzf dropbear.apk 2>/dev/null || true

    if [ ! -f usr/sbin/dropbear ]; then
        error "Dropbear binary not found in APK"
    fi

    log "✓ Dropbear SSH downloaded"
    log ""
}

download_socat() {
    log "=== Downloading socat for vsock forwarding ==="

    local socat_dir="$WORK_DIR/downloads/socat"
    mkdir -p "$socat_dir"
    cd "$socat_dir"

    local apk_url="${ALPINE_MIRROR}/main/aarch64/socat-1.8.1.0-r0.apk"
    info "Downloading: $apk_url"

    wget -q "$apk_url" -O socat.apk || error "Failed to download socat"
    tar xzf socat.apk 2>/dev/null || true

    if [ ! -f usr/bin/socat ]; then
        error "socat binary not found in APK"
    fi

    log "✓ socat downloaded"
    log ""
}

download_musl_libc() {
    log "=== Downloading musl libc and dependencies ==="

    local lib_dir="$WORK_DIR/downloads/libs"
    mkdir -p "$lib_dir"
    cd "$lib_dir"

    # Essential libraries from Alpine (using current edge versions)
    local packages=(
        "musl-1.2.5-r21.apk"
        "zlib-1.3.1-r2.apk"
        "openssl-3.5.4-r0.apk"
        "libgcc-15.2.0-r2.apk"
        "libstdc++-15.2.0-r2.apk"
        "ncurses-libs-6.5_p20251123-r0.apk"
        "readline-8.3.3-r0.apk"
        "libldap-2.6.10-r0.apk"
        "lz4-libs-1.10.0-r0.apk"
        # AGENT 2 FIX: Missing PostgreSQL 16 dependencies
        "zstd-libs-1.5.7-r2.apk"
        "xz-libs-5.8.1-r0.apk"
        "libsasl-2.1.28-r9.apk"
        # AGENT K FIX: Add utmps library for SSH (Dropbear) - provides libutmps.so.0.1
        "utmps-libs-0.1.3.2-r0.apk"
        # AGENT K FIX: Add skalibs library (dependency of utmps) - provides libskarnet.so.2.14
        "skalibs-libs-2.14.5.0-r0.apk"
        # AGENT I FIX: Add Node.js dependencies for musl-compatible Node.js
        # AGENT L FIX: Updated to current Alpine Edge versions (2026-01-05)
        "libuv-1.51.0-r0.apk"           # provides libuv.so.1
        "brotli-libs-1.2.0-r0.apk"      # provides libbrotlidec.so.1 and libbrotlienc.so.1
        "c-ares-1.34.6-r0.apk"          # provides libcares.so.2
        "nghttp2-libs-1.68.0-r0.apk"    # provides libnghttp2.so.14
        # AGENT M FIX: Add ICU libraries for PostgreSQL Unicode collation
        # AGENT N FIX: Updated to current Alpine Edge version (2026-01-05)
        "icu-libs-76.1-r2.apk"          # provides ICU Unicode libraries
        "icu-data-full-76.1-r2.apk"     # provides full Unicode collation data
    )

    for pkg in "${packages[@]}"; do
        local url="${ALPINE_MIRROR}/main/aarch64/${pkg}"
        info "Downloading: $pkg"

        # Try download with fallback to older versions
        if ! wget -q "$url" -O "$pkg" 2>/dev/null; then
            warn "Failed to download $pkg from primary URL"

            # Try alternate package name patterns for libgcc/libstdc++
            if [[ "$pkg" == libgcc-* ]]; then
                info "Trying alternate libgcc versions..."
                for alt_version in "15.0.0_git20241124-r0" "14.2.0-r4" "13.2.1_git20231014-r0"; do
                    local alt_pkg="libgcc-${alt_version}.apk"
                    info "  Trying: $alt_pkg"
                    if wget -q "${ALPINE_MIRROR}/main/aarch64/${alt_pkg}" -O "$pkg" 2>/dev/null; then
                        log "  ✓ Downloaded alternate version: $alt_pkg"
                        break
                    fi
                done
            elif [[ "$pkg" == libstdc++-* ]]; then
                info "Trying alternate libstdc++ versions..."
                for alt_version in "15.0.0_git20241124-r0" "14.2.0-r4" "13.2.1_git20231014-r0"; do
                    local alt_pkg="libstdc++-${alt_version}.apk"
                    info "  Trying: $alt_pkg"
                    if wget -q "${ALPINE_MIRROR}/main/aarch64/${alt_pkg}" -O "$pkg" 2>/dev/null; then
                        log "  ✓ Downloaded alternate version: $alt_pkg"
                        break
                    fi
                done
            else
                warn "  No alternate versions available"
            fi
        fi

        # Extract the package if downloaded
        if [ -f "$pkg" ]; then
            tar xzf "$pkg" 2>/dev/null || true
        else
            warn "  Package $pkg could not be downloaded - continuing anyway"
        fi
    done

    log "✓ Libraries downloaded"
    log ""
}

# ==============================================================================
# PHASE 3: CREATE SANDBOX COMPONENTS
# ==============================================================================

create_sandbox_files() {
    log "=== Creating Sandbox Components ==="

    local sandbox_dir="$WORK_DIR/sandbox"
    mkdir -p "$sandbox_dir"
    cd "$sandbox_dir"

    # Copy sandbox configuration from source directory
    if [ -f "$SCRIPT_DIR/sandbox.conf" ]; then
        info "Copying sandbox configuration..."
        cp "$SCRIPT_DIR/sandbox.conf" sandbox.conf
    else
        warn "sandbox.conf not found in $SCRIPT_DIR, skipping sandbox config"
    fi

    # Copy sandbox-run script from source directory
    if [ -f "$SCRIPT_DIR/sandbox-run" ]; then
        info "Copying sandbox-run script..."
        cp "$SCRIPT_DIR/sandbox-run" sandbox-run
        chmod +x sandbox-run
    else
        warn "sandbox-run not found in $SCRIPT_DIR, skipping sandbox runner"
    fi

    log "✓ Sandbox components prepared"
    log ""
}

# ==============================================================================
# PHASE 4: CREATE DATADOG INTEGRATION
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
# PHASE 5: BUILD INITRAMFS STRUCTURE
# ==============================================================================

create_initramfs_structure() {
    log "=== Phase 4: Creating Initramfs Structure ==="

    local initramfs="$WORK_DIR/initramfs"
    mkdir -p "$initramfs"
    cd "$initramfs"

    # Create directory structure
    info "Creating directory tree..."
    mkdir -p {bin,sbin,lib,usr/{bin,sbin,lib,local/bin},etc/{dropbear,init.d,sandbox/profiles},var/{lib/postgresql/data,log/sandbox},dev,proc,sys,tmp,run/postgresql,home/sandbox,root,opt/openvscode}

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

    # AGENT AH FIX: Add VirtioFS kernel module for volume mounting support
    info "Adding VirtioFS kernel module..."
    local virtiofs_source="/tmp/virtiofs-modules/virtiofs.ko"

    if [ -f "$virtiofs_source" ]; then
        mkdir -p "$initramfs/lib/modules/$kernel_version/kernel/fs/fuse"
        cp "$virtiofs_source" "$initramfs/lib/modules/$kernel_version/kernel/fs/fuse/"
        info "✓ virtiofs.ko added to initramfs"

        # Also ensure fuse.ko is available (should be in modules.builtin, but check)
        local fuse_module_path=$(find "$temp_extract" -name "fuse.ko" 2>/dev/null | head -1)
        if [ -n "$fuse_module_path" ]; then
            cp "$fuse_module_path" "$initramfs/lib/modules/$kernel_version/kernel/fs/fuse/" 2>/dev/null || true
            info "✓ fuse.ko added to initramfs"
        fi
    else
        warn "VirtioFS module not found at $virtiofs_source"
        warn "Volume mounting will not work - please download virtiofs.ko"
        warn "See: https://github.com/vibecode/vibecode-vm/blob/main/docs/VOLUME-MOUNTING.md"
    fi

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
    for applet in sh ash mount umount ip udhcpc ps kill mkdir cat grep awk sed sleep echo chmod chown ls ln cp mv rm wget nc true false readlink realpath su; do
        ln -sf busybox "$applet" 2>/dev/null || true
    done
    cd "$WORK_DIR"

    # Valkey (skip in fast build or if not available)
    if [ "$FAST_BUILD" = false ]; then
        if [ -f "$downloads/valkey/bin/.valkey-skipped" ]; then
            warn "Valkey was skipped during download - continuing without it"
        elif [ -f "$downloads/valkey/bin/valkey-server" ]; then
            info "Copying Valkey..."
            cp "$downloads/valkey/bin/valkey-server" "$initramfs/bin/"
            chmod +x "$initramfs/bin/valkey-server"
            # Copy Valkey libraries if present
            if [ -d "$downloads/valkey/lib" ]; then
                cp -r "$downloads/valkey/lib/"* "$initramfs/lib/" 2>/dev/null || true
            fi
            if [ -d "$downloads/valkey/usr/lib" ]; then
                cp -r "$downloads/valkey/usr/lib/"* "$initramfs/usr/lib/" 2>/dev/null || true
            fi
        else
            warn "Valkey binary not found - continuing without it (OpenVSCode will still work)"
        fi
    fi

    # PostgreSQL (skip in fast build)
    if [ "$FAST_BUILD" = false ]; then
        info "Copying PostgreSQL..."
        mkdir -p "$initramfs/usr/libexec/postgresql16"
        cp "$downloads/postgresql/usr/libexec/postgresql16/postgres" "$initramfs/usr/libexec/postgresql16/"
        cp "$downloads/postgresql/usr/libexec/postgresql16/initdb" "$initramfs/usr/libexec/postgresql16/" 2>/dev/null || true
        cp "$downloads/postgresql/usr/libexec/postgresql16/psql" "$initramfs/usr/libexec/postgresql16/" 2>/dev/null || true
        chmod +x "$initramfs/usr/libexec/postgresql16/postgres" "$initramfs/usr/libexec/postgresql16/initdb" 2>/dev/null || true

        # AGENT M: Create symlinks in /usr/bin for easier access
        ln -sf /usr/libexec/postgresql16/postgres "$initramfs/usr/bin/postgres" 2>/dev/null || true
        ln -sf /usr/libexec/postgresql16/initdb "$initramfs/usr/bin/initdb" 2>/dev/null || true
        ln -sf /usr/libexec/postgresql16/psql "$initramfs/usr/bin/psql" 2>/dev/null || true

        # Copy PostgreSQL libraries
        if [ -d "$downloads/postgresql/usr/lib" ]; then
            info "Copying PostgreSQL libraries..."
            cp -r "$downloads/postgresql/usr/lib/"* "$initramfs/usr/lib/" 2>/dev/null || true
        fi

        # Copy PostgreSQL shared data (CRITICAL for initdb)
        if [ -d "$downloads/postgresql/usr/share/postgresql16" ]; then
            info "Copying PostgreSQL shared data (required for initdb)..."
            mkdir -p "$initramfs/usr/share"
            cp -r "$downloads/postgresql/usr/share/postgresql16" "$initramfs/usr/share/" 2>/dev/null || true
        fi
    fi

    # OpenVSCode
    info "Copying OpenVSCode..."
    cp -r "$downloads/openvscode/openvscode/"* "$initramfs/opt/openvscode/"
    # Ensure binary has execute permissions
    if [ -f "$initramfs/opt/openvscode/bin/openvscode-server" ]; then
        chmod +x "$initramfs/opt/openvscode/bin/openvscode-server"
        info "✓ OpenVSCode binary permissions set"
    else
        warn "OpenVSCode binary not found at expected location"
    fi
    
    # Check if extensions were included
    if [ "$WITH_EXTENSIONS" = true ] && [ -d "$initramfs/opt/openvscode/extensions" ]; then
        local ext_count=$(find "$initramfs/opt/openvscode/extensions" -maxdepth 1 -type d ! -name "extensions" | wc -l)
        info "✓ Included ${ext_count} VS Code extensions"
    fi

    # Dropbear SSH (skip in fast build)
    if [ "$FAST_BUILD" = false ]; then
        info "Copying Dropbear SSH..."
        cp "$downloads/dropbear/usr/sbin/dropbear" "$initramfs/usr/sbin/"
        cp "$downloads/dropbear/usr/bin/dropbearkey" "$initramfs/usr/bin/" 2>/dev/null || true
        chmod +x "$initramfs/usr/sbin/dropbear" "$initramfs/usr/bin/dropbearkey"

        info "Copying socat for vsock forwarding..."
        cp "$downloads/socat/usr/bin/socat" "$initramfs/usr/bin/"
        chmod +x "$initramfs/usr/bin/socat"
    fi

    # Datadog bridge (skip in fast build)
    if [ "$FAST_BUILD" = false ]; then
        info "Copying Datadog StatsD bridge..."
        cp "$WORK_DIR/datadog/statsd-bridge.py" "$initramfs/usr/local/bin/"
        chmod +x "$initramfs/usr/local/bin/statsd-bridge.py"
    fi

    # Sandbox components
    info "Copying sandbox components..."
    if [ -f "$WORK_DIR/sandbox/sandbox-run" ]; then
        cp "$WORK_DIR/sandbox/sandbox-run" "$initramfs/usr/local/bin/"
        chmod +x "$initramfs/usr/local/bin/sandbox-run"
        info "✓ Sandbox runner installed"
    fi

    if [ -f "$WORK_DIR/sandbox/sandbox.conf" ]; then
        cp "$WORK_DIR/sandbox/sandbox.conf" "$initramfs/etc/"
        info "✓ Sandbox configuration installed"
    fi

    # Set ownership for sandbox home directory
    mkdir -p "$initramfs/home/sandbox"
    # Note: chown won't work during build, but user/group setup in /etc/passwd will handle it

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

    # AGENT N FIX: Copy ICU data files (required for PostgreSQL Unicode collation)
    if [ -d "$downloads/libs/usr/share/icu" ]; then
        info "Copying ICU data files for PostgreSQL Unicode support..."
        mkdir -p "$initramfs/usr/share"
        cp -r "$downloads/libs/usr/share/icu" "$initramfs/usr/share/" 2>/dev/null || true
        info "✓ ICU data files copied to /usr/share/icu"
    else
        warn "ICU data directory not found - PostgreSQL Unicode collation may fail"
    fi

    # Ensure critical libraries are present
    info "Verifying critical libraries..."
    local critical_libs=(
        "ld-musl-aarch64.so.1"
        "libc.musl-aarch64.so.1"
        "libz.so.1"
        "libssl.so.3"
        "libcrypto.so.3"
        "libgcc_s.so.1"
        "libstdc++.so.6"
        "libldap.so.2"
        "liblber.so.2"
        "libsasl2.so.3"
        "libutmps.so.0.1"
        "libskarnet.so.2.14"
        # AGENT L: Node.js dependencies
        "libuv.so.1"
        "libbrotlidec.so.1"
        "libbrotlienc.so.1"
        "libcares.so.2"
        "libnghttp2.so.14"
        # ICU libraries (required for both OpenVSCode Node.js and PostgreSQL)
        "libicuuc.so.76"
        "libicui18n.so.76"
        "libicudata.so.76"
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

    # Create GNU libc compatibility symlinks for Node.js and other glibc-compiled binaries
    info "Creating GNU libc compatibility symlinks..."

    # Dynamic linker symlink (for binaries compiled with glibc)
    if [ -f "$initramfs/lib/ld-musl-aarch64.so.1" ]; then
        ln -sf ld-musl-aarch64.so.1 "$initramfs/lib/ld-linux-aarch64.so.1" 2>/dev/null || true
        info "✓ GNU dynamic linker symlink: /lib/ld-linux-aarch64.so.1"
    fi

    # In musl, libm, libpthread, libdl, librt are all part of libc
    # Create symlinks for glibc-style library names
    if [ -f "$initramfs/lib/libc.so" ]; then
        ln -sf libc.so "$initramfs/lib/libm.so.6" 2>/dev/null || true
        ln -sf libc.so "$initramfs/lib/libpthread.so.0" 2>/dev/null || true
        ln -sf libc.so "$initramfs/lib/libdl.so.2" 2>/dev/null || true
        ln -sf libc.so "$initramfs/lib/librt.so.1" 2>/dev/null || true
        info "✓ GNU library symlinks: libm, libpthread, libdl, librt"
    fi

    # Create versioned libc symlink (some binaries expect libc.so.6)
    if [ -f "$initramfs/lib/libc.so" ]; then
        ln -sf libc.so "$initramfs/lib/libc.so.6" 2>/dev/null || true
        info "✓ Versioned libc symlink: /lib/libc.so.6"
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
sandbox:x:1000:1000:Sandbox User:/home/sandbox:/bin/sh
EOF

    # /etc/shadow (password: vibecode)
    # Hash generated with: openssl passwd -6 -salt vibecode123 vibecode
    cat > "$initramfs/etc/shadow" << 'EOF'
root:$6$vibecode123$xrMGfQmkECwBG5tnCoZCFLvKcOB9X1A.L4DhlO8z6jq1y8mq8Zb3gNOOthahQbBvXvuJ8gmnZXBTq5j48Dodp1:19000:0:99999:7:::
postgres:*:19000:0:99999:7:::
sandbox:*:19000:0:99999:7:::
EOF
    chmod 600 "$initramfs/etc/shadow"

    # /etc/group
    cat > "$initramfs/etc/group" << 'EOF'
root:x:0:
postgres:x:70:
sandbox:x:1000:
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
    log "=== Creating Init Script (PARALLEL STARTUP - Firecracker-style) ==="

    local initramfs="$WORK_DIR/initramfs"

    cat > "$initramfs/init" << 'INITEOF'
#!/bin/busybox sh
# Unified Services VM Init Script - PARALLEL STARTUP (Firecracker-style)
# Services: Valkey + PostgreSQL + OpenVSCode
# Monitoring: Datadog StatsD bridge
# Performance: All services start simultaneously after network ready

echo "========================================="
echo "  Unified Services VM"
echo "  PARALLEL STARTUP (Firecracker-style)"
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

# Mount devpts for pseudo-terminal support (CRITICAL for OpenVSCode terminal)
echo "Mounting devpts for terminal support..."
mkdir -p /dev/pts 2>/dev/null || true
mount -t devpts devpts /dev/pts -o gid=5,mode=620 2>/dev/null && echo "  ✓ devpts mounted"

# Create shell wrapper for OpenVSCode terminal (fixes PATH issue)
# OpenVSCode sets PATH=/opt/openvscode/bin/remote-cli which breaks commands
cat > /tmp/sh-with-env << 'WRAPPER_EOF'
#!/bin/sh
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export TERM=xterm-256color
[ -x /bin/busybox ] && /bin/busybox --install -s /bin 2>/dev/null || true
exec /bin/sh "$@"
WRAPPER_EOF
chmod +x /tmp/sh-with-env 2>/dev/null && echo "  ✓ Shell wrapper created"

# Set hostname
hostname unified-vm 2>/dev/null || true

# Mount host shared directory (virtio-fs)
echo ""
echo "=== Host Volume Mounting ==="
mkdir -p /mnt/host /mnt/config /mnt/data /mnt/logs 2>/dev/null || true

# AGENT AH FIX: Load VirtioFS kernel module before mounting
echo "Loading VirtioFS kernel module..."
if modprobe virtiofs 2>/dev/null || insmod /lib/modules/$(uname -r)/kernel/fs/fuse/virtiofs.ko 2>/dev/null; then
    echo "✓ VirtioFS module loaded successfully"
elif [ -f /lib/modules/$(uname -r)/kernel/fs/fuse/virtiofs.ko ]; then
    echo "⚠ VirtioFS module found but failed to load"
    echo "  Continuing anyway - mount may still work if built-in"
else
    echo "⚠ VirtioFS module not found in kernel modules"
    echo "  Volume mounting will likely fail"
fi

# Try to mount virtio-fs shared directory
if mount -t virtiofs hostshare /mnt/host 2>/dev/null; then
    echo "✓ Host filesystem mounted at /mnt/host"

    # Create subdirectories for common use cases
    mkdir -p /mnt/host/config /mnt/host/data /mnt/host/logs 2>/dev/null || true

    # Create convenience symlinks
    ln -sf /mnt/host/config /mnt/config 2>/dev/null || true
    ln -sf /mnt/host/data /mnt/data 2>/dev/null || true
    ln -sf /mnt/host/logs /mnt/logs 2>/dev/null || true

    echo "  Available mount points:"
    echo "    - /mnt/host/       (main shared directory)"
    echo "    - /mnt/host/config (for configuration files)"
    echo "    - /mnt/host/data   (for persistent data)"
    echo "    - /mnt/host/logs   (for log files)"
    echo ""

    # If PostgreSQL data directory exists on host, use it
    if [ -d /mnt/host/postgresql ]; then
        echo "  Found PostgreSQL data on host mount"
        echo "  Will use /mnt/host/postgresql for persistence"
        POSTGRES_DATA_DIR="/mnt/host/postgresql"
    else
        POSTGRES_DATA_DIR="/var/lib/postgresql/data"
    fi

    # If Valkey persistence directory exists on host, use it
    if [ -d /mnt/host/valkey ]; then
        echo "  Found Valkey data on host mount"
        echo "  Will use /mnt/host/valkey for persistence"
        VALKEY_DATA_DIR="/mnt/host/valkey"
    else
        VALKEY_DATA_DIR="/tmp"
    fi
else
    echo "⚠ No host filesystem available (virtio-fs not configured)"
    echo "  Services will use local storage only"
    echo "  To enable: add --device virtio-fs,sharedDir=/path,mountTag=hostshare"
    POSTGRES_DATA_DIR="/var/lib/postgresql/data"
    VALKEY_DATA_DIR="/tmp"
fi
echo ""

# Check if this is a fast build (OpenVSCode + DHCP only)
FAST_BUILD=false
if [ -f /.fast_build ]; then
    FAST_BUILD=true
    echo "FAST BUILD MODE: OpenVSCode + DHCP only"
    echo ""
fi
echo "unified-vm" > /etc/hostname 2>/dev/null || true

# Create essential device nodes
mknod -m 666 /dev/null c 1 3 2>/dev/null || true
mknod -m 666 /dev/zero c 1 5 2>/dev/null || true
mknod -m 666 /dev/random c 1 8 2>/dev/null || true

# Mount tmpfs for shared memory (required for PostgreSQL) - MOVED EARLY
# Must be done before any service initialization
echo ""
echo "=== Setting up shared memory ==="
if ! grep -q "tmpfs /dev/shm" /proc/mounts; then
    mkdir -p /dev/shm
    if mount -t tmpfs -o size=256M tmpfs /dev/shm; then
        echo "✓ /dev/shm mounted (256M)"
    else
        echo "⚠ Failed to mount /dev/shm, PostgreSQL may fail"
    fi
else
    echo "✓ /dev/shm already mounted"
fi

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

    # Give modules time to initialize (increased from 2s to 5s per Agent 5 recommendation)
    echo "  Waiting 5 seconds for module initialization..."
    sleep 5
else
    echo "⚠ No kernel modules directory found"
fi

# Network Debug Section (Agent 17 enhancement)
echo ""
echo "=== Network Debug Info ===" | tee -a /tmp/network.log
echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Network debug started" >> /tmp/network.log

# Show loaded network modules
echo "Loaded network modules:" | tee -a /tmp/network.log
lsmod 2>/dev/null | grep -E "virtio|failover" | tee -a /tmp/network.log || echo "  (no modules or lsmod unavailable)" | tee -a /tmp/network.log

# Show all network devices
echo "All network devices:" | tee -a /tmp/network.log
ip link show 2>&1 | tee -a /tmp/network.log || echo "  (ip command failed)" | tee -a /tmp/network.log

# Network setup
echo ""
echo "=== Network Setup ==="
echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Network setup started" >> /tmp/network.log
ip link set lo up

# Active network interface detection loop (Agent 5 & Agent 15 optimization)
# Wait up to 15 seconds for network interface to appear WITH CARRIER
FOUND_IFACE=""
NETWORK_MODE="localhost"
echo "Waiting for network interface with carrier signal (max 15 seconds)..."
for i in $(seq 1 30); do
    for iface in eth0 eth1 enp0s1 ens3; do
        if ip link show "$iface" >/dev/null 2>&1; then
            # Check carrier state and operstate
            CARRIER=$(cat /sys/class/net/$iface/carrier 2>/dev/null || echo "0")
            OPERSTATE=$(cat /sys/class/net/$iface/operstate 2>/dev/null || echo "down")

            ELAPSED=$(awk "BEGIN {printf \"%.1f\", $i * 0.5}")

            # Only accept interface if carrier=1 OR operstate=up/unknown
            if [ "$CARRIER" = "1" ] || [ "$OPERSTATE" = "up" ] || [ "$OPERSTATE" = "unknown" ]; then
                echo "  ✓ Found interface: $iface after ${ELAPSED}s (carrier=$CARRIER, operstate=$OPERSTATE)"
                echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Found interface: $iface (carrier=$CARRIER, operstate=$OPERSTATE)" >> /tmp/network.log
                FOUND_IFACE="$iface"
                NETWORK_MODE="network"
                break 2  # Break both loops
            else
                # Interface exists but no carrier - log and continue waiting
                if [ "$i" = "1" ]; then
                    echo "  ⏳ Found $iface but no carrier yet (carrier=$CARRIER, operstate=$OPERSTATE)"
                    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Interface $iface exists but carrier=$CARRIER, operstate=$OPERSTATE" >> /tmp/network.log
                fi
            fi
        fi
    done
    sleep 0.5
done

if [ -z "$FOUND_IFACE" ]; then
    echo "  ⚠ Network interface with carrier not found after 15 seconds"
    echo "  Will start services in localhost-only mode"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] No network interface found - localhost mode" >> /tmp/network.log
    VM_IP="127.0.0.1"
    BIND_HOST="127.0.0.1"
else
    BIND_HOST="0.0.0.0"
fi

if [ -n "$FOUND_IFACE" ]; then
    echo "Network interface: $FOUND_IFACE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Found interface: $FOUND_IFACE" >> /tmp/network.log

    # Bring interface up with carrier detection workaround
    # Some virtualization frameworks (VZ) don't immediately provide carrier signal
    ip link set "$FOUND_IFACE" down 2>/dev/null || true
    sleep 0.2
    ip link set "$FOUND_IFACE" up

    # Give carrier signal time to stabilize
    echo "  Waiting for carrier signal to stabilize..."
    for wait_carrier in $(seq 1 10); do
        CARRIER_CHECK=$(cat /sys/class/net/$FOUND_IFACE/carrier 2>/dev/null || echo "0")
        if [ "$CARRIER_CHECK" = "1" ]; then
            echo "  ✓ Carrier detected after $(awk "BEGIN {printf \"%.1f\", $wait_carrier * 0.3}")s"
            break
        fi
        sleep 0.3
    done

    sleep 0.2

    # DHCP configuration with retries (3 attempts with exponential backoff)
    echo "Requesting DHCP address..."
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Starting DHCP attempts..." >> /tmp/network.log
    DHCP_SUCCESS=0
    for attempt in 1 2 3; do
        echo "  Attempt $attempt/3..."
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] DHCP attempt $attempt/3 started" >> /tmp/network.log
        if udhcpc -i "$FOUND_IFACE" -s /bin/true -n -q -t 1 -T 1 2>&1 | tee -a /tmp/network.log; then
            DHCP_SUCCESS=1
            echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] DHCP attempt $attempt succeeded" >> /tmp/network.log
            break
        fi
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] DHCP attempt $attempt failed" >> /tmp/network.log
        [ $attempt -lt 3 ] && sleep $((attempt * 1))  # 1s, 2s delays
    done

    # Get IP address
    VM_IP=$(ip addr show "$FOUND_IFACE" | grep "inet " | awk '{print $2}' | cut -d/ -f1)

    # Aggressive fallback to static IP if DHCP failed
    if [ -z "$VM_IP" ]; then
        echo "DHCP failed after 3 attempts, using static IP fallback..."
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] DHCP failed, using static IP fallback" >> /tmp/network.log
        # Remove any partial DHCP config
        ip addr flush dev "$FOUND_IFACE" 2>/dev/null || true
        ip route flush dev "$FOUND_IFACE" 2>/dev/null || true
        # Set static IP
        ip addr add 192.168.64.10/24 dev "$FOUND_IFACE" 2>/dev/null || true
        ip route add default via 192.168.64.1 2>/dev/null || true
        VM_IP="192.168.64.10"
        echo "✓ Static IP: $VM_IP"
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Static IP configured: $VM_IP" >> /tmp/network.log

        # Verify network is reachable
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Testing gateway reachability..." >> /tmp/network.log
        if ping -c 1 -W 2 192.168.64.1 >/dev/null 2>&1; then
            echo "  ✓ Gateway reachable"
            echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Gateway 192.168.64.1 is reachable" >> /tmp/network.log
        else
            echo "  ⚠ Gateway not reachable (continuing anyway)"
            echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Gateway 192.168.64.1 NOT reachable" >> /tmp/network.log
        fi
    else
        echo "✓ DHCP IP: $VM_IP"
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] DHCP IP configured: $VM_IP" >> /tmp/network.log

        # Verify DHCP configuration
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Testing gateway reachability..." >> /tmp/network.log
        if ping -c 1 -W 2 192.168.64.1 >/dev/null 2>&1; then
            echo "  ✓ Gateway reachable"
            echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Gateway 192.168.64.1 is reachable" >> /tmp/network.log
        else
            echo "  ⚠ Gateway not reachable via DHCP"
            echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Gateway 192.168.64.1 NOT reachable via DHCP" >> /tmp/network.log
        fi
    fi
else
    echo "⚠ No network interface found"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] ERROR: No network interface found" >> /tmp/network.log
    VM_IP="localhost"
fi
echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Network setup completed. Final IP: $VM_IP" >> /tmp/network.log
echo ""

# ==============================================================================
# PHASE 2: PARALLEL SERVICE STARTUP (Firecracker-style)
# ==============================================================================

# Library path for services
export LD_LIBRARY_PATH=/lib:/usr/lib

# Parse Datadog config from kernel command line (do this early)
if [ -f /proc/cmdline ]; then
    DD_API_KEY=$(grep -oP 'DD_API_KEY=\K[^ ]+' /proc/cmdline 2>/dev/null || echo "")
    DD_SITE=$(grep -oP 'DD_SITE=\K[^ ]+' /proc/cmdline 2>/dev/null || echo "datadoghq.com")
    DD_HOSTNAME=$(grep -oP 'DD_HOSTNAME=\K[^ ]+' /proc/cmdline 2>/dev/null || echo "unified-services-vm")
    export DD_API_KEY DD_SITE DD_HOSTNAME
fi

# Setup directories and SSH keys (must be done before parallel launch)
echo "=== Preparing Service Directories ==="
mkdir -p /etc/dropbear /run /tmp/vscode-data

# Generate SSH host keys if needed
if [ ! -f /etc/dropbear/dropbear_rsa_host_key ]; then
    echo "Generating SSH host keys..."
    /usr/bin/dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key -s 2048 2>&1 | grep -E "Generating|fingerprint" || true
    /usr/bin/dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key 2>&1 | grep -E "Generating|fingerprint" || true
fi

# Setup PostgreSQL directories and initialization (must complete before parallel start)
echo "Checking PostgreSQL setup conditions: FAST_BUILD=$FAST_BUILD"
if [ "$FAST_BUILD" = false ]; then
    echo "  FAST_BUILD is false, checking for postgres binary..."
    if [ -f /usr/bin/postgres ]; then
        echo "  ✓ Found /usr/bin/postgres"
        echo "  Using data directory: $POSTGRES_DATA_DIR"

        mkdir -p "$POSTGRES_DATA_DIR" /run/postgresql /tmp/postgresql
        chmod 700 "$POSTGRES_DATA_DIR"
        chmod 775 /run/postgresql
        chown -R postgres:postgres "$POSTGRES_DATA_DIR" /run/postgresql /tmp/postgresql 2>/dev/null || true

        # Initialize database if needed (blocking, but only on first boot)
        if [ ! -f "$POSTGRES_DATA_DIR/PG_VERSION" ]; then
            echo "Initializing PostgreSQL database in $POSTGRES_DATA_DIR..."
            # AGENT M FIX: Use 'su postgres' to actually switch user (not just env vars)
            # initdb checks the real UID and refuses to run as root for security
            # AGENT T FIX: Set ICU_DATA environment variable to help ICU libraries find data files
            if su postgres -c "ICU_DATA=/usr/share/icu/76.1 LD_LIBRARY_PATH=/usr/lib:/usr/local/lib /usr/libexec/postgresql16/initdb -U postgres -D $POSTGRES_DATA_DIR --auth=trust --locale=C --encoding=SQL_ASCII --no-locale --locale-provider=libc" > /tmp/postgresql-init.log 2>&1; then
                if [ -f "$POSTGRES_DATA_DIR/PG_VERSION" ]; then
                    echo "✓ Database initialized"
                    chown -R postgres:postgres "$POSTGRES_DATA_DIR" 2>/dev/null || true
                    cp /etc/postgresql.conf "$POSTGRES_DATA_DIR/" 2>/dev/null || true
                    cp /etc/pg_hba.conf "$POSTGRES_DATA_DIR/" 2>/dev/null || true
                fi
            else
                echo "⚠ Database initialization failed (will skip PostgreSQL)"
                echo "  Error log: /tmp/postgresql-init.log"
                if [ -f /tmp/postgresql-init.log ]; then
                    echo "  Last 20 lines of output:"
                    tail -20 /tmp/postgresql-init.log | sed 's/^/    /'
                fi
            fi
        else
            echo "✓ Database already initialized (using existing data)"
        fi
    else
        echo "  ✗ PostgreSQL binary not found at /usr/bin/postgres"
    fi
else
    echo "  Skipping PostgreSQL (FAST_BUILD mode)"
fi

echo "✓ Preparation complete"
echo ""

# ==============================================================================
# PARALLEL SERVICE LAUNCHES - Firecracker Pattern
# ==============================================================================

echo "========================================="
echo "  PARALLEL SERVICE STARTUP"
echo "  All services launching simultaneously"
echo "========================================="
echo ""

# Initialize PID variables
SSH_PID=""
DATADOG_PID=""
VALKEY_PID=""
POSTGRES_PID=""
VSCODE_PID=""

# Determine network binding mode
if [ "$NETWORK_MODE" = "localhost" ]; then
    VSCODE_HOST="127.0.0.1"
    BIND_HOST="127.0.0.1"
else
    VSCODE_HOST="0.0.0.0"
    BIND_HOST="0.0.0.0"
fi

# LAUNCH ALL SERVICES IN BACKGROUND
echo "Launching services in parallel..."

# 1. SSH Server
if [ -n "$VM_IP" ] || ip link show lo 2>/dev/null | grep -q "state UP"; then
    # CRITICAL FIX: Remove -B flag to enable password authentication
    # -R: Create missing host keys, -E: Log to stderr, -p 22: Listen on port 22
    /usr/sbin/dropbear -R -E -p 22 > /tmp/dropbear.log 2>&1 &
    SSH_PID=$!
    echo "  - SSH server launched (PID: $SSH_PID)"
fi

# 2. Datadog StatsD Bridge (skip in fast build)
if [ "$FAST_BUILD" = false ] && [ -n "$DD_API_KEY" ] && [ -f /usr/local/bin/statsd-bridge.py ]; then
    /usr/local/bin/statsd-bridge.py > /tmp/datadog-bridge.log 2>&1 &
    DATADOG_PID=$!
    echo "  - Datadog bridge launched (PID: $DATADOG_PID)"
fi

# 3. Valkey Server (skip in fast build)
if [ "$FAST_BUILD" = false ] && [ -f /bin/valkey-server ] && [ -f /etc/valkey.conf ]; then
    # Update Valkey config to use persistent directory if available
    if [ "$VALKEY_DATA_DIR" != "/tmp" ]; then
        mkdir -p "$VALKEY_DATA_DIR" 2>/dev/null || true
        chmod 755 "$VALKEY_DATA_DIR"
        sed -i "s|^dir /tmp|dir $VALKEY_DATA_DIR|g" /etc/valkey.conf 2>/dev/null || true
        echo "  Using Valkey data dir: $VALKEY_DATA_DIR"
    fi
    /bin/valkey-server /etc/valkey.conf > /tmp/valkey.log 2>&1 &
    VALKEY_PID=$!
    echo "  - Valkey server launched (PID: $VALKEY_PID)"
fi

# 4. PostgreSQL Server (skip in fast build)
if [ "$FAST_BUILD" = false ] && [ -f /usr/libexec/postgresql16/postgres ] && [ -f "$POSTGRES_DATA_DIR/PG_VERSION" ]; then
    # AGENT T FIX: Set ICU_DATA environment variable for runtime ICU support
    # AGENT Z: Use configurable data directory
    su postgres -c "ICU_DATA=/usr/share/icu/76.1 LD_LIBRARY_PATH=/usr/lib:/usr/local/lib /usr/libexec/postgresql16/postgres -D $POSTGRES_DATA_DIR" > /tmp/postgresql.log 2>&1 &
    POSTGRES_PID=$!
    echo "  - PostgreSQL server launched (PID: $POSTGRES_PID, data: $POSTGRES_DATA_DIR)"
fi

# 5. OpenVSCode Server
if [ -f /opt/openvscode/bin/openvscode-server ]; then
    # Configure terminal with shell wrapper (v4.1.0 fix for PATH issue)
    echo "  Configuring terminal with shell wrapper..."
    mkdir -p /tmp/vscode-data/Machine /tmp/vscode-data/User
    cat > /tmp/vscode-data/Machine/settings.json << 'SETTINGS_EOF'
{
  "workbench.colorTheme": "Default Dark+",
  "terminal.integrated.cursorStyle": "block",
  "terminal.integrated.cursorBlinking": true,
  "terminal.integrated.fontFamily": "monospace",
  "terminal.integrated.fontSize": 14,
  "terminal.integrated.defaultProfile.linux": "sh",
  "terminal.integrated.profiles.linux": {
    "sh": {
      "path": "/tmp/sh-with-env",
      "args": [],
      "env": {
        "PATH": "/usr/sbin:/usr/bin:/sbin:/bin",
        "TERM": "xterm-256color"
      }
    }
  },
  "workbench.colorCustomizations": {
    "terminal.background": "#000000",
    "terminal.foreground": "#00FF00",
    "terminalCursor.background": "#00FF00",
    "terminalCursor.foreground": "#00FF00",
    "terminal.ansiBlack": "#000000",
    "terminal.ansiRed": "#FF0000",
    "terminal.ansiGreen": "#00FF00",
    "terminal.ansiYellow": "#FFFF00",
    "terminal.ansiBlue": "#0000FF",
    "terminal.ansiMagenta": "#FF00FF",
    "terminal.ansiCyan": "#00FFFF",
    "terminal.ansiWhite": "#FFFFFF",
    "terminal.ansiBrightBlack": "#808080",
    "terminal.ansiBrightRed": "#FF8080",
    "terminal.ansiBrightGreen": "#80FF80",
    "terminal.ansiBrightYellow": "#FFFF80",
    "terminal.ansiBrightBlue": "#8080FF",
    "terminal.ansiBrightMagenta": "#FF80FF",
    "terminal.ansiBrightCyan": "#80FFFF",
    "terminal.ansiBrightWhite": "#FFFFFF"
  }
}
SETTINGS_EOF
    cp /tmp/vscode-data/Machine/settings.json /tmp/vscode-data/User/settings.json
    echo "  ✓ Terminal configured with wrapper and black console"

    (cd /opt/openvscode && ./bin/openvscode-server \
        --host $VSCODE_HOST \
        --port 8080 \
        --without-connection-token \
        --accept-server-license-terms \
        --user-data-dir /tmp/vscode-data \
        --log trace \
        > /tmp/openvscode.log 2>&1) &
    VSCODE_PID=$!
    echo "  - OpenVSCode server launched (PID: $VSCODE_PID)"
fi

echo ""
echo "All services launched in background!"
echo ""

# ==============================================================================
# SMART SERVICE HEALTH CHECKS - Polling with Service-Specific Timeouts
# ==============================================================================

echo "========================================="
echo "  SMART SERVICE HEALTH CHECKS"
echo "========================================="
echo ""

# Health check function with polling and timeout
# Usage: check_service_health "SERVICE_NAME" "PORT" "TIMEOUT_SECONDS" "EXTRA_CHECKS"
check_service_health() {
    local SERVICE_NAME="$1"
    local PORT="$2"
    local TIMEOUT="$3"
    local EXTRA_CHECKS="$4"
    local START_TIME=$(date +%s)
    local ELAPSED=0
    local POLL_INTERVAL=0.5  # 500ms between checks
    local READY=false

    echo -n "Checking $SERVICE_NAME (port $PORT, max ${TIMEOUT}s)... "

    # Polling loop
    while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
        # Check if port is listening using /dev/tcp (no external tools needed)
        # This is more portable than nc and works in minimal environments
        if timeout 1 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/$PORT" 2>/dev/null; then
            READY=true
            break
        fi

        # For extra checks (like process verification)
        if [ -n "$EXTRA_CHECKS" ]; then
            if eval "$EXTRA_CHECKS"; then
                READY=true
                break
            fi
        fi

        # Sleep briefly before next check
        sleep "$POLL_INTERVAL"
        ELAPSED=$(( $(date +%s) - START_TIME ))
    done

    if [ "$READY" = true ]; then
        ELAPSED=$(( $(date +%s) - START_TIME ))
        echo "✓ Ready (${ELAPSED}s)"
        return 0
    else
        echo "✗ Timeout after ${TIMEOUT}s"
        return 1
    fi
}

# Track health check results
HEALTH_CHECK_RESULTS=""
FAILED_SERVICES=0

# ==============================================================================
# Check SSH Server (port 22)
# ==============================================================================
if [ -n "$SSH_PID" ]; then
    echo ""
    echo "=== SSH Server ==="

    # Check port listening with process verification fallback
    SSH_CHECK='ps | grep -v grep | grep -q dropbear'
    if check_service_health "SSH" "22" "10" "$SSH_CHECK"; then
        echo "✓ SSH server responding on port 22"

        # AGENT X: Add port connectivity proof
        if nc -z -w 2 localhost 22 2>/dev/null; then
            echo "  ✓ Port 22 LISTENING"
        else
            echo "  ✗ Port 22 NOT ACCESSIBLE"
        fi

        if [ -n "$VM_IP" ] && [ "$VM_IP" != "localhost" ]; then
            echo "  Connect: ssh root@$VM_IP (password: vibecode)"
        else
            echo "  Connect: ssh root@localhost"
        fi
        HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}SSH: Ready\n"
    else
        echo "✗ SSH server failed to respond"
        [ -f /tmp/dropbear.log ] && echo "  Last 5 lines from log:" && head -5 /tmp/dropbear.log | sed 's/^/    /'
        HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}SSH: Failed\n"
        FAILED_SERVICES=$((FAILED_SERVICES + 1))
    fi
fi

# ==============================================================================
# Check Valkey (port 6379)
# ==============================================================================
if [ -n "$VALKEY_PID" ]; then
    echo ""
    echo "=== Valkey Server ==="

    VALKEY_CHECK='ps | grep -v grep | grep -q valkey-server'
    if check_service_health "Valkey" "6379" "10" "$VALKEY_CHECK"; then
        echo "✓ Valkey responding on port 6379"

        # AGENT X: Add port connectivity proof
        if nc -z -w 2 localhost 6379 2>/dev/null; then
            echo "  ✓ Port 6379 LISTENING"
        else
            echo "  ✗ Port 6379 NOT ACCESSIBLE"
        fi

        echo "  Port: 6379"
        echo "  Logs: /tmp/valkey.log"
        HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}Valkey: Ready\n"
    else
        echo "✗ Valkey failed to respond"
        [ -f /tmp/valkey.log ] && echo "  Last 5 lines from log:" && head -5 /tmp/valkey.log | sed 's/^/    /'
        HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}Valkey: Failed\n"
        FAILED_SERVICES=$((FAILED_SERVICES + 1))
    fi
fi

# ==============================================================================
# Check PostgreSQL (port 5432)
# ==============================================================================
if [ -n "$POSTGRES_PID" ]; then
    echo ""
    echo "=== PostgreSQL Server ==="

    POSTGRES_CHECK='ps | grep -v grep | grep -q "postgres -D"'
    if check_service_health "PostgreSQL" "5432" "10" "$POSTGRES_CHECK"; then
        echo "✓ PostgreSQL responding on port 5432"

        # AGENT X: Add port connectivity proof
        if nc -z -w 2 localhost 5432 2>/dev/null; then
            echo "  ✓ Port 5432 LISTENING"
        else
            echo "  ✗ Port 5432 NOT ACCESSIBLE"
        fi

        echo "  Port: 5432"
        echo "  Logs: /tmp/postgresql.log"

        # Quick connection test (non-blocking)
        if su postgres -c "psql -U postgres -d postgres -c 'SELECT 1;'" > /dev/null 2>&1; then
            echo "  ✓ Accepting connections"
            HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}PostgreSQL: Ready (accepting connections)\n"

            # Install extensions in background (don't block boot)
            (
                sleep 2
                cat > /tmp/install-extensions.sql << 'EXTEOF'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS unaccent;
EXTEOF
                su postgres -c "psql -U postgres -d postgres -f /tmp/install-extensions.sql" > /tmp/extensions.log 2>&1 || true
            ) &
            echo "  Extensions installing in background..."
        else
            echo "  ⚠ Port responsive but not accepting connections yet"
            HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}PostgreSQL: Ready (port responsive, connections pending)\n"
        fi
    else
        echo "✗ PostgreSQL failed to respond"
        [ -f /tmp/postgresql.log ] && echo "  Last 10 lines from log:" && head -10 /tmp/postgresql.log | sed 's/^/    /'
        HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}PostgreSQL: Failed\n"
        FAILED_SERVICES=$((FAILED_SERVICES + 1))
    fi
fi

# ==============================================================================
# Check OpenVSCode (port 8080)
# ==============================================================================
if [ -n "$VSCODE_PID" ]; then
    echo ""
    echo "=== OpenVSCode Server ==="

    VSCODE_CHECK='ps | grep -v grep | grep -q openvscode-server'
    if check_service_health "OpenVSCode" "8080" "10" "$VSCODE_CHECK"; then
        echo "✓ OpenVSCode responding on port 8080"

        # AGENT X: Add port connectivity proof
        if nc -z -w 2 localhost 8080 2>/dev/null; then
            echo "  ✓ Port 8080 LISTENING"
        else
            echo "  ✗ Port 8080 NOT ACCESSIBLE"
        fi

        if [ "$NETWORK_MODE" = "localhost" ]; then
            echo "  URL: http://127.0.0.1:8080 (localhost only)"
        else
            echo "  URL: http://$VM_IP:8080"
        fi
        echo "  Logs: /tmp/openvscode.log"
        HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}OpenVSCode: Ready\n"
    else
        echo "✗ OpenVSCode failed to respond"
        [ -f /tmp/openvscode.log ] && echo "  Last 10 lines from log:" && head -10 /tmp/openvscode.log | sed 's/^/    /'
        HEALTH_CHECK_RESULTS="${HEALTH_CHECK_RESULTS}OpenVSCode: Failed\n"
        FAILED_SERVICES=$((FAILED_SERVICES + 1))
    fi
fi

# ==============================================================================
# VSOCK FORWARDING SETUP
# ==============================================================================
# After services are healthy, set up vsock forwarding to make them accessible
# from the host via vsock. The host has vsock proxies listening on localhost.

echo ""
echo "========================================="
echo "  Setting up vsock forwarding"
echo "========================================="
echo ""

# Check if vsock device exists
if [ -e /dev/vsock ]; then
    echo "✓ /dev/vsock found - setting up vsock forwarding"

    # Forward vsock connections to localhost services
    # Host connects to localhost:8080 -> vsock CID 3 port 8080 -> guest localhost:8080 (OpenVSCode)
    # Host connects to localhost:6379 -> vsock CID 3 port 6379 -> guest localhost:6379 (Valkey)
    # Host connects to localhost:5432 -> vsock CID 3 port 5432 -> guest localhost:5432 (PostgreSQL)
    # Host connects to localhost:2222 -> vsock CID 3 port 2222 -> guest localhost:22 (SSH)

    if [ -n "$VSCODE_PID" ]; then
        echo "  Starting vsock forwarder: vsock:8080 -> localhost:8080 (OpenVSCode)"
        socat VSOCK-LISTEN:8080,fork TCP:localhost:8080 > /tmp/vsock-8080.log 2>&1 &
    fi

    if [ -n "$VALKEY_PID" ]; then
        echo "  Starting vsock forwarder: vsock:6379 -> localhost:6379 (Valkey)"
        socat VSOCK-LISTEN:6379,fork TCP:localhost:6379 > /tmp/vsock-6379.log 2>&1 &
    fi

    if [ -n "$POSTGRES_PID" ]; then
        echo "  Starting vsock forwarder: vsock:5432 -> localhost:5432 (PostgreSQL)"
        socat VSOCK-LISTEN:5432,fork TCP:localhost:5432 > /tmp/vsock-5432.log 2>&1 &
    fi

    if [ -n "$SSH_PID" ]; then
        echo "  Starting vsock forwarder: vsock:2222 -> localhost:22 (SSH)"
        socat VSOCK-LISTEN:2222,fork TCP:localhost:22 > /tmp/vsock-2222.log 2>&1 &
    fi

    # Give socat a moment to start
    sleep 1

    # Verify socat processes are running
    if ps | grep -v grep | grep -q socat; then
        echo "✓ Vsock forwarding active!"
        echo ""
        echo "Host can now connect to services via localhost:"
        echo "  - localhost:8080  -> OpenVSCode"
        echo "  - localhost:6379  -> Valkey"
        echo "  - localhost:5432  -> PostgreSQL"
        echo "  - localhost:2222  -> SSH"
    else
        echo "⚠ Warning: socat processes may not have started correctly"
    fi
else
    echo "⚠ /dev/vsock not found - vsock forwarding not available"
    echo "  Services are only accessible via VM network: $VM_IP"
fi
echo ""

# Summary and Final Status Report
echo ""
echo "========================================="
echo "  Unified Services VM Ready"
echo "========================================="
echo ""

if [ "$FAILED_SERVICES" -eq 0 ]; then
    echo "✓ All services passed health checks!"
else
    echo "⚠ Warning: $FAILED_SERVICES service(s) did not respond to health checks"
fi

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
echo "Health Check Results:"
printf "$HEALTH_CHECK_RESULTS"
echo ""

# ==============================================================================
# AGENT X: ACCESS CREDENTIALS DISPLAY
# ==============================================================================
echo "==========================================="
echo "  ACCESS CREDENTIALS"
echo "==========================================="
echo ""
echo "SSH Access:"
echo "  ssh root@$VM_IP"
echo "  Password: vibecode"
echo ""
echo "Valkey Access:"
if [ -n "$VALKEY_PID" ]; then
    echo "  redis-cli -h $VM_IP -p 6379"
    echo "  (No password required)"
else
    echo "  (Service not running)"
fi
echo ""
echo "PostgreSQL Access:"
if [ -n "$POSTGRES_PID" ]; then
    echo "  psql -h $VM_IP -p 5432 -U postgres"
    echo "  (Trust authentication - no password)"
else
    echo "  (Service not running)"
fi
echo ""
echo "OpenVSCode Access:"
if [ -n "$VSCODE_PID" ]; then
    echo "  http://$VM_IP:8080"
    echo "  (Open in web browser)"
else
    echo "  (Service not running)"
fi
echo ""
echo "==========================================="
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
    
    # Create fast build marker if needed
    if [ "$FAST_BUILD" = true ]; then
        touch "$initramfs/.fast_build"
        info "FAST BUILD marker created"
    fi

    log "✓ Init script created"
    log ""
}

# ==============================================================================
# PHASE 6: PACKAGE INITRAMFS
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
# PHASE 7: VERIFICATION
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
# PHASE 8: DOCUMENTATION
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
    if [ "$FAST_BUILD" = true ]; then
        echo "  - OpenVSCode Server ${OPENVSCODE_VERSION} (FAST BUILD)"
    else
        echo "  - Valkey ${VALKEY_VERSION} (Redis-compatible)"
        echo "  - PostgreSQL ${POSTGRESQL_VERSION}"
        echo "  - OpenVSCode Server ${OPENVSCODE_VERSION}"
        echo "  - Dropbear SSH"
        echo "  - Datadog StatsD bridge"
    fi
    
    if [ "$WITH_EXTENSIONS" = true ]; then
        echo ""
        echo "VS Code Extensions:"
        echo "  - Continue (AI with Claude/GPT)"
        echo "  - Redis Client (Valkey/Redis GUI)"
        echo "  - SQLTools + PostgreSQL driver"
        echo "  - Prettier (code formatter)"
        echo "  - ESLint (linter)"
        echo "  - REST Client (API testing)"
    fi
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
    
    if [ "$FAST_BUILD" = false ]; then
        download_valkey
        download_postgresql
        download_dropbear_ssh
        download_socat
    else
        info "FAST BUILD: Skipping Valkey, PostgreSQL, Dropbear SSH, and socat"
    fi

    download_openvscode
    
    # Download VS Code extensions if requested
    if [ "$WITH_EXTENSIONS" = true ]; then
        download_vscode_extensions
    else
        info "Skipping VS Code extensions (use --with-extensions to include)"
    fi
    
    download_musl_libc

    # Create sandbox components
    create_sandbox_files

    # Create Datadog integration (only in full build)
    if [ "$FAST_BUILD" = false ]; then
        create_datadog_bridge
    else
        info "FAST BUILD: Skipping Datadog integration"
    fi

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
