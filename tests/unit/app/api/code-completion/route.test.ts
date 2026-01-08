/**
 * Unit tests for Code Completion API Route
 * Tests AI-powered code completion with multiple providers
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/code-completion/route';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    responses: {
      create: jest.fn().mockResolvedValue({
        output_text: 'const result = 42;'
      })
    }
  }));
});

// Mock validation middleware
jest.mock('@/lib/api/validation/middleware', () => ({
  validateRequestBody: jest.fn(async (request: any, schema: any) => ({
    success: true,
    data: await request.json()
  }))
}));

// Mock security/keychain
jest.mock('@/lib/security/macos-keychain', () => ({
  loadSecret: jest.fn((key: string) => null)
}));

// Helper function to create a mock NextRequest
function createMockRequest(url: string, method: string, body?: any): NextRequest {
  const options: any = {
    method,
    headers: {
      'content-type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return new NextRequest(url, options);
}

describe('/api/code-completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.AI_COMPLETION_PROVIDER = 'openai';
    process.env.AI_COMPLETION_MODEL = 'gpt-4o-mini';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_COMPLETION_PROVIDER;
    delete process.env.AI_COMPLETION_MODEL;
  });

  describe('GET /api/code-completion', () => {
    it('should return API status and configuration', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.provider).toBe('openai');
      expect(data.model).toBe('gpt-4o-mini');
      expect(data.providers).toBeDefined();
      expect(Array.isArray(data.providers)).toBe(true);
    });

    it('should list available providers', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.providers).toContain('openai');
      expect(data.providers).toContain('claude');
      expect(data.providers).toContain('gemini');
      expect(data.providers).toContain('deepseek');
    });
  });

  describe('POST /api/code-completion', () => {
    const validRequest = {
      completionMetadata: {
        language: 'typescript',
        filename: 'test.ts',
        textBeforeCursor: 'function add(a: number, b: number) {\n  return ',
        textAfterCursor: '\n}'
      },
      provider: 'openai',
      model: 'gpt-4o-mini'
    };

    it('should generate code completion successfully', async () => {
      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completion).toBeDefined();
      expect(typeof data.completion).toBe('string');
    });

    it('should require completionMetadata', async () => {
      const invalidRequest = {
        provider: 'openai'
        // Missing completionMetadata
      };

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', invalidRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('should use default provider if not specified', async () => {
      const requestWithoutProvider = {
        completionMetadata: validRequest.completionMetadata
      };

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', requestWithoutProvider);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should handle validation errors', async () => {
      const { validateRequestBody } = require('@/lib/api/validation/middleware');
      validateRequestBody.mockResolvedValueOnce({
        success: false,
        error: 'Invalid schema'
      });

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should handle provider errors', async () => {
      delete process.env.OPENAI_API_KEY;

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate completion');
      expect(data.message).toContain('API key');
    });

    it('should support multiple technologies in context', async () => {
      const requestWithTech = {
        ...validRequest,
        completionMetadata: {
          ...validRequest.completionMetadata,
          technologies: ['react', 'typescript', 'next.js']
        }
      };

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', requestWithTech);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should support related files in context', async () => {
      const requestWithRelatedFiles = {
        ...validRequest,
        completionMetadata: {
          ...validRequest.completionMetadata,
          relatedFiles: [
            { path: 'utils.ts', content: 'export const PI = 3.14159;' }
          ]
        }
      };

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', requestWithRelatedFiles);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should reject unsupported providers', async () => {
      const requestWithInvalidProvider = {
        ...validRequest,
        provider: 'unsupported-provider'
      };

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', requestWithInvalidProvider);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toContain('Unsupported AI provider');
    });

    it('should handle empty completion results', async () => {
      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => ({
        responses: {
          create: jest.fn().mockResolvedValue({
            output_text: ''
          })
        }
      }));

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completion).toBeNull();
    });

    it('should truncate long context appropriately', async () => {
      const longText = 'a'.repeat(10000);
      const requestWithLongContext = {
        ...validRequest,
        completionMetadata: {
          ...validRequest.completionMetadata,
          textBeforeCursor: longText,
          textAfterCursor: longText
        }
      };

      const request = createMockRequest('http://localhost:3000/api/code-completion', 'POST', requestWithLongContext);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
