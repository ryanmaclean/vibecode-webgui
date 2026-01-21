# PostgreSQL + pgvector Production Setup Guide

Complete guide for deploying PostgreSQL 16+ with pgvector extension for VibeCode's AI/RAG workloads on macOS ARM64 with vfkit.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Testing](#testing)
- [Performance Tuning](#performance-tuning)
- [Monitoring](#monitoring)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Production Checklist](#production-checklist)

---

## Overview

This setup provides a production-ready PostgreSQL 16+ database with pgvector extension optimized for:

- **Vector Embeddings Storage**: Store 1536-dimensional embeddings (OpenAI ada-002)
- **Similarity Search**: Fast cosine similarity queries using HNSW and IVFFlat indexes
- **RAG Workloads**: Retrieval-Augmented Generation for AI assistant
- **High Performance**: Optimized for 8GB RAM, 4 vCPUs, SSD storage
- **Production Ready**: SSL/TLS, backups, monitoring, replication-ready

### Key Features

- PostgreSQL 16.x (latest stable)
- pgvector 0.8.0+ (vector extension)
- HNSW indexing (high recall, fast queries)
- IVFFlat indexing (fast builds, good for smaller datasets)
- Optimized configuration for vector workloads
- SSL/TLS encryption
- Automated backups
- Performance monitoring (pg_stat_statements)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Host Machine (macOS ARM64)              │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │           VibeCode Application (Node.js)              │ │
│  │                                                       │ │
│  │  ├─ Prisma ORM                                       │ │
│  │  ├─ PostgresVectorDatabaseAdapter                    │ │
│  │  └─ Vector Cache Manager                            │ │
│  └───────────────┬───────────────────────────────────────┘ │
│                  │ TCP/IP: localhost:5432                  │
│                  │ SSL/TLS Encrypted                        │
│  ┌───────────────▼───────────────────────────────────────┐ │
│  │             vfkit VM (Alpine ARM64)                   │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │      PostgreSQL 16 + pgvector 0.8.0           │ │ │
│  │  │                                                 │ │ │
│  │  │  ├─ vibecode database                          │ │ │
│  │  │  ├─ rag_chunks table (vector embeddings)       │ │ │
│  │  │  ├─ HNSW indexes (fast similarity search)      │ │ │
│  │  │  └─ IVFFlat indexes (efficient builds)         │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                       │ │
│  │  Storage Volumes:                                     │ │
│  │  ├─ /dev/vda: 20GB (OS + PostgreSQL)                │ │
│  │  ├─ /dev/vdb: 100GB (Data + WAL + Indexes)          │ │
│  │  └─ /dev/vdc: 50GB (Backups)                        │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

- **OS**: macOS 11+ (Big Sur or later)
- **Architecture**: ARM64 (Apple Silicon)
- **RAM**: 16GB+ recommended (8GB minimum)
- **Disk**: 200GB+ free space
- **CPU**: 4+ cores recommended

### Software Requirements

```bash
# Install vfkit (VM runtime)
brew install vfkit

# Install PostgreSQL client tools (for testing)
brew install postgresql@16

# Verify installations
vfkit --version
psql --version
```

### Required Files

Ensure these files exist in your VibeCode repository:

```
vibecode-webgui/
├── config/
│   ├── vfkit/
│   │   └── postgresql-pgvector-vm.yaml    # VM configuration
│   └── postgresql/
│       ├── postgresql.conf                 # PostgreSQL configuration
│       ├── pg_hba.conf                     # Authentication config
│       └── init.sql                        # Database initialization
```

---

## Installation

### Step 1: Prepare Kernel and Initrd

Download Alpine Linux ARM64 kernel and initramfs:

```bash
# Create directories
sudo mkdir -p /opt/vibecode/{kernels,initrd,disks}

# Download Alpine Linux ARM64 virt kernel
cd /opt/vibecode/kernels
wget https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-virt-3.19.0-aarch64.iso
# Extract vmlinuz-virt and initramfs-virt from ISO

# Alternative: Build from source or use pre-built binaries
# See: https://wiki.alpinelinux.org/wiki/Create_a_Bootable_Device
```

### Step 2: Create VM Disk Images

```bash
# Create disk images
cd /opt/vibecode/disks

# Root filesystem (20GB)
dd if=/dev/zero of=pgvector-vm.img bs=1m count=20480

# Data volume (100GB)
dd if=/dev/zero of=pgvector-data.img bs=1m count=102400

# Backup volume (50GB)
dd if=/dev/zero of=pgvector-backup.img bs=1m count=51200

# Set permissions
sudo chown $USER:staff *.img
chmod 644 *.img
```

### Step 3: Copy Configuration Files

```bash
# Copy init.sql to a location accessible by the VM
sudo mkdir -p /opt/vibecode/config
sudo cp config/postgresql/init.sql /opt/vibecode/config/
sudo chmod 644 /opt/vibecode/config/init.sql
```

### Step 4: Launch PostgreSQL VM

```bash
# Navigate to config directory
cd /Users/ryan.maclean/vibecode-webgui

# Launch VM with vfkit
vfkit --config config/vfkit/postgresql-pgvector-vm.yaml

# This will:
# 1. Boot Alpine Linux
# 2. Install PostgreSQL 16
# 3. Build and install pgvector
# 4. Initialize database cluster
# 5. Apply optimized configuration
# 6. Run init.sql
# 7. Start PostgreSQL server
```

**Expected Output:**

```
==========================================
VibeCode PostgreSQL + pgvector Setup
==========================================
[1/10] Updating system packages...
[2/10] Installing PostgreSQL 16 and dependencies...
[3/10] Building and installing pgvector 0.8.0...
[4/10] Setting up PostgreSQL user and directories...
[5/10] Mounting data and backup volumes...
[6/10] Initializing PostgreSQL cluster...
[7/10] Configuring PostgreSQL for vector workloads...
[8/10] Configuring authentication (pg_hba.conf)...
[9/10] Generating SSL certificates...
[10/10] Starting PostgreSQL...
==========================================
PostgreSQL + pgvector Setup Complete!
==========================================

Connection Details:
  Host:     localhost
  Port:     5432
  Database: vibecode
  User:     vibecode
  Password: vibecode_prod_2024
```

### Step 5: Verify Installation

```bash
# Test connection from host machine
psql -h localhost -p 5432 -U vibecode -d vibecode

# Verify pgvector extension
vibecode=> \dx
                                     List of installed extensions
        Name        | Version |   Schema   |                        Description
--------------------+---------+------------+-----------------------------------------------------------
 pg_stat_statements | 1.10    | public     | track planning and execution statistics of all SQL statements
 pgcrypto           | 1.3     | public     | cryptographic functions
 uuid-ossp          | 1.1     | public     | generate universally unique identifiers (UUIDs)
 vector             | 0.8.0   | public     | vector data type and ivfflat and hnsw access methods

# Test vector operations
vibecode=> SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector;
   ?column?
--------------
 0.0255650552
(1 row)
```

---

## Configuration

### Environment Variables

Update your `.env` file:

```bash
# PostgreSQL Connection
DATABASE_URL="postgresql://vibecode:vibecode_prod_2024@localhost:5432/vibecode?sslmode=require"

# Connection Pool Settings
POSTGRES_POOL_SIZE=20
POSTGRES_MAX_CONNECTIONS=100

# Vector Database Settings
VECTOR_DB_PROVIDER="postgres"
VECTOR_DB_CACHE_ENABLED=true
VECTOR_DB_BATCH_SIZE=5
```

### Prisma Configuration

Update `prisma/schema.prisma` to enable pgvector:

```prisma
model RAGChunk {
  id          Int      @id @default(autoincrement())
  content     String
  metadata    Json?
  file_id     Int?
  user_id     Int
  workspace_id Int?
  project_id  Int?
  chunk_index Int?
  token_count Int?
  start_line  Int?
  end_line    Int?
  tokens      Int?
  chunk_id    String?
  embedding   Unsupported("vector(1536)")?  // pgvector support
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  // ... relations ...

  @@index([user_id])
  @@index([file_id])
  @@index([workspace_id])
  @@map("rag_chunks")
}
```

### Run Prisma Migrations

```bash
# Generate Prisma client
npx prisma generate

# Deploy migrations
npx prisma migrate deploy

# Verify schema
npx prisma db pull
```

---

## Testing

### 1. Basic Vector Operations

```sql
-- Connect to database
psql -h localhost -p 5432 -U vibecode -d vibecode

-- Test vector creation
SELECT '[1,2,3]'::vector;

-- Test vector addition
SELECT '[1,2,3]'::vector + '[4,5,6]'::vector;

-- Test cosine distance
SELECT '[1,0,0]'::vector <=> '[1,0,0]'::vector;  -- Should be 0
SELECT '[1,0,0]'::vector <=> '[0,1,0]'::vector;  -- Should be 1
```

### 2. Similarity Search

```sql
-- Switch to test schema
SET search_path TO vector_test, public;

-- Find similar code chunks
SELECT
    chunk_id,
    LEFT(content, 50) || '...' as preview,
    language,
    1 - (embedding <=> array_fill(0.3, ARRAY[1536])::vector) AS similarity
FROM code_embeddings
WHERE 1 - (embedding <=> array_fill(0.3, ARRAY[1536])::vector) > 0.5
ORDER BY embedding <=> array_fill(0.3, ARRAY[1536])::vector
LIMIT 5;
```

### 3. Index Performance

```sql
-- Verify indexes are being used
EXPLAIN ANALYZE
SELECT chunk_id, embedding <=> array_fill(0, ARRAY[1536])::vector AS distance
FROM code_embeddings
ORDER BY embedding <=> array_fill(0, ARRAY[1536])::vector
LIMIT 10;

-- Should show "Index Scan using idx_code_embeddings_ivfflat"
```

### 4. Helper Functions

```sql
-- Use helper function for similarity search
SELECT * FROM find_similar_code(
    array_fill(0.3, ARRAY[1536])::vector,
    0.5,  -- threshold
    10    -- limit
);

-- Get vector statistics
SELECT * FROM get_vector_stats();
```

### 5. Application Integration Test

```typescript
// test-vector-db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVectorSearch() {
    // Insert test embedding
    await prisma.$executeRaw`
        INSERT INTO rag_chunks (
            file_id, chunk_id, content, tokens, embedding, user_id, created_at
        ) VALUES (
            1,
            'test-chunk-1',
            'function calculateDistance(p1, p2) { return Math.sqrt(...); }',
            45,
            array_fill(0.5, ARRAY[1536])::vector,
            1,
            NOW()
        )
    `;

    // Perform similarity search
    const results = await prisma.$queryRaw`
        SELECT
            chunk_id,
            content,
            1 - (embedding <=> array_fill(0.5, ARRAY[1536])::vector) AS similarity
        FROM rag_chunks
        WHERE 1 - (embedding <=> array_fill(0.5, ARRAY[1536])::vector) > 0.7
        ORDER BY embedding <=> array_fill(0.5, ARRAY[1536])::vector
        LIMIT 5
    `;

    console.log('Search results:', results);
}

testVectorSearch();
```

```bash
# Run test
npx ts-node test-vector-db.ts
```

---

## Performance Tuning

### Vector Index Selection

#### HNSW (Hierarchical Navigable Small World)

**Best for**: High recall, faster queries, larger datasets

```sql
CREATE INDEX idx_embeddings_hnsw
ON rag_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Parameters:
-- m: Max connections per layer (16 recommended, range: 4-64)
--    Higher = better recall, more memory
-- ef_construction: Size of dynamic candidate list (64 recommended, range: 4-200)
--    Higher = better quality, slower builds
```

**Performance characteristics**:
- Build time: Slower (O(n log n))
- Query time: Faster (O(log n))
- Memory: Higher
- Recall: Better (95-99%)
- Best for: > 100K vectors

#### IVFFlat (Inverted File with Flat Compression)

**Best for**: Faster builds, smaller datasets

```sql
CREATE INDEX idx_embeddings_ivfflat
ON rag_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Parameters:
-- lists: Number of clusters
--   For < 1M rows: rows / 1000
--   For > 1M rows: sqrt(rows)
--   Example: 100K rows → 100 lists
--            1M rows → 1000 lists
```

**Performance characteristics**:
- Build time: Faster (O(n))
- Query time: Slower (O(n/lists))
- Memory: Lower
- Recall: Good (90-95%)
- Best for: < 100K vectors

### Query Optimization

#### Set ef_search for HNSW queries

```sql
-- Higher ef_search = better recall, slower queries
SET hnsw.ef_search = 40;  -- Default: 40, range: 10-200

-- For high-recall queries
SET hnsw.ef_search = 100;

-- For faster queries
SET hnsw.ef_search = 20;
```

#### Set probes for IVFFlat queries

```sql
-- Higher probes = better recall, slower queries
SET ivfflat.probes = 10;  -- Default: 1, range: 1-lists

-- For high-recall queries
SET ivfflat.probes = 20;

-- For faster queries
SET ivfflat.probes = 5;
```

### Memory Tuning

```sql
-- For large batch inserts
SET maintenance_work_mem = '1GB';

-- For complex vector queries
SET work_mem = '128MB';

-- Reset to default
RESET ALL;
```

### Parallel Query Execution

```sql
-- Enable parallel index scans
SET max_parallel_workers_per_gather = 4;
SET parallel_setup_cost = 100;

-- Verify parallel execution
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM rag_chunks
WHERE embedding <=> array_fill(0, ARRAY[1536])::vector < 0.5
LIMIT 100;
```

---

## Monitoring

### Query Performance

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    stddev_exec_time,
    rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

### Index Usage

```sql
-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check unused indexes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND schemaname = 'public';
```

### Database Size

```sql
-- Database size
SELECT
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;

-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Connection Monitoring

```sql
-- Active connections
SELECT
    datname,
    usename,
    application_name,
    client_addr,
    state,
    query,
    query_start
FROM pg_stat_activity
WHERE datname = 'vibecode'
ORDER BY query_start;

-- Connection counts by state
SELECT
    state,
    COUNT(*) as count
FROM pg_stat_activity
GROUP BY state;
```

### Cache Hit Ratio

```sql
-- Buffer cache hit ratio (should be > 99%)
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;

-- Index cache hit ratio
SELECT
    sum(idx_blks_read) as idx_read,
    sum(idx_blks_hit) as idx_hit,
    sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read)) as ratio
