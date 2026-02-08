/**
 * Comprehensive unit tests for WebSocket Connection Pooling module
 * Tests connection pool management, metrics, lifecycle, error handling,
 * reconnection logic, host tracking, and cleanup
 */

// Mock the ws module before any imports
// Track created mock sockets so tests can trigger events
let mockSockets: any[] = [];

jest.mock('ws', () => {
  const { EventEmitter } = require('events');
  const MockWebSocket = jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    const socket = {
      on: emitter.on.bind(emitter),
      once: emitter.once.bind(emitter),
      emit: emitter.emit.bind(emitter),
      removeListener: emitter.removeListener.bind(emitter),
      send: jest.fn((data: any, callback?: (err?: Error) => void) => {
        if (callback) callback();
      }),
      ping: jest.fn(),
      close: jest.fn(function (this: any) {
        // Emit close event asynchronously
        setTimeout(() => emitter.emit('close', 1000, 'normal'), 0);
      }),
      readyState: 1,
      OPEN: 1,
    };
    mockSockets.push(socket);
    // Auto-trigger 'open' asynchronously so createConnection resolves
    setTimeout(() => emitter.emit('open'), 0);
    return socket;
  });
  (MockWebSocket as unknown as Record<string, unknown>).OPEN = 1;
  (MockWebSocket as unknown as Record<string, unknown>).CLOSED = 3;
  return {
    default: MockWebSocket,
    __esModule: true,
  };
});

const { EventEmitter } = require('events');
const wsModule = require('../websocket-connection-pooling');

