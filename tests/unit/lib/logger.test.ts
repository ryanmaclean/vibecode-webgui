/**
<<<<<<< HEAD
 * Test suite for Pino-based logger utility
 * Tests use real Pino logger, not mocks
=======
 * Comprehensive test suite for Pino-based logger utility
 *
 * Test Coverage:
 * - Logger initialization and configuration
 * - Log levels (error, warn, info, http, debug)
 * - Child logger creation with context
 * - Helper functions (logPerformance, logApiRequest, logDatabaseOperation)
 * - Environment-specific behavior
 * - Metadata handling
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
 */

import {
  logger,
  createChildLogger,
  logPerformance,
  logApiRequest,
  logDatabaseOperation,
  LogLevel,
} from '@/lib/logger';

<<<<<<< HEAD
=======
// Mock Pino to intercept log calls
// Use a factory function to avoid hoisting issues
jest.mock('pino', () => {
  const mockChildLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  };

  const mockPinoLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => mockChildLogger),
    level: 'debug',
  };

  const mockPino = jest.fn(() => mockPinoLogger);
  mockPino.stdTimeFunctions = {
    isoTime: ',isoTime',
  };

  // Attach the mock instances for access in tests
  (mockPino as any).__mockPinoLogger = mockPinoLogger;
  (mockPino as any).__mockChildLogger = mockChildLogger;

  return mockPino;
});

// Import pino to get access to the mock
import pino from 'pino';
const mockPinoLogger = (pino as any).__mockPinoLogger;
const mockChildLogger = (pino as any).__mockChildLogger;

