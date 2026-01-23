/**
 * Mock WebSocket Streaming Client for testing
 */

export interface MockWebSocketStreamingClientOptions {
  defaultLatency?: number;
  autoConnect?: boolean;
  autoComplete?: boolean;
}

export interface MockWebSocketStreamingClient {
  connect: jest.Mock;
  disconnect: jest.Mock;
  stream: jest.Mock;
  cancelStream: jest.Mock;
  pauseStream: jest.Mock;
  resumeStream: jest.Mock;
  isConnected: jest.Mock;
  getActiveStreamCount: jest.Mock;
  getStreamStats: jest.Mock;
}

/**
 * Create a mock WebSocket streaming client for testing
 */
export function createMockWebSocketStreamingClient(
  options: MockWebSocketStreamingClientOptions = {}
): MockWebSocketStreamingClient {
  const { autoConnect = false } = options;
  let connected = autoConnect;

  return {
    connect: jest.fn().mockImplementation(async () => {
      connected = true;
    }),
    disconnect: jest.fn().mockImplementation(() => {
      connected = false;
    }),
    stream: jest.fn().mockResolvedValue('mock-request-id'),
    cancelStream: jest.fn().mockResolvedValue(undefined),
    pauseStream: jest.fn().mockResolvedValue(undefined),
    resumeStream: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockImplementation(() => connected),
    getActiveStreamCount: jest.fn().mockReturnValue(0),
    getStreamStats: jest.fn().mockReturnValue(null),
  };
}

// Default export for jest.mock automatic mocking
export default {
  createMockWebSocketStreamingClient,
};
