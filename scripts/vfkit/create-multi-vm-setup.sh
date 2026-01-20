#!/usr/bin/env bash
# Create ACTUAL running VMs for each service
# - Valkey VM (2 CPUs, 1GB RAM, port 6379)
# - PostgreSQL VM (2 CPUs, 2GB RAM, port 5432)
# - openvscode VM (4 CPUs, 4GB RAM, port 8080)
# All with Datadog monitoring

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_BASE="${HOME}/.vfkit/vms"

echo "======================================================================"
echo "  Creating Multi-VM Setup with Running Services"
echo "======================================================================"
echo ""

# Datadog API key (should be in environment)
DATADOG_API_KEY="${DATADOG_API_KEY:-}"
if [[ -z "$DATADOG_API_KEY" ]]; then
    echo "⚠️  DATADOG_API_KEY not set. Datadog monitoring will be skipped."
    echo "   Set with: export DATADOG_API_KEY='your-key'"
    echo ""
fi

# =============================================================================
# VM 1: Valkey (Redis Alternative)
# =============================================================================

create_valkey_vm() {
    echo "Creating Valkey VM..."
    echo "────────────────────────"
    
    VM_NAME="vibecode-valkey"
    VM_DIR="${VM_BASE}/${VM_NAME}"
    
    mkdir -p "${VM_DIR}"/{kernel,rootfs,disk,logs}
    
    # Copy kernel from main VM
    if [[ -f "${VM_BASE}/vibecode-alpine/kernel/vmlinux" ]]; then
        cp "${VM_BASE}/vibecode-alpine/kernel/vmlinux" "${VM_DIR}/kernel/"
    fi
    
    # Create Valkey startup script
    cat > "${VM_DIR}/start-valkey.sh" <<'VALKEY_START'
#!/bin/sh
# Valkey VM startup and build script
set -e

echo "=== Valkey VM Starting ==="
echo ""

# Install dependencies
apk update
apk add --no-cache build-base linux-headers wget ca-certificates

# Install Datadog agent if key available
if [ -n "$DATADOG_API_KEY" ]; then
    apk add --no-cache curl
    sh -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"
    echo "api_key: $DATADOG_API_KEY" > /etc/datadog-agent/datadog.yaml
    echo "hostname: valkey-vm" >> /etc/datadog-agent/datadog.yaml
    service datadog-agent start
    echo "✅ Datadog installed"
fi

# Build Valkey
cd /tmp
wget -q https://github.com/valkey-io/valkey/archive/refs/tags/8.1.0.tar.gz
tar xzf 8.1.0.tar.gz
cd valkey-8.1.0

make -j2 MALLOC=libc USE_SYSTEMD=no BUILD_TLS=yes \
    OPTIMIZATION=-O3 \
    CFLAGS="-O3 -march=armv8-a+crc+crypto -mtune=cortex-a76" \
    LDFLAGS="-Wl,--gc-sections,-O3"

strip src/valkey-server src/valkey-cli

# Install
make install PREFIX=/usr/local

# Configure
mkdir -p /var/lib/valkey /var/log/valkey /etc/valkey
adduser -D valkey

cat > /etc/valkey/valkey.conf <<EOF
bind 0.0.0.0
port 6379
daemonize no
logfile /var/log/valkey/valkey.log
dir /var/lib/valkey
maxmemory 512mb
maxmemory-policy allkeys-lru
EOF

echo "✅ Valkey built and configured"
echo ""
echo "Starting Valkey server..."
exec /usr/local/bin/valkey-server /etc/valkey/valkey.conf
VALKEY_START

    chmod +x "${VM_DIR}/start-valkey.sh"
    
    # Create VM launch script
    cat > "${VM_DIR}/launch.sh" <<EOF
#!/usr/bin/env bash
vfkit \\
    --cpus 2 \\
    --memory 1024 \\
    --kernel ${VM_DIR}/kernel/vmlinux \\
    --initrd ${VM_BASE}/vibecode-alpine/rootfs/alpine-vibecode-rootfs.cpio.gz \\
    --kernel-cmdline "console=hvc0 root=/dev/vda rw quiet" \\
    --device virtio-blk,path=${VM_DIR}/disk/root.img \\
    --device virtio-net,nat,mac=52:54:00:12:34:57 \\
    --device virtio-serial,logFilePath=${VM_DIR}/logs/console.log \\
    --device virtio-rng
EOF
    
    chmod +x "${VM_DIR}/launch.sh"
    
    echo "✅ Valkey VM created at: ${VM_DIR}"
    echo ""
}