>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
describe('Logger Utility', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    // Set test environment to avoid transports
    process.env.NODE_ENV = 'test';
    process.env.BUILDING = 'true'; // Disable transports during tests
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Logger Initialization', () => {
    test('should create logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    test('should have log level methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    test('should be able to create child loggers', () => {
      expect(typeof logger.child).toBe('function');
      const child = logger.child({ component: 'test' });
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
    });
  });

  describe('Log Levels', () => {
<<<<<<< HEAD
    test('should log info messages without errors', () => {
      expect(() => {
        logger.info('Test info message');
        logger.info({ key: 'value' }, 'Info with metadata');
      }).not.toThrow();
    });

    test('should log warn messages without errors', () => {
      expect(() => {
        logger.warn('Test warning');
        logger.warn({ issue: 'warning' }, 'Warning with metadata');
      }).not.toThrow();
    });

    test('should log error messages without errors', () => {
      expect(() => {
        logger.error('Test error');
        logger.error({ error: new Error('test') }, 'Error with exception');
      }).not.toThrow();
    });

    test('should log debug messages without errors', () => {
      expect(() => {
        logger.debug('Test debug');
        logger.debug({ details: 'debug info' }, 'Debug with metadata');
      }).not.toThrow();
=======
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should log info messages', () => {
      logger.info('Test info message');
      expect(mockPinoLogger.info).toHaveBeenCalledWith({}, 'Test info message');
    });

    test('should log info messages with metadata', () => {
      const metadata = { userId: '123', action: 'login' };
      logger.info('User logged in', metadata);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(metadata, 'User logged in');
    });

    test('should log warn messages', () => {
      logger.warn('Test warning message');
      expect(mockPinoLogger.warn).toHaveBeenCalledWith({}, 'Test warning message');
    });

    test('should log warn messages with metadata', () => {
      const metadata = { threshold: 90, current: 95 };
      logger.warn('High memory usage', metadata);
      expect(mockPinoLogger.warn).toHaveBeenCalledWith(metadata, 'High memory usage');
    });

    test('should log error messages', () => {
      logger.error('Test error message');
      expect(mockPinoLogger.error).toHaveBeenCalledWith({}, 'Test error message');
    });

    test('should log error messages with error object', () => {
      const error = new Error('Something went wrong');
      logger.error('Operation failed', { error });
      expect(mockPinoLogger.error).toHaveBeenCalledWith({ error }, 'Operation failed');
    });

    test('should log error messages with stack trace', () => {
      const error = new Error('Critical failure');
      error.stack = 'Error: Critical failure\n    at test.js:123';
      logger.error('System error', { error, errorStack: error.stack });
      expect(mockPinoLogger.error).toHaveBeenCalledWith({
        error,
        errorStack: error.stack,
      }, 'System error');
    });

    test('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(mockPinoLogger.debug).toHaveBeenCalledWith({}, 'Test debug message');
    });

    test('should log debug messages with metadata', () => {
      const metadata = { cacheKey: 'user:123', ttl: 3600 };
      logger.debug('Cache hit', metadata);
      expect(mockPinoLogger.debug).toHaveBeenCalledWith(metadata, 'Cache hit');
    });

    test('should log http messages', () => {
      logger.http('GET /api/users');
      expect(mockPinoLogger.info).toHaveBeenCalledWith({}, 'GET /api/users');
    });

    test('should log http messages with request details', () => {
      const metadata = {
        method: 'GET',
        url: '/api/users',
        statusCode: 200,
        responseTime: 45,
      };
      logger.http('API Request', metadata);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(metadata, 'API Request');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    });
  });

  describe('Child Logger', () => {
<<<<<<< HEAD
    test('should create child logger with context', () => {
      const childLogger = createChildLogger({ component: 'TestComponent' });
=======
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should create child logger with metadata', () => {
      const metadata = { module: 'database', requestId: '123' };
      const childLogger = createChildLogger(metadata);

      expect(mockPinoLogger.child).toHaveBeenCalledWith(metadata);
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.warn).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(typeof childLogger.debug).toBe('function');
    });

<<<<<<< HEAD
    test('should create child logger with empty context', () => {
      const childLogger = createChildLogger({});
      expect(childLogger).toBeDefined();
    });

    test('should have child method on loggers', () => {
      const parent = createChildLogger({ component: 'Parent' });
      // Parent should have a child method
      expect(parent).toBeDefined();
      expect(typeof parent.child).toBe('function');

      // Just verify the method exists - nested children may not be needed for basic tests
    });

    test('should log with child logger', () => {
      const childLogger = createChildLogger({ module: 'test-module' });
      expect(() => {
        childLogger.info('Child logger message');
        childLogger.debug({ data: 'test' }, 'Debug from child');
      }).not.toThrow();
=======
    test('should create child logger for specific module', () => {
      const moduleLogger = createChildLogger({ module: 'auth' });
      expect(mockPinoLogger.child).toHaveBeenCalledWith({ module: 'auth' });
    });

    test('should create child logger with multiple context fields', () => {
      const context = {
        module: 'api',
        requestId: 'req-123',
        userId: 'user-456',
        correlationId: 'corr-789',
      };
      createChildLogger(context);
      expect(mockPinoLogger.child).toHaveBeenCalledWith(context);
    });

    test('should create child logger with nested metadata', () => {
      const metadata = {
        service: 'payment',
        transaction: {
          id: 'txn-123',
          amount: 100,
          currency: 'USD',
        },
      };
      createChildLogger(metadata);
      expect(mockPinoLogger.child).toHaveBeenCalledWith(metadata);
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    });
  });

  describe('Helper Functions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('logPerformance', () => {
      test('should log performance metrics', () => {
<<<<<<< HEAD
        expect(() => {
          logPerformance('testOperation', 150, { details: 'test' });
        }).not.toThrow();
      });

      test('should handle performance logging without metadata', () => {
        expect(() => {
          logPerformance('quickOp', 50);
        }).not.toThrow();
      });

      test('should log slow operations', () => {
        expect(() => {
          logPerformance('slowOperation', 1500, { threshold: 1000 });
        }).not.toThrow();
=======
        const operation = 'databaseQuery';
        const duration = 150;

        logPerformance(operation, duration);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          operation,
          durationMs: duration,
        }, 'Performance metric');
      });

      test('should log performance metrics with additional metadata', () => {
        const operation = 'apiCall';
        const duration = 250;
        const metadata = { endpoint: '/api/users', method: 'GET' };

        logPerformance(operation, duration, metadata);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          operation,
          durationMs: duration,
          endpoint: '/api/users',
          method: 'GET',
        }, 'Performance metric');
      });

      test('should handle zero duration', () => {
        logPerformance('fastOperation', 0);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          operation: 'fastOperation',
          durationMs: 0,
        }, 'Performance metric');
      });

      test('should handle large durations', () => {
        const duration = 30000; // 30 seconds
        logPerformance('slowOperation', duration);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          operation: 'slowOperation',
          durationMs: duration,
        }, 'Performance metric');
      });

      test('should handle fractional milliseconds', () => {
        const duration = 12.456;
        logPerformance('preciseOperation', duration);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          operation: 'preciseOperation',
          durationMs: duration,
        }, 'Performance metric');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
      });
    });

    describe('logApiRequest', () => {
<<<<<<< HEAD
      test('should log API request', () => {
        expect(() => {
          logApiRequest('GET', '/api/test', 200, 45);
        }).not.toThrow();
      });

      test('should log API request with metadata', () => {
        expect(() => {
          logApiRequest('POST', '/api/users', 201, 120, {
            userId: 'test-123',
            ip: '127.0.0.1'
          });
        }).not.toThrow();
      });

      test('should log failed API requests', () => {
        expect(() => {
          logApiRequest('GET', '/api/data', 500, 230, {
            error: 'Internal server error'
          });
        }).not.toThrow();
=======
      test('should log API requests', () => {
        const method = 'GET';
        const url = '/api/users';
        const statusCode = 200;
        const responseTime = 45;

        logApiRequest(method, url, statusCode, responseTime);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          method,
          url,
          statusCode,
          responseTimeMs: responseTime,
        }, 'API Request');
      });

      test('should log API requests with metadata', () => {
        const method = 'POST';
        const url = '/api/users';
        const statusCode = 201;
        const responseTime = 120;
        const metadata = { userId: '123', contentType: 'application/json' };

        logApiRequest(method, url, statusCode, responseTime, metadata);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          method,
          url,
          statusCode,
          responseTimeMs: responseTime,
          userId: '123',
          contentType: 'application/json',
        }, 'API Request');
      });

      test('should log failed API requests', () => {
        const method = 'GET';
        const url = '/api/users/999';
        const statusCode = 404;
        const responseTime = 25;

        logApiRequest(method, url, statusCode, responseTime);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          method,
          url,
          statusCode,
          responseTimeMs: responseTime,
        }, 'API Request');
      });

      test('should log server error responses', () => {
        const method = 'POST';
        const url = '/api/payments';
        const statusCode = 500;
        const responseTime = 5000;
        const metadata = { error: 'Internal server error' };

        logApiRequest(method, url, statusCode, responseTime, metadata);

        expect(mockPinoLogger.info).toHaveBeenCalledWith({
          method,
          url,
          statusCode,
          responseTimeMs: responseTime,
          error: 'Internal server error',
        }, 'API Request');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
      });

      test('should handle different HTTP methods', () => {
        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
        methods.forEach(method => {
<<<<<<< HEAD
          expect(() => {
            logApiRequest(method, '/api/test', 200, 100);
          }).not.toThrow();
=======
          jest.clearAllMocks();
          logApiRequest(method, '/api/resource', 200, 50);
          expect(mockPinoLogger.info).toHaveBeenCalledWith({
            method,
            url: '/api/resource',
            statusCode: 200,
            responseTimeMs: 50,
          }, 'API Request');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
        });
      });
    });

    describe('logDatabaseOperation', () => {
<<<<<<< HEAD
      test('should log database operation', () => {
        expect(() => {
          logDatabaseOperation('SELECT', 'users', 25);
        }).not.toThrow();
      });

      test('should log database operation with metadata', () => {
        expect(() => {
          logDatabaseOperation('INSERT', 'posts', 45, {
            rows: 1,
            userId: 'test-123'
          });
        }).not.toThrow();
      });

      test('should log slow database queries', () => {
        expect(() => {
          logDatabaseOperation('SELECT', 'large_table', 1200, {
            slow: true,
            queryComplexity: 'high'
          });
        }).not.toThrow();
=======
      test('should log database operations', () => {
        const operation = 'SELECT';
        const table = 'users';
        const duration = 25;

        logDatabaseOperation(operation, table, duration);

        expect(mockPinoLogger.debug).toHaveBeenCalledWith({
          operation,
          table,
          durationMs: duration,
        }, 'Database operation');
      });

      test('should log database operations with metadata', () => {
        const operation = 'INSERT';
        const table = 'orders';
        const duration = 50;
        const metadata = { rowCount: 1, userId: '123' };

        logDatabaseOperation(operation, table, duration, metadata);

        expect(mockPinoLogger.debug).toHaveBeenCalledWith({
          operation,
          table,
          durationMs: duration,
          rowCount: 1,
          userId: '123',
        }, 'Database operation');
      });

      test('should log slow database queries', () => {
        const operation = 'SELECT';
        const table = 'large_table';
        const duration = 5000; // 5 seconds
        const metadata = { slow: true, rowCount: 100000 };

        logDatabaseOperation(operation, table, duration, metadata);

        expect(mockPinoLogger.debug).toHaveBeenCalledWith({
          operation,
          table,
          durationMs: duration,
          slow: true,
          rowCount: 100000,
        }, 'Database operation');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
      });

      test('should handle different database operations', () => {
        const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRANSACTION'];
        operations.forEach(operation => {
<<<<<<< HEAD
          expect(() => {
            logDatabaseOperation(operation, 'test_table', 10);
          }).not.toThrow();
=======
          jest.clearAllMocks();
          logDatabaseOperation(operation, 'test_table', 10);
          expect(mockPinoLogger.debug).toHaveBeenCalledWith({
            operation,
            table: 'test_table',
            durationMs: 10,
          }, 'Database operation');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
        });
      });

      test('should log transaction operations', () => {
<<<<<<< HEAD
        expect(() => {
          logDatabaseOperation('TRANSACTION', 'multi_table', 150, {
            tables: ['users', 'posts', 'comments'],
            operations: 3
          });
        }).not.toThrow();
=======
        const operation = 'TRANSACTION';
        const table = 'multiple';
        const duration = 250;
        const metadata = {
          transactionId: 'txn-123',
          operations: ['INSERT', 'UPDATE', 'SELECT'],
        };

        logDatabaseOperation(operation, table, duration, metadata);

        expect(mockPinoLogger.debug).toHaveBeenCalledWith({
          operation,
          table,
          durationMs: duration,
          transactionId: 'txn-123',
          operations: ['INSERT', 'UPDATE', 'SELECT'],
        }, 'Database operation');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
      });
    });
  });

  describe('Metadata Handling', () => {
<<<<<<< HEAD
    test('should log with simple metadata', () => {
=======
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should handle empty metadata', () => {
      logger.info('Message without metadata');
      expect(mockPinoLogger.info).toHaveBeenCalledWith({}, 'Message without metadata');
    });

    test('should handle string metadata values', () => {
      logger.info('Message', { key: 'value' });
      expect(mockPinoLogger.info).toHaveBeenCalledWith({ key: 'value' }, 'Message');
    });

    test('should handle number metadata values', () => {
      logger.info('Message', { count: 42, duration: 123.45 });
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        count: 42,
        duration: 123.45,
      }, 'Message');
    });

    test('should handle boolean metadata values', () => {
      logger.info('Message', { success: true, cached: false });
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        success: true,
        cached: false,
      }, 'Message');
    });

    test('should handle array metadata values', () => {
      logger.info('Message', { tags: ['api', 'production'], ids: [1, 2, 3] });
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        tags: ['api', 'production'],
        ids: [1, 2, 3],
      }, 'Message');
    });

    test('should handle nested object metadata', () => {
      const metadata = {
        user: {
          id: '123',
          email: 'test@example.com',
          roles: ['admin', 'user'],
        },
        request: {
          method: 'POST',
          path: '/api/users',
        },
      };
      logger.info('Complex metadata', metadata);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(metadata, 'Complex metadata');
    });

    test('should handle null and undefined metadata values', () => {
      logger.info('Message', { nullValue: null, undefinedValue: undefined });
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        nullValue: null,
        undefinedValue: undefined,
      }, 'Message');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should handle extremely long messages', () => {
      const longMessage = 'A'.repeat(10000);
      logger.info(longMessage);
      expect(mockPinoLogger.info).toHaveBeenCalledWith({}, longMessage);
    });

    test('should handle special characters in messages', () => {
      const specialMessage = 'Test: \n\t\r\\ "quotes" \'apostrophes\' <tags>';
      logger.info(specialMessage);
      expect(mockPinoLogger.info).toHaveBeenCalledWith({}, specialMessage);
    });

    test('should handle unicode characters', () => {
      const unicodeMessage = '测试 テスト 테스트 🚀 ✨ ⚡';
      logger.info(unicodeMessage);
      expect(mockPinoLogger.info).toHaveBeenCalledWith({}, unicodeMessage);
    });

    test('should handle circular references in metadata (gracefully fail)', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Pino should handle this internally, we just ensure it doesn't crash
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
      expect(() => {
        logger.info({ userId: '123', action: 'login' }, 'User logged in');
      }).not.toThrow();
    });

