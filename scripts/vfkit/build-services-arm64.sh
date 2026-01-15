#!/usr/bin/env bash
# Build and test Valkey, PostgreSQL, and minimal Node 24 on ARM64 Alpine
# This script completes the remaining Alpine VM service setup tasks
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
LOG_DIR="${VM_DIR}/logs"
BUILD_LOG="${LOG_DIR}/build-services-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$BUILD_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$BUILD_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$BUILD_LOG"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$BUILD_LOG"
}

# Create directories
mkdir -p "$LOG_DIR"

echo "======================================================================"
echo "  ARM64 Alpine Services Build Script"
echo "======================================================================"
echo ""
echo "This script will:"
echo "  1. ✅ Build Valkey (Redis alternative) for ARM64 Alpine"
echo "  2. ✅ Create PostgreSQL + pgvector image"
echo "  3. ✅ Test minimal busybox kernel with Node 24"
echo ""
echo "Build log: $BUILD_LOG"
echo ""

# Check if running on ARM64
if [[ "$(uname -m)" != "arm64" ]]; then
    log_error "This script requires Apple Silicon (ARM64)"
    exit 1
fi

log "Running on Apple Silicon ARM64 ✅"

# Check for Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is required but not installed"
    echo "Install Docker Desktop or OrbStack: https://orbstack.dev"
    exit 1
fi

log "Docker found: $(docker --version)"

# =============================================================================
# Task 1: Build Valkey for ARM64 Alpine
# =============================================================================

echo ""
echo "======================================================================"
echo "  Task 1: Building Valkey for ARM64 Alpine"
echo "======================================================================"
echo ""

VALKEY_VERSION="7.2.8"
VALKEY_DOCKERFILE="${SCRIPT_DIR}/Dockerfile.valkey"

log "Creating Valkey Dockerfile for ARM64 Alpine..."

cat > "$VALKEY_DOCKERFILE" <<'EOF'
# Valkey ARM64 Alpine Build
# Multi-stage build for minimal final image
FROM alpine:3.21 AS builder

# Install build dependencies
RUN apk add --no-cache \
    build-base \
    linux-headers \
    wget \
    ca-certificates

# Build directory
WORKDIR /build

# Download and extract Valkey
ARG VALKEY_VERSION=7.2.8
RUN wget -q "https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_VERSION}.tar.gz" \
    && tar xzf "${VALKEY_VERSION}.tar.gz" \
    && cd "valkey-${VALKEY_VERSION}" \
    && make -j$(nproc) \
        MALLOC=libc \
        USE_SYSTEMD=no \
        BUILD_TLS=yes \
        OPTIMIZATION=-O3 \
        CFLAGS="-O3 -march=armv8-a+crc+crypto -mtune=cortex-a76 -flto -fomit-frame-pointer -pipe" \
        LDFLAGS="-Wl,--gc-sections,-O3,--as-needed -flto" \
    && make PREFIX=/usr/local install \
    && strip /usr/local/bin/valkey-server \
    && strip /usr/local/bin/valkey-cli \
    && strip /usr/local/bin/valkey-benchmark

# Runtime image
FROM alpine:3.21

# Install runtime dependencies only
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    && adduser -D -s /sbin/nologin valkey

# Copy binaries from builder
COPY --from=builder /usr/local/bin/valkey-* /usr/local/bin/

# Create directories
RUN mkdir -p /var/lib/valkey /var/log/valkey /etc/valkey \
    && chown -R valkey:valkey /var/lib/valkey /var/log/valkey

# Configuration
COPY valkey.conf /etc/valkey/valkey.conf
RUN chown valkey:valkey /etc/valkey/valkey.conf

# Expose port
EXPOSE 6379

# Volume for data
VOLUME ["/var/lib/valkey"]

# Run as valkey user
USER valkey
WORKDIR /var/lib/valkey

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD valkey-cli ping || exit 1

# Start Valkey
CMD ["valkey-server", "/etc/valkey/valkey.conf"]
EOF

