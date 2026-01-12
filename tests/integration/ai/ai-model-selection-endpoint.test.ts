/**
 * Comprehensive tests for /api/ai/model-selection endpoint
 *
 * Tests all critical paths including:
 * - Model selection based on prompt analysis
 * - Error handling
 * - Authentication
 * - Performance benchmarks
 */

// Mock dependencies
jest.mock('@/lib/services/intelligent-model-selection', () => ({
  intelligentModelSelection: {
    analyzePrompt: jest.fn().mockReturnValue({
      type: 'code',
      complexity: 'medium',
      length: 150,
      codeLanguages: ['typescript', 'javascript'],
      requiresReasoning: true,
      requiresCreativity: false,
      requiresAccuracy: true,
      hasImages: false,
      hasFiles: false,
      keywords: ['react', 'typescript', 'component', 'testing', 'jest'],
    }),
    selectBestModel: jest.fn().mockReturnValue({
      selectedModel: 'anthropic/claude-3.5-sonnet',
      confidence: 0.95,
      reasoning: 'Model selected based on task complexity and requirements',
      alternatives: ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku'],
      fallbackModel: 'openai/gpt-4o-mini',
    }),
    getModelById: jest.fn().mockImplementation((modelId) => {
      const models: Record<string, any> = {
        'anthropic/claude-3.5-sonnet': {
          id: 'anthropic/claude-3.5-sonnet',
          name: 'Claude 3.5 Sonnet',
          provider: 'openrouter',
          strengths: ['reasoning', 'coding', 'analysis'],
          contextLength: 200000,
          qualityTier: 'excellent',
          speedTier: 'fast',
          costTier: 'medium',
          supportsImages: true,
          supportsCode: true,
          supportsFunctionCalling: true,
          supportsStreaming: true,
        },
        'openai/gpt-4o-mini': {
          id: 'openai/gpt-4o-mini',
          name: 'GPT-4o Mini',
          provider: 'openrouter',
          strengths: ['conversational', 'coding'],
          contextLength: 128000,
          qualityTier: 'good',
          speedTier: 'fast',
          costTier: 'low',
          supportsImages: false,
          supportsCode: true,
          supportsFunctionCalling: true,
          supportsStreaming: true,
        },
      };
      return models[modelId];
    }),
    getAllModels: jest.fn().mockReturnValue([
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'openrouter',
        strengths: ['reasoning', 'coding'],
        qualityTier: 'excellent',
        speedTier: 'fast',
        costTier: 'medium',
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openrouter',
        strengths: ['conversational', 'coding'],
        qualityTier: 'good',
        speedTier: 'fast',
        costTier: 'low',
      },
    ]),
    getModelsByProvider: jest.fn().mockImplementation((provider) => {
      if (provider === 'openrouter') {
        return [
          {
            id: 'anthropic/claude-3.5-sonnet',
            name: 'Claude 3.5 Sonnet',
            provider: 'openrouter',
            strengths: ['reasoning', 'coding'],
            qualityTier: 'excellent',
            speedTier: 'fast',
            costTier: 'medium',
          },
          {
            id: 'openai/gpt-4o-mini',
            name: 'GPT-4o Mini',
            provider: 'openrouter',
            strengths: ['conversational', 'coding'],
            qualityTier: 'good',
            speedTier: 'fast',
            costTier: 'low',
          },
        ];
      }
      return [];
    }),
  },
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
            success: false,
            error: 'Validation failed',
            details: error.errors || [],
          }),
          status: 400,
        },
      };
    }
  }),
}));

import { NextRequest } from 'next/server';
import { mockModelSelectionResponse } from '../../__mocks__/ai-providers';

