# Azure PostgreSQL with pgvector Troubleshooting Guide

This document provides solutions for common issues when working with pgvector on Azure Database for PostgreSQL Flexible Server.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Performance Problems](#performance-problems)
3. [Query Errors](#query-errors)
4. [Index Management](#index-management)
5. [Memory and CPU Constraints](#memory-and-cpu-constraints)
6. [Monitoring and Diagnostics](#monitoring-and-diagnostics)
7. [High Availability and Failover](#high-availability-and-failover)
8. [Integration with GenAI Applications](#integration-with-genai-applications)

## Installation Issues

### Problem: Unable to Create pgvector Extension

**Symptoms:**
- Error message: `ERROR: could not open extension control file "vector.control": No such file or directory`
- Error when running `CREATE EXTENSION vector;`

**Solutions:**

1. **Verify PostgreSQL Version:**
   ```sql
   SELECT version();
   ```
   Make sure you're using PostgreSQL 12 or later, which is required for pgvector.

2. **Check Extension Availability:**
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'vector';
   ```
   If the extension isn't listed, contact Azure support to ensure pgvector is installed on your server.

3. **Check User Permissions:**
   Make sure you're connecting with an account that has administrator privileges.

4. **Install using Azure CLI:**
   ```bash
   az postgres flexible-server parameter set \
     --resource-group myResourceGroup \
     --server-name myservername \
     --name azure.extensions \
     --value vector
   ```

### Problem: Wrong Vector Dimensions

**Symptoms:**
- Error message: `ERROR: vector dimension mismatch: expected 1536, got 384`

**Solutions:**

1. **Check Current Dimensions:**
   ```sql
   SELECT typelem, typndims, typmod FROM pg_type WHERE typname = 'vector';
   ```

2. **Alter Vector Type Dimensions:**
   ```sql
   -- This might require temporarily dropping existing tables with vector columns
   ALTER TYPE vector SET (DIMENSIONS = 1536);
   ```

3. **For New Databases, Set Dimensions on Extension Creation:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector WITH (DIMENSIONS = 1536);
   ```

## Performance Problems

### Problem: Slow Vector Similarity Searches

**Symptoms:**
- Vector queries take several seconds or more to complete
- Performance degrades as the vector database grows

**Solutions:**

1. **Create Proper Indexes:**

   For small to medium datasets (< 1M vectors), use an IVFFlat index:
   ```sql
   CREATE INDEX ON items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```

   For larger datasets, use HNSW for better recall and performance:
   ```sql
   CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
   ```

2. **Tune PostgreSQL Parameters:**
   
   Edit your Azure PostgreSQL server parameters:
   ```
   maintenance_work_mem = 1GB  -- For index creation
   work_mem = 256MB            -- For query execution
   shared_buffers = 4GB        -- Increase if possible
   effective_cache_size = 12GB -- Estimate of available system memory
   ```

3. **Monitor and Fix Table Bloat:**
   ```sql
   VACUUM ANALYZE items;
   ```

4. **Consider Table Partitioning:**
   If your dataset is very large, consider partitioning the table by a relevant attribute.

### Problem: Index Creation Takes Too Long

**Symptoms:**
- Creating a vector index takes hours to complete
- The operation times out or the server becomes unresponsive

**Solutions:**

1. **Increase maintenance_work_mem:**
   ```sql
   SET maintenance_work_mem = '1GB';
   ```

2. **Create Index Concurrently:**
   ```sql
   CREATE INDEX CONCURRENTLY idx_vector_hnsw ON items 
   USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
   ```

3. **Build Index During Off-Peak Hours:**
   Schedule index creation during periods of low activity.

4. **Use IVFFlat for Faster Creation:**
   If build time is critical, IVFFlat indexes build faster than HNSW.
   ```sql
   CREATE INDEX ON items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```

## Query Errors

### Problem: "out of memory" Errors During Vector Operations

**Symptoms:**
- Error: `ERROR: out of memory`
- Server becomes unresponsive during vector operations

**Solutions:**

1. **Increase work_mem Parameter:**
   ```sql
   SET work_mem = '256MB';
   ```

2. **Limit Batch Sizes:**
   Process embeddings in smaller batches (e.g., 100 at a time).

3. **Optimize Query:**
   Use LIMIT clauses and efficient indexes.
   ```sql
   -- With LIMIT
   SELECT * FROM items 
   ORDER BY embedding <=> '[1,2,3,...]'::vector 
   LIMIT 10;
   ```

4. **Scale Up Your Azure PostgreSQL Instance:**
   Consider upgrading to a higher tier with more memory.

### Problem: "operator does not exist" for Vector Operations

**Symptoms:**
- Error: `ERROR: operator does not exist: vector <=> vector`

**Solutions:**

1. **Verify Extension Installation:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

2. **Check Operator Registration:**
   ```sql
   SELECT * FROM pg_operator WHERE oprname = '<=>';
   ```

3. **Reinstall Extension:**
   ```sql
   DROP EXTENSION IF EXISTS vector;
   CREATE EXTENSION vector;
   ```

## Index Management

### Problem: Index Not Being Used for Vector Searches

**Symptoms:**
- Vector queries are slow despite having an index
- EXPLAIN shows sequential scans instead of index scans

**Solutions:**

1. **Check Index Existence and Health:**
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'items';
   ```

2. **Use EXPLAIN ANALYZE to Verify Index Usage:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM items 
   ORDER BY embedding <=> '[1,2,3,...]'::vector 
   LIMIT 10;
   ```

3. **Rebuild the Index:**
   ```sql
   REINDEX INDEX idx_vector_hnsw;
   ```

4. **Use Explicit Index Hints if Necessary:**
   ```sql
   SET enable_seqscan = OFF;
   ```

### Problem: Incorrect Search Results with Vector Indexes

**Symptoms:**
- Different results when using indexed vs. non-indexed searches
- Missing relevant vectors in search results

**Solutions:**

1. **Adjust HNSW Parameters for Better Recall:**
   ```sql
   -- For search-time accuracy (higher values = better results but slower)
   SET hnsw.ef_search = 100;
   
   -- For build-time accuracy (may require recreating the index)
   CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops) 
   WITH (m = 16, ef_construction = 200);
   ```

2. **Try Different Distance Metrics:**
   ```sql
   -- Cosine similarity (normalized, angle-based)
   SELECT * FROM items ORDER BY embedding <=> query_embedding LIMIT 10;
   
   -- Inner product (useful for certain ML models)
   SELECT * FROM items ORDER BY embedding <#> query_embedding LIMIT 10;
   
   -- Euclidean distance
   SELECT * FROM items ORDER BY embedding <-> query_embedding LIMIT 10;
   ```

3. **Consider Post-Verification:**
   Retrieve more candidates than needed with the index, then rerank them.

## Memory and CPU Constraints

### Problem: High Memory Usage with Vector Operations

**Symptoms:**
- Server running out of memory
- Queries failing with "out of memory" errors

**Solutions:**

1. **Monitor Memory Usage:**
   Use Azure monitoring tools or query pg_stat_activity.

2. **Implement Connection Pooling:**
   Use pgBouncer or similar to manage connections efficiently.

3. **Increase VM Size in Azure:**
   Scale up to a memory-optimized instance if vector operations are memory-intensive.

4. **Implement Caching Layer:**
   Cache frequent vector search results to reduce database load.

### Problem: High CPU Usage During Vector Searches

**Symptoms:**
- CPU utilization spikes to 100% during vector queries
- Queries time out or perform poorly

**Solutions:**

1. **Use More Efficient Indexes:**
   HNSW indexes generally provide better query performance than IVFFlat.

2. **Tune PostgreSQL Parallel Query Settings:**
   ```sql
   SET max_parallel_workers_per_gather = 4;
   SET max_parallel_workers = 8;
   ```

3. **Optimize Vector Dimensionality:**
   Consider using dimensionality reduction techniques if vectors are very high-dimensional.

4. **Scale Up CPU Resources:**
   Move to a compute-optimized Azure PostgreSQL tier.

## Monitoring and Diagnostics

### Problem: Difficulty Monitoring Vector Database Performance

**Symptoms:**
- Unclear which vector operations are causing performance issues
- Cannot identify bottlenecks in vector processing

**Solutions:**

1. **Enable pg_stat_statements:**
   ```sql
   CREATE EXTENSION pg_stat_statements;
   ```

2. **Query for Slow Vector Operations:**
   ```sql
   SELECT query, calls, total_exec_time, mean_exec_time
   FROM pg_stat_statements
   WHERE query LIKE '%<=>%' OR query LIKE '%vector%'
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

3. **Set Up Datadog Monitoring:**
   - Install the Datadog Agent on your Azure environment
   - Configure PostgreSQL integration:
   ```yaml
   # datadog.yaml
   instances:
     - host: <your-azure-postgres-host>.postgres.database.azure.com
       port: 5432
       username: datadog@<your-server-name>
       password: <password>
       dbm: true  # Enable Database Monitoring
       tags:
         - "env:production"
         - "application:genai-rag"
   ```
   - Configure custom metrics for vector operations:
   ```sql
   -- Create function to expose vector metrics
   CREATE OR REPLACE FUNCTION get_vector_metrics() RETURNS TABLE (
     metric_name text,
     metric_value numeric
   ) AS $$
   BEGIN
     RETURN QUERY
     SELECT 'vector_count', COUNT(*)::numeric FROM items WHERE embedding IS NOT NULL
     UNION ALL
     SELECT 'vector_index_size', pg_relation_size('idx_vector_hnsw')::numeric
     UNION ALL
     SELECT 'avg_vector_search_time', mean_exec_time
       FROM pg_stat_statements
       WHERE query LIKE '%<=>%' AND calls > 10
       ORDER BY mean_exec_time DESC
       LIMIT 1;
   END;
   $$ LANGUAGE plpgsql;

   -- Grant execute permissions to datadog user
   GRANT EXECUTE ON FUNCTION get_vector_metrics() TO datadog;
   ```
   
4. **Create Datadog Dashboard:**
   - Use the dashboard template provided in `monitoring/dashboards/genai-vector-performance.json`
   - Add custom metrics and alerts for vector operations
   - Create performance comparison views between different vector operations

5. **Configure Database Monitoring for pgvector:**
   - Enable Database Monitoring in Datadog with pgvector support
   - Set up the following monitoring script:
   ```python
   from datadog import initialize, statsd
   import psycopg2
   import time

   # Configure Datadog
   initialize(api_key='<YOUR_API_KEY>', app_key='<YOUR_APP_KEY>')

   # Connect to PostgreSQL
   conn = psycopg2.connect(
       host='<your-azure-postgres-host>.postgres.database.azure.com',
       database='<your-database>',
       user='<your-username>@<your-server-name>',
       password='<your-password>'
   )

   # Track vector search performance
   def track_vector_search(embedding, limit=10):
       cursor = conn.cursor()
       
       # Format embedding for query
       vector_str = '[' + ','.join(map(str, embedding)) + ']'
       
       # Measure execution time
       start_time = time.time()
       
       # Execute search
       cursor.execute(
           "SELECT id FROM items ORDER BY embedding <=> %s::vector LIMIT %s",
           (vector_str, limit)
       )
       
       results = cursor.fetchall()
       
       # Calculate duration
       duration = (time.time() - start_time) * 1000  # milliseconds
       
       # Send metrics to Datadog
       statsd.gauge('database.vector.search.latency', duration)
       statsd.increment('database.vector.operations')
       
       cursor.close()
       return results, duration

   # Run periodic vector index stats collection
   def collect_vector_stats():
       cursor = conn.cursor()
       
       # Get vector count
       cursor.execute("SELECT COUNT(*) FROM items WHERE embedding IS NOT NULL")
       vector_count = cursor.fetchone()[0]
       
       # Get index size
       cursor.execute("SELECT pg_relation_size('idx_vector_hnsw')")
       index_size = cursor.fetchone()[0]
       
       # Send metrics to Datadog
       statsd.gauge('database.vector.embeddings', vector_count)
       statsd.gauge('database.vector.index_size', index_size)
       
       cursor.close()
   ```

### Problem: Identifying Index Quality Issues

**Symptoms:**
- Inconsistent vector search performance
- Unexpected search results

**Solutions:**

1. **Monitor Recall Rate:**
   Compare indexed search results with exhaustive search on a test dataset.

2. **Check Index Fragmentation:**
   ```sql
   SELECT * FROM pgstatindex('idx_vector_hnsw');
   ```

3. **Implement Metrics Collection:**
   Track metrics like query latency, recall@k, and precision@k for your vector searches.

## High Availability and Failover

### Problem: Vector Operations Fail During Failover

**Symptoms:**
- Errors during zone failover in Azure
- Vector queries fail after database restart

**Solutions:**

1. **Implement Connection Retry Logic:**
   Add exponential backoff and retry logic in your application code.

2. **Use Azure Connection Pooling:**
   Configure connection pooling with proper retry settings.

3. **Check Extension Status After Failover:**
   Verify that pgvector extension is properly loaded.

4. **Test Failover Scenarios:**
   Regularly test your application's behavior during database failovers.

### Problem: pgvector Extension Missing After HA Failover

**Symptoms:**
- Error messages about missing vector extension after failover
- Vector operations fail with "operator does not exist"

**Solutions:**

1. **Automate Extension Setup:**
   Create a script that checks for and reinstalls the extension if needed.

2. **Check Replica Configuration:**
   Ensure the extension is properly installed on all replicas.

3. **Use Azure Database for PostgreSQL HA Features:**
   Enable zone redundancy and proper replication for your PostgreSQL instance.

## Integration with GenAI Applications

### Problem: Embedding Generation and Storage Bottlenecks

**Symptoms:**
- Slow response times when generating and storing embeddings
- Database connection pool exhaustion

**Solutions:**

1. **Implement Batch Processing:**
   Generate and store embeddings in batches rather than individually.

2. **Use Background Workers:**
   Process embedding generation and storage asynchronously.

3. **Implement Caching:**
   Cache embeddings for frequently accessed content.

4. **Consider Hybrid Search Approaches:**
   Combine vector search with keyword search for better performance.

### Problem: RAG (Retrieval-Augmented Generation) Performance Issues

**Symptoms:**
- End-to-end RAG queries are slow
- High latency in generating responses with retrieved context

**Solutions:**

1. **Optimize Vector Retrieval:**
   Use efficient indexes and limit the number of retrieved documents.

2. **Implement Tiered Retrieval:**
   Use a fast first-pass retrieval followed by more accurate reranking.

3. **Adjust Similarity Thresholds:**
   Experiment with different similarity thresholds to balance recall and performance.

4. **Monitor and Optimize Each Component:**
   Separately track performance of:
   - Embedding generation
   - Vector search
   - Context processing
   - Text generation

---

## Best Practices for pgvector on Azure PostgreSQL

1. **Choose the Right VM Size:**
   - Memory-optimized for large vector datasets
   - Compute-optimized for high query throughput

2. **Index Selection:**
   - IVFFlat for smaller datasets (<1M vectors) or when build time is critical
   - HNSW for larger datasets and when query performance is critical

3. **Parameter Tuning:**
   - Increase `maintenance_work_mem` for index creation
   - Increase `work_mem` for query execution
   - Adjust `shared_buffers` based on dataset size

4. **Monitoring:**
   - Track vector operation performance
   - Monitor memory usage during vector operations
   - Set up alerts for query performance degradation

5. **High Availability:**
   - Test vector operations during failover scenarios
   - Implement proper connection retry logic
   - Verify extension status after failover

6. **Data Management:**
   - Implement proper partitioning for large vector tables
   - Consider archiving old or unused vectors
   - Regularly VACUUM ANALYZE vector tables

7. **Query Optimization:**
   - Always use LIMIT in vector similarity queries
   - Use appropriate distance metrics for your use case
   - Consider hybrid search approaches (vector + keyword)

By following these best practices and troubleshooting tips, you can maintain a high-performance, reliable pgvector implementation on Azure PostgreSQL Flexible Server for your GenAI applications.