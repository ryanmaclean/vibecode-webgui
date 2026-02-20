/**
 * Tests for Quality Report Generator
 */

import {
  QualityReportGenerator,
  createQualityReportGenerator,
  getQualityReportGenerator,
  resetQualityReportGenerator,
} from '../quality-reports';
import type { PrismaClient } from '@prisma/client';
import type { QualityReport, QualityComparison } from '@/types/ai-quality-metrics';

// =============================================================================
// Mock Prisma Client
// =============================================================================

interface MockSuggestion {
  id: string;
  modelId: string;
  suggestion: string;
  timestamp: Date;
  events: Array<{
    id: string;
    eventType: string;
    editDistance: number | null;
    similarity: number | null;
    timeToEvent: number | null;
  }>;
  ratings: Array<{
    id: string;
    rating: number;
  }>;
}

interface MockQualityMetric {
  id: string;
  modelId: string;
  score: number;
  relevance: number;
  completeness: number;
  accuracy: number;
  coherence: number;
  method: string;
  timestamp: Date;
}

class MockPrismaClient {
  private suggestions: MockSuggestion[] = [];
  private qualityMetrics: MockQualityMetric[] = [];

  aISuggestion = {
    findMany: jest.fn(async (params: any) => {
      let filtered = this.suggestions;

      // Apply where filters
      if (params?.where) {
        if (params.where.timestamp) {
          if (params.where.timestamp.gte) {
            filtered = filtered.filter(s => s.timestamp >= params.where.timestamp.gte);
          }
          if (params.where.timestamp.lte) {
            filtered = filtered.filter(s => s.timestamp <= params.where.timestamp.lte);
          }
        }
        if (params.where.modelId?.in) {
          filtered = filtered.filter(s => params.where.modelId.in.includes(s.modelId));
        }
      }

      return filtered;
    }),
  };

  aIQualityMetric = {
    findMany: jest.fn(async (params: any) => {
      let filtered = this.qualityMetrics;

      // Apply where filters
      if (params?.where) {
        if (params.where.timestamp) {
          if (params.where.timestamp.gte) {
            filtered = filtered.filter(m => m.timestamp >= params.where.timestamp.gte);
          }
          if (params.where.timestamp.lte) {
            filtered = filtered.filter(m => m.timestamp <= params.where.timestamp.lte);
          }
        }
        if (params.where.modelId?.in) {
          filtered = filtered.filter(m => params.where.modelId.in.includes(m.modelId));
        }
      }

      return filtered;
    }),
  };

  // Helper methods for tests
  addSuggestion(suggestion: MockSuggestion): void {
    this.suggestions.push(suggestion);
  }

  addQualityMetric(metric: MockQualityMetric): void {
    this.qualityMetrics.push(metric);
  }

  reset(): void {
    this.suggestions = [];
    this.qualityMetrics = [];
  }
}

// =============================================================================
// Test Data Helpers
// =============================================================================

function createMockSuggestion(
  modelId: string,
  timestamp: Date,
  accepted: boolean = true,
  editDistance: number = 10,
  similarity: number = 0.95
): MockSuggestion {
  return {
    id: `suggestion_${Math.random().toString(36).substring(2, 11)}`,
    modelId,
    suggestion: 'function test() { return true; }',
    timestamp,
    events: accepted
      ? [
          {
            id: `event_${Math.random().toString(36).substring(2, 11)}`,
            eventType: 'accepted',
            editDistance,
            similarity,
            timeToEvent: 5000,
          },
        ]
      : [
          {
            id: `event_${Math.random().toString(36).substring(2, 11)}`,
            eventType: 'rejected',
            editDistance: null,
            similarity: null,
            timeToEvent: 2000,
          },
        ],
    ratings: [],
  };
}