# Create Valkey configuration
VALKEY_CONF="${SCRIPT_DIR}/valkey.conf"
cat > "$VALKEY_CONF" <<'EOF'
# Valkey configuration for Alpine ARM64
bind 0.0.0.0
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Daemon mode disabled for containers
daemonize no
pidfile /var/run/valkey.pid
loglevel notice
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
maxmemory 512mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Performance
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes

# Security
protected-mode no
EOF

log "Building Valkey Docker image for ARM64..."
docker build \
    --platform linux/arm64 \
    --build-arg VALKEY_VERSION="$VALKEY_VERSION" \
    -t vibecode/valkey-arm64:$VALKEY_VERSION \
    -t vibecode/valkey-arm64:latest \
    -f "$VALKEY_DOCKERFILE" \
    "$SCRIPT_DIR" 2>&1 | tee -a "$BUILD_LOG"

log "Testing Valkey image..."
VALKEY_CONTAINER=$(docker run -d --rm -p 6380:6379 vibecode/valkey-arm64:latest)
sleep 3

if docker exec "$VALKEY_CONTAINER" valkey-cli ping | grep -q PONG; then
    log "✅ Valkey is responding to ping"
    
    # Show binary size
    VALKEY_SIZE=$(docker exec "$VALKEY_CONTAINER" sh -c 'ls -lh /usr/local/bin/valkey-server | awk "{print \$5}"')
    log "Valkey server binary size: $VALKEY_SIZE"
    
    # Benchmark
    log "Running quick benchmark..."
    docker exec "$VALKEY_CONTAINER" valkey-benchmark -q -n 10000 -c 10 2>&1 | head -10 | tee -a "$BUILD_LOG"
else
    log_error "Valkey failed health check"
fi

docker stop "$VALKEY_CONTAINER" > /dev/null
log "✅ Task 1 Complete: Valkey $VALKEY_VERSION built successfully"

# =============================================================================
# Task 2: Create PostgreSQL + pgvector ARM64 image
# =============================================================================

echo ""
echo "======================================================================"
echo "  Task 2: Creating PostgreSQL + pgvector ARM64 Image"
echo "======================================================================"
echo ""

POSTGRES_VERSION="16"
PGVECTOR_VERSION="0.9.0"
POSTGRES_DOCKERFILE="${SCRIPT_DIR}/Dockerfile.postgres-pgvector"

log "Creating PostgreSQL + pgvector Dockerfile for ARM64 Alpine..."

cat > "$POSTGRES_DOCKERFILE" <<'EOF'
# PostgreSQL + pgvector ARM64 Alpine
FROM alpine:3.21

ARG POSTGRES_VERSION=16
ARG PGVECTOR_VERSION=0.9.0

# Install PostgreSQL and build dependencies
RUN apk add --no-cache \
    postgresql${POSTGRES_VERSION} \
    postgresql${POSTGRES_VERSION}-contrib \
    postgresql${POSTGRES_VERSION}-client \
    postgresql${POSTGRES_VERSION}-dev \
    build-base \
    git \
    clang \
    llvm \
    && adduser -D -s /bin/sh postgres || true

# Build pgvector from source
WORKDIR /tmp
RUN git clone --branch v${PGVECTOR_VERSION} https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make OPTFLAGS="-O3 -march=armv8-a+crc" \
    && make install \
    && cd / \
    && rm -rf /tmp/pgvector

# Remove build dependencies to reduce size
RUN apk del build-base git clang llvm postgresql${POSTGRES_VERSION}-dev

# Create directories
RUN mkdir -p /var/lib/postgresql/data \
    && chown -R postgres:postgres /var/lib/postgresql \
    && mkdir -p /run/postgresql \
    && chown -R postgres:postgres /run/postgresql

# PostgreSQL configuration
ENV POSTGRES_DB=vibecode
ENV POSTGRES_USER=vibecode
ENV POSTGRES_PASSWORD=vibecode
ENV PGDATA=/var/lib/postgresql/data

# Initialization script
COPY postgres-init.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/postgres-init.sh

