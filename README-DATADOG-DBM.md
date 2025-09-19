# Datadog Database Monitoring for pgvector on PostgreSQL

This repository demonstrates **pgvector on PostgreSQL running on Kubernetes monitored by Datadog Database Monitoring (DBM)** - exactly as intended for the core value proposition.

## 🎯 **Core Demo: pgvector + PostgreSQL + K8s + Datadog DBM**

```
┌─────────────────────────────────────────────────────────────┐
│                 VibeCode Platform Demo                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Kubernetes    │    │        PostgreSQL               │ │
│  │                 │    │                                 │ │
│  │ ┌─────────────┐ │    │ ┌─────────────────────────────┐ │ │
│  │ │ VibeCode    │ │    │ │ pgvector Extension          │ │ │
│  │ │ Application │◄┼────┼►│ • Vector similarity search  │ │ │
│  │ │             │ │    │ │ • 1536-dim embeddings       │ │ │
│  │ └─────────────┘ │    │ │ • IVFFLAT indexes           │ │ │
│  │                 │    │ └─────────────────────────────┘ │ │
│  │ ┌─────────────┐ │    │                                 │ │
│  │ │ Datadog     │ │    │ ┌─────────────────────────────┐ │ │
│  │ │ Agent       │◄┼────┼►│ Database Monitoring         │ │ │
│  │ │             │ │    │ │ • Query performance         │ │ │
│  │ └─────────────┘ │    │ │ • Vector index usage        │ │ │
│  └─────────────────┘    │ │ • Custom pgvector metrics   │ │ │
│                         │ └─────────────────────────────┘ │ │
│                         └─────────────────────────────────┘ │
│                                       │                     │
│                                       ▼                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Datadog Dashboard                          │ │
│  │ • Vector search latency    • Index performance         │ │
│  │ • Embedding count          • Query explain plans       │ │
│  │ • Table/index sizes        • Connection monitoring     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 **Quick Start - Get DBM Data in Datadog**

### **1. Verify and Setup DBM**
```bash
# Verify complete DBM setup for pgvector
npm run verify:datadog-dbm

# This script will:
# ✅ Check PostgreSQL deployment on K8s
# ✅ Verify pgvector extension is installed
# ✅ Create Datadog monitoring user
# ✅ Configure DBM with pgvector-specific metrics
# ✅ Set up vector search activity tracking
```

### **2. Generate Vector Activity**
```bash
# Generate realistic pgvector activity for DBM
npm run generate:vector-activity

# This creates:
# ✅ 120 documents with 1536-dimensional embeddings
# ✅ 50+ vector similarity searches (cosine, L2, hybrid)
# ✅ Index maintenance operations
# ✅ Concurrent database load simulation
```

### **3. View in Datadog**
1. Go to **Datadog → Database Monitoring**
2. Look for host: `postgres.vibecode.svc.cluster.local`
3. Check **Query Samples** for vector operations
4. Monitor custom metrics: `postgresql.pgvector.*`

## 📊 **What You'll See in Datadog DBM**

### **Database Monitoring Dashboard**
- 🔍 **Query Performance**: Vector similarity search execution times
- 📈 **Index Usage**: IVFFLAT index scan statistics
- 💾 **Storage Metrics**: Vector table and index sizes
- 🔄 **Connection Monitoring**: PostgreSQL connection pool usage

### **Custom pgvector Metrics**
- `postgresql.pgvector.vector_count` - Total vector embeddings
- `postgresql.pgvector.table_size` - Size of vector tables
- `postgresql.pgvector.index.tuples_read` - Index scan activity
- `postgresql.pgvector.index.tuples_fetched` - Index fetch operations
- `postgresql.pgvector.index.index_size` - Vector index storage size

### **Query Samples**
Real vector queries captured by DBM:
```sql
-- Cosine similarity search
SELECT document_id, title, embedding <=> '[0.1,0.2,0.3]'::vector as distance
FROM document_embeddings 
ORDER BY embedding <=> '[0.1,0.2,0.3]'::vector 
LIMIT 10;

-- Hybrid vector + text search
SELECT document_id, title, category,
       embedding <=> '[0.4,0.2,0.6]'::vector as vector_score,
       ts_rank_cd(to_tsvector('english', content), plainto_tsquery('deployment')) as text_score
FROM document_embeddings 
WHERE to_tsvector('english', content) @@ plainto_tsquery('deployment')
ORDER BY (embedding <=> '[0.4,0.2,0.6]'::vector) * 0.7 + 
         (1 - ts_rank_cd(to_tsvector('english', content), plainto_tsquery('deployment'))) * 0.3
LIMIT 15;
```

## 🔧 **Technical Implementation**

### **PostgreSQL Configuration**
```sql
-- Extensions enabled
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Datadog monitoring user
CREATE USER datadog WITH PASSWORD 'datadog_monitoring_password';
GRANT pg_monitor TO datadog;
GRANT pg_read_all_stats TO datadog;
GRANT pg_read_all_settings TO datadog;

