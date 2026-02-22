/**
 * Tests for AI Quality Tracker Service
 */

import {
  QualityTracker,
  createQualityTracker,
  getQualityTracker,
  resetQualityTracker,
  type SuggestionData,
  type AcceptanceData,
  type RejectionData,
  type RatingData,
} from '../quality-tracker';
import type { IMetricsProvider } from '@/lib/monitoring/metrics-provider';
import type { QualityMetrics } from '@/types/ai-quality-metrics';

// =============================================================================
// Mock Metrics Provider
// =============================================================================

class MockMetricsProvider implements IMetricsProvider {
  readonly name = 'mock';
  readonly enabled = true;

  public metrics: Array<{
    type: string;
    name: string;
    value: number;
    tags?: Record<string, string | number | boolean>;
  }> = [];

  increment(name: string, value: number = 1, options?: { tags?: Record<string, string | number | boolean> }): void {
    this.metrics.push({ type: 'increment', name, value, tags: options?.tags });
  }

  decrement(name: string, value: number = 1, options?: { tags?: Record<string, string | number | boolean> }): void {
    this.metrics.push({ type: 'decrement', name, value, tags: options?.tags });
  }

  gauge(name: string, value: number, options?: { tags?: Record<string, string | number | boolean> }): void {
    this.metrics.push({ type: 'gauge', name, value, tags: options?.tags });
  }

  histogram(name: string, value: number, options?: { tags?: Record<string, string | number | boolean> }): void {
    this.metrics.push({ type: 'histogram', name, value, tags: options?.tags });
  }

  timing(name: string, duration: number, options?: { tags?: Record<string, string | number | boolean> }): void {
    this.metrics.push({ type: 'timing', name, value: duration, tags: options?.tags });
  }

  distribution(name: string, value: number, options?: { tags?: Record<string, string | number | boolean> }): void {
    this.metrics.push({ type: 'distribution', name, value, tags: options?.tags });
  }

  set(name: string, value: string | number, options?: { tags?: Record<string, string | number | boolean> }): void {
    this.metrics.push({ type: 'set', name, value: typeof value === 'number' ? value : 0, tags: options?.tags });
  }

  async flush(): Promise<void> {
    // No-op for mock
  }

  async shutdown(): Promise<void> {
    // No-op for mock
  }

  reset(): void {
    this.metrics = [];
  }

  getMetric(name: string): Array<typeof this.metrics[0]> {
    return this.metrics.filter(m => m.name === name);
  }

  hasMetric(name: string): boolean {
    return this.metrics.some(m => m.name === name);
  }
}

// =============================================================================
// Test Suite
// =============================================================================