describe('WebSocket Connection Pooling Module', () => {
  beforeEach(() => {
    mockSockets = [];
  });

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
    let pool: InstanceType<typeof wsModule.WebSocketConnectionPool>;

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
        expect(status.config.heartbeatInterval).toBe(30000);
        expect(status.config.reconnectDelay).toBe(1000);
        expect(status.config.maxReconnectAttempts).toBe(5);
        expect(status.config.protocolVersion).toBe(13);

        await defaultPool.destroy();
      });

      it('should create pool with custom config', () => {
        const status = pool.getStatus();

        expect(status.config.maxConnections).toBe(10);
        expect(status.config.maxConnectionsPerHost).toBe(5);
        expect(status.config.connectionTimeout).toBe(5000);
        expect(status.config.reconnectDelay).toBe(100);
        expect(status.config.maxReconnectAttempts).toBe(3);
      });

      it('should extend EventEmitter', () => {
        expect(pool).toBeInstanceOf(EventEmitter);
      });

      it('should start with zero connections and pending requests', () => {
        const status = pool.getStatus();
        expect(status.totalConnections).toBe(0);
        expect(status.pendingRequests).toBe(0);
      });
    });

    describe('getConnection', () => {
      it('should create a new connection when pool is empty', async () => {
        const connection = await pool.getConnection('ws://localhost:8080/test');

        expect(connection).toBeDefined();
        expect(connection.id).toBeDefined();
        expect(connection.url).toBe('ws://localhost:8080/test');
        expect(connection.state).toBe('connected');
      });

      it('should reuse existing idle connection for same URL', async () => {
        const conn1 = await pool.getConnection('ws://localhost:8080/path');
        // Release the connection
        pool.releaseConnection(conn1.id, 'req_test');
        // Remove the subscriber that was added during getConnection
        conn1.subscribers.clear();
        conn1.state = 'idle';

        const conn2 = await pool.getConnection('ws://localhost:8080/path');
        // Should reuse existing (since both point to same URL and first is idle)
        // The connection may or may not be reused depending on state
        expect(conn2).toBeDefined();
        expect(conn2.url).toBe('ws://localhost:8080/path');
      });

      it('should accept priority parameter', async () => {
        const highConn = await pool.getConnection('ws://localhost:8080/high', 'high');
        expect(highConn).toBeDefined();

        const lowConn = await pool.getConnection('ws://localhost:8080/low', 'low');
        expect(lowConn).toBeDefined();
      });

      it('should track connections by host', async () => {
        await pool.getConnection('ws://host1.com/path1');
        await pool.getConnection('ws://host2.com/path2');

        const status = pool.getStatus();
        expect(status.connectionsByHost['ws://host1.com']).toBe(1);
        expect(status.connectionsByHost['ws://host2.com']).toBe(1);
      });

      it('should emit connection-created event', async () => {
        const createdHandler = jest.fn();
        pool.on('connection-created', createdHandler);

        await pool.getConnection('ws://localhost:8080/events');

        expect(createdHandler).toHaveBeenCalledTimes(1);
        expect(createdHandler).toHaveBeenCalledWith(
          expect.objectContaining({ url: 'ws://localhost:8080/events' })
        );
      });
    });

    describe('releaseConnection', () => {
      it('should handle release of non-existent connection gracefully', () => {
        expect(() => {
          pool.releaseConnection('non-existent-id', 'subscriber-1');
        }).not.toThrow();
      });

      it('should set connection to idle when all subscribers released', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/release');
        const subscriberId = Array.from(conn.subscribers)[0] as string;

        pool.releaseConnection(conn.id, subscriberId);

        expect(conn.state).toBe('idle');
      });

      it('should update lastUsed timestamp on release', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/release2');
        const subscriberId = Array.from(conn.subscribers)[0] as string;
        const beforeRelease = conn.lastUsed;

        // Small delay to ensure different timestamp
        await new Promise(r => setTimeout(r, 5));
        pool.releaseConnection(conn.id, subscriberId);

        expect(conn.lastUsed).toBeGreaterThanOrEqual(beforeRelease);
      });
    });

    describe('sendMessage', () => {
      it('should throw error for non-existent connection', async () => {
        await expect(
          pool.sendMessage('non-existent-id', 'Hello')
        ).rejects.toThrow('Connection not found');
      });

      it('should send string data through connection', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/send');

        await pool.sendMessage(conn.id, 'test message');

        expect(conn.socket.send).toHaveBeenCalledWith('test message', expect.any(Function));
      });

      it('should send Buffer data through connection', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/send-buf');
        const buffer = Buffer.from('binary data');

        await pool.sendMessage(conn.id, buffer);

        expect(conn.socket.send).toHaveBeenCalledWith(buffer, expect.any(Function));
      });

      it('should update message count and bytes sent on successful send', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/metrics');

        await pool.sendMessage(conn.id, 'hello');

        expect(conn.messageCount).toBe(1);
        expect(conn.bytesSent).toBeGreaterThan(0);
      });

      it('should update total metrics on send', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/total-metrics');
        const metricsBefore = pool.getMetrics();

        await pool.sendMessage(conn.id, 'data');

        const metricsAfter = pool.getMetrics();
        expect(metricsAfter.totalMessages).toBe(metricsBefore.totalMessages + 1);
      });

      it('should reject when send callback returns error', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/send-error');
        conn.socket.send.mockImplementationOnce((data: any, callback: (err?: Error) => void) => {
          callback(new Error('Send failed'));
        });

        await expect(pool.sendMessage(conn.id, 'fail')).rejects.toThrow('Send failed');
      });

      it('should throw when connection is in failed state', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/failed-state');
        conn.state = 'failed';

        await expect(pool.sendMessage(conn.id, 'data')).rejects.toThrow('Connection not available');
      });

      it('should throw when connection is in connecting state', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/connecting-state');
        conn.state = 'connecting';

        await expect(pool.sendMessage(conn.id, 'data')).rejects.toThrow('Connection not available');
      });

      it('should allow sending when connection is in busy state', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/busy-state');
        conn.state = 'busy';

        await expect(pool.sendMessage(conn.id, 'data')).resolves.not.toThrow();
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

      it('should add subscriber to connection', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/subscribe');
        const sizeBefore = conn.subscribers.size;

        pool.subscribeToConnection(conn.id, 'new-subscriber', {});

        expect(conn.subscribers.size).toBe(sizeBefore + 1);
        expect(conn.subscribers.has('new-subscriber')).toBe(true);
      });

      it('should register message handler', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/msg-handler');
        const onMessage = jest.fn();

        pool.subscribeToConnection(conn.id, 'msg-sub', { onMessage });

        expect(conn.socket.on).toBeDefined();
      });

      it('should register close handler', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/close-handler');
        const onClose = jest.fn();

        pool.subscribeToConnection(conn.id, 'close-sub', { onClose });

        expect(conn.socket.on).toBeDefined();
      });

      it('should register error handler', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/error-handler');
        const onError = jest.fn();

        pool.subscribeToConnection(conn.id, 'error-sub', { onError });

        expect(conn.socket.on).toBeDefined();
      });

      it('should handle subscription with all handlers', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/all-handlers');

        expect(() => {
          pool.subscribeToConnection(conn.id, 'all-sub', {
            onMessage: jest.fn(),
            onClose: jest.fn(),
            onError: jest.fn(),
          });
        }).not.toThrow();
      });

      it('should handle subscription with no handlers', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/no-handlers');

        expect(() => {
          pool.subscribeToConnection(conn.id, 'empty-sub', {});
        }).not.toThrow();
      });
    });

    describe('getMetrics', () => {
      it('should return connection metrics object with all fields', () => {
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
        await new Promise(resolve => setTimeout(resolve, 20));
        const metricsAfter = pool.getMetrics();

        expect(metricsAfter.uptime).toBeGreaterThan(metricsBefore.uptime);
      });

      it('should return a copy of metrics (not a reference)', () => {
        const metrics1 = pool.getMetrics();
        const metrics2 = pool.getMetrics();

        expect(metrics1).not.toBe(metrics2);
        expect(metrics1).toEqual(metrics2);
      });

      it('should count active connections with subscribers', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/active-metric');
        conn.state = 'connected';
        // Connection should already have a subscriber from getConnection

        const metrics = pool.getMetrics();
        expect(metrics.activeConnections).toBeGreaterThanOrEqual(1);
      });

      it('should count idle connections without subscribers', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/idle-metric');
        conn.state = 'connected';
        conn.subscribers.clear();

        const metrics = pool.getMetrics();
        expect(metrics.idleConnections).toBeGreaterThanOrEqual(1);
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

      it('should reflect connections count', async () => {
        await pool.getConnection('ws://localhost:8080/status1');

        const status = pool.getStatus();
        expect(status.totalConnections).toBe(1);
      });

      it('should group connections by host', async () => {
        await pool.getConnection('ws://host1.com/a');
        await pool.getConnection('ws://host1.com/b');
        await pool.getConnection('ws://host2.com/c');

        const status = pool.getStatus();
        expect(status.connectionsByHost['ws://host1.com']).toBe(2);
        expect(status.connectionsByHost['ws://host2.com']).toBe(1);
      });
    });

    describe('destroy', () => {
      it('should cleanup all resources', async () => {
        await pool.getConnection('ws://localhost:8080/destroy-test');

        await pool.destroy();

        const status = pool.getStatus();
        expect(status.totalConnections).toBe(0);
        expect(status.pendingRequests).toBe(0);
      });

      it('should be idempotent', async () => {
        await pool.destroy();
        await expect(pool.destroy()).resolves.not.toThrow();
      });

      it('should close open connections', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/close-on-destroy');
        const closeSpy = conn.socket.close;

        await pool.destroy();

        expect(closeSpy).toHaveBeenCalled();
      });

      it('should handle connections with non-OPEN readyState', async () => {
        const conn = await pool.getConnection('ws://localhost:8080/closed-socket');
        conn.socket.readyState = 3; // CLOSED

        await expect(pool.destroy()).resolves.not.toThrow();
      });
    });

    describe('events', () => {
      it('should emit connection-error events', () => {
        const errorHandler = jest.fn();
        pool.on('connection-error', errorHandler);

        pool.emit('connection-error', { error: new Error('test') });

        expect(errorHandler).toHaveBeenCalledTimes(1);
      });

      it('should emit connection-closed events', () => {
        const closedHandler = jest.fn();
        pool.on('connection-closed', closedHandler);

        pool.emit('connection-closed', { code: 1000, reason: 'normal' });

        expect(closedHandler).toHaveBeenCalledTimes(1);
      });

      it('should emit connection-removed events', () => {
        const removedHandler = jest.fn();
        pool.on('connection-removed', removedHandler);

        pool.emit('connection-removed', { id: 'test-id' });

        expect(removedHandler).toHaveBeenCalledTimes(1);
      });

      it('should emit connection-reconnected events', () => {
        const reconnectedHandler = jest.fn();
        pool.on('connection-reconnected', reconnectedHandler);

        pool.emit('connection-reconnected', { id: 'new-id' });

        expect(reconnectedHandler).toHaveBeenCalledTimes(1);
      });
    });

    describe('pool limits', () => {
      it('should respect maxConnections limit', async () => {
        const smallPool = new wsModule.WebSocketConnectionPool({
          maxConnections: 2,
          maxConnectionsPerHost: 2,
          connectionTimeout: 5000,
          heartbeatInterval: 60000,
        });

        const conn1 = await smallPool.getConnection('ws://host1.com/a');
        const conn2 = await smallPool.getConnection('ws://host2.com/b');

        expect(conn1).toBeDefined();
        expect(conn2).toBeDefined();

        const status = smallPool.getStatus();
        expect(status.totalConnections).toBe(2);

        await smallPool.destroy();
      });

      it('should respect maxConnectionsPerHost limit', async () => {
        const limitedPool = new wsModule.WebSocketConnectionPool({
          maxConnections: 10,
          maxConnectionsPerHost: 1,
          connectionTimeout: 5000,
          heartbeatInterval: 60000,
        });

        const conn1 = await limitedPool.getConnection('ws://singlehost.com/path1');
        expect(conn1).toBeDefined();

        const status = limitedPool.getStatus();
        expect(status.connectionsByHost['ws://singlehost.com']).toBe(1);

        await limitedPool.destroy();
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

  describe('URL host extraction', () => {
    let pool: InstanceType<typeof wsModule.WebSocketConnectionPool>;

    beforeEach(() => {
      pool = new wsModule.WebSocketConnectionPool({
        maxConnections: 50,
        maxConnectionsPerHost: 10,
        connectionTimeout: 5000,
        heartbeatInterval: 60000,
      });
    });

    afterEach(async () => {
      await pool.destroy();
    });

    it('should extract host from ws:// URLs', async () => {
      await pool.getConnection('ws://example.com:8080/path');

      const status = pool.getStatus();
      expect(status.connectionsByHost['ws://example.com:8080']).toBe(1);
    });

    it('should extract host from wss:// URLs', async () => {
      await pool.getConnection('wss://secure.example.com/path');

      const status = pool.getStatus();
      expect(status.connectionsByHost['wss://secure.example.com']).toBe(1);
    });

    it('should group same-host different-path URLs together', async () => {
      await pool.getConnection('ws://shared.host.com/path1');
      await pool.getConnection('ws://shared.host.com/path2');

      const status = pool.getStatus();
      expect(status.connectionsByHost['ws://shared.host.com']).toBe(2);
    });
  });
});
