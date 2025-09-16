// Mock all external dependencies BEFORE imports
jest.doMock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: '1', email: 'test@example.com' }
  })
}));

jest.doMock('@/lib/auth', () => ({
  authOptions: {}
}));

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: 'Hello' } }] };
            yield { choices: [{ delta: { content: ' World' } }] };
          }
        })
      }
    }
  }))
}));

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

// Set required environment variables
process.env.OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
process.env.OPENROUTER_API_KEY = 'test-key';

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/chat/stream/route';

describe('Integration: /api/ai/chat/stream', () => {
  beforeEach(() => {
    // Ensure mocks are reset
    jest.clearAllMocks();
  });

  it('should return a 200 OK and stream back SSE events', async () => {
    // Create a mock NextRequest with minimal data
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

    // Call the POST function directly
    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');

    // Test that the response is a readable stream
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    if (reader) {
      const { value } = await reader.read();
      expect(value).toBeDefined();
      reader.releaseLock();
    }
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
    expect(response.status).toBe(400);
  });
});