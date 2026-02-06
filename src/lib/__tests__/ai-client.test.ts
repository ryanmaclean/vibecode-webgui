/**
 * Unit tests for AI Client module
 * Tests the chat API client functions and interfaces
 */

describe('AI Client Module', () => {
  let aiClient;
  let mockFetch;

  beforeEach(() => {
    // Reset modules to get fresh module each time
    jest.resetModules();

    // Create a mock fetch that we control
    mockFetch = jest.fn();

    // Override global.fetch with our mock
    global.fetch = mockFetch;

    // Now require the module - it will use our mock
    aiClient = require('../ai-client');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Module exports', () => {
    it('should export chatRequest function', () => {
      expect(aiClient.chatRequest).toBeDefined();
      expect(typeof aiClient.chatRequest).toBe('function');
    });

    it('should export chatStreamRequest generator function', () => {
      expect(aiClient.chatStreamRequest).toBeDefined();
      expect(typeof aiClient.chatStreamRequest).toBe('function');
    });

    it('should export checkHealth function', () => {
      expect(aiClient.checkHealth).toBeDefined();
      expect(typeof aiClient.checkHealth).toBe('function');
    });
  });

  describe('chatRequest', () => {
    it('should make POST request to /api/ai/chat', async () => {
      const mockResponse = {
        id: 'chat-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello!',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const request = {
        messages: [{ role: 'user', content: 'Hi' }],
      };

      const result = await aiClient.chatRequest(request);

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should include default values for optional parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await aiClient.chatRequest({ messages: [{ role: 'user', content: 'Test' }] });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('ai/smollm2:360M-Q4_K_M');
      expect(body.stream).toBe(false);
      expect(body.temperature).toBe(0.7);
      expect(body.maxTokens).toBe(1000);
    });

    it('should use custom values when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'custom-model',
        temperature: 0.5,
        maxTokens: 500,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('custom-model');
      expect(body.temperature).toBe(0.5);
      expect(body.maxTokens).toBe(500);
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Server error' }),
      });

      await expect(
        aiClient.chatRequest({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Server error');
    });

    it('should handle JSON parse errors in error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Parse error')),
      });

      // When JSON parsing fails, the code catches and returns { error: 'Unknown error' }
      await expect(
        aiClient.chatRequest({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Unknown error');
    });
  });

  describe('chatStreamRequest', () => {
    it('should make POST request with stream: true', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: [DONE]\n'),
          })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const generator = aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      // Consume the generator
      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.stream).toBe(true);
    });

    it('should yield content from stream chunks', async () => {
      const streamData =
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n' +
        'data: {"choices":[{"delta":{"content":" World"}}]}\n' +
        'data: [DONE]\n';

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(streamData),
          })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const generator = aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContain('Hello');
      expect(chunks).toContain(' World');
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ error: 'Unauthorized' }),
      });

      const generator = aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      await expect(generator.next()).rejects.toThrow('Unauthorized');
    });

    it('should throw error when response body is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const generator = aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      await expect(generator.next()).rejects.toThrow('Response body is null');
    });
  });

  describe('checkHealth', () => {
    it('should make GET request to /api/ai/chat', async () => {
      const mockHealthResponse = {
        status: 'healthy',
        service: 'ai-chat',
        available_models: ['model-1', 'model-2'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockHealthResponse),
      });

      const result = await aiClient.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat', {
        method: 'GET',
      });

      expect(result).toEqual(mockHealthResponse);
    });

    it('should throw error on health check failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await expect(aiClient.checkHealth()).rejects.toThrow('Health check failed: 503');
    });
  });
});

describe('Type definitions', () => {
  it('ChatMessage should have required properties', () => {
    const message = {
      role: 'user',
      content: 'Hello',
    };

    expect(message.role).toBe('user');
    expect(message.content).toBe('Hello');
  });

  it('ChatRequest should accept optional properties', () => {
    const request = {
      messages: [],
      model: 'test',
      stream: true,
      temperature: 0.5,
      maxTokens: 100,
    };

    expect(request.messages).toEqual([]);
    expect(request.model).toBe('test');
    expect(request.stream).toBe(true);
    expect(request.temperature).toBe(0.5);
    expect(request.maxTokens).toBe(100);
  });
});
