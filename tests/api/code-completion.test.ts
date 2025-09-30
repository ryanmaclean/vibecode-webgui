/**
 * Code Completion API Route Tests
 * 
 * Tests the enhanced error handling, validation, rate limiting,
 * and timeout functionality of the code completion API.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { POST, GET } from '@/app/api/code-completion/route';
import { NextRequest } from 'next/server';

// Mock the CompletionCopilot
const mockComplete = jest.fn();
jest.mock('monacopilot', () => ({
  CompletionCopilot: jest.fn().mockImplementation(() => ({
    complete: mockComplete
  }))
}));

// Mock rate limiting
jest.mock('@/lib/code-completion-rate-limit', () => ({
  applyCodeCompletionRateLimit: jest.fn(),
  getClientInfo: jest.fn(() => ({ ip: '127.0.0.1', userAgent: 'test-agent' }))
}));

const { applyCodeCompletionRateLimit } = require('@/lib/code-completion-rate-limit');

// Mock environment variables
const originalEnv = process.env;

describe('/api/code-completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-api-key',
      AI_COMPLETION_PROVIDER: 'openai',
      AI_COMPLETION_MODEL: 'gpt-4-turbo-preview'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetAllMocks();
  });

  describe('POST /api/code-completion', () => {
    const validRequestBody = {
      text: 'const hello = ',
      position: {
        lineNumber: 1,
        column: 15
      },
      language: 'typescript',
      filename: 'test.ts'
    };

    const createRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/code-completion', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1'
        }
      });
    };

    it('should successfully complete code with valid request', async () => {
      const mockCompletion = {
        completions: [{
          text: '"world"',
          insertText: '"world"',
          kind: 1
        }],
        model: 'gpt-4-turbo-preview'
      };

      mockComplete.mockResolvedValue(mockCompletion);
      
      const request = createRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completions).toEqual(mockCompletion.completions);
      expect(data.requestId).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(mockComplete).toHaveBeenCalledWith(validRequestBody);
    });

    it('should reject requests with invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/code-completion', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toBe('Invalid JSON in request body');
    });

    it('should validate required fields', async () => {
      const invalidBody = {
        // Missing required 'text' field
        position: { lineNumber: 1, column: 1 }
      };

      const request = createRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toBe('Request validation failed');
      expect(data.details.validationErrors).toContain('text: Required');
    });

    it('should validate text length limits', async () => {
      const invalidBody = {
        text: 'a'.repeat(10001), // Exceeds 10000 character limit
        position: { lineNumber: 1, column: 1 }
      };

      const request = createRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.validationErrors).toContain('text: Text too long');
    });

    it('should validate position values', async () => {
      const invalidBody = {
        text: 'const x = 1',
        position: {
          lineNumber: 0, // Must be positive
          column: -1 // Must be positive
        }
      };

      const request = createRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.validationErrors).toContain('position.lineNumber: Line number must be positive');
      expect(data.details.validationErrors).toContain('position.column: Column must be positive');
    });

    it('should enforce rate limiting', async () => {
      // Mock rate limit exceeded
      applyCodeCompletionRateLimit.mockRejectedValue({
        name: 'ApiError',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Code completion rate limit exceeded',
        statusCode: 429,
        retryAfter: 60
      });

      const request = createRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(data.retryAfter).toBe(60);
    });

    it('should handle missing API key', async () => {
      process.env.OPENAI_API_KEY = '';
      process.env.MISTRAL_API_KEY = '';

      const request = createRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.code).toBe('AI_SERVICE_ERROR');
      expect(data.error).toBe('AI service not configured');
    });

    it('should handle AI service timeout', async () => {
      // Mock a completion that takes too long
      mockComplete.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 35000)) // 35 seconds > 30 second timeout
      );

      const request = createRequest(validRequestBody);
      
      // Use a shorter timeout for testing
      jest.setTimeout(10000);
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(408);
      expect(data.code).toBe('TIMEOUT_ERROR');
      expect(data.error).toContain('timed out');
    });

    it('should handle AI service errors', async () => {
      mockComplete.mockRejectedValue(new Error('AI service unavailable'));

      const request = createRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.code).toBe('AI_SERVICE_ERROR');
    });

    it('should handle AI service rate limits', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).response = { status: 429 };
      mockComplete.mockRejectedValue(rateLimitError);

      const request = createRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(data.retryAfter).toBe(60);
    });

    it('should reject unknown properties in strict mode', async () => {
      const bodyWithExtraProps = {
        ...validRequestBody,
        unknownField: 'should be rejected'
      };

      const request = createRequest(bodyWithExtraProps);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should set default values for optional fields', async () => {
      const minimalBody = {
        text: 'const x = '
      };

      mockComplete.mockResolvedValue({ completions: [] });

      const request = createRequest(minimalBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Check that defaults were applied
      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'typescript' // Default value
        })
      );
    });

    it('should include request context in error logs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockComplete.mockRejectedValue(new Error('Test error'));

      const request = createRequest(validRequestBody);
      await POST(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API Error] /api/code-completion:'),
        expect.any(String)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('GET /api/code-completion (health check)', () => {
    it('should return health status', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.provider).toBe('openai');
      expect(data.model).toBe('gpt-4-turbo-preview');
      expect(data.timestamp).toBeDefined();
      expect(data.rateLimits).toBeDefined();
    });

    it('should handle health check errors gracefully', async () => {
      // Mock an error during health check
      const originalJSON = NextResponse.json;
      jest.spyOn(NextResponse, 'json').mockImplementationOnce(() => {
        throw new Error('Health check failed');
      });

      const response = await GET();

      // Restore the original implementation before assertions
      NextResponse.json = originalJSON;

      expect(response.status).toBe(503);
    });
  });
});