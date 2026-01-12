/**
 * Comprehensive tests for /api/ai/provider-health endpoint
 *
 * Tests all critical paths including:
 * - Provider health checks
 * - Error handling
 * - Authentication
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
          json: async () => ({
            error: 'Invalid request data',
            details: error.errors || [],
          }),
          status: 400,
        },
      };
    }
  }),
}));

jest.mock('@/lib/ai/enhanced-model-client', () => ({
  enhancedAI: {
    checkProviderHealth: jest.fn().mockImplementation(async (provider) => ({
      available: true,
      latency: 150,
      error: undefined,
    })),
    getProviderStats: jest.fn().mockReturnValue({
      openrouter: {
        configured: true,
        models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini'],
        estimatedCostPer1kTokens: 0.015,
      },
      'azure-openai': {
        configured: false,
        models: [],
        estimatedCostPer1kTokens: 0.0,
      },
      anthropic: {
        configured: false,
        models: [],
        estimatedCostPer1kTokens: 0.0,
      },
      ollama: {
        configured: false,
        models: [],
        estimatedCostPer1kTokens: 0.0,
      },
      gemini: {
        configured: false,
        models: [],
        estimatedCostPer1kTokens: 0.0,
      },
      bedrock: {
        configured: false,
        models: [],
        estimatedCostPer1kTokens: 0.0,
      },
    }),
  },
  AIProvider: {
    OPENROUTER: 'openrouter',
    AZURE_OPENAI: 'azure-openai',
    ANTHROPIC: 'anthropic',
    OLLAMA: 'ollama',
    GEMINI: 'gemini',
    BEDROCK: 'bedrock',
  },
}));

import { NextRequest } from 'next/server';
import { mockProviderHealthResponse } from '../../__mocks__/ai-providers';

describe('Integration: /api/ai/provider-health', () => {
  let POST: any;
  let GET: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Dynamic import to ensure mocks are applied
    const routeModule = await import('@/app/api/ai/provider-health/route');
    POST = routeModule.POST;
    GET = routeModule.GET;
  });

  describe('POST /api/ai/provider-health - Happy Path', () => {
    it('should check health of OpenRouter provider', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openrouter',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.provider).toBe('openrouter');
      expect(data.available).toBeDefined();
      expect(data.latency).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    it('should check health of Azure OpenAI provider', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'azure-openai',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.provider).toBe('azure-openai');
    });

    it('should check health of Anthropic provider', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'anthropic',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.provider).toBe('anthropic');
    });

    it('should return unavailable for unconfigured provider', async () => {
      const { enhancedAI } = await import('@/lib/ai/enhanced-model-client');
      (enhancedAI.checkProviderHealth as jest.Mock).mockResolvedValueOnce({
        available: false,
        error: 'Provider not configured',
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'ollama',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/ai/provider-health - Validation', () => {
    it('should reject request with invalid provider name', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'invalid-provider',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
    });

    it('should reject request with missing provider field', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ai/provider-health - Authentication', () => {
    it('should reject request without authentication', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openrouter',
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

  describe('POST /api/ai/provider-health - Error Handling', () => {
    it('should handle provider health check errors gracefully', async () => {
      const { enhancedAI } = await import('@/lib/ai/enhanced-model-client');
      (enhancedAI.checkProviderHealth as jest.Mock).mockRejectedValueOnce(
        new Error('Health check failed')
      );

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openrouter',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to check provider health');
    });

    it('should handle network timeout errors', async () => {
      const { enhancedAI } = await import('@/lib/ai/enhanced-model-client');
      (enhancedAI.checkProviderHealth as jest.Mock).mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openrouter',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/ai/provider-health - All Providers', () => {
    it('should return health status for all providers', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'GET',
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.providers).toBeInstanceOf(Array);
      expect(data.providers.length).toBeGreaterThan(0);
      expect(data.timestamp).toBeDefined();
    });

    it('should include provider configuration details', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'GET',
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      const openrouterProvider = data.providers.find((p: any) => p.provider === 'openrouter');

      expect(openrouterProvider).toBeDefined();
      expect(openrouterProvider.configured).toBe(true);
      expect(openrouterProvider.models).toBeInstanceOf(Array);
      expect(openrouterProvider.estimatedCostPer1kTokens).toBeDefined();
    });

    it('should handle partial provider failures gracefully', async () => {
      const { enhancedAI } = await import('@/lib/ai/enhanced-model-client');
      (enhancedAI.checkProviderHealth as jest.Mock)
        .mockResolvedValueOnce({ available: true, latency: 150 })
        .mockRejectedValueOnce(new Error('Provider unavailable'))
        .mockResolvedValueOnce({ available: false, error: 'Not configured' });

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'GET',
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.providers).toBeInstanceOf(Array);
    });

    it('should reject GET request without authentication', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'GET',
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should check provider health within acceptable time', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openrouter',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const startTime = Date.now();
      await POST(mockRequest);
      const duration = Date.now() - startTime;

      // Should respond within 3 seconds
      expect(duration).toBeLessThan(3000);
    });

    it('should check all providers within acceptable time', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/provider-health', {
        method: 'GET',
      });

      const startTime = Date.now();
      await GET(mockRequest);
      const duration = Date.now() - startTime;

      // Should respond within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent health checks efficiently', async () => {
      const createRequest = (provider: string) =>
        new NextRequest('http://localhost:3000/api/ai/provider-health', {
          method: 'POST',
          body: JSON.stringify({ provider }),
          headers: {
            'content-type': 'application/json',
          },
        });

      const requests = [
        POST(createRequest('openrouter')),
        POST(createRequest('anthropic')),
        POST(createRequest('ollama')),
      ];

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
