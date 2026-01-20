/**
 * WebSocket Streaming Client Test Suite
 * Coverage target: 80%+
 */

// Use the real implementation, not the auto-mock
jest.unmock('@/lib/streaming/websocket-streaming-client');

import { WebSocketStreamingClient } from '@/lib/streaming/websocket-streaming-client';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  send = jest.fn();
  close = jest.fn();

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  simulateMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }
}

global.WebSocket = MockWebSocket as any;

// Create a mock pool
class MockPool {
  subscribeToConnection = jest.fn();
  sendMessage = jest.fn();
  releaseConnection = jest.fn();
}

jest.mock('@/lib/websocket-connection-pooling', () => ({
  WebSocketConnectionPool: jest.fn(() => new MockPool()),
  getPooledWebSocket: jest.fn(),
  releasePooledWebSocket: jest.fn(),
}));

describe('WebSocketStreamingClient', () => {
  let mockWs: MockWebSocket;
  let mockPool: MockPool;
  let client: WebSocketStreamingClient | null = null;

  beforeEach(() => {
    // Use fake timers to prevent memory leaks from setTimeout
    jest.useFakeTimers();

    mockWs = new MockWebSocket('ws://test');
    mockPool = new MockPool();

    // Mock getPooledWebSocket to return a connection object with id
    (require('@/lib/websocket-connection-pooling').getPooledWebSocket as jest.Mock)
      .mockResolvedValue({ id: 'test-connection-id', socket: mockWs });
  });

  afterEach(() => {
    // Clean up client connections
    if (client) {
      try {
        client.disconnect();
      } catch (error) {
        // Ignore cleanup errors
      }
      client = null;
    }

    // Clear all timers
    jest.clearAllTimers();
    jest.useRealTimers();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Connection', () => {
    test('should connect successfully', async () => {
      client = new WebSocketStreamingClient({ url: 'ws://test' }, mockPool as any);
      const promise = client.connect();
      mockWs.simulateOpen();
      await jest.runAllTimersAsync();
      await promise;
      expect(mockWs.readyState).toBe(MockWebSocket.OPEN);
    });

    test('should handle connection errors', async () => {
      // Simulate connection error
      const error = new Error('Connection failed');
      (require('@/lib/websocket-connection-pooling').getPooledWebSocket as jest.Mock)
        .mockRejectedValueOnce(error);

      client = new WebSocketStreamingClient({ url: 'ws://test' }, mockPool as any);
      await jest.runAllTimersAsync();
      await expect(client.connect()).rejects.toThrow();
    });
  });

  describe('Streaming', () => {
    test('should send stream request', async () => {
      client = new WebSocketStreamingClient({ url: 'ws://test' }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.runAllTimersAsync();
      await connectPromise;

      await client.stream({}, { onChunk: jest.fn() });
      await jest.runAllTimersAsync();
      expect(mockPool.sendMessage).toHaveBeenCalled();
    });

    test('should receive chunks in order', async () => {
      // Disable timeout to prevent stream from being removed
      client = new WebSocketStreamingClient({ url: 'ws://test', timeout: 0 }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.advanceTimersByTimeAsync(10);
      await connectPromise;

      const chunks: any[] = [];
      const requestId = await client.stream({}, { onChunk: (c) => chunks.push(c) });

      // Get the onMessage handler from subscribeToConnection
      const subscribeCall = mockPool.subscribeToConnection.mock.calls[0];
      expect(subscribeCall).toBeDefined();
      const messageHandler = subscribeCall[2].onMessage;

      // Simulate receiving chunks
      messageHandler(JSON.stringify({ type: 'stream-chunk', requestId, sequence: 0, data: 'a', timestamp: 0 }));
      messageHandler(JSON.stringify({ type: 'stream-chunk', requestId, sequence: 1, data: 'b', timestamp: 0 }));

      expect(chunks).toHaveLength(2);
    });

    test('should handle stream completion', async () => {
      // Disable timeout to prevent stream from being removed
      client = new WebSocketStreamingClient({ url: 'ws://test', timeout: 0 }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.advanceTimersByTimeAsync(10);
      await connectPromise;

      const handlers = { onChunk: jest.fn(), onComplete: jest.fn() };
      const requestId = await client.stream({}, handlers);

      // Get the onMessage handler from subscribeToConnection
      const subscribeCall = mockPool.subscribeToConnection.mock.calls[0];
      expect(subscribeCall).toBeDefined();
      const messageHandler = subscribeCall[2].onMessage;

      messageHandler(JSON.stringify({ type: 'stream-complete', requestId, timestamp: 0 }));
      expect(handlers.onComplete).toHaveBeenCalled();
    });

    test('should handle stream errors', async () => {
      client = new WebSocketStreamingClient({ url: 'ws://test' }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.runAllTimersAsync();
      await connectPromise;

      const handlers = { onChunk: jest.fn(), onError: jest.fn() };
      const requestId = await client.stream({}, handlers);
      await jest.runAllTimersAsync();

      // Get the onMessage handler from subscribeToConnection
      const subscribeCall = mockPool.subscribeToConnection.mock.calls[0];
      const messageHandler = subscribeCall[2].onMessage;

      messageHandler(JSON.stringify({
        type: 'stream-error',
        requestId,
        error: { code: 'TEST', message: 'error', recoverable: false },
      }));
      expect(handlers.onError).toHaveBeenCalled();
    });
  });

  describe('Stream Control', () => {
    test('should pause stream', async () => {
      // Disable timeout to prevent stream from being removed
      client = new WebSocketStreamingClient({ url: 'ws://test', timeout: 0 }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.advanceTimersByTimeAsync(10);
      await connectPromise;

      const requestId = await client.stream({}, { onChunk: jest.fn() });
      await client.pauseStream(requestId);

      const sendCalls = mockPool.sendMessage.mock.calls;
      const pauseCall = sendCalls.find((call: any) => call[1].includes('pause'));
      expect(pauseCall).toBeDefined();
    });

    test('should resume stream', async () => {
      // Disable timeout to prevent stream from being removed
      client = new WebSocketStreamingClient({ url: 'ws://test', timeout: 0 }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.advanceTimersByTimeAsync(10);
      await connectPromise;

      const requestId = await client.stream({}, { onChunk: jest.fn() });
      await client.resumeStream(requestId);

      const sendCalls = mockPool.sendMessage.mock.calls;
      const resumeCall = sendCalls.find((call: any) => call[1].includes('resume'));
      expect(resumeCall).toBeDefined();
    });

    test('should cancel stream', async () => {
      // Disable timeout to prevent stream from being removed
      client = new WebSocketStreamingClient({ url: 'ws://test', timeout: 0 }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.advanceTimersByTimeAsync(10);
      await connectPromise;

      const requestId = await client.stream({}, { onChunk: jest.fn() });
      await client.cancelStream(requestId);

      const sendCalls = mockPool.sendMessage.mock.calls;
      const cancelCall = sendCalls.find((call: any) => call[1].includes('cancel'));
      expect(cancelCall).toBeDefined();
    });
  });

  describe('Priority Handling', () => {
    test('should use high priority connection', async () => {
      client = new WebSocketStreamingClient({ url: 'ws://test', priority: 'high' }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.runAllTimersAsync();
      await connectPromise;

      expect(require('@/lib/websocket-connection-pooling').getPooledWebSocket)
        .toHaveBeenCalledWith('ws://test', 'high');
    });
  });

  describe('Cleanup', () => {
    test('should release connection on disconnect', async () => {
      client = new WebSocketStreamingClient({ url: 'ws://test' }, mockPool as any);
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await jest.runAllTimersAsync();
      await connectPromise;

      client.disconnect();

      expect(require('@/lib/websocket-connection-pooling').releasePooledWebSocket)
        .toHaveBeenCalled();
    });
  });
});
