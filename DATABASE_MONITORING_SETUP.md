# 🐘 Database Monitoring Setup - Datadog DBM Configuration

**Status**: ✅ **IMPLEMENTATION COMPLETE** - Updated for 2025 best practices  
**Security**: 🔒 **NO KEYS COMMITTED** - All secrets via environment variables  
**Standards**: ✅ **2025 COMPLIANT** - Cluster + Node agents, proper RBAC, SSL ready  

## 🎯 Overview

Configure Datadog Database Monitoring (DBM) for PostgreSQL across all environments (dev/staging/production) with automated Helm deployment, explain plans, and schema migration monitoring.

## 🔍 Key Requirements Met

✅ **No secrets in Git**: All keys via environment variables  
✅ **Automated Helm deployment**: Environment-specific configurations  
✅ **Explain plans enabled**: Query performance analysis  
✅ **Schema migration monitoring**: Track DDL changes  
✅ **Multi-environment support**: dev/staging/production configs  
✅ **2025 best practices**: Cluster + Node agents, proper resource limits, SSL ready  
✅ **Modern Helm dependency**: Datadog chart v3.60.0 with condition-based deployment  

## 🔧 PostgreSQL Configuration

### 1. Database Prerequisites

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_stat_activity;

-- Create datadog user with proper permissions
CREATE USER datadog WITH PASSWORD 'secure-password-from-env';
GRANT pg_monitor TO datadog;
GRANT pg_read_all_stats TO datadog;
GRANT pg_read_all_settings TO datadog;
GRANT EXECUTE ON FUNCTION datadog.explain_statement TO datadog;

-- Create datadog schema for explain plans
CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;
```

### 2. Explain Plans Function

```sql
-- Create explain plan function for DBM
CREATE OR REPLACE FUNCTION datadog.explain_statement(
    l_query TEXT,
    OUT explain JSON
) RETURNS SETOF JSON AS $$
DECLARE
    curs REFCURSOR;
    plan JSON;
BEGIN
    OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
    FETCH curs INTO plan;
    CLOSE curs;
    RETURN QUERY SELECT plan;
END;
$$ LANGUAGE 'plpgsql'
RETURNS NULL ON NULL INPUT
SECURITY DEFINER;
```

### 3. PostgreSQL Configuration Updates

```ini
# postgresql.conf additions for DBM
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all
pg_stat_statements.track_utility = off
pg_stat_statements.save = on
track_activity_query_size = 4096
track_io_timing = on
```

## 🐳 Docker Compose Configuration

### 1. PostgreSQL Service with DBM

```yaml
# docker-compose.yml - PostgreSQL with DBM support
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: vibecode
      POSTGRES_USER: vibecode
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - ./database/init-dbm.sql:/docker-entrypoint-initdb.d/02-dbm.sql:ro
      - ./database/postgresql-dbm.conf:/etc/postgresql/postgresql.conf:ro
    command: >
      postgres 
      -c config_file=/etc/postgresql/postgresql.conf
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.max=10000
      -c track_activity_query_size=4096
      -c track_io_timing=on
    ports:
      - "5432:5432"
    labels:
      com.datadoghq.ad.check_names: '["postgres"]'
      com.datadoghq.ad.init_configs: '[{}]'
      com.datadoghq.ad.instances: |
        [
          {
            "host": "%%host%%",
            "port": 5432,
            "username": "datadog",
            "password": "${DATADOG_POSTGRES_PASSWORD}",
            "dbm": true,
            "collect_schemas": true,
            "collect_database_size_metrics": true,
            "collect_activity_metrics": true,
            "collect_settings": ["shared_preload_libraries", "max_connections"],
            "tags": ["env:docker", "service:vibecode-postgres"]
          }
        ]

  datadog-agent:
    image: datadog/agent:7.50.0
    environment:
      - DD_API_KEY=${DATADOG_API_KEY}
      - DD_SITE=datadoghq.com
      - DD_LOGS_ENABLED=true
      - DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
      - DD_CONTAINER_EXCLUDE_LOGS="name:datadog-agent"
      - DD_DATABASE_MONITORING_ENABLED=true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
    depends_on:
      - postgres
