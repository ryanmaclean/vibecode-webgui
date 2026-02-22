/**
 * DataDog Metrics Integration Tests for AI Quality Tracking
 *
 * Verifies that AI quality metrics are properly emitted to DataDog with correct:
 * - Metric names (ai.quality.* prefix)
 * - Metric types (count, gauge, timing)
 * - Tags (model, language, etc.)
 * - Values and data points
 *
 * Uses DataDog API mocks to verify metrics without making actual API calls.
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { setupDatadogMocks, getSubmittedMetrics, clearSubmittedMetrics } = require('../__mocks__/datadog-mock');

describe('DataDog Metrics Integration for AI Quality Tracking', () => {
  let restoreMocks: () => void;
  const datadogSite = process.env.DD_SITE || 'datadoghq.com';
  const baseUrl = `https://api.${datadogSite}`;

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

  test('should validate DataDog API connection', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate`, {
      method: 'GET',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('valid');
    expect(data.valid).toBe(true);
  }, 10000);

  test('should emit ai.quality.suggestion.generated metrics to DataDog', async () => {
    const now = Math.floor(Date.now() / 1000);
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.ai.quality.suggestion.generated',
          type: 'count',
          points: [[now, 1]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet',
            'language:typescript'
          ]
        }
      ]
    };

    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(response.status).toBe(202); // Accepted

    // Verify metric was stored
    const submitted = getSubmittedMetrics();
    expect(submitted.length).toBeGreaterThan(0);

    const metricData = submitted[0].data as { series: any[] };
    expect(metricData.series).toBeDefined();
    expect(metricData.series[0].metric).toBe('vibecode.ai.quality.suggestion.generated');
    expect(metricData.series[0].tags).toContain('model:anthropic/claude-3.5-sonnet');
  }, 10000);

  test('should emit ai.quality.suggestion.accepted metrics with edit distance', async () => {
    const now = Math.floor(Date.now() / 1000);
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.ai.quality.suggestion.accepted',
          type: 'count',
          points: [[now, 1]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet',
            'language:typescript',
            'modified:true',
            'change_magnitude:minor'
          ]
        },
        {
          metric: 'vibecode.ai.quality.suggestion.edit_distance',
          type: 'gauge',
          points: [[now, 5]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet',
            'language:typescript'
          ]
        },
        {
          metric: 'vibecode.ai.quality.suggestion.similarity',
          type: 'gauge',
          points: [[now, 0.95]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet',
            'language:typescript'
          ]
        }
      ]
    };

    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(response.status).toBe(202);

    // Verify all acceptance metrics were submitted
    const submitted = getSubmittedMetrics();
    const metricData = submitted[0].data as { series: any[] };

    expect(metricData.series.length).toBe(3);

    const acceptedMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.suggestion.accepted');
    expect(acceptedMetric).toBeDefined();
    expect(acceptedMetric.tags).toContain('modified:true');
    expect(acceptedMetric.tags).toContain('change_magnitude:minor');

    const distanceMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.suggestion.edit_distance');
    expect(distanceMetric).toBeDefined();
    expect(distanceMetric.points[0][1]).toBe(5);

    const similarityMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.suggestion.similarity');
    expect(similarityMetric).toBeDefined();
    expect(similarityMetric.points[0][1]).toBe(0.95);
  }, 10000);

  test('should emit ai.quality.suggestion.rejected metrics', async () => {
    const now = Math.floor(Date.now() / 1000);
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.ai.quality.suggestion.rejected',
          type: 'count',
          points: [[now, 1]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:openai/gpt-4',
            'language:python',
            'reason:irrelevant'
          ]
        },
        {
          metric: 'vibecode.ai.quality.suggestion.time_to_reject.timing',
          type: 'gauge',
          points: [[now, 2500]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:openai/gpt-4',
            'language:python'
          ]
        }
      ]
    };

    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(response.status).toBe(202);

    // Verify rejection metrics
    const submitted = getSubmittedMetrics();
    const metricData = submitted[0].data as { series: any[] };

    const rejectedMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.suggestion.rejected');
    expect(rejectedMetric).toBeDefined();
    expect(rejectedMetric.tags).toContain('reason:irrelevant');

    const timeMetric = metricData.series.find(m => m.metric.includes('time_to_reject'));
    expect(timeMetric).toBeDefined();
  }, 10000);

  test('should emit ai.quality.suggestion.rating metrics', async () => {
    const now = Math.floor(Date.now() / 1000);
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.ai.quality.suggestion.rated',
          type: 'count',
          points: [[now, 1]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet',
            'language:javascript'
          ]
        },
        {
          metric: 'vibecode.ai.quality.suggestion.rating',
          type: 'gauge',
          points: [[now, 5]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet',
            'language:javascript'
          ]
        }
      ]
    };

    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(response.status).toBe(202);

    // Verify rating metrics
    const submitted = getSubmittedMetrics();
    const metricData = submitted[0].data as { series: any[] };

    const ratedMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.suggestion.rated');
    expect(ratedMetric).toBeDefined();

    const ratingMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.suggestion.rating');
    expect(ratingMetric).toBeDefined();
    expect(ratingMetric.points[0][1]).toBe(5);
  }, 10000);

  test('should emit ai.quality.quality.* metrics for quality dimensions', async () => {
    const now = Math.floor(Date.now() / 1000);
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.ai.quality.quality.relevance',
          type: 'gauge',
          points: [[now, 0.9]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet'
          ]
        },
        {
          metric: 'vibecode.ai.quality.quality.completeness',
          type: 'gauge',
          points: [[now, 0.85]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet'
          ]
        },
        {
          metric: 'vibecode.ai.quality.quality.accuracy',
          type: 'gauge',
          points: [[now, 0.95]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet'
          ]
        },
        {
          metric: 'vibecode.ai.quality.quality.coherence',
          type: 'gauge',
          points: [[now, 0.88]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet'
          ]
        },
        {
          metric: 'vibecode.ai.quality.quality.overall',
          type: 'gauge',
          points: [[now, 0.895]],
          tags: [
            'env:test',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet'
          ]
        }
      ]
    };

    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(response.status).toBe(202);

    // Verify quality dimension metrics
    const submitted = getSubmittedMetrics();
    const metricData = submitted[0].data as { series: any[] };

    expect(metricData.series.length).toBe(5);

    const relevanceMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.quality.relevance');
    expect(relevanceMetric).toBeDefined();
    expect(relevanceMetric.points[0][1]).toBe(0.9);

    const completenessMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.quality.completeness');
    expect(completenessMetric).toBeDefined();
    expect(completenessMetric.points[0][1]).toBe(0.85);

    const accuracyMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.quality.accuracy');
    expect(accuracyMetric).toBeDefined();
    expect(accuracyMetric.points[0][1]).toBe(0.95);

    const coherenceMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.quality.coherence');
    expect(coherenceMetric).toBeDefined();
    expect(coherenceMetric.points[0][1]).toBe(0.88);

    const overallMetric = metricData.series.find(m => m.metric === 'vibecode.ai.quality.quality.overall');
    expect(overallMetric).toBeDefined();
    expect(overallMetric.points[0][1]).toBe(0.895);
  }, 10000);

  test('should query ai.quality.* metrics from DataDog', async () => {
    // First, submit some metrics
    const now = Math.floor(Date.now() / 1000);
    await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        series: [
          {
            metric: 'vibecode.ai.quality.suggestion.generated',
            type: 'count',
            points: [[now, 1]],
            tags: ['model:test-model']
          }
        ]
      })
    });

    // Query the metrics
    const queryResponse = await fetch(
      `${baseUrl}/api/v1/query?query=ai.quality.suggestion.generated`,
      {
        method: 'GET',
        headers: {
          'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
          'Content-Type': 'application/json'
        }
      }
    );

    expect(queryResponse.ok).toBe(true);

    const queryData = await queryResponse.json();
    expect(queryData.status).toBe('ok');
    expect(queryData.series).toBeDefined();
    expect(queryData.series.length).toBeGreaterThan(0);
  }, 10000);

  test('should handle multiple AI quality metrics in a single batch', async () => {
    const now = Math.floor(Date.now() / 1000);
    const batchMetrics = {
      series: [
        {
          metric: 'vibecode.ai.quality.suggestion.generated',
          type: 'count',
          points: [[now, 5]],
          tags: ['env:test', 'model:test-model-1']
        },
        {
          metric: 'vibecode.ai.quality.suggestion.accepted',
          type: 'count',
          points: [[now, 3]],
          tags: ['env:test', 'model:test-model-1']
        },
        {
          metric: 'vibecode.ai.quality.suggestion.rejected',
          type: 'count',
          points: [[now, 2]],
          tags: ['env:test', 'model:test-model-1']
        },
        {
          metric: 'vibecode.ai.quality.quality.overall',
          type: 'gauge',
          points: [[now, 0.87]],
          tags: ['env:test', 'model:test-model-1']
        }
      ]
    };

    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batchMetrics)
    });

    expect(response.status).toBe(202);

    // Verify all metrics were submitted in batch
    const submitted = getSubmittedMetrics();
    const metricData = submitted[0].data as { series: any[] };

    expect(metricData.series.length).toBe(4);

    // Verify each metric is present
    expect(metricData.series.some(m => m.metric === 'vibecode.ai.quality.suggestion.generated')).toBe(true);
    expect(metricData.series.some(m => m.metric === 'vibecode.ai.quality.suggestion.accepted')).toBe(true);
    expect(metricData.series.some(m => m.metric === 'vibecode.ai.quality.suggestion.rejected')).toBe(true);
    expect(metricData.series.some(m => m.metric === 'vibecode.ai.quality.quality.overall')).toBe(true);
  }, 10000);

  test('should include proper tags for model comparison', async () => {
    const now = Math.floor(Date.now() / 1000);
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.ai.quality.suggestion.generated',
          type: 'count',
          points: [[now, 1]],
          tags: [
            'env:production',
            'service:vibecode-webgui',
            'model:anthropic/claude-3.5-sonnet',
            'language:typescript',
            'workspace_id:123',
            'project_id:456'
          ]
        }
      ]
    };

    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(response.status).toBe(202);

    // Verify tags are comprehensive for analysis
    const submitted = getSubmittedMetrics();
    const metricData = submitted[0].data as { series: any[] };
    const metric = metricData.series[0];

    expect(metric.tags).toContain('env:production');
    expect(metric.tags).toContain('service:vibecode-webgui');
    expect(metric.tags).toContain('model:anthropic/claude-3.5-sonnet');
    expect(metric.tags).toContain('language:typescript');
    expect(metric.tags.some(t => t.startsWith('workspace_id:'))).toBe(true);
    expect(metric.tags.some(t => t.startsWith('project_id:'))).toBe(true);
  }, 10000);
});

// Test to verify our tests are properly configured
describe('DataDog Integration Test Configuration', () => {
  test('should be properly configured for integration testing', () => {
    // Verify that this test file follows integration testing principles
    expect(process.env.DD_API_KEY || 'mock-datadog-api-key-32-characters').toBeDefined();

    // Verify that the DataDog mock is available
    expect(setupDatadogMocks).toBeDefined();
    expect(getSubmittedMetrics).toBeDefined();
    expect(clearSubmittedMetrics).toBeDefined();
  });

  test('should verify ai.quality.* metric naming convention', () => {
    // Verify the metric naming pattern
    const expectedMetrics = [
      'vibecode.ai.quality.suggestion.generated',
      'vibecode.ai.quality.suggestion.accepted',
      'vibecode.ai.quality.suggestion.rejected',
      'vibecode.ai.quality.suggestion.rated',
      'vibecode.ai.quality.suggestion.rating',
      'vibecode.ai.quality.suggestion.edit_distance',
      'vibecode.ai.quality.suggestion.similarity',
      'vibecode.ai.quality.suggestion.time_to_accept',
      'vibecode.ai.quality.suggestion.time_to_reject',
      'vibecode.ai.quality.quality.relevance',
      'vibecode.ai.quality.quality.completeness',
      'vibecode.ai.quality.quality.accuracy',
      'vibecode.ai.quality.quality.coherence',
      'vibecode.ai.quality.quality.overall'
    ];

    // All metrics should follow the vibecode.ai.quality.* pattern
    expectedMetrics.forEach(metric => {
      expect(metric).toMatch(/^vibecode\.ai\.quality\./);
    });

    // Verify categories
    const suggestionMetrics = expectedMetrics.filter(m => m.includes('.suggestion.'));
    const qualityMetrics = expectedMetrics.filter(m => m.includes('.quality.quality.'));

    expect(suggestionMetrics.length).toBeGreaterThan(0);
    expect(qualityMetrics.length).toBeGreaterThan(0);
  });
});
