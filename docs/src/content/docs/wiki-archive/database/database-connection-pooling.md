---
title: Database Connection Pooling
description: Auto-generated placeholder. Update as needed.
---

# Database Connection Pooling Improvements

This document outlines the enhanced database connection pooling system implemented in the VibeCode application.

## Features

- **Configurable Pool Size**: Minimum and maximum connection pool sizes can be set via environment variables.
- **Dynamic Sizing**: Pool automatically adjusts based on usage patterns.
- **Connection Validation**: Periodically validates connections to ensure they're still active.
- **Idle Connection Management**: Automatically removes connections that have been idle for too long.
- **Timeout Controls**: Connection timeouts and acquire timeouts to prevent hanging operations.
- **Detailed Metrics**: Comprehensive metrics tracking for pool usage, acquisition times, and validation.
- **Graceful Scaling**: Intelligent removal of least recently used connections when pool limits are reached.
- **Enhanced Error Diagnostics**: Detailed error information to help diagnose database connectivity issues.

## Configuration Options

The following environment variables can be used to configure the connection pool:

| Environment Variable | Description | Default Value |
|----------------------|-------------|---------------|
| `DB_POOL_MIN` | Minimum pool size | 2 |
| `DB_POOL_MAX` | Maximum pool size | 10 |
| `DB_POOL_IDLE_TIMEOUT` | Idle timeout in milliseconds | 30000 (30s) |
| `DB_POOL_CONNECTION_TIMEOUT` | Connection timeout in milliseconds | 10000 (10s) |
| `DB_POOL_ACQUIRE_TIMEOUT` | Maximum time to wait for a connection in milliseconds | 60000 (60s) |
| `DB_POOL_ENABLE_DYNAMIC_SIZING` | Enable dynamic pool sizing | true |
| `DB_POOL_ENABLE_CONNECTION_VALIDATION` | Enable connection validation | true |

## API Usage

```typescript
import { 
  createRobustConnection, 
  executeWithRetry, 
  closeAllConnections, 
  getConnectionPoolStatus,
  getDetailedConnectionPoolInfo
} from '@/lib/db/robust-db-connection';

// Create a new connection
const connection = await createRobustConnection({
  poolKey: 'my-connection',        // Unique identifier for this connection
  debug: true,                     // Enable debug logging
  enableLogging: true,             // Enable structured logging
  poolMinSize: 2,                  // Minimum connections to maintain
  poolMaxSize: 10,                 // Maximum connections allowed
  idleTimeout: 30000,              // Timeout for idle connections (ms)
  connectionTimeout: 5000,         // Query execution timeout (ms)
  acquireTimeout: 30000,           // Maximum time to wait for a connection (ms)
  enableDynamicSizing: true,       // Enable dynamic pool resizing
  enableConnectionValidation: true // Enable connection health checks
});

// Execute database operations with retry logic
if (connection.success && connection.prisma) {
  try {
    const result = await executeWithRetry(
      connection.prisma,
      () => connection.prisma.user.findMany(),
      3,    // Max retries
      1000, // Retry delay in ms
      true  // Enable logging
    );
    console.log('Query result:', result);
  } catch (error) {
    console.error('Query failed:', error);
  }
  
  // Release the connection when done
  connection.release();
}

// Get pool status
const poolStatus = getConnectionPoolStatus();
console.log('Pool status:', poolStatus);

// Get detailed connection info
const detailedInfo = getDetailedConnectionPoolInfo();
console.log('Detailed pool info:', detailedInfo);

// Close all connections
await closeAllConnections(true); // true enables logging
```

## Pool Metrics

The pool status includes detailed metrics:

```javascript
{
  size: 5,         // Current number of connections in the pool
  inUse: 3,        // Connections currently in use
  maxSize: 10,     // Maximum pool size
  minSize: 2,      // Minimum pool size
  available: 5,    // Number of connections that can still be created
  utilization: 0.6, // Percentage of pool currently in use
  configuration: {  // Current configuration
    idleTimeout: 30000,
    connectionTimeout: 10000,
    acquireTimeout: 60000,
    enableDynamicSizing: true,
    enableConnectionValidation: true
  },
  metrics: {        // Performance metrics
    totalConnections: 8,
    peakConnections: 6,
    totalAcquires: 15,
    acquireSuccesses: 15,
    acquireFailures: 0,
    acquireTimeAvg: 45.2,
    connectionValidations: 5,
    connectionValidationFailures: 0,
    dynamicPoolAdjustments: 2
  }
}
```

## Testing

A test script is available to verify connection pooling functionality:

```bash
node test-db-connection-pooling.js
```

## Best Practices

1. **Use Connection Keys**: Always use unique pool keys for different parts of your application to prevent connection conflicts.
2. **Release Connections**: Always call `connection.release()` when done with a connection.
3. **Monitor Pool Status**: Regularly check pool status to ensure it's not approaching capacity.
4. **Configure Timeouts**: Set appropriate timeouts based on your database operation complexity.
5. **Tune Pool Size**: Adjust minimum and maximum pool sizes based on your application's needs and traffic patterns.