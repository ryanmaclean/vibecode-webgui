/**
 * Comprehensive unit tests for AI Client module
 * Tests chat API client functions including streaming, error handling,
 * edge cases, and all exported interfaces
 */

describe('AI Client Module', () => {
  let aiClient: typeof import('../ai-client');
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
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
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should include default values for optional parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('ai/smollm2:360M-Q4_K_M');
      expect(body.stream).toBe(false);
      expect(body.temperature).toBe(0.7);
      expect(body.maxTokens).toBe(1000);
    });

    it('should use custom model when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'custom-model',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('custom-model');
    });

    it('should use custom temperature when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.2,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.2);
    });

    it('should use custom maxTokens when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 2000,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.maxTokens).toBe(2000);
    });

    it('should handle temperature of 0 correctly (not use default)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0);
    });

    it('should handle maxTokens of 0 correctly (not use default)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 0,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.maxTokens).toBe(0);
    });

    it('should throw error with server error message on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal Server Error' }),
      });

      await expect(
        aiClient.chatRequest({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Internal Server Error');
    });

    it('should throw with status code when error response has no error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(
        aiClient.chatRequest({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('API request failed: 429');
    });

    it('should handle JSON parse errors in error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Parse error')),
      });

      await expect(
        aiClient.chatRequest({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow('Unknown error');
    });

    it('should pass multiple messages correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
        { role: 'user' as const, content: 'How are you?' },
      ];

      await aiClient.chatRequest({ messages });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toEqual(messages);
    });

    it('should return response with usage data', async () => {
      const responseWithUsage = {
        id: 'chat-456',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Reply' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        processing_time_ms: 200,
        from_cache: false,
        cache_hit: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(responseWithUsage),
      });

      const result = await aiClient.chatRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.prompt_tokens).toBe(10);
      expect(result.processing_time_ms).toBe(200);
    });
  });

  describe('chatStreamRequest', () => {
    function createMockReader(chunks: Array<{ done: boolean; value?: Uint8Array }>) {
      let callIndex = 0;
      return {
        read: jest.fn().mockImplementation(() => {
          const result = chunks[callIndex] || { done: true };
          callIndex++;
          return Promise.resolve(result);
        }),
        releaseLock: jest.fn(),
      };
    }

    it('should make POST request with stream: true', async () => {
      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode('data: [DONE]\n') },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      const chunks: string[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.stream).toBe(true);
    });

    it('should yield content from stream chunks', async () => {
      const streamData =
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n' +
        'data: {"choices":[{"delta":{"content":" World"}}]}\n' +
        'data: [DONE]\n';

      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode(streamData) },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' World']);
    });

    it('should handle stream data across multiple reads', async () => {
      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Part1"}}]}\n') },
        { done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Part2"}}]}\n') },
        { done: false, value: new TextEncoder().encode('data: [DONE]\n') },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Part1', 'Part2']);
    });

    it('should skip empty lines in stream', async () => {
      const streamData =
        '\n\n' +
        'data: {"choices":[{"delta":{"content":"Content"}}]}\n' +
        '\n' +
        'data: [DONE]\n';

      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode(streamData) },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Content']);
    });

    it('should skip lines that do not start with data:', async () => {
      const streamData =
        'event: message\n' +
        'data: {"choices":[{"delta":{"content":"Valid"}}]}\n' +
        'id: 123\n' +
        'data: [DONE]\n';

      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode(streamData) },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Valid']);
    });

    it('should stop on finish_reason', async () => {
      const streamData =
        'data: {"choices":[{"delta":{"content":"Done"},"finish_reason":"stop"}]}\n' +
        'data: {"choices":[{"delta":{"content":"Should not appear"}}]}\n';

      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode(streamData) },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Done']);
    });

    it('should handle chunks with only role delta (no content)', async () => {
      const streamData =
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n' +
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n' +
        'data: [DONE]\n';

      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode(streamData) },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      // Should only yield "Hello", not the role-only delta
      expect(chunks).toEqual(['Hello']);
    });

    it('should handle malformed JSON in stream gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const streamData =
        'data: {invalid json}\n' +
        'data: {"choices":[{"delta":{"content":"After error"}}]}\n' +
        'data: [DONE]\n';

      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode(streamData) },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse stream chunk:', expect.any(Error));
      expect(chunks).toEqual(['After error']);
      consoleSpy.mockRestore();
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

    it('should handle JSON parse error in streaming error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('bad json')),
      });

      const generator = aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      await expect(generator.next()).rejects.toThrow('Unknown error');
    });

    it('should release reader lock in finally block', async () => {
      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode('data: [DONE]\n') },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });

      for await (const _chunk of generator) {
        // consume
      }

      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it('should handle stream that ends with done: true without [DONE] marker', async () => {
      const streamData = 'data: {"choices":[{"delta":{"content":"Final"}}]}\n';

      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode(streamData) },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Final']);
    });

    it('should handle partial data split across reads (buffering)', async () => {
      // First read ends mid-line, second completes it
      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"con') },
        { done: false, value: new TextEncoder().encode('tent":"Split"}}]}\ndata: [DONE]\n') },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const chunks: string[] = [];
      for await (const chunk of aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Split']);
    });

    it('should use default model in stream request', async () => {
      const mockReader = createMockReader([
        { done: false, value: new TextEncoder().encode('data: [DONE]\n') },
        { done: true },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const generator = aiClient.chatStreamRequest({
        messages: [{ role: 'user', content: 'Test' }],
      });
      for await (const _chunk of generator) { /* consume */ }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('ai/smollm2:360M-Q4_K_M');
      expect(body.temperature).toBe(0.7);
      expect(body.maxTokens).toBe(1000);
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

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat', { method: 'GET' });
      expect(result).toEqual(mockHealthResponse);
    });

    it('should throw error on health check failure with status code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await expect(aiClient.checkHealth()).rejects.toThrow('Health check failed: 503');
    });

    it('should return available_models array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'healthy',
          service: 'ai-chat',
          available_models: ['gpt-4', 'claude-3', 'llama-2'],
        }),
      });

      const result = await aiClient.checkHealth();
      expect(result.available_models).toHaveLength(3);
      expect(result.available_models).toContain('gpt-4');
    });
  });

  describe('Type definitions', () => {
    it('ChatMessage should accept user role', () => {
      const msg: { role: string; content: string } = { role: 'user', content: 'Hello' };
      expect(msg.role).toBe('user');
    });

    it('ChatMessage should accept assistant role', () => {
      const msg: { role: string; content: string } = { role: 'assistant', content: 'Hi' };
      expect(msg.role).toBe('assistant');
    });

    it('ChatMessage should accept system role', () => {
      const msg: { role: string; content: string } = { role: 'system', content: 'You are...' };
      expect(msg.role).toBe('system');
    });

    it('ChatRequest should have required messages property', () => {
      const request = { messages: [{ role: 'user', content: 'Hello' }] };
      expect(request.messages).toHaveLength(1);
    });

    it('ChatRequest should accept all optional properties', () => {
      const request = {
        messages: [],
        model: 'test',
        stream: true,
        temperature: 0.5,
        maxTokens: 100,
      };
      expect(request.stream).toBe(true);
    });

    it('ChatResponse should have choices array', () => {
      const response = {
        id: '1',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
      };
      expect(response.choices).toHaveLength(1);
    });

    it('StreamChunk should have delta with optional content', () => {
      const chunk = {
        choices: [{ delta: { content: 'hello' }, finish_reason: undefined }],
      };
      expect(chunk.choices[0].delta.content).toBe('hello');
    });
  });
});
