import { EnhancedAIManager, AIProviderConfig } from '@/lib/ai/enhanced-ai-manager';

describe('EnhancedAIManager', () => {
  let aiManager: EnhancedAIManager;
  let mockConfig: AIProviderConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock configuration
    mockConfig = {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4',
      maxRetries: 3,
      timeout: 30000
    };

    aiManager = new EnhancedAIManager(mockConfig);
  });

  describe('initialization', () => {
    it('should create an instance with configuration', () => {
      expect(aiManager).toBeInstanceOf(EnhancedAIManager);
    });

    it('should store the provider configuration', () => {
      expect((aiManager as any).config).toEqual(mockConfig);
    });
  });

  describe('fallback providers', () => {
    it('should add fallback providers', () => {
      const fallbackConfig: AIProviderConfig = {
        provider: 'anthropic',
        apiKey: 'fallback-key',
        model: 'claude-3-opus'
      };

      aiManager.addFallbackProvider(fallbackConfig);

      const fallbacks = (aiManager as any).fallbackProviders;
      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0]).toEqual(fallbackConfig);
    });

    it('should support multiple fallback providers', () => {
      const fallback1: AIProviderConfig = {
        provider: 'anthropic',
        apiKey: 'key1',
        model: 'claude-3-opus'
      };

      const fallback2: AIProviderConfig = {
        provider: 'cohere',
        apiKey: 'key2',
        model: 'command'
      };

      aiManager.addFallbackProvider(fallback1);
      aiManager.addFallbackProvider(fallback2);

      const fallbacks = (aiManager as any).fallbackProviders;
      expect(fallbacks).toHaveLength(2);
      expect(fallbacks[0]).toEqual(fallback1);
      expect(fallbacks[1]).toEqual(fallback2);
    });
  });

  describe('model capabilities', () => {
    it('should return default capabilities for any model', () => {
      const capabilities = aiManager.getModelCapabilities('gpt-4');

      expect(capabilities).toHaveProperty('streaming');
      expect(capabilities).toHaveProperty('functionCalling');
      expect(capabilities).toHaveProperty('vision');
      expect(capabilities).toHaveProperty('maxTokens');
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.functionCalling).toBe(true);
      expect(capabilities.maxTokens).toBeGreaterThan(0);
    });

    it('should return consistent capabilities for different models', () => {
      const caps1 = aiManager.getModelCapabilities('gpt-4');
      const caps2 = aiManager.getModelCapabilities('claude-3-opus');

      expect(caps1).toEqual(caps2);
    });
  });

  describe('completion creation', () => {
    it('should reject with not implemented error', async () => {
      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(aiManager.createCompletion(messages)).rejects.toThrow('Not implemented');
    });

    it('should reject with not implemented error when options provided', async () => {
      const messages = [
        { role: 'user', content: 'Hello' }
      ];
      const options = {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000
      };

      await expect(aiManager.createCompletion(messages, options)).rejects.toThrow('Not implemented');
    });
  });

  describe('configuration edge cases', () => {
    it('should handle minimal configuration', () => {
      const minimalConfig: AIProviderConfig = {
        provider: 'openai',
        apiKey: 'key'
      };

      const manager = new EnhancedAIManager(minimalConfig);
      expect(manager).toBeInstanceOf(EnhancedAIManager);
    });

    it('should handle configuration with all optional fields', () => {
      const fullConfig: AIProviderConfig = {
        provider: 'openai',
        apiKey: 'key',
        model: 'gpt-4-turbo',
        maxRetries: 5,
        timeout: 60000
      };

      const manager = new EnhancedAIManager(fullConfig);
      expect(manager).toBeInstanceOf(EnhancedAIManager);
      expect((manager as any).config.maxRetries).toBe(5);
      expect((manager as any).config.timeout).toBe(60000);
    });
  });
});
