---
title: Production Friction
description: Auto-generated placeholder. Update as needed.
---

# Production Friction Points Guide: PostgreSQL + GenAI on Azure

> **Real-world gotchas, solutions, and lessons learned from deploying GenAI applications with PostgreSQL + pgvector**

## Table of Contents

1. [Azure PostgreSQL Deployment Gotchas](#azure-postgresql-deployment-gotchas)
2. [pgvector Extension Pitfalls](#pgvector-extension-pitfalls)
3. [Performance and Scaling Traps](#performance-and-scaling-traps)
4. [Monitoring Blind Spots](#monitoring-blind-spots)
5. [Cost Optimization Surprises](#cost-optimization-surprises)
6. [Security and Compliance Catches](#security-and-compliance-catches)
7. [Development to Production Gaps](#development-to-production-gaps)

---

## Azure PostgreSQL Deployment Gotchas

### 🚨 Gotcha #1: pgvector Extension Not Available by Default

**What happens:**
```bash
# This fails on fresh Azure PostgreSQL Flexible Server
CREATE EXTENSION vector;
# ERROR: extension "vector" is not available
```

**Why it happens:**
- Azure PostgreSQL Flexible Server doesn't include pgvector in all regions/configurations
- Extension must be explicitly enabled during server creation or configuration update

**The Fix:**
```bash
# Check if pgvector is available in pg_available_extensions
SELECT * FROM pg_available_extensions WHERE name = 'vector';

# If available, you can create it directly
CREATE EXTENSION IF NOT EXISTS vector;
```

**Prevention:**
- Always check `SELECT * FROM pg_available_extensions WHERE name = 'vector';` before deployment
- If not available, contact Azure support to enable the pgvector extension

### 🚨 Gotcha #1.1: Vector Cannot Be Added to shared_preload_libraries

**What happens:**
```bash
# This fails on Azure PostgreSQL Flexible Server
az postgres flexible-server parameter set \
    --resource-group myResourceGroup \
    --server-name myserver \
    --name shared_preload_libraries \
    --value "vector"

# ERROR: (ServerParameterToCMSUnAllowedParameterValue) Value 'vector' is invalid for server parameter 'shared_preload_libraries'
# Allowed values are ',age,anon,auto_explain,azure_storage,pg_cron,pg_duckdb,pg_failover_slots,pg_hint_plan,pg_partman_bgw,pg_prewarm,pg_squeeze,pg_stat_statements,pgaudit,pglogical,timescaledb,wal2json'.
```

**Why it happens:**
- Azure PostgreSQL Flexible Server explicitly restricts which extensions can be loaded in shared_preload_libraries
- Vector is not in the allowed list of extensions for the shared_preload_libraries parameter
- Many pgvector guides incorrectly suggest adding vector to shared_preload_libraries

**The Fix:**
```sql
-- Despite not being able to add vector to shared_preload_libraries,
-- you can still create and use the extension directly if it's available

-- First check if it's available
SELECT * FROM pg_available_extensions WHERE name = 'vector';

-- Then create it directly
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it works
SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector;
```

**Prevention:**
- Skip any instructions about adding vector to shared_preload_libraries on Azure
- Use our `AzurePostgresConnection` class which handles this limitation automatically
- See `docs/azure-postgres-pgvector-guide.md` for detailed workarounds

### 🚨 Gotcha #2: Networking Configuration Complexity

**What happens:**
Applications can't connect to PostgreSQL despite correct credentials.

**Why it happens:**
- Azure PostgreSQL Flexible Server requires VNet integration
- Firewall rules don't work as expected with private endpoints
- DNS resolution fails for private endpoints from different VNets

**The Fix:**
```json
// In ARM template, ensure proper networking
{
  "type": "Microsoft.DBforPostgreSQL/flexibleServers",
  "properties": {
    "network": {
      "delegatedSubnetResourceId": "[variables('dbSubnetId')]",
      "privateDnsZoneArmResourceId": "[variables('privateDnsZoneId')]"
    },
    "highAvailability": {
      "mode": "ZoneRedundant"
    }
  }
}
```

**Prevention:**
- Plan network topology early
- Test connectivity from all intended sources
- Document network dependencies clearly

### 🚨 Gotcha #3: Managed Identity Authentication Confusion

**What happens:**
```javascript
// This works in development but fails in production
const pool = new Pool({
  host: 'myserver.postgres.database.azure.com',
  user: 'myapp',
  password: await getTokenFromManagedIdentity() // ❌ Wrong approach
})
```

**Why it happens:**
- Token refresh logic is missing
- Token expiration handling is inadequate
- Different token scopes for different Azure services

**The Fix:**
```javascript
// Proper managed identity implementation
import { DefaultAzureCredential } from '@azure/identity';

class AzurePgConnection {
  private async getAccessToken() {
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken(
      'https://ossrdbms-aad.database.windows.net/.default'
    );
    return tokenResponse?.token;
  }
  
  private async createConnection() {
    const token = await this.getAccessToken();
    return new Pool({
      host: this.host,
      user: this.managedIdentityClientId,
      password: token,
      ssl: { rejectUnauthorized: true }
    });
  }
}
```

---

## pgvector Extension Pitfalls

### 🚨 Gotcha #4: Embedding Dimension Mismatches

**What happens:**
```sql
-- This fails if embeddings are different dimensions
INSERT INTO documents (embedding) VALUES ('[1,2,3]'::vector);
-- ERROR: vector dimension mismatch
```

**Why it happens:**
- OpenAI models use 1536 dimensions
- Azure OpenAI might use different models with different dimensions
- Model updates can change embedding dimensions

**The Fix:**
```sql
-- Create flexible schema
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding_model VARCHAR(50),
  embedding_dimensions INTEGER,
  embedding vector(1536) -- Start with OpenAI standard
);

-- Migration strategy for dimension changes
ALTER TABLE documents ADD COLUMN embedding_v2 vector(1024);
-- Migrate data gradually, then drop old column
```

**Prevention:**
- Always store embedding model and dimension metadata
- Plan for embedding model migrations
- Use consistent embedding models across environments

### 🚨 Gotcha #5: Index Performance Degradation

**What happens:**
Vector searches become slow as data grows, despite having indexes.

**Why it happens:**
- HNSW index parameters weren't optimized for your dataset size
- Index maintenance isn't happening during bulk updates
- Wrong distance metric chosen (cosine vs L2 vs inner product)

**The Fix:**
```sql
-- For datasets < 100k vectors
CREATE INDEX documents_hnsw_idx ON documents 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- For datasets > 100k vectors
CREATE INDEX documents_hnsw_idx ON documents 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 32, ef_construction = 128);

-- Monitor index usage
SELECT 
  schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes 
WHERE indexname LIKE '%hnsw%';
```

**Prevention:**
- Test index parameters with realistic data volumes
- Monitor query performance over time
- Plan for index rebuilds during major data updates

### 🚨 Gotcha #6: Memory Explosion with Large Vectors

**What happens:**
```
FATAL: out of shared memory
HINT: You might need to increase max_connections or shared_buffers
```

**Why it happens:**
- Vector operations are memory-intensive
- Default PostgreSQL memory settings are inadequate
- Multiple concurrent vector queries exhaust memory

**The Fix:**
```sql
-- Azure PostgreSQL parameter adjustments
SET shared_buffers = '25% of total memory';
SET work_mem = '256MB'; -- Adjust based on concurrent connections
SET maintenance_work_mem = '1GB';
SET effective_cache_size = '75% of total memory';

-- Monitor memory usage
SELECT 
  datname, 
  temp_files, 
  temp_bytes,
  deadlocks
FROM pg_stat_database;
```

---

## Performance and Scaling Traps

### 🚨 Gotcha #7: Similarity Search Query Patterns

**What happens:**
```sql
-- This query is slow even with proper indexes
SELECT * FROM documents 
WHERE embedding <-> '[...]'::vector < 0.8
ORDER BY embedding <-> '[...]'::vector;
```

**Why it happens:**
- Using distance threshold instead of LIMIT
- Not using proper operator for index type
- Query planner not using vector index

**The Fix:**
```sql
-- Correct pattern: Use LIMIT for vector searches
SELECT *, (embedding <=> '[...]'::vector) as distance
FROM documents 
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;

-- For threshold filtering, use subquery
WITH nearest AS (
  SELECT *, (embedding <=> '[...]'::vector) as distance
  FROM documents 
  ORDER BY embedding <=> '[...]'::vector
  LIMIT 100  -- Get more than needed
)
SELECT * FROM nearest WHERE distance < 0.8 LIMIT 10;
```

### 🚨 Gotcha #8: Connection Pool Exhaustion

**What happens:**
```
remaining connection slots are reserved for superuser
```

**Why it happens:**
- Each vector query holds connections longer
- Connection pools not sized for vector workloads
- No connection pooling layer (pgBouncer)

**The Fix:**
```javascript
// Proper connection pooling for vector workloads
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Lower than typical web apps
  idleTimeoutMillis: 10000, // Shorter idle timeout
  connectionTimeoutMillis: 5000,
  maxUses: 7500, // Rotate connections periodically
});

// Use pgBouncer for production
// In Azure, configure built-in connection pooling
```

**Prevention:**
- Size connection pools for longer-running vector queries
- Use pgBouncer or similar pooling layer
- Monitor connection usage patterns

---

## Monitoring Blind Spots

### 🚨 Gotcha #9: Standard Metrics Miss Vector Operations

**What happens:**
Your monitoring dashboards show everything is "normal" but users report slow AI features.

**Why it happens:**
- Standard PostgreSQL metrics don't capture vector operation specifics
- Query duration doesn't reflect embedding generation time
- Index usage metrics don't show vector index efficiency

**The Fix:**
```sql
-- Custom monitoring queries for vector operations
CREATE OR REPLACE FUNCTION vector_index_stats()
RETURNS TABLE(
  table_name text,
  index_name text,
  index_size_mb numeric,
  scans_count bigint,
  tuples_read bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    i.indexname::text,
    (pg_relation_size(i.indexname::regclass) / 1024 / 1024)::numeric as size_mb,
    s.idx_scan,
    s.idx_tup_read
  FROM pg_tables t
  JOIN pg_indexes i ON t.tablename = i.tablename
  JOIN pg_stat_user_indexes s ON i.indexname = s.indexrelname
  WHERE i.indexdef LIKE '%hnsw%' OR i.indexdef LIKE '%ivfflat%';
END;
$$ LANGUAGE plpgsql;
```

**Custom Datadog Metrics:**
```javascript
// In your application
const vectorQueryDuration = Date.now();
const results = await pool.query(vectorSearchQuery, params);
const duration = Date.now() - vectorQueryDuration;

// Send to Datadog
datadogMetrics.histogram('vector.search.duration', duration, [
  `embedding_model:${embeddingModel}`,
  `result_count:${results.rows.length}`
]);
```

### 🚨 Gotcha #10: Cost Monitoring Gaps

**What happens:**
Azure bills are much higher than expected, especially for compute and storage.

**Why it happens:**
- Vector indexes consume significant storage
- HNSW indexes require more memory, triggering higher SKU selection
- Backup costs for large vector datasets
- Cross-region data transfer for embeddings

**The Fix:**
- Monitor storage growth trends
- Set up cost alerts at thresholds
- Plan for index storage in cost calculations
- Consider regional embedding generation

---

## Development to Production Gaps

### 🚨 Gotcha #11: Local vs Azure Environment Differences

**What happens:**
```bash
# Works locally with Docker
CREATE EXTENSION vector;
# ✅ Success

# Fails on Azure PostgreSQL
CREATE EXTENSION vector;
# ❌ ERROR: permission denied
```

**Why it happens:**
- Local Docker uses superuser permissions
- Azure PostgreSQL has different permission models
- Extension management is restricted

**The Fix:**
```sql
-- Check available extensions on Azure
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name = 'vector';

-- Use Azure CLI for extension management
az postgres flexible-server parameter set \
    --name azure.extensions \
    --value vector \
    --server-name myserver \
    --resource-group myResourceGroup
```

### 🚨 Gotcha #12: SSL/TLS Configuration Complexity

**What happens:**
```javascript
// Works in development
const pool = new Pool({ connectionString: 'postgres://...' })

// Fails in production with SSL errors
// Error: unable to verify the first certificate
```

**The Fix:**
```javascript
// Production-ready SSL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/opt/ssl/BaltimoreCyberTrustRoot.crt.pem'),
  } : false
});
```

---

## Quick Reference Checklist

### Pre-Deployment Validation ✅

- [ ] pgvector extension available in Azure PostgreSQL's pg_available_extensions
- [ ] Workaround implemented for vector not being allowed in shared_preload_libraries
- [ ] Network security groups allow application traffic
- [ ] Managed identity has proper database permissions
- [ ] SSL certificates configured for production
- [ ] Connection pooling parameters sized for vector workloads
- [ ] Monitoring configured for vector-specific metrics
- [ ] Cost alerts set up for storage and compute growth
- [ ] Backup strategy accounts for large vector datasets

### Post-Deployment Monitoring ✅

- [ ] Vector index performance metrics
- [ ] Query duration percentiles for similarity searches
- [ ] Memory usage patterns during vector operations
- [ ] Storage growth rate from embeddings and indexes
- [ ] Connection pool utilization
- [ ] Error rates for embedding generation
- [ ] Cross-region latency if using multiple regions

---

## Emergency Troubleshooting Commands

```sql
-- Check if pgvector is available in this Azure server
SELECT * FROM pg_available_extensions WHERE name = 'vector';

-- Check if pgvector extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Verify vector type exists
SELECT typname, typelem, typmod FROM pg_type WHERE typname = 'vector';

-- Test vector operations
SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector;

-- Monitor active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;

-- Vector index diagnostics
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes 
WHERE indexname LIKE '%vector%' OR indexname LIKE '%hnsw%';

-- Memory usage check
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as db_size,
  pg_size_pretty(sum(pg_relation_size(indexname::regclass))) as index_total
FROM pg_indexes 
WHERE indexdef LIKE '%hnsw%';
```

This guide is based on real production deployments and common patterns observed in GenAI applications using PostgreSQL + pgvector on Azure. For more detailed solutions, see the complete troubleshooting documentation.