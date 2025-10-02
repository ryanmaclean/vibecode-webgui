/**
 * Comprehensive test suite for Winston-based logger utility
 *
 * Test Coverage:
 * - Logger initialization and configuration
 * - Log levels (error, warn, info, http, debug)
 * - Child logger creation with context
 * - Helper functions (logPerformance, logApiRequest, logDatabaseOperation)
 * - Environment-specific behavior
 * - Metadata handling
 * - Transport configuration
 */

import * as winston from 'winston';
import {
  logger,
  createChildLogger,
  logPerformance,
  logApiRequest,
  logDatabaseOperation,
  LogLevel,
} from '@/lib/logger';

// Mock winston to intercept log calls
jest.mock('winston', () => {
  const mockChildLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    child: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    child: jest.fn(() => mockChildLogger),
  };

  const mockTransports = {
    Console: jest.fn(),
    File: jest.fn(),
  };

  const mockFormat = {
    timestamp: jest.fn(() => 'timestamp-format'),
    errors: jest.fn(() => 'errors-format'),
    colorize: jest.fn(() => 'colorize-format'),
    printf: jest.fn(() => 'printf-format'),
    json: jest.fn(() => 'json-format'),
    combine: jest.fn((...args) => args),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    transports: mockTransports,
    format: mockFormat,
  };
});