function createMockQualityMetric(
  modelId: string,
  timestamp: Date,
  score: number,
  method: string = 'heuristic'
): MockQualityMetric {
  return {
    id: `metric_${Math.random().toString(36).substring(2, 11)}`,
    modelId,
    score,
    relevance: score,
    completeness: score,
    accuracy: score,
    coherence: score,
    method,
    timestamp,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('QualityReportGenerator', () => {
  let mockPrisma: MockPrismaClient;
  let generator: QualityReportGenerator;

  beforeEach(() => {
    mockPrisma = new MockPrismaClient();
    generator = createQualityReportGenerator(mockPrisma as unknown as PrismaClient);
  });

  afterEach(() => {
    mockPrisma.reset();
    resetQualityReportGenerator();
  });

  describe('generateReport', () => {
    it('should generate a basic quality report', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add test data
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.85));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.75));

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        },
        includeDetails: false,
        includeCharts: false,
      });

      expect(report).toBeDefined();
      expect(report.id).toMatch(/^report_/);
      expect(report.format).toBe('json');
      expect(report.overallStatistics.totalEvaluations).toBe(3);
      expect(report.modelStatistics).toHaveProperty('model-a');
      expect(report.modelStatistics).toHaveProperty('model-b');
      expect(report.rankings.rankings.length).toBe(2);
    });

    it('should filter by model IDs', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.75));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-c', now, 0.8));

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        },
        modelIds: ['model-a', 'model-b'],
        includeDetails: false,
        includeCharts: false,
      });

      expect(report.overallStatistics.totalEvaluations).toBe(2);
      expect(report.modelStatistics).toHaveProperty('model-a');
      expect(report.modelStatistics).toHaveProperty('model-b');
      expect(report.modelStatistics).not.toHaveProperty('model-c');
    });

    it('should calculate correct statistics', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add metrics with known values
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.7));

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        },
        modelIds: ['model-a'],
        includeDetails: false,
        includeCharts: false,
      });

      const stats = report.modelStatistics['model-a'];
      expect(stats.totalEvaluations).toBe(3);
      expect(stats.averageScore).toBeCloseTo(0.8, 2);
      expect(stats.minScore).toBe(0.7);
      expect(stats.maxScore).toBe(0.9);
      expect(stats.medianScore).toBe(0.8);
    });

    it('should calculate score distribution', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add metrics in different quality bands
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.95)); // excellent
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.85)); // good
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.65)); // fair
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.45)); // poor

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        },
        modelIds: ['model-a'],
        includeDetails: false,
        includeCharts: false,
      });

      const stats = report.modelStatistics['model-a'];
      expect(stats.distribution.excellent).toBe(1);
      expect(stats.distribution.good).toBe(1);
      expect(stats.distribution.fair).toBe(1);
      expect(stats.distribution.poor).toBe(1);
    });

    it('should rank models correctly', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add metrics for multiple models
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-c', now, 0.7));

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        },
        includeDetails: false,
        includeCharts: false,
      });

      const rankings = report.rankings.rankings;
      expect(rankings.length).toBe(3);
      expect(rankings[0].modelId).toBe('model-a');
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].modelId).toBe('model-b');
      expect(rankings[1].rank).toBe(2);
      expect(rankings[2].modelId).toBe('model-c');
      expect(rankings[2].rank).toBe(3);
    });

    it('should include time series when requested', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Add metrics across multiple days
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoDaysAgo, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', yesterday, 0.85));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: twoDaysAgo.toISOString(),
          end: now.toISOString(),
        },
        modelIds: ['model-a'],
        includeDetails: false,
        includeCharts: true,
      });

      expect(report.timeSeries).toBeDefined();
      expect(report.timeSeries!['model-a']).toBeDefined();
      expect(report.timeSeries!['model-a'].dataPoints.length).toBeGreaterThan(0);
      expect(report.timeSeries!['model-a'].trend).toBe('improving');
    });

    it('should handle empty data gracefully', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        },
        includeDetails: false,
        includeCharts: false,
      });

      expect(report).toBeDefined();
      expect(report.overallStatistics.totalEvaluations).toBe(0);
      expect(report.overallStatistics.averageScore).toBe(0);
      expect(Object.keys(report.modelStatistics).length).toBe(0);
    });
  });

  describe('generateComparison', () => {
    it('should compare two models', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add metrics for two models
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.85));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.75));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.7));

      const comparison = await generator.generateComparison('model-b', 'model-a', {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(comparison).toBeDefined();
      expect(comparison.baselineModelId).toBe('model-b');
      expect(comparison.comparisonModelId).toBe('model-a');
      expect(comparison.comparisonScore).toBeGreaterThan(comparison.baselineScore);
      expect(comparison.improvement).toBeGreaterThan(0);
    });

    it('should calculate improvement percentage', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Baseline: 0.5, Comparison: 0.75 = 50% improvement
      mockPrisma.addQualityMetric(createMockQualityMetric('baseline', now, 0.5));
      mockPrisma.addQualityMetric(createMockQualityMetric('comparison', now, 0.75));

      const comparison = await generator.generateComparison('baseline', 'comparison', {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(comparison.improvement).toBeCloseTo(50, 0);
    });

    it('should provide metric-by-metric comparison', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.9));

      const comparison = await generator.generateComparison('model-a', 'model-b', {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(comparison.metricComparison).toBeDefined();
      expect(comparison.metricComparison.relevance).toBeCloseTo(0.1, 1);
      expect(comparison.metricComparison.completeness).toBeCloseTo(0.1, 1);
      expect(comparison.metricComparison.accuracy).toBeCloseTo(0.1, 1);
      expect(comparison.metricComparison.coherence).toBeCloseTo(0.1, 1);
    });

    it('should detect statistical significance with large sample', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add 50+ samples to ensure significance can be calculated
      for (let i = 0; i < 50; i++) {
        mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
        mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.5));
      }

      const comparison = await generator.generateComparison('model-b', 'model-a', {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(comparison.sampleSize).toBe(50);
      expect(comparison.significanceLevel).toBeLessThan(0.05);
      expect(comparison.isSignificant).toBe(true);
    });

    it('should not detect significance with small sample', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Small sample size
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.5));

      const comparison = await generator.generateComparison('model-b', 'model-a', {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(comparison.sampleSize).toBe(1);
      expect(comparison.isSignificant).toBe(false);
    });
  });

  describe('getWeeklyReport', () => {
    it('should generate a weekly report', async () => {
      const now = new Date();
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));

      const report = await generator.getWeeklyReport();

      expect(report).toBeDefined();
      expect(report.format).toBe('json');
      expect(report.timeSeries).toBeDefined(); // Charts are included via timeSeries

      // Verify time period is approximately one week
      const start = new Date(report.timePeriod.start);
      const end = new Date(report.timePeriod.end);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it('should filter by model IDs in weekly report', async () => {
      const now = new Date();
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.8));

      const report = await generator.getWeeklyReport(['model-a']);

      expect(report.modelStatistics).toHaveProperty('model-a');
      expect(report.modelStatistics).not.toHaveProperty('model-b');
    });
  });

  describe('singleton instances', () => {
    it('should return same instance from getQualityReportGenerator', () => {
      resetQualityReportGenerator();

      const gen1 = getQualityReportGenerator(mockPrisma as unknown as PrismaClient);
      const gen2 = getQualityReportGenerator(mockPrisma as unknown as PrismaClient);

      expect(gen1).toBe(gen2);
    });

    it('should create new instance from createQualityReportGenerator', () => {
      const gen1 = createQualityReportGenerator(mockPrisma as unknown as PrismaClient);
      const gen2 = createQualityReportGenerator(mockPrisma as unknown as PrismaClient);

      expect(gen1).not.toBe(gen2);
    });

    it('should reset global instance', () => {
      resetQualityReportGenerator();

      const gen1 = getQualityReportGenerator(mockPrisma as unknown as PrismaClient);
      resetQualityReportGenerator();
      const gen2 = getQualityReportGenerator(mockPrisma as unknown as PrismaClient);

      expect(gen1).not.toBe(gen2);
    });
  });

  describe('weekly aggregation', () => {
    it('should aggregate metrics by week', async () => {
      const now = new Date('2024-02-15T12:00:00Z'); // Thursday
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Add metrics across three weeks
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoWeeksAgo, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', weekAgo, 0.85));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));

      const aggregations = await generator.getWeeklyAggregation({
        start: twoWeeksAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(aggregations.length).toBeGreaterThan(0);
      expect(aggregations[0]).toHaveProperty('weekStart');
      expect(aggregations[0]).toHaveProperty('weekEnd');
      expect(aggregations[0]).toHaveProperty('averageScore');
      expect(aggregations[0]).toHaveProperty('sampleCount');
    });

    it('should calculate weekly statistics correctly', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add multiple metrics in the same week
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.7));

      const aggregations = await generator.getWeeklyAggregation({
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(aggregations.length).toBe(1);
      expect(aggregations[0].sampleCount).toBe(3);
      expect(aggregations[0].averageScore).toBeCloseTo(0.8, 2);
      expect(aggregations[0].minScore).toBe(0.7);
      expect(aggregations[0].maxScore).toBe(0.9);
      expect(aggregations[0].medianScore).toBe(0.8);
    });

    it('should group metrics by model and week', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add metrics for two models
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', weekAgo, 0.85));

      const aggregations = await generator.getWeeklyAggregation({
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      const modelAWeeks = aggregations.filter(a => a.modelId === 'model-a');
      const modelBWeeks = aggregations.filter(a => a.modelId === 'model-b');

      expect(modelAWeeks.length).toBeGreaterThan(0);
      expect(modelBWeeks.length).toBeGreaterThan(0);
    });

    it('should calculate distribution for weekly aggregation', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Add metrics in different quality bands
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.95)); // excellent
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.85)); // good
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.65)); // fair
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.45)); // poor

      const aggregations = await generator.getWeeklyAggregation({
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(aggregations.length).toBe(1);
      expect(aggregations[0].distribution.excellent).toBe(1);
      expect(aggregations[0].distribution.good).toBe(1);
      expect(aggregations[0].distribution.fair).toBe(1);
      expect(aggregations[0].distribution.poor).toBe(1);
    });

    it('should handle empty data for weekly aggregation', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const aggregations = await generator.getWeeklyAggregation({
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(aggregations).toEqual([]);
    });

    it('should filter by model IDs in weekly aggregation', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-c', now, 0.7));

      const aggregations = await generator.getWeeklyAggregation(
        {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        },
        ['model-a', 'model-b']
      );

      const modelIds = new Set(aggregations.map(a => a.modelId));
      expect(modelIds.has('model-a')).toBe(true);
      expect(modelIds.has('model-b')).toBe(true);
      expect(modelIds.has('model-c')).toBe(false);
    });
  });

  describe('week-over-week trend analysis', () => {
    it('should analyze week-over-week trends', async () => {
      const now = new Date('2024-02-15T12:00:00Z'); // Thursday
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Add improving trend
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoWeeksAgo, 0.7));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', weekAgo, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));

      const trends = await generator.analyzeWeekOverWeekTrends({
        start: twoWeeksAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]).toHaveProperty('currentWeek');
      expect(trends[0]).toHaveProperty('previousWeek');
      expect(trends[0]).toHaveProperty('scoreChange');
      expect(trends[0]).toHaveProperty('percentageChange');
      expect(trends[0]).toHaveProperty('direction');
    });

    it('should detect improving trend', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Previous week: 0.5, Current week: 0.8 = 60% improvement
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoWeeksAgo, 0.5));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.8));

      const trends = await generator.analyzeWeekOverWeekTrends({
        start: twoWeeksAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(trends.length).toBe(1);
      expect(trends[0].direction).toBe('improving');
      expect(trends[0].scoreChange).toBeGreaterThan(0);
      expect(trends[0].percentageChange).toBeGreaterThan(0);
    });

    it('should detect declining trend', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Previous week: 0.9, Current week: 0.6 = decline
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoWeeksAgo, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.6));

      const trends = await generator.analyzeWeekOverWeekTrends({
        start: twoWeeksAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(trends.length).toBe(1);
      expect(trends[0].direction).toBe('declining');
      expect(trends[0].scoreChange).toBeLessThan(0);
      expect(trends[0].percentageChange).toBeLessThan(0);
    });

    it('should detect stable trend', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Stable at 0.8 (within 2% threshold)
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoWeeksAgo, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.81));

      const trends = await generator.analyzeWeekOverWeekTrends({
        start: twoWeeksAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(trends.length).toBe(1);
      expect(trends[0].direction).toBe('stable');
    });

    it('should track sample size changes', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Previous week: 1 sample, Current week: 3 samples
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoWeeksAgo, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.85));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));

      const trends = await generator.analyzeWeekOverWeekTrends({
        start: twoWeeksAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(trends.length).toBe(1);
      expect(trends[0].sampleSizeChange).toBeGreaterThan(0);
      expect(trends[0].currentWeek.sampleCount).toBeGreaterThan(
        trends[0].previousWeek.sampleCount
      );
    });

    it('should handle multiple models in trend analysis', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Model A improving, Model B declining
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoWeeksAgo, 0.7));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', twoWeeksAgo, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.7));

      const trends = await generator.analyzeWeekOverWeekTrends({
        start: twoWeeksAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(trends.length).toBe(2);

      const modelATrend = trends.find(t => t.modelId === 'model-a');
      const modelBTrend = trends.find(t => t.modelId === 'model-b');

      expect(modelATrend?.direction).toBe('improving');
      expect(modelBTrend?.direction).toBe('declining');
    });

    it('should handle insufficient data for trend analysis', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Only one week of data
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.8));

      const trends = await generator.analyzeWeekOverWeekTrends({
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      });

      expect(trends).toEqual([]);
    });

    it('should filter by model IDs in trend analysis', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoWeeksAgo, 0.7));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', now, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', twoWeeksAgo, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-b', now, 0.85));

      const trends = await generator.analyzeWeekOverWeekTrends(
        {
          start: twoWeeksAgo.toISOString(),
          end: now.toISOString(),
        },
        ['model-a']
      );

      expect(trends.length).toBe(1);
      expect(trends[0].modelId).toBe('model-a');
    });
  });

  describe('edge cases', () => {
    it('should handle models with no quality metrics but with suggestions', async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      mockPrisma.addSuggestion(createMockSuggestion('model-a', now, true));

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        },
        includeDetails: false,
        includeCharts: false,
      });

      // Should handle gracefully even with no quality metrics
      expect(report).toBeDefined();
      expect(report.modelStatistics['model-a']).toBeDefined();
      expect(report.modelStatistics['model-a'].totalEvaluations).toBe(0);
    });

    it('should handle declining trend correctly', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Declining scores
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', threeDaysAgo, 0.9));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoDaysAgo, 0.7));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', yesterday, 0.5));

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: threeDaysAgo.toISOString(),
          end: now.toISOString(),
        },
        modelIds: ['model-a'],
        includeDetails: false,
        includeCharts: true,
      });

      expect(report.timeSeries).toBeDefined();
      expect(report.timeSeries!['model-a'].trend).toBe('declining');
      expect(report.timeSeries!['model-a'].percentageChange).toBeLessThan(0);
    });

    it('should handle stable trend correctly', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Stable scores
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', threeDaysAgo, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', twoDaysAgo, 0.8));
      mockPrisma.addQualityMetric(createMockQualityMetric('model-a', yesterday, 0.8));

      const report = await generator.generateReport({
        format: 'json',
        timePeriod: {
          start: threeDaysAgo.toISOString(),
          end: now.toISOString(),
        },
        modelIds: ['model-a'],
        includeDetails: false,
        includeCharts: true,
      });

      expect(report.timeSeries).toBeDefined();
      expect(report.timeSeries!['model-a'].trend).toBe('stable');
    });
  });
});
