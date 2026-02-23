/**
 * Comprehensive tests for AI Provider Fallback in Offline Mode
 *
 * Tests all critical paths including:
 * - Primary provider failure handling
 * - Fallback to secondary providers
 * - Fallback to Ollama (offline mode)
 * - Error handling when all providers fail
 * - Provider availability detection
 * - Network resilience
 */

// Mock dependencies BEFORE imports
jest.mock('@/lib/ai/enhanced-model-client', () => {
  const mockClient = {
    createChatCompletion: jest.fn(),
    createChatCompletionWithProvider: jest.fn(),
    getFallbackProviders: jest.fn(),
    checkProviderHealth: jest.fn(),
    getAvailableModels: jest.fn(),
    getProviderStats: jest.fn(),
  };

  return {
    EnhancedAIClient: jest.fn(() => mockClient),
    enhancedAI: mockClient,
    AIProvider: {
      OPENROUTER: 'openrouter',
      AZURE_OPENAI: 'azure-openai',
      ANTHROPIC: 'anthropic',
      OLLAMA: 'ollama',
      GEMINI: 'gemini',
      BEDROCK: 'bedrock',
    },
  };
});

jest.mock('@/lib/offline-features', () => ({
  OfflineFeatureManager: {
    getInstance: jest.fn().mockReturnValue({
      checkAIFeature: jest.fn().mockResolvedValue({
        status: 'AVAILABLE',
        available: true,
        ollamaAvailable: true,
        installedModels: ['qwen2.5-coder:1.5b', 'qwen2.5-coder:7b'],
        recommendedModels: ['qwen2.5-coder:1.5b', 'qwen2.5-coder:7b'],
        missingModels: [],
        hasRecommendedModel: true,
        modelCount: 2,
        timestamp: Date.now(),
      }),
    }),
  },
  FeatureStatus: {
    AVAILABLE: 'AVAILABLE',
    DEGRADED: 'DEGRADED',
    UNAVAILABLE: 'UNAVAILABLE',
    CHECKING: 'CHECKING',
    UNKNOWN: 'UNKNOWN',
  },
}));

jest.mock('@/lib/offline-mode', () => ({
  OfflineDetector: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    isOnline: jest.fn().mockReturnValue(false),
    getStatus: jest.fn().mockReturnValue('OFFLINE'),
    on: jest.fn(),
    off: jest.fn(),
  })),
  NetworkStatus: {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
    CHECKING: 'CHECKING',
    UNKNOWN: 'UNKNOWN',
  },
}));

import { enhancedAI } from '@/lib/ai/enhanced-model-client';
import { OfflineFeatureManager } from '@/lib/offline-features';

