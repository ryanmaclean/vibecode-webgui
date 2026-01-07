/**
 * Integration tests for AI Chat Stream API endpoints
 * Tests the basic streaming functionality without complex dependencies
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/chat/route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(async () => {
    return { user: { id: 1, email: 'test@example.com' } };
  }),
}));

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(async () => ({
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'developer',
  })),
}));

jest.mock('@/lib/rate-limiting', () => {
  // Use plain functions that return promises to avoid jest.fn() being cleared by resetModules
  const createRateLimitChecker = () => {
    return async () => ({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    });
  };

  return {
    __esModule: true,
    createAuthRateLimit: createRateLimitChecker,
    createAPIRateLimit: createRateLimitChecker,
    default: () => createRateLimitChecker(),
  };
});

jest.mock('@/lib/auth/user-manager', () => ({
  logSecurityEvent: jest.fn(),
}));

// Mock prisma - use the comprehensive mock
jest.mock('@/lib/prisma');

// Import after mocking to get the mock instance
import { prisma, logAIRequest } from '@/lib/prisma';

// Configure specific mocks
beforeAll(() => {
  (prisma.workspace.findFirst as jest.Mock).mockResolvedValue({ id: 1, workspace_id: 'test-workspace' });
  (logAIRequest as jest.Mock).mockResolvedValue(undefined);
});

jest.mock('@/lib/vector-store', () => ({
  vectorStore: {
    getContext: jest.fn().mockResolvedValue('Mock workspace context'),
    search: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/lib/ai-clients/litellm-instance', () => ({
  createChatCompletionWithFallback: jest.fn().mockResolvedValue({
    model: 'ai/smollm2:360M-Q4_K_M',
    provider: 'test-provider',
    usage: {
      prompt_tokens: 10,
      completion_tokens: 12,
    },
    choices: [
      {
        message: { content: 'Mock assistant response' },
      },
    ],
  }),
  pickFreeModel: jest.fn().mockReturnValue('ai/smollm2:360M-Q4_K_M'),
}));

jest.mock('@/lib/monitoring/llm-tracer', () => ({
  LLMTracer: {
    traceLLMCall: jest.fn(async (_operation: string, _meta: any, fn: () => Promise<any>) => {
      const response = await fn();
      return {
        response,
        modelUsed: response.model,
        provider: 'test-provider',
      };
    }),
    trackTokenUsage: jest.fn(),
  },
}));

// Mock external dependencies
jest.mock('@/lib/monitoring', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/monitoring/datadog-metrics', () => ({
  datadogMetrics: {
    increment: jest.fn(),
    timing: jest.fn(),
    histogram: jest.fn(),
  },
}));

describe('AI Chat Stream API - Simple Integration Tests', () => {
  // Helper function to safely parse response
  const parseResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        return await response.json();
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  beforeEach(() => {
    // NOTE: Avoiding jest.clearAllMocks() because jest.config has resetModules: true
    // which already resets modules between tests. clearAllMocks() would break the mocks
    // established at the top of this file.

    // Clear only specific mocks we control
    const { logAIRequest } = require('@/lib/prisma');
    if (logAIRequest && jest.isMockFunction(logAIRequest)) {
      (logAIRequest as jest.Mock).mockClear();
    }

    // Set required environment variables
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
    process.env.ALLOW_UNAUTHENTICATED_AI_TESTS = 'true';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.ALLOW_UNAUTHENTICATED_AI_TESTS;
  });

  describe('POST /api/ai/chat', () => {
    it('should return 400 for empty messages array', async () => {
      const requestBody = {
        messages: [],
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(400);
      if (data) {
        expect(data.error).toContain('Invalid request format');
      }
    });

    it('should return 400 for missing messages', async () => {
      const requestBody = {
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(400);
      if (data) {
        expect(data.error).toContain('Invalid request format');
      }
    });

    it('should return mock response for valid request', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Hello, can you help me?' }
        ],
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(200);
      if (data) {
        expect(data).toHaveProperty('choices');
        expect(data.choices[0]).toHaveProperty('message');
        expect(data.choices[0].message).toHaveProperty('content');
        expect(typeof data.choices[0].message.content).toBe('string');
        expect(data.choices[0].message.content.length).toBeGreaterThan(0);
      }
    });

    it('should handle different models', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Test message' }
        ],
        model: 'anthropic/claude-3.5-sonnet',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(200);
      if (data) {
        expect(data.model).toBe('anthropic/claude-3.5-sonnet');
      }
    });

    it('should use default model when not specified', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Test message' }
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(200);
      if (data) {
        expect(data.model).toBe('ai/smollm2:360M-Q4_K_M');
      }
    });

    it('should accept streaming request parameter', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Test streaming message' }
        ],
        model: 'ai/smollm2:360M-Q4_K_M',
        stream: true,
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      // Streaming returns 200 with SSE or plain text response
      expect(response.status).toBe(200);
    });

    it('should handle multiple messages in conversation', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' }
        ],
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(200);
      if (data) {
        expect(data).toHaveProperty('choices');
        expect(data.choices[0].message).toHaveProperty('content');
        expect(typeof data.choices[0].message.content).toBe('string');
      }
    });

    it('should handle invalid JSON gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(500);
      if (data) {
        expect(data).toHaveProperty('error');
      }
    });

    it('should measure processing time', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Test timing' }
        ],
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const data = await parseResponse(response);

      expect(response.status).toBe(200);
      if (data) {
        expect(data).toHaveProperty('processing_time_ms');
        expect(typeof data.processing_time_ms).toBe('number');
      }

      // Processing should be reasonably fast for mock responses
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: '{"messages": "not an array"}',
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(400);
      if (data) {
        expect(data.error).toContain('Invalid request format');
      }
    });

    it('should reject empty message content', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: '' }
        ],
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      // Empty content should be rejected by validation
      expect(response.status).toBe(400);
    });
  });

  describe('Response Format', () => {
    it('should return consistent response structure', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Test response format' }
        ],
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(200);
      if (data) {
        expect(data).toMatchObject({
          id: expect.any(String),
          object: 'chat.completion',
          model: expect.any(String),
          choices: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({
                role: 'assistant',
                content: expect.any(String),
              }),
            }),
          ]),
        });
      }
    });

    it('should return response from AI model', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Test mock responses' }
        ],
        model: 'ai/smollm2:360M-Q4_K_M',
      };

      const request = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await parseResponse(response);

      expect(response.status).toBe(200);

      if (data) {
        // Check that the response has the expected structure
        expect(data.choices[0].message.content).toBeTruthy();
        expect(typeof data.choices[0].message.content).toBe('string');
        expect(data.choices[0].message.content.length).toBeGreaterThan(0);
      }
    });
  });
});