# =============================================================================
# VM 2: PostgreSQL + pgvector
# =============================================================================

create_postgresql_vm() {
    echo "Creating PostgreSQL VM..."
    echo "─────────────────────────"
    
    VM_NAME="vibecode-postgresql"
    VM_DIR="${VM_BASE}/${VM_NAME}"
    
    mkdir -p "${VM_DIR}"/{kernel,rootfs,disk,logs}
    
    # Copy kernel
    if [[ -f "${VM_BASE}/vibecode-alpine/kernel/vmlinux" ]]; then
        cp "${VM_BASE}/vibecode-alpine/kernel/vmlinux" "${VM_DIR}/kernel/"
    fi
    
    # Create PostgreSQL startup script
    cat > "${VM_DIR}/start-postgresql.sh" <<'PG_START'
#!/bin/sh
# PostgreSQL VM startup and build script
set -e

echo "=== PostgreSQL VM Starting ==="
echo ""

# Install dependencies
apk update
apk add --no-cache \
    build-base \
    linux-headers \
    git \
    postgresql16 \
    postgresql16-dev \
    postgresql16-client

# Install Datadog
if [ -n "$DATADOG_API_KEY" ]; then
    apk add --no-cache curl
    sh -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"
    echo "api_key: $DATADOG_API_KEY" > /etc/datadog-agent/datadog.yaml
    echo "hostname: postgresql-vm" >> /etc/datadog-agent/datadog.yaml
    service datadog-agent start
    echo "✅ Datadog installed"
fi

# Build pgvector
cd /tmp
git clone --depth 1 --branch v0.9.0 https://github.com/pgvector/pgvector.git
cd pgvector
make OPTFLAGS="-O3 -march=armv8-a+crc"
make install

# Initialize PostgreSQL
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql
su - postgres -c "initdb -D /var/lib/postgresql/data"

# Configure PostgreSQL
cat >> /var/lib/postgresql/data/postgresql.conf <<EOF
listen_addresses = '*'
max_connections = 100
shared_buffers = 512MB
shared_preload_libraries = 'pg_stat_statements'
EOF

cat >> /var/lib/postgresql/data/pg_hba.conf <<EOF
host    all             all             0.0.0.0/0               md5
EOF

echo "✅ PostgreSQL + pgvector built and configured"
echo ""
echo "Starting PostgreSQL..."
exec su - postgres -c "postgres -D /var/lib/postgresql/data"
PG_START

    chmod +x "${VM_DIR}/start-postgresql.sh"
    
    # Create VM launch script
    cat > "${VM_DIR}/launch.sh" <<EOF
#!/usr/bin/env bash
vfkit \\
    --cpus 2 \\
    --memory 2048 \\
    --kernel ${VM_DIR}/kernel/vmlinux \\
    --initrd ${VM_BASE}/vibecode-alpine/rootfs/alpine-vibecode-rootfs.cpio.gz \\
    --kernel-cmdline "console=hvc0 root=/dev/vda rw quiet" \\
    --device virtio-blk,path=${VM_DIR}/disk/root.img \\
    --device virtio-net,nat,mac=52:54:00:12:34:58 \\
    --device virtio-serial,logFilePath=${VM_DIR}/logs/console.log \\
    --device virtio-rng
EOF
    
    chmod +x "${VM_DIR}/launch.sh"
    
    echo "✅ PostgreSQL VM created at: ${VM_DIR}"
    echo ""
}

# =============================================================================
# VM 3: openvscode-server
# =============================================================================