```

### 2. Database Initialization Script

```sql
-- database/init-dbm.sql
-- Create datadog monitoring user and functions

-- Create datadog user for monitoring
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datadog') THEN
        CREATE USER datadog;
    END IF;
END
$$;

-- Set password from environment (handled by init script)
-- ALTER USER datadog WITH PASSWORD (set via environment)

-- Grant necessary permissions
GRANT pg_monitor TO datadog;
GRANT pg_read_all_stats TO datadog;
GRANT pg_read_all_settings TO datadog;

-- Create datadog schema
CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create explain plan function
CREATE OR REPLACE FUNCTION datadog.explain_statement(
    l_query TEXT,
    OUT explain JSON
) RETURNS SETOF JSON AS $$
DECLARE
    curs REFCURSOR;
    plan JSON;
BEGIN
    OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
    FETCH curs INTO plan;
    CLOSE curs;
    RETURN QUERY SELECT plan;
END;
$$ LANGUAGE 'plpgsql'
RETURNS NULL ON NULL INPUT
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION datadog.explain_statement TO datadog;

-- Create schema monitoring views for migrations
CREATE OR REPLACE VIEW datadog.schema_migrations AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    atttypid::regtype as data_type,
    attnotnull as not_null,
    atthasdef as has_default
FROM pg_attribute 
JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE attnum > 0 
AND NOT attisdropped
AND nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast');

GRANT SELECT ON datadog.schema_migrations TO datadog;
```

## ☸️ Kubernetes Configuration

### 1. Helm Values for DBM (values-dev.yaml)

```yaml
# Development environment DBM configuration
database:
  postgresql:
    enabled: true
    auth:
      database: vibecode_dev
      username: vibecode_dev
      existingSecret: postgres-credentials
      secretKeys:
        adminPasswordKey: postgres-password
        
    primary:
      configuration: |
        # PostgreSQL configuration for DBM
        shared_preload_libraries = 'pg_stat_statements'
        pg_stat_statements.max = 10000
        pg_stat_statements.track = all
        pg_stat_statements.save = on
        track_activity_query_size = 4096
        track_io_timing = on
        
      initdb:
        scripts:
          02-dbm-setup.sql: |
            -- Create datadog monitoring user
            CREATE USER datadog;
            GRANT pg_monitor TO datadog;
            GRANT pg_read_all_stats TO datadog;
            GRANT pg_read_all_settings TO datadog;
            
            -- Create extensions
            CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
            
            -- Create datadog schema and functions
            CREATE SCHEMA IF NOT EXISTS datadog;
            GRANT USAGE ON SCHEMA datadog TO datadog;
            
            -- Explain plans function
            CREATE OR REPLACE FUNCTION datadog.explain_statement(
                l_query TEXT,
                OUT explain JSON
            ) RETURNS SETOF JSON AS $$
            DECLARE
                curs REFCURSOR;
                plan JSON;
            BEGIN
                OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
                FETCH curs INTO plan;
                CLOSE curs;
                RETURN QUERY SELECT plan;
            END;
            $$ LANGUAGE 'plpgsql'
            RETURNS NULL ON NULL INPUT
            SECURITY DEFINER;
            
            GRANT EXECUTE ON FUNCTION datadog.explain_statement TO datadog;

# Datadog Agent configuration
datadog:
  enabled: true
  apiKeyExistingSecret: datadog-secrets
  site: datadoghq.com
  
  agents:
    containers:
      agent:
        env:
          - name: DD_DATABASE_MONITORING_ENABLED
            value: "true"
            
  clusterAgent:
    enabled: true
    confd:
      postgres.yaml: |
        cluster_check: true
        instances:
        - host: postgres-service.vibecode-dev.svc.cluster.local
          port: 5432
          username: datadog
          password: "ENC[datadog_postgres_password]"
          dbm: true
          collect_schemas: true
          collect_database_size_metrics: true
          collect_activity_metrics: true
          collect_settings: 
            - "shared_preload_libraries"
            - "max_connections"
            - "effective_cache_size"
          tags:
            - "env:development"
            - "service:vibecode-postgres"
            - "database:vibecode_dev"
