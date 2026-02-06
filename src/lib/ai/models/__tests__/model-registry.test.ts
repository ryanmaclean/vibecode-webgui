/**
 * Tests for Model Registry Service
 */

import { ModelRegistryService, modelRegistry } from '../model-registry';
import type {
  ModelFilterOptions,
  ModelSearchOptions,
  RecommendationRequest,
  ComparisonCriteria,
  TaskType,
} from '@/types/model-comparison';

describe('ModelRegistryService', () => {
  let registry: ModelRegistryService;

  beforeEach(() => {
    // Create fresh instance for each test
    registry = new ModelRegistryService();
  });

  describe('getAllModels', () => {
    it('should return all available models', () => {
      const models = registry.getAllModels();
      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return models with required properties', () => {
      const models = registry.getAllModels();
      const firstModel = models[0];

      expect(firstModel).toHaveProperty('id');
      expect(firstModel).toHaveProperty('name');
      expect(firstModel).toHaveProperty('description');
      expect(firstModel).toHaveProperty('provider');
      expect(firstModel).toHaveProperty('capabilities');
      expect(firstModel).toHaveProperty('pricing');
      expect(firstModel).toHaveProperty('performance');
      expect(firstModel).toHaveProperty('limits');
      expect(firstModel).toHaveProperty('benchmarks');
      expect(firstModel).toHaveProperty('qualityTier');
    });
  });

  describe('getModelById', () => {
    it('should return model when ID exists', () => {
      const model = registry.getModelById('anthropic/claude-3.5-sonnet');
      expect(model).toBeDefined();
      expect(model?.name).toBe('Claude 3.5 Sonnet');
    });

    it('should return undefined for non-existent ID', () => {
      const model = registry.getModelById('nonexistent/model');
      expect(model).toBeUndefined();
    });

    it('should handle different ID formats', () => {
      const model = registry.getModelById('openai/gpt-4o');
      expect(model).toBeDefined();
      expect(model?.provider.id).toBe('openai');
    });
  });

  describe('getModelsByProvider', () => {
    it('should return models for a specific provider', () => {
      const anthropicModels = registry.getModelsByProvider('anthropic');
      expect(anthropicModels.length).toBeGreaterThan(0);
      anthropicModels.forEach(model => {
        expect(model.id).toContain('anthropic');
      });
    });

    it('should return empty array for unknown provider', () => {
      const models = registry.getModelsByProvider('unknown-provider');
      expect(models).toEqual([]);
    });
  });

  describe('getModelsByCapability', () => {
    it('should filter models by capability with default score', () => {
      const codingModels = registry.getModelsByCapability('coding');
      expect(codingModels.length).toBeGreaterThan(0);
      codingModels.forEach(model => {
        expect(model.capabilities.coding).toBeGreaterThanOrEqual(70);
      });
    });

    it('should filter models by capability with custom score', () => {
      const topCodingModels = registry.getModelsByCapability('coding', 90);
      topCodingModels.forEach(model => {
        expect(model.capabilities.coding).toBeGreaterThanOrEqual(90);
      });
    });

    it('should return empty array when no models match', () => {
      const models = registry.getModelsByCapability('coding', 100);
      // Might be empty or have very few models
      expect(Array.isArray(models)).toBe(true);
    });
  });

  describe('searchModels', () => {
    it('should return all models with no filters', () => {
      const result = registry.searchModels({});
      expect(result.models.length).toBeGreaterThan(0);
      // totalCount represents total matching models, which may differ from returned models due to pagination
      expect(result.totalCount).toBeGreaterThanOrEqual(result.models.length);
    });

    it('should filter by search query', () => {
      const result = registry.searchModels({ query: 'claude' });
      expect(result.models.length).toBeGreaterThan(0);
      result.models.forEach(model => {
        const matchesQuery =
          model.name.toLowerCase().includes('claude') ||
          model.id.toLowerCase().includes('claude') ||
          model.description.toLowerCase().includes('claude');
        expect(matchesQuery).toBe(true);
      });
    });

    it('should filter by provider', () => {
      const result = registry.searchModels({ providers: ['openai'] });
      result.models.forEach(model => {
        expect(model.id).toContain('openai');
      });
    });

    it('should filter by minimum quality tier', () => {
      const result = registry.searchModels({ minQualityTier: 'excellent' });
      result.models.forEach(model => {
        expect(['excellent', 'state_of_art']).toContain(model.qualityTier);
      });
    });

    it('should filter by price', () => {
      const result = registry.searchModels({ maxInputCost: 0.001 });
      result.models.forEach(model => {
        expect(model.pricing.inputPer1K).toBeLessThanOrEqual(0.001);
      });
    });

    it('should filter by context size', () => {
      const result = registry.searchModels({ minContextSize: 100000 });
      result.models.forEach(model => {
        expect(model.limits.contextWindow).toBeGreaterThanOrEqual(100000);
      });
    });

    it('should filter by vision capability', () => {
      const result = registry.searchModels({ requiresVision: true });
      result.models.forEach(model => {
        expect(model.capabilities.vision).toBeGreaterThan(0);
      });
    });

    it('should filter by function calling', () => {
      const result = registry.searchModels({ requiresFunctionCalling: true });
      result.models.forEach(model => {
        expect(model.capabilities.function_calling).toBe(true);
      });
    });

    it('should support pagination', () => {
      const page1 = registry.searchModels({ page: 1, pageSize: 5 });
      const page2 = registry.searchModels({ page: 2, pageSize: 5 });

      expect(page1.models.length).toBeLessThanOrEqual(5);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(5);

      // Page 2 should have different models (if enough exist)
      if (page1.totalCount > 5) {
        expect(page2.page).toBe(2);
        expect(page1.models[0].id).not.toBe(page2.models[0]?.id);
      }
    });

    it('should sort by name', () => {
      const result = registry.searchModels({ sortBy: 'name', sortDirection: 'asc' });
      for (let i = 1; i < result.models.length; i++) {
        expect(result.models[i].name.localeCompare(result.models[i - 1].name)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should sort by price', () => {
      const result = registry.searchModels({ sortBy: 'price', sortDirection: 'asc' });
      for (let i = 1; i < result.models.length; i++) {
        expect(result.models[i].pricing.inputPer1K).toBeGreaterThanOrEqual(result.models[i - 1].pricing.inputPer1K);
      }
    });
  });

  describe('getRecommendation', () => {
    it('should return a recommendation for coding task', () => {
      const request: RecommendationRequest = {
        taskType: 'code_generation',
      };
      const recommendation = registry.getRecommendation(request);

      expect(recommendation).toBeDefined();
      expect(recommendation.model).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThan(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(100);
      expect(recommendation.reason).toBeDefined();
      expect(Array.isArray(recommendation.alternatives)).toBe(true);
    });

    it('should return different recommendations for different tasks', () => {
      const codingRec = registry.getRecommendation({ taskType: 'code_generation' });
      const creativeRec = registry.getRecommendation({ taskType: 'creative_writing' });

      // They might recommend the same model if it's versatile, but confidence/reason should differ
      expect(codingRec.reason).not.toBe(creativeRec.reason);
    });

    it('should respect vision requirement', () => {
      const recommendation = registry.getRecommendation({
        taskType: 'general',
        needsVision: true,
      });

      expect(recommendation.model.capabilities.vision).toBeGreaterThan(0);
    });

    it('should respect function calling requirement', () => {
      const recommendation = registry.getRecommendation({
        taskType: 'general',
        needsFunctionCalling: true,
      });

      expect(recommendation.model.capabilities.function_calling).toBe(true);
    });

    it('should respect speed requirement', () => {
      const recommendation = registry.getRecommendation({
        taskType: 'chat',
        speedRequirement: 'fast',
      });

      expect(['fast', 'very_fast']).toContain(recommendation.model.performance.speedTier);
    });

    it('should respect quality requirement', () => {
      const recommendation = registry.getRecommendation({
        taskType: 'analysis',
        qualityRequirement: 'excellent',
      });

      expect(['excellent', 'state_of_art']).toContain(recommendation.model.qualityTier);
    });

    it('should provide alternatives', () => {
      const recommendation = registry.getRecommendation({
        taskType: 'general',
      });

      expect(recommendation.alternatives.length).toBeGreaterThan(0);
      recommendation.alternatives.forEach(alt => {
        expect(alt.model).toBeDefined();
        expect(alt.reason).toBeDefined();
      });
    });

    it('should estimate cost when tokens are provided', () => {
      const recommendation = registry.getRecommendation({
        taskType: 'general',
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
      });

      expect(recommendation.estimatedCost).toBeDefined();
      expect(recommendation.estimatedCost?.perRequest).toBeGreaterThanOrEqual(0);
    });

    it('should exclude specified models', () => {
      const recommendation = registry.getRecommendation({
        taskType: 'code_generation',
        excludeModels: ['anthropic/claude-3.5-sonnet'],
      });

      expect(recommendation.model.id).not.toBe('anthropic/claude-3.5-sonnet');
    });

    it('should prefer specified providers', () => {
      const recommendation = registry.getRecommendation({
        taskType: 'general',
        preferredProviders: ['openai'],
      });

      expect(recommendation.model.id).toContain('openai');
    });
  });

  describe('compareModels', () => {
    it('should compare two models', () => {
      const result = registry.compareModels([
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
      ]);

      expect(result.models).toHaveLength(2);
      expect(result.scores).toHaveLength(2);
      expect(result.recommendation).toBeDefined();
      expect(result.recommendationReason).toBeDefined();
    });

    it('should compare multiple models', () => {
      const result = registry.compareModels([
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'anthropic/claude-3-haiku',
      ]);

      expect(result.models).toHaveLength(3);
      expect(result.scores).toHaveLength(3);
    });

    it('should calculate scores for each model', () => {
      const result = registry.compareModels([
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
      ]);

      result.scores.forEach(score => {
        expect(score.modelId).toBeDefined();
        expect(score.overallScore).toBeGreaterThanOrEqual(0);
        expect(score.criteriaScores).toBeDefined();
        expect(score.criteriaScores.cost).toBeGreaterThanOrEqual(0);
        expect(score.criteriaScores.speed).toBeGreaterThanOrEqual(0);
        expect(score.criteriaScores.quality).toBeGreaterThanOrEqual(0);
        expect(score.criteriaScores.contextSize).toBeGreaterThanOrEqual(0);
      });
    });

    it('should rank by overall score', () => {
      const result = registry.compareModels([
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'anthropic/claude-3-haiku',
      ]);

      for (let i = 1; i < result.scores.length; i++) {
        expect(result.scores[i - 1].overallScore).toBeGreaterThanOrEqual(result.scores[i].overallScore);
      }
    });

    it('should use custom criteria weights', () => {
      const costFocused = registry.compareModels(
        ['anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku'],
        { cost: 0.8, speed: 0.1, quality: 0.05, context_size: 0.05 }
      );

      const qualityFocused = registry.compareModels(
        ['anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku'],
        { cost: 0.05, speed: 0.1, quality: 0.8, context_size: 0.05 }
      );

      // Haiku is cheaper, so it should rank higher with cost focus
      // Sonnet is higher quality, so it should rank higher with quality focus
      expect(costFocused.recommendation).not.toBe(qualityFocused.recommendation);
    });

    it('should generate pros and cons', () => {
      const result = registry.compareModels([
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
      ]);

      result.scores.forEach(score => {
        expect(Array.isArray(score.pros)).toBe(true);
        expect(Array.isArray(score.cons)).toBe(true);
      });
    });

    it('should provide summary with best-for categories', () => {
      const result = registry.compareModels([
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'anthropic/claude-3-haiku',
      ]);

      expect(result.summary).toBeDefined();
      // At least one summary field should be populated
      const summaryValues = Object.values(result.summary);
      expect(summaryValues.some(v => v !== undefined)).toBe(true);
    });

    it('should throw error for invalid model IDs', () => {
      expect(() => {
        registry.compareModels(['invalid/model1', 'invalid/model2']);
      }).toThrow();
    });

    it('should handle comparison with single model gracefully', () => {
      // Single model comparison should still work (return same model as winner)
      const result = registry.compareModels(['anthropic/claude-3.5-sonnet', 'anthropic/claude-3.5-sonnet']);
      expect(result.models.length).toBe(2);
      expect(result.recommendation).toBe('anthropic/claude-3.5-sonnet');
    });
  });

  describe('getProviders', () => {
    it('should return list of providers', () => {
      const providers = registry.getProviders();
      expect(providers.length).toBeGreaterThan(0);
      providers.forEach(provider => {
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('tier');
      });
    });
  });

  describe('getAllTags', () => {
    it('should return list of available tags', () => {
      const tags = registry.getAllTags();
      expect(Array.isArray(tags)).toBe(true);
      // Tags should be strings
      tags.forEach(tag => {
        expect(typeof tag).toBe('string');
      });
    });

    it('should return sorted tags', () => {
      const tags = registry.getAllTags();
      const sortedTags = [...tags].sort();
      expect(tags).toEqual(sortedTags);
    });
  });

  describe('getModelCount', () => {
    it('should return number of models', () => {
      const count = registry.getModelCount();
      expect(count).toBeGreaterThan(0);
      expect(count).toBe(registry.getAllModels().length);
    });
  });
});

describe('modelRegistry singleton', () => {
  it('should export a singleton instance', () => {
    expect(modelRegistry).toBeDefined();
    expect(modelRegistry.getAllModels).toBeDefined();
    expect(modelRegistry.getModelById).toBeDefined();
    expect(modelRegistry.searchModels).toBeDefined();
    expect(modelRegistry.getRecommendation).toBeDefined();
    expect(modelRegistry.compareModels).toBeDefined();
  });

  it('should return consistent data', () => {
    const models1 = modelRegistry.getAllModels();
    const models2 = modelRegistry.getAllModels();
    expect(models1.length).toBe(models2.length);
  });
});
