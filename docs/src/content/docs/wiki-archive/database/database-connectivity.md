---
title: Database Connectivity
description: Auto-generated placeholder. Update as needed.
---

# Database Connectivity Guide

This document provides a comprehensive guide to database connectivity in the VibeCode application, with a focus on the robust connection handling for vector embeddings and AI features.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Connection Types](#connection-types)
- [Robust Database Connectivity](#robust-database-connectivity)
- [Vector Database Setup](#vector-database-setup)
- [Troubleshooting](#troubleshooting)
- [Testing Connectivity](#testing-connectivity)

## Overview

VibeCode uses PostgreSQL with the pgvector extension for storing vector embeddings and other application data. The application includes robust database connectivity features to ensure reliable performance in production environments.

### Key Features

- **Connection Pooling**: Efficient reuse of database connections
- **Automatic Retries**: Built-in retry logic for transient database errors
- **Robust Error Handling**: Detailed error diagnostics and recovery
- **Vector Database Support**: Full support for pgvector operations
- **Connection Validation**: Pre-flight checks for database configuration

## Configuration

### Environment Variables

The following environment variables are used for database configuration:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/dbname` |
| `DATABASE_POOL_SIZE` | Maximum number of connections in the pool (optional) | `10` |
| `DATABASE_CONNECTION_TIMEOUT` | Connection timeout in milliseconds (optional) | `30000` |
| `DATABASE_IDLE_TIMEOUT` | Idle connection timeout in milliseconds (optional) | `60000` |

### Connection String Format

The standard connection string format is:

```
postgresql://username:password@hostname:port/database
```

For Azure PostgreSQL, the format includes additional parameters:

```
postgresql://username:password@hostname:port/database?sslmode=require
```

## Connection Types

### Standard Prisma Connection

For most application features, the standard Prisma client connection is used:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
```

### Robust Connection

For features requiring robust connectivity (like vector embeddings), the enhanced connection utilities are used:

```typescript
import { createRobustConnection } from './src/lib/db/robust-db-connection';

const connection = await createRobustConnection();
if (connection.success && connection.prisma) {
  // Use the connection
}
```

## Robust Database Connectivity

The robust database connectivity system provides several advantages:

### Connection Pooling

- Maintains a pool of reusable connections
- Automatically manages connection lifecycle
- Optimizes resource usage with pool size limits

### Retry Logic

- Automatically retries failed database operations
- Configurable retry count and delay
- Exponential backoff strategy for retries

### Error Handling

- Detailed error diagnostics
- Classification of error types (connection, query, authentication)
- Human-readable error messages with suggested fixes

### Connection Lifecycle

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Create/Obtain  │─────▶│     Execute     │─────▶│     Release     │
│   Connection    │      │    Operations   │      │   Connection    │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Vector Database Setup

The vector database requires specific initialization steps:

1. **Create pgvector Extension**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Create Document Embeddings Table**:
   ```sql
   CREATE TABLE IF NOT EXISTS document_embeddings (
     id SERIAL PRIMARY KEY,
     document_id VARCHAR(255) UNIQUE NOT NULL,
     content TEXT NOT NULL,
     embedding vector(1536),
     metadata JSONB DEFAULT '{}',
     embedding_generation_time_ms INTEGER,
     search_count INTEGER DEFAULT 0,
     last_accessed_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Create Indices**:
   ```sql
   CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx 
   ON document_embeddings(document_id);
   
   CREATE INDEX IF NOT EXISTS document_embeddings_embedding_l2_idx 
   ON document_embeddings USING ivfflat (embedding vector_l2_ops);
   
   CREATE INDEX IF NOT EXISTS document_embeddings_embedding_ip_idx 
   ON document_embeddings USING ivfflat (embedding vector_ip_ops);
   ```

### Automated Setup

The application includes utilities to automate these steps:

```typescript
import { initializeVectorDatabaseRobust } from './src/lib/db/robust-db-connection';

const result = await initializeVectorDatabaseRobust({
  debug: true,
  createExtensions: true,
  createTables: true
});
```

## Troubleshooting

### Common Issues

#### Connection Errors

- **ECONNREFUSED**: Server is not running or not accessible
  - Check if the database server is running
  - Verify hostname and port are correct
  - Check firewall settings

- **ETIMEDOUT**: Connection timed out
  - Check network connectivity to the database server
  - Verify the hostname is correct
  - Check if the server is under heavy load

- **P1001**: Can't reach database server
  - Verify connection string format
  - Check if the database server is running

#### Authentication Errors

- **P1017**: Server rejected the connection
  - Check username and password
  - Verify user has permission to connect to the database

#### Database-Specific Errors

- **P1003**: Database does not exist
  - Create the database or check connection string
  - Verify database name

- **Extension Errors**: Unable to create pgvector extension
  - Ensure pgvector is installed on the database server
  - Check if user has permission to create extensions

### Query Execution Errors

- **Syntax Errors**: Incorrect SQL syntax
  - Check SQL syntax in queries
  - Ensure compatibility with PostgreSQL version

- **Permission Errors**: Insufficient privileges
  - Check user permissions on tables and schemas
  - Grant necessary permissions

## Testing Connectivity

The application includes several test scripts for verifying database connectivity:

### Basic Connection Test

```bash
node test-db-connection.js
```

### Vector Database Test

```bash
node test-vector-db.js
```

### Robust Connection Test

```bash
node test-robust-db-connection.js
```

### Embedding Service Test

```bash
node test-embedding-service-robust.js
```

## Performance Considerations

- **Connection Pooling**: Improves performance by reusing connections
- **Query Optimization**: Use prepared statements and efficient queries
- **Index Usage**: Ensure proper indices are created for vector operations
- **Connection Timeout**: Set appropriate timeout values for your environment
- **Monitoring**: Monitor connection usage and database performance

## Best Practices

1. **Always release connections** when finished with them
2. **Use connection pooling** for improved performance
3. **Implement retry logic** for transient errors
4. **Monitor connection usage** to detect leaks
5. **Set appropriate timeouts** for your environment
6. **Validate database setup** before application startup
7. **Use prepared statements** for repeated queries
8. **Implement proper error handling** with meaningful messages

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Azure PostgreSQL Documentation](https://learn.microsoft.com/en-us/azure/postgresql/)