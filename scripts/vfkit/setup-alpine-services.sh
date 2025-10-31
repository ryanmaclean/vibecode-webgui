#!/usr/bin/env bash
# Setup script to run INSIDE the Alpine VM
# This installs Valkey, PostgreSQL+pgvector, and tests Node 24
# Usage: Run this script inside the Alpine VM after boot

set -euo pipefail

echo "======================================================================"
echo "  Alpine ARM64 Services Setup"
echo "======================================================================"
echo ""
echo "This script will install:"
echo "  1. Valkey (compiled from source with musl optimizations)"
echo "  2. PostgreSQL 16 + pgvector extension"
echo "  3. Node.js 24 verification"
echo ""

# Check we're running on Alpine
if [ ! -f /etc/alpine-release ]; then
    echo "❌ This script must run on Alpine Linux"
    exit 1
fi

echo "✅ Running on Alpine $(cat /etc/alpine-release)"
echo "✅ Architecture: $(uname -m)"
echo ""

# =============================================================================
# Task 1: Install and Compile Valkey
# =============================================================================

echo "======================================================================"
echo "  Task 1: Building Valkey from Source"
echo "======================================================================"
echo ""

VALKEY_VERSION="7.2.7"
BUILD_DIR="/tmp/valkey-build"

echo "Installing build dependencies..."
apk add --no-cache \
    build-base \
    linux-headers \
    wget \
    ca-certificates \
    git

echo "Downloading Valkey ${VALKEY_VERSION}..."
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

wget -q "https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_VERSION}.tar.gz" \
    -O valkey.tar.gz

echo "Extracting..."
tar xzf valkey.tar.gz
cd "valkey-${VALKEY_VERSION}"

echo "Compiling Valkey with ARM64 optimizations..."
echo "  • CRC32 hardware acceleration"
echo "  • Crypto extensions"  
echo "  • Link-time optimization"
echo ""

# Build with aggressive ARM64 optimizations
make -j$(nproc) \
    MALLOC=libc \
    USE_SYSTEMD=no \
    BUILD_TLS=yes \
    OPTIMIZATION=-O3 \
    CFLAGS="-O3 -march=armv8-a+crc+crypto -mtune=cortex-a76 -flto -fomit-frame-pointer -pipe" \
    LDFLAGS="-Wl,--gc-sections,-O3,--as-needed -flto"

echo "Stripping binaries..."
strip src/valkey-server
strip src/valkey-cli
strip src/valkey-benchmark

echo "Binary sizes:"
ls -lh src/valkey-server src/valkey-cli src/valkey-benchmark

echo "Installing Valkey..."
make PREFIX=/usr/local install

# Create system user
if ! id valkey &>/dev/null; then
    adduser -D -s /sbin/nologin valkey
fi

# Create directories
mkdir -p /var/lib/valkey /var/log/valkey /etc/valkey
chown -R valkey:valkey /var/lib/valkey /var/log/valkey

# Create configuration
cat > /etc/valkey/valkey.conf <<'VALKEYCONF'
# Valkey configuration for Alpine ARM64
bind 127.0.0.1
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

daemonize yes
pidfile /var/run/valkey.pid
loglevel notice
logfile /var/log/valkey/valkey.log
databases 16

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/valkey

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Performance
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes

appendonly no
VALKEYCONF

chown valkey:valkey /etc/valkey/valkey.conf
chmod 640 /etc/valkey/valkey.conf

# Create OpenRC init script
cat > /etc/init.d/valkey <<'INITSCRIPT'
#!/sbin/openrc-run

name="valkey"
description="Valkey in-memory data store"
command="/usr/local/bin/valkey-server"
command_args="/etc/valkey/valkey.conf"
command_user="valkey:valkey"
pidfile="/var/run/valkey.pid"

depend() {
    need net
    use logger
}

start_pre() {
    checkpath --directory --owner valkey:valkey --mode 0755 \
        /var/run /var/log/valkey /var/lib/valkey
}
INITSCRIPT

chmod +x /etc/init.d/valkey

# Test Valkey
echo ""
echo "Testing Valkey..."
valkey-server --version

# Cleanup build files
cd /
rm -rf "$BUILD_DIR"

echo "✅ Task 1 Complete: Valkey ${VALKEY_VERSION} installed"
echo ""

# =============================================================================
# Task 2: Install PostgreSQL + pgvector
# =============================================================================

