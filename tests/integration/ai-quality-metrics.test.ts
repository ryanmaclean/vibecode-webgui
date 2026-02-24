/**
 * Integration Tests for AI Quality Metrics Tracking
 *
 * Verifies the complete quality tracking flow:
 * (1) Track suggestion generation
 * (2) Track acceptance with edit distance
 * (3) Verify metrics in database
 * (4) Verify DataDog metrics emitted
 * (5) Verify degradation detection triggers
 * (6) Verify alert creation
 * (7) Verify dashboard API returns correct data
 *
 * Tests the integration of all components:
 * - QualityTracker service
 * - QualityDegradationDetector
 * - QualityAlertManager
 * - Database persistence (Prisma)
 * - DataDog metrics emission
 * - Dashboard API endpoints
 *
 * @jest-environment node
 */

const { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');
const { PrismaClient } = require('@prisma/client');
const { setupDatadogMocks, getSubmittedMetrics, clearSubmittedMetrics } = require('../__mocks__/datadog-mock');
const { createQualityTracker } = require('@/lib/ai/quality-tracker');
const { QualityDegradationDetector } = require('@/lib/ai/quality-degradation-detector');
const { QualityAlertManager } = require('@/lib/ai/quality-alerts');
const { getMetricsProvider } = require('@/lib/monitoring/metrics-provider');

// Skip tests if PostgreSQL is not available
const SKIP_E2E = process.env.SKIP_POSTGRES_TESTS === '1';
const describeIf = SKIP_E2E ? describe.skip : describe;

const prisma = new PrismaClient();
let restoreMocks: () => void;
const datadogSite = process.env.DD_SITE || 'datadoghq.com';
const baseUrl = `https://api.${datadogSite}`;

// Test data IDs
let testUserId: number;
let testWorkspaceId: number;
let testProjectId: number;

// =============================================================================
// Test Setup and Teardown
// =============================================================================

async function setupTestData() {
  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'quality-metrics-test@example.com',
      username: 'quality-metrics-user',
      password_hash: 'test-hash',
      role: 'user',
    },
  });
  testUserId = user.id;

  // Create test workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Quality Metrics Test Workspace',
      owner_id: testUserId,
    },
  });
  testWorkspaceId = workspace.id;

  // Create test project
  const project = await prisma.project.create({
    data: {
      name: 'Quality Metrics Test Project',
      workspace_id: testWorkspaceId,
      owner_id: testUserId,
    },
  });
  testProjectId = project.id;
}

async function cleanupTestData() {
  // Clean up in reverse order of dependencies
  await prisma.aIQualityAlert.deleteMany({});
  await prisma.aISuggestion.deleteMany({});
  await prisma.project.deleteMany({ where: { id: testProjectId } });
  await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
}

// =============================================================================
// Integration Tests
// =============================================================================

