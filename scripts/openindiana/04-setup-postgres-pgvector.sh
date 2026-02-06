#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

#
# Setup PostgreSQL 16 with pgvector extension
# Optimized for ZFS and vector workloads
#

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

POSTGRES_VERSION="16"
DB_NAME="vibecode"
DB_USER="vibecode"
DB_PASSWORD=""  # Will be generated

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check environment
check_environment() {
    if [ ! -f /etc/debian_version ]; then
        log_error "This script must be run inside the Debian lx zone"
        exit 1
    fi

    if [ "$(id -u)" -ne 0 ]; then
        log_error "This script must be run as root"
        exit 1
    fi

    log_info "Running in Debian lx zone as root"
}

# Generate secure password
generate_password() {
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    log_info "Generated secure database password"
}

# Install PostgreSQL
install_postgresql() {
    log_info "Installing PostgreSQL ${POSTGRES_VERSION}..."

    # Add PostgreSQL APT repository
    apt install -y postgresql-common
    /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y

    # Install PostgreSQL
    apt install -y \
        "postgresql-${POSTGRES_VERSION}" \
        "postgresql-contrib-${POSTGRES_VERSION}" \
        "postgresql-client-${POSTGRES_VERSION}" \
        "postgresql-server-dev-${POSTGRES_VERSION}"

    # Verify installation
    if ! systemctl is-active postgresql >/dev/null 2>&1; then
        log_error "PostgreSQL installation failed"
        exit 1
    fi

    log_info "PostgreSQL ${POSTGRES_VERSION} installed successfully"
}

# Install pgvector extension
install_pgvector() {
    log_info "Installing pgvector extension..."

    # Install from repository
    apt install -y "postgresql-${POSTGRES_VERSION}-pgvector"

    log_info "pgvector extension installed"
}

# Configure PostgreSQL for ZFS
configure_postgresql() {
    log_info "Configuring PostgreSQL for ZFS and performance..."

    PG_CONF="/etc/postgresql/${POSTGRES_VERSION}/main/postgresql.conf"
    PG_HBA="/etc/postgresql/${POSTGRES_VERSION}/main/pg_hba.conf"

    # Backup original config
    cp "$PG_CONF" "${PG_CONF}.backup"

    # Calculate memory settings (25% of RAM for shared_buffers)
    TOTAL_RAM_MB=$(free -m | awk '/^Mem:/ {print $2}')
    SHARED_BUFFERS_MB=$((TOTAL_RAM_MB / 4))
    EFFECTIVE_CACHE_SIZE_MB=$((TOTAL_RAM_MB * 3 / 4))

    log_info "Total RAM: ${TOTAL_RAM_MB}MB"
    log_info "Setting shared_buffers to ${SHARED_BUFFERS_MB}MB"
    log_info "Setting effective_cache_size to ${EFFECTIVE_CACHE_SIZE_MB}MB"

    # Append optimized settings
    cat >> "$PG_CONF" <<EOF

# ===================================
# VibeCode Optimizations for ZFS
# ===================================

# Memory Settings
shared_buffers = ${SHARED_BUFFERS_MB}MB
effective_cache_size = ${EFFECTIVE_CACHE_SIZE_MB}MB
maintenance_work_mem = 512MB
work_mem = 32MB

# ZFS Optimizations
wal_compression = on
full_page_writes = off  # ZFS provides data integrity
checkpoint_completion_target = 0.9

# Connection Settings
max_connections = 200
superuser_reserved_connections = 3

# Write-Ahead Log
wal_buffers = 16MB
wal_writer_delay = 200ms
wal_level = replica

# Query Planner
random_page_cost = 1.1  # ZFS with ARC
effective_io_concurrency = 200

# Vacuum Settings
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 10s

# Logging for Monitoring
log_min_duration_statement = 100
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Statistics
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

# Vector-specific optimizations
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
EOF

    # Configure authentication
    log_info "Configuring authentication..."

    # Allow local connections with md5
    cat >> "$PG_HBA" <<EOF

# VibeCode Application Access
host    $DB_NAME    $DB_USER    127.0.0.1/32    md5
host    $DB_NAME    $DB_USER    ::1/128         md5
EOF

    # Restart PostgreSQL
    log_info "Restarting PostgreSQL..."
    systemctl restart postgresql

    log_info "PostgreSQL configured successfully"
}

# Create database and user
setup_database() {
    log_info "Creating database and user..."

    sudo -u postgres psql <<EOF
-- Create user
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Create database
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\c $DB_NAME

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO $DB_USER;

-- Verify vector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
EOF

    log_info "Database '$DB_NAME' created with pgvector extension"
}

# Create test table with vectors
test_pgvector() {
    log_info "Testing pgvector functionality..."

    sudo -u postgres psql -d "$DB_NAME" <<EOF
-- Create test table with vector column
CREATE TABLE IF NOT EXISTS vector_test (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1536)
);

-- Insert test data
INSERT INTO vector_test (content, embedding)
VALUES ('test document', array_fill(0.1, ARRAY[1536])::vector);

