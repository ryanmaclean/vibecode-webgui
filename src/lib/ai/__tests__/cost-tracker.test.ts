/**
 * Unit tests for cost-tracker.ts
 * Tests cost tracking, estimation, and alert functionality
 */

// Mock the token counter to avoid tiktoken issues in tests
jest.mock('../context/token-counter', () => ({
  getTokenCounter: jest.fn(() => ({
    count: jest.fn((text: string) => ({
      count: Math.ceil(text.length / 4), // Simple estimation: ~4 chars per token
      model: 'gpt-4',
      isExact: false,
      durationMs: 1,
      fromCache: false,
    })),
    estimate: jest.fn((text: string) => ({
      count: Math.ceil(text.length / 4),
      model: 'gpt-4',
      isExact: false,
      durationMs: 1,
      fromCache: false,
    })),
    getModelConfig: jest.fn((model: string) => ({
      model,
      family: 'gpt-4',
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
      systemPromptReserved: 1000,
      responseReserved: 4000,
      inputCostPer1K: 0.03,
      outputCostPer1K: 0.06,
    })),
  })),
  TokenCounter: jest.fn().mockImplementation(() => ({
    count: jest.fn((text: string) => ({
      count: Math.ceil(text.length / 4),
      model: 'gpt-4',
      isExact: false,
      durationMs: 1,
      fromCache: false,
    })),
  })),
}));

import {
  CostTracker,
  getCostTracker,
  estimateCost,
  recordUsage,
  MODEL_PRICING,
} from '../cost/cost-tracker';
import {
  ModelPricing,
  UsageStats,
  CostEstimate,
  CostComparison,
  CostAlert,
  CostSettings,
  DEFAULT_COST_SETTINGS,
} from '@/types/cost-estimation';

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Set up mock before tests
beforeAll(() => {
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
  });
});

