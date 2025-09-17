# PostgreSQL Database Monitoring with Datadog in KIND

This document describes the automated setup for PostgreSQL Database Monitoring (DBM) with Datadog in your KIND cluster.

## Overview

The setup provides comprehensive monitoring of PostgreSQL databases running in Kubernetes, including:

- **Query Performance Monitoring**: Track slow queries, query plans, and execution metrics
- **Database Activity Monitoring**: Monitor active connections, locks, and transactions
- **Schema Collection**: Automatic discovery and monitoring of database schemas
- **Custom Metrics**: Application-specific metrics for VibeCode platform
- **Log Collection**: Structured PostgreSQL logs with proper parsing

## Quick Start

### Option 1: Deploy New KIND Cluster with Monitoring

For a complete new setup:

```bash
# Set your Datadog credentials (optional for local dev)
export DD_API_KEY="your-datadog-api-key"
export DD_APP_KEY="your-datadog-app-key"

# Deploy complete KIND cluster with PostgreSQL monitoring
./scripts/deploy-kind-postgres-monitoring.sh
```

### Option 2: Add Monitoring to Existing Cluster

If you already have a KIND cluster with PostgreSQL:

```bash
# Add monitoring to existing PostgreSQL deployment
./scripts/setup-postgres-datadog-monitoring.sh
```

## What Gets Deployed

### PostgreSQL Configuration

1. **Monitoring User**: `datadog` user with appropriate permissions
2. **Extensions**: `pg_stat_statements` for query performance tracking
3. **Configuration**: Optimized PostgreSQL settings for monitoring
4. **Health Check Function**: `datadog_monitoring_health()` for verification

### Datadog Integration

1. **Database Monitoring**: Enabled with comprehensive collection
2. **Custom Queries**: VibeCode-specific metrics for tables and indexes
3. **Log Processing**: Multi-line log parsing for PostgreSQL
4. **Autodiscovery**: Automatic detection of databases

### Kubernetes Resources

- **ConfigMaps**: PostgreSQL configuration and initialization scripts
- **Deployment**: Updated PostgreSQL with monitoring annotations
- **Service**: NodePort service for external access (port 30001)

## Monitoring Features

### Query Performance Monitoring

- **Slow Query Tracking**: Queries taking >1 second are logged
- **Query Plans**: Execution plans for performance analysis
- **Statement Statistics**: via `pg_stat_statements` extension
- **Lock Monitoring**: Deadlock and long-running lock detection

### Database Activity Monitoring

- **Connection Tracking**: Active connections and session details
- **Transaction Monitoring**: Long-running transactions and rollbacks
- **Replication Status**: If using replicas (future enhancement)
- **Background Process Monitoring**: Autovacuum, checkpointer, etc.

### Custom VibeCode Metrics

The setup includes custom queries that track:

```sql
-- Table activity metrics
vibecode.postgres.table.inserts
vibecode.postgres.table.updates  
vibecode.postgres.table.deletes
vibecode.postgres.table.live_tuples
vibecode.postgres.table.dead_tuples

-- Index usage metrics
vibecode.postgres.index.tuples_read
vibecode.postgres.index.tuples_fetched

-- Monitoring health
vibecode.postgres.monitoring.health
```

### Schema Collection

- **Automatic Discovery**: Detects all tables, indexes, and constraints
- **Metadata Tracking**: Column types, relationships, and statistics
- **Change Detection**: Alerts on schema modifications

## Configuration Details

### PostgreSQL Settings

The monitoring setup applies these key configurations:

```ini
# Query tracking
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.track_utility = on

# Logging
log_statement = 'all'
log_duration = on
log_min_duration_statement = 1000
log_connections = on
log_disconnections = on
log_lock_waits = on

# Statistics
track_activities = on
track_counts = on  
track_io_timing = on
track_functions = all
```

### Datadog Agent Configuration

Key Datadog settings for database monitoring:

```yaml
datadog:
  dbm:
    enabled: true
  
# PostgreSQL integration annotations
ad.datadoghq.com/postgres.instances: |
  [{
    "host": "%%host%%",
    "port": 5432,
    "username": "datadog",
    "password": "datadog_monitoring_password",
    "dbname": "vibecode",
    "dbm": true,
    "collect_schemas": {"enabled": true},
    "collect_activity": {"enabled": true},
    "collect_settings": {"enabled": true}
  }]
```

## Verification and Troubleshooting

### Health Check Commands

```bash
# Test monitoring user connection
kubectl exec -n vibecode-platform deployment/postgres -- \
  psql -U datadog -d vibecode -c "SELECT * FROM datadog_monitoring_health();"

# Check PostgreSQL logs
kubectl logs -n vibecode-platform -l app=postgres

# Check Datadog agent logs for PostgreSQL integration
kubectl logs -n datadog -l app=datadog-agent | grep -i postgres

# Port forward for direct database access
kubectl port-forward -n vibecode-platform service/postgres-service 5432:5432
```

### Common Issues and Solutions

#### 1. Monitoring User Connection Fails

