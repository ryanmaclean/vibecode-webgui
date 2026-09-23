/**
 * @jest-environment node
 */

/**
 * Unit tests for Chat Streaming API Route
 * Tests AI chat with Server-Sent Events streaming via OpenRouter
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/chat/stream/route';

// Mock rate limiting
jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn(() => {
    return jest.fn().mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60000,
    });
  }),
}));

// Helper function to create a mock NextRequest
function createMockRequest(url: string = 'http://localhost:3000/api/chat/stream', body?: any): NextRequest {
  const options: any = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return new NextRequest(url, options);
}

describe('/api/chat/stream', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up test environment
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();

    // Clear fetch mock
    global.fetch = fetch;
  });

  describe('POST /api/chat/stream', () => {
    it('should return 503 when API key is not configured', async () => {
      delete process.env.OPENROUTER_API_KEY;

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Hello, AI!',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('AI service not configured');
      expect(data.message).toContain('OPENROUTER_API_KEY');
      expect(data.timestamp).toBeDefined();
    });

    it('should return 400 when message is missing', async () => {
      const request = createMockRequest('http://localhost:3000/api/chat/stream', {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required field: message');
    });

    it('should accept messages array instead of single message', async () => {
      // Mock successful OpenRouter response
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
          { role: 'user', content: 'How are you?' },
        ],
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should return 429 when rate limit is exceeded', async () => {
      // Re-mock the module to return a rate limit failure
      jest.resetModules();
      jest.doMock('@/lib/rate-limiting', () => ({
        createAPIRateLimit: jest.fn(() => {
          return jest.fn().mockResolvedValue({
            success: false,
            limit: 30,
            remaining: 0,
            reset: Date.now() + 60000,
            retryAfter: 60,
          });
        }),
      }));

      // Re-import the route handler with the new mock
      const { POST: POST_WITH_RATE_LIMIT } = await import('@/app/api/chat/stream/route');

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test message',
      });

      const response = await POST_WITH_RATE_LIMIT(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('Retry-After')).toBe('60');

      // Restore the original mock
      jest.resetModules();
      jest.doMock('@/lib/rate-limiting', () => ({
        createAPIRateLimit: jest.fn(() => {
          return jest.fn().mockResolvedValue({
            success: true,
            limit: 30,
            remaining: 29,
            reset: Date.now() + 60000,
          });
        }),
      }));
    });

    it('should stream chat response successfully', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Hello, AI!',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      // Verify fetch was called correctly
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
          body: expect.stringContaining('"stream":true'),
        })
      );
    });

    it('should use custom model when provided', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
        model: 'openai/gpt-4',
      });

      await POST(request);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.model).toBe('openai/gpt-4');
    });

    it('should use default model when not specified', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      await POST(request);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.model).toBe('anthropic/claude-sonnet-4-6');
    });

    it('should handle OpenRouter API errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test message',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI provider request failed');
      expect(data.message).toContain('OpenRouter returned 500');
      expect(data.details).toBe('Internal Server Error');
    });

    it('should handle missing stream reader', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: null,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test message',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to read AI response stream');
    });

    it('should handle malformed JSON in stream gracefully', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {invalid json}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('should process stream and emit content events', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          // Emit enough chunks to trigger metadata emission
          for (let i = 0; i < 12; i++) {
            controller.enqueue(
              new TextEncoder().encode(`data: {"choices":[{"delta":{"content":"chunk${i}"}}]}\n\n`)
            );
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      const response = await POST(request);

      // Verify streaming response headers
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      // Verify fetch was called with the correct parameters
      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.messages).toEqual([{ role: 'user', content: 'Test' }]);
    });

    it('should handle stream completion with [DONE] event', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      const response = await POST(request);

      // Verify streaming response was set up correctly
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      // Verify the OpenRouter API was called with streaming enabled
      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.stream).toBe(true);
    });

    it('should handle unexpected errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process chat request');
      expect(data.message).toBe('Network error');
    });

    it('should use custom API base when configured', async () => {
      process.env.OPENROUTER_API_BASE = 'https://custom.api.base/v1';

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      await POST(request);

      expect(fetch).toHaveBeenCalledWith(
        'https://custom.api.base/v1/chat/completions',
        expect.anything()
      );
    });

    it('should set correct stream parameters', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      await POST(request);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.stream).toBe(true);
      expect(requestBody.temperature).toBe(0.7);
      expect(requestBody.max_tokens).toBe(4000);
    });

    it('should handle usage stats from OpenRouter', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"Hi"}}],"usage":{"total_tokens":150}}\n\n'
            )
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('should return JSON content type for errors', async () => {
      delete process.env.OPENROUTER_API_KEY;

      const request = createMockRequest('http://localhost:3000/api/chat/stream', {
        message: 'Test',
      });

      const response = await POST(request);

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should validate request body is valid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/stream', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process chat request');
    });
  });
});