-- Vector table with IVFFLAT index
CREATE TABLE document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI embedding dimensions
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_embeddings_vector 
ON document_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### **Datadog Agent Configuration**
```yaml
# PostgreSQL integration with DBM enabled
instances:
  - host: postgres.vibecode.svc.cluster.local
    port: 5432
    username: datadog
    password: datadog_monitoring_password
    dbname: vibecode
    dbm: true  # Enable Database Monitoring
    query_metrics:
      enabled: true
      run_sync: true
      collection_interval: 10
    query_samples:
      enabled: true
    query_activity:
      enabled: true
      collection_interval: 10
    custom_queries:
      - metric_prefix: 'postgresql.pgvector'
        query: |
          SELECT 
            schemaname,
            tablename,
            n_live_tup as vector_count,
            pg_relation_size(schemaname||'.'||tablename) as table_size
          FROM pg_stat_user_tables 
          WHERE tablename = 'document_embeddings'
        tags:
          - env:kubernetes
          - service:vibecode
          - vector_db:pgvector
```

### **Kubernetes Deployment**
```yaml
# PostgreSQL with pgvector and Datadog annotations
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: vibecode
spec:
  template:
    metadata:
      annotations:
        ad.datadoghq.com/postgres.check_names: '["postgres"]'
        ad.datadoghq.com/postgres.init_configs: '[{}]'
        ad.datadoghq.com/postgres.instances: |
          [{
            "host": "%%host%%",
            "port": 5432,
            "username": "datadog",
            "password": "datadog_monitoring_password",
            "dbname": "vibecode",
            "dbm": true,
            "tags": ["env:kubernetes", "service:vibecode", "vector_db:pgvector"]
          }]
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        env:
        - name: POSTGRES_DB
          value: "vibecode"
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          value: "password"
```

## 🎛️ **Monitoring Capabilities**

### **Vector Performance Monitoring**
- **Search Latency**: Track vector similarity search response times
- **Index Efficiency**: Monitor IVFFLAT index scan ratios
- **Query Patterns**: Analyze most common vector operations
- **Resource Usage**: Vector table and index storage consumption

### **Database Health Monitoring**
- **Connection Pooling**: PostgreSQL connection statistics
- **Query Performance**: Slow query detection and analysis
- **Lock Monitoring**: Vector operation lock contention
- **Memory Usage**: Shared buffer usage for vector operations

### **Custom Business Metrics**
- **Embedding Count**: Total vectors stored in the system
- **Search Volume**: Vector searches per minute/hour
- **Category Distribution**: Vector distribution across document types
- **Index Maintenance**: VACUUM and ANALYZE operation tracking

## 🔍 **Troubleshooting DBM Issues**

### **No Data in Datadog?**

1. **Check Agent Status**:
   ```bash
   kubectl logs -n datadog daemonset/datadog-agent | grep postgres
   ```

2. **Verify Database Connection**:
   ```bash
   kubectl exec -n vibecode postgres-pod -- psql -U datadog -d vibecode -c "SELECT 1;"
   ```

3. **Test Custom Queries**:
   ```bash
   kubectl exec -n vibecode postgres-pod -- psql -U datadog -d vibecode -c "
   SELECT schemaname, tablename, n_live_tup 
   FROM pg_stat_user_tables 
   WHERE tablename = 'document_embeddings';
   "
   ```

4. **Check Datadog API Key**:
   ```bash
   kubectl get secret datadog-secret -n datadog -o yaml
   ```

### **Low Query Activity?**
```bash
# Generate more vector activity
npm run generate:vector-activity

# Check pg_stat_statements
kubectl exec -n vibecode postgres-pod -- psql -U postgres -d vibecode -c "
SELECT query, calls, mean_exec_time 
FROM pg_stat_statements 
WHERE query LIKE '%embedding%' 
ORDER BY calls DESC;
"
```

## 📈 **Expected Results**

After running the setup and activity generation, you should see in Datadog:

1. **Database Monitoring Host**: `postgres.vibecode.svc.cluster.local`
2. **Custom Metrics**: `postgresql.pgvector.*` metrics appearing
3. **Query Samples**: Vector similarity searches in query samples
4. **Performance Data**: Query execution times and index usage
5. **Explain Plans**: Query plans for vector operations

## 🎯 **Demo Value Proposition**

This setup demonstrates:

✅ **pgvector Integration**: Full vector similarity search capabilities  
✅ **PostgreSQL on Kubernetes**: Production-ready database deployment  
✅ **Datadog DBM**: Comprehensive database monitoring and observability  
✅ **Real-world Workload**: Realistic vector search patterns and performance  
✅ **Custom Metrics**: pgvector-specific monitoring and alerting  

Perfect for showcasing how to monitor vector databases in production Kubernetes environments with enterprise-grade observability.

## 🔄 **Continuous Monitoring**

To maintain active DBM data:

1. **Regular Activity**: Run `npm run generate:vector-activity` periodically
2. **Application Usage**: Use the actual VibeCode application for real queries
3. **Automated Testing**: Set up cron jobs for continuous vector operations
4. **Performance Testing**: Use the A/B testing framework for load generation

This ensures your Datadog DBM dashboard always shows current pgvector performance data!
