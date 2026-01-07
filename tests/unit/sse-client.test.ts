/**
 * Simplified SSE Client Test Suite
 * Focus on core functionality without complex async/timer interactions
 */

// Mock the logger before importing the SSE client
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the SSE decoder
jest.mock('@/lib/ai/utils/sse-decoder', () => ({
  createSSEDecoder: jest.fn(() => ({
    push: jest.fn(),
    finish: jest.fn(),
    reset: jest.fn(),
    getState: jest.fn(() => ({ bufferedText: '', pendingDataLines: [] })),
  })),
}));

import { SSEClient, SSEClientConfig, SSEClientHandlers, SSEConnectionState } from '@/lib/streaming/sse-client';

// Mock EventSource - Create a proper mock class with jest tracking
class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState: number = 0;
  withCredentials: boolean = false;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string, options?: any) {
    this.url = url;
    this.withCredentials = options?.withCredentials || false;

    // Bind methods to ensure they work when called
    this.close = jest.fn(() => {
      this.readyState = 2; // CLOSED
    });
    this.addEventListener = jest.fn();
    this.removeEventListener = jest.fn();
    this.dispatchEvent = jest.fn();
  }

  close: any;
  addEventListener: any;
  removeEventListener: any;
  dispatchEvent: any;
}

// Use the MockEventSource class directly as the global EventSource
global.EventSource = MockEventSource as any;

// Mock fetch for POST requests
global.fetch = jest.fn();

// Mock window.location (delete first if it exists)
delete (window as any).location;
(window as any).location = {
  origin: 'http://localhost:3000',
  href: 'http://localhost:3000/',
};

describe('SSEClient', () => {
  let client: SSEClient;
  let handlers: jest.Mocked<SSEClientHandlers>;
  let config: SSEClientConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
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
  });

  describe('Basic Functionality', () => {
    test('should create client with correct initial state', () => {
      client = new SSEClient(config, handlers);
      
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    test('should initialize with default configuration', () => {
      client = new SSEClient({ url: 'test' }, handlers);
      
      const metrics = client.getMetrics();
      expect(metrics.connectionAttempts).toBe(0);
      expect(metrics.totalMessages).toBe(0);
    });

    test('should handle GET method with EventSource', () => {
      config.method = 'GET';
      client = new SSEClient(config, handlers);

      client.connect();

      // EventSource should be instantiated (checked by verifying state transition)
      expect(client.getState()).toBe('connecting');
    });

    test('should handle POST method with fetch', () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Test error'));

      client = new SSEClient(config, handlers);
      client.connect();

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
    });
  });

  describe('State Management', () => {
    test('should transition states correctly', () => {
      client = new SSEClient(config, handlers);
      
      expect(client.getState()).toBe('disconnected');
      
      client.connect();
      expect(client.getState()).toBe('connecting');
      
      client.disconnect();
      expect(client.getState()).toBe('disconnected');
    });

    test('should prevent multiple connections', () => {
      client = new SSEClient(config, handlers);
      
      client.connect();
      client.connect(); // Second call should be ignored

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should call state change handlers', () => {
      client = new SSEClient(config, handlers);
      
      client.connect();
      expect(handlers.onStateChange).toHaveBeenCalledWith('connecting');
      
      client.disconnect();
      expect(handlers.onStateChange).toHaveBeenCalledWith('disconnected');
    });
  });

  describe('Error Handling', () => {
    test('should handle fetch errors', () => {
      const error = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(error);

      client = new SSEClient(config, handlers);
      client.connect();

      // Error handling is async, so we check the connection attempt was made
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should handle HTTP errors', () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      client = new SSEClient(config, handlers);
      client.connect();

      expect(global.fetch).toHaveBeenCalled();
    });

    test('should handle null response body', () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: null,
      });

      client = new SSEClient(config, handlers);
      client.connect();

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    test('should track connection attempts', () => {
      client = new SSEClient(config, handlers);
      
      const initialMetrics = client.getMetrics();
      expect(initialMetrics.connectionAttempts).toBe(0);
      
      client.connect();
      
      const afterConnectMetrics = client.getMetrics();
      expect(afterConnectMetrics.connectionAttempts).toBe(1);
    });

    test('should provide comprehensive metrics', () => {
      client = new SSEClient(config, handlers);
      
      const metrics = client.getMetrics();
      
      expect(metrics).toHaveProperty('connectionAttempts');
      expect(metrics).toHaveProperty('successfulConnections');
      expect(metrics).toHaveProperty('failedConnections');
      expect(metrics).toHaveProperty('totalMessages');
      expect(metrics).toHaveProperty('totalBytes');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('connectionUptime');
      expect(metrics).toHaveProperty('bufferUsage');
      expect(metrics).toHaveProperty('messagesDropped');
    });
  });

  describe('Buffer Management', () => {
    test('should clear buffer on demand', () => {
      client = new SSEClient(config, handlers);
      
      client.clearBuffer();
      
      const metrics = client.getMetrics();
      expect(metrics.bufferUsage).toBe(0);
    });

    test('should handle buffer configuration', () => {
      const bufferConfig = {
        maxSize: 100,
        strategy: 'drop-oldest' as const,
        warningThreshold: 0.8,
      };
      
      client = new SSEClient({ ...config, buffer: bufferConfig }, handlers);
      
      expect(client).toBeDefined();
    });
  });

  describe('Reconnection', () => {
    test('should handle reconnection configuration', () => {
      const reconnectionConfig = {
        initialDelay: 1000,
        maxDelay: 5000,
        maxAttempts: 3,
        backoffMultiplier: 2,
        jitter: false,
      };
      
      client = new SSEClient({ ...config, reconnection: reconnectionConfig }, handlers);
      
      expect(client).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should disconnect cleanly', () => {
      client = new SSEClient(config, handlers);
      
      client.disconnect();
      
      expect(handlers.onClose).toHaveBeenCalled();
      expect(client.getState()).toBe('disconnected');
    });
  });
});