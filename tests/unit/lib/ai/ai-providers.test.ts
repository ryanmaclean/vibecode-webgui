/**
 * Comprehensive unit tests for AI Providers module
 * Tests provider configurations, model registry, utility functions,
 * edge cases, and all exported interfaces
 */

describe('AI Providers Module', () => {
  let aiProviders: typeof import('../../../../src/lib/ai-providers');

  beforeEach(() => {
    jest.resetModules();
    aiProviders = require('../../../../src/lib/ai-providers');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Module exports', () => {
    it('should export AI_PROVIDERS constant', () => {
      expect(aiProviders.AI_PROVIDERS).toBeDefined();
      expect(typeof aiProviders.AI_PROVIDERS).toBe('object');
    });

    it('should export MODEL_REGISTRY constant', () => {
      expect(aiProviders.MODEL_REGISTRY).toBeDefined();
      expect(typeof aiProviders.MODEL_REGISTRY).toBe('object');
    });

    it('should export DEFAULT_MODELS constant', () => {
      expect(aiProviders.DEFAULT_MODELS).toBeDefined();
      expect(typeof aiProviders.DEFAULT_MODELS).toBe('object');
    });

    it('should export getAllModels function', () => {
      expect(aiProviders.getAllModels).toBeDefined();
      expect(typeof aiProviders.getAllModels).toBe('function');
    });

    it('should export getModelsByProvider function', () => {
      expect(aiProviders.getModelsByProvider).toBeDefined();
      expect(typeof aiProviders.getModelsByProvider).toBe('function');
    });

    it('should export getModelInfo function', () => {
      expect(aiProviders.getModelInfo).toBeDefined();
      expect(typeof aiProviders.getModelInfo).toBe('function');
    });

    it('should export getProviderForModel function', () => {
      expect(aiProviders.getProviderForModel).toBeDefined();
      expect(typeof aiProviders.getProviderForModel).toBe('function');
    });

    it('should export getRecommendedModel function', () => {
      expect(aiProviders.getRecommendedModel).toBeDefined();
      expect(typeof aiProviders.getRecommendedModel).toBe('function');
    });

    it('should export estimateCost function', () => {
      expect(aiProviders.estimateCost).toBeDefined();
      expect(typeof aiProviders.estimateCost).toBe('function');
    });
  });

  describe('AI_PROVIDERS configuration', () => {
    it('should contain OpenAI provider', () => {
      expect(aiProviders.AI_PROVIDERS.openai).toBeDefined();
      expect(aiProviders.AI_PROVIDERS.openai.id).toBe('openai');
      expect(aiProviders.AI_PROVIDERS.openai.name).toBe('OpenAI');
      expect(aiProviders.AI_PROVIDERS.openai.company).toBe('OpenAI');
    });

    it('should contain Anthropic provider', () => {
      expect(aiProviders.AI_PROVIDERS.anthropic).toBeDefined();
      expect(aiProviders.AI_PROVIDERS.anthropic.id).toBe('anthropic');
      expect(aiProviders.AI_PROVIDERS.anthropic.name).toBe('Anthropic');
      expect(aiProviders.AI_PROVIDERS.anthropic.company).toBe('Anthropic');
    });

    it('should contain Google provider', () => {
      expect(aiProviders.AI_PROVIDERS.google).toBeDefined();
      expect(aiProviders.AI_PROVIDERS.google.id).toBe('google');
      expect(aiProviders.AI_PROVIDERS.google.name).toBe('Google AI');
      expect(aiProviders.AI_PROVIDERS.google.company).toBe('Google');
    });

    it('should have all providers with active status', () => {
      const providers = Object.values(aiProviders.AI_PROVIDERS);
      providers.forEach(provider => {
        expect(provider.status).toBe('active');
      });
    });

    it('should have all providers with valid capabilities', () => {
      const providers = Object.values(aiProviders.AI_PROVIDERS);
      providers.forEach(provider => {
        expect(provider.capabilities).toBeDefined();
        expect(typeof provider.capabilities.streaming).toBe('boolean');
        expect(typeof provider.capabilities.functionCalling).toBe('boolean');
        expect(typeof provider.capabilities.vision).toBe('boolean');
        expect(typeof provider.capabilities.codeGeneration).toBe('boolean');
        expect(typeof provider.capabilities.reasoning).toBe('boolean');
      });
    });

    it('should have all providers with valid pricing tier', () => {
      const validTiers = ['free', 'low', 'medium', 'high', 'premium'];
      const providers = Object.values(aiProviders.AI_PROVIDERS);
      providers.forEach(provider => {
        expect(validTiers).toContain(provider.pricing);
      });
    });

    it('should have all providers with at least one model', () => {
      const providers = Object.values(aiProviders.AI_PROVIDERS);
      providers.forEach(provider => {
        expect(Array.isArray(provider.models)).toBe(true);
        expect(provider.models.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Model configurations', () => {
    it('should have all models with required properties', () => {
      const allModels = aiProviders.getAllModels();
      allModels.forEach(model => {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.description).toBeDefined();
        expect(typeof model.contextWindow).toBe('number');
        expect(typeof model.maxTokens).toBe('number');
        expect(typeof model.supportsFunctionCalling).toBe('boolean');
        expect(typeof model.supportsVision).toBe('boolean');
        expect(model.costPer1kTokens).toBeDefined();
        expect(typeof model.costPer1kTokens.input).toBe('number');
        expect(typeof model.costPer1kTokens.output).toBe('number');
      });
    });

    it('should have positive context window values', () => {
      const allModels = aiProviders.getAllModels();
      allModels.forEach(model => {
        expect(model.contextWindow).toBeGreaterThan(0);
      });
    });

    it('should have positive max token values', () => {
      const allModels = aiProviders.getAllModels();
      allModels.forEach(model => {
        expect(model.maxTokens).toBeGreaterThan(0);
      });
    });

    it('should have non-negative cost values', () => {
      const allModels = aiProviders.getAllModels();
      allModels.forEach(model => {
        expect(model.costPer1kTokens.input).toBeGreaterThanOrEqual(0);
        expect(model.costPer1kTokens.output).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have GPT-4 in OpenAI models', () => {
      const openaiModels = aiProviders.AI_PROVIDERS.openai.models;
      const gpt4 = openaiModels.find(m => m.id === 'gpt-4');
      expect(gpt4).toBeDefined();
      expect(gpt4?.name).toBe('GPT-4');
    });

    it('should have Claude models in Anthropic provider', () => {
      const anthropicModels = aiProviders.AI_PROVIDERS.anthropic.models;
      const hasClaudeModels = anthropicModels.some(m => m.id.includes('claude'));
      expect(hasClaudeModels).toBe(true);
    });

    it('should have Gemini models in Google provider', () => {
      const googleModels = aiProviders.AI_PROVIDERS.google.models;
      const hasGeminiModels = googleModels.some(m => m.id.includes('gemini'));
      expect(hasGeminiModels).toBe(true);
    });
  });

  describe('MODEL_REGISTRY', () => {
    it('should map GPT-4 to OpenRouter format', () => {
      expect(aiProviders.MODEL_REGISTRY['gpt-4']).toBe('openai/gpt-4');
    });

    it('should map Claude models to OpenRouter format', () => {
      expect(aiProviders.MODEL_REGISTRY['claude-3-opus']).toBe('anthropic/claude-3-opus');
      expect(aiProviders.MODEL_REGISTRY['claude-3-sonnet']).toBe('anthropic/claude-3-sonnet-20240229');
      expect(aiProviders.MODEL_REGISTRY['claude-3-haiku']).toBe('anthropic/claude-3-haiku-20240307');
    });

    it('should map Gemini models to OpenRouter format', () => {
      expect(aiProviders.MODEL_REGISTRY['gemini-pro']).toBe('google/gemini-pro');
      expect(aiProviders.MODEL_REGISTRY['gemini-1.5-pro']).toBe('google/gemini-1.5-pro');
    });

    it('should include additional models', () => {
      expect(aiProviders.MODEL_REGISTRY['llama-3.1-70b']).toBe('meta-llama/llama-3.1-70b-instruct');
      expect(aiProviders.MODEL_REGISTRY['mistral-large']).toBe('mistralai/mistral-large');
      expect(aiProviders.MODEL_REGISTRY['codestral']).toBe('mistralai/codestral-mamba');
    });

    it('should have all registry entries as strings', () => {
      Object.values(aiProviders.MODEL_REGISTRY).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });
  });

  describe('DEFAULT_MODELS', () => {
    it('should have default model for chat', () => {
      expect(aiProviders.DEFAULT_MODELS.chat).toBe('gpt-4-turbo');
    });

    it('should have default model for code generation', () => {
      expect(aiProviders.DEFAULT_MODELS.codeGeneration).toBe('gpt-4');
    });

    it('should have default model for quick help', () => {
      expect(aiProviders.DEFAULT_MODELS.quickHelp).toBe('gpt-3.5-turbo');
    });

    it('should have default model for analysis', () => {
      expect(aiProviders.DEFAULT_MODELS.analysis).toBe('claude-3-sonnet');
    });

    it('should have default model for reasoning', () => {
      expect(aiProviders.DEFAULT_MODELS.reasoning).toBe('claude-3-opus');
    });

    it('should have all defaults as strings', () => {
      Object.values(aiProviders.DEFAULT_MODELS).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });
  });

  describe('getAllModels', () => {
    it('should return an array of all models', () => {
      const models = aiProviders.getAllModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return models from all providers', () => {
      const models = aiProviders.getAllModels();
      const openaiModels = models.filter(m =>
        aiProviders.AI_PROVIDERS.openai.models.some(om => om.id === m.id)
      );
      const anthropicModels = models.filter(m =>
        aiProviders.AI_PROVIDERS.anthropic.models.some(am => am.id === m.id)
      );
      const googleModels = models.filter(m =>
        aiProviders.AI_PROVIDERS.google.models.some(gm => gm.id === m.id)
      );

      expect(openaiModels.length).toBeGreaterThan(0);
      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(googleModels.length).toBeGreaterThan(0);
    });

    it('should return models with unique IDs', () => {
      const models = aiProviders.getAllModels();
      const ids = models.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include GPT-4 in results', () => {
      const models = aiProviders.getAllModels();
      const hasGpt4 = models.some(m => m.id === 'gpt-4');
      expect(hasGpt4).toBe(true);
    });

    it('should include Claude models in results', () => {
      const models = aiProviders.getAllModels();
      const hasClaudeOpus = models.some(m => m.id === 'claude-3-opus');
      expect(hasClaudeOpus).toBe(true);
    });
  });

  describe('getModelsByProvider', () => {
    it('should return OpenAI models for openai provider', () => {
      const models = aiProviders.getModelsByProvider('openai');
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.id === 'gpt-4')).toBe(true);
    });

    it('should return Anthropic models for anthropic provider', () => {
      const models = aiProviders.getModelsByProvider('anthropic');
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.id === 'claude-3-opus')).toBe(true);
    });

    it('should return Google models for google provider', () => {
      const models = aiProviders.getModelsByProvider('google');
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.id === 'gemini-pro')).toBe(true);
    });

    it('should return empty array for non-existent provider', () => {
      const models = aiProviders.getModelsByProvider('nonexistent');
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(0);
    });

    it('should return empty array for empty string provider', () => {
      const models = aiProviders.getModelsByProvider('');
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(0);
    });

    it('should return different models for different providers', () => {
      const openaiModels = aiProviders.getModelsByProvider('openai');
      const anthropicModels = aiProviders.getModelsByProvider('anthropic');
      expect(openaiModels).not.toEqual(anthropicModels);
    });
  });

  describe('getModelInfo', () => {
    it('should return model info for GPT-4', () => {
      const modelInfo = aiProviders.getModelInfo('gpt-4');
      expect(modelInfo).toBeDefined();
      expect(modelInfo?.id).toBe('gpt-4');
      expect(modelInfo?.name).toBe('GPT-4');
    });

    it('should return model info for Claude 3 Opus', () => {
      const modelInfo = aiProviders.getModelInfo('claude-3-opus');
      expect(modelInfo).toBeDefined();
      expect(modelInfo?.id).toBe('claude-3-opus');
      expect(modelInfo?.name).toBe('Claude 3 Opus');
    });

    it('should return model info for Gemini Pro', () => {
      const modelInfo = aiProviders.getModelInfo('gemini-pro');
      expect(modelInfo).toBeDefined();
      expect(modelInfo?.id).toBe('gemini-pro');
      expect(modelInfo?.name).toBe('Gemini Pro');
    });

    it('should return undefined for non-existent model', () => {
      const modelInfo = aiProviders.getModelInfo('nonexistent-model');
      expect(modelInfo).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const modelInfo = aiProviders.getModelInfo('');
      expect(modelInfo).toBeUndefined();
    });

    it('should return model with all required properties', () => {
      const modelInfo = aiProviders.getModelInfo('gpt-4');
      expect(modelInfo?.id).toBeDefined();
      expect(modelInfo?.name).toBeDefined();
      expect(modelInfo?.description).toBeDefined();
      expect(modelInfo?.contextWindow).toBeDefined();
      expect(modelInfo?.maxTokens).toBeDefined();
      expect(modelInfo?.supportsFunctionCalling).toBeDefined();
      expect(modelInfo?.supportsVision).toBeDefined();
      expect(modelInfo?.costPer1kTokens).toBeDefined();
    });

    it('should be case-sensitive for model IDs', () => {
      const modelInfo = aiProviders.getModelInfo('GPT-4');
      expect(modelInfo).toBeUndefined();
    });
  });

  describe('getProviderForModel', () => {
    it('should return OpenAI provider for GPT-4', () => {
      const provider = aiProviders.getProviderForModel('gpt-4');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('openai');
      expect(provider?.name).toBe('OpenAI');
    });

    it('should return Anthropic provider for Claude models', () => {
      const provider = aiProviders.getProviderForModel('claude-3-opus');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('anthropic');
      expect(provider?.name).toBe('Anthropic');
    });

    it('should return Google provider for Gemini models', () => {
      const provider = aiProviders.getProviderForModel('gemini-pro');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('google');
      expect(provider?.name).toBe('Google AI');
    });

    it('should return undefined for non-existent model', () => {
      const provider = aiProviders.getProviderForModel('nonexistent-model');
      expect(provider).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const provider = aiProviders.getProviderForModel('');
      expect(provider).toBeUndefined();
    });

    it('should return provider with all capabilities', () => {
      const provider = aiProviders.getProviderForModel('gpt-4');
      expect(provider?.capabilities).toBeDefined();
      expect(provider?.capabilities.streaming).toBeDefined();
      expect(provider?.capabilities.functionCalling).toBeDefined();
      expect(provider?.capabilities.vision).toBeDefined();
      expect(provider?.capabilities.codeGeneration).toBeDefined();
      expect(provider?.capabilities.reasoning).toBeDefined();
    });

    it('should be case-sensitive for model IDs', () => {
      const provider = aiProviders.getProviderForModel('GPT-4');
      expect(provider).toBeUndefined();
    });
  });

  describe('getRecommendedModel', () => {
    it('should return gpt-4-turbo for coding task', () => {
      const model = aiProviders.getRecommendedModel('coding');
      expect(model).toBe('gpt-4-turbo');
    });

    it('should return claude-3-opus for reasoning task', () => {
      const model = aiProviders.getRecommendedModel('reasoning');
      expect(model).toBe('claude-3-opus');
    });

    it('should return claude-3-haiku for speed task', () => {
      const model = aiProviders.getRecommendedModel('speed');
      expect(model).toBe('claude-3-haiku');
    });

    it('should return gpt-3.5-turbo for cost task', () => {
      const model = aiProviders.getRecommendedModel('cost');
      expect(model).toBe('gpt-3.5-turbo');
    });

    it('should return gpt-4-turbo for unknown task type', () => {
      // @ts-expect-error - testing invalid input
      const model = aiProviders.getRecommendedModel('unknown');
      expect(model).toBe('gpt-4-turbo');
    });

    it('should always return a string', () => {
      const tasks: Array<'coding' | 'reasoning' | 'speed' | 'cost'> = ['coding', 'reasoning', 'speed', 'cost'];
      tasks.forEach(task => {
        const model = aiProviders.getRecommendedModel(task);
        expect(typeof model).toBe('string');
        expect(model.length).toBeGreaterThan(0);
      });
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost for GPT-4 correctly', () => {
      const cost = aiProviders.estimateCost('gpt-4', 1000, 1000);
      // GPT-4: input $0.03/1k, output $0.06/1k
      // (1000/1000 * 0.03) + (1000/1000 * 0.06) = 0.03 + 0.06 = 0.09
      expect(cost).toBeCloseTo(0.09, 5);
    });

    it('should calculate cost for GPT-3.5-turbo correctly', () => {
      const cost = aiProviders.estimateCost('gpt-3.5-turbo', 1000, 1000);
      // GPT-3.5: input $0.0015/1k, output $0.002/1k
      // (1000/1000 * 0.0015) + (1000/1000 * 0.002) = 0.0015 + 0.002 = 0.0035
      expect(cost).toBeCloseTo(0.0035, 5);
    });

    it('should calculate cost with different token counts', () => {
      const cost = aiProviders.estimateCost('gpt-4', 2000, 500);
      // (2000/1000 * 0.03) + (500/1000 * 0.06) = 0.06 + 0.03 = 0.09
      expect(cost).toBeCloseTo(0.09, 5);
    });

    it('should return 0 for non-existent model', () => {
      const cost = aiProviders.estimateCost('nonexistent-model', 1000, 1000);
      expect(cost).toBe(0);
    });

    it('should return 0 for zero tokens', () => {
      const cost = aiProviders.estimateCost('gpt-4', 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle only input tokens', () => {
      const cost = aiProviders.estimateCost('gpt-4', 1000, 0);
      expect(cost).toBeCloseTo(0.03, 5);
    });

    it('should handle only output tokens', () => {
      const cost = aiProviders.estimateCost('gpt-4', 0, 1000);
      expect(cost).toBeCloseTo(0.06, 5);
    });

    it('should handle large token counts', () => {
      const cost = aiProviders.estimateCost('gpt-4', 100000, 100000);
      // (100000/1000 * 0.03) + (100000/1000 * 0.06) = 3 + 6 = 9
      expect(cost).toBeCloseTo(9, 5);
    });

    it('should handle fractional token counts', () => {
      const cost = aiProviders.estimateCost('gpt-4', 500, 500);
      // (500/1000 * 0.03) + (500/1000 * 0.06) = 0.015 + 0.03 = 0.045
      expect(cost).toBeCloseTo(0.045, 5);
    });

    it('should return non-negative values', () => {
      const allModels = aiProviders.getAllModels();
      allModels.forEach(model => {
        const cost = aiProviders.estimateCost(model.id, 1000, 1000);
        expect(cost).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Provider capabilities validation', () => {
    it('should have all OpenAI capabilities enabled', () => {
      const provider = aiProviders.AI_PROVIDERS.openai;
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.functionCalling).toBe(true);
      expect(provider.capabilities.codeGeneration).toBe(true);
      expect(provider.capabilities.reasoning).toBe(true);
    });

    it('should have all Anthropic capabilities enabled', () => {
      const provider = aiProviders.AI_PROVIDERS.anthropic;
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.functionCalling).toBe(true);
      expect(provider.capabilities.vision).toBe(true);
      expect(provider.capabilities.codeGeneration).toBe(true);
      expect(provider.capabilities.reasoning).toBe(true);
    });

    it('should have all Google capabilities enabled', () => {
      const provider = aiProviders.AI_PROVIDERS.google;
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.functionCalling).toBe(true);
      expect(provider.capabilities.vision).toBe(true);
      expect(provider.capabilities.codeGeneration).toBe(true);
      expect(provider.capabilities.reasoning).toBe(true);
    });
  });

  describe('Model feature support', () => {
    it('should have GPT-4 Turbo with vision support', () => {
      const model = aiProviders.getModelInfo('gpt-4-turbo');
      expect(model?.supportsVision).toBe(true);
    });

    it('should have GPT-4 without vision support', () => {
      const model = aiProviders.getModelInfo('gpt-4');
      expect(model?.supportsVision).toBe(false);
    });

    it('should have all Claude 3 models with vision support', () => {
      const opus = aiProviders.getModelInfo('claude-3-opus');
      const sonnet = aiProviders.getModelInfo('claude-3-sonnet');
      const haiku = aiProviders.getModelInfo('claude-3-haiku');
      expect(opus?.supportsVision).toBe(true);
      expect(sonnet?.supportsVision).toBe(true);
      expect(haiku?.supportsVision).toBe(true);
    });

    it('should have all models with function calling support or explicit non-support', () => {
      const allModels = aiProviders.getAllModels();
      allModels.forEach(model => {
        expect(typeof model.supportsFunctionCalling).toBe('boolean');
      });
    });
  });

  describe('Pricing validation', () => {
    it('should have reasonable pricing for all models', () => {
      const allModels = aiProviders.getAllModels();
      allModels.forEach(model => {
        expect(model.costPer1kTokens.input).toBeLessThan(1);
        expect(model.costPer1kTokens.output).toBeLessThan(1);
      });
    });

    it('should have output cost higher or equal to input cost for most models', () => {
      const allModels = aiProviders.getAllModels();
      allModels.forEach(model => {
        // Output is typically more expensive than input
        expect(model.costPer1kTokens.output).toBeGreaterThanOrEqual(model.costPer1kTokens.input);
      });
    });
  });

  describe('Context window validation', () => {
    it('should have Claude models with large context windows', () => {
      const claudeModels = aiProviders.getModelsByProvider('anthropic');
      claudeModels.forEach(model => {
        expect(model.contextWindow).toBeGreaterThanOrEqual(200000);
      });
    });

    it('should have Gemini 1.5 Pro with very large context window', () => {
      const model = aiProviders.getModelInfo('gemini-1.5-pro');
      expect(model?.contextWindow).toBeGreaterThanOrEqual(1000000);
    });

    it('should have GPT models with reasonable context windows', () => {
      const gpt4 = aiProviders.getModelInfo('gpt-4');
      const gpt4turbo = aiProviders.getModelInfo('gpt-4-turbo');
      const gpt35 = aiProviders.getModelInfo('gpt-3.5-turbo');

      expect(gpt4?.contextWindow).toBeGreaterThanOrEqual(8192);
      expect(gpt4turbo?.contextWindow).toBeGreaterThanOrEqual(128000);
      expect(gpt35?.contextWindow).toBeGreaterThanOrEqual(16384);
    });
  });
});
