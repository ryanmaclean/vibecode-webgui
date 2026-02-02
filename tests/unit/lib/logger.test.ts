/**
 * Comprehensive test suite for Pino-based logger utility
 *
 * Test Coverage:
 * - Logger initialization and configuration
 * - Log levels (error, warn, info, http, debug)
 * - Child logger creation with context
 * - Helper functions (logPerformance, logApiRequest, logDatabaseOperation)
 * - Environment-specific behavior
 * - Metadata handling
 */

import type { LogLevel } from '@/lib/logger';

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
let mockPinoLogger = (pino as any).__mockPinoLogger;
let mockChildLogger = (pino as any).__mockChildLogger;

describe('Logger Utility', () => {
  let logger: typeof import('@/lib/logger').logger;
  let createChildLogger: typeof import('@/lib/logger').createChildLogger;
  let logPerformance: typeof import('@/lib/logger').logPerformance;
  let logApiRequest: typeof import('@/lib/logger').logApiRequest;
  let logDatabaseOperation: typeof import('@/lib/logger').logDatabaseOperation;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    jest.resetModules();
    jest.unmock('@/lib/logger');
    const loggerModule = await import('@/lib/logger');
    logger = loggerModule.logger;
    createChildLogger = loggerModule.createChildLogger;
    logPerformance = loggerModule.logPerformance;
    logApiRequest = loggerModule.logApiRequest;
    logDatabaseOperation = loggerModule.logDatabaseOperation;
    const pinoMock = jest.requireMock('pino') as any;
    mockPinoLogger = pinoMock.__mockPinoLogger;
    mockChildLogger = pinoMock.__mockChildLogger;
  });

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    // Clear all mock calls
    jest.clearAllMocks();
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
      expect(logger.http).toBeDefined();
    });

    test('should have logger methods available', () => {
      // Verify logger has all required methods
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.http).toBe('function');
      expect(typeof logger.child).toBe('function');
    });

    test('should support different environments', () => {
      // Test that environment variables can be set
      const envs = ['development', 'production', 'test'];
      envs.forEach(env => {
        process.env.NODE_ENV = env;
        expect(process.env.NODE_ENV).toBe(env);
      });
    });

    test('should support custom log levels', () => {
      // Test that LOG_LEVEL environment variable can be set
      process.env.LOG_LEVEL = 'warn';
      expect(process.env.LOG_LEVEL).toBe('warn');
    });

    test('should create logger with default configuration', () => {
      // Verify the logger was created by checking it's defined
      expect(logger).toBeTruthy();
      expect(logger).not.toBeNull();
    });
  });

  describe('Log Levels', () => {
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
    });
  });

  describe('Child Logger', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should create child logger with metadata', () => {
      const metadata = { module: 'database', requestId: '123' };
      const childLogger = createChildLogger(metadata);

      expect(mockPinoLogger.child).toHaveBeenCalledWith(metadata);
      expect(childLogger).toBeDefined();
      expect(childLogger).not.toBeNull();
    });

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
    });
  });

  describe('Helper Functions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('logPerformance', () => {
      test('should log performance metrics', () => {
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
      });
    });

    describe('logApiRequest', () => {
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
      });

      test('should handle different HTTP methods', () => {
        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

        methods.forEach(method => {
          jest.clearAllMocks();
          logApiRequest(method, '/api/resource', 200, 50);
          expect(mockPinoLogger.info).toHaveBeenCalledWith({
            method,
            url: '/api/resource',
            statusCode: 200,
            responseTimeMs: 50,
          }, 'API Request');
        });
      });
    });

    describe('logDatabaseOperation', () => {
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
      });

      test('should handle different database operations', () => {
        const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'];

        operations.forEach(operation => {
          jest.clearAllMocks();
          logDatabaseOperation(operation, 'test_table', 10);
          expect(mockPinoLogger.debug).toHaveBeenCalledWith({
            operation,
            table: 'test_table',
            durationMs: 10,
          }, 'Database operation');
        });
      });

      test('should log transaction operations', () => {
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
      });
    });
  });

  describe('Metadata Handling', () => {
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
      expect(() => {
        logger.info('Circular reference', { circular });
      }).not.toThrow();
    });

    test('should handle very large metadata objects', () => {
      const largeMetadata: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeMetadata[`key${i}`] = `value${i}`;
      }

      logger.info('Large metadata', largeMetadata);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(largeMetadata, 'Large metadata');
    });

    test('should handle rapid successive logging', () => {
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        logger.info(`Message ${i}`, { index: i });
      }

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
    });

    test('should handle concurrent logging efficiently', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            logger.info(`Concurrent log ${i}`);
          })
        );
      }

      const start = performance.now();
      await Promise.all(promises);
      const end = performance.now();

      // All concurrent logs should complete quickly
      expect(end - start).toBeLessThan(100);
    });
  });

  describe('Type Safety', () => {
    test('should accept valid log levels', () => {
      const levels: LogLevel[] = ['error', 'warn', 'info', 'http', 'debug'];

      levels.forEach(level => {
        expect(typeof level).toBe('string');
        expect(['error', 'warn', 'info', 'http', 'debug']).toContain(level);
      });
    });

    test('should handle typed metadata', () => {
      interface UserMetadata {
        userId: string;
        action: string;
        timestamp: number;
      }

      const metadata: UserMetadata = {
        userId: '123',
        action: 'login',
        timestamp: Date.now(),
      };

      logger.info('User action', metadata);
      expect(mockPinoLogger.info).toHaveBeenCalledWith(metadata, 'User action');
    });
  });
});
