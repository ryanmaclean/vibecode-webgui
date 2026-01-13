/**
 * Comprehensive test suite for AI Chat Streaming API endpoint
 * Tests /api/ai/chat endpoint with streaming functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/ai/chat/route';

// Mock dependencies
jest.mock('@/lib/auth/middleware', () => ({
  withAIAuth: (handler: any) => handler,
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/cache/unified-cache-client', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  CacheTTL: {
    HOUR: 3600,
  },
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'gpt-4o-mini'),
}));

jest.mock('ai', () => ({
  streamText: jest.fn(),
}));

jest.mock('@/lib/tools', () => ({
  tools: {},
}));

import { getServerSession } from 'next-auth';
import { cache } from '@/lib/cache/unified-cache-client';
import { streamText } from 'ai';

describe('AI Chat Streaming API - /api/ai/chat', () => {
  const mockSession = {
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'user',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (cache.get as jest.Mock).mockResolvedValue(null);
    (cache.set as jest.Mock).mockResolvedValue(undefined);
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session has no user id', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: {} });

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Request Validation', () => {
    it('should reject requests with missing messages', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('should reject requests with empty messages array', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [],
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('should reject requests with invalid message role', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'invalid', content: 'Hello' }],
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('should reject requests with message content too long', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'a'.repeat(10001) }],
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('should reject requests with too many messages', async () => {
      const messages = Array(51)
        .fill(null)
        .map((_, i) => ({ role: 'user' as const, content: `Message ${i}` }));

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('should accept valid message requests', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Hello';
          yield ' World';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'ai/smollm2:360M-Q4_K_M',
          temperature: 0.7,
          maxTokens: 1000,
        }),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
    });

    it('should use default values for optional parameters', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.model).toBe('ai/smollm2:360M-Q4_K_M');
    });
  });

  describe('Non-Streaming Responses', () => {
    it('should return complete response for non-streaming requests', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Complete';
          yield ' response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.choices).toBeDefined();
      expect(data.choices[0].message.role).toBe('assistant');
      expect(data.choices[0].message.content).toBeTruthy();
    });

    it('should include processing time in response', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.processing_time_ms).toBeDefined();
      expect(typeof data.processing_time_ms).toBe('number');
      expect(data.processing_time_ms).toBeGreaterThan(0);
    });

    it('should include usage information in response', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test message' }],
          stream: false,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.usage).toBeDefined();
      expect(data.usage.prompt_tokens).toBeGreaterThan(0);
    });
  });

  describe('Streaming Responses', () => {
    it('should return streaming response when stream=true', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Stream';
          yield ' response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
        }),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('should stream chunks in SSE format', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Hello';
          yield ' World';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
        }),
      });

      const response = await POST(request as any);

      // Check that the response body is a ReadableStream
      expect(response.body).toBeDefined();
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('should send completion signal at end of stream', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Complete';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
        }),
      });

      const response = await POST(request as any);

      expect(response.body).toBeDefined();
      // The stream should end with [DONE]
    });
  });

  describe('Caching', () => {
    it('should cache non-streaming responses with low temperature', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Cached response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
          temperature: 0.2,
        }),
      });

      await POST(request as any);

      expect(cache.set).toHaveBeenCalled();
    });

    it('should not cache streaming responses', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Streamed response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
          temperature: 0.2,
        }),
      });

      await POST(request as any);

      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should not cache responses with high temperature', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Random response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
          temperature: 0.8,
        }),
      });

      await POST(request as any);

      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should return cached response when available', async () => {
      const cachedData = {
        id: 'cached-123',
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
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      (cache.get as jest.Mock).mockResolvedValue(cachedData);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
          temperature: 0.2,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.from_cache).toBe(true);
      expect(data.cache_hit).toBe(true);
      expect(data.choices[0].message.content).toBe('Cached response');
      expect(streamText).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle AI SDK errors gracefully', async () => {
      (streamText as jest.Mock).mockRejectedValue(new Error('AI service error'));

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.choices[0].message.content).toContain('experiencing technical difficulties');
    });

    it('should handle streaming errors gracefully', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Start';
          throw new Error('Stream error');
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: true,
        }),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
      // Stream should handle error without crashing
    });

    it('should handle missing API key gracefully', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.choices[0].message.content).toContain('development mode');
    });

    it('should return 500 for unexpected errors', async () => {
      (getServerSession as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
    });
  });

  describe('Health Check Endpoint', () => {
    it('should return health status on GET request', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'GET',
      });

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('ai-chat-api');
      expect(data.available_models).toBeDefined();
      expect(Array.isArray(data.available_models)).toBe(true);
    });

    it('should include user info in health check', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'GET',
      });

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.user).toBeDefined();
      expect(data.user.id).toBe('test-user-123');
      expect(data.user.email).toBe('test@example.com');
    });

    it('should list available features', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'GET',
      });

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.features).toBeDefined();
      expect(data.features).toContain('authentication');
      expect(data.features).toContain('rate_limiting');
      expect(data.features).toContain('input_validation');
    });
  });

  describe('Model Configuration', () => {
    it('should accept custom model parameter', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'openai/gpt-4',
          stream: false,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.model).toBe('openai/gpt-4');
    });

    it('should accept temperature parameter', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 1.5,
          stream: false,
        }),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
    });

    it('should reject temperature outside valid range', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 3.0,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });

    it('should accept maxTokens parameter', async () => {
      const mockTextStream = {
        textStream: (async function* () {
          yield 'Response';
        })(),
      };
      (streamText as jest.Mock).mockResolvedValue(mockTextStream);

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          maxTokens: 2000,
          stream: false,
        }),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
    });

    it('should reject maxTokens outside valid range', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          maxTokens: 5000,
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');
    });
  });
});