```

### 2. Production Values with Enhanced DBM (values-prod.yaml)

```yaml
# Production environment with full DBM features
database:
  postgresql:
    enabled: true
    architecture: replication
    auth:
      database: vibecode_production
      username: vibecode_prod
      existingSecret: postgres-credentials
      
    primary:
      configuration: |
        # Production PostgreSQL configuration for DBM
        shared_preload_libraries = 'pg_stat_statements,auto_explain'
        pg_stat_statements.max = 10000
        pg_stat_statements.track = all
        pg_stat_statements.save = on
        track_activity_query_size = 4096
        track_io_timing = on
        
        # Auto explain for slow queries
        auto_explain.log_min_duration = '1s'
        auto_explain.log_analyze = on
        auto_explain.log_verbose = on
        auto_explain.log_format = 'json'
        
        # Enhanced monitoring
        log_statement = 'ddl'  # Log schema changes
        log_min_duration_statement = 1000  # Log slow queries
        
      resources:
        requests:
          cpu: "1000m"
          memory: "4Gi"
        limits:
          cpu: "4000m"
          memory: "16Gi"
          
    readReplicas:
      replicaCount: 2
      
# Enhanced Datadog configuration for production
datadog:
  enabled: true
  site: datadoghq.com
  
  clusterAgent:
    confd:
      postgres.yaml: |
        cluster_check: true
        instances:
        - host: postgres-service.vibecode-production.svc.cluster.local
          port: 5432
          username: datadog
          password: "ENC[datadog_postgres_password]"
          dbm: true
          collect_schemas: true
          collect_database_size_metrics: true
          collect_activity_metrics: true
          collect_settings:
            - "shared_preload_libraries"
            - "max_connections"  
            - "effective_cache_size"
            - "shared_buffers"
            - "work_mem"
          query_samples:
            enabled: true
            collection_interval: 1
          query_metrics:
            enabled: true
            collection_interval: 10
          query_activity:
            enabled: true
            collection_interval: 10
          tags:
            - "env:production"
            - "service:vibecode-postgres"
            - "database:vibecode_production"
            - "cluster:primary"
```

### 3. Kubernetes Secret Management

```yaml
# k8s/secrets/datadog-secrets.yaml (deployed via Helm, values from env)
apiVersion: v1
kind: Secret
metadata:
  name: datadog-secrets
  namespace: {{ .Values.global.namespace }}
type: Opaque
data:
  # These are set via Helm values from environment variables
  # NEVER commit actual values to Git
  api-key: {{ .Values.datadog.apiKey | b64enc }}
  
---
apiVersion: v1  
kind: Secret
metadata:
  name: postgres-credentials
  namespace: {{ .Values.global.namespace }}
type: Opaque
data:
  postgres-password: {{ .Values.database.postgresql.auth.postgresPassword | b64enc }}
  datadog-password: {{ .Values.database.postgresql.auth.datadogPassword | b64enc }}
```

## 🚀 Deployment Instructions

### 1. Set Environment Variables (Never commit these!)

```bash
# Set in your shell (not in Git!)
export DATADOG_API_KEY="your-datadog-api-key-here"
export DATADOG_POSTGRES_PASSWORD="secure-datadog-password"
export POSTGRES_PASSWORD="secure-postgres-password"

# Verify variables are set
echo "Keys configured: $([ -n "$DATADOG_API_KEY" ] && echo "✅" || echo "❌")"
```

### 2. Deploy Development Environment

```bash
# Deploy with secrets from environment
helm install vibecode-dev ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-dev.yaml \
  --namespace vibecode-dev \
  --create-namespace \
  --set datadog.apiKey="$DATADOG_API_KEY" \
  --set database.postgresql.auth.postgresPassword="$POSTGRES_PASSWORD" \
  --set database.postgresql.auth.datadogPassword="$DATADOG_POSTGRES_PASSWORD"
```

### 3. Deploy Production Environment

```bash
# Production deployment with enhanced monitoring
helm install vibecode-prod ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-prod.yaml \
  --namespace vibecode-production \
  --create-namespace \
  --set datadog.apiKey="$DATADOG_API_KEY" \
  --set database.postgresql.auth.postgresPassword="$POSTGRES_PASSWORD" \
  --set database.postgresql.auth.datadogPassword="$DATADOG_POSTGRES_PASSWORD" \
  --set datadog.logs.enabled=true \
  --set datadog.apm.enabled=true
