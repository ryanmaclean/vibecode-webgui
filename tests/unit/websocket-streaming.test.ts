/**
 * WebSocket Streaming Client Test Suite
 * Coverage target: 80%+
 */

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

jest.mock('@/lib/websocket-connection-pooling', () => ({
  getPooledWebSocket: jest.fn().mockResolvedValue({
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null
  }),
  releasePooledWebSocket: jest.fn(),
}));

// Import after mocks are set up
import { WebSocketStreamingClient } from '@/lib/streaming/websocket-streaming-client';

describe('WebSocketStreamingClient', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket('ws://test');
    (require('@/lib/websocket-connection-pooling').getPooledWebSocket as jest.Mock)
      .mockResolvedValue(mockWs);
  });

  describe('Connection', () => {
    test('should connect successfully', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      const promise = client.connect();
      mockWs.simulateOpen();
      await promise;
      expect(mockWs.readyState).toBe(MockWebSocket.OPEN);
    });

    test('should handle connection errors', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      const promise = client.connect();
      mockWs.onerror?.({} as Event);
      await expect(promise).rejects.toThrow();
    });
  });

  describe('Streaming', () => {
    test('should send stream request', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      await client.connect();
      mockWs.simulateOpen();
      
      await client.request({ type: 'stream-request', id: '1', payload: {} });
      expect(mockWs.send).toHaveBeenCalled();
    });

    test('should receive chunks in order', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      await client.connect();
      mockWs.simulateOpen();

      const chunks: any[] = [];
      client.stream('req1', {}, { onChunk: (c) => chunks.push(c) });

      mockWs.simulateMessage({ type: 'stream-chunk', requestId: 'req1', sequence: 0, data: 'a', timestamp: 0 });
      mockWs.simulateMessage({ type: 'stream-chunk', requestId: 'req1', sequence: 1, data: 'b', timestamp: 0 });

      expect(chunks).toHaveLength(2);
    });

    test('should handle stream completion', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      await client.connect();
      mockWs.simulateOpen();

      const handlers = { onChunk: jest.fn(), onComplete: jest.fn() };
      client.stream('req1', {}, handlers);

      mockWs.simulateMessage({ type: 'stream-complete', requestId: 'req1', timestamp: 0 });
      expect(handlers.onComplete).toHaveBeenCalled();
    });

    test('should handle stream errors', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      await client.connect();
      mockWs.simulateOpen();

      const handlers = { onChunk: jest.fn(), onError: jest.fn() };
      client.stream('req1', {}, handlers);

      mockWs.simulateMessage({
        type: 'stream-error',
        requestId: 'req1',
        error: { code: 'TEST', message: 'error', recoverable: false },
      });
      expect(handlers.onError).toHaveBeenCalled();
    });
  });

  describe('Stream Control', () => {
    test('should pause stream', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      await client.connect();
      mockWs.simulateOpen();

      client.stream('req1', {}, { onChunk: jest.fn() });
      await client.pauseStream('req1');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('pause')
      );
    });

    test('should resume stream', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      await client.connect();
      mockWs.simulateOpen();

      client.stream('req1', {}, { onChunk: jest.fn() });
      await client.resumeStream('req1');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('resume')
      );
    });

    test('should cancel stream', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      await client.connect();
      mockWs.simulateOpen();

      client.stream('req1', {}, { onChunk: jest.fn() });
      await client.cancelStream('req1');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('cancel')
      );
    });
  });

  describe('Priority Handling', () => {
    test('should use high priority connection', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test', priority: 'high' });
      await client.connect();
      
      expect(require('@/lib/websocket-connection-pooling').getPooledWebSocket)
        .toHaveBeenCalledWith('ws://test', 'high');
    });
  });

  describe('Cleanup', () => {
    test('should release connection on close', async () => {
      const client = new WebSocketStreamingClient({ url: 'ws://test' });
      await client.connect();
      mockWs.simulateOpen();

      client.close();

      expect(require('@/lib/websocket-connection-pooling').releasePooledWebSocket)
        .toHaveBeenCalledWith(mockWs);
    });
  });
});