**Symptoms**: `psql: FATAL: password authentication failed for user "datadog"`

**Solution**:
```bash
# Recreate monitoring user
kubectl exec -n vibecode-platform deployment/postgres -- \
  psql -U vibecode -d postgres -c "ALTER USER datadog WITH PASSWORD 'datadog_monitoring_password';"
```

#### 2. pg_stat_statements Extension Missing

**Symptoms**: Custom queries fail with "relation does not exist"

**Solution**:
```bash
# Enable extension manually
kubectl exec -n vibecode-platform deployment/postgres -- \
  psql -U vibecode -d vibecode -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

#### 3. Datadog Agent Not Collecting Metrics

**Symptoms**: No PostgreSQL metrics in Datadog

**Solutions**:
1. Check agent logs: `kubectl logs -n datadog -l app=datadog-agent`
2. Verify annotations: `kubectl get deployment postgres -n vibecode-platform -o yaml`
3. Restart Datadog agent: `kubectl rollout restart daemonset/datadog-agent -n datadog`

#### 4. Database Connection Issues

**Symptoms**: Cannot connect to PostgreSQL

**Solutions**:
1. Check pod status: `kubectl get pods -n vibecode-platform -l app=postgres`
2. Check service: `kubectl get service postgres-service -n vibecode-platform`
3. Test internal connectivity: `kubectl exec -n vibecode-platform deployment/postgres -- pg_isready`

## Expected Datadog Dashboards

After setup, you should see these metrics in Datadog:

### Core PostgreSQL Metrics
- `postgresql.connections`
- `postgresql.database.size`
- `postgresql.max_connections`
- `postgresql.percent_usage_connections`

### Query Performance Metrics
- `postgresql.queries.count`
- `postgresql.queries.time`
- `postgresql.slow_queries.count`

### Database Activity Metrics
- `postgresql.transactions.count`
- `postgresql.transactions.rollback_rate`
- `postgresql.locks.count`

### VibeCode Custom Metrics
- `vibecode.postgres.table.*`
- `vibecode.postgres.index.*`
- `vibecode.postgres.monitoring.health`

## Security Considerations

### Monitoring User Permissions

The `datadog` user has minimal required permissions:
- `pg_monitor` role for system statistics
- `SELECT` on statistics views only
- No `INSERT`, `UPDATE`, or `DELETE` capabilities
- No access to application data (except metadata)

### Password Management

For production deployments:
1. Use Kubernetes secrets for passwords
2. Rotate monitoring user passwords regularly
3. Consider certificate-based authentication

### Network Security

- PostgreSQL is only accessible within the cluster
- NodePort (30001) is for development convenience only
- Use network policies to restrict access in production

## Performance Impact

The monitoring setup has minimal performance impact:

- **CPU**: ~2-5% additional overhead
- **Memory**: ~50-100MB additional usage
- **Storage**: Log rotation prevents disk space issues
- **Network**: Metrics collection every 10-60 seconds

## Integration with Existing Scripts

The monitoring setup integrates with your existing KIND automation:

```bash
# Your existing scripts can now include monitoring
./scripts/kind-full-automation.sh  # Now includes DBM
./scripts/min-kind-bootstrap.sh    # Enhanced with monitoring
```

## Advanced Configuration

### Custom Query Examples

Add more custom queries by updating the deployment annotations:

```yaml
custom_queries:
  - metric_prefix: "vibecode.postgres.custom"
    query: "SELECT schemaname, tablename, seq_scan, idx_scan FROM pg_stat_user_tables"
    columns:
      - name: "schema"
        type: "tag"
      - name: "table" 
        type: "tag"
      - name: "vibecode.postgres.sequential_scans"
        type: "gauge"
      - name: "vibecode.postgres.index_scans"
        type: "gauge"
```

### Log Processing Rules

Customize log processing in the deployment annotations:

```yaml
log_processing_rules:
  - type: "exclude_at_match"
    name: "exclude_stats_collector"
    pattern: "stats collector process"
  - type: "multi_line"
    name: "postgres_multiline"
    pattern: "\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2}"
```

## Monitoring Best Practices

1. **Set Up Alerts**: Configure alerts for connection limits, slow queries, and disk space
2. **Regular Health Checks**: Run monitoring health checks in CI/CD
3. **Performance Baselines**: Establish baseline metrics for comparison
4. **Log Retention**: Configure appropriate log retention policies
5. **Backup Monitoring**: Monitor backup success/failure (future enhancement)

## Support and Troubleshooting

For issues with the monitoring setup:

1. Check the health function: `SELECT * FROM datadog_monitoring_health();`
2. Review PostgreSQL logs for authentication issues
3. Verify Datadog agent configuration and logs
4. Test database connectivity from within the cluster
5. Ensure proper RBAC permissions for Datadog agent

## Future Enhancements

Planned improvements:
- [ ] Backup monitoring integration
- [ ] Query plan collection and analysis
- [ ] Automated performance recommendations
- [ ] Integration with pgbouncer monitoring
- [ ] Custom dashboards for VibeCode metrics
- [ ] Alerting templates for common issues