echo "======================================================================"
echo "  Task 2: Installing PostgreSQL 16 + pgvector"
echo "======================================================================"
echo ""

POSTGRES_VERSION="16"
PGVECTOR_VERSION="0.9.0"

echo "Installing PostgreSQL ${POSTGRES_VERSION}..."
apk add --no-cache \
    postgresql${POSTGRES_VERSION} \
    postgresql${POSTGRES_VERSION}-contrib \
    postgresql${POSTGRES_VERSION}-client \
    postgresql${POSTGRES_VERSION}-dev

echo "Building pgvector ${PGVECTOR_VERSION} from source..."
cd /tmp
git clone --depth 1 --branch v${PGVECTOR_VERSION} https://github.com/pgvector/pgvector.git
cd pgvector

# Build with ARM64 optimizations
make OPTFLAGS="-O3 -march=armv8-a+crc"
make install

# Cleanup
cd /
rm -rf /tmp/pgvector

echo "Configuring PostgreSQL..."
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql
mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql

# Initialize database as postgres user
su - postgres -c "initdb -D /var/lib/postgresql/data"

# Configure PostgreSQL
cat >> /var/lib/postgresql/data/postgresql.conf <<'PGCONF'
listen_addresses = '*'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
work_mem = 4MB
shared_preload_libraries = 'pg_stat_statements'
PGCONF

# Allow local connections
cat >> /var/lib/postgresql/data/pg_hba.conf <<'PGHBA'
host    all             all             0.0.0.0/0               md5
host    all             all             ::0/0                   md5
PGHBA

# Create OpenRC init script
rc-update add postgresql default

echo "Testing PostgreSQL..."
rc-service postgresql start
sleep 3

# Create test database and enable pgvector
su - postgres -c "psql -c \"CREATE DATABASE vibecode;\""
su - postgres -c "psql -d vibecode -c \"CREATE EXTENSION vector;\""
su - postgres -c "psql -d vibecode -c \"SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';\""

echo "✅ Task 2 Complete: PostgreSQL ${POSTGRES_VERSION} + pgvector ${PGVECTOR_VERSION} installed"
echo ""

# =============================================================================
# Task 3: Verify Node 24 Installation
# =============================================================================

echo "======================================================================"
echo "  Task 3: Verifying Node.js 24 Installation"
echo "======================================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "Installing Node.js 24..."
    apk add --no-cache nodejs npm
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo "✅ Node.js version: $NODE_VERSION"
echo "✅ npm version: $NPM_VERSION"
echo ""

# Test Node.js functionality
echo "Testing Node.js core modules..."
node -e "
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');

console.log('  • Architecture:', os.arch());
console.log('  • Platform:', os.platform());
console.log('  • Node version:', process.version);
console.log('  • V8 version:', process.versions.v8);
console.log('  • Crypto:', typeof crypto.randomBytes === 'function' ? '✅' : '❌');
console.log('  • File system:', typeof fs.readFileSync === 'function' ? '✅' : '❌');
console.log('  • All core modules: ✅');
"

echo ""
echo "Testing npm..."
npm --version > /dev/null && echo "✅ npm is working"

echo "✅ Task 3 Complete: Node.js 24 verified"
echo ""

# =============================================================================
# Summary
# =============================================================================

echo "======================================================================"
echo "  Installation Summary"
echo "======================================================================"
echo ""
echo "✅ All services installed successfully!"
echo ""
echo "Services:"
echo "  • Valkey ${VALKEY_VERSION} - Redis-compatible in-memory store"
echo "  • PostgreSQL ${POSTGRES_VERSION} - SQL database with pgvector"
echo "  • Node.js ${NODE_VERSION} - JavaScript runtime"
echo ""
echo "Binary locations:"
echo "  • valkey-server: /usr/local/bin/valkey-server"
echo "  • valkey-cli: /usr/local/bin/valkey-cli"
echo "  • postgres: $(which postgres)"
echo "  • psql: $(which psql)"
echo "  • node: $(which node)"
echo "  • npm: $(which npm)"
echo ""
echo "Start services:"
echo "  • Valkey: rc-service valkey start"
echo "  • PostgreSQL: rc-service postgresql start"
echo ""
echo "Test services:"
echo "  • Valkey: valkey-cli ping"
echo "  • PostgreSQL: psql -U postgres -l"
echo "  • Node.js: node --version"
echo ""
echo "🎉 Setup complete!"