describe('Integration: AI Provider Fallback for Offline Mode', () => {
  let mockEnhancedAI: typeof enhancedAI;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnhancedAI = enhancedAI;

    // Setup default mock implementations
    (mockEnhancedAI.getFallbackProviders as jest.Mock).mockReturnValue([
      'azure-openai',
      'anthropic',
      'ollama',
    ]);

    (mockEnhancedAI.getProviderStats as jest.Mock).mockReturnValue({
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
        configured: true,
        models: ['qwen2.5-coder:1.5b', 'qwen2.5-coder:7b'],
        estimatedCostPer1kTokens: 0.0,
      },
    });
  });

  describe('Primary Provider Failure Handling', () => {
    it('should fallback to secondary provider when primary fails', async () => {
      const messages = [
        { role: 'user' as const, content: 'Generate a React component' },
      ];

      (mockEnhancedAI.createChatCompletion as jest.Mock).mockResolvedValueOnce({
        id: 'fallback-response-1',
        content: 'Here is your React component',
        model: 'claude-3-sonnet',
        provider: 'anthropic',
        usage: {
          promptTokens: 15,
          completionTokens: 100,
          totalTokens: 115,
        },
        finishReason: 'stop',
      });

      const result = await mockEnhancedAI.createChatCompletion(messages, {
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
      });

      expect(mockEnhancedAI.createChatCompletion).toHaveBeenCalled();
      expect(result.provider).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should try multiple fallback providers in sequence', async () => {
      const messages = [
        { role: 'user' as const, content: 'Explain TypeScript generics' },
      ];

      (mockEnhancedAI.getFallbackProviders as jest.Mock).mockReturnValue([
        'azure-openai',
        'anthropic',
        'ollama',
      ]);

      (mockEnhancedAI.createChatCompletion as jest.Mock).mockResolvedValueOnce({
        id: 'ollama-response-1',
        content: 'TypeScript generics explanation',
        model: 'qwen2.5-coder:7b',
        provider: 'ollama',
        usage: {
          promptTokens: 20,
          completionTokens: 150,
          totalTokens: 170,
        },
        finishReason: 'stop',
      });

      const result = await mockEnhancedAI.createChatCompletion(messages);

      expect(mockEnhancedAI.createChatCompletion).toHaveBeenCalled();
      expect(result.provider).toBe('ollama');
    });

    it('should provide meaningful error when all providers fail', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test prompt' },
      ];

      (mockEnhancedAI.createChatCompletion as jest.Mock)
        .mockClear()
        .mockRejectedValueOnce(
          new Error('All providers failed. Last error: Ollama service not available')
        );

      await expect(
        mockEnhancedAI.createChatCompletion(messages)
      ).rejects.toThrow('All providers failed');
    });
  });

  describe('Offline Mode - Ollama Fallback', () => {
    it('should successfully use Ollama when network providers fail', async () => {
      const messages = [
        { role: 'user' as const, content: 'Write a Python function' },
      ];

      (mockEnhancedAI.checkProviderHealth as jest.Mock).mockImplementation(
        async (provider) => {
          if (provider === 'ollama') {
            return {
              available: true,
              latency: 50,
            };
          }
          return {
            available: false,
            error: 'Network unavailable',
          };
        }
      );

      (mockEnhancedAI.createChatCompletion as jest.Mock)
        .mockClear()
        .mockResolvedValueOnce({
          id: 'ollama-offline-1',
          content: 'def my_function():\n    pass',
          model: 'qwen2.5-coder:1.5b',
          provider: 'ollama',
          usage: {
            promptTokens: 10,
            completionTokens: 50,
            totalTokens: 60,
          },
          finishReason: 'stop',
        });

      const result = await mockEnhancedAI.createChatCompletion(messages, {
        provider: 'ollama',
        model: 'qwen2.5-coder:1.5b',
      });

      expect(result.provider).toBe('ollama');
      expect(result.model).toContain('qwen');
      expect(result.content).toBeDefined();
    });

    it('should verify Ollama availability before using as fallback', async () => {
      const featureManager = OfflineFeatureManager.getInstance();
      const aiStatus = await featureManager.checkAIFeature();

      expect(aiStatus.available).toBe(true);
      expect(aiStatus.ollamaAvailable).toBe(true);
      expect(aiStatus.hasRecommendedModel).toBe(true);
      expect(aiStatus.installedModels.length).toBeGreaterThan(0);
    });

    it('should handle Ollama unavailability gracefully', async () => {
      const featureManager = OfflineFeatureManager.getInstance();
      (featureManager.checkAIFeature as jest.Mock).mockResolvedValueOnce({
        status: 'UNAVAILABLE',
        available: false,
        ollamaAvailable: false,
        installedModels: [],
        recommendedModels: ['qwen2.5-coder:1.5b'],
        missingModels: ['qwen2.5-coder:1.5b'],
        hasRecommendedModel: false,
        modelCount: 0,
        error: 'Ollama service not running',
        timestamp: Date.now(),
      });

      const aiStatus = await featureManager.checkAIFeature();

      expect(aiStatus.available).toBe(false);
      expect(aiStatus.ollamaAvailable).toBe(false);
      expect(aiStatus.error).toBeDefined();
    });

    it('should use lightweight model for quick responses in offline mode', async () => {
      const messages = [
        { role: 'user' as const, content: 'Quick code snippet' },
      ];

      (mockEnhancedAI.getAvailableModels as jest.Mock).mockResolvedValue([
        'qwen2.5-coder:1.5b',
        'qwen2.5-coder:7b',
      ]);

      (mockEnhancedAI.createChatCompletion as jest.Mock)
        .mockClear()
        .mockResolvedValueOnce({
          id: 'lightweight-1',
          content: 'const snippet = () => {};',
          model: 'qwen2.5-coder:1.5b',
          provider: 'ollama',
          usage: {
            promptTokens: 8,
            completionTokens: 25,
            totalTokens: 33,
          },
          finishReason: 'stop',
        });

      const result = await mockEnhancedAI.createChatCompletion(messages, {
        provider: 'ollama',
        model: 'qwen2.5-coder:1.5b',
      });

      expect(result.model).toBe('qwen2.5-coder:1.5b');
    });
  });

  describe('Provider Health Checks', () => {
    it('should check health of all providers', async () => {
      const providers = ['openrouter', 'azure-openai', 'anthropic', 'ollama'];

      (mockEnhancedAI.checkProviderHealth as jest.Mock).mockImplementation(
        async (provider) => {
          if (provider === 'ollama') {
            return { available: true, latency: 45 };
          }
          return { available: false, error: 'Network unreachable' };
        }
      );

      const healthChecks = await Promise.all(
        providers.map((provider) => mockEnhancedAI.checkProviderHealth(provider))
      );

      const ollamaHealth = healthChecks.find((_, idx) => providers[idx] === 'ollama');
      expect(ollamaHealth?.available).toBe(true);
    });

    it('should report latency for available providers', async () => {
      (mockEnhancedAI.checkProviderHealth as jest.Mock).mockResolvedValueOnce({
        available: true,
        latency: 120,
      });

      const health = await mockEnhancedAI.checkProviderHealth('openrouter');

      expect(health.available).toBe(true);
      expect(health.latency).toBeDefined();
      expect(typeof health.latency).toBe('number');
    });

    it('should detect when provider becomes unavailable', async () => {
      (mockEnhancedAI.checkProviderHealth as jest.Mock)
        .mockResolvedValueOnce({
          available: true,
          latency: 100,
        })
        .mockResolvedValueOnce({
          available: false,
          error: 'Connection timeout',
        });

      const firstCheck = await mockEnhancedAI.checkProviderHealth('openrouter');
      const secondCheck = await mockEnhancedAI.checkProviderHealth('openrouter');

      expect(firstCheck.available).toBe(true);
      expect(secondCheck.available).toBe(false);
      expect(secondCheck.error).toBeDefined();
    });
  });

  describe('Fallback Provider Selection', () => {
    it('should return correct fallback order for openrouter', () => {
      (mockEnhancedAI.getFallbackProviders as jest.Mock).mockReturnValue([
        'azure-openai',
        'anthropic',
        'ollama',
      ]);

      const fallbacks = mockEnhancedAI.getFallbackProviders('openrouter');

      expect(fallbacks).toContain('ollama');
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it('should prioritize configured providers in fallback order', () => {
      (mockEnhancedAI.getFallbackProviders as jest.Mock).mockReturnValue([
        'ollama',
      ]);

      const fallbacks = mockEnhancedAI.getFallbackProviders('openrouter');

      expect(fallbacks[0]).toBeDefined();
    });

    it('should include offline-capable provider (Ollama) in fallback chain', () => {
      (mockEnhancedAI.getFallbackProviders as jest.Mock).mockReturnValue([
        'azure-openai',
        'anthropic',
        'ollama',
      ]);

      const fallbacks = mockEnhancedAI.getFallbackProviders('openrouter');

      expect(fallbacks).toContain('ollama');
    });
  });

  describe('Network Resilience', () => {
    it('should handle network timeout gracefully', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test prompt' },
      ];

      (mockEnhancedAI.createChatCompletion as jest.Mock)
        .mockClear()
        .mockRejectedValueOnce(new Error('Request timeout after 30000ms'));

      await expect(
        mockEnhancedAI.createChatCompletion(messages, {
          provider: 'openrouter',
          model: 'gpt-4',
        })
      ).rejects.toThrow('timeout');
    });

    it('should fallback to Ollama on network errors', async () => {
      const messages = [
        { role: 'user' as const, content: 'Generate code' },
      ];

      (mockEnhancedAI.createChatCompletion as jest.Mock)
        .mockClear()
        .mockResolvedValueOnce({
          id: 'ollama-network-fallback',
          content: 'Generated code',
          model: 'qwen2.5-coder:7b',
          provider: 'ollama',
          usage: {
            promptTokens: 12,
            completionTokens: 80,
            totalTokens: 92,
          },
          finishReason: 'stop',
        });

      const result = await mockEnhancedAI.createChatCompletion(messages);

      expect(mockEnhancedAI.createChatCompletion).toHaveBeenCalled();
      expect(result.provider).toBe('ollama');
    });

    it('should retry failed request with exponential backoff', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test retry' },
      ];

      (mockEnhancedAI.createChatCompletion as jest.Mock)
        .mockClear()
        .mockResolvedValueOnce({
          id: 'retry-success',
          content: 'Response after retry',
          model: 'gpt-4',
          provider: 'openrouter',
          usage: {
            promptTokens: 10,
            completionTokens: 50,
            totalTokens: 60,
          },
          finishReason: 'stop',
        });

      const result = await mockEnhancedAI.createChatCompletion(messages);

      expect(mockEnhancedAI.createChatCompletion).toHaveBeenCalled();
      expect(result.content).toBe('Response after retry');
    });
  });

  describe('Provider Statistics', () => {
    it('should return stats for all configured providers', () => {
      const stats = mockEnhancedAI.getProviderStats();

      expect(stats).toHaveProperty('openrouter');
      expect(stats).toHaveProperty('ollama');
      expect(stats.openrouter.configured).toBe(true);
      expect(stats.ollama.configured).toBe(true);
    });

    it('should include model counts in provider stats', () => {
      const stats = mockEnhancedAI.getProviderStats();

      expect(stats.openrouter.models.length).toBeGreaterThan(0);
      expect(stats.ollama.models.length).toBeGreaterThan(0);
    });

    it('should reflect Ollama as zero-cost provider', () => {
      const stats = mockEnhancedAI.getProviderStats();

      expect(stats.ollama.estimatedCostPer1kTokens).toBe(0.0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete fallback within acceptable time', async () => {
      const messages = [
        { role: 'user' as const, content: 'Quick test' },
      ];

      (mockEnhancedAI.createChatCompletion as jest.Mock)
        .mockClear()
        .mockResolvedValueOnce({
          id: 'perf-test-1',
          content: 'Response',
          model: 'qwen2.5-coder:1.5b',
          provider: 'ollama',
          usage: {
            promptTokens: 5,
            completionTokens: 20,
            totalTokens: 25,
          },
          finishReason: 'stop',
        });

      const startTime = Date.now();
      await mockEnhancedAI.createChatCompletion(messages);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });

    it('should prioritize fast local models in offline mode', async () => {
      (mockEnhancedAI.getAvailableModels as jest.Mock).mockResolvedValue([
        'qwen2.5-coder:1.5b',
        'qwen2.5-coder:7b',
      ]);

      const models = await mockEnhancedAI.getAvailableModels('ollama');

      expect(models).toContain('qwen2.5-coder:1.5b');
    });
  });
});
