# AgentAPI Database Deployment Checklist

**Owner:** Database Team
**Date:** 2025-10-02
**Estimated Time:** 2-3 hours
**Rollback Time:** 30 minutes

---

## Pre-Deployment Checklist

### 1. Infrastructure Verification

- [ ] PostgreSQL 14+ running and accessible
- [ ] Redis 7+ running and accessible
- [ ] Persistent volumes configured (500GB+ for PostgreSQL, 20GB+ for Redis)
- [ ] Backup storage available (500GB+ off-site)
- [ ] Database admin credentials ready
- [ ] Network connectivity verified (app ↔ database ↔ Redis)

### 2. Backup Validation

- [ ] Latest full database backup exists (<24 hours old)
- [ ] WAL archiving enabled and tested
- [ ] Redis RDB snapshot exists (<1 hour old)
- [ ] Backup restoration tested in staging (last 7 days)
- [ ] Rollback procedure documented

### 3. Environment Configuration

- [ ] `DATABASE_URL` environment variable set
- [ ] `REDIS_URL` environment variable set
- [ ] Connection pool size configured (20-50)
- [ ] Redis dedicated database selected (DB 1)
- [ ] TLS enabled for production
- [ ] Secrets properly encrypted

### 4. Code Review

- [ ] Migration SQL reviewed and approved
- [ ] Prisma schema changes reviewed
- [ ] Query optimization validated
- [ ] Indexes verified in EXPLAIN plans
- [ ] Rate limiting thresholds approved
- [ ] TTL values validated

---

## Deployment Steps

### Phase 1: Database Schema (30 minutes)

#### Step 1.1: Run Migrations

```bash
# Verify database connectivity
psql $DATABASE_URL -c "SELECT NOW();"

# Generate Prisma client
cd /Users/ryan.maclean/vibecode-webgui
npx prisma generate

# Run migration (creates all tables, indexes, functions)
psql $DATABASE_URL -f prisma/migrations/20251002_agentapi_integration/migration.sql
```

**Checkpoint:**
- [ ] All tables created successfully
- [ ] All indexes created successfully
- [ ] Materialized view created
- [ ] Functions created (archive, cleanup, refresh)
- [ ] No errors in migration log

#### Step 1.2: Verify Schema

```bash
# Check table creation
psql $DATABASE_URL -c "\dt agent_*"

# Check index creation
psql $DATABASE_URL -c "\di agent_*"

# Verify functions
psql $DATABASE_URL -c "\df archive_old_*"
```

**Expected Output:**
```
agent_sessions
agent_conversations
agent_health_metrics
agent_events
agent_rate_limits
agent_session_stats (materialized view)
```

- [ ] 5 tables exist
- [ ] 15+ indexes exist
- [ ] 3 maintenance functions exist
- [ ] Materialized view exists

#### Step 1.3: Set Permissions

```bash
# Grant application user access
psql $DATABASE_URL <<EOF
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vibecode_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vibecode_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO vibecode_app;
EOF
```

- [ ] Permissions granted
- [ ] Application user can query tables

### Phase 2: Redis Configuration (15 minutes)

#### Step 2.1: Configure Redis

```bash
# Connect to Redis
redis-cli -h $REDIS_HOST -p $REDIS_PORT

# Select dedicated database
SELECT 1

# Configure memory settings
CONFIG SET maxmemory 8gb
CONFIG SET maxmemory-policy allkeys-lru
CONFIG REWRITE

# Enable persistence
CONFIG SET save "900 1 300 10 60 10000"
CONFIG SET appendonly yes
CONFIG SET appendfsync everysec
CONFIG REWRITE
```

- [ ] Database 1 selected
- [ ] Memory limit set
- [ ] Eviction policy configured
- [ ] Persistence enabled
- [ ] Configuration saved

#### Step 2.2: Verify Redis

```bash
# Test connectivity
redis-cli -u $REDIS_URL PING  # Should return PONG

# Check configuration
redis-cli -u $REDIS_URL CONFIG GET maxmemory
redis-cli -u $REDIS_URL CONFIG GET appendonly

# Test set/get
redis-cli -u $REDIS_URL SET test:key "test:value" EX 60
redis-cli -u $REDIS_URL GET test:key
redis-cli -u $REDIS_URL TTL test:key
```

- [ ] PING returns PONG
- [ ] Configuration values correct
- [ ] Test key set/get works
- [ ] TTL works correctly

### Phase 3: Application Deployment (45 minutes)

#### Step 3.1: Update Environment Variables