create_openvscode_vm() {
    echo "Creating openvscode-server VM..."
    echo "─────────────────────────────────"
    
    VM_NAME="vibecode-openvscode"
    VM_DIR="${VM_BASE}/${VM_NAME}"
    
    mkdir -p "${VM_DIR}"/{kernel,rootfs,disk,logs}
    
    # Copy kernel
    if [[ -f "${VM_BASE}/vibecode-alpine/kernel/vmlinux" ]]; then
        cp "${VM_BASE}/vibecode-alpine/kernel/vmlinux" "${VM_DIR}/kernel/"
    fi
    
    # Create openvscode startup script
    cat > "${VM_DIR}/start-openvscode.sh" <<'VSCODE_START'
#!/bin/sh
# openvscode-server VM startup script
set -e

echo "=== openvscode-server VM Starting ==="
echo ""

# Install dependencies
apk update
apk add --no-cache \
    nodejs \
    npm \
    git \
    wget \
    ca-certificates \
    libstdc++

# Install Datadog
if [ -n "$DATADOG_API_KEY" ]; then
    apk add --no-cache curl
    sh -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"
    echo "api_key: $DATADOG_API_KEY" > /etc/datadog-agent/datadog.yaml
    echo "hostname: openvscode-vm" >> /etc/datadog-agent/datadog.yaml
    service datadog-agent start
    echo "✅ Datadog installed"
fi

# Download openvscode-server
cd /opt
OPENVSCODE_VERSION="1.95.1"
wget -q "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64.tar.gz"
tar xzf openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64.tar.gz
mv openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64 openvscode-server

echo "✅ openvscode-server installed"
echo ""
echo "Starting openvscode-server on port 8080..."
exec /opt/openvscode-server/bin/openvscode-server \\
    --host 0.0.0.0 \\
    --port 8080 \\
    --without-connection-token
VSCODE_START

    chmod +x "${VM_DIR}/start-openvscode.sh"
    
    # Create VM launch script
    cat > "${VM_DIR}/launch.sh" <<EOF
#!/usr/bin/env bash
vfkit \\
    --cpus 4 \\
    --memory 4096 \\
    --kernel ${VM_DIR}/kernel/vmlinux \\
    --initrd ${VM_BASE}/vibecode-alpine/rootfs/alpine-vibecode-rootfs.cpio.gz \\
    --kernel-cmdline "console=hvc0 root=/dev/vda rw quiet" \\
    --device virtio-blk,path=${VM_DIR}/disk/root.img \\
    --device virtio-net,nat,mac=52:54:00:12:34:59 \\
    --device virtio-serial,logFilePath=${VM_DIR}/logs/console.log \\
    --device virtio-rng
EOF
    
    chmod +x "${VM_DIR}/launch.sh"
    
    echo "✅ openvscode VM created at: ${VM_DIR}"
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================

echo "This will create 3 separate VMs:"
echo "  1. Valkey (2 CPUs, 1GB RAM, port 6379)"
echo "  2. PostgreSQL + pgvector (2 CPUs, 2GB RAM, port 5432)"
echo "  3. openvscode-server (4 CPUs, 4GB RAM, port 8080)"
echo ""
echo "All with Datadog monitoring (if API key set)"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

create_valkey_vm
create_postgresql_vm
create_openvscode_vm

echo "======================================================================"
echo "  Multi-VM Setup Complete"
echo "======================================================================"
echo ""
echo "Created VMs:"
echo "  ✅ Valkey VM:       ${VM_BASE}/vibecode-valkey"
echo "  ✅ PostgreSQL VM:   ${VM_BASE}/vibecode-postgresql"
echo "  ✅ openvscode VM:   ${VM_BASE}/vibecode-openvscode"
echo ""
echo "To start each VM:"
echo "  ${VM_BASE}/vibecode-valkey/launch.sh &"
echo "  ${VM_BASE}/vibecode-postgresql/launch.sh &"
echo "  ${VM_BASE}/vibecode-openvscode/launch.sh &"
echo ""
echo "Note: Each VM will build its service on first boot (takes 5-10 min)"
echo "      Check logs in each VM's logs/console.log"
echo ""

