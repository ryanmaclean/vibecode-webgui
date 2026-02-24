/**
 * Tests for Suggestion Configuration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  DEFAULT_SUGGESTION_CONFIG,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_RELEVANCE_THRESHOLDS,
  DEFAULT_CONTEXT_LIMITS,
  DEFAULT_OPTIMIZATION_CONFIG,
  DEFAULT_CACHING_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
  SUGGESTION_CONFIG_PRESETS,
  getModelConfig,
  mergeConfig,
  validateConfig,
  createConfigFromEnv,
  getConfigManager,
  createConfigManager,
  SuggestionConfig,
} from '../suggestion-config';
import { OptimizationStrategy } from '../../context-optimizer';
import { ModelFamily } from '../../../../types/context';

describe('SuggestionConfig', () => {
  describe('Default Configuration', () => {
    it('should have all required default values', () => {
      expect(DEFAULT_SUGGESTION_CONFIG).toBeDefined();
      expect(DEFAULT_SUGGESTION_CONFIG.features).toEqual(DEFAULT_FEATURE_FLAGS);
      expect(DEFAULT_SUGGESTION_CONFIG.tokenBudget).toEqual(DEFAULT_TOKEN_BUDGET);
      expect(DEFAULT_SUGGESTION_CONFIG.relevance).toEqual(DEFAULT_RELEVANCE_THRESHOLDS);
      expect(DEFAULT_SUGGESTION_CONFIG.limits).toEqual(DEFAULT_CONTEXT_LIMITS);
      expect(DEFAULT_SUGGESTION_CONFIG.optimization).toEqual(DEFAULT_OPTIMIZATION_CONFIG);
      expect(DEFAULT_SUGGESTION_CONFIG.caching).toEqual(DEFAULT_CACHING_CONFIG);
      expect(DEFAULT_SUGGESTION_CONFIG.performance).toEqual(DEFAULT_PERFORMANCE_CONFIG);
    });

    it('should have sensible default feature flags', () => {
      expect(DEFAULT_FEATURE_FLAGS.enableCodeAnalysis).toBe(true);
      expect(DEFAULT_FEATURE_FLAGS.enableRelatedCode).toBe(true);
      expect(DEFAULT_FEATURE_FLAGS.enableConventions).toBe(true);
      expect(DEFAULT_FEATURE_FLAGS.enableOptimization).toBe(true);
      expect(DEFAULT_FEATURE_FLAGS.enableCaching).toBe(true);
      expect(DEFAULT_FEATURE_FLAGS.enableStats).toBe(true);
    });

    it('should have sensible default token budget', () => {
      expect(DEFAULT_TOKEN_BUDGET.defaultBudget).toBe(4000);
      expect(DEFAULT_TOKEN_BUDGET.maxBudget).toBe(16000);
      expect(DEFAULT_TOKEN_BUDGET.minBudget).toBe(500);
      expect(DEFAULT_TOKEN_BUDGET.systemReserved).toBe(500);
      expect(DEFAULT_TOKEN_BUDGET.responseReserved).toBe(1000);
      expect(DEFAULT_TOKEN_BUDGET.tokenOverhead).toBe(10);
    });

    it('should have model-specific budgets', () => {
      expect(DEFAULT_TOKEN_BUDGET.modelBudgets[ModelFamily.GPT4]).toBe(8000);
      expect(DEFAULT_TOKEN_BUDGET.modelBudgets[ModelFamily.GPT4_TURBO]).toBe(16000);
      expect(DEFAULT_TOKEN_BUDGET.modelBudgets[ModelFamily.CLAUDE_3]).toBe(16000);
      expect(DEFAULT_TOKEN_BUDGET.modelBudgets[ModelFamily.GPT35_TURBO]).toBe(4000);
    });

    it('should have sensible default relevance thresholds', () => {
      expect(DEFAULT_RELEVANCE_THRESHOLDS.minRelevanceScore).toBe(0.1);
      expect(DEFAULT_RELEVANCE_THRESHOLDS.relatedCodeThreshold).toBe(0.2);
      expect(DEFAULT_RELEVANCE_THRESHOLDS.conventionsThreshold).toBe(0.15);
      expect(DEFAULT_RELEVANCE_THRESHOLDS.highRelevanceThreshold).toBe(0.7);
      expect(DEFAULT_RELEVANCE_THRESHOLDS.criticalRelevanceThreshold).toBe(0.9);
    });

    it('should have sensible default context limits', () => {
      expect(DEFAULT_CONTEXT_LIMITS.maxImports).toBe(20);
      expect(DEFAULT_CONTEXT_LIMITS.maxTypes).toBe(15);
      expect(DEFAULT_CONTEXT_LIMITS.maxFunctions).toBe(20);
      expect(DEFAULT_CONTEXT_LIMITS.maxRelatedElements).toBe(10);
      expect(DEFAULT_CONTEXT_LIMITS.maxConventionExamples).toBe(5);
      expect(DEFAULT_CONTEXT_LIMITS.maxSourcesPerType).toBe(50);
      expect(DEFAULT_CONTEXT_LIMITS.maxRelatedDepth).toBe(2);
    });

    it('should have sensible default optimization config', () => {
      expect(DEFAULT_OPTIMIZATION_CONFIG.defaultStrategy).toBe(OptimizationStrategy.BALANCED);
      expect(DEFAULT_OPTIMIZATION_CONFIG.preserveOrder).toBe(false);
      expect(DEFAULT_OPTIMIZATION_CONFIG.typePriorities).toBeDefined();
    });

    it('should have strategy preferences for different scenarios', () => {
      expect(DEFAULT_OPTIMIZATION_CONFIG.strategyPreferences.codeCompletion).toBe(OptimizationStrategy.GREEDY);
      expect(DEFAULT_OPTIMIZATION_CONFIG.strategyPreferences.codeReview).toBe(OptimizationStrategy.DIVERSE);
      expect(DEFAULT_OPTIMIZATION_CONFIG.strategyPreferences.refactoring).toBe(OptimizationStrategy.PRIORITY);
      expect(DEFAULT_OPTIMIZATION_CONFIG.strategyPreferences.debugging).toBe(OptimizationStrategy.PRIORITY);
      expect(DEFAULT_OPTIMIZATION_CONFIG.strategyPreferences.general).toBe(OptimizationStrategy.BALANCED);
    });

    it('should have sensible default caching config', () => {
      expect(DEFAULT_CACHING_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CACHING_CONFIG.ttl).toBe(5 * 60 * 1000);
      expect(DEFAULT_CACHING_CONFIG.maxSize).toBe(100);
      expect(DEFAULT_CACHING_CONFIG.cacheContextBuilding).toBe(true);
      expect(DEFAULT_CACHING_CONFIG.cacheOptimization).toBe(true);
      expect(DEFAULT_CACHING_CONFIG.cacheCodeAnalysis).toBe(true);
    });

    it('should have sensible default performance config', () => {
      expect(DEFAULT_PERFORMANCE_CONFIG.maxAnalysisTime).toBe(5000);
      expect(DEFAULT_PERFORMANCE_CONFIG.maxContextBuildTime).toBe(3000);
      expect(DEFAULT_PERFORMANCE_CONFIG.maxOptimizationTime).toBe(1000);
      expect(DEFAULT_PERFORMANCE_CONFIG.enableParallel).toBe(false);
      expect(DEFAULT_PERFORMANCE_CONFIG.workerThreads).toBe(2);
    });
  });

  describe('Configuration Presets', () => {
    it('should have minimal preset with reduced features', () => {
      const minimal = SUGGESTION_CONFIG_PRESETS.minimal;
      expect(minimal.features.enableRelatedCode).toBe(false);
      expect(minimal.features.enableConventions).toBe(false);
      expect(minimal.tokenBudget.defaultBudget).toBe(1000);
      expect(minimal.limits.maxImports).toBe(5);
      expect(minimal.limits.maxRelatedElements).toBe(0);
    });

    it('should have balanced preset equal to defaults', () => {
      const balanced = SUGGESTION_CONFIG_PRESETS.balanced;
      expect(balanced).toEqual(DEFAULT_SUGGESTION_CONFIG);
    });

    it('should have comprehensive preset with expanded limits', () => {
      const comprehensive = SUGGESTION_CONFIG_PRESETS.comprehensive;
      expect(comprehensive.tokenBudget.defaultBudget).toBe(8000);
      expect(comprehensive.limits.maxImports).toBe(50);
      expect(comprehensive.limits.maxTypes).toBe(30);
      expect(comprehensive.limits.maxFunctions).toBe(40);
      expect(comprehensive.limits.maxRelatedElements).toBe(20);
      expect(comprehensive.limits.maxConventionExamples).toBe(10);
      expect(comprehensive.optimization.defaultStrategy).toBe(OptimizationStrategy.DIVERSE);
    });

    it('should have performance preset with reduced processing', () => {
      const performance = SUGGESTION_CONFIG_PRESETS.performance;
      expect(performance.features.enableConventions).toBe(false);
      expect(performance.tokenBudget.defaultBudget).toBe(2000);
      expect(performance.limits.maxRelatedElements).toBe(5);
      expect(performance.performance.maxAnalysisTime).toBe(2000);
      expect(performance.performance.maxContextBuildTime).toBe(1000);
    });
  });

  describe('getModelConfig', () => {
    it('should return GPT-4 configuration', () => {
      const config = getModelConfig('gpt-4');
      expect(config.tokenBudget?.defaultBudget).toBe(8000);
    });

    it('should return GPT-4 Turbo configuration', () => {
      const config = getModelConfig('gpt-4-turbo');
      expect(config.tokenBudget?.defaultBudget).toBe(16000);
    });

    it('should return GPT-3.5 Turbo configuration', () => {
      const config = getModelConfig('gpt-3.5-turbo');
      expect(config.tokenBudget?.defaultBudget).toBe(4000);
    });

    it('should return Claude 3 configuration', () => {
      const config = getModelConfig('claude-3-opus');
      expect(config.tokenBudget?.defaultBudget).toBe(16000);
    });

    it('should return Claude configuration', () => {
      const config = getModelConfig('claude-v1');
      expect(config.tokenBudget?.defaultBudget).toBe(8000);
    });

    it('should handle unknown models with default budget', () => {
      const config = getModelConfig('unknown-model');
      expect(config.tokenBudget?.defaultBudget).toBe(4000);
    });

    it('should be case insensitive', () => {
      const config1 = getModelConfig('GPT-4');
      const config2 = getModelConfig('gpt-4');
      expect(config1.tokenBudget?.defaultBudget).toBe(config2.tokenBudget?.defaultBudget);
    });
  });

  describe('mergeConfig', () => {
    it('should merge partial config with defaults', () => {
      const partial = {
        tokenBudget: {
          ...DEFAULT_TOKEN_BUDGET,
          defaultBudget: 6000,
        },
      };
      const merged = mergeConfig(partial);
      expect(merged.tokenBudget.defaultBudget).toBe(6000);
      expect(merged.features).toEqual(DEFAULT_FEATURE_FLAGS);
    });

    it('should merge feature flags', () => {
      const partial = {
        features: {
          ...DEFAULT_FEATURE_FLAGS,
          enableRelatedCode: false,
        },
      };
      const merged = mergeConfig(partial);
      expect(merged.features.enableRelatedCode).toBe(false);
      expect(merged.features.enableCodeAnalysis).toBe(true);
    });

    it('should merge nested objects', () => {
      const partial = {
        optimization: {
          ...DEFAULT_OPTIMIZATION_CONFIG,
          defaultStrategy: OptimizationStrategy.GREEDY,
        },
      };
      const merged = mergeConfig(partial);
      expect(merged.optimization.defaultStrategy).toBe(OptimizationStrategy.GREEDY);
      expect(merged.optimization.preserveOrder).toBe(false);
    });

    it('should merge with custom base', () => {
      const base = SUGGESTION_CONFIG_PRESETS.minimal;
      const partial = {
        tokenBudget: {
          ...base.tokenBudget,
          defaultBudget: 2000,
        },
      };
      const merged = mergeConfig(partial, base);
      expect(merged.tokenBudget.defaultBudget).toBe(2000);
      expect(merged.features.enableRelatedCode).toBe(false);
    });

    it('should preserve deep nested objects', () => {
      const partial = {
        optimization: {
          ...DEFAULT_OPTIMIZATION_CONFIG,
          strategyPreferences: {
            ...DEFAULT_OPTIMIZATION_CONFIG.strategyPreferences,
            codeCompletion: OptimizationStrategy.PRIORITY,
          },
        },
      };
      const merged = mergeConfig(partial);
      expect(merged.optimization.strategyPreferences.codeCompletion).toBe(OptimizationStrategy.PRIORITY);
      expect(merged.optimization.strategyPreferences.general).toBe(OptimizationStrategy.BALANCED);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const errors = validateConfig(DEFAULT_SUGGESTION_CONFIG);
      expect(errors).toEqual([]);
    });

    it('should detect invalid token budgets', () => {
      const config: SuggestionConfig = {
        ...DEFAULT_SUGGESTION_CONFIG,
        tokenBudget: {
          ...DEFAULT_TOKEN_BUDGET,
          defaultBudget: 100,
          minBudget: 500,
        },
      };
      const errors = validateConfig(config);
      expect(errors).toContain('Default token budget cannot be less than minimum budget');
    });

    it('should detect exceeded token budgets', () => {
      const config: SuggestionConfig = {
        ...DEFAULT_SUGGESTION_CONFIG,
        tokenBudget: {
          ...DEFAULT_TOKEN_BUDGET,
          defaultBudget: 20000,
          maxBudget: 16000,
        },
      };
      const errors = validateConfig(config);
      expect(errors).toContain('Default token budget cannot exceed maximum budget');
    });

    it('should detect negative token overhead', () => {
      const config: SuggestionConfig = {
        ...DEFAULT_SUGGESTION_CONFIG,
        tokenBudget: {
          ...DEFAULT_TOKEN_BUDGET,
          tokenOverhead: -10,
        },
      };
      const errors = validateConfig(config);
      expect(errors).toContain('Token overhead cannot be negative');
    });

    it('should detect invalid relevance scores', () => {
      const config: SuggestionConfig = {
        ...DEFAULT_SUGGESTION_CONFIG,
        relevance: {
          ...DEFAULT_RELEVANCE_THRESHOLDS,
          minRelevanceScore: 1.5,
        },
      };
      const errors = validateConfig(config);
      expect(errors).toContain('Minimum relevance score must be between 0 and 1');
    });

    it('should detect negative limits', () => {
      const config: SuggestionConfig = {
        ...DEFAULT_SUGGESTION_CONFIG,
        limits: {
          ...DEFAULT_CONTEXT_LIMITS,
          maxImports: -5,
        },
      };
      const errors = validateConfig(config);
      expect(errors).toContain('Maximum imports cannot be negative');
    });

    it('should detect invalid related depth', () => {
      const config: SuggestionConfig = {
        ...DEFAULT_SUGGESTION_CONFIG,
        limits: {
          ...DEFAULT_CONTEXT_LIMITS,
          maxRelatedDepth: 0,
        },
      };
      const errors = validateConfig(config);
      expect(errors).toContain('Maximum related depth must be at least 1');
    });

    it('should detect multiple errors', () => {
      const config: SuggestionConfig = {
        ...DEFAULT_SUGGESTION_CONFIG,
        tokenBudget: {
          ...DEFAULT_TOKEN_BUDGET,
          tokenOverhead: -5,
        },
        relevance: {
          ...DEFAULT_RELEVANCE_THRESHOLDS,
          minRelevanceScore: -0.5,
        },
      };
      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  describe('createConfigFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should create empty config when no env vars set', () => {
      const config = createConfigFromEnv();
      expect(config).toEqual({});
    });

    it('should parse token budget from env', () => {
      process.env.AI_SUGGESTION_TOKEN_BUDGET = '8000';
      const config = createConfigFromEnv();
      expect(config.tokenBudget?.defaultBudget).toBe(8000);
    });

    it('should parse related code flag from env', () => {
      process.env.AI_SUGGESTION_ENABLE_RELATED_CODE = 'false';
      const config = createConfigFromEnv();
      expect(config.features?.enableRelatedCode).toBe(false);
    });

    it('should parse conventions flag from env', () => {
      process.env.AI_SUGGESTION_ENABLE_CONVENTIONS = 'true';
      const config = createConfigFromEnv();
      expect(config.features?.enableConventions).toBe(true);
    });

    it('should parse cache TTL from env', () => {
      process.env.AI_SUGGESTION_CACHE_TTL = '300000';
      const config = createConfigFromEnv();
      expect(config.caching?.ttl).toBe(300000);
    });

    it('should ignore invalid numbers', () => {
      process.env.AI_SUGGESTION_TOKEN_BUDGET = 'invalid';
      const config = createConfigFromEnv();
      expect(config.tokenBudget).toBeUndefined();
    });

    it('should parse multiple env vars', () => {
      process.env.AI_SUGGESTION_TOKEN_BUDGET = '6000';
      process.env.AI_SUGGESTION_ENABLE_RELATED_CODE = 'false';
      process.env.AI_SUGGESTION_CACHE_TTL = '120000';
      const config = createConfigFromEnv();
      expect(config.tokenBudget?.defaultBudget).toBe(6000);
      expect(config.features?.enableRelatedCode).toBe(false);
      expect(config.caching?.ttl).toBe(120000);
    });
  });

  describe('SuggestionConfigManager', () => {
    it('should create manager with defaults', () => {
      const manager = createConfigManager();
      const config = manager.getConfig();
      expect(config).toEqual(DEFAULT_SUGGESTION_CONFIG);
    });

    it('should create manager with custom config', () => {
      const customConfig = {
        tokenBudget: {
          ...DEFAULT_TOKEN_BUDGET,
          defaultBudget: 6000,
        },
      };
      const manager = createConfigManager(customConfig);
      const config = manager.getConfig();
      expect(config.tokenBudget.defaultBudget).toBe(6000);
    });

    it('should update configuration', () => {
      const manager = createConfigManager();
      manager.updateConfig({
        features: {
          ...DEFAULT_FEATURE_FLAGS,
          enableRelatedCode: false,
        },
      });
      const config = manager.getConfig();
      expect(config.features.enableRelatedCode).toBe(false);
    });

    it('should reset configuration', () => {
      const manager = createConfigManager();
      manager.updateConfig({
        tokenBudget: {
          ...DEFAULT_TOKEN_BUDGET,
          defaultBudget: 8000,
        },
      });
      manager.reset();
      const config = manager.getConfig();
      expect(config.tokenBudget.defaultBudget).toBe(4000);
    });

    it('should load preset configuration', () => {
      const manager = createConfigManager();
      manager.loadPreset('minimal');
      const config = manager.getConfig();
      expect(config.features.enableRelatedCode).toBe(false);
      expect(config.tokenBudget.defaultBudget).toBe(1000);
    });

    it('should return copy of config to prevent mutations', () => {
      const manager = createConfigManager();
      const config1 = manager.getConfig();
      config1.tokenBudget.defaultBudget = 9999;
      const config2 = manager.getConfig();
      expect(config2.tokenBudget.defaultBudget).toBe(4000);
    });

    it('should support preset switching', () => {
      const manager = createConfigManager();
      manager.loadPreset('minimal');
      expect(manager.getConfig().tokenBudget.defaultBudget).toBe(1000);
      manager.loadPreset('comprehensive');
      expect(manager.getConfig().tokenBudget.defaultBudget).toBe(8000);
    });
  });

  describe('Global Configuration Manager', () => {
    it('should return singleton instance', () => {
      const manager1 = getConfigManager();
      const manager2 = getConfigManager();
      expect(manager1).toBe(manager2);
    });

    it('should maintain state across calls', () => {
      const manager1 = getConfigManager();
      manager1.updateConfig({
        tokenBudget: {
          ...DEFAULT_TOKEN_BUDGET,
          defaultBudget: 7000,
        },
      });
      const manager2 = getConfigManager();
      expect(manager2.getConfig().tokenBudget.defaultBudget).toBe(7000);
    });
  });

  describe('Type Priorities', () => {
    it('should have correct priority ordering', () => {
      const priorities = DEFAULT_OPTIMIZATION_CONFIG.typePriorities;
      expect(priorities.import).toBeGreaterThan(priorities.type);
      expect(priorities.type).toBeGreaterThan(priorities.function);
      expect(priorities.function).toBeGreaterThan(priorities.related_code);
      expect(priorities.related_code).toBeGreaterThan(priorities.convention);
      expect(priorities.convention).toBeGreaterThan(priorities.project_pattern);
    });

    it('should have priorities between 0 and 1', () => {
      const priorities = Object.values(DEFAULT_OPTIMIZATION_CONFIG.typePriorities);
      priorities.forEach(priority => {
        expect(priority).toBeGreaterThanOrEqual(0);
        expect(priority).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Integration', () => {
    it('should work with full workflow', () => {
      // Create manager
      const manager = createConfigManager();

      // Get model-specific config
      const modelConfig = getModelConfig('gpt-4');

      // Merge with custom settings
      const customConfig = mergeConfig(
        {
          ...modelConfig,
          features: {
            ...DEFAULT_FEATURE_FLAGS,
            enableConventions: false,
          },
        },
        manager.getConfig()
      );

      // Validate
      const errors = validateConfig(customConfig);
      expect(errors).toEqual([]);

      // Apply
      manager.updateConfig(customConfig);
      const finalConfig = manager.getConfig();

      expect(finalConfig.tokenBudget.defaultBudget).toBe(8000);
      expect(finalConfig.features.enableConventions).toBe(false);
    });
  });
});