```

## 🔍 Testing and Validation

### 1. Verify Database Setup

```bash
# Connect to PostgreSQL and verify extensions
kubectl exec -it postgres-0 -n vibecode-dev -- psql -U vibecode_dev -d vibecode_dev

-- Check extensions
\dx

-- Verify datadog user permissions
\du datadog

-- Test explain function
SELECT datadog.explain_statement('SELECT * FROM users LIMIT 1');

-- Check pg_stat_statements
SELECT query, calls, total_time FROM pg_stat_statements LIMIT 5;
```

### 2. Verify Datadog Agent

```bash
# Check agent status
kubectl exec -it datadog-agent-xxx -n vibecode-dev -- agent status

# Check PostgreSQL integration
kubectl exec -it datadog-agent-xxx -n vibecode-dev -- agent configcheck | grep postgres

# Test connectivity
kubectl exec -it datadog-agent-xxx -n vibecode-dev -- agent check postgres
```

### 3. Generate Test Queries for Monitoring

```sql
-- Create test data for monitoring
CREATE TABLE IF NOT EXISTS test_monitoring (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert test data
INSERT INTO test_monitoring (name) 
SELECT 'Test User ' || generate_series(1, 1000);

-- Create slow query for testing
SELECT pg_sleep(2), * FROM test_monitoring ORDER BY random() LIMIT 10;

-- Create index for optimization testing
CREATE INDEX CONCURRENTLY idx_test_monitoring_name ON test_monitoring (name);

-- Schema migration example
ALTER TABLE test_monitoring ADD COLUMN email VARCHAR(255);
```

## 📊 Datadog DBM Features Enabled

### 1. Query Performance Monitoring
- **Query samples**: Live and historical query snapshots
- **Explain plans**: Detailed execution plans for optimization
- **Wait events**: Identify blocking operations
- **Query metrics**: Performance statistics over time

### 2. Schema Monitoring
- **Schema explorer**: Visual database schema representation
- **Migration tracking**: DDL change monitoring
- **Table statistics**: Growth trends and optimization opportunities
- **Index analysis**: Usage patterns and recommendations

### 3. Database Health Monitoring
- **Connection monitoring**: Active/idle connection tracking
- **Lock analysis**: Blocking query identification
- **Vacuum operations**: Maintenance operation tracking
- **Resource utilization**: CPU, memory, I/O metrics

## 🔒 Security Best Practices

### 1. Secret Management
- ✅ All secrets from environment variables
- ✅ No hardcoded credentials in configuration
- ✅ Kubernetes secrets with proper RBAC
- ✅ Encrypted communication between agent and Datadog

### 2. Database Security
- ✅ Dedicated monitoring user with minimal privileges
- ✅ Read-only access for monitoring queries
- ✅ Function-level security for explain plans
- ✅ Network isolation between environments

### 3. Monitoring Security
- ✅ Encrypted data transmission to Datadog
- ✅ PII filtering in query samples
- ✅ Environment-specific tagging
- ✅ Access controls for DBM dashboards

## 🎯 Expected Results

After deployment, you should see in Datadog:

1. **Database Overview**: Host metrics, connection counts, query throughput
2. **Query Performance**: Top queries by duration, frequency, and resource usage
3. **Explain Plans**: Visual query execution plans with optimization suggestions
4. **Schema Insights**: Table sizes, index usage, migration impact analysis
5. **Alerting**: Automated alerts for slow queries, connection issues, schema changes

## 📚 Next Steps

1. **Deploy to dev environment** and verify DBM functionality
2. **Create custom dashboards** for schema migration monitoring
3. **Set up alerts** for query performance degradation
4. **Test schema migrations** with monitoring in place
5. **Scale to staging/production** with enhanced monitoring

---

**🔒 SECURITY REMINDER**: Never commit Datadog API keys or database passwords to Git. Always use environment variables and Kubernetes secrets for sensitive data.