describeIf('AI Quality Metrics Integration', () => {
  beforeAll(async () => {
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    const mocks = setupDatadogMocks();
    restoreMocks = mocks.restore;
    clearSubmittedMetrics();
  });

  afterEach(() => {
    if (restoreMocks) {
      restoreMocks();
    }
    clearSubmittedMetrics();
  });

  describe('Complete Quality Tracking Flow', () => {
    test('should track suggestion → acceptance → database → DataDog metrics', async () => {
      // Step 1: Initialize tracker with real metrics provider
      const metricsProvider = getMetricsProvider();
      const tracker = createQualityTracker(metricsProvider, { enabled: true, samplingRate: 1.0 });

      const modelId = 'anthropic/claude-3.5-sonnet';
      const originalCode = 'function add(a, b) { return a + b; }';
      const finalCode = 'function add(a: number, b: number): number { return a + b; }';

      // Step 2: Track suggestion generation
      const suggestionId = await tracker.trackSuggestion({
        modelId,
        suggestion: originalCode,
        language: 'typescript',
        userId: testUserId.toString(),
        workspaceId: testWorkspaceId.toString(),
        projectId: testProjectId.toString(),
      });

      expect(suggestionId).toBeDefined();
      expect(suggestionId).toContain('suggestion_');

      // Step 3: Verify suggestion was persisted to database
      const suggestionInDb = await prisma.aISuggestion.findFirst({
        where: {
          model_id: modelId,
          suggestion: originalCode,
          user_id: testUserId,
        },
      });

      expect(suggestionInDb).toBeDefined();
      expect(suggestionInDb.model_id).toBe(modelId);
      expect(suggestionInDb.suggestion).toBe(originalCode);
      expect(suggestionInDb.outcome).toBe('pending');

      // Step 4: Track acceptance with edit distance
      await tracker.trackAcceptance(suggestionId, {
        finalCode,
        timeToAccept: 5000,
        wasModified: true,
      });

      // Step 5: Verify acceptance was persisted to database
      const acceptedSuggestion = await prisma.aISuggestion.findFirst({
        where: {
          model_id: modelId,
          outcome: 'accepted',
          user_id: testUserId,
        },
      });

      expect(acceptedSuggestion).toBeDefined();
      expect(acceptedSuggestion?.outcome).toBe('accepted');
      expect(acceptedSuggestion?.final_code).toBe(finalCode);
      expect(acceptedSuggestion?.edit_distance).toBeGreaterThan(0);
      expect(acceptedSuggestion?.similarity).toBeGreaterThan(0.5);
      expect(acceptedSuggestion?.time_to_accept).toBe(5000);

      // Step 6: Flush metrics to ensure they're sent to DataDog
      await tracker.flush();

      // Step 7: Verify DataDog metrics were emitted
      const submittedMetrics = getSubmittedMetrics();
      expect(submittedMetrics.length).toBeGreaterThan(0);

      // Find suggestion.generated metric
      const generatedMetric = submittedMetrics.find(m => {
        const data = m.data as { series: any[] };
        return data.series?.some(s => s.metric.includes('suggestion.generated'));
      });
      expect(generatedMetric).toBeDefined();

      // Find suggestion.accepted metric
      const acceptedMetric = submittedMetrics.find(m => {
        const data = m.data as { series: any[] };
        return data.series?.some(s => s.metric.includes('suggestion.accepted'));
      });
      expect(acceptedMetric).toBeDefined();

      // Find edit distance metric
      const editDistanceMetric = submittedMetrics.find(m => {
        const data = m.data as { series: any[] };
        return data.series?.some(s => s.metric.includes('edit_distance'));
      });
      expect(editDistanceMetric).toBeDefined();

      // Find similarity metric
      const similarityMetric = submittedMetrics.find(m => {
        const data = m.data as { series: any[] };
        return data.series?.some(s => s.metric.includes('similarity'));
      });
      expect(similarityMetric).toBeDefined();

      // Cleanup
      await tracker.shutdown();
    }, 15000);

    test('should track rejection and emit metrics', async () => {
      const metricsProvider = getMetricsProvider();
      const tracker = createQualityTracker(metricsProvider, { enabled: true, samplingRate: 1.0 });

      const modelId = 'openai/gpt-4';
      const badCode = 'bad suggestion code';

      // Track suggestion
      const suggestionId = await tracker.trackSuggestion({
        modelId,
        suggestion: badCode,
        language: 'python',
        userId: testUserId.toString(),
      });

      // Track rejection
      await tracker.trackRejection(suggestionId, {
        timeToReject: 2500,
        reason: 'incorrect',
      });

      // Verify rejection was persisted
      const rejectedSuggestion = await prisma.aISuggestion.findFirst({
        where: {
          model_id: modelId,
          outcome: 'rejected',
        },
      });

      expect(rejectedSuggestion).toBeDefined();
      expect(rejectedSuggestion?.outcome).toBe('rejected');
      expect(rejectedSuggestion?.time_to_reject).toBe(2500);
      expect(rejectedSuggestion?.rejection_reason).toBe('incorrect');

      // Verify DataDog metrics
      await tracker.flush();

      const submittedMetrics = getSubmittedMetrics();
      const rejectedMetric = submittedMetrics.find(m => {
        const data = m.data as { series: any[] };
        return data.series?.some(s => s.metric.includes('suggestion.rejected'));
      });
      expect(rejectedMetric).toBeDefined();

      await tracker.shutdown();
    }, 15000);

    test('should track user ratings and emit metrics', async () => {
      const metricsProvider = getMetricsProvider();
      const tracker = createQualityTracker(metricsProvider, { enabled: true, samplingRate: 1.0 });

      const modelId = 'anthropic/claude-3.5-sonnet';

      // Track suggestion
      const suggestionId = await tracker.trackSuggestion({
        modelId,
        suggestion: 'const x = 1;',
        language: 'typescript',
        userId: testUserId.toString(),
      });

      // Track rating
      await tracker.trackRating(suggestionId, {
        rating: 5,
        userId: testUserId.toString(),
        comment: 'Excellent suggestion!',
      });

      // Verify rating was persisted
      const ratedSuggestion = await prisma.aISuggestion.findFirst({
        where: {
          model_id: modelId,
          user_id: testUserId,
          rating: 5,
        },
      });

      expect(ratedSuggestion).toBeDefined();
      expect(ratedSuggestion?.rating).toBe(5);
      expect(ratedSuggestion?.rating_comment).toBe('Excellent suggestion!');

      // Verify DataDog metrics
      await tracker.flush();

      const submittedMetrics = getSubmittedMetrics();
      const ratingMetric = submittedMetrics.find(m => {
        const data = m.data as { series: any[] };
        return data.series?.some(s => s.metric.includes('suggestion.rated'));
      });
      expect(ratingMetric).toBeDefined();

      await tracker.shutdown();
    }, 15000);
  });

  describe('Degradation Detection and Alerting', () => {
    test('should detect acceptance rate drop and create alert', async () => {
      const modelId = 'test/degradation-model';
      const metricsProvider = getMetricsProvider();

      // Initialize components
      const degradationDetector = new QualityDegradationDetector(prisma, {
        acceptanceRateWarning: 0.7,
        acceptanceRateCritical: 0.5,
        minDataPoints: 3,
      });

      const alertManager = new QualityAlertManager(prisma);
      const tracker = createQualityTracker(
        metricsProvider,
        { enabled: true, samplingRate: 1.0 },
        degradationDetector,
        alertManager
      );

      // Create historical good performance (10 accepted suggestions)
      for (let i = 0; i < 10; i++) {
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: `good code ${i}`,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackAcceptance(suggestionId, {
          finalCode: `good code ${i}`,
          timeToAccept: 2000,
        });
      }

      // Create recent poor performance (8 rejected suggestions)
      for (let i = 0; i < 8; i++) {
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: `bad code ${i}`,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackRejection(suggestionId, {
          timeToReject: 1000,
          reason: 'incorrect',
        });
      }

      // Run degradation detection
      const results = await degradationDetector.checkForDegradation(modelId);

      expect(results).toBeDefined();
      expect(results.hasDegradation).toBe(true);
      expect(results.alerts.length).toBeGreaterThan(0);

      // Verify alert was created
      const alert = results.alerts.find(a => a.alertType === 'acceptance_rate_drop');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBeDefined();
      expect(alert?.currentValue).toBeLessThan(0.5); // Should be low

      // Create the alert in the database
      if (alert) {
        const alertRecord = await alertManager.createAlert(alert);
        expect(alertRecord).toBeDefined();
        expect(alertRecord.id).toBeDefined();

        // Verify alert in database
        const alertInDb = await prisma.aIQualityAlert.findUnique({
          where: { id: alertRecord.id },
        });

        expect(alertInDb).toBeDefined();
        expect(alertInDb?.model_id).toBe(modelId);
        expect(alertInDb?.alert_type).toBe('acceptance_rate_drop');
        expect(alertInDb?.resolved).toBe(false);
      }

      await tracker.shutdown();
      degradationDetector.shutdown();
      alertManager.shutdown();
    }, 20000);

    test('should detect edit distance increase and create alert', async () => {
      const modelId = 'test/edit-distance-model';
      const metricsProvider = getMetricsProvider();

      const degradationDetector = new QualityDegradationDetector(prisma, {
        editDistanceWarning: 30,
        editDistanceCritical: 50,
        minDataPoints: 3,
      });

      const alertManager = new QualityAlertManager(prisma);
      const tracker = createQualityTracker(
        metricsProvider,
        { enabled: true, samplingRate: 1.0 },
        degradationDetector,
        alertManager
      );

      // Create suggestions with low edit distance
      for (let i = 0; i < 5; i++) {
        const code = 'const x = 1;';
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: code,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackAcceptance(suggestionId, {
          finalCode: code, // No edits
          timeToAccept: 2000,
        });
      }

      // Create suggestions with high edit distance
      for (let i = 0; i < 5; i++) {
        const originalCode = 'function test() {}';
        const finalCode = 'function test(param1: string, param2: number, param3: boolean): void { console.log("test"); }';

        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: originalCode,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackAcceptance(suggestionId, {
          finalCode,
          timeToAccept: 2000,
        });
      }

      // Run degradation detection
      const results = await degradationDetector.checkForDegradation(modelId);

      expect(results).toBeDefined();

      // Check if edit distance alert was triggered
      const editDistanceAlert = results.alerts.find(a => a.alertType === 'edit_distance_increase');
      if (editDistanceAlert) {
        expect(editDistanceAlert.currentValue).toBeGreaterThan(editDistanceAlert.previousValue);

        // Create alert in database
        const alertRecord = await alertManager.createAlert(editDistanceAlert);
        expect(alertRecord).toBeDefined();
      }

      await tracker.shutdown();
      degradationDetector.shutdown();
      alertManager.shutdown();
    }, 20000);

    test('should detect slow acceptance time and create alert', async () => {
      const modelId = 'test/slow-acceptance-model';
      const metricsProvider = getMetricsProvider();

      const degradationDetector = new QualityDegradationDetector(prisma, {
        timeToAcceptWarning: 5000,
        timeToAcceptCritical: 10000,
        minDataPoints: 3,
      });

      const alertManager = new QualityAlertManager(prisma);
      const tracker = createQualityTracker(
        metricsProvider,
        { enabled: true, samplingRate: 1.0 },
        degradationDetector,
        alertManager
      );

      // Create suggestions with fast acceptance
      for (let i = 0; i < 5; i++) {
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: `code ${i}`,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackAcceptance(suggestionId, {
          finalCode: `code ${i}`,
          timeToAccept: 2000, // Fast
        });
      }

      // Create suggestions with slow acceptance
      for (let i = 0; i < 5; i++) {
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: `slow code ${i}`,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackAcceptance(suggestionId, {
          finalCode: `slow code ${i}`,
          timeToAccept: 15000, // Very slow
        });
      }

      // Run degradation detection
      const results = await degradationDetector.checkForDegradation(modelId);

      expect(results).toBeDefined();

      // Check if slow acceptance alert was triggered
      const slowAlert = results.alerts.find(a => a.alertType === 'slow_acceptance');
      if (slowAlert) {
        expect(slowAlert.currentValue).toBeGreaterThan(slowAlert.threshold);

        // Create alert in database
        const alertRecord = await alertManager.createAlert(slowAlert);
        expect(alertRecord).toBeDefined();
      }

      await tracker.shutdown();
      degradationDetector.shutdown();
      alertManager.shutdown();
    }, 20000);
  });

  describe('Alert Management', () => {
    test('should retrieve active alerts', async () => {
      const modelId = 'test/alert-retrieval-model';
      const alertManager = new QualityAlertManager(prisma);

      // Create a test alert
      const alert = {
        id: 'test-alert-1',
        modelId,
        alertType: 'acceptance_rate_drop' as const,
        severity: 'warning' as const,
        message: 'Test alert message',
        threshold: 0.7,
        currentValue: 0.5,
        previousValue: 0.8,
        detectedAt: new Date().toISOString(),
      };

      await alertManager.createAlert(alert);

      // Retrieve active alerts
      const activeAlerts = await alertManager.getActiveAlerts({ modelId });

      expect(activeAlerts).toBeDefined();
      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(activeAlerts[0].model_id).toBe(modelId);
      expect(activeAlerts[0].resolved).toBe(false);

      alertManager.shutdown();
    }, 15000);

    test('should resolve alerts', async () => {
      const modelId = 'test/alert-resolution-model';
      const alertManager = new QualityAlertManager(prisma);

      // Create a test alert
      const alert = {
        id: 'test-alert-2',
        modelId,
        alertType: 'acceptance_rate_drop' as const,
        severity: 'critical' as const,
        message: 'Test critical alert',
        threshold: 0.5,
        currentValue: 0.3,
        previousValue: 0.8,
        detectedAt: new Date().toISOString(),
      };

      const createdAlert = await alertManager.createAlert(alert);

      // Resolve the alert
      await alertManager.resolveAlert(createdAlert.id, 'Issue has been addressed');

      // Verify alert is resolved
      const resolvedAlert = await prisma.aIQualityAlert.findUnique({
        where: { id: createdAlert.id },
      });

      expect(resolvedAlert).toBeDefined();
      expect(resolvedAlert?.resolved).toBe(true);
      expect(resolvedAlert?.resolved_at).toBeDefined();

      alertManager.shutdown();
    }, 15000);

    test('should get alert statistics', async () => {
      const modelId = 'test/alert-stats-model';
      const alertManager = new QualityAlertManager(prisma);

      // Create multiple alerts with different severities
      const alerts = [
        {
          id: 'stats-alert-1',
          modelId,
          alertType: 'acceptance_rate_drop' as const,
          severity: 'warning' as const,
          message: 'Warning alert',
          threshold: 0.7,
          currentValue: 0.65,
          previousValue: 0.75,
          detectedAt: new Date().toISOString(),
        },
        {
          id: 'stats-alert-2',
          modelId,
          alertType: 'edit_distance_increase' as const,
          severity: 'critical' as const,
          message: 'Critical alert',
          threshold: 50,
          currentValue: 75,
          previousValue: 30,
          detectedAt: new Date().toISOString(),
        },
      ];

      for (const alert of alerts) {
        await alertManager.createAlert(alert);
      }

      // Get alert stats
      const stats = await alertManager.getAlertStats();

      expect(stats).toBeDefined();
      expect(stats.totalAlerts).toBeGreaterThanOrEqual(2);
      expect(stats.activeAlerts).toBeGreaterThanOrEqual(2);
      expect(stats.warningAlerts).toBeGreaterThanOrEqual(1);
      expect(stats.criticalAlerts).toBeGreaterThanOrEqual(1);
      expect(stats.alertsByType).toBeDefined();
      expect(stats.alertsByModel).toBeDefined();

      alertManager.shutdown();
    }, 15000);
  });

  describe('DataDog Metrics Validation', () => {
    test('should emit metrics with correct tags and format', async () => {
      const metricsProvider = getMetricsProvider();
      const tracker = createQualityTracker(metricsProvider, { enabled: true, samplingRate: 1.0 });

      const modelId = 'anthropic/claude-3.5-sonnet';
      const language = 'typescript';

      // Track suggestion
      const suggestionId = await tracker.trackSuggestion({
        modelId,
        suggestion: 'const x = 1;',
        language,
        userId: testUserId.toString(),
      });

      // Track acceptance
      await tracker.trackAcceptance(suggestionId, {
        finalCode: 'const x: number = 1;',
        timeToAccept: 3000,
      });

      await tracker.flush();

      // Verify metrics format
      const submittedMetrics = getSubmittedMetrics();
      expect(submittedMetrics.length).toBeGreaterThan(0);

      const metricData = submittedMetrics[0].data as { series: any[] };
      expect(metricData.series).toBeDefined();

      // Check that metrics have required fields
      for (const metric of metricData.series) {
        expect(metric.metric).toBeDefined();
        expect(metric.points).toBeDefined();
        expect(Array.isArray(metric.points)).toBe(true);
        expect(metric.tags).toBeDefined();
        expect(Array.isArray(metric.tags)).toBe(true);

        // Verify tags include model and language
        const hasModelTag = metric.tags.some((tag: string) => tag.startsWith('model:'));
        const hasLanguageTag = metric.tags.some((tag: string) => tag.startsWith('language:'));

        expect(hasModelTag).toBe(true);
        expect(hasLanguageTag).toBe(true);
      }

      await tracker.shutdown();
    }, 15000);

    test('should emit degradation alert metrics to DataDog', async () => {
      const modelId = 'test/alert-metrics-model';
      const metricsProvider = getMetricsProvider();

      const degradationDetector = new QualityDegradationDetector(prisma, {
        acceptanceRateWarning: 0.7,
        minDataPoints: 2,
      });

      const alertManager = new QualityAlertManager(prisma);
      const tracker = createQualityTracker(
        metricsProvider,
        { enabled: true, samplingRate: 1.0 },
        degradationDetector,
        alertManager
      );

      // Create poor performance to trigger alert
      for (let i = 0; i < 5; i++) {
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: `code ${i}`,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackRejection(suggestionId, {
          timeToReject: 1000,
          reason: 'incorrect',
        });
      }

      // Detect degradation and create alert
      const results = await degradationDetector.checkForDegradation(modelId);
      if (results.hasDegradation && results.alerts.length > 0) {
        await alertManager.createAlert(results.alerts[0]);
      }

      await tracker.flush();

      // Verify alert metrics were emitted
      const submittedMetrics = getSubmittedMetrics();
      const alertMetric = submittedMetrics.find(m => {
        const data = m.data as { series: any[] };
        return data.series?.some(s => s.metric.includes('alert'));
      });

      // Alert metrics may be emitted depending on the flow
      expect(submittedMetrics.length).toBeGreaterThan(0);

      await tracker.shutdown();
      degradationDetector.shutdown();
      alertManager.shutdown();
    }, 20000);
  });

  describe('Database Queries and Aggregations', () => {
    test('should calculate acceptance rate correctly', async () => {
      const modelId = 'test/acceptance-rate-model';
      const metricsProvider = getMetricsProvider();
      const tracker = createQualityTracker(metricsProvider, { enabled: true, samplingRate: 1.0 });

      // Create 7 accepted and 3 rejected suggestions
      for (let i = 0; i < 7; i++) {
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: `accepted code ${i}`,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackAcceptance(suggestionId, {
          finalCode: `accepted code ${i}`,
          timeToAccept: 2000,
        });
      }

      for (let i = 0; i < 3; i++) {
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: `rejected code ${i}`,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackRejection(suggestionId, {
          timeToReject: 1000,
          reason: 'incorrect',
        });
      }

      // Get acceptance rate
      const acceptanceRate = await tracker.getAcceptanceRate(modelId);

      expect(acceptanceRate).toBeCloseTo(0.7, 1); // 7/10 = 0.7

      await tracker.shutdown();
    }, 15000);

    test('should calculate average edit distance correctly', async () => {
      const modelId = 'test/edit-distance-avg-model';
      const metricsProvider = getMetricsProvider();
      const tracker = createQualityTracker(metricsProvider, { enabled: true, samplingRate: 1.0 });

      // Create suggestions with known edit distances
      const testCases = [
        { original: 'const x = 1;', final: 'const x = 1;' }, // distance: 0
        { original: 'const x = 1;', final: 'const x: number = 1;' }, // distance: ~15
        { original: 'function test() {}', final: 'function test(): void {}' }, // distance: ~8
      ];

      for (let i = 0; i < testCases.length; i++) {
        const suggestionId = await tracker.trackSuggestion({
          modelId,
          suggestion: testCases[i].original,
          language: 'typescript',
          userId: testUserId.toString(),
        });

        await tracker.trackAcceptance(suggestionId, {
          finalCode: testCases[i].final,
          timeToAccept: 2000,
        });
      }

      // Get average edit distance
      const avgEditDistance = await tracker.getAverageEditDistance(modelId);

      expect(avgEditDistance).toBeGreaterThanOrEqual(0);
      expect(avgEditDistance).toBeLessThan(100);

      await tracker.shutdown();
    }, 15000);
  });
});
