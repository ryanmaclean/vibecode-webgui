/**
 * Tests for WebSocket Status Service
 */

// Mock ws module
const mockWsSend = jest.fn();
const mockWsClose = jest.fn();
const mockWsTerminate = jest.fn();
const mockWsPing = jest.fn();
const mockWsOn = jest.fn();
const mockWsOnce = jest.fn();

jest.mock('ws', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/lib/monitoring', () => ({
  monitoring: {
    submitEvent: jest.fn(),
  },
}));

jest.mock('@/lib/logging', () => ({
  createServiceLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)),
}));

import { WebSocketStatusService } from '../status-websocket';
import type { WebSocket as WSType } from 'ws';

function createMockWs(readyState = 1): WSType {
  const OPEN = 1;
  return {
    readyState,
    OPEN,
    send: mockWsSend,
    close: mockWsClose,
    terminate: mockWsTerminate,
    ping: mockWsPing,
    on: mockWsOn,
    once: mockWsOnce,
  } as unknown as WSType;
}

describe('WebSocketStatusService', () => {
  let service: WebSocketStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new WebSocketStatusService({
      heartbeatInterval: 30000,
      maxTotalConnections: 100,
      maxConnectionsPerIp: 5,
      maxMissedHeartbeats: 3,
      updateThrottleInterval: 1000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==== Constructor ====

  describe('constructor', () => {
    it('initializes with zero connections', () => {
      expect(service.getConnectionCount()).toBe(0);
    });

    it('initializes metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics.totalConnections).toBe(0);
      expect(metrics.totalMessagesSent).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });

  // ==== Start/Stop ====

  describe('start/stop', () => {
    it('emits started event on start', () => {
      const handler = jest.fn();
      service.on('started', handler);
      service.start();
      expect(handler).toHaveBeenCalled();
    });

    it('does not start twice', () => {
      service.start();
      const spy = jest.spyOn(console, 'log').mockImplementation();
      service.start(); // second start is a no-op
      spy.mockRestore();
    });

    it('stops and clears connections', async () => {
      service.start();
      const handler = jest.fn();
      service.on('stopped', handler);
      const stopPromise = service.stop();
      jest.advanceTimersByTime(6000);
      await stopPromise;
      expect(handler).toHaveBeenCalled();
    });

    it('stop is idempotent', async () => {
      service.start();
      const stopPromise = service.stop();
      jest.advanceTimersByTime(6000);
      await stopPromise;
      await service.stop(); // second stop is a no-op
    });
  });

  // ==== Handle Connection ====

  describe('handleConnection', () => {
    it('accepts new connection and returns connectionId', () => {
      const ws = createMockWs();
      const id = service.handleConnection(ws, '127.0.0.1', 'Mozilla/5.0');
      expect(id).toBeTruthy();
      expect(service.getConnectionCount()).toBe(1);
    });

    it('sends connection established message', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');
      expect(mockWsSend).toHaveBeenCalled();

      const sentMsg = JSON.parse(mockWsSend.mock.calls[0][0]);
      expect(sentMsg.type).toBe('connection_established');
      expect(sentMsg.payload.connectionId).toBeTruthy();
    });

    it('sends initial status when available', () => {
      service.updateHealthStatus({
        overallStatus: 'healthy',
        services: [{ name: 'postgres', status: 'healthy' }],
      } as any);

      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      // Should send connection_established and initial_status
      expect(mockWsSend).toHaveBeenCalledTimes(2);
      const statusMsg = JSON.parse(mockWsSend.mock.calls[1][0]);
      expect(statusMsg.type).toBe('initial_status');
    });

    it('rejects connection when at max capacity', () => {
      const limitedService = new WebSocketStatusService({
        maxTotalConnections: 1,
        maxConnectionsPerIp: 5,
        heartbeatInterval: 30000,
        maxMissedHeartbeats: 3,
        updateThrottleInterval: 1000,
      });

      const ws1 = createMockWs();
      const ws2 = createMockWs();

      limitedService.handleConnection(ws1, '127.0.0.1');
      const id2 = limitedService.handleConnection(ws2, '192.168.1.1');

      expect(id2).toBe('');
      expect(limitedService.getConnectionCount()).toBe(1);
    });

    it('rejects connection when IP limit reached', () => {
      const limitedService = new WebSocketStatusService({
        maxTotalConnections: 100,
        maxConnectionsPerIp: 1,
        heartbeatInterval: 30000,
        maxMissedHeartbeats: 3,
        updateThrottleInterval: 1000,
      });

      const ws1 = createMockWs();
      const ws2 = createMockWs();

      limitedService.handleConnection(ws1, '127.0.0.1');
      const id2 = limitedService.handleConnection(ws2, '127.0.0.1');

      expect(id2).toBe('');
    });

    it('emits connection event', () => {
      const handler = jest.fn();
      service.on('connection', handler);

      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: expect.any(String),
        })
      );
    });

    it('sets up WebSocket event handlers', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      // Should register message, close, error, pong handlers
      expect(mockWsOn).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWsOn).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWsOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWsOn).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    it('tracks authenticated connections', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1', undefined, 'user-123');

      const connections = service.getConnections();
      expect(connections[0].authenticated).toBe(true);
      expect(connections[0].userId).toBe('user-123');
    });
  });

  // ==== isClientConnected / disconnectClient ====

  describe('isClientConnected', () => {
    it('returns true for connected client', () => {
      const ws = createMockWs();
      const id = service.handleConnection(ws, '127.0.0.1');
      expect(service.isClientConnected(id)).toBe(true);
    });

    it('returns false for unknown client', () => {
      expect(service.isClientConnected('nonexistent')).toBe(false);
    });
  });

  describe('disconnectClient', () => {
    it('closes connection with reason', () => {
      const ws = createMockWs();
      const id = service.handleConnection(ws, '127.0.0.1');

      service.disconnectClient(id, 'Test reason');
      expect(mockWsSend).toHaveBeenCalled();
      expect(mockWsClose).toHaveBeenCalledWith(1000, 'Test reason');
    });
  });

  // ==== Broadcast Health Update ====

  describe('broadcastHealthUpdate', () => {
    it('broadcasts to connected clients', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');
      mockWsSend.mockClear();

      service.broadcastHealthUpdate({
        overallStatus: 'healthy',
        services: [{ name: 'postgres', status: 'healthy' }],
      } as any);

      expect(mockWsSend).toHaveBeenCalled();
      const msg = JSON.parse(mockWsSend.mock.calls[0][0]);
      expect(msg.type).toBe('health_update');
    });

    it('skips broadcast when no changes', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      const healthResult = {
        overallStatus: 'healthy',
        services: [{ name: 'postgres', status: 'healthy' }],
      } as any;

      // First broadcast
      service.broadcastHealthUpdate(healthResult);
      mockWsSend.mockClear();

      // Second broadcast with same data
      service.broadcastHealthUpdate(healthResult);
      // Should skip since no changes
      expect(mockWsSend).not.toHaveBeenCalled();
    });

    it('broadcasts when service status changes', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      service.broadcastHealthUpdate({
        overallStatus: 'healthy',
        services: [{ name: 'postgres', status: 'healthy' }],
      } as any);
      mockWsSend.mockClear();

      // Advance past the throttle interval so the second broadcast is not throttled
      jest.advanceTimersByTime(1100);

      service.broadcastHealthUpdate({
        overallStatus: 'degraded',
        services: [{ name: 'postgres', status: 'error' }],
      } as any);

      expect(mockWsSend).toHaveBeenCalled();
    });

    it('does not broadcast when shutting down', async () => {
      service.start();
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      // stop() waits for ws.once('close') or a 5s timeout; advance timers to unblock
      const stopPromise = service.stop();
      jest.advanceTimersByTime(6000);
      await stopPromise;
      mockWsSend.mockClear();

      service.broadcastHealthUpdate({
        overallStatus: 'healthy',
        services: [],
      } as any);

      expect(mockWsSend).not.toHaveBeenCalled();
    });

    it('emits broadcast event', () => {
      const handler = jest.fn();
      service.on('broadcast', handler);

      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      service.broadcastHealthUpdate({
        overallStatus: 'healthy',
        services: [{ name: 'db', status: 'healthy' }],
      } as any);

      expect(handler).toHaveBeenCalled();
    });
  });

  // ==== Metrics ====

  describe('getMetrics', () => {
    it('tracks total connections', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      const metrics = service.getMetrics();
      expect(metrics.totalConnections).toBe(1);
    });

    it('tracks messages sent', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      const metrics = service.getMetrics();
      // At least connection_established was sent
      expect(metrics.totalMessagesSent).toBeGreaterThanOrEqual(1);
    });

    it('calculates uptime', () => {
      const metrics = service.getMetrics();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==== getConnections ====

  describe('getConnections', () => {
    it('returns array of connection states', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1', 'TestAgent');

      const conns = service.getConnections();
      expect(conns).toHaveLength(1);
      expect(conns[0].clientIp).toBe('127.0.0.1');
      expect(conns[0].userAgent).toBe('TestAgent');
    });

    it('returns empty array when no connections', () => {
      expect(service.getConnections()).toHaveLength(0);
    });
  });

  // ==== Message Sequence ====

  describe('message sequence', () => {
    it('increments sequence numbers', () => {
      const ws = createMockWs();
      service.handleConnection(ws, '127.0.0.1');

      // First message is connection_established
      const msg1 = JSON.parse(mockWsSend.mock.calls[0][0]);
      expect(msg1.sequence).toBe(1);
    });
  });
});
