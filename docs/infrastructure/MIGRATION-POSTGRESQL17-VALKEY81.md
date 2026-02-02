# Infrastructure Migration: PostgreSQL 17, Valkey 8.1, pgvector 0.8.x

## Overview

This document covers the migration from PostgreSQL 16 to PostgreSQL 17, Redis to Valkey 8.1, and upgrading pgvector to 0.8.x.

## Pre-Migration Checklist

- [ ] Backup all databases
- [ ] Verify staging environment is ready
- [ ] Notify team of maintenance window
- [ ] Confirm rollback plan is documented

## Migration Steps

### 1. PostgreSQL 16 → 17 with pgvector

```bash
# Pull new image
docker pull pgvector/pgvector:pg17

# Backup existing data
pg_dump -h localhost -U postgres vibecode > backup_$(date +%Y%m%d).sql

# Stop old container
docker-compose stop postgres

# Update docker-compose.yml (already done)
# image: pgvector/pgvector:pg17

# Start new container
docker-compose up -d postgres

# Verify connection
psql -h localhost -U postgres -d vibecode -c "SELECT version();"

# Verify pgvector
psql -h localhost -U postgres -d vibecode -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. Redis → Valkey 8.1

```bash
# Pull new image
docker pull valkey/valkey:8.1-alpine

# Export Redis data (if needed)
redis-cli BGSAVE

# Stop old container
docker-compose stop redis

# Update docker-compose.yml (already done)
# image: valkey/valkey:8.1-alpine

# Start new container
docker-compose up -d redis

# Verify connection
redis-cli PING
```

### 3. Kubernetes Deployment

```bash
# Update Helm values
helm upgrade vibecode ./k8s/helm/vibecode \
  --set postgresql.image.tag=pg17 \
  --set valkey.image.tag=8.1-alpine

# Verify pods
kubectl get pods -n vibecode-platform
```

## Verification

```bash
# PostgreSQL version
psql -c "SELECT version();"
# Expected: PostgreSQL 17.x

# pgvector version
psql -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
# Expected: 0.8.x

# Valkey version
redis-cli INFO server | grep valkey_version
# Expected: 8.1.x
```

## Performance Benchmarks

Run after migration to validate improvements:

```bash
# PostgreSQL benchmark
pgbench -i -s 10 vibecode
pgbench -c 10 -j 2 -t 1000 vibecode

# Valkey benchmark
redis-benchmark -q -n 100000
```

## Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Query latency (p95) | baseline | -50% | 2x faster |
| Memory usage | baseline | -30% | More efficient |
| Vector search QPS | baseline | +300% | 4x throughput |

## Rollback Procedure

See [ROLLBACK-INFRASTRUCTURE.md](./ROLLBACK-INFRASTRUCTURE.md)
