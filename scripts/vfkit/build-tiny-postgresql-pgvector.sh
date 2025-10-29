#!/bin/sh
# Build TINY PostgreSQL with pgvector on Alpine ARM64 musl
# Optimized for minimal size and ARM64 performance

set -e

echo "======================================================================"
echo "  Building TINY PostgreSQL + pgvector (musl ARM64)"
echo "======================================================================"
echo ""

# System info
echo "📊 System:"
uname -m
ldd --version 2>&1 | head -1 || echo "musl libc"
echo ""

# Install minimal build dependencies
echo "📦 Installing build dependencies..."
apk update
apk add --no-cache \
    postgresql16 \
    postgresql16-dev \
    postgresql16-contrib \
    git \
    build-base \
    clang \
    llvm \
    aria2

echo ""
echo "Installed PostgreSQL:"
postgres --version
echo ""

# Build pgvector from source with aggressive optimization
echo "🔧 Building pgvector with ARM64 optimizations..."
cd /tmp

# Download pgvector
echo "Downloading pgvector..."
aria2c --max-connection-per-server=16 --split=16 \
    https://github.com/pgvector/pgvector/archive/refs/tags/v0.8.0.tar.gz

tar -xzf v0.8.0.tar.gz
cd pgvector-0.8.0

# Compile with aggressive ARM64 optimizations
echo "Compiling with aggressive optimizations..."
make clean || true
make -j$(nproc) \
    CC=clang \
    CFLAGS="-O3 -march=armv8-a+crc+crypto -mtune=cortex-a76 -flto -fomit-frame-pointer -ffunction-sections -fdata-sections" \
    LDFLAGS="-Wl,--gc-sections,--as-needed -flto"

# Install
make install

echo ""
echo "✅ pgvector installed"
echo ""

# Initialize PostgreSQL data directory
echo "📁 Initializing PostgreSQL..."
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql

# Initialize as postgres user
su - postgres -c "initdb -D /var/lib/postgresql/data"

# Configure for minimal memory usage
cat >> /var/lib/postgresql/data/postgresql.conf <<CONFIG

# Minimal memory configuration
shared_buffers = 128MB
effective_cache_size = 256MB
maintenance_work_mem = 64MB
work_mem = 4MB
max_connections = 50

# Enable pgvector
shared_preload_libraries = 'vector'

# Listen on all interfaces
listen_addresses = '*'
port = 5432

# Performance
random_page_cost = 1.1
effective_io_concurrency = 200
CONFIG

# Allow connections from anywhere (for dev/testing)
cat >> /var/lib/postgresql/data/pg_hba.conf <<HBA
host    all             all             0.0.0.0/0               md5
HBA

chown -R postgres:postgres /var/lib/postgresql

# Create OpenRC service
cat > /etc/init.d/postgresql <<'SERVICE'
#!/sbin/openrc-run

name="postgresql"
description="PostgreSQL Database Server"

command="/usr/bin/postgres"
command_args="-D /var/lib/postgresql/data"
command_user="postgres"
command_background="yes"
pidfile="/run/postgresql/postgres.pid"

depend() {
    need net
}

start_pre() {
    checkpath --directory --mode 0775 --owner postgres:postgres /run/postgresql
}
SERVICE

chmod +x /etc/init.d/postgresql

# Enable and start
rc-update add postgresql default
rc-service postgresql start

echo ""
echo "⏳ Waiting for PostgreSQL to start..."
sleep 3

# Create test database with pgvector
echo "🧪 Testing pgvector..."
su - postgres -c "psql -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
su - postgres -c "psql -c 'SELECT version();'"
su - postgres -c "psql -c '\dx vector'"

echo ""
echo "======================================================================"
echo "  ✅ PostgreSQL + pgvector Build Complete!"
echo "======================================================================"
echo ""

# Show sizes
echo "💾 Installation sizes:"
du -sh /usr/lib/postgresql16 2>/dev/null || du -sh /usr/lib/postgresql*
du -sh /var/lib/postgresql/data
echo ""

# Strip binaries for even smaller size
echo "🔪 Stripping binaries..."
find /usr/lib/postgresql* -type f -executable -exec strip --strip-unneeded {} \; 2>/dev/null || true
find /usr/bin -name "pg*" -type f -exec strip --strip-unneeded {} \; 2>/dev/null || true

echo ""
echo "💾 Sizes after stripping:"
du -sh /usr/lib/postgresql* 2>/dev/null
echo ""

echo "Service: postgresql"
echo "Port: 5432"
echo "C Library: musl"
echo "Extensions: pgvector ✅"
echo ""
echo "Status:"
rc-service postgresql status
echo ""
echo "Test connection:"
echo "  psql -h localhost -U postgres -c 'SELECT version();'"
echo "  psql -h localhost -U postgres -c 'CREATE EXTENSION vector;'"
echo ""

# Show total system size
echo "📊 Total footprint:"
df -h / | tail -1