```bash
# Update .env or Kubernetes ConfigMap
export DATABASE_URL="postgresql://vibecode_app:password@postgres:5432/vibecode?connection_limit=20"
export REDIS_URL="redis://redis:6379/1"
export REDIS_AGENT_DB="1"

# Restart application
kubectl rollout restart deployment/vibecode-webgui -n vibecode
```

- [ ] Environment variables updated
- [ ] Application restarted
- [ ] No startup errors in logs

#### Step 3.2: Deploy Cron Jobs

```bash
# Apply Kubernetes CronJob manifests
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: agentapi-stats-refresh
  namespace: vibecode
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: refresh-stats
            image: vibecode/database-maintenance:latest
            command: ["psql", "-c", "REFRESH MATERIALIZED VIEW CONCURRENTLY agent_session_stats;"]
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
          restartPolicy: OnFailure
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: agentapi-archive-old-data
  namespace: vibecode
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: archive-data
            image: vibecode/database-maintenance:latest
            command:
            - /bin/sh
            - -c
            - |
              psql -c "SELECT archive_old_agent_conversations();"
              psql -c "SELECT archive_old_agent_metrics();"
              psql -c "SELECT cleanup_stale_agent_sessions();"
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
          restartPolicy: OnFailure
EOF
```

- [ ] Stats refresh CronJob created (every 5 minutes)
- [ ] Archive CronJob created (daily at 2 AM)
- [ ] CronJobs scheduled correctly
- [ ] Manual test run successful

### Phase 4: Smoke Tests (30 minutes)

#### Step 4.1: Database Operations

```bash
# Test agent session creation
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "workspaceId": 1,
    "agentType": "aider",
    "config": {
      "model": "claude-3-7-sonnet-20250219"
    }
  }'
```

**Expected Response (201 Created):**
```json
{
  "agentId": "agent-xyz789",
  "workspaceId": 1,
  "status": "starting",
  "agentapiUrl": "http://agentapi-ws-abc123:8766",
  "createdAt": "2025-10-02T10:30:00Z"
}
```

- [ ] Agent created successfully
- [ ] Response contains valid `agentId`
- [ ] Database record exists
- [ ] Cache entry exists

#### Step 4.2: Verify Database

```bash
# Check session record
psql $DATABASE_URL -c "SELECT id, status, agent_type FROM agent_sessions LIMIT 1;"

# Check indexes used
psql $DATABASE_URL -c "EXPLAIN SELECT * FROM agent_sessions WHERE workspace_id = 1 AND deleted_at IS NULL;"
```

- [ ] Session record exists
- [ ] Status is 'starting' or 'ready'
- [ ] Query uses index (Index Scan, not Seq Scan)

#### Step 4.3: Verify Cache

```bash
# Check Redis cache
redis-cli -u $REDIS_URL GET "agent:session:agent-xyz789"

# Check workspace agent count
redis-cli -u $REDIS_URL GET "agent:workspace:1:count"
```

- [ ] Cache entry exists
- [ ] Workspace count updated

#### Step 4.4: Test Message Flow

```bash
# Send message to agent
curl -X POST http://localhost:3000/api/agents/agent-xyz789/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "message": "Hello, test message",
    "options": { "streaming": false }
  }'
```

- [ ] Message sent successfully
- [ ] Conversation record created
- [ ] Token counts recorded
- [ ] Latency tracked

#### Step 4.5: Verify Metrics

```bash
# Check health metrics table
psql $DATABASE_URL -c "SELECT COUNT(*) FROM agent_health_metrics;"

# Check events table
psql $DATABASE_URL -c "SELECT event_type, COUNT(*) FROM agent_events GROUP BY event_type;"
```

- [ ] Health metrics recorded
- [ ] Events logged (agent_created, message_sent)

### Phase 5: Performance Validation (30 minutes)

#### Step 5.1: Query Performance

```bash
# Test session lookup latency
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM agent_sessions WHERE id = 'agent-xyz789';"
```

**Target:** Execution Time <50ms

- [ ] Query execution <50ms
- [ ] Uses primary key index
- [ ] No table scans

#### Step 5.2: Cache Performance

```bash
# Measure cache hit rate
for i in {1..100}; do
  redis-cli -u $REDIS_URL GET "agent:session:agent-xyz789" > /dev/null
done

redis-cli -u $REDIS_URL INFO stats | grep keyspace_hits
redis-cli -u $REDIS_URL INFO stats | grep keyspace_misses
```

**Target:** >90% hit rate

- [ ] Cache hit rate >90%
- [ ] Latency <10ms average