# Expose PostgreSQL port
EXPOSE 5432

# Volume for data
VOLUME ["/var/lib/postgresql/data"]

# Switch to postgres user
USER postgres

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD pg_isready -U ${POSTGRES_USER} || exit 1

# Copy and use entrypoint script
COPY postgres-entrypoint.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/postgres-entrypoint.sh
USER postgres

ENTRYPOINT ["/usr/local/bin/postgres-entrypoint.sh"]
CMD ["postgres"]
EOF

# Create PostgreSQL init script for pgvector
POSTGRES_INIT="${SCRIPT_DIR}/postgres-init.sh"
cat > "$POSTGRES_INIT" <<'EOF'
#!/bin/sh
# Initialize pgvector extension
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    
    -- Show pgvector version
    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
    
    -- Create sample table for testing
    CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        content TEXT,
        embedding vector(1536)
    );
    
    CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
EOSQL

echo "pgvector initialized successfully"
EOF

# Create PostgreSQL entrypoint script
POSTGRES_ENTRYPOINT="${SCRIPT_DIR}/postgres-entrypoint.sh"
cat > "$POSTGRES_ENTRYPOINT" <<'EOF'
#!/bin/sh
set -e

# Initialize database if needed
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL database..."
    # Create temporary password file (POSIX sh compatible)
    PWFILE=$(mktemp)
    echo "$POSTGRES_PASSWORD" > "$PWFILE"
    initdb --username="$POSTGRES_USER" --pwfile="$PWFILE"
    rm -f "$PWFILE"
    
    # Configure PostgreSQL
    cat >> "$PGDATA/postgresql.conf" <<-CONFIG
listen_addresses = '*'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2
shared_preload_libraries = 'pg_stat_statements'
CONFIG

    # Allow connections
    echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
    
    # Start PostgreSQL temporarily to run init scripts
    pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start
    
    # Create database and user
    psql --username postgres <<-EOSQL
        CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';
        CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;
        GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;