describe('Integration: /api/ai/model-selection', () => {
  let POST: any;
  let GET: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Dynamic import to ensure mocks are applied
    const routeModule = await import('@/app/api/ai/model-selection/route');
    POST = routeModule.POST;
    GET = routeModule.GET;
  });

  describe('POST /api/ai/model-selection - Happy Path', () => {
    it('should select best model for code generation prompt', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Create a React component with TypeScript',
          metadata: {
            taskType: 'code',
            contextLength: 150,
          },
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.selection).toBeDefined();
      expect(data.selection.selectedModel).toBe('anthropic/claude-3.5-sonnet');
      expect(data.selection.confidence).toBeGreaterThan(0);
      expect(data.selection.reasoning).toBeDefined();
      expect(data.selection.alternatives).toBeInstanceOf(Array);
      expect(data.selection.fallbackModel).toBeDefined();
    });

    it('should provide detailed model information', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Analyze this code for performance issues',
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.modelDetails).toBeDefined();
      expect(data.modelDetails.selected).toBeDefined();
      expect(data.modelDetails.selected.name).toBeDefined();
      expect(data.modelDetails.selected.provider).toBeDefined();
      expect(data.modelDetails.selected.capabilities).toBeDefined();
      expect(data.modelDetails.fallback).toBeDefined();
    });

    it('should include prompt analysis in response', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Write a sorting algorithm in Python',
          metadata: {
            taskType: 'code',
          },
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analysis).toBeDefined();
      expect(data.analysis.type).toBe('code');
      expect(data.analysis.complexity).toBeDefined();
      expect(data.analysis.promptLength).toBeDefined();
      expect(data.analysis.requiresReasoning).toBeDefined();
    });

    it('should handle preferences for speed prioritization', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Quick question about JavaScript',
          preferences: {
            prioritizeSpeed: true,
          },
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle preferences for cost prioritization', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Simple greeting message',
          preferences: {
            prioritizeCost: true,
          },
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle preferences for quality prioritization', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Complex architectural design decision',
          preferences: {
            prioritizeQuality: true,
          },
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should include metadata with response time', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.responseTime).toBeGreaterThanOrEqual(0);
      expect(data.metadata.analysisTimestamp).toBeDefined();
      expect(data.metadata.totalModelsEvaluated).toBeGreaterThan(0);
    });
  });

  describe('POST /api/ai/model-selection - Validation', () => {
    it('should reject request with missing prompt', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
    });

    it('should reject request with empty prompt', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: '',
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
    });

    it('should reject request with prompt exceeding max length', async () => {
      const longPrompt = 'a'.repeat(10001);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: longPrompt,
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
    });

    it('should reject request with invalid task type', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test',
          metadata: {
            taskType: 'invalid',
          },
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
    });

    it('should reject request with negative context length', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test',
          metadata: {
            contextLength: -100,
          },
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
    });

    it('should reject request with too many file types', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test',
          metadata: {
            fileTypes: Array.from({ length: 11 }, (_, i) => `type${i}`),
          },
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ai/model-selection - Authentication', () => {
    it('should reject request without test user ID', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });
  });

  describe('POST /api/ai/model-selection - Error Handling', () => {
    it('should handle model selection service errors', async () => {
      const { intelligentModelSelection } = await import(
        '@/lib/services/intelligent-model-selection'
      );
      (intelligentModelSelection.selectBestModel as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Model selection failed');
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt',
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/ai/model-selection - List Models', () => {
    it('should return all available models', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'GET',
        headers: {
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.models).toBeInstanceOf(Array);
      expect(data.models.length).toBeGreaterThan(0);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.totalModels).toBeGreaterThan(0);
    });

    it('should filter models by provider', async () => {
      const mockRequest = new NextRequest(
        'http://localhost:3000/api/ai/model-selection?provider=openrouter',
        {
          method: 'GET',
          headers: {
            'x-test-user-id': 'test-user-123',
          },
        }
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.models).toBeInstanceOf(Array);
      expect(data.models.every((m: any) => m.provider === 'openrouter')).toBe(true);
    });

    it('should include details when requested', async () => {
      const mockRequest = new NextRequest(
        'http://localhost:3000/api/ai/model-selection?details=true',
        {
          method: 'GET',
          headers: {
            'x-test-user-id': 'test-user-123',
          },
        }
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.models[0]).toHaveProperty('strengths');
      expect(data.models[0]).toHaveProperty('qualityTier');
      expect(data.models[0]).toHaveProperty('speedTier');
    });

    it('should include metadata about available categories', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'GET',
        headers: {
          'x-test-user-id': 'test-user-123',
        },
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata.providers).toBeInstanceOf(Array);
      expect(data.metadata.strengthCategories).toBeInstanceOf(Array);
      expect(data.metadata.costTiers).toEqual(['free', 'low', 'medium', 'high']);
      expect(data.metadata.qualityTiers).toEqual(['basic', 'good', 'excellent']);
      expect(data.metadata.speedTiers).toEqual(['slow', 'medium', 'fast']);
    });

    it('should reject GET request without authentication', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'GET',
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should respond within acceptable time for model selection', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Quick model selection',
        }),
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'test-user-123',
        },
      });

      const startTime = Date.now();
      await POST(mockRequest);
      const duration = Date.now() - startTime;

      // Should respond within 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    it('should respond within acceptable time for listing models', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/model-selection', {
        method: 'GET',
        headers: {
          'x-test-user-id': 'test-user-123',
        },
      });

      const startTime = Date.now();
      await GET(mockRequest);
      const duration = Date.now() - startTime;

      // Should respond within 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent model selection requests', async () => {
      const createRequest = (prompt: string) =>
        new NextRequest('http://localhost:3000/api/ai/model-selection', {
          method: 'POST',
          body: JSON.stringify({ prompt }),
          headers: {
            'content-type': 'application/json',
            'x-test-user-id': 'test-user-123',
          },
        });

      const requests = [
        POST(createRequest('Code generation')),
        POST(createRequest('Data analysis')),
        POST(createRequest('Creative writing')),
        POST(createRequest('Problem solving')),
      ];

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