#### Step 5.3: Load Test (Optional)

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery quick --count 50 --num 100 http://localhost:3000/api/agents
```

**Targets:**
- P95 latency <100ms
- Error rate <1%
- No connection pool exhaustion

- [ ] Load test passed
- [ ] No errors in logs
- [ ] Database connections stable

---

## Post-Deployment Checklist

### 1. Monitoring Setup

- [ ] Datadog dashboard created
- [ ] Alert rules configured
- [ ] Slack notifications enabled
- [ ] On-call team notified

### 2. Documentation

- [ ] Deployment completed timestamp recorded
- [ ] Architecture documentation reviewed
- [ ] Runbook updated with production details
- [ ] Team knowledge transfer completed

### 3. Validation

- [ ] All smoke tests passed
- [ ] Performance targets met
- [ ] No errors in logs (15-minute observation)
- [ ] Backup job executed successfully
- [ ] Monitoring data flowing to Datadog

---

## Rollback Procedure

**If deployment fails, execute rollback:**

### Step 1: Stop Application

```bash
kubectl scale deployment/vibecode-webgui --replicas=0 -n vibecode
```

### Step 2: Revert Database

```bash
# Drop new tables
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS agent_rate_limits CASCADE;
DROP TABLE IF EXISTS agent_events CASCADE;
DROP TABLE IF EXISTS agent_health_metrics CASCADE;
DROP TABLE IF EXISTS agent_conversations CASCADE;
DROP TABLE IF EXISTS agent_sessions CASCADE;
DROP MATERIALIZED VIEW IF EXISTS agent_session_stats CASCADE;
DROP FUNCTION IF EXISTS archive_old_agent_conversations();
DROP FUNCTION IF EXISTS archive_old_agent_metrics();
DROP FUNCTION IF EXISTS cleanup_stale_agent_sessions();
DROP FUNCTION IF EXISTS refresh_agent_session_stats();
DROP FUNCTION IF EXISTS update_agent_sessions_updated_at();
EOF
```

### Step 3: Clear Redis Cache

```bash
redis-cli -u $REDIS_URL FLUSHDB
```

### Step 4: Restore Previous Version

```bash
kubectl rollout undo deployment/vibecode-webgui -n vibecode
kubectl scale deployment/vibecode-webgui --replicas=3 -n vibecode
```

### Step 5: Verify Rollback

```bash
# Check application health
curl http://localhost:3000/api/health

# Verify no agent tables exist
psql $DATABASE_URL -c "\dt agent_*"
```

**Rollback Time:** 5-10 minutes

---

## Troubleshooting

### Issue: Migration Fails

**Symptoms:** SQL errors during migration

**Resolution:**
1. Check PostgreSQL version (must be 14+)
2. Verify extensions installed (uuid-ossp)
3. Check disk space (need 10GB+ free)
4. Review migration log for specific error

```bash
# Check version
psql $DATABASE_URL -c "SELECT version();"

# Check extensions
psql $DATABASE_URL -c "SELECT * FROM pg_extension;"

# Check disk space
df -h
```

### Issue: Cache Not Working

**Symptoms:** Cache hit rate <50%

**Resolution:**
1. Verify Redis connectivity
2. Check Redis memory limit
3. Review eviction policy
4. Verify TTL configuration

```bash
# Test Redis
redis-cli -u $REDIS_URL PING

# Check memory
redis-cli -u $REDIS_URL INFO memory | grep used_memory_human

# Check eviction
redis-cli -u $REDIS_URL INFO stats | grep evicted_keys
```

### Issue: High Query Latency

**Symptoms:** Database queries >500ms

**Resolution:**
1. Check for missing indexes
2. Analyze query execution plans
3. Verify connection pool not exhausted
4. Check for lock contention

```bash
# Check indexes
psql $DATABASE_URL -c "SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;"

# Check connections
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';"

# Check locks
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

---

## Success Criteria

### Performance Metrics

- [x] Session lookup P95 <50ms
- [x] Cache hit rate >90%
- [x] Message save latency <100ms
- [x] Rate limit check <10ms
- [x] No database errors

### Functional Tests

- [x] Agent creation works
- [x] Message flow works
- [x] Health metrics recorded
- [x] Rate limiting enforced
- [x] Events logged

### Operational

- [x] Backups running
- [x] Monitoring active
- [x] Alerts configured
- [x] Documentation complete
- [x] Team trained

---

## Sign-Off

**Database Team Lead:** ___________________ Date: ___________
**Backend Team Lead:** ___________________ Date: ___________
**DevOps Team Lead:** ___________________ Date: ___________
**Product Owner:** ___________________ Date: ___________

---

**Deployment Status:** ☐ Not Started | ☐ In Progress | ☐ Complete | ☐ Rolled Back

**Deployment Time:** Start: ___________ End: ___________ Duration: ___________

**Post-Deployment Notes:**

_______________________________________________________________________

_______________________________________________________________________

_______________________________________________________________________
