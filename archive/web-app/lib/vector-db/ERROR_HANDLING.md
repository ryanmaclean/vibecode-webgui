# Vector Database Error Handling

This document explains the standardized error handling approach for vector database operations in the VibeCode platform.

## Overview

We've standardized error handling across all vector database adapters to ensure consistent error reporting, better error categorization, and improved retry capabilities. This approach helps with:

- Consistent error types and messages across different vector database providers
- Better error classification for automated handling and recovery
- Detailed error context for easier debugging
- Built-in retry mechanisms for transient failures
- Clear separation between retryable and non-retryable errors

## Error Handler Components

### 1. VectorDbErrorType Enum

The `VectorDbErrorType` enum defines standard error categories:

```typescript
export enum VectorDbErrorType {
  // Connection related errors
  CONNECTION = 'CONNECTION',
  
  // Initialization errors
  INITIALIZATION = 'INITIALIZATION',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Authentication and authorization
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  
  // Query errors
  QUERY_FAILED = 'QUERY_FAILED',
  SEARCH = 'SEARCH',
  
  // Timeouts
  TIMEOUT = 'TIMEOUT',
  
  // Service errors
  SERVICE = 'SERVICE',
  
  // Vector operations
  VECTOR_OPERATION_FAILED = 'VECTOR_OPERATION_FAILED',
  
  // Embedding generation
  EMBEDDING_GENERATION_FAILED = 'EMBEDDING_GENERATION_FAILED',
  
  // Index operations
  INDEX_OPERATION_FAILED = 'INDEX_OPERATION_FAILED',
  
  // Feature support
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  
  // Fallback
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

### 2. VectorDbError Class

The `VectorDbError` class extends the standard JavaScript `Error` with additional properties:

```typescript
export class VectorDbError extends Error {
  type: VectorDbErrorType;      // Error category
  operation: string;            // Operation that failed
  provider: string;             // Database provider (postgres, redis, etc.)
  details: any;                 // Additional context data
  timestamp: string;            // When the error occurred
  retryable: boolean;           // Whether this error can be retried
  
  // Constructor, logging, and other methods...
}
```

### 3. VectorDbErrorHandler Class

The `VectorDbErrorHandler` class provides methods for standardized error handling:

```typescript
export class VectorDbErrorHandler {
  // Helper methods for error classification
  isAuthError(error: any): boolean
  isNetworkError(error: any): boolean
  isTimeoutError(error: any): boolean
  isRetryableError(error: any): boolean
  
  // Main error handling method
  handleError(
    error: any,
    operation: string,
    errorType?: VectorDbErrorType,
    retryable?: boolean,
    additionalContext: any = {}
  ): VectorDbError
}
```

### 4. Retry Mechanism

The `RetryHandler` class implements retry logic with exponential backoff and circuit breaker pattern:

```typescript
export class RetryHandler {
  // Execute operation with retry logic
  executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    isRetryable?: (error: Error) => boolean
  ): Promise<T>
  
  // Circuit breaker methods
  resetCircuit(): void
  getStatus(): { circuitBroken: boolean; recentFailures: number; remainingResetTimeMs: number }
}
```

## Usage Examples

### Basic Error Creation

```typescript
// Create a basic error
const error = new VectorDbError(
  'Connection refused',
  VectorDbErrorType.CONNECTION,
  'connect',
  'postgres'
);

// Error with additional context
const detailedError = new VectorDbError(
  'Query failed',
  VectorDbErrorType.QUERY_FAILED,
  'searchSimilarDocuments',
  'postgres',
  { query: 'SELECT...', params: { limit: 10 } },
  true // This error is retryable
);
```

### Using the Error Handler in Adapters

```typescript
// Initialize error handler in constructor
this.errorHandler = new VectorDbErrorHandler(
  'postgres',
  this.config.enableLogging,
  this.config.enableMetrics
);

// In try/catch blocks
try {
  // Operation code...
} catch (error) {
  throw this.errorHandler.handleError(
    error,
    'methodName',
    VectorDbErrorType.OPERATION_TYPE,
    this.errorHandler.isNetworkError(error),
    { additionalContext: 'value' }
  );
}
```

### Using the Retry Handler

```typescript
// Initialize retry handler
this.retryHandler = new RetryHandler({
  maxRetries: 3,
  baseDelay: 1000,
  backoffFactor: 2
});

// Execute with retry
const result = await this.retryHandler.executeWithRetry(
  async () => this.adapter.search(embedding, options),
  'search'
);
```

## Migration Script

The `migrate-vector-error-handling.sh` script automates the conversion of existing error handling to the new standard. It performs the following tasks:

1. Updates import statements to use the new error handler
2. Adds the error handler property to adapter classes
3. Initializes the error handler in constructors
4. Converts direct throw statements to use the error handler
5. Updates try/catch blocks to use the error handler
6. Replaces old error handler calls with the new pattern

## Testing the Implementation

A comprehensive test suite is available in `tests/unit/vector-db-error-handler.test.ts` to verify:

1. Correct error classification and categorization
2. Proper error handling and context preservation
3. Backward compatibility with legacy code
4. Integration with vector database adapters
5. Retry mechanism with circuit breaker pattern

## Backward Compatibility

The new implementation maintains backward compatibility through:

1. Legacy type aliases (`VectorDBErrorType` → `VectorDbErrorType`)
2. Legacy constants (`CONNECTION_FAILED` → `VectorDbErrorType.CONNECTION`)
3. Legacy function support (`handleVectorDBError` → wrapper for `VectorDbErrorHandler`)

This ensures existing code continues to work while new code can benefit from the enhanced error handling approach.

## Best Practices

1. Always use the error handler class instead of throwing errors directly
2. Provide meaningful operation names for context
3. Include relevant (but non-sensitive) details for debugging
4. Use the retry handler for operations that might experience transient failures
5. Be explicit about whether errors are retryable when known
6. Use error classification methods to determine error types