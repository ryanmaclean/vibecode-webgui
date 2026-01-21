# Azure PostgreSQL Flexible Server pgvector Guide

This document explains how to properly set up and use pgvector with Azure PostgreSQL Flexible Server, including common issues and their solutions.

## Critical Limitation: vector Not Allowed in shared_preload_libraries

### The Issue

When attempting to add the pgvector extension to Azure PostgreSQL Flexible Server using the standard method, you may encounter this error:

```
ERROR: (ServerParameterToCMSUnAllowedParameterValue) Value 'vector' is invalid for server parameter 'shared_preload_libraries'.
Allowed values are ',age,anon,auto_explain,azure_storage,pg_cron,pg_duckdb,pg_failover_slots,pg_hint_plan,pg_partman_bgw,pg_prewarm,pg_squeeze,pg_stat_statements,pgaudit,pglogical,timescaledb,wal2json'.
```

This happens because Azure PostgreSQL Flexible Server explicitly disallows adding `vector` to the `shared_preload_libraries` parameter, which is often mentioned in pgvector documentation as a requirement.

### The Workaround

Despite this limitation, pgvector can still work on Azure PostgreSQL Flexible Server. Here's how:

1. **Skip shared_preload_libraries for vector** - Unlike local PostgreSQL installations, Azure doesn't require this step
2. **Create the extension directly** - The extension itself is available

```sql
-- Check if vector is available in the available extensions
SELECT * FROM pg_available_extensions WHERE name = 'vector';

-- Create the extension if available
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension was created
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

3. **Verify vector operators work** - Confirm the vector type and operations work correctly:

```sql
-- Create a test table with vector column
CREATE TABLE vector_test (
  id SERIAL PRIMARY KEY,
  embedding vector(3)
);

-- Insert a test vector
INSERT INTO vector_test (embedding) VALUES ('[1,2,3]'::vector);

-- Test vector operations
SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector AS cosine_distance;
```

## Best Practices for Azure PostgreSQL with pgvector

1. **Always check availability first**:
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'vector';
   ```

2. **Use robust extension creation with error handling**:
   ```sql
   DO $$
   BEGIN
     IF EXISTS (
       SELECT FROM pg_available_extensions WHERE name = 'vector'
     ) THEN
       CREATE EXTENSION IF NOT EXISTS vector;
     ELSE
       RAISE EXCEPTION 'pgvector extension is not available on this server';
     END IF;
   END
   $$;
   ```

3. **Set vector dimensions correctly**:
   ```sql
   -- For OpenAI embeddings (1536 dimensions)
   DO $$
   DECLARE
     current_dimensions INTEGER;
   BEGIN
     -- Check if vector exists and get current dimensions
     SELECT typmod INTO current_dimensions FROM pg_type WHERE typname = 'vector';
     
     -- Update dimensions if needed
     IF current_dimensions < 1536 THEN
       EXECUTE 'ALTER TYPE vector SET (DIMENSIONS = 1536)';
     END IF;
   END
   $$;
   ```

4. **Create appropriate indexes for your workload**:
   ```sql
   -- For larger datasets with better query performance
   CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
   
   -- For smaller datasets or faster index creation
   CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```

## Implementation Example

Here's a complete implementation example from our AzurePostgresConnection class:

```typescript
/**
 * Helper function to create vector-specific queries
 */
static createVectorQuery(dimensions: number = 1536): string {
  return `CREATE EXTENSION IF NOT EXISTS vector;
          
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT FROM pg_type WHERE typname = 'vector'
            ) THEN
              CREATE EXTENSION IF NOT EXISTS vector;
            END IF;
          END
          $$;
          
          -- Check if vector dimensions need to be increased
          DO $$
          DECLARE
            current_dimensions INTEGER;
          BEGIN
            SELECT typmod INTO current_dimensions FROM pg_type WHERE typname = 'vector';
            IF current_dimensions < ${dimensions} THEN
              EXECUTE 'ALTER TYPE vector SET (DIMENSIONS = ' || ${dimensions} || ')';
            END IF;
          END
          $$;`;
}
```

## Troubleshooting

If you're still encountering issues:

1. **Check if vector extension is already installed**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

2. **Verify vector data type exists**:
   ```sql
   SELECT typname FROM pg_type WHERE typname = 'vector';
   ```

3. **Check database user permissions**:
   Ensure your database user has permission to create extensions.

4. **Restart the server after changes**:
   Some changes may require a server restart to take effect.

5. **Contact Azure Support**:
   If pgvector is not available in pg_available_extensions, contact Azure support to enable it for your server.

## Conclusion

While Azure PostgreSQL Flexible Server has the limitation of not allowing vector in shared_preload_libraries, pgvector can still be used effectively with the approaches outlined in this guide. The key is to focus on directly creating the extension and properly configuring dimensions for your embedding model.