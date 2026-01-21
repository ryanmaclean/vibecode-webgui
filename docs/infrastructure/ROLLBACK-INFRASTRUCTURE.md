# Infrastructure Rollback Runbook

## When to Rollback

- Application errors after migration
- Performance degradation > 20%
- Data integrity issues
- Connection failures

## Quick Rollback Commands

### PostgreSQL Rollback

```bash
# Stop new PostgreSQL
docker-compose stop postgres

# Restore docker-compose.yml to use postgres:16
# image: postgres:16

# Restore from backup
psql -h localhost -U postgres -d vibecode < backup_YYYYMMDD.sql

# Start old container
docker-compose up -d postgres

# Verify
psql -c "SELECT version();"
```

### Valkey → Redis Rollback

```bash
# Stop Valkey
docker-compose stop redis

# Restore docker-compose.yml to use redis:7-alpine
# image: redis:7-alpine

# Start Redis
docker-compose up -d redis

# Verify
redis-cli PING
```

### Kubernetes Rollback

```bash
# Rollback Helm release
helm rollback vibecode 1 -n vibecode-platform

# Or manually set old images
kubectl set image deployment/postgres postgres=postgres:16 -n vibecode-platform
kubectl set image deployment/redis redis=redis:7-alpine -n vibecode-platform

# Verify rollback
kubectl rollout status deployment/postgres -n vibecode-platform
```

## Post-Rollback Verification

1. Check application health endpoints
2. Verify database connections
3. Run smoke tests
4. Monitor error rates for 30 minutes

## Contact

- On-call: Check PagerDuty
- Slack: #vibecode-ops
