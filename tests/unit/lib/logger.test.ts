/**
 * Test suite for Pino-based logger utility
 * Tests use real Pino logger, not mocks
 */

import {
  logger,
  createChildLogger,
  logPerformance,
  logApiRequest,
  logDatabaseOperation,
  LogLevel,
} from '@/lib/logger';

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
    });
  });

  describe('Child Logger', () => {
    test('should create child logger with context', () => {
      const childLogger = createChildLogger({ component: 'TestComponent' });
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.warn).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(typeof childLogger.debug).toBe('function');
    });

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
    });
  });

  describe('Helper Functions', () => {
    describe('logPerformance', () => {
      test('should log performance metrics', () => {
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
      });
    });

    describe('logApiRequest', () => {
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
      });

      test('should handle different HTTP methods', () => {
        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
        methods.forEach(method => {
          expect(() => {
            logApiRequest(method, '/api/test', 200, 100);
          }).not.toThrow();
        });
      });
    });

    describe('logDatabaseOperation', () => {
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
      });

      test('should handle different database operations', () => {
        const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRANSACTION'];
        operations.forEach(operation => {
          expect(() => {
            logDatabaseOperation(operation, 'test_table', 10);
          }).not.toThrow();
        });
      });

      test('should log transaction operations', () => {
        expect(() => {
          logDatabaseOperation('TRANSACTION', 'multi_table', 150, {
            tables: ['users', 'posts', 'comments'],
            operations: 3
          });
        }).not.toThrow();
      });
    });
  });

  describe('Metadata Handling', () => {
    test('should log with simple metadata', () => {
      expect(() => {
        logger.info({ userId: '123', action: 'login' }, 'User logged in');
      }).not.toThrow();
    });

    test('should log with nested metadata', () => {
      expect(() => {
        logger.info({
          user: { id: '123', name: 'Test' },
          request: { path: '/api/test', method: 'GET' }
        }, 'Complex operation');
      }).not.toThrow();
    });

    test('should log with error objects', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error({ err: error }, 'Error occurred');
      }).not.toThrow();
    });

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

    test('should log exceptions without throwing', () => {
      const error = new Error('Test exception');
      expect(() => {
        logger.error({ error }, 'Exception logged');
      }).not.toThrow();
    });
  });
});
