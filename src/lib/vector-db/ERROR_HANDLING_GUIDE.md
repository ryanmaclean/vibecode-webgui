# Vector Database Error Handling - Developer Guide

This guide provides a comprehensive overview of the standardized error handling system for vector database adapters in the VibeCode platform.

## Table of Contents

1. [Introduction](#introduction)
2. [Key Components](#key-components)
3. [Error Types](#error-types)
4. [Using the Error Handler](#using-the-error-handler)
5. [Error Categorization](#error-categorization)
6. [Retry Handling](#retry-handling)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Best Practices](#best-practices)
9. [Examples](#examples)
10. [Migration Guide](#migration-guide)
11. [Database-Specific Error Patterns](#database-specific-error-patterns)

## Introduction

The Vector Database Error Handling system provides a standardized approach to error handling across all vector database adapters. It ensures consistent error categorization, contextual information, and integration with retry mechanisms.

Key benefits:
- Consistent error categorization across adapters
- Rich contextual information for debugging
- Automatic identification of retryable errors
- Integrated logging and metrics
- Database-specific error pattern recognition

## Key Components

The error handling system consists of these core components:

1. **VectorDbError**: A standardized error class that extends the built-in Error class with additional properties:
   - `type`: Categorized error type
   - `operation`: The operation that failed
   - `provider`: The database provider (postgres, redis, etc.)
   - `details`: Additional context about the error
   - `timestamp`: When the error occurred
   - `retryable`: Whether the error can be retried

2. **VectorDbErrorHandler**: A class that manages error handling, with methods to:
   - Categorize errors based on their properties
   - Determine if errors are retryable
   - Format errors with consistent information
   - Add contextual details to errors

3. **Database-specific error patterns**: Specialized recognition patterns for different database systems.

## Error Types

Errors are categorized into the following types:

| Error Type | Description | Example |
|------------|-------------|---------|
| `CONNECTION` | Network or connection issues | Unable to connect to database |
| `INITIALIZATION` | Errors during adapter initialization | Failed to initialize adapter |
| `CONFIGURATION_ERROR` | Errors in configuration | Invalid connection string |
| `AUTHENTICATION` | Authentication failures | Invalid credentials |
| `AUTHORIZATION_ERROR` | Permission issues | Insufficient privileges |
| `QUERY_FAILED` | General query errors | Syntax error in query |
| `SEARCH` | Vector search failures | Failed similarity search |
| `TIMEOUT` | Operation timeouts | Query execution timed out |
| `SERVICE` | Service availability issues | Database service unavailable |
| `VECTOR_OPERATION_FAILED` | Vector manipulation errors | Failed to create vector |
| `EMBEDDING_GENERATION_FAILED` | Embedding creation errors | Failed to generate embeddings |
| `INDEX_OPERATION_FAILED` | Index management errors | Failed to create index |
| `UNSUPPORTED_OPERATION` | Feature not supported | Operation not implemented |
| `UNKNOWN_ERROR` | Unclassified errors | Unexpected error |

## Using the Error Handler

### Initializing the Error Handler

```typescript
// In your adapter constructor
this.errorHandler = new VectorDbErrorHandler(
  'postgres', // The database provider name
  this.config.enableLogging || false,
  this.config.enableMetrics || false
);
```

### Handling Errors in Try/Catch Blocks

```typescript
try {
  // Database operation
  await this.client.query('SELECT * FROM vectors');
} catch (error) {
  // Handle the error with context
  throw this.errorHandler.handleError(
    error,
    'executeQuery',
    VectorDbErrorType.QUERY_FAILED,
    false, // Not explicitly retryable
    { query: 'SELECT * FROM vectors' } // Additional context
  );
}
```

### Handling Errors with Automatic Categorization

```typescript
try {
  // Database operation
  await this.client.connect();
} catch (error) {
  // Let the error handler automatically categorize the error
  throw this.errorHandler.handleError(
    error,
    'connect'
    // No error type - will be automatically determined
    // No retryable flag - will be automatically determined
  );
}
```

## Error Categorization

Errors are categorized using several approaches:

1. **Provider-specific categorization**: Uses detailed knowledge of each database's error patterns
2. **Generic pattern matching**: Analyzes error messages, codes, and status
3. **Explicit categorization**: Developer can specify the error type directly

### Checking for Existing Error Instances

```typescript
try {
  // Operation
} catch (error) {
  // Only wrap if not already a VectorDbError
  if (!(error instanceof VectorDbError)) {
    throw this.errorHandler.handleError(
      error,
      'operation',
      VectorDbErrorType.QUERY_FAILED
    );
  }
  throw error;
}
```

## Retry Handling

The error handler automatically identifies which errors are retryable:

```typescript
// Check if an error is retryable
const canRetry = this.errorHandler.isRetryableError(error);

// Or when handling an error, provide explicit retryable flag
throw this.errorHandler.handleError(
  error,
  'operation',
  VectorDbErrorType.CONNECTION,
  true // Explicitly mark as retryable
);
```

### Integration with RetryHandler

```typescript
async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Handle the error but store instead of throwing
      lastError = this.errorHandler.handleError(
        error,
        'executeWithRetry',
        undefined, // Auto-categorize
        undefined, // Auto-determine retryable
        { retryAttempt: attempt }
      );
      
      // Only retry if the error is retryable
      if (!lastError.retryable) {
        throw lastError;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === this.maxRetries) {
        throw lastError;
      }
      
      // Wait with exponential backoff before retrying
      const delay = Math.min(100 * Math.pow(2, attempt), 3000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

## Monitoring and Logging

The error handler automatically logs errors with rich context:

```json
{
  "message": "Failed to connect to database",
  "errorType": "CONNECTION",
  "operation": "connect",
  "provider": "postgres",
  "details": {
    "retryable": true,
    "host": "db.example.com",
    "port": 5432
  },
  "timestamp": "2023-08-24T15:32:45.123Z"
}
```

### Metrics Integration

```typescript
// Enable metrics in constructor
this.errorHandler = new VectorDbErrorHandler(
  'postgres',
  true, // enableLogging
  true  // enableMetrics
);

// Metrics emitted include:
// - vector_db.errors (count with tags: adapter, error_type, operation, retryable)
// - vector_db.retry.attempts (count of retry attempts)
// - vector_db.retry.success (count of successful retries)
```

## Best Practices

1. **Provide meaningful operation names**:
   ```typescript
   throw this.errorHandler.handleError(error, 'createVectorIndex');
   ```

2. **Add relevant context to errors**:
   ```typescript
   throw this.errorHandler.handleError(
     error,
     'search',
     VectorDbErrorType.SEARCH,
     false,
     { 
       embeddingSize: embedding.length,
       limit: options.limit,
       threshold: options.threshold
     }
   );
   ```

3. **Check for existing `VectorDbError` instances**:
   ```typescript
   if (!(error instanceof VectorDbError)) {
     throw this.errorHandler.handleError(error, 'operation');
   }
   throw error; // Already handled, just re-throw
   ```

4. **Use specific error types when known**:
   ```typescript
   throw this.errorHandler.handleError(
     new Error('Vector extension not installed'),
     'verifyExtension',
     VectorDbErrorType.CONFIGURATION_ERROR
   );
   ```

5. **Sanitize sensitive information**:
   ```typescript
   throw this.errorHandler.handleError(
     error,
     'connect',
     VectorDbErrorType.CONNECTION,
     true,
     { 
       connectionString: '[REDACTED]', // Don't include actual connection string
       host: 'db.example.com'
     }
   );
   ```

6. **Use fallback mechanisms**:
   ```typescript
   try {
     return await this.vectorSearch(embedding, options);
   } catch (error) {
     logger.warn('Vector search failed, falling back to text search', {
       error: this.errorHandler.handleError(error, 'search')
     });
     return this.fallbackTextSearch('', options);
   }
   ```

## Examples

### Basic Error Handling

```typescript
public async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
  if (!this.client) {
    throw this.errorHandler.handleError(
      new Error('Database client not initialized'),
      'search',
      VectorDbErrorType.INITIALIZATION,
      true
    );
  }

  try {
    const results = await this.client.query(
      'SELECT * FROM vectors WHERE embedding <=> $1 LIMIT $2',
      [embedding, options.limit || 10]
    );
    
    return this.formatResults(results);
  } catch (error) {
    throw this.errorHandler.handleError(
      error,
      'search',
      VectorDbErrorType.SEARCH,
      this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error),
      {
        embeddingSize: embedding.length,
        limit: options.limit,
        options
      }
    );
  }
}
```

### Error Handling with Fallback

```typescript
public async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
  try {
    // Primary vector search implementation
    return await this.performVectorSearch(embedding, options);
  } catch (error) {
    // Only handle as VectorDbError if not already handled
    if (!(error instanceof VectorDbError)) {
      error = this.errorHandler.handleError(
        error,
        'search',
        VectorDbErrorType.SEARCH,
        false,
        { embeddingSize: embedding.length, options }
      );
    }
    
    // Log the error but don't throw - try fallback instead
    logger.warn('Vector search failed, falling back to text search', { error });
    
    // Attempt fallback to simpler search mechanism
    return this.fallbackTextSearch('', options);
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailure = 0;
  private resetTimeout = 30000; // 30 seconds
  private failureThreshold = 5;
  private errorHandler: VectorDbErrorHandler;
  
  constructor(provider: string) {
    this.errorHandler = new VectorDbErrorHandler(provider);
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailure < this.resetTimeout) {
        throw this.errorHandler.handleError(
          new Error('Circuit breaker open'),
          'circuitBreaker',
          VectorDbErrorType.SERVICE,
          false,
          { 
            circuitState: this.state,
            lastFailure: new Date(this.lastFailure).toISOString(),
            remainingTimeout: this.resetTimeout - (Date.now() - this.lastFailure)
          }
        );
      } else {
        // Try half-open state
        this.state = 'HALF_OPEN';
      }
    }
    
    try {
      const result = await operation();
      
      // Success in half-open means we can close the circuit
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      // Increment failure stats
      this.failureCount++;
      this.lastFailure = Date.now();
      
      // Open circuit if threshold reached
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      
      // Enhance error with circuit breaker context
      throw this.errorHandler.handleError(
        error,
        'circuitBreaker',
        undefined,
        undefined,
        { 
          circuitState: this.state,
          failureCount: this.failureCount,
          failureThreshold: this.failureThreshold
        }
      );
    }
  }
}
```

## Migration Guide

### From Direct Error Throws

Before:
```typescript
if (!this.client) {
  throw new Error('Client not initialized');
}
```

After:
```typescript
if (!this.client) {
  throw this.errorHandler.handleError(
    new Error('Client not initialized'),
    'currentOperation',
    VectorDbErrorType.INITIALIZATION
  );
}
```

### From Legacy Error Handling

Before:
```typescript
try {
  // Operation
} catch (error) {
  throw handleVectorDBError(error, 'operation', 'provider');
}
```

After:
```typescript
try {
  // Operation
} catch (error) {
  throw this.errorHandler.handleError(
    error,
    'operation'
  );
}
```

### Using the Migration Script

To automatically update your adapter files:

```bash
# Run in dry-run mode first to see what would change
scripts/standardize-vector-error-handling-v2.sh --dry-run

# Apply the changes
scripts/standardize-vector-error-handling-v2.sh

# Rollback if needed
scripts/standardize-vector-error-handling-v2.sh --rollback /path/to/backup
```

## Database-Specific Error Patterns

The error handling system includes specialized patterns for common database systems:

### PostgreSQL

```typescript
// PostgreSQL connection errors (class 08)
if (
  pgCode === '08000' || // connection_exception
  pgCode === '08003' || // connection_does_not_exist
  pgCode === '08006' || // connection_failure
  pgCode === '08001'    // sqlclient_unable_to_establish_sqlconnection
) {
  return VectorDbErrorType.CONNECTION;
}

// PostgreSQL authentication errors (class 28)
if (
  pgCode === '28P01' || // invalid_password
  pgCode === '28000'    // invalid_authorization_specification
) {
  return VectorDbErrorType.AUTHORIZATION_ERROR;
}
```

### Redis

```typescript
// Redis authentication errors
if (
  message.includes('noauth') ||
  message.includes('acl') ||
  code === 'NOAUTH'
) {
  return VectorDbErrorType.AUTHORIZATION_ERROR;
}

// Redis command errors
if (
  message.includes('wrong kind') ||
  message.includes('wrong type') ||
  code === 'WRONGTYPE'
) {
  return VectorDbErrorType.QUERY_FAILED;
}
```

### SQL Server

```typescript
// SQL Server login/permission errors
if (
  number === 18456 || // Login failed
  number === 15151 || // Cannot execute in the current database
  number === 229     // Execute permission denied
) {
  return VectorDbErrorType.AUTHORIZATION_ERROR;
}

// SQL Server connection errors
if (
  number === 53 ||   // Unable to open connection
  number === 10060 || // Connection timeout
  number === 10061    // Connection refused
) {
  return VectorDbErrorType.CONNECTION;
}
```

### CosmosDB

```typescript
// CosmosDB not found errors
if (status === 404) {
  return VectorDbErrorType.QUERY_FAILED;
}

// CosmosDB auth errors
if (status === 401 || status === 403) {
  return VectorDbErrorType.AUTHORIZATION_ERROR;
}

// CosmosDB timeout errors
if (status === 408 || status === 504) {
  return VectorDbErrorType.TIMEOUT;
}
```

For more information, see:
- [Error Handling Test Plan](/src/lib/vector-db/ERROR_HANDLING_TEST_PLAN.md)
- [Phased Rollout Plan](/src/lib/vector-db/PHASED_ROLLOUT_PLAN.md)
- [Example Implementation](/src/lib/vector-db/postgres-vector-database-adapter-new.ts)