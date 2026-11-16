# Logger Implementation Details

## Overview
This document provides technical details about the logger implementation changes and how to use the new features.

---

## 1. New Logger Methods

### logger.http()
Log HTTP requests and API calls at the info level.

```typescript
import { logger } from '@/lib/logger';

// Simple HTTP log
logger.http('GET /api/users');

// With metadata
logger.http('API Request', {
  method: 'POST',
  url: '/api/users',
  statusCode: 201,
  responseTime: 45
});
```

### logger.child()
Create a child logger with persistent context metadata.

```typescript
import { logger } from '@/lib/logger';

// Create child logger with context
const requestLogger = logger.child({
  requestId: 'req-123',
  userId: 'user-456'
});

// All logs from this child will include the context
requestLogger.info('Processing request');
// Logs: { requestId: 'req-123', userId: 'user-456', msg: 'Processing request' }

requestLogger.error('Request failed', { error: 'Timeout' });
// Logs: { requestId: 'req-123', userId: 'user-456', error: 'Timeout', msg: 'Request failed' }
```

---

## 2. Helper Functions

### logPerformance()
Track performance metrics for operations.

```typescript
import { logPerformance } from '@/lib/logger';

const start = Date.now();
// ... perform operation
const duration = Date.now() - start;

logPerformance('databaseQuery', duration);
// Logs: { operation: 'databaseQuery', durationMs: 150 }

// With additional metadata
logPerformance('apiCall', duration, {
  endpoint: '/api/users',
  method: 'GET'
});
// Logs: { operation: 'apiCall', durationMs: 250, endpoint: '/api/users', method: 'GET' }
```

### logApiRequest()
Log API request details with HTTP method, URL, status code, and response time.

```typescript
import { logApiRequest } from '@/lib/logger';

logApiRequest('GET', '/api/users', 200, 45);
// Logs: { method: 'GET', url: '/api/users', statusCode: 200, responseTimeMs: 45 }

// With metadata
logApiRequest('POST', '/api/users', 201, 120, {
  userId: '123',
  contentType: 'application/json'
});
```

### logDatabaseOperation()
Log database operations with operation type, table, and duration.

```typescript
import { logDatabaseOperation } from '@/lib/logger';

logDatabaseOperation('SELECT', 'users', 25);
// Logs: { operation: 'SELECT', table: 'users', durationMs: 25 }

// With metadata
logDatabaseOperation('INSERT', 'orders', 50, {
  rowCount: 1,
  userId: '123'
});
```

---

## 3. Type Exports

### LogLevel
Union type for all supported log levels.

```typescript
import { LogLevel } from '@/lib/logger';

const level: LogLevel = 'info';
// Valid values: 'error' | 'warn' | 'info' | 'http' | 'debug'
```

### Logger
Type for the main logger instance.

```typescript
import { Logger } from '@/lib/logger';

function setupLogging(customLogger: Logger) {
  customLogger.info('Logging initialized');
}
```

### ChildLogger
Type for child logger instances.

```typescript
import { ChildLogger } from '@/lib/logger';

function processRequest(requestLogger: ChildLogger) {
  requestLogger.debug('Starting request processing');
}
```

---

## 4. Testing with Logger Mock

The logger mock is automatically used when importing from `@/lib/logger` in tests.

```typescript
import { logger, logPerformance } from '@/lib/logger';

describe('My Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should log performance metrics', () => {
    logPerformance('myOperation', 150);

    expect(logger.info).toHaveBeenCalledWith(
      'Performance metric',
      {
        operation: 'myOperation',
        durationMs: 150
      }
    );
  });

  test('should log HTTP requests', () => {
    logger.http('GET /api/users');

    expect(logger.http).toHaveBeenCalledWith('GET /api/users');
  });

  test('should create child logger', () => {
    const childLogger = logger.child({ requestId: '123' });

    expect(logger.child).toHaveBeenCalledWith({ requestId: '123' });
    expect(childLogger).toBeDefined();
  });
});
```

---

## 5. Migration Guide

### Before (Missing Methods)
```typescript
// This would fail
logger.http('GET /api/users'); // ❌ TypeError: logger.http is not a function

// This would fail
import { logPerformance } from '@/lib/logger'; // ❌ Module not exported
```

### After (Fixed)
```typescript
// Now works
logger.http('GET /api/users'); // ✅ Works

// Now works
import { logPerformance } from '@/lib/logger'; // ✅ Works
logPerformance('operation', 100);
```

---

## 6. Architecture Notes

### Logger Implementation (Pino)
- Uses Pino for high-performance logging
- Supports Datadog integration
- Environment-based log levels
- Structured JSON logging
- Worker thread transports for production

### Mock Implementation (Jest)
- All methods are `jest.fn()` for testing
- Matches real logger API exactly
- Supports spying and assertions
- Auto-clears between tests
- Child logger behavior matches real implementation

---

## 7. Best Practices

### Use Child Loggers for Context
```typescript
// Good: Persistent context
const userLogger = logger.child({ userId: user.id });
userLogger.info('User logged in');
userLogger.debug('Fetching user data');
userLogger.info('User logged out');

// Less ideal: Repeating metadata
logger.info('User logged in', { userId: user.id });
logger.debug('Fetching user data', { userId: user.id });
logger.info('User logged out', { userId: user.id });
```

### Use Helper Functions for Consistency
```typescript
// Good: Structured performance logging
logPerformance('apiCall', duration, { endpoint: '/api/users' });

// Less ideal: Manual structure
logger.info('Performance metric', {
  operation: 'apiCall',
  durationMs: duration,
  endpoint: '/api/users'
});
```

### HTTP Logging in Middleware
```typescript
export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logApiRequest(req.method, req.url, res.statusCode, duration);
  });

  next();
}
```

---

## 8. File Locations

### Production Code
- Implementation: `/src/lib/logger.ts`
- Security logger: `/src/lib/security/logger.ts`

### Test Infrastructure
- Logger mock: `/tests/__mocks__/@/lib/logger.ts`
- Logger tests: `/tests/unit/lib/logger.test.ts`

---

## Support

For questions or issues with the logger:
1. Check this documentation
2. Review `LOGGER_FIX_REPORT.md` for implementation details
3. See test examples in `tests/unit/lib/logger.test.ts`