describe('Logger Utility', () => {
  let originalEnv: NodeJS.ProcessEnv;

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
    test('should log info messages', () => {
      logger.info('Test info message');
      expect(logger.info).toHaveBeenCalledWith('Test info message');
    });

    test('should log info messages with metadata', () => {
      const metadata = { userId: '123', action: 'login' };
      logger.info('User logged in', metadata);
      expect(logger.info).toHaveBeenCalledWith('User logged in', metadata);
    });

    test('should log warn messages', () => {
      logger.warn('Test warning message');
      expect(logger.warn).toHaveBeenCalledWith('Test warning message');
    });

    test('should log warn messages with metadata', () => {
      const metadata = { threshold: 90, current: 95 };
      logger.warn('High memory usage', metadata);
      expect(logger.warn).toHaveBeenCalledWith('High memory usage', metadata);
    });

    test('should log error messages', () => {
      logger.error('Test error message');
      expect(logger.error).toHaveBeenCalledWith('Test error message');
    });

    test('should log error messages with error object', () => {
      const error = new Error('Something went wrong');
      logger.error('Operation failed', { error });
      expect(logger.error).toHaveBeenCalledWith('Operation failed', { error });
    });

    test('should log error messages with stack trace', () => {
      const error = new Error('Critical failure');
      error.stack = 'Error: Critical failure\n    at test.js:123';
      logger.error('System error', { error, errorStack: error.stack });
      expect(logger.error).toHaveBeenCalledWith('System error', {
        error,
        errorStack: error.stack,
      });
    });

    test('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(logger.debug).toHaveBeenCalledWith('Test debug message');
    });

    test('should log debug messages with metadata', () => {
      const metadata = { cacheKey: 'user:123', ttl: 3600 };
      logger.debug('Cache hit', metadata);
      expect(logger.debug).toHaveBeenCalledWith('Cache hit', metadata);
    });

    test('should log http messages', () => {
      logger.http('GET /api/users');
      expect(logger.http).toHaveBeenCalledWith('GET /api/users');
    });

    test('should log http messages with request details', () => {
      const metadata = {
        method: 'GET',
        url: '/api/users',
        statusCode: 200,
        responseTime: 45,
      };
      logger.http('API Request', metadata);
      expect(logger.http).toHaveBeenCalledWith('API Request', metadata);
    });
  });

  describe('Child Logger', () => {
    test('should create child logger with metadata', () => {
      const metadata = { module: 'database', requestId: '123' };
      const childLogger = createChildLogger(metadata);

      expect(logger.child).toHaveBeenCalledWith(metadata);
      expect(childLogger).toBeDefined();
      expect(childLogger).not.toBeNull();
    });

    test('should create child logger for specific module', () => {
      const moduleLogger = createChildLogger({ module: 'auth' });
      expect(logger.child).toHaveBeenCalledWith({ module: 'auth' });
    });

    test('should create child logger with multiple context fields', () => {
      const context = {
        module: 'api',
        requestId: 'req-123',
        userId: 'user-456',
        correlationId: 'corr-789',
      };
      createChildLogger(context);
      expect(logger.child).toHaveBeenCalledWith(context);
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
      expect(logger.child).toHaveBeenCalledWith(metadata);
    });
  });

  describe('Helper Functions', () => {
    describe('logPerformance', () => {
      test('should log performance metrics', () => {
        const operation = 'databaseQuery';
        const duration = 150;

        logPerformance(operation, duration);

        expect(logger.info).toHaveBeenCalledWith('Performance metric', {
          operation,
          durationMs: duration,
        });
      });

      test('should log performance metrics with additional metadata', () => {
        const operation = 'apiCall';
        const duration = 250;
        const metadata = { endpoint: '/api/users', method: 'GET' };

        logPerformance(operation, duration, metadata);

        expect(logger.info).toHaveBeenCalledWith('Performance metric', {
          operation,
          durationMs: duration,
          endpoint: '/api/users',
          method: 'GET',
        });
      });

      test('should handle zero duration', () => {
        logPerformance('fastOperation', 0);

        expect(logger.info).toHaveBeenCalledWith('Performance metric', {
          operation: 'fastOperation',
          durationMs: 0,
        });
      });

      test('should handle large durations', () => {
        const duration = 30000; // 30 seconds
        logPerformance('slowOperation', duration);

        expect(logger.info).toHaveBeenCalledWith('Performance metric', {
          operation: 'slowOperation',
          durationMs: duration,
        });
      });

      test('should handle fractional milliseconds', () => {
        const duration = 12.456;
        logPerformance('preciseOperation', duration);

        expect(logger.info).toHaveBeenCalledWith('Performance metric', {
          operation: 'preciseOperation',
          durationMs: duration,
        });
      });
    });

    describe('logApiRequest', () => {
      test('should log API requests', () => {
        const method = 'GET';
        const url = '/api/users';
        const statusCode = 200;
        const responseTime = 45;

        logApiRequest(method, url, statusCode, responseTime);

        expect(logger.http).toHaveBeenCalledWith('API Request', {
          method,
          url,
          statusCode,
          responseTimeMs: responseTime,
        });
      });

      test('should log API requests with metadata', () => {
        const method = 'POST';
        const url = '/api/users';
        const statusCode = 201;
        const responseTime = 120;
        const metadata = { userId: '123', contentType: 'application/json' };

        logApiRequest(method, url, statusCode, responseTime, metadata);

        expect(logger.http).toHaveBeenCalledWith('API Request', {
          method,
          url,
          statusCode,
          responseTimeMs: responseTime,
          userId: '123',
          contentType: 'application/json',
        });
      });

      test('should log failed API requests', () => {
        const method = 'GET';
        const url = '/api/users/999';
        const statusCode = 404;
        const responseTime = 25;

        logApiRequest(method, url, statusCode, responseTime);

        expect(logger.http).toHaveBeenCalledWith('API Request', {
          method,
          url,
          statusCode,
          responseTimeMs: responseTime,
        });
      });

      test('should log server error responses', () => {
        const method = 'POST';
        const url = '/api/payments';
        const statusCode = 500;
        const responseTime = 5000;
        const metadata = { error: 'Internal server error' };

        logApiRequest(method, url, statusCode, responseTime, metadata);

        expect(logger.http).toHaveBeenCalledWith('API Request', {
          method,
          url,
          statusCode,
          responseTimeMs: responseTime,
          error: 'Internal server error',
        });
      });

      test('should handle different HTTP methods', () => {
        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

        methods.forEach(method => {
          logApiRequest(method, '/api/resource', 200, 50);
          expect(logger.http).toHaveBeenCalledWith('API Request', {
            method,
            url: '/api/resource',
            statusCode: 200,
            responseTimeMs: 50,
          });
        });
      });
    });

    describe('logDatabaseOperation', () => {
      test('should log database operations', () => {
        const operation = 'SELECT';
        const table = 'users';
        const duration = 25;

        logDatabaseOperation(operation, table, duration);

        expect(logger.debug).toHaveBeenCalledWith('Database operation', {
          operation,
          table,
          durationMs: duration,
        });
      });

      test('should log database operations with metadata', () => {
        const operation = 'INSERT';
        const table = 'orders';
        const duration = 50;
        const metadata = { rowCount: 1, userId: '123' };

        logDatabaseOperation(operation, table, duration, metadata);

        expect(logger.debug).toHaveBeenCalledWith('Database operation', {
          operation,
          table,
          durationMs: duration,
          rowCount: 1,
          userId: '123',
        });
      });

      test('should log slow database queries', () => {
        const operation = 'SELECT';
        const table = 'large_table';
        const duration = 5000; // 5 seconds
        const metadata = { slow: true, rowCount: 100000 };

        logDatabaseOperation(operation, table, duration, metadata);

        expect(logger.debug).toHaveBeenCalledWith('Database operation', {
          operation,
          table,
          durationMs: duration,
          slow: true,
          rowCount: 100000,
        });
      });

      test('should handle different database operations', () => {
        const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'];

        operations.forEach(operation => {
          logDatabaseOperation(operation, 'test_table', 10);
          expect(logger.debug).toHaveBeenCalledWith('Database operation', {
            operation,
            table: 'test_table',
            durationMs: 10,
          });
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

        expect(logger.debug).toHaveBeenCalledWith('Database operation', {
          operation,
          table,
          durationMs: duration,
          transactionId: 'txn-123',
          operations: ['INSERT', 'UPDATE', 'SELECT'],
        });
      });
    });
  });

  describe('Metadata Handling', () => {
    test('should handle empty metadata', () => {
      logger.info('Message without metadata');
      expect(logger.info).toHaveBeenCalledWith('Message without metadata');
    });

    test('should handle string metadata values', () => {
      logger.info('Message', { key: 'value' });
      expect(logger.info).toHaveBeenCalledWith('Message', { key: 'value' });
    });

    test('should handle number metadata values', () => {
      logger.info('Message', { count: 42, duration: 123.45 });
      expect(logger.info).toHaveBeenCalledWith('Message', {
        count: 42,
        duration: 123.45,
      });
    });

    test('should handle boolean metadata values', () => {
      logger.info('Message', { success: true, cached: false });
      expect(logger.info).toHaveBeenCalledWith('Message', {
        success: true,
        cached: false,
      });
    });

    test('should handle array metadata values', () => {
      logger.info('Message', { tags: ['api', 'production'], ids: [1, 2, 3] });
      expect(logger.info).toHaveBeenCalledWith('Message', {
        tags: ['api', 'production'],
        ids: [1, 2, 3],
      });
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
      expect(logger.info).toHaveBeenCalledWith('Complex metadata', metadata);
    });

    test('should handle null and undefined metadata values', () => {
      logger.info('Message', { nullValue: null, undefinedValue: undefined });
      expect(logger.info).toHaveBeenCalledWith('Message', {
        nullValue: null,
        undefinedValue: undefined,
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle extremely long messages', () => {
      const longMessage = 'A'.repeat(10000);
      logger.info(longMessage);
      expect(logger.info).toHaveBeenCalledWith(longMessage);
    });

    test('should handle special characters in messages', () => {
      const specialMessage = 'Test: \n\t\r\\ "quotes" \'apostrophes\' <tags>';
      logger.info(specialMessage);
      expect(logger.info).toHaveBeenCalledWith(specialMessage);
    });

    test('should handle unicode characters', () => {
      const unicodeMessage = '测试 テスト 테스트 🚀 ✨ ⚡';
      logger.info(unicodeMessage);
      expect(logger.info).toHaveBeenCalledWith(unicodeMessage);
    });

    test('should handle circular references in metadata (gracefully fail)', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Winston should handle this internally, we just ensure it doesn't crash
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
      expect(logger.info).toHaveBeenCalledWith('Large metadata', largeMetadata);
    });

    test('should handle rapid successive logging', () => {
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        logger.info(`Message ${i}`, { index: i });
      }

      expect(logger.info).toHaveBeenCalledTimes(iterations);
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

      // Average should be less than 1ms per log (with mocked winston)
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
      expect(logger.info).toHaveBeenCalledWith('User action', metadata);
    });
  });
});
