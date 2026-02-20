/**
 * End-to-End Integration Tests for AI Quality Metrics Tracking
 *
 * Tests the complete quality tracking lifecycle:
 * - Suggestion tracking
 * - Acceptance/rejection events with edit distance
 * - User ratings (thumbs up/down)
 * - Quality metrics calculation
 * - Report generation and aggregation
 *
 * Validates business logic, database operations, and metrics aggregation.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { QualityTracker, createQualityTracker, type SuggestionData } from '@/lib/ai/quality-tracker';
import { QualityReportGenerator, createQualityReportGenerator } from '@/lib/ai/quality-reports';
import { calculateCodeEditDistance } from '@/lib/ai/edit-distance';
import type { IMetricsProvider } from '@/lib/monitoring/metrics-provider';

// Mock Prisma Client
jest.mock('@prisma/client');

const prisma = new PrismaClient();

// Skip tests if PostgreSQL is not available (set by jest.globalSetup.js)
const SKIP_E2E = process.env.SKIP_POSTGRES_TESTS === '1';
const describeIf = SKIP_E2E ? describe.skip : describe;

// =============================================================================
// Mock Metrics Provider
// =============================================================================

class MockMetricsProvider implements IMetricsProvider {
  private metrics: Array<{ name: string; value: number; tags?: any }> = [];

  increment(name: string, value: number = 1, options?: { tags?: any }): void {
    this.metrics.push({ name, value, tags: options?.tags });
  }

  gauge(name: string, value: number, options?: { tags?: any }): void {
    this.metrics.push({ name, value, tags: options?.tags });
  }

  timing(name: string, value: number, options?: { tags?: any }): void {
    this.metrics.push({ name, value, tags: options?.tags });
  }

  histogram(name: string, value: number, options?: { tags?: any }): void {
    this.metrics.push({ name, value, tags: options?.tags });
  }

  distribution(name: string, value: number, options?: { tags?: any }): void {
    this.metrics.push({ name, value, tags: options?.tags });
  }

  async flush(): Promise<void> {
    // No-op for tests
  }

  async shutdown(): Promise<void> {
    this.metrics = [];
  }

  getMetrics() {
    return this.metrics;
  }

  clearMetrics() {
    this.metrics = [];
  }
}

// =============================================================================
// Test Database Setup
// =============================================================================

let testUserId: number;
let testWorkspaceId: number;
let testProjectId: number;

async function setupTestData() {
  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'test-ai-quality@example.com',
      username: 'test-ai-quality-user',
      password_hash: 'test-hash',
      role: 'user',
    },
  });
  testUserId = user.id;

  // Create test workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Test AI Quality Workspace',
      owner_id: testUserId,
    },
  });
  testWorkspaceId = workspace.id;

  // Create test project
  const project = await prisma.project.create({
    data: {
      name: 'Test AI Quality Project',
      workspace_id: testWorkspaceId,
      owner_id: testUserId,
    },
  });
  testProjectId = project.id;
}

async function cleanupTestData() {
  // Clean up in reverse order of creation
  await prisma.aIQualityMetric.deleteMany({});
  await prisma.aIQualityRating.deleteMany({});
  await prisma.aISuggestionEvent.deleteMany({});
  await prisma.aISuggestion.deleteMany({});
  await prisma.project.deleteMany({ where: { id: testProjectId } });
  await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
}

// =============================================================================
// Helper Functions for Quality Tracking
// =============================================================================

async function trackSuggestion(data: {
  suggestionId: string;
  modelId: string;
  content: string;
  language?: string;
  userId?: number;
  workspaceId?: number;
  projectId?: number;
}) {
  try {
    const suggestion = await prisma.aISuggestion.create({
      data: {
        suggestion_id: data.suggestionId,
        model_id: data.modelId,
        provider: data.modelId.split('/')[0] || 'unknown',
        content: data.content,
        language: data.language,
        user_id: data.userId || testUserId,
        workspace_id: data.workspaceId || testWorkspaceId,
        project_id: data.projectId || testProjectId,
      },
    });

    return {
      success: true,
      suggestion,
      status: 201,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track suggestion',
      status: 500,
    };
  }
}

async function trackAcceptance(data: {
  suggestionId: string;
  originalCode: string;
  finalCode: string;
  timeToAccept: number;
  userId?: number;
}) {
  try {
    const suggestion = await prisma.aISuggestion.findUnique({
      where: { suggestion_id: data.suggestionId },
    });

    if (!suggestion) {
      return {
        success: false,
        error: 'Suggestion not found',
        status: 404,
      };
    }

    // Calculate edit distance
    const editMetrics = calculateCodeEditDistance(data.originalCode, data.finalCode);

    const event = await prisma.aISuggestionEvent.create({
      data: {
        suggestion_id: suggestion.id,
        user_id: data.userId || testUserId,
        event_type: 'accepted',
        original_code: data.originalCode,
        final_code: data.finalCode,
        edit_distance: editMetrics.distance,
        similarity_score: editMetrics.similarity,
        time_to_accept_ms: data.timeToAccept,
        time_to_decision_ms: data.timeToAccept,
      },
    });

    return {
      success: true,
      event,
      editMetrics,
      status: 201,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track acceptance',
      status: 500,
    };
  }
}

async function trackRejection(data: {
  suggestionId: string;
  timeToReject: number;
  userId?: number;
  metadata?: any;
}) {
  try {
    const suggestion = await prisma.aISuggestion.findUnique({
      where: { suggestion_id: data.suggestionId },
    });

    if (!suggestion) {
      return {
        success: false,
        error: 'Suggestion not found',
        status: 404,
      };
    }

    const event = await prisma.aISuggestionEvent.create({
      data: {
        suggestion_id: suggestion.id,
        user_id: data.userId || testUserId,
        event_type: 'rejected',
        time_to_decision_ms: data.timeToReject,
        metadata: data.metadata,
      },
    });

    return {
      success: true,
      event,
      status: 201,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track rejection',
      status: 500,
    };
  }
}

async function submitRating(data: {
  suggestionId: string;
  rating: 'up' | 'down';
  comment?: string;
  userId?: number;
}) {
  try {
    const suggestion = await prisma.aISuggestion.findUnique({
      where: { suggestion_id: data.suggestionId },
    });

    if (!suggestion) {
      return {
        success: false,
        error: 'Suggestion not found',
        status: 404,
      };
    }

    const ratingValue = data.rating === 'up' ? 5 : 1;

    const rating = await prisma.aIQualityRating.create({
      data: {
        suggestion_id: suggestion.id,
        user_id: data.userId || testUserId,
        rating: data.rating,
        rating_value: ratingValue,
        comment: data.comment,
      },
    });

    return {
      success: true,
      rating,
      status: 201,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit rating',
      status: 500,
    };
  }
}

async function submitQualityMetrics(data: {
  suggestionId: string;
  modelId: string;
  overallScore: number;
  relevance?: number;
  completeness?: number;
  accuracy?: number;
  coherence?: number;
  method?: string;
}) {
  try {
    const suggestion = await prisma.aISuggestion.findUnique({
      where: { suggestion_id: data.suggestionId },
    });

    if (!suggestion) {
      return {
        success: false,
        error: 'Suggestion not found',
        status: 404,
      };
    }

    const metric = await prisma.aIQualityMetric.create({
      data: {
        suggestion_id: suggestion.id,
        model_id: data.modelId,
        overall_score: data.overallScore,
        relevance: data.relevance,
        completeness: data.completeness,
        accuracy: data.accuracy,
        coherence: data.coherence,
        evaluation_method: data.method || 'heuristic',
      },
    });

    return {
      success: true,
      metric,
      status: 201,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit quality metrics',
      status: 500,
    };
  }
}

// =============================================================================
// Integration Tests
// =============================================================================

describeIf('AI Quality Tracking - End-to-End', () => {
  beforeAll(async () => {
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up AI tracking data between tests
    await prisma.aIQualityMetric.deleteMany({});
    await prisma.aIQualityRating.deleteMany({});
    await prisma.aISuggestionEvent.deleteMany({});
    await prisma.aISuggestion.deleteMany({});
  });

  describe('Complete Tracking Flow', () => {
    test('Track suggestion → Accept with edits → Submit rating → Generate report', async () => {
      const modelId = 'anthropic/claude-3.5-sonnet';
      const suggestionId = 'test-suggestion-001';
      const originalCode = 'function add(a, b) { return a + b; }';
      const finalCode = 'function add(a: number, b: number): number { return a + b; }';

      // Step 1: Track suggestion
      const trackResult = await trackSuggestion({
        suggestionId,
        modelId,
        content: originalCode,
        language: 'typescript',
      });

      expect(trackResult.success).toBe(true);
      expect(trackResult.suggestion).toBeDefined();
      expect(trackResult.suggestion?.suggestion_id).toBe(suggestionId);
      expect(trackResult.suggestion?.model_id).toBe(modelId);

      // Step 2: Track acceptance with edit distance
      const acceptResult = await trackAcceptance({
        suggestionId,
        originalCode,
        finalCode,
        timeToAccept: 5000, // 5 seconds
      });

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.event).toBeDefined();
      expect(acceptResult.event?.event_type).toBe('accepted');
      expect(acceptResult.editMetrics?.distance).toBeGreaterThan(0);
      expect(acceptResult.editMetrics?.similarity).toBeGreaterThan(0.5); // Should be similar

      // Step 3: Submit user rating
      const ratingResult = await submitRating({
        suggestionId,
        rating: 'up',
        comment: 'Great suggestion, just needed type annotations',
      });

      expect(ratingResult.success).toBe(true);
      expect(ratingResult.rating).toBeDefined();
      expect(ratingResult.rating?.rating).toBe('up');
      expect(ratingResult.rating?.rating_value).toBe(5);

      // Step 4: Submit quality metrics
      const metricsResult = await submitQualityMetrics({
        suggestionId,
        modelId,
        overallScore: 0.85,
        relevance: 0.9,
        completeness: 0.8,
        accuracy: 0.85,
        coherence: 0.85,
        method: 'heuristic',
      });

      expect(metricsResult.success).toBe(true);
      expect(metricsResult.metric).toBeDefined();
      expect(metricsResult.metric?.overall_score).toBe(0.85);

      // Step 5: Generate quality report
      const reportGenerator = createQualityReportGenerator(prisma);
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const report = await reportGenerator.generateReport({
        timePeriod: {
          start: hourAgo.toISOString(),
          end: now.toISOString(),
        },
        modelIds: [modelId],
        includeDetails: true,
        includeCharts: true,
      });

      // Verify report structure
      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.title).toContain('AI Quality Report');
      expect(report.modelStatistics).toBeDefined();
      expect(report.modelStatistics[modelId]).toBeDefined();

      // Verify statistics
      const modelStats = report.modelStatistics[modelId];
      expect(modelStats.totalEvaluations).toBe(1);
      expect(modelStats.averageScore).toBe(0.85);
      expect(modelStats.averageMetrics.relevance).toBe(0.9);
      expect(modelStats.averageMetrics.completeness).toBe(0.8);
      expect(modelStats.averageMetrics.accuracy).toBe(0.85);
      expect(modelStats.averageMetrics.coherence).toBe(0.85);

      // Verify rankings
      expect(report.rankings).toBeDefined();
      expect(report.rankings.rankings.length).toBeGreaterThan(0);
      expect(report.rankings.rankings[0].modelId).toBe(modelId);
      expect(report.rankings.rankings[0].rank).toBe(1);
    });

    test('Track multiple suggestions with different outcomes', async () => {
      const models = {
        claude: 'anthropic/claude-3.5-sonnet',
        gpt4: 'openai/gpt-4',
        gemini: 'google/gemini-pro',
      };

      // Track 3 suggestions for Claude - 2 accepted, 1 rejected
      await trackSuggestion({
        suggestionId: 'claude-001',
        modelId: models.claude,
        content: 'const x = 1;',
        language: 'typescript',
      });
      await trackAcceptance({
        suggestionId: 'claude-001',
        originalCode: 'const x = 1;',
        finalCode: 'const x = 1;',
        timeToAccept: 2000,
      });
      await submitQualityMetrics({
        suggestionId: 'claude-001',
        modelId: models.claude,
        overallScore: 0.9,
        relevance: 0.95,
        completeness: 0.9,
        accuracy: 0.9,
        coherence: 0.85,
      });

      await trackSuggestion({
        suggestionId: 'claude-002',
        modelId: models.claude,
        content: 'function test() {}',
        language: 'typescript',
      });
      await trackAcceptance({
        suggestionId: 'claude-002',
        originalCode: 'function test() {}',
        finalCode: 'function test(): void {}',
        timeToAccept: 3000,
      });
      await submitQualityMetrics({
        suggestionId: 'claude-002',
        modelId: models.claude,
        overallScore: 0.85,
        relevance: 0.8,
        completeness: 0.85,
        accuracy: 0.9,
        coherence: 0.85,
      });

      await trackSuggestion({
        suggestionId: 'claude-003',
        modelId: models.claude,
        content: 'bad suggestion',
        language: 'typescript',
      });
      await trackRejection({
        suggestionId: 'claude-003',
        timeToReject: 1000,
      });

      // Track 2 suggestions for GPT-4 - both accepted
      await trackSuggestion({
        suggestionId: 'gpt4-001',
        modelId: models.gpt4,
        content: 'const y = 2;',
        language: 'typescript',
      });
      await trackAcceptance({
        suggestionId: 'gpt4-001',
        originalCode: 'const y = 2;',
        finalCode: 'const y = 2;',
        timeToAccept: 1500,
      });
      await submitQualityMetrics({
        suggestionId: 'gpt4-001',
        modelId: models.gpt4,
        overallScore: 0.75,
        relevance: 0.7,
        completeness: 0.75,
        accuracy: 0.8,
        coherence: 0.75,
      });

      await trackSuggestion({
        suggestionId: 'gpt4-002',
        modelId: models.gpt4,
        content: 'let z = 3;',
        language: 'typescript',
      });
      await trackAcceptance({
        suggestionId: 'gpt4-002',
        originalCode: 'let z = 3;',
        finalCode: 'const z = 3;',
        timeToAccept: 4000,
      });
      await submitQualityMetrics({
        suggestionId: 'gpt4-002',
        modelId: models.gpt4,
        overallScore: 0.7,
        relevance: 0.65,
        completeness: 0.7,
        accuracy: 0.75,
        coherence: 0.7,
      });

      // Generate comparison report
      const reportGenerator = createQualityReportGenerator(prisma);
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const report = await reportGenerator.generateReport({
        timePeriod: {
          start: hourAgo.toISOString(),
          end: now.toISOString(),
        },
        includeDetails: true,
      });

      // Verify Claude statistics
      expect(report.modelStatistics[models.claude]).toBeDefined();
      expect(report.modelStatistics[models.claude].totalEvaluations).toBe(2); // Only accepted ones have metrics
      expect(report.modelStatistics[models.claude].averageScore).toBe((0.9 + 0.85) / 2);

      // Verify GPT-4 statistics
      expect(report.modelStatistics[models.gpt4]).toBeDefined();
      expect(report.modelStatistics[models.gpt4].totalEvaluations).toBe(2);
      expect(report.modelStatistics[models.gpt4].averageScore).toBe((0.75 + 0.7) / 2);

      // Verify rankings - Claude should rank higher
      expect(report.rankings.rankings[0].modelId).toBe(models.claude);
      expect(report.rankings.rankings[1].modelId).toBe(models.gpt4);
    });

    test('Track suggestions with user ratings only', async () => {
      const modelId = 'anthropic/claude-3.5-sonnet';

      // Suggestion with thumbs up
      await trackSuggestion({
        suggestionId: 'rating-test-001',
        modelId,
        content: 'good code',
        language: 'typescript',
      });
      await submitRating({
        suggestionId: 'rating-test-001',
        rating: 'up',
        comment: 'Excellent!',
      });

      // Suggestion with thumbs down
      await trackSuggestion({
        suggestionId: 'rating-test-002',
        modelId,
        content: 'bad code',
        language: 'typescript',
      });
      await submitRating({
        suggestionId: 'rating-test-002',
        rating: 'down',
        comment: 'Not helpful',
      });

      // Verify ratings were stored
      const ratings = await prisma.aIQualityRating.findMany({
        include: {
          suggestion: true,
        },
      });

      expect(ratings).toHaveLength(2);

      const upRating = ratings.find(r => r.rating === 'up');
      const downRating = ratings.find(r => r.rating === 'down');

      expect(upRating).toBeDefined();
      expect(upRating?.rating_value).toBe(5);
      expect(upRating?.comment).toBe('Excellent!');

      expect(downRating).toBeDefined();
      expect(downRating?.rating_value).toBe(1);
      expect(downRating?.comment).toBe('Not helpful');
    });

    test('Edit distance calculation accuracy', async () => {
      const testCases = [
        {
          id: 'identical',
          original: 'function test() {}',
          final: 'function test() {}',
          expectedDistance: 0,
          expectedSimilarity: 1.0,
        },
        {
          id: 'minor-change',
          original: 'const x = 1',
          final: 'const x = 2',
          expectedMinDistance: 1,
          expectedMaxSimilarity: 1.0,
        },
        {
          id: 'type-annotations',
          original: 'function add(a, b) { return a + b; }',
          final: 'function add(a: number, b: number): number { return a + b; }',
          expectedMinDistance: 10,
          expectedMinSimilarity: 0.6,
        },
      ];

      for (const testCase of testCases) {
        await trackSuggestion({
          suggestionId: testCase.id,
          modelId: 'test/model',
          content: testCase.original,
          language: 'typescript',
        });

        const result = await trackAcceptance({
          suggestionId: testCase.id,
          originalCode: testCase.original,
          finalCode: testCase.final,
          timeToAccept: 1000,
        });

        expect(result.success).toBe(true);

        if ('expectedDistance' in testCase) {
          expect(result.editMetrics?.distance).toBe(testCase.expectedDistance);
        }

        if ('expectedMinDistance' in testCase) {
          expect(result.editMetrics?.distance).toBeGreaterThanOrEqual(testCase.expectedMinDistance);
        }

        if ('expectedSimilarity' in testCase) {
          expect(result.editMetrics?.similarity).toBe(testCase.expectedSimilarity);
        }

        if ('expectedMinSimilarity' in testCase) {
          expect(result.editMetrics?.similarity).toBeGreaterThanOrEqual(testCase.expectedMinSimilarity);
        }
      }
    });
  });

  describe('Quality Report Generation', () => {
    test('Weekly report with time series', async () => {
      const modelId = 'anthropic/claude-3.5-sonnet';
      const now = new Date();

      // Create suggestions across multiple days
      for (let i = 0; i < 7; i++) {
        const dayOffset = i * 24 * 60 * 60 * 1000;
        const timestamp = new Date(now.getTime() - dayOffset);

        const suggestionId = `weekly-${i}`;
        await trackSuggestion({
          suggestionId,
          modelId,
          content: `code ${i}`,
          language: 'typescript',
        });

        await submitQualityMetrics({
          suggestionId,
          modelId,
          overallScore: 0.7 + (i * 0.03), // Gradually improving score
          relevance: 0.7,
          completeness: 0.7,
          accuracy: 0.7,
          coherence: 0.7,
        });

        // Update timestamp to simulate data over time
        await prisma.aIQualityMetric.updateMany({
          where: {
            suggestion: {
              suggestion_id: suggestionId,
            },
          },
          data: {
            evaluated_at: timestamp,
          },
        });
      }

      // Generate weekly report
      const reportGenerator = createQualityReportGenerator(prisma);
      const weeklyReport = await reportGenerator.getWeeklyReport([modelId]);

      expect(weeklyReport).toBeDefined();
      expect(weeklyReport.modelStatistics[modelId]).toBeDefined();
      expect(weeklyReport.modelStatistics[modelId].totalEvaluations).toBe(7);
      expect(weeklyReport.timeSeries).toBeDefined();
      expect(weeklyReport.timeSeries?.[modelId]).toBeDefined();

      const timeSeries = weeklyReport.timeSeries?.[modelId];
      expect(timeSeries?.dataPoints.length).toBeGreaterThan(0);
      expect(timeSeries?.trend).toBeDefined();
    });

    test('Model comparison with statistical significance', async () => {
      const models = {
        baseline: 'anthropic/claude-3-opus',
        comparison: 'anthropic/claude-3.5-sonnet',
      };

      // Create sample data for both models
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Baseline model: average score ~0.7
      for (let i = 0; i < 30; i++) {
        const suggestionId = `baseline-${i}`;
        await trackSuggestion({
          suggestionId,
          modelId: models.baseline,
          content: `baseline code ${i}`,
          language: 'typescript',
        });
        await submitQualityMetrics({
          suggestionId,
          modelId: models.baseline,
          overallScore: 0.65 + Math.random() * 0.1, // 0.65-0.75 range
          relevance: 0.7,
          completeness: 0.7,
          accuracy: 0.7,
          coherence: 0.7,
        });
      }

      // Comparison model: average score ~0.85
      for (let i = 0; i < 30; i++) {
        const suggestionId = `comparison-${i}`;
        await trackSuggestion({
          suggestionId,
          modelId: models.comparison,
          content: `comparison code ${i}`,
          language: 'typescript',
        });
        await submitQualityMetrics({
          suggestionId,
          modelId: models.comparison,
          overallScore: 0.8 + Math.random() * 0.1, // 0.8-0.9 range
          relevance: 0.85,
          completeness: 0.85,
          accuracy: 0.85,
          coherence: 0.85,
        });
      }

      // Generate comparison
      const reportGenerator = createQualityReportGenerator(prisma);
      const comparison = await reportGenerator.generateComparison(
        models.baseline,
        models.comparison,
        {
          start: weekAgo.toISOString(),
          end: now.toISOString(),
        }
      );

      expect(comparison).toBeDefined();
      expect(comparison.baselineModelId).toBe(models.baseline);
      expect(comparison.comparisonModelId).toBe(models.comparison);
      expect(comparison.comparisonScore).toBeGreaterThan(comparison.baselineScore);
      expect(comparison.improvement).toBeGreaterThan(0);
      expect(comparison.sampleSize).toBe(30);
      expect(comparison.isSignificant).toBeDefined();
    });

    test('Empty report handling', async () => {
      const reportGenerator = createQualityReportGenerator(prisma);
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const report = await reportGenerator.generateReport({
        timePeriod: {
          start: hourAgo.toISOString(),
          end: now.toISOString(),
        },
      });

      expect(report).toBeDefined();
      expect(report.overallStatistics.totalEvaluations).toBe(0);
      expect(report.overallStatistics.averageScore).toBe(0);
      expect(Object.keys(report.modelStatistics)).toHaveLength(0);
    });
  });

  describe('Quality Tracker Service Integration', () => {
    test('QualityTracker emits correct metrics', async () => {
      const mockMetricsProvider = new MockMetricsProvider();
      const tracker = createQualityTracker(mockMetricsProvider, { enabled: true });

      // Track a suggestion
      const suggestionId = await tracker.trackSuggestion({
        modelId: 'anthropic/claude-3.5-sonnet',
        suggestion: 'const x = 1;',
        language: 'typescript',
      });

      // Verify suggestion metric was emitted
      const suggestionMetrics = mockMetricsProvider.getMetrics();
      expect(suggestionMetrics.some(m => m.name === 'ai.quality.suggestion.generated')).toBe(true);

      mockMetricsProvider.clearMetrics();

      // Track acceptance
      await tracker.trackAcceptance(suggestionId, {
        finalCode: 'const x = 1;',
        timeToAccept: 3000,
      });

      // Verify acceptance metrics were emitted
      const acceptanceMetrics = mockMetricsProvider.getMetrics();
      expect(acceptanceMetrics.some(m => m.name === 'ai.quality.suggestion.accepted')).toBe(true);
      expect(acceptanceMetrics.some(m => m.name === 'ai.quality.suggestion.time_to_accept')).toBe(true);
      expect(acceptanceMetrics.some(m => m.name === 'ai.quality.suggestion.edit_distance')).toBe(true);
      expect(acceptanceMetrics.some(m => m.name === 'ai.quality.suggestion.similarity')).toBe(true);

      await tracker.shutdown();
    });

    test('QualityTracker handles rejection tracking', async () => {
      const mockMetricsProvider = new MockMetricsProvider();
      const tracker = createQualityTracker(mockMetricsProvider, { enabled: true });

      const suggestionId = await tracker.trackSuggestion({
        modelId: 'openai/gpt-4',
        suggestion: 'bad code',
        language: 'typescript',
      });

      mockMetricsProvider.clearMetrics();

      await tracker.trackRejection(suggestionId, {
        timeToReject: 2000,
        reason: 'incorrect',
      });

      const rejectionMetrics = mockMetricsProvider.getMetrics();
      expect(rejectionMetrics.some(m => m.name === 'ai.quality.suggestion.rejected')).toBe(true);
      expect(rejectionMetrics.some(m => m.name === 'ai.quality.suggestion.time_to_reject')).toBe(true);

      await tracker.shutdown();
    });

    test('QualityTracker handles rating tracking', async () => {
      const mockMetricsProvider = new MockMetricsProvider();
      const tracker = createQualityTracker(mockMetricsProvider, { enabled: true });

      const suggestionId = await tracker.trackSuggestion({
        modelId: 'anthropic/claude-3.5-sonnet',
        suggestion: 'good code',
        language: 'typescript',
      });

      mockMetricsProvider.clearMetrics();

      await tracker.trackRating(suggestionId, {
        rating: 5,
        userId: 'test-user-123',
        comment: 'Great!',
      });

      const ratingMetrics = mockMetricsProvider.getMetrics();
      expect(ratingMetrics.some(m => m.name === 'ai.quality.suggestion.rated')).toBe(true);
      expect(ratingMetrics.some(m => m.name === 'ai.quality.suggestion.rating')).toBe(true);

      await tracker.shutdown();
    });
  });

  describe('Error Handling', () => {
    test('Handle non-existent suggestion for acceptance', async () => {
      const result = await trackAcceptance({
        suggestionId: 'non-existent',
        originalCode: 'test',
        finalCode: 'test',
        timeToAccept: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Suggestion not found');
      expect(result.status).toBe(404);
    });

    test('Handle non-existent suggestion for rejection', async () => {
      const result = await trackRejection({
        suggestionId: 'non-existent',
        timeToReject: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Suggestion not found');
      expect(result.status).toBe(404);
    });

    test('Handle non-existent suggestion for rating', async () => {
      const result = await submitRating({
        suggestionId: 'non-existent',
        rating: 'up',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Suggestion not found');
      expect(result.status).toBe(404);
    });

    test('Handle duplicate rating for same suggestion', async () => {
      await trackSuggestion({
        suggestionId: 'dup-rating-test',
        modelId: 'test/model',
        content: 'test',
        language: 'typescript',
      });

      const firstRating = await submitRating({
        suggestionId: 'dup-rating-test',
        rating: 'up',
      });
      expect(firstRating.success).toBe(true);

      // Try to submit second rating - should fail due to unique constraint
      await expect(
        submitRating({
          suggestionId: 'dup-rating-test',
          rating: 'down',
        })
      ).rejects.toThrow();
    });
  });
});
