/**
 * Comprehensive SSE Client Test Suite
 * Coverage target: 80%+
 * 
 * Tests connection lifecycle, reconnection, buffering, and error handling
 */

import { SSEClient, SSEClientConfig, SSEClientHandlers, SSEConnectionState } from '@/lib/streaming/sse-client';
import { StreamContentChunk, StreamMetadataChunk } from '@/lib/ai/utils/sse-decoder';

// Mock EventSource
global.EventSource = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  onopen: null,
  onmessage: null,
  onerror: null,
  readyState: 0,
  url: '',
  withCredentials: false,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
})) as any;

// Mock fetch for POST requests
global.fetch = jest.fn();

describe('SSEClient', () => {
  let client: SSEClient;
  let handlers: jest.Mocked<SSEClientHandlers>;
  let config: SSEClientConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    handlers = {
      onMessage: jest.fn(),
      onOpen: jest.fn(),
      onClose: jest.fn(),
      onError: jest.fn(),
      onReconnecting: jest.fn(),
      onStateChange: jest.fn(),
    };

    config = {
      url: 'http://localhost:3000/api/stream',
      method: 'POST',
      body: { query: 'test' },
      enableMetrics: true,
      debug: false,
    };
  });

  afterEach(() => {
    client?.disconnect();
    jest.useRealTimers();
  });

  describe('Connection Lifecycle', () => {
    test('should connect successfully with POST method', async () => {
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: test\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      expect(global.fetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          }),
        })
      );
      expect(handlers.onOpen).toHaveBeenCalled();
      expect(client.getState()).toBe('connected');
    });

    test('should connect with GET method using EventSource', () => {
      config.method = 'GET';
      client = new SSEClient(config, handlers);
      
      const mockEventSource = new EventSource('');
      (global.EventSource as jest.Mock).mockReturnValue(mockEventSource);

      client.connect();

      expect(global.EventSource).toHaveBeenCalled();
      
      // Simulate connection open
      mockEventSource.onopen?.({} as Event);
      
      expect(handlers.onOpen).toHaveBeenCalled();
      expect(client.isConnected()).toBe(true);
    });

    test('should not connect if already connecting', () => {
      client = new SSEClient(config, handlers);
      client.connect();
      client.connect(); // Second call should be ignored

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should disconnect cleanly', () => {
      client = new SSEClient(config, handlers);
      client.disconnect();

      expect(handlers.onClose).toHaveBeenCalled();
      expect(client.getState()).toBe('disconnected');
    });
  });

  describe('Reconnection Logic', () => {
    test('should attempt reconnection on connection error', async () => {
      config.reconnection = {
        initialDelay: 1000,
        maxDelay: 5000,
        maxAttempts: 3,
        backoffMultiplier: 2,
        jitter: false,
      };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      expect(handlers.onError).toHaveBeenCalled();
      expect(handlers.onReconnecting).toHaveBeenCalledWith(1, 1000);

      // Advance timer for reconnection
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();

      expect(handlers.onReconnecting).toHaveBeenCalledWith(2, 2000);
    });

    test('should use exponential backoff for reconnection delays', async () => {
      config.reconnection = {
        initialDelay: 1000,
        maxDelay: 30000,
        maxAttempts: 5,
        backoffMultiplier: 2,
        jitter: false,
      };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      const delays = [1000, 2000, 4000, 8000];
      
      for (let i = 0; i < delays.length; i++) {
        expect(handlers.onReconnecting).toHaveBeenCalledWith(i + 1, delays[i]);
        jest.advanceTimersByTime(delays[i]);
        await jest.runAllTimersAsync();
      }
    });

    test('should apply jitter to reconnection delays', async () => {
      config.reconnection = {
        initialDelay: 1000,
        maxAttempts: 3,
        jitter: true,
      };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      const call = handlers.onReconnecting.mock.calls[0];
      const delay = call[1];
      
      // Jitter should be ±25% of base delay
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1250);
    });

    test('should stop reconnecting after max attempts', async () => {
      config.reconnection = {
        initialDelay: 100,
        maxAttempts: 2,
      };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();
      jest.advanceTimersByTime(100);
      await jest.runAllTimersAsync();
      jest.advanceTimersByTime(200);
      await jest.runAllTimersAsync();

      expect(client.getState()).toBe('failed');
      expect(handlers.onReconnecting).toHaveBeenCalledTimes(2);
    });

    test('should reset reconnection attempts on successful connection', async () => {
      let attemptCount = 0;
      
      (global.fetch as jest.Mock).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Connection failed'));
        }
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: jest.fn().mockResolvedValue({ done: true }),
            }),
          },
        });
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();
      jest.advanceTimersByTime(2000);
      await jest.runAllTimersAsync();

      expect(handlers.onOpen).toHaveBeenCalled();
      
      const metrics = client.getMetrics();
      expect(metrics.successfulConnections).toBe(1);
      expect(metrics.reconnectionCount).toBe(2);
    });
  });

  describe('Message Buffering', () => {
    test('should buffer messages when consumer is slow', async () => {
      config.buffer = {
        maxSize: 10,
        strategy: 'drop-oldest',
      };

      client = new SSEClient(config, handlers);
      
      // Simulate messages arriving faster than processing
      for (let i = 0; i < 15; i++) {
        const chunk: StreamContentChunk = {
          type: 'content',
          delta: `message-${i}`,
          raw: `message-${i}`,
        };
        (client as any).handleMessage(chunk);
      }

      const metrics = client.getMetrics();
      expect(metrics.messagesDropped).toBe(5); // 15 - 10 = 5 dropped
    });

    test('should use drop-oldest strategy on buffer overflow', () => {
      config.buffer = {
        maxSize: 3,
        strategy: 'drop-oldest',
      };

      client = new SSEClient(config, handlers);
      
      const messages = ['msg1', 'msg2', 'msg3', 'msg4'];
      messages.forEach(msg => {
        (client as any).handleMessage({ type: 'content', delta: msg, raw: msg });
      });

      // Buffer should contain msg2, msg3, msg4 (msg1 dropped)
      expect(handlers.onMessage).toHaveBeenCalledTimes(4);
      expect(handlers.onMessage).toHaveBeenNthCalledWith(4, expect.objectContaining({ delta: 'msg4' }));
    });

    test('should use drop-newest strategy on buffer overflow', () => {
      config.buffer = {
        maxSize: 3,
        strategy: 'drop-newest',
      };

      client = new SSEClient(config, handlers);
      
      const messages = ['msg1', 'msg2', 'msg3', 'msg4'];
      messages.forEach(msg => {
        (client as any).handleMessage({ type: 'content', delta: msg, raw: msg });
      });

      const metrics = client.getMetrics();
      expect(metrics.messagesDropped).toBe(1); // msg4 dropped
    });

    test('should trigger warning callback when buffer usage exceeds threshold', () => {
      const onBufferWarning = jest.fn();
      config.buffer = {
        maxSize: 10,
        warningThreshold: 0.8,
        onBufferWarning,
      };

      client = new SSEClient(config, handlers);
      
      // Fill buffer to 9/10 (90%)
      for (let i = 0; i < 9; i++) {
        (client as any).handleMessage({ type: 'content', delta: `msg${i}`, raw: `msg${i}` });
      }

      expect(onBufferWarning).toHaveBeenCalledWith(0.9);
    });

    test('should clear buffer on demand', () => {
      client = new SSEClient(config, handlers);
      
      for (let i = 0; i < 5; i++) {
        (client as any).handleMessage({ type: 'content', delta: `msg${i}`, raw: `msg${i}` });
      }

      client.clearBuffer();
      
      const metrics = client.getMetrics();
      expect(metrics.bufferUsage).toBe(0);
    });
  });

  describe('Heartbeat Monitoring', () => {
    test('should detect connection timeout and reconnect', async () => {
      config.heartbeatTimeout = 5000;
      config.reconnection = { maxAttempts: 1 };

      const mockReader = {
        read: jest.fn().mockImplementation(() => 
          new Promise(() => {}) // Never resolves - simulates no data
        ),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();
      
      // Advance past heartbeat timeout
      jest.advanceTimersByTime(6000);
      await jest.runAllTimersAsync();

      expect(handlers.onReconnecting).toHaveBeenCalled();
    });

    test('should reset heartbeat timer on message receipt', async () => {
      config.heartbeatTimeout = 5000;

      const messages = ['data: msg1\n\n', 'data: msg2\n\n'];
      let messageIndex = 0;

      const mockReader = {
        read: jest.fn().mockImplementation(async () => {
          if (messageIndex < messages.length) {
            const value = new TextEncoder().encode(messages[messageIndex++]);
            return { done: false, value };
          }
          return { done: true, value: undefined };
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      // Each message should reset the heartbeat timer
      expect(handlers.onMessage).toHaveBeenCalledTimes(2);
      expect(client.getState()).toBe('disconnected'); // Stream ended normally
    });
  });

  describe('Metrics Tracking', () => {
    test('should track connection attempts and successes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true }),
          }),
        },
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      const metrics = client.getMetrics();
      expect(metrics.connectionAttempts).toBe(1);
      expect(metrics.successfulConnections).toBe(1);
      expect(metrics.failedConnections).toBe(0);
    });

    test('should track failed connections', async () => {
      config.reconnection = { maxAttempts: 0 };
      
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      const metrics = client.getMetrics();
      expect(metrics.connectionAttempts).toBe(1);
      expect(metrics.failedConnections).toBe(1);
    });

    test('should track messages and bytes received', async () => {
      const testData = 'data: test message\n\n';
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(testData) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      const metrics = client.getMetrics();
      expect(metrics.totalMessages).toBeGreaterThan(0);
      expect(metrics.totalBytes).toBeGreaterThan(0);
    });

    test('should calculate average latency to first byte', async () => {
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: test\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      client = new SSEClient(config, handlers);
      
      const startTime = Date.now();
      client.connect();

      await jest.runAllTimersAsync();

      const metrics = client.getMetrics();
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
    });

    test('should track connection uptime', async () => {
      const mockReader = {
        read: jest.fn().mockImplementation(() => 
          new Promise(() => {}) // Keep connection open
        ),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      jest.advanceTimersByTime(5000);

      const metrics = client.getMetrics();
      expect(metrics.connectionUptime).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('Error Handling', () => {
    test('should handle HTTP errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('500'),
        })
      );
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Network error',
        })
      );
    });

    test('should handle malformed SSE data', async () => {
      const invalidData = 'invalid sse data without proper format';
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(invalidData) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      // Should handle gracefully without crashing
      expect(client.getState()).toBe('disconnected');
    });

    test('should handle null response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: null,
      });

      client = new SSEClient(config, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      expect(handlers.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Response body is null',
        })
      );
    });
  });

  describe('State Management', () => {
    test('should transition through correct states', async () => {
      const states: SSEConnectionState[] = [];
      handlers.onStateChange = jest.fn((state) => states.push(state));

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true }),
          }),
        },
      });

      client = new SSEClient({ ...config }, handlers);
      client.connect();

      await jest.runAllTimersAsync();

      expect(states).toContain('connecting');
      expect(states).toContain('connected');
    });

    test('should report correct connection state', () => {
      client = new SSEClient(config, handlers);
      
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);

      client.connect();
      expect(client.getState()).toBe('connecting');
    });
  });
});
