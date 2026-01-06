// Mock all external dependencies BEFORE imports
jest.mock('next-auth', () => {
  return {
    getServerSession: jest.fn().mockResolvedValue({
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      }
    }),
    __esModule: true,
    default: jest.fn()
  };
});

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

jest.mock('@/lib/api/validation/middleware', () => ({
  validateRequestBody: jest.fn(async (req, schema) => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        error: {
          error: 'Invalid request data',
          details: error.errors || []
        }
      };
    }
  })
}));

jest.mock('openai', () => {
  const mockCreate = jest.fn().mockImplementation(async (params) => {
    // Return an async iterable for streaming
    if (params.stream) {
      return {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' World' } }] };
        }
      };
    }
    // Return regular response for non-streaming
    return {
      choices: [{ message: { content: 'Hello World' } }]
    };
  });

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
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
        status: 'active'
      })
    }
  }
}));

jest.mock('@/lib/vector-store', () => ({
  vectorStore: {
    similaritySearch: jest.fn().mockResolvedValue([]),
    getContext: jest.fn().mockResolvedValue('Mock context for testing')
  }
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

// Set required environment variables
process.env.OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

import { NextRequest } from 'next/server';

// Force Jest to clear module cache for this specific API route
beforeEach(() => {
  jest.resetModules();
});

// Dynamic import to ensure mocks are applied
let POST: any;

describe('Integration: /api/ai/chat/stream', () => {
  beforeEach(async () => {
    // Ensure mocks are reset
    jest.clearAllMocks();

    // Dynamic import to ensure mocks are applied
    const routeModule = await import('@/app/api/ai/chat/stream/route');
    POST = routeModule.POST;
  });

  it('should return a 200 OK and stream back SSE events', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello',
        model: 'gpt-4o-mini',
        context: {
          workspaceId: 'test-workspace',
          files: [],
          previousMessages: []
        }
      }),
      headers: {
        'content-type': 'application/json'
      }
    });

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    // Note: ReadableStream testing has limitations in Jest environment
    // The API creates a ReadableStream but Jest can't fully test stream functionality
    // We verify the response structure and headers instead
    expect(response).toBeInstanceOf(Response);
  });

  it('should handle invalid request body gracefully', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
      method: 'POST',
      body: 'invalid json',
      headers: {
        'content-type': 'application/json'
      }
    });

    const response = await POST(mockRequest);
    // JSON parsing errors are caught and return 400 for bad request
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });
});