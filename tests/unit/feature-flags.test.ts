/**
 * Unit tests for Feature Flag Engine
 * Tests Eppo-inspired experimentation capabilities
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { FeatureFlagEngine, ExperimentContext } from '@/lib/feature-flags'

// Mock the monitoring dependencies
jest.mock('@/lib/server-monitoring', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn()
  },
  appLogger: {
    logBusiness: jest.fn(),
    logPerformance: jest.fn()
  }
}));

describe('FeatureFlagEngine', () => {
  let engine: FeatureFlagEngine;
  const mockContext: ExperimentContext = {
    userId: 'user123',
    workspaceId: 'workspace456',
    customAttributes: { plan: 'pro' }
  }

  beforeEach(() => {
    engine = new FeatureFlagEngine();
  });

  describe('Flag Creation', () => {
    test('should create a feature flag successfully', async () => {
      const flag = {
        key: 'test_flag',
        name: 'Test Flag',
        description: 'A test feature flag',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', description: 'Control variant', weight: 50 },
          { key: 'treatment', name: 'Treatment', description: 'Treatment variant', weight: 50 }
        ],
        targeting: {
          rules: [],
          defaultVariant: 'control',
          rolloutPercentage: 100
        },
        metrics: ['conversion', 'engagement'],
        createdBy: 'test_user'
      }

      await engine.createFlag(flag);
      
      // Test that flag can be evaluated
      const result = await engine.evaluateFlag('test_flag', mockContext);
      
      expect(result.flagKey).toBe('test_flag');
      expect(['control', 'treatment']).toContain(result.variant);
      expect(result.isExperiment).toBe(true);
    });
  });

  describe('Flag Evaluation', () => {
    test('should return control for disabled flag', async () => {
      await engine.createFlag({
        key: 'disabled_flag',
        name: 'Disabled Flag',
        description: 'A disabled flag',
        enabled: false,
        variants: [
          { key: 'control', name: 'Control', description: 'Control', weight: 100 }
        ],
        targeting: { rules: [], defaultVariant: 'control', rolloutPercentage: 100 },
        metrics: [],
        createdBy: 'test'
      });

      const result = await engine.evaluateFlag('disabled_flag', mockContext);
      
      expect(result.variant).toBe('control');
      expect(result.isExperiment).toBe(false);
    });

    test('should return control for non-existent flag', async () => {
      const result = await engine.evaluateFlag('non_existent_flag', mockContext);
      
      expect(result.variant).toBe('control');
      expect(result.isExperiment).toBe(false);
    });

    test('should maintain consistent allocation for same user', async () => {
      await engine.createFlag({
        key: 'consistency_test',
        name: 'Consistency Test',
        description: 'Test consistent allocation',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', description: 'Control', weight: 50 },
          { key: 'treatment', name: 'Treatment', description: 'Treatment', weight: 50 }
        ],
        targeting: { rules: [], defaultVariant: 'control', rolloutPercentage: 100 },
        metrics: [],
        createdBy: 'test'
      });

      const result1 = await engine.evaluateFlag('consistency_test', mockContext);
      const result2 = await engine.evaluateFlag('consistency_test', mockContext);
      
      expect(result1.variant).toBe(result2.variant);
      expect(result1.allocationKey).toBe(result2.allocationKey);
    });
  });

  describe('Targeting Rules', () => {
    beforeEach(async () => {
      await engine.createFlag({
        key: 'targeting_test',
        name: 'Targeting Test',
        description: 'Test targeting rules',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', description: 'Control', weight: 50 },
          { key: 'treatment', name: 'Treatment', description: 'Treatment', weight: 50 }
        ],
        targeting: {
          rules: [
            {
              attribute: 'plan',
              operator: 'equals',
              value: 'pro',
              variant: 'treatment'
            }
          ],
          defaultVariant: 'control',
          rolloutPercentage: 100
        },
        metrics: [],
        createdBy: 'test'
      });
    });

    test('should apply targeting rule for pro users', async () => {
      const proContext: ExperimentContext = {
        userId: 'user123',
        customAttributes: { plan: 'pro' }
      }

      const result = await engine.evaluateFlag('targeting_test', proContext);
      expect(result.variant).toBe('treatment');
    });

    test('should use random allocation for non-matching users', async () => {
      const basicContext: ExperimentContext = {
        userId: 'user456',
        customAttributes: { plan: 'basic' }
      }

      const result = await engine.evaluateFlag('targeting_test', basicContext);
      expect(['control', 'treatment']).toContain(result.variant);
    });
  });

  describe('Metric Tracking', () => {
    test('should track metrics successfully', async () => {
      await engine.createFlag({
        key: 'metric_test',
        name: 'Metric Test',
        description: 'Test metric tracking',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', description: 'Control', weight: 100 }
        ],
        targeting: { rules: [], defaultVariant: 'control', rolloutPercentage: 100 },
        metrics: ['conversion'],
        createdBy: 'test'
      });

      // First evaluate to allocate user
      await engine.evaluateFlag('metric_test', mockContext);

      // Then track metrics
      await expect(
        engine.trackMetric('metric_test', 'conversion', 1, mockContext);
      ).resolves.toBeUndefined();
    });
  });

  describe('Experiment Results', () => {
    test('should return experiment results with statistics', async () => {
      await engine.createFlag({
        key: 'results_test',
        name: 'Results Test',
        description: 'Test experiment results',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', description: 'Control', weight: 50 },
          { key: 'treatment', name: 'Treatment', description: 'Treatment', weight: 50 }
        ],
        targeting: { rules: [], defaultVariant: 'control', rolloutPercentage: 100 },
        metrics: ['conversion'],
        createdBy: 'test'
      });

      // Simulate some experiment data
      const contexts = [
        { userId: 'user1' },
        { userId: 'user2' },
        { userId: 'user3' },
        { userId: 'user4' }
      ]

      // Evaluate flags for multiple users
      for (const context of contexts) {
        await engine.evaluateFlag('results_test', context);
        await engine.trackMetric('results_test', 'conversion', Math.random() > 0.5 ? 1 : 0, context);
      }

      const results = await engine.getExperimentResults('results_test');
      
      expect(results.flag).toBeTruthy();
      expect(results.flag?.key).toBe('results_test');
      expect(results.metrics).toBeDefined();
      expect(results.statisticalSignificance).toBeDefined();
    });

    test('should return null for non-existent flag results', async () => {
      const results = await engine.getExperimentResults('non_existent_flag');
      
      expect(results.flag).toBeNull();
      expect(results.metrics).toEqual({});
      expect(results.statisticalSignificance).toEqual({});
    });
  });

  describe('Statistical Calculations', () => {
    test('should calculate conversion rates correctly', async () => {
      await engine.createFlag({
        key: 'stats_test',
        name: 'Stats Test',
        description: 'Test statistical calculations',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', description: 'Control', weight: 100 }
        ],
        targeting: { rules: [], defaultVariant: 'control', rolloutPercentage: 100 },
        metrics: ['conversion'],
        createdBy: 'test'
      });

      // Simulate specific conversion data
      const testContexts = [;
        { userId: 'user1' },
        { userId: 'user2' },
        { userId: 'user3' },
        { userId: 'user4' },
        { userId: 'user5' }
      ]

      // 3 out of 5 users convert (60% conversion rate);
      for (let i = 0; i < testContexts.length; i++) {
        await engine.evaluateFlag('stats_test', testContexts[i]);
        const conversionValue = i < 3 ? 1 : 0 // First 3 convert;
        await engine.trackMetric('stats_test', 'conversion', conversionValue, testContexts[i]);
      }

      const results = await engine.getExperimentResults('stats_test');
      const controlMetrics = results.metrics['control'];
      
      expect(controlMetrics.totalSamples).toBe(5);
      expect(controlMetrics.conversionRate).toBe(0.6) // 3/5 = 60%
    });
  });

  describe('Hash Consistency', () => {
    test('should produce consistent hash for same input', async () => {
      await engine.createFlag({
        key: 'hash_test',
        name: 'Hash Test',
        description: 'Test hash consistency',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', description: 'Control', weight: 50 },
          { key: 'treatment', name: 'Treatment', description: 'Treatment', weight: 50 }
        ],
        targeting: { rules: [], defaultVariant: 'control', rolloutPercentage: 100 },
        metrics: [],
        createdBy: 'test'
      });

      const sameUserContext = { userId: 'consistent_user' };
      
      const results = await Promise.all([;
        engine.evaluateFlag('hash_test', sameUserContext),
        engine.evaluateFlag('hash_test', sameUserContext),
        engine.evaluateFlag('hash_test', sameUserContext);
      ]);

      // All evaluations should return the same variant
      const variants = results.map(r => r.variant);
      expect(new Set(variants).size).toBe(1);
    });
  });
});