afterEach(() => {
  localStorageMock.clear();
});

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    localStorageMock.clear();
    tracker = new CostTracker({ enablePersistence: false });
  });

  afterEach(() => {
    tracker.dispose();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default options', () => {
      const newTracker = new CostTracker();
      expect(newTracker.getSessionId()).toBeDefined();
      expect(newTracker.getSessionId()).toMatch(/^session_/);
      newTracker.dispose();
    });

    it('should initialize with custom options', () => {
      const customTracker = new CostTracker({
        enablePersistence: false,
        sessionTimeout: 60000,
        enableAlertChecking: false,
      });
      expect(customTracker.getSessionId()).toBeDefined();
      customTracker.dispose();
    });

    it('should create empty session on init', () => {
      const session = tracker.getCurrentSession();
      expect(session.totalCost).toBe(0);
      expect(session.totalTokens).toBe(0);
      expect(session.requests).toBe(0);
      expect(Object.keys(session.byModel)).toHaveLength(0);
    });
  });

  describe('Model Pricing', () => {
    it('should have pricing for major models', () => {
      const majorModels = [
        'gpt-4',
        'gpt-4o',
        'gpt-3.5-turbo',
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku',
        'gemini-pro',
        'mistral-large',
      ];

      majorModels.forEach((modelId) => {
        const pricing = tracker.getModelPricing(modelId);
        expect(pricing).toBeDefined();
        expect(pricing.inputCostPer1K).toBeGreaterThanOrEqual(0);
        expect(pricing.outputCostPer1K).toBeGreaterThanOrEqual(0);
        expect(pricing.contextWindow).toBeGreaterThan(0);
      });
    });

    it('should return estimated pricing for unknown models', () => {
      const pricing = tracker.getModelPricing('unknown-model-xyz');
      expect(pricing).toBeDefined();
      expect(pricing.isEstimated).toBe(true);
      expect(pricing.modelId).toBe('unknown-model-xyz');
    });

    it('should match partial model names', () => {
      // Should match gpt-4 even with version suffix
      const pricing = tracker.getModelPricing('gpt-4-0125-preview');
      expect(pricing.provider).toBe('openai');
    });

    it('should have consistent pricing data structure', () => {
      Object.values(MODEL_PRICING).forEach((pricing) => {
        expect(pricing.modelId).toBeDefined();
        expect(pricing.displayName).toBeDefined();
        expect(pricing.provider).toBeDefined();
        expect(typeof pricing.inputCostPer1K).toBe('number');
        expect(typeof pricing.outputCostPer1K).toBe('number');
        expect(typeof pricing.contextWindow).toBe('number');
        expect(typeof pricing.maxOutputTokens).toBe('number');
      });
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost correctly', () => {
      const pricing: ModelPricing = {
        modelId: 'test-model',
        displayName: 'Test Model',
        provider: 'test',
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.02,
        contextWindow: 8192,
        maxOutputTokens: 4096,
      };

      const cost = tracker.calculateCost(1000, 500, pricing);
      // (1000/1000) * 0.01 + (500/1000) * 0.02 = 0.01 + 0.01 = 0.02
      expect(cost).toBeCloseTo(0.02, 6);
    });

    it('should handle zero tokens', () => {
      const pricing = tracker.getModelPricing('gpt-4');
      const cost = tracker.calculateCost(0, 0, pricing);
      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const pricing = tracker.getModelPricing('gpt-4');
      const cost = tracker.calculateCost(1000000, 500000, pricing);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
      expect(Number.isFinite(cost)).toBe(true);
    });

    it('should return detailed cost breakdown', () => {
      const breakdown = tracker.getCostBreakdown(1000, 500, 'gpt-4');

      expect(breakdown.inputCost).toBeGreaterThan(0);
      expect(breakdown.outputCost).toBeGreaterThan(0);
      expect(breakdown.total).toBe(breakdown.inputCost + breakdown.outputCost);
      expect(breakdown.inputTokens).toBe(1000);
      expect(breakdown.outputTokens).toBe(500);
      expect(breakdown.inputRate).toBeGreaterThan(0);
      expect(breakdown.outputRate).toBeGreaterThan(0);
    });
  });

  describe('Usage Recording', () => {
    it('should record usage and update session', () => {
      const usage = tracker.recordUsage('gpt-4', 1000, 500);

      expect(usage.promptTokens).toBe(1000);
      expect(usage.completionTokens).toBe(500);
      expect(usage.totalCost).toBeGreaterThan(0);
      expect(usage.requests).toBe(1);
      expect(usage.modelId).toBe('gpt-4');

      const session = tracker.getCurrentSession();
      expect(session.requests).toBe(1);
      expect(session.totalCost).toBe(usage.totalCost);
      expect(session.totalTokens).toBe(1500);
    });

    it('should accumulate multiple usages', () => {
      tracker.recordUsage('gpt-4', 1000, 500);
      tracker.recordUsage('gpt-4', 2000, 1000);

      const session = tracker.getCurrentSession();
      expect(session.requests).toBe(2);
      expect(session.totalTokens).toBe(4500);
    });

    it('should track usage by model', () => {
      tracker.recordUsage('gpt-4', 1000, 500);
      tracker.recordUsage('claude-3-sonnet', 2000, 1000);
      tracker.recordUsage('gpt-4', 500, 250);

      const session = tracker.getCurrentSession();
      expect(Object.keys(session.byModel)).toContain('gpt-4');
      expect(Object.keys(session.byModel)).toContain('claude-3-sonnet');
      expect(session.byModel['gpt-4'].requests).toBe(2);
      expect(session.byModel['claude-3-sonnet'].requests).toBe(1);
    });

    it('should include optional metadata', () => {
      const usage = tracker.recordUsage('gpt-4', 1000, 500, {
        sessionId: 'custom-session',
        userId: 'user-123',
        workspaceId: 'workspace-456',
      });

      expect(usage.sessionId).toBe('custom-session');
      expect(usage.userId).toBe('user-123');
      expect(usage.workspaceId).toBe('workspace-456');
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate cost for a message', () => {
      const estimate = tracker.estimateCost('Hello, how are you?', 'gpt-4');

      expect(estimate).toBeDefined();
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
      expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
      expect(estimate.modelId).toBe('gpt-4');
      expect(['high', 'medium', 'low']).toContain(estimate.confidence);
    });

    it('should use provided output token estimate', () => {
      const estimate = tracker.estimateCost('Test message', 'gpt-4', 100);

      expect(estimate.estimatedOutputTokens).toBe(100);
      expect(estimate.confidence).toBe('high');
    });

    it('should include cost breakdown', () => {
      const estimate = tracker.estimateCost('Test message', 'gpt-4');

      expect(estimate.breakdown).toBeDefined();
      expect(estimate.breakdown.inputCost).toBeGreaterThanOrEqual(0);
      expect(estimate.breakdown.outputCost).toBeGreaterThanOrEqual(0);
      expect(estimate.breakdown.total).toBe(estimate.estimatedCost);
    });

    it('should calculate min/max cost range', () => {
      const estimate = tracker.estimateCost('Test message', 'gpt-4');

      expect(estimate.minCost).toBeLessThanOrEqual(estimate.estimatedCost);
      expect(estimate.maxCost).toBeGreaterThanOrEqual(estimate.estimatedCost);
    });

    it('should add warnings for estimated pricing', () => {
      const estimate = tracker.estimateCost('Test', 'unknown-model-xyz');

      expect(estimate.warnings).toBeDefined();
      expect(estimate.warnings!.length).toBeGreaterThan(0);
      expect(estimate.confidence).toBe('low');
    });
  });

  describe('Model Comparison', () => {
    it('should compare costs across models', () => {
      const comparison = tracker.compareModels('Hello, how are you?');

      expect(comparison).toBeDefined();
      expect(comparison.estimates.length).toBeGreaterThan(0);
      expect(comparison.cheapestModel).toBeDefined();
      expect(comparison.bestValueModel).toBeDefined();
    });

    it('should sort models by cost', () => {
      const comparison = tracker.compareModels('Test message');

      for (let i = 1; i < comparison.estimates.length; i++) {
        expect(comparison.estimates[i].estimatedCost).toBeGreaterThanOrEqual(
          comparison.estimates[i - 1].estimatedCost
        );
      }
    });

    it('should calculate savings percentage', () => {
      const comparison = tracker.compareModels('Test message');

      comparison.estimates.forEach((estimate) => {
        expect(estimate.savingsPercentage).toBeGreaterThanOrEqual(0);
        expect(estimate.savingsPercentage).toBeLessThanOrEqual(100);
      });
    });

    it('should compare specific models', () => {
      const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-haiku'];
      const comparison = tracker.compareModels('Test', models);

      expect(comparison.estimates.length).toBe(models.length);
      models.forEach((modelId) => {
        expect(comparison.estimates.some((e) => e.modelId === modelId)).toBe(true);
      });
    });

    it('should identify cheapest model correctly', () => {
      const comparison = tracker.compareModels('Test message');
      const cheapestEstimate = comparison.estimates.find(
        (e) => e.modelId === comparison.cheapestModel
      );

      expect(cheapestEstimate).toBeDefined();
      expect(cheapestEstimate!.estimatedCost).toBe(
        Math.min(...comparison.estimates.map((e) => e.estimatedCost))
      );
    });
  });

  describe('Cost Alerts', () => {
    it('should create a cost alert', () => {
      const alert = tracker.createAlert({
        type: 'session_limit',
        threshold: 1.0,
        enabled: true,
        notifyOnTrigger: true,
        notificationChannels: ['in_app'],
      });

      expect(alert).toBeDefined();
      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('session_limit');
      expect(alert.threshold).toBe(1.0);
      expect(alert.enabled).toBe(true);
      expect(alert.triggered).toBe(false);
    });

    it('should update an alert', () => {
      const alert = tracker.createAlert({
        type: 'session_limit',
        threshold: 1.0,
        enabled: true,
        notifyOnTrigger: true,
        notificationChannels: ['in_app'],
      });

      const updated = tracker.updateAlert(alert.id, { threshold: 2.0 });

      expect(updated).toBeDefined();
      expect(updated!.threshold).toBe(2.0);
    });

    it('should delete an alert', () => {
      const alert = tracker.createAlert({
        type: 'session_limit',
        threshold: 1.0,
        enabled: true,
        notifyOnTrigger: true,
        notificationChannels: ['in_app'],
      });

      const deleted = tracker.deleteAlert(alert.id);
      expect(deleted).toBe(true);

      const alerts = tracker.getAlerts();
      expect(alerts.find((a) => a.id === alert.id)).toBeUndefined();
    });

    it('should acknowledge a triggered alert', () => {
      const alert = tracker.createAlert({
        type: 'session_limit',
        threshold: 0.0001, // Very low threshold
        enabled: true,
        notifyOnTrigger: true,
        notificationChannels: ['in_app'],
      });

      // Trigger the alert by recording usage
      tracker.recordUsage('gpt-4', 1000, 500);

      // The alert should be triggered
      const alerts = tracker.getAlerts();
      const triggeredAlert = alerts.find((a) => a.id === alert.id);
      expect(triggeredAlert?.triggered).toBe(true);

      // Acknowledge it
      tracker.acknowledgeAlert(alert.id);

      const updatedAlerts = tracker.getAlerts();
      const acknowledgedAlert = updatedAlerts.find((a) => a.id === alert.id);
      expect(acknowledgedAlert?.triggered).toBe(false);
    });

    it('should return all alerts', () => {
      tracker.createAlert({
        type: 'session_limit',
        threshold: 1.0,
        enabled: true,
        notifyOnTrigger: true,
        notificationChannels: ['in_app'],
      });

      tracker.createAlert({
        type: 'daily_limit',
        threshold: 5.0,
        enabled: true,
        notifyOnTrigger: true,
        notificationChannels: ['in_app'],
      });

      const alerts = tracker.getAlerts();
      expect(alerts.length).toBe(2);
    });
  });

  describe('Settings Management', () => {
    it('should return default settings', () => {
      const settings = tracker.getSettings();

      expect(settings.monthlyBudget).toBe(DEFAULT_COST_SETTINGS.monthlyBudget);
      expect(settings.displayMode).toBe(DEFAULT_COST_SETTINGS.displayMode);
      expect(settings.showEstimatesBeforeSend).toBe(
        DEFAULT_COST_SETTINGS.showEstimatesBeforeSend
      );
    });

    it('should update settings', () => {
      const updated = tracker.updateSettings({
        monthlyBudget: 100,
        displayMode: 'daily',
      });

      expect(updated.monthlyBudget).toBe(100);
      expect(updated.displayMode).toBe('daily');
    });

    it('should preserve unchanged settings', () => {
      const original = tracker.getSettings();
      tracker.updateSettings({ monthlyBudget: 50 });
      const updated = tracker.getSettings();

      expect(updated.displayMode).toBe(original.displayMode);
      expect(updated.showRealtimeCosts).toBe(original.showRealtimeCosts);
    });
  });

  describe('Usage History', () => {
    it('should return usage history', () => {
      const history = tracker.getUsageHistory();

      expect(history).toBeDefined();
      expect(history.hourly).toBeDefined();
      expect(history.daily).toBeDefined();
      expect(history.weekly).toBeDefined();
      expect(history.monthly).toBeDefined();
      expect(history.currentSession).toBeDefined();
      expect(history.allTime).toBeDefined();
    });

    it('should return aggregated usage by period', () => {
      const hourly = tracker.getAggregatedUsage('hourly');
      const daily = tracker.getAggregatedUsage('daily');

      expect(Array.isArray(hourly)).toBe(true);
      expect(Array.isArray(daily)).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should start a new session', () => {
      const oldSessionId = tracker.getSessionId();

      tracker.recordUsage('gpt-4', 1000, 500);
      expect(tracker.getCurrentSession().requests).toBe(1);

      tracker.startNewSession();

      const newSessionId = tracker.getSessionId();
      expect(newSessionId).not.toBe(oldSessionId);
      expect(tracker.getCurrentSession().requests).toBe(0);
    });
  });

  describe('Data Export', () => {
    it('should export as CSV', () => {
      tracker.recordUsage('gpt-4', 1000, 500);

      const csv = tracker.exportAsCSV({
        format: 'csv',
        period: 'daily',
        includeBreakdown: true,
        includeModels: true,
        includeProviders: true,
      });

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Timestamp');
      expect(csv).toContain('Cost');
    });

    it('should export as JSON', () => {
      tracker.recordUsage('gpt-4', 1000, 500);

      const json = tracker.exportAsJSON({
        format: 'json',
        period: 'daily',
        includeBreakdown: true,
        includeModels: true,
        includeProviders: true,
      });

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.exportDate).toBeDefined();
      expect(parsed.period).toBe('daily');
    });
  });

  describe('Event Subscription', () => {
    it('should emit events on usage recording', (done) => {
      const unsubscribe = tracker.subscribe((event) => {
        expect(event.type).toBe('usage_recorded');
        expect(event.payload).toBeDefined();
        unsubscribe();
        done();
      });

      tracker.recordUsage('gpt-4', 1000, 500);
    });

    it('should emit events on settings update', (done) => {
      const unsubscribe = tracker.subscribe((event) => {
        expect(event.type).toBe('settings_updated');
        unsubscribe();
        done();
      });

      tracker.updateSettings({ monthlyBudget: 50 });
    });

    it('should allow unsubscribing', () => {
      let callCount = 0;
      const unsubscribe = tracker.subscribe(() => {
        callCount++;
      });

      tracker.recordUsage('gpt-4', 100, 50);
      expect(callCount).toBe(1);

      unsubscribe();

      tracker.recordUsage('gpt-4', 100, 50);
      expect(callCount).toBe(1); // Should not increase
    });
  });

  describe('Utility Methods', () => {
    it('should get all model pricing', () => {
      const allPricing = tracker.getAllModelPricing();
      expect(allPricing.length).toBeGreaterThan(0);
      expect(allPricing[0].modelId).toBeDefined();
    });

    it('should get models by provider', () => {
      const openaiModels = tracker.getModelsByProvider('openai');
      expect(openaiModels.length).toBeGreaterThan(0);
      openaiModels.forEach((model) => {
        expect(model.provider).toBe('openai');
      });
    });

    it('should get models by tier', () => {
      const economyModels = tracker.getModelsByTier('economy');
      expect(economyModels.length).toBeGreaterThan(0);
    });

    it('should get cost-effective alternatives', () => {
      const alternatives = tracker.getCostEffectiveAlternatives('gpt-4', 5);
      expect(alternatives.length).toBeLessThanOrEqual(5);

      const gpt4Pricing = tracker.getModelPricing('gpt-4');
      const gpt4AvgCost = (gpt4Pricing.inputCostPer1K + gpt4Pricing.outputCostPer1K) / 2;

      alternatives.forEach((alt) => {
        const avgCost = (alt.inputCostPer1K + alt.outputCostPer1K) / 2;
        expect(avgCost).toBeLessThan(gpt4AvgCost);
      });
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset all data', () => {
      tracker.recordUsage('gpt-4', 1000, 500);
      tracker.createAlert({
        type: 'session_limit',
        threshold: 1.0,
        enabled: true,
        notifyOnTrigger: true,
        notificationChannels: ['in_app'],
      });

      tracker.resetAllData();

      expect(tracker.getCurrentSession().requests).toBe(0);
      expect(tracker.getAlerts().length).toBe(0);
    });

    it('should dispose resources properly', () => {
      tracker.recordUsage('gpt-4', 1000, 500);

      // Should not throw
      expect(() => tracker.dispose()).not.toThrow();
    });
  });
});

describe('Module Exports', () => {
  it('should export getCostTracker function', () => {
    expect(typeof getCostTracker).toBe('function');
    const instance = getCostTracker();
    expect(instance).toBeInstanceOf(CostTracker);
  });

  it('should export estimateCost helper', () => {
    expect(typeof estimateCost).toBe('function');
    const estimate = estimateCost('Test', 'gpt-4');
    expect(estimate.estimatedCost).toBeGreaterThan(0);
  });

  it('should export recordUsage helper', () => {
    expect(typeof recordUsage).toBe('function');
    const usage = recordUsage('gpt-4', 100, 50);
    expect(usage.totalCost).toBeGreaterThan(0);
  });

  it('should export MODEL_PRICING', () => {
    expect(MODEL_PRICING).toBeDefined();
    expect(Object.keys(MODEL_PRICING).length).toBeGreaterThan(10);
  });
});
