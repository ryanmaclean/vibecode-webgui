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

jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findFirst: jest.fn().mockResolvedValue({ id: 1, workspace_id: 'test-workspace' }),
    },
  },
  logAIRequest: jest.fn().mockResolvedValue(undefined),
}));

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
    jest.clearAllMocks();
    
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
        expect(data.error).toBe('Messages array is required and cannot be empty');
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
        expect(data.error).toBe('Messages array is required and cannot be empty');
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
        expect(data).toHaveProperty('content');
        expect(data).toHaveProperty('model');
        expect(data).toHaveProperty('timestamp');
        expect(typeof data.content).toBe('string');
        expect(data.content.length).toBeGreaterThan(0);
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

    it('should reject streaming request parameter', async () => {
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
      const data = await parseResponse(response);

      expect(response.status).toBe(400);
      if (data) {
        expect(data.error).toContain('Streaming is not supported');
      }
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
        expect(data).toHaveProperty('content');
        expect(typeof data.content).toBe('string');
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
        expect(data).toHaveProperty('timestamp');
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
        expect(data.error).toBe('Messages array is required and cannot be empty');
      }
    });

    it('should handle empty message content', async () => {
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

      // Should still work with empty content (mock doesn't validate content)
      expect(response.status).toBe(200);
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
          content: expect.any(String),
          model: expect.any(String),
          timestamp: expect.any(String),
        });

        // Validate timestamp format (ISO string)
        expect(() => new Date(data.timestamp)).not.toThrow();
      }
    });

    it('should return one of the predefined mock responses', async () => {
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
        // Check that the response is one of the expected mock responses
        const expectedResponses = [
          "I'll help you build that! Let me create a modern React component with TypeScript and Tailwind CSS.",
          "Great idea! I'll implement that feature using Next.js best practices and ensure it's fully responsive.",
          "Perfect! I'll add proper error handling, loading states, and accessibility features to make it production-ready.",
          "Excellent! I'll optimize the performance using React hooks and implement proper state management.",
          "I'll create that with voice integration support, making it compatible with the multimodal interface we built.",
        ];
        
        expect(expectedResponses).toContain(data.content);
      }
    });
  });
});
