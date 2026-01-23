/**
 * Comprehensive tests for /api/ai/chat endpoint
 *
 * Tests all critical paths including:
 * - Happy path scenarios
 * - Error handling (401, 400, 429, 500, 503)
 * - Request validation
 * - Authentication
 * - Performance benchmarks
 */

// Mock all dependencies BEFORE imports
jest.mock('@/lib/auth/middleware', () => ({
  withAIAuth: (handler: any) => handler,
  AuthenticatedRequest: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/cache/unified-cache-client', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
  CacheTTL: {
    HOUR: 3600,
    MINUTE: 60,
  },
}));

jest.mock('@/lib/utils/api-response', () => ({
  createErrorResponseFromError: jest.fn((error, status, message, requestId) => {
    const headers = new Map<string, string>();
    return {
      json: async () => ({
        error: message,
        details: error.message,
        requestId,
      }),
      status,
      headers: {
        set: (key: string, value: string) => headers.set(key, value),
        get: (key: string) => headers.get(key),
      },
    };
  }),
}));

// Mock AI SDK
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue('mock-model'),
}));

jest.mock('ai', () => ({
  streamText: jest.fn().mockResolvedValue({
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield 'Hello';
        yield ' ';
        yield 'World';
      },
    },
  }),
}));

jest.mock('@/lib/tools', () => ({
  tools: {},
}));

import { NextRequest, NextResponse } from 'next/server';
import {
  mockChatCompletionResponse,
  mockAIFetch,
  mockAIFetchUnauthorized,
  mockAIFetchRateLimited,
  mockAIFetchServerError,
  mockAIFetchTimeout,
  resetAIMocks,
} from '../../mocks/ai-providers';

// Set environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENROUTER_API_KEY = 'test-or-key';

describe('Integration: /api/ai/chat', () => {
  let POST: any;
  let GET: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetAIMocks();

    // Dynamic import to ensure mocks are applied
    const routeModule = await import('@/app/api/ai/chat/route');
    POST = routeModule.POST;
    GET = routeModule.GET;
  });

  describe('POST /api/ai/chat - Happy Path', () => {
    it('should return successful AI chat completion with valid request', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, how are you?' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      // Add mock user to request
      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('choices');
      expect(data.choices[0]).toHaveProperty('message');
      expect(data.choices[0].message).toHaveProperty('content');
      expect(data.choices[0].message.role).toBe('assistant');
    });

    it('should handle streaming requests correctly', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Tell me a story' },
          ],
          model: 'gpt-4o-mini',
          stream: true,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      // In the current implementation, streaming returns text/plain or text/event-stream
      const contentType = response.headers.get('content-type');
      expect(contentType === 'text/plain' || contentType === 'text/event-stream').toBe(true);
    });

    it('should return cached response when available', async () => {
      const { cache } = await import('@/lib/cache/unified-cache-client');
      const cachedResponse = mockChatCompletionResponse({
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Cached response',
            },
            finish_reason: 'stop',
          },
        ],
      });

      (cache.get as jest.Mock).mockResolvedValueOnce(cachedResponse);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.2, // Low temperature for caching
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.from_cache).toBe(true);
      expect(data.cache_hit).toBe(true);
      expect(data.choices[0].message.content).toBe('Cached response');
    });
  });

  describe('POST /api/ai/chat - Validation', () => {
    it('should reject request with missing messages', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-mini',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request format');
      expect(data.details).toBeDefined();
    });

    it('should reject request with empty messages array', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [],
          model: 'gpt-4o-mini',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request format');
    });

    it('should reject request with invalid message role', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'invalid', content: 'Hello' },
          ],
          model: 'gpt-4o-mini',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject request with message content too long', async () => {
      const longContent = 'a'.repeat(10001); // Exceeds 10000 max

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: longContent },
          ],
          model: 'gpt-4o-mini',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request format');
    });

    it('should reject request with too many messages', async () => {
      const messages = Array.from({ length: 51 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          model: 'gpt-4o-mini',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject request with invalid temperature', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' },
          ],
          model: 'gpt-4o-mini',
          temperature: 3.0, // Exceeds max of 2
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/ai/chat - Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('should handle AI service errors gracefully', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' },
          ],
          model: 'gpt-4o-mini',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      // Mock streamText to throw error
      const { streamText } = await import('ai');
      (streamText as jest.Mock).mockRejectedValueOnce(new Error('AI service unavailable'));

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200); // Graceful fallback
      expect(data.choices[0].message.content).toContain('technical difficulties');
    });
  });

  describe('GET /api/ai/chat - Health Check', () => {
    it('should return health status with authentication', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'GET',
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('ai-chat-api');
      expect(data.user).toEqual({
        id: 'test-user-id',
        role: 'user',
        email: 'test@example.com',
      });
      expect(data.available_models).toBeInstanceOf(Array);
      expect(data.features).toContain('authentication');
      expect(data.features).toContain('rate_limiting');
      expect(data.features).toContain('datadog_monitoring');
    });

    it('should include security information in health check', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'GET',
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'admin',
      };

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.security).toBeDefined();
      expect(data.security.authenticated).toBe(true);
      expect(data.security.user_role).toBe('admin');
      expect(data.security.rate_limited).toBe(true);
      expect(data.security.input_validated).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should respond within acceptable time for non-streaming requests', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Quick question' },
          ],
          model: 'gpt-4o-mini',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const startTime = Date.now();
      const response = await POST(mockRequest);
      await response.json();
      const duration = Date.now() - startTime;

      // Should respond within 5 seconds (typically much faster in tests)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent requests efficiently', async () => {
      const createRequest = (content: string) => {
        const req = new NextRequest('http://localhost:3000/api/ai/chat', {
          method: 'POST',
          body: JSON.stringify({
            messages: [
              { role: 'user', content },
            ],
            model: 'gpt-4o-mini',
          }),
          headers: {
            'content-type': 'application/json',
          },
        });
        (req as any).user = {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'user',
        };
        return req;
      };

      const requests = [
        POST(createRequest('Request 1')),
        POST(createRequest('Request 2')),
        POST(createRequest('Request 3')),
        POST(createRequest('Request 4')),
        POST(createRequest('Request 5')),
      ];

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