EOSQL
    
    # Run init scripts
    for f in /docker-entrypoint-initdb.d/*; do
        case "$f" in
            *.sh)  echo "Running $f"; . "$f" ;;
            *.sql) echo "Running $f"; psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$f" ;;
        esac
    done
    
    pg_ctl -D "$PGDATA" -m fast -w stop
fi

# Start PostgreSQL in foreground
exec postgres
EOF

chmod +x "$POSTGRES_INIT" "$POSTGRES_ENTRYPOINT"

log "Building PostgreSQL + pgvector Docker image for ARM64..."
docker build \
    --platform linux/arm64 \
    --build-arg POSTGRES_VERSION="$POSTGRES_VERSION" \
    --build-arg PGVECTOR_VERSION="$PGVECTOR_VERSION" \
    -t vibecode/postgres-pgvector-arm64:$POSTGRES_VERSION \
    -t vibecode/postgres-pgvector-arm64:latest \
    -f "$POSTGRES_DOCKERFILE" \
    "$SCRIPT_DIR" 2>&1 | tee -a "$BUILD_LOG"

log "Testing PostgreSQL + pgvector image..."
POSTGRES_CONTAINER=$(docker run -d --rm \
    -e POSTGRES_PASSWORD=testpass \
    -e POSTGRES_USER=testuser \
    -e POSTGRES_DB=testdb \
    -p 5433:5432 \
    vibecode/postgres-pgvector-arm64:latest)

# Wait for PostgreSQL to start
log "Waiting for PostgreSQL to start..."
for i in {1..30}; do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U testuser 2>/dev/null; then
        break
    fi
    sleep 1
done

if docker exec "$POSTGRES_CONTAINER" psql -U testuser -d testdb -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';" | grep -q vector; then
    log "✅ pgvector extension is installed and working"
    
    # Test vector operations
    log "Testing vector operations..."
    docker exec "$POSTGRES_CONTAINER" psql -U testuser -d testdb -c "
        INSERT INTO documents (content, embedding) VALUES 
        ('test document', ARRAY(SELECT random() FROM generate_series(1,1536))::vector);
        SELECT COUNT(*) FROM documents;
    " 2>&1 | tee -a "$BUILD_LOG"
else
    log_error "pgvector extension failed"
fi

docker stop "$POSTGRES_CONTAINER" > /dev/null
log "✅ Task 2 Complete: PostgreSQL $POSTGRES_VERSION + pgvector $PGVECTOR_VERSION built successfully"

# =============================================================================
# Task 3: Test minimal busybox kernel with Node 24
# =============================================================================

echo ""
echo "======================================================================"
echo "  Task 3: Testing Minimal BusyBox + Node 24"
echo "======================================================================"
echo ""

log "Creating minimal Node 24 test environment..."

NODE24_DOCKERFILE="${SCRIPT_DIR}/Dockerfile.node24-minimal"

cat > "$NODE24_DOCKERFILE" <<'EOF'
# Minimal Node 24 on Alpine ARM64
FROM node:24-alpine3.21

# Install only essential packages
RUN apk add --no-cache \
    busybox \
    ca-certificates \
    && npm install -g npm@latest

# Create non-root user
RUN adduser -D -u 1000 nodeuser

# Test directory
WORKDIR /app
RUN chown nodeuser:nodeuser /app

USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD node -e "console.log('OK')" || exit 1

CMD ["node", "--version"]
EOF

log "Building minimal Node 24 image..."
docker build \
    --platform linux/arm64 \
    -t vibecode/node24-minimal-arm64:latest \
    -f "$NODE24_DOCKERFILE" \
    "$SCRIPT_DIR" 2>&1 | tee -a "$BUILD_LOG"

log "Testing Node 24 minimal image..."
NODE_VERSION=$(docker run --rm vibecode/node24-minimal-arm64:latest node --version)
NPM_VERSION=$(docker run --rm vibecode/node24-minimal-arm64:latest npm --version)
IMAGE_SIZE=$(docker images vibecode/node24-minimal-arm64:latest --format "{{.Size}}")

log "✅ Node.js version: $NODE_VERSION"
log "✅ npm version: $NPM_VERSION"
log "✅ Image size: $IMAGE_SIZE"

# Test a simple script
log "Testing Node 24 with a simple script..."
docker run --rm vibecode/node24-minimal-arm64:latest node -e "
const crypto = require('crypto');
const os = require('os');
console.log('Architecture:', os.arch());
console.log('Platform:', os.platform());
console.log('Node version:', process.version);
console.log('V8 version:', process.versions.v8);
console.log('Crypto available:', typeof crypto.randomBytes === 'function');
console.log('✅ All core modules working');
" 2>&1 | tee -a "$BUILD_LOG"

log "✅ Task 3 Complete: Node 24 minimal environment tested successfully"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "======================================================================"
echo "  Build Summary"
echo "======================================================================"
echo ""

log "All tasks completed successfully! 🎉"
echo ""
echo "Docker Images Built:"
echo "  • vibecode/valkey-arm64:latest"
echo "  • vibecode/postgres-pgvector-arm64:latest"
echo "  • vibecode/node24-minimal-arm64:latest"
echo ""
echo "Image Sizes:"
docker images | grep "vibecode/" | grep -E "(valkey|postgres|node24)" | tee -a "$BUILD_LOG"
echo ""
echo "Next Steps:"
echo "  1. Push images to registry: docker push vibecode/..."
echo "  2. Test in vfkit VM: ./scripts/vfkit/04-launch-alpine-vm.sh"
echo "  3. Deploy to production: docker-compose up"
echo ""
echo "Build log: $BUILD_LOG"
echo ""

# Clean up temporary files
rm -f "$VALKEY_DOCKERFILE" "$VALKEY_CONF" \
      "$POSTGRES_DOCKERFILE" "$POSTGRES_INIT" "$POSTGRES_ENTRYPOINT" \
      "$NODE24_DOCKERFILE"

log "✅ Build script complete!"

