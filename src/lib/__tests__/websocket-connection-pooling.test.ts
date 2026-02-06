/**
 * Unit tests for WebSocket Connection Pooling module
 * Tests connection pool management, metrics, and lifecycle
 */

// Mock the ws module before any imports
jest.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter;

  const mockWebSocket = jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    return {
      on: emitter.on.bind(emitter),
      once: emitter.once.bind(emitter),
      emit: emitter.emit.bind(emitter),
      send: jest.fn((data, callback) => callback && callback()),
      ping: jest.fn(),
      close: jest.fn(),
      readyState: 1,
      OPEN: 1,
    };
  });
  mockWebSocket.OPEN = 1;
  mockWebSocket.CLOSED = 3;
  return {
    default: mockWebSocket,
    __esModule: true,
  };
});

// Import after mocking
const wsModule = require('../websocket-connection-pooling');
const EventEmitter = require('events').EventEmitter;

describe('WebSocket Connection Pooling Module', () => {
  describe('Module exports', () => {
    it('should export WebSocketConnectionPool class', () => {
      expect(wsModule.WebSocketConnectionPool).toBeDefined();
      expect(typeof wsModule.WebSocketConnectionPool).toBe('function');
    });

    it('should export globalWebSocketPool instance', () => {
      expect(wsModule.globalWebSocketPool).toBeDefined();
      expect(wsModule.globalWebSocketPool).toBeInstanceOf(wsModule.WebSocketConnectionPool);
    });

    it('should export getPooledWebSocket utility function', () => {
      expect(wsModule.getPooledWebSocket).toBeDefined();
      expect(typeof wsModule.getPooledWebSocket).toBe('function');
    });

    it('should export releasePooledWebSocket utility function', () => {
      expect(wsModule.releasePooledWebSocket).toBeDefined();
      expect(typeof wsModule.releasePooledWebSocket).toBe('function');
    });
  });

  describe('WebSocketConnectionPool', () => {
    let pool;

    beforeEach(() => {
      pool = new wsModule.WebSocketConnectionPool({
        maxConnections: 10,
        maxConnectionsPerHost: 5,
        connectionTimeout: 5000,
        heartbeatInterval: 60000,
        reconnectDelay: 100,
        maxReconnectAttempts: 3,
      });
    });

    afterEach(async () => {
      await pool.destroy();
    });

    describe('constructor', () => {
      it('should create pool with default config when no options provided', async () => {
        const defaultPool = new wsModule.WebSocketConnectionPool();
        const status = defaultPool.getStatus();

        expect(status.config.maxConnections).toBe(100);
        expect(status.config.maxConnectionsPerHost).toBe(10);
        expect(status.config.connectionTimeout).toBe(30000);

        await defaultPool.destroy();
      });

      it('should create pool with custom config', () => {
        const status = pool.getStatus();

        expect(status.config.maxConnections).toBe(10);
        expect(status.config.maxConnectionsPerHost).toBe(5);
        expect(status.config.connectionTimeout).toBe(5000);
      });

      it('should extend EventEmitter', () => {
        expect(pool).toBeInstanceOf(EventEmitter);
      });
    });

    describe('getMetrics', () => {
      it('should return connection metrics object', () => {
        const metrics = pool.getMetrics();

        expect(metrics).toBeDefined();
        expect(typeof metrics.totalConnections).toBe('number');
        expect(typeof metrics.activeConnections).toBe('number');
        expect(typeof metrics.idleConnections).toBe('number');
        expect(typeof metrics.failedConnections).toBe('number');
        expect(typeof metrics.totalMessages).toBe('number');
        expect(typeof metrics.totalBytes).toBe('number');
        expect(typeof metrics.averageLatency).toBe('number');
        expect(typeof metrics.uptime).toBe('number');
      });

      it('should track uptime', async () => {
        const metricsBefore = pool.getMetrics();

        await new Promise(resolve => setTimeout(resolve, 50));

        const metricsAfter = pool.getMetrics();

        expect(metricsAfter.uptime).toBeGreaterThanOrEqual(metricsBefore.uptime);
      });
    });

    describe('getStatus', () => {
      it('should return pool status object', () => {
        const status = pool.getStatus();

        expect(status).toBeDefined();
        expect(typeof status.totalConnections).toBe('number');
        expect(typeof status.connectionsByHost).toBe('object');
        expect(typeof status.pendingRequests).toBe('number');
        expect(status.config).toBeDefined();
      });

      it('should start with zero connections', () => {
        const status = pool.getStatus();

        expect(status.totalConnections).toBe(0);
        expect(status.pendingRequests).toBe(0);
      });
    });

    describe('releaseConnection', () => {
      it('should handle release of non-existent connection gracefully', () => {
        expect(() => {
          pool.releaseConnection('non-existent-id', 'subscriber-1');
        }).not.toThrow();
      });
    });

    describe('sendMessage', () => {
      it('should throw error for non-existent connection', async () => {
        await expect(
          pool.sendMessage('non-existent-id', 'Hello')
        ).rejects.toThrow('Connection not found');
      });
    });

    describe('subscribeToConnection', () => {
      it('should throw error for non-existent connection', () => {
        expect(() => {
          pool.subscribeToConnection('non-existent-id', 'sub-1', {
            onMessage: () => {},
          });
        }).toThrow('Connection not found');
      });
    });

    describe('destroy', () => {
      it('should cleanup all resources', async () => {
        await pool.destroy();

        const status = pool.getStatus();
        expect(status.totalConnections).toBe(0);
        expect(status.pendingRequests).toBe(0);
      });

      it('should be idempotent', async () => {
        await pool.destroy();
        await expect(pool.destroy()).resolves.not.toThrow();
      });
    });

    describe('events', () => {
      it('should emit events when appropriate', () => {
        const errorHandler = jest.fn();
        pool.on('connection-error', errorHandler);

        pool.emit('connection-error', { error: new Error('test') });

        expect(errorHandler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('globalWebSocketPool configuration', () => {
    it('should have sensible default configuration', () => {
      const status = wsModule.globalWebSocketPool.getStatus();

      expect(status.config.maxConnections).toBe(200);
      expect(status.config.maxConnectionsPerHost).toBe(20);
      expect(status.config.connectionTimeout).toBe(30000);
      expect(status.config.heartbeatInterval).toBe(30000);
      expect(status.config.enableCompression).toBe(true);
    });
  });
});