describe('QualityTracker', () => {
  let mockMetrics: MockMetricsProvider;
  let tracker: QualityTracker;

  beforeEach(() => {
    mockMetrics = new MockMetricsProvider();
    tracker = createQualityTracker(mockMetrics, { enabled: true, samplingRate: 1.0 });
  });

  describe('trackSuggestion', () => {
    it('should track a new suggestion and emit metrics', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'anthropic/claude-3.5-sonnet',
        suggestion: 'function add(a, b) { return a + b; }',
        language: 'typescript',
      });

      expect(suggestionId).toBeTruthy();
      expect(suggestionId).toMatch(/^suggestion_/);

      // Should emit suggestion.generated metric
      expect(mockMetrics.hasMetric('ai.quality.suggestion.generated')).toBe(true);

      const generatedMetrics = mockMetrics.getMetric('ai.quality.suggestion.generated');
      expect(generatedMetrics).toHaveLength(1);
      expect(generatedMetrics[0].tags).toMatchObject({
        model: 'anthropic/claude-3.5-sonnet',
        language: 'typescript',
      });
    });

    it('should generate unique IDs for different suggestions', async () => {
      const id1 = await tracker.trackSuggestion({
        modelId: 'model-1',
        suggestion: 'code 1',
      });

      const id2 = await tracker.trackSuggestion({
        modelId: 'model-2',
        suggestion: 'code 2',
      });

      expect(id1).not.toBe(id2);
    });

    it('should handle suggestions without language specified', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'test code',
      });

      expect(suggestionId).toBeTruthy();

      const metrics = mockMetrics.getMetric('ai.quality.suggestion.generated');
      expect(metrics[0].tags?.language).toBe('unknown');
    });

    it('should respect sampling rate', async () => {
      const sampledTracker = createQualityTracker(mockMetrics, {
        enabled: true,
        samplingRate: 0, // Never sample
      });

      mockMetrics.reset();

      await sampledTracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'test code',
      });

      // Should not emit metrics when sampling rate is 0
      expect(mockMetrics.metrics).toHaveLength(0);
    });
  });

  describe('trackAcceptance', () => {
    it('should track acceptance with edit distance metrics', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'function add(a, b) { return a + b; }',
        language: 'typescript',
      });

      mockMetrics.reset();

      await tracker.trackAcceptance(suggestionId, {
        finalCode: 'function add(a: number, b: number): number { return a + b; }',
        timeToAccept: 5000,
      });

      // Should emit multiple metrics
      expect(mockMetrics.hasMetric('ai.quality.suggestion.accepted')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.suggestion.time_to_accept')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.suggestion.edit_distance')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.suggestion.similarity')).toBe(true);

      // Check metric values
      const acceptedMetric = mockMetrics.getMetric('ai.quality.suggestion.accepted')[0];
      expect(acceptedMetric.value).toBe(1);
      expect(acceptedMetric.tags).toMatchObject({
        model: 'test-model',
        language: 'typescript',
        modified: true,
      });

      const timeMetric = mockMetrics.getMetric('ai.quality.suggestion.time_to_accept')[0];
      expect(timeMetric.value).toBe(5000);

      const distanceMetric = mockMetrics.getMetric('ai.quality.suggestion.edit_distance')[0];
      expect(distanceMetric.value).toBeGreaterThan(0); // Code was modified

      const similarityMetric = mockMetrics.getMetric('ai.quality.suggestion.similarity')[0];
      expect(similarityMetric.value).toBeGreaterThan(0);
      expect(similarityMetric.value).toBeLessThanOrEqual(1);
    });

    it('should track acceptance of unmodified code', async () => {
      const originalCode = 'console.log("hello");';

      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: originalCode,
      });

      mockMetrics.reset();

      await tracker.trackAcceptance(suggestionId, {
        finalCode: originalCode,
        timeToAccept: 1000,
      });

      const distanceMetric = mockMetrics.getMetric('ai.quality.suggestion.edit_distance')[0];
      expect(distanceMetric.value).toBe(0); // No edits

      const similarityMetric = mockMetrics.getMetric('ai.quality.suggestion.similarity')[0];
      expect(similarityMetric.value).toBe(1); // Identical
    });

    it('should handle unknown suggestion ID gracefully', async () => {
      mockMetrics.reset();

      await tracker.trackAcceptance('unknown-id', {
        finalCode: 'test',
        timeToAccept: 1000,
      });

      // Should not emit any metrics for unknown suggestion
      expect(mockMetrics.metrics).toHaveLength(0);
    });

    it('should include change magnitude in tags', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'hello',
      });

      mockMetrics.reset();

      await tracker.trackAcceptance(suggestionId, {
        finalCode: 'hello world',
        timeToAccept: 1000,
      });

      const acceptedMetric = mockMetrics.getMetric('ai.quality.suggestion.accepted')[0];
      expect(acceptedMetric.tags).toHaveProperty('change_magnitude');
    });
  });

  describe('trackRejection', () => {
    it('should track rejection with reason', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'bad code',
        language: 'python',
      });

      mockMetrics.reset();

      await tracker.trackRejection(suggestionId, {
        timeToReject: 2000,
        reason: 'incorrect',
      });

      expect(mockMetrics.hasMetric('ai.quality.suggestion.rejected')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.suggestion.time_to_reject')).toBe(true);

      const rejectedMetric = mockMetrics.getMetric('ai.quality.suggestion.rejected')[0];
      expect(rejectedMetric.value).toBe(1);
      expect(rejectedMetric.tags).toMatchObject({
        model: 'test-model',
        language: 'python',
        reason: 'incorrect',
      });

      const timeMetric = mockMetrics.getMetric('ai.quality.suggestion.time_to_reject')[0];
      expect(timeMetric.value).toBe(2000);
    });

    it('should handle rejection without reason', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'test',
      });

      mockMetrics.reset();

      await tracker.trackRejection(suggestionId, {
        timeToReject: 1000,
      });

      const rejectedMetric = mockMetrics.getMetric('ai.quality.suggestion.rejected')[0];
      expect(rejectedMetric.tags?.reason).toBe('unknown');
    });

    it('should handle unknown suggestion ID gracefully', async () => {
      mockMetrics.reset();

      await tracker.trackRejection('unknown-id', {
        timeToReject: 1000,
      });

      expect(mockMetrics.metrics).toHaveLength(0);
    });
  });

  describe('trackRating', () => {
    it('should track user rating', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'great code',
      });

      mockMetrics.reset();

      await tracker.trackRating(suggestionId, {
        rating: 5,
        userId: 'user-123',
        comment: 'Perfect!',
      });

      expect(mockMetrics.hasMetric('ai.quality.suggestion.rated')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.suggestion.rating')).toBe(true);

      const ratedMetric = mockMetrics.getMetric('ai.quality.suggestion.rated')[0];
      expect(ratedMetric.value).toBe(1);

      const ratingMetric = mockMetrics.getMetric('ai.quality.suggestion.rating')[0];
      expect(ratingMetric.value).toBe(5);
      expect(ratingMetric.tags?.rating).toBe(5);
    });

    it('should handle different rating values', async () => {
      for (const rating of [1, 2, 3, 4, 5] as const) {
        mockMetrics.reset();

        const suggestionId = await tracker.trackSuggestion({
          modelId: 'test-model',
          suggestion: 'test',
        });

        await tracker.trackRating(suggestionId, {
          rating,
          userId: 'user-123',
        });

        const ratingMetric = mockMetrics.getMetric('ai.quality.suggestion.rating')[0];
        expect(ratingMetric.value).toBe(rating);
      }
    });
  });

  describe('trackQualityMetrics', () => {
    it('should track quality dimension metrics', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'test code',
      });

      mockMetrics.reset();

      const qualityMetrics: QualityMetrics = {
        relevance: 0.9,
        completeness: 0.85,
        accuracy: 0.95,
        coherence: 0.88,
      };

      await tracker.trackQualityMetrics(suggestionId, qualityMetrics);

      // Should emit metrics for each dimension
      expect(mockMetrics.hasMetric('ai.quality.quality.relevance')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.quality.completeness')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.quality.accuracy')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.quality.coherence')).toBe(true);
      expect(mockMetrics.hasMetric('ai.quality.quality.overall')).toBe(true);

      // Check values
      expect(mockMetrics.getMetric('ai.quality.quality.relevance')[0].value).toBe(0.9);
      expect(mockMetrics.getMetric('ai.quality.quality.completeness')[0].value).toBe(0.85);
      expect(mockMetrics.getMetric('ai.quality.quality.accuracy')[0].value).toBe(0.95);
      expect(mockMetrics.getMetric('ai.quality.quality.coherence')[0].value).toBe(0.88);

      // Check overall score (average of dimensions)
      const overallMetric = mockMetrics.getMetric('ai.quality.quality.overall')[0];
      const expectedOverall = (0.9 + 0.85 + 0.95 + 0.88) / 4;
      expect(overallMetric.value).toBeCloseTo(expectedOverall, 5);
    });
  });

  describe('configuration', () => {
    it('should respect enabled config', async () => {
      const disabledTracker = createQualityTracker(mockMetrics, { enabled: false });

      mockMetrics.reset();

      await disabledTracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'test',
      });

      // Should not emit any metrics when disabled
      expect(mockMetrics.metrics).toHaveLength(0);
    });

    it('should use default config values', () => {
      const defaultTracker = createQualityTracker(mockMetrics);
      expect(defaultTracker).toBeTruthy();
    });
  });

  describe('singleton pattern', () => {
    beforeEach(() => {
      resetQualityTracker();
    });

    it('should return the same instance on multiple calls', () => {
      const tracker1 = getQualityTracker();
      const tracker2 = getQualityTracker();

      expect(tracker1).toBe(tracker2);
    });

    it('should reset global tracker', () => {
      const tracker1 = getQualityTracker();
      resetQualityTracker();
      const tracker2 = getQualityTracker();

      expect(tracker1).not.toBe(tracker2);
    });
  });

  describe('lifecycle', () => {
    it('should flush metrics', async () => {
      const flushSpy = jest.spyOn(mockMetrics, 'flush');

      await tracker.flush();

      expect(flushSpy).toHaveBeenCalled();
    });

    it('should shutdown and clean up', async () => {
      const shutdownSpy = jest.spyOn(mockMetrics, 'shutdown');

      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'test',
      });

      await tracker.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();

      // After shutdown, tracking acceptance should not find the suggestion
      mockMetrics.reset();
      await tracker.trackAcceptance(suggestionId, {
        finalCode: 'test',
        timeToAccept: 1000,
      });

      expect(mockMetrics.metrics).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty suggestion text', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: '',
      });

      expect(suggestionId).toBeTruthy();
    });

    it('should handle very long suggestion text', async () => {
      const longCode = 'a'.repeat(10000);

      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: longCode,
      });

      mockMetrics.reset();

      await tracker.trackAcceptance(suggestionId, {
        finalCode: longCode + 'b',
        timeToAccept: 1000,
      });

      expect(mockMetrics.hasMetric('ai.quality.suggestion.accepted')).toBe(true);
    });

    it('should handle special characters in code', async () => {
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'test-model',
        suggestion: 'function test() { return "\\n\\t"; }',
      });

      await tracker.trackAcceptance(suggestionId, {
        finalCode: 'function test() { return "\\n\\t\\r"; }',
        timeToAccept: 1000,
      });

      expect(mockMetrics.hasMetric('ai.quality.suggestion.accepted')).toBe(true);
    });
  });
});