<<<<<<< HEAD
    test('should log with nested metadata', () => {
      expect(() => {
        logger.info({
          user: { id: '123', name: 'Test' },
          request: { path: '/api/test', method: 'GET' }
        }, 'Complex operation');
      }).not.toThrow();
=======
    test('should handle very large metadata objects', () => {
      const largeMetadata: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeMetadata[`key${i}`] = `value${i}`;
      }

      logger.info('Large metadata', largeMetadata);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(largeMetadata, 'Large metadata');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    });

    test('should log with error objects', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error({ err: error }, 'Error occurred');
      }).not.toThrow();
    });

<<<<<<< HEAD
    test('should handle undefined metadata', () => {
      expect(() => {
        logger.info(undefined as any, 'Message without metadata');
      }).not.toThrow();
    });

    test('should handle null metadata', () => {
      expect(() => {
        logger.info(null as any, 'Message with null metadata');
      }).not.toThrow();
    });
  });

  describe('LogLevel Type', () => {
    test('should export LogLevel type', () => {
      const level: LogLevel = 'info';
      expect(level).toBe('info');
=======
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(iterations);
    });
  });

  describe('Performance', () => {
    test('should have minimal overhead for logging', () => {
      const iterations = 1000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        logger.info(`Performance test ${i}`, { iteration: i });
      }
      const end = performance.now();

      const duration = end - start;
      const avgPerLog = duration / iterations;

      // Average should be less than 1ms per log (with mocked pino)
      expect(avgPerLog).toBeLessThan(1);
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    });

    test('should support all log levels', () => {
      const levels: LogLevel[] = ['error', 'warn', 'info', 'http', 'debug'];
      levels.forEach(level => {
        expect(typeof level).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle logging errors gracefully', () => {
      expect(() => {
        logger.info({ circular: {} as any }, 'Test');
      }).not.toThrow();
    });

<<<<<<< HEAD
    test('should log exceptions without throwing', () => {
      const error = new Error('Test exception');
      expect(() => {
        logger.error({ error }, 'Exception logged');
      }).not.toThrow();
=======
      const metadata: UserMetadata = {
        userId: '123',
        action: 'login',
        timestamp: Date.now(),
      };

      logger.info('User action', metadata);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(metadata, 'User action');
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    });
  });
});
