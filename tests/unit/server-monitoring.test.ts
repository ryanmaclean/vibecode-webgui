/**
 * Unit tests for server-side monitoring functions
 * Tests dd-trace integration and server monitoring utilities
 */

import { jest } from '@jest/globals'

// Mock dd-trace
jest.mock('dd-trace', () => ({
  init: jest.fn(() => ({
    trace: jest.fn(),
    wrap: jest.fn(),
  })),
  trace: jest.fn(),
  wrap: jest.fn(),
}));

// Mock winston
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(() => jest.fn()),
    timestamp: jest.fn(() => jest.fn()),
    errors: jest.fn(() => jest.fn()),
    json: jest.fn(() => jest.fn()),
    printf: jest.fn(() => jest.fn()),
    colorize: jest.fn(() => jest.fn()),
    simple: jest.fn(() => jest.fn()),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
  };
});

import tracer from 'dd-trace'
import { ApplicationLogger, MetricsCollector, getHealthCheck } from '../../src/lib/server-monitoring'

describe('Server Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('ApplicationLogger', () => {
    let logger: ApplicationLogger;

    beforeEach(() => {
      logger = new ApplicationLogger();
    });

    test('should log auth events', () => {
      logger.logAuth('user_login', 'user123', { ip: '127.0.0.1' });

      expect(mockLogger.info).toHaveBeenCalledWith('Auth event: user_login', {
        category: 'auth',
        event: 'user_login',
        userId: 'user123',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
      });
    });

    test('should log workspace events', () => {
      logger.logWorkspace('file_created', 'workspace123', 'user123', { fileName: 'test.js' });

      expect(mockLogger.info).toHaveBeenCalledWith('Workspace event: file_created', {
        category: 'workspace',
        event: 'file_created',
        workspaceId: 'workspace123',
        userId: 'user123',
        fileName: 'test.js',
        timestamp: expect.any(String),
      });
    });

    test('should log AI events', () => {
      logger.logAI('code_completion', 'user123', { model: 'claude-3', tokens: 150 });

      expect(mockLogger.info).toHaveBeenCalledWith('AI event: code_completion', {
        category: 'ai',
        event: 'code_completion',
        userId: 'user123',
        model: 'claude-3',
        tokens: 150,
        timestamp: expect.any(String),
      });
    });

    test('should log security events', () => {
      logger.logSecurity('unauthorized_access', 'user123', { resource: '/admin', action: 'blocked' })

      expect(mockLogger.warn).toHaveBeenCalledWith('Security event: unauthorized_access', {
        category: 'security',
        event: 'unauthorized_access',
        userId: 'user123',
        resource: '/admin',
        action: 'blocked',
        timestamp: expect.any(String),
      })})

    test('should log API requests', () => {
      logger.logAPIRequest('GET', '/api/workspaces', 200, 150, 'user123')

      expect(mockLogger.info).toHaveBeenCalledWith('API Request: GET /api/workspaces', {
        category: 'api',
        method: 'GET',
        path: '/api/workspaces',
        statusCode: 200,
        duration: 150,
        userId: 'user123',
        timestamp: expect.any(String),
      })})

    test('should log errors', () => {
      const error = new Error('Test error')
      logger.logError('Database connection failed', error, { component: 'database' })

      expect(mockLogger.error).toHaveBeenCalledWith('Database connection failed', {
        category: 'error',
        error: error.message,
        stack: error.stack,
        component: 'database',
        timestamp: expect.any(String),
      })})

    test('should sanitize sensitive data in logs', () => {
      const sensitiveData = {
        password: 'secret123',
        apiKey: 'key123',
        token: 'bearer123',
        normalField: 'safe-value',
      }
      logger.logAuth('login_attempt', 'user123', sensitiveData)

      expect(mockLogger.info).toHaveBeenCalledWith('Auth event: login_attempt', {
        category: 'auth',
        event: 'login_attempt',
        userId: 'user123',
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        token: '[REDACTED]',
        normalField: 'safe-value',
        timestamp: expect.any(String),
      })})})

  describe('MetricsCollector', () => {
    let metricsCollector: MetricsCollector;

    beforeEach(() => {
      metricsCollector = new MetricsCollector()})

    test('should record response time', () => {
      metricsCollector.recordResponseTime('/api/test', 150);

      const metrics = metricsCollector.getMetrics()
      expect(metrics.responseTimes['/api/test']).toEqual([150])})

    test('should record error', () => {
      metricsCollector.recordError('/api/test', 'DatabaseError');

      const metrics = metricsCollector.getMetrics()
      expect(metrics.errors['/api/test']).toEqual(['DatabaseError'])})

    test('should increment request count', () => {
      metricsCollector.incrementRequestCount('/api/test')
      metricsCollector.incrementRequestCount('/api/test');

      const metrics = metricsCollector.getMetrics()
      expect(metrics.requestCounts['/api/test']).toBe(2)})

    test('should record custom metric', () => {
      metricsCollector.recordCustomMetric('database_connections', 5)
      metricsCollector.recordCustomMetric('database_connections', 7);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.customMetrics.database_connections).toEqual([5, 7])})

    test('should calculate average response time', () => {
      metricsCollector.recordResponseTime('/api/test', 100)
      metricsCollector.recordResponseTime('/api/test', 200)
      metricsCollector.recordResponseTime('/api/test', 300)

      const avgResponseTime = metricsCollector.getAverageResponseTime('/api/test');
      expect(avgResponseTime).toBe(200)})

    test('should calculate error rate', () => {
      metricsCollector.incrementRequestCount('/api/test')
      metricsCollector.incrementRequestCount('/api/test')
      metricsCollector.incrementRequestCount('/api/test')
      metricsCollector.recordError('/api/test', 'Error1')

      const errorRate = metricsCollector.getErrorRate('/api/test');
      expect(errorRate).toBeCloseTo(33.33, 1)})

    test('should reset metrics', () => {
      metricsCollector.recordResponseTime('/api/test', 150)
      metricsCollector.recordError('/api/test', 'Error')
      metricsCollector.incrementRequestCount('/api/test');

      metricsCollector.resetMetrics();

      const metrics = metricsCollector.getMetrics();
      expect(Object.keys(metrics.responseTimes)).toHaveLength(0);
      expect(Object.keys(metrics.errors)).toHaveLength(0);
      expect(Object.keys(metrics.requestCounts)).toHaveLength(0)
    })

    test('should limit stored metrics to prevent memory leaks', () => {
      // Add more than 1000 response times to test limit
      for (let i = 0; i < 1200; i++) {
        metricsCollector.recordResponseTime('/api/test', i)
      }
      const metrics = metricsCollector.getMetrics()
      expect(metrics.responseTimes['/api/test']).toHaveLength(1000)
      expect(metrics.responseTimes['/api/test'][0]).toBe(200) // Should start from index 200
    })
  })

  describe('Health Check', () => {
    test('should return health status', async () => {
      const health = await getHealthCheck()

      expect(health).toHaveProperty('status')
      expect(health).toHaveProperty('timestamp')
      expect(health).toHaveProperty('uptime')
      expect(health).toHaveProperty('memory')
      expect(health).toHaveProperty('cpu')
      expect(health.status).toBe('healthy')
    })

    test('should include memory information', async () => {
      const health = await getHealthCheck()

      expect(health.memory).toHaveProperty('used')
      expect(health.memory).toHaveProperty('total')
      expect(health.memory).toHaveProperty('percentage')
      expect(typeof health.memory.used).toBe('number')
      expect(typeof health.memory.total).toBe('number')
      expect(typeof health.memory.percentage).toBe('number')})

    test('should include CPU information', async () => {
      const health = await getHealthCheck()

      expect(health.cpu).toHaveProperty('usage')
      expect(typeof health.cpu.usage).toBe('number');
      expect(health.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(health.cpu.usage).toBeLessThanOrEqual(100)})})

  describe('Datadog Tracer Integration', () => {
    test('should initialize tracer with correct configuration', () => {
      // The tracer should be initialized when the module is imported
      expect(tracer.init).toHaveBeenCalledWith({
        service: 'vibecode-webgui',
        env: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        logInjection: true,
        runtimeMetrics: true,
        profiling: process.env.NODE_ENV === 'production',
      })})})

  describe('Error Handling', () => {
    test('should handle logger errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Mock winston logger to throw
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failed')});

      const logger = new ApplicationLogger()
      expect(() => logger.logAuth('test', 'user123')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore()})

    test('should handle metrics collection errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const metricsCollector = new MetricsCollector();

      // Force an error by corrupting internal state
      (metricsCollector as any).responseTimes = null

      expect(() => metricsCollector.recordResponseTime('/api/test', 150)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore()})})});