-- Create vector index (IVFFlat)
CREATE INDEX ON vector_test USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Test similarity search
SELECT id, content, embedding <-> array_fill(0.1, ARRAY[1536])::vector AS distance
FROM vector_test
ORDER BY embedding <-> array_fill(0.1, ARRAY[1536])::vector
LIMIT 5;

-- Clean up test
DROP TABLE vector_test;
EOF

    log_info "pgvector test successful!"
}

# Configure data directory on ZFS
setup_zfs_data_dir() {
    log_info "Configuring PostgreSQL data directory on ZFS..."

    # Stop PostgreSQL
    systemctl stop postgresql

    # Get current data directory
    OLD_DATA_DIR="/var/lib/postgresql/${POSTGRES_VERSION}/main"
    NEW_DATA_DIR="/zones/vibecode-zone/postgres/data"

    # Create new directory structure
    mkdir -p "$NEW_DATA_DIR"
    chown -R postgres:postgres "/zones/vibecode-zone/postgres"

    # Copy data if not already moved
    if [ -d "$OLD_DATA_DIR" ] && [ ! -f "${NEW_DATA_DIR}/PG_VERSION" ]; then
        log_info "Moving data directory to ZFS dataset..."
        rsync -av "$OLD_DATA_DIR/" "$NEW_DATA_DIR/"
        chown -R postgres:postgres "$NEW_DATA_DIR"
    fi

    # Update PostgreSQL config to use new data directory
    sed -i "s|data_directory = '.*'|data_directory = '${NEW_DATA_DIR}'|" "$PG_CONF"

    # Start PostgreSQL
    systemctl start postgresql

    log_info "PostgreSQL data directory configured on ZFS"
}

# Setup automated backups
setup_backups() {
    log_info "Setting up automated backup script..."

    BACKUP_DIR="/zones/vibecode-zone/postgres/backups"
    mkdir -p "$BACKUP_DIR"
    chown postgres:postgres "$BACKUP_DIR"

    cat > /usr/local/bin/backup-postgres.sh <<'EOF'
#!/bin/bash
#
# PostgreSQL Backup Script
#

BACKUP_DIR="/zones/vibecode-zone/postgres/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup-$TIMESTAMP"

echo "[$(date)] Starting PostgreSQL backup..."

# Create base backup
sudo -u postgres pg_basebackup -D "$BACKUP_PATH" -F tar -z -P

# Create ZFS snapshot
zfs snapshot rpool/zones/vibecode-zone/postgres@backup-$TIMESTAMP

# Remove backups older than 7 days
find "$BACKUP_DIR" -type d -name "backup-*" -mtime +7 -exec rm -rf {} +

# Remove old snapshots (keep last 7)
zfs list -t snapshot | grep postgres | tail -n +8 | awk '{print $1}' | xargs -n1 zfs destroy

echo "[$(date)] Backup complete: $BACKUP_PATH"
EOF

    chmod +x /usr/local/bin/backup-postgres.sh

    # Add to cron (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1") | crontab -

    log_info "Automated backup configured (daily at 2 AM)"
}

# Save connection details
save_connection_details() {
    log_info "Saving connection details..."

    cat > /root/postgres-credentials.txt <<EOF
PostgreSQL Connection Details
=============================

Host: localhost
Port: 5432
Database: $DB_NAME
User: $DB_USER
Password: $DB_PASSWORD

Connection String:
postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

Connection URL (for .env):
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"

IMPORTANT: Keep this file secure!
EOF

    chmod 600 /root/postgres-credentials.txt

    log_info "Credentials saved to: /root/postgres-credentials.txt"
}

# Display summary
show_summary() {
    cat <<EOF

${GREEN}PostgreSQL Setup Complete!${NC}
================================

PostgreSQL Version: ${POSTGRES_VERSION}
Database: $DB_NAME
User: $DB_USER
Password: (saved in /root/postgres-credentials.txt)

Extensions Enabled:
  - vector (pgvector)
  - pg_stat_statements
  - btree_gin
  - btree_gist

Data Directory: /zones/vibecode-zone/postgres/data
Backup Directory: /zones/vibecode-zone/postgres/backups

Configuration:
  - Optimized for ZFS
  - Optimized for vector workloads
  - Daily automated backups at 2 AM
  - Connection logging enabled

Connection String:
  postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

Test Connection:
  psql -U $DB_USER -d $DB_NAME -h localhost

Next Steps:
  1. Run: ./05-deploy-vibecode.sh
  2. Update .env with DATABASE_URL

Useful Commands:
  - Status:     systemctl status postgresql
  - Logs:       tail -f /var/log/postgresql/postgresql-${POSTGRES_VERSION}-main.log
  - psql:       sudo -u postgres psql
  - Backup:     /usr/local/bin/backup-postgres.sh

EOF
}

# Main
main() {
    log_info "PostgreSQL + pgvector Setup"
    log_info "==========================="

    check_environment
    generate_password
    install_postgresql
    install_pgvector
    configure_postgresql
    setup_zfs_data_dir
    setup_database
    test_pgvector
    setup_backups
    save_connection_details
    show_summary
}

main "$@"