FROM pg_statio_user_indexes;
```

---

## Backup and Recovery

### Automated Backups

#### Daily Backups (pg_dump)

```bash
#!/bin/bash
# /opt/vibecode/scripts/backup-postgres.sh

BACKUP_DIR="/mnt/backup/daily"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="vibecode"

# Create backup directory
mkdir -p $BACKUP_DIR

# Run pg_dump
pg_dump -h localhost -U postgres -F c -b -v \
    -f $BACKUP_DIR/vibecode_$DATE.backup $DB_NAME

# Compress backup
gzip $BACKUP_DIR/vibecode_$DATE.backup

# Retain last 7 days
find $BACKUP_DIR -name "*.backup.gz" -mtime +7 -delete

echo "Backup completed: vibecode_$DATE.backup.gz"
```

#### Continuous Archiving (WAL)

WAL archiving is already configured in `postgresql.conf`:

```conf
archive_mode = on
archive_command = 'test ! -f /mnt/backup/wal/%f && cp %p /mnt/backup/wal/%f'
```

### Point-in-Time Recovery (PITR)

```bash
# 1. Stop PostgreSQL
pg_ctl stop -D /var/lib/postgresql/data

# 2. Restore base backup
rm -rf /var/lib/postgresql/data/*
pg_restore -d vibecode /mnt/backup/daily/vibecode_YYYYMMDD.backup

# 3. Create recovery.conf
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'cp /mnt/backup/wal/%f %p'
recovery_target_time = '2024-10-28 12:00:00'
recovery_target_action = 'promote'
EOF

# 4. Start PostgreSQL
pg_ctl start -D /var/lib/postgresql/data
```

### Backup Verification

```bash
# Test backup restore
pg_restore --list /mnt/backup/daily/vibecode_YYYYMMDD.backup

# Verify WAL archives
ls -lh /mnt/backup/wal/
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused

**Symptom**: `psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: Connection refused`

**Solution**:

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check VM network
vfkit list

# Check port forwarding in VM config
grep -A 5 "network:" config/vfkit/postgresql-pgvector-vm.yaml

# Restart VM
vfkit stop vibecode-pgvector-db
vfkit start --config config/vfkit/postgresql-pgvector-vm.yaml
```

#### 2. pgvector Extension Not Found

**Symptom**: `ERROR: extension "vector" is not available`

**Solution**:

```bash
# Connect to VM
vfkit ssh vibecode-pgvector-db

# Verify pgvector installation
ls -la /usr/lib/postgresql/16/lib/vector.so

# Rebuild pgvector
cd /tmp
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make USE_PGXS=1
make install USE_PGXS=1

# Restart PostgreSQL
pg_ctl restart -D /var/lib/postgresql/data
```

#### 3. Slow Vector Queries

**Symptom**: Queries taking > 1 second

**Solution**:

```sql
-- Verify indexes exist
\d rag_chunks

-- Rebuild indexes
REINDEX INDEX idx_embeddings_hnsw;
REINDEX INDEX idx_embeddings_ivfflat;

-- Update statistics
ANALYZE rag_chunks;

-- Increase work_mem
SET work_mem = '128MB';

-- Tune HNSW ef_search
SET hnsw.ef_search = 100;
```

#### 4. Out of Memory

**Symptom**: `ERROR: out of memory`

**Solution**:

```sql
-- Reduce work_mem
ALTER SYSTEM SET work_mem = '32MB';
SELECT pg_reload_conf();

-- Reduce maintenance_work_mem
ALTER SYSTEM SET maintenance_work_mem = '256MB';
SELECT pg_reload_conf();

-- Check memory usage
SELECT
    name,
    setting,
    unit
FROM pg_settings
WHERE name IN ('shared_buffers', 'work_mem', 'maintenance_work_mem');
```

#### 5. Authentication Failed

**Symptom**: `FATAL: password authentication failed for user "vibecode"`

**Solution**:

```bash
# Reset password
psql -U postgres
ALTER USER vibecode WITH PASSWORD 'vibecode_prod_2024';

# Check pg_hba.conf
cat /var/lib/postgresql/data/pg_hba.conf

# Reload configuration
SELECT pg_reload_conf();

# Test connection
psql -h localhost -p 5432 -U vibecode -d vibecode
```

### Logs

```bash
# View PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log

# View startup logs
less /var/log/postgresql/postgresql-$(date +%Y-%m-%d)*.log

# Search for errors
grep ERROR /var/log/postgresql/postgresql-*.log

# Search for slow queries
grep "duration:" /var/log/postgresql/postgresql-*.log | grep -v "duration: 0"
```

### Performance Analysis

```sql
-- Identify blocking queries
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Check for table bloat
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup,
    n_dead_tup,
    ROUND(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_percent
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

---

## Production Checklist

### Security

- [ ] Change default passwords
  ```sql
  ALTER USER postgres WITH PASSWORD 'STRONG_PASSWORD_HERE';
  ALTER USER vibecode WITH PASSWORD 'STRONG_PASSWORD_HERE';
  ```

- [ ] Update `pg_hba.conf` to restrict access
  ```conf
  # Remove development "allow all" rules
  # Add specific IP ranges only
  host    vibecode    vibecode    192.168.1.0/24    scram-sha-256
  ```

- [ ] Enable SSL/TLS enforcement
  ```conf
  # In pg_hba.conf
  hostssl    all    all    0.0.0.0/0    scram-sha-256
  hostnossl  all    all    0.0.0.0/0    reject
  ```

- [ ] Generate production SSL certificates
  ```bash
  # Replace self-signed with CA-signed certificates
  openssl req -new -key server.key -out server.csr
  # Send CSR to CA, receive signed certificate
  ```

- [ ] Configure firewall rules
  ```bash
  # Allow PostgreSQL port only from application servers
  sudo ufw allow from 192.168.1.0/24 to any port 5432
  ```

### Performance

- [ ] Tune `shared_buffers` based on RAM
  ```sql
  -- For 16GB RAM: shared_buffers = 4GB
  ALTER SYSTEM SET shared_buffers = '4GB';
  ```

- [ ] Adjust `work_mem` for workload
  ```sql
  -- Monitor and adjust based on query patterns
  ALTER SYSTEM SET work_mem = '128MB';
  ```

- [ ] Configure connection pooling (PgBouncer)
  ```bash
  # Install PgBouncer
  brew install pgbouncer

  # Configure /usr/local/etc/pgbouncer.ini
  [databases]
  vibecode = host=localhost port=5432 dbname=vibecode

  [pgbouncer]
  pool_mode = transaction
  max_client_conn = 100
  default_pool_size = 20
  ```

- [ ] Set up read replicas (if needed)
  ```sql
  -- On primary
  ALTER SYSTEM SET wal_level = replica;
  ALTER SYSTEM SET max_wal_senders = 3;
  SELECT pg_reload_conf();
  ```

### Monitoring

- [ ] Set up pg_stat_statements
  ```sql
  CREATE EXTENSION pg_stat_statements;
  ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
  ```

- [ ] Configure log rotation
  ```bash
  # /etc/logrotate.d/postgresql
  /var/log/postgresql/*.log {
      daily
      rotate 7
      compress
      delaycompress
      missingok
      notifempty
  }
  ```

- [ ] Set up monitoring (Prometheus + Grafana)
  ```bash
  # Install postgres_exporter
  brew install postgres_exporter

  # Configure metrics endpoint
  postgres_exporter --web.listen-address=:9187
  ```

- [ ] Configure alerting
  ```yaml
  # prometheus-alerts.yaml
  groups:
    - name: postgresql
      rules:
        - alert: PostgreSQLDown
          expr: pg_up == 0
          for: 1m
        - alert: SlowQueries
          expr: rate(pg_stat_statements_mean_exec_time[5m]) > 1000
  ```

### Backup

- [ ] Configure automated backups
  ```bash
  # Add to crontab
  0 2 * * * /opt/vibecode/scripts/backup-postgres.sh
  ```

- [ ] Test backup restoration
  ```bash
  pg_restore -d vibecode_test /mnt/backup/daily/latest.backup
  ```

- [ ] Set up offsite backup sync
  ```bash
  # Sync to S3/B2/etc.
  rsync -avz /mnt/backup/ user@backup-server:/backups/vibecode/
  ```

- [ ] Document recovery procedures
  ```markdown
  1. Stop application
  2. Restore base backup
  3. Apply WAL archives
  4. Start PostgreSQL
  5. Verify data integrity
  6. Start application
  ```

### Documentation

- [ ] Update `.env.example` with connection strings
- [ ] Document schema changes in migrations
- [ ] Create runbook for common operations
- [ ] Document performance tuning parameters
- [ ] Create disaster recovery plan

---

## Additional Resources

### Official Documentation

- [PostgreSQL Documentation](https://www.postgresql.org/docs/16/index.html)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [pgvector Documentation](https://github.com/pgvector/pgvector#readme)
- [vfkit Documentation](https://github.com/crc-org/vfkit)

### Performance Tuning

- [PGTune](https://pgtune.leopard.in.ua/) - PostgreSQL configuration wizard
- [explain.depesz.com](https://explain.depesz.com/) - EXPLAIN analyzer
- [pgMustard](https://www.pgmustard.com/) - Query performance insights

### Monitoring Tools

- [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [pgAdmin](https://www.pgadmin.org/)
- [DBeaver](https://dbeaver.io/)
- [Datadog PostgreSQL Integration](https://docs.datadoghq.com/integrations/postgres/)

### Community

- [PostgreSQL Slack](https://postgres-slack.herokuapp.com/)
- [pgvector Issues](https://github.com/pgvector/pgvector/issues)
- [PostgreSQL Mailing Lists](https://www.postgresql.org/list/)

---

## Summary

You now have a production-ready PostgreSQL 16+ database with pgvector extension optimized for VibeCode's AI/RAG workloads:

✅ **High Performance**: HNSW and IVFFlat indexes for fast similarity search
✅ **Production Ready**: SSL/TLS, backups, monitoring, replication-ready
✅ **Optimized**: Tuned for 8GB RAM, 4 vCPUs, SSD storage
✅ **Tested**: Sample data and helper functions included
✅ **Documented**: Complete setup, configuration, and troubleshooting guide

**Next Steps**:

1. Update your application's `.env` file
2. Run Prisma migrations
3. Test vector search functionality
4. Monitor query performance
5. Set up automated backups
6. Review security checklist

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section or consult the official documentation.

---

**Last Updated**: 2024-10-28
**PostgreSQL Version**: 16.x
**pgvector Version**: 0.7.4
**Platform**: macOS ARM64 (Apple Silicon)
