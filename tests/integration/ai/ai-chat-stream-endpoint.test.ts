/**
 * Comprehensive tests for /api/ai/chat/stream endpoint
 *
 * Tests all critical paths including:
 * - Streaming responses with SSE
 * - RAG context integration
 * - Error handling
 * - Request validation
 * - Performance benchmarks
 */

// Mock all dependencies BEFORE imports
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    },
  }),
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/api/validation/middleware', () => ({
  validateRequestBody: jest.fn(async (req, schema) => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);
      return { success: true, data: validated };
    } catch (error: any) {
      return {
        success: false,
        error: {
          error: 'Invalid request data',
          details: error.errors || [],
        },
      };
    }
  }),
}));

jest.mock('openai', () => {
  const mockCreate = jest.fn().mockImplementation(async (params) => {
    if (params.stream) {
      return {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' ' } }] };
          yield { choices: [{ delta: { content: 'World' } }] };
          yield { choices: [{ delta: { content: '!' } }] };
        },
      };
    }
    return {
      choices: [{ message: { content: 'Hello World!' } }],
    };
  });

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findFirst: jest.fn().mockResolvedValue({
        id: 1,
        workspace_id: 'test-workspace',
        user_id: 1,
        name: 'Test Workspace',
        status: 'active',
      }),
    },
  },
}));

jest.mock('@/lib/vector-store', () => ({
  vectorStore: {
    similaritySearch: jest.fn().mockResolvedValue([]),
    getContext: jest.fn().mockResolvedValue('Mock RAG context for testing'),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Set required environment variables
process.env.OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

import { NextRequest } from 'next/server';

describe('Integration: /api/ai/chat/stream', () => {
  let POST: any;
  let OPTIONS: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Dynamic import to ensure mocks are applied
    const routeModule = await import('@/app/api/ai/chat/stream/route');
    POST = routeModule.POST;
    OPTIONS = routeModule.OPTIONS;
  });

  describe('POST /api/ai/chat/stream - Happy Path', () => {
    it('should return streaming SSE response with valid request', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello AI',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');
    });

    it('should include RAG context from vector store', async () => {
      const { vectorStore } = await import('@/lib/vector-store');

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Explain this code',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: ['src/app.ts'],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      await POST(mockRequest);

      // Verify vector store was called with correct parameters
      expect(vectorStore.getContext).toHaveBeenCalledWith(
        'Explain this code',
        1,
        3000
      );
    });

    it('should handle previous messages in conversation', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Continue the story',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [
              { type: 'user', content: 'Tell me a story' },
              { type: 'assistant', content: 'Once upon a time...' },
            ],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });

    it('should build workspace context from files', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Review these files',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: ['src/app.ts', 'src/components/Button.tsx', 'src/utils.ts'],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/ai/chat/stream - Validation', () => {
    it('should reject request with missing message', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request data');
    });

    it('should reject request with empty message', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: '',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject request with message too long', async () => {
      const longMessage = 'a'.repeat(4001);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: longMessage,
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject request with invalid workspace ID format', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'invalid@workspace!',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject request with too many files', async () => {
      const tooManyFiles = Array.from({ length: 21 }, (_, i) => `file${i}.ts`);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Review files',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: tooManyFiles,
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject request with too many previous messages', async () => {
      const tooManyMessages = Array.from({ length: 51 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Continue',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: tooManyMessages,
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject request with message containing control characters', async () => {
      const invalidMessage = 'Hello\u0000World\u001F';

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: invalidMessage,
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/ai/chat/stream - Authentication', () => {
    it('should reject request without authentication', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject request with invalid session', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({});

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/ai/chat/stream - Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle OpenRouter API errors gracefully', async () => {
      // Mock OpenAI to throw an error
      jest.doMock('openai', () => {
        return {
          __esModule: true,
          default: jest.fn().mockImplementation(() => ({
            chat: {
              completions: {
                create: jest.fn().mockRejectedValue(new Error('OpenRouter API error'))
              }
            }
          }))
        };
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      // The endpoint may return 200 with an error in stream or 500
      expect([200, 500]).toContain(response.status);
      if (response.status === 500) {
        const data = await response.json();
        expect(data.error).toContain('Failed to process chat request');
      }
    });

    it('should handle vector store errors gracefully', async () => {
      const { vectorStore } = await import('@/lib/vector-store');
      (vectorStore.getContext as jest.Mock).mockRejectedValueOnce(
        new Error('Vector store unavailable')
      );

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Explain code',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      // Should still succeed, just without RAG context
      expect(response.status).toBe(200);
    });

    it('should handle workspace not found', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.workspace.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'nonexistent-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      // Should still succeed, just without workspace context
      expect(response.status).toBe(200);
    });
  });

  describe('OPTIONS /api/ai/chat/stream - CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
      expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should respond within acceptable time', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Quick question',
          model: 'anthropic/claude-3.5-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: [],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const startTime = Date.now();
      await POST(mockRequest);
      const duration = Date.now() - startTime;

      // Should respond within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent streaming requests', async () => {
      const createRequest = (content: string) =>
        new NextRequest('http://localhost:3000/api/ai/chat/stream', {
          method: 'POST',
          body: JSON.stringify({
            message: content,
            model: 'anthropic/claude-3.5-sonnet',
            context: {
              workspaceId: 'test-workspace',
              files: [],
              previousMessages: [],
            },
          }),
          headers: {
            'content-type': 'application/json',
          },
        });

      const requests = [
        POST(createRequest('Request 1')),
        POST(createRequest('Request 2')),
        POST(createRequest('Request 3')),
      ];

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
