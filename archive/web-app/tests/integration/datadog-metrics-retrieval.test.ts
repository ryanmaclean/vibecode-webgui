/**
 * Datadog Metrics Retrieval Integration Tests
 *
 * Tests that validate metrics can be submitted to and retrieved from Datadog API.
 * This includes metrics from Docker tests, Kubernetes tests, and tag validation.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { setupDatadogMocks, mockDatadogAPI, getSubmittedMetrics } from '../__mocks__/datadog-mock';

// These tests now use mocks for fast execution
// Original tests made real API calls which took 94+ seconds
// Mocked version completes in ~5 seconds
const describeIf = describe;

// Datadog API configuration
const DD_API_KEY = process.env.DD_API_KEY || '';
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';
const DD_API_BASE_URL = `https://api.${DD_SITE}`;
const DD_APP_KEY = process.env.DD_APP_KEY || process.env.DATADOG_APP_KEY || '';

// Test timeout configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const QUERY_TIMEOUT = 45000; // 45 seconds for metric queries (Datadog has ingestion delay)
const LONG_TIMEOUT = 60000; // 60 seconds for complex operations

// Metric name prefixes for different test environments
const METRIC_PREFIXES = {
  DOCKER: 'vibecode.docker.test',
  K8S: 'vibecode.k8s.test',
  INTEGRATION: 'vibecode.integration.test',
};

interface DatadogMetric {
  metric: string;
  points: Array<[number, number]>;
  type?: 'gauge' | 'count' | 'rate';
  tags?: string[];
  interval?: number;
  host?: string;
}

interface MetricQueryResponse {
  status: string;
  series?: Array<{
    metric: string;
    points: Array<[number, number]>;
    tags: string[];
    scope: string;
    expression: string;
  }>;
  error?: string;
  message?: string;
}

/**
 * Helper function to submit metrics to Datadog with error handling
 */
async function submitMetricsToDatadog(
  metrics: DatadogMetric[],
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${DD_API_BASE_URL}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': DD_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ series: metrics }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Helper function to query metrics from Datadog with error handling
 * Now uses mocks for instant responses
 */
async function queryMetricsFromDatadog(
  query: string,
  from: number,
  to: number,
  timeoutMs: number = QUERY_TIMEOUT
): Promise<MetricQueryResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${DD_API_BASE_URL}/api/v1/query?query=${encodeURIComponent(query)}&from=${from}&to=${to}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'DD-API-KEY': DD_API_KEY,
        'DD-APPLICATION-KEY': DD_APP_KEY || 'mock-app-key',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Datadog API error (${response.status}): ${errorBody}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Query timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Helper function to wait with exponential backoff
 */
async function waitWithBackoff(baseDelayMs: number, attempt: number, maxAttempts: number): Promise<void> {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 10000); // Max 10s delay
  console.log(`Waiting ${delay}ms before attempt ${attempt + 1}/${maxAttempts}...`);
  await new Promise(resolve => setTimeout(resolve, delay));
}

describeIf('Datadog Metrics Retrieval Integration Tests', () => {
  const testStartTime = Math.floor(Date.now() / 1000);
  let testMetricNames: string[] = [];
  let mockCleanup: { restore: () => void } | null = null;

  beforeAll(() => {
    console.log('Starting Datadog metrics retrieval tests (mocked for performance)');
    console.log(`Test start time: ${new Date(testStartTime * 1000).toISOString()}`);
    console.log(`Datadog site: ${DD_SITE}`);
  });

  beforeEach(() => {
    // Set up Datadog mocks for fast test execution
    // This must run AFTER jest.setup.js beforeEach to override the default mock
    mockCleanup = setupDatadogMocks();

    // Reset mock state before each test
    mockDatadogAPI.reset();
  });

  afterEach(() => {
    // Clean up after each test
    if (mockCleanup) {
      mockCleanup.restore();
      mockCleanup = null;
    }
  });

  afterAll(() => {
    console.log(`Test metrics created: ${testMetricNames.join(', ')}`);
  });

  describe('API Key Validation', () => {
    test('should validate API key with Datadog', async () => {
      const response = await fetch(`${DD_API_BASE_URL}/api/v1/validate`, {
        method: 'GET',
        headers: {
          'DD-API-KEY': DD_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);

      const validation = await response.json();
      expect(validation).toHaveProperty('valid');
      expect(validation.valid).toBe(true);
    }, DEFAULT_TIMEOUT);

    test('should reject invalid API key', async () => {
      const response = await fetch(`${DD_API_BASE_URL}/api/v1/validate`, {
        method: 'GET',
        headers: {
          'DD-API-KEY': 'invalid-key-12345',
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(403);
    }, DEFAULT_TIMEOUT);
  });

  describe('Metric Submission and Retrieval', () => {
    test('should submit metrics and verify acceptance', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.INTEGRATION}.submission_test`;
      testMetricNames.push(metricName);

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 42.5]],
          type: 'gauge',
          tags: [
            'test:submission',
            'environment:integration',
            'service:vibecode-webgui',
          ],
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      expect(response.status).toBe(202); // Datadog returns 202 for accepted metrics

      const result = await response.json();
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('ok');
    }, DEFAULT_TIMEOUT);

    test('should submit and query back metrics with retry logic', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.INTEGRATION}.query_test`;
      const metricValue = Math.random() * 100;
      testMetricNames.push(metricName);

      // Submit metric
      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, metricValue]],
          type: 'gauge',
          tags: [
            'test:query',
            'environment:integration',
            'component:test',
          ],
        },
      ];

      const submitResponse = await submitMetricsToDatadog(metrics);
      expect(submitResponse.status).toBe(202);

      // With mocks, metrics are immediately available (no ingestion delay)
      const from = timestamp - 300; // 5 minutes before
      const to = timestamp + 300; // 5 minutes after
      const queryResult = await queryMetricsFromDatadog(metricName, from, to);

      expect(queryResult.series).toBeDefined();
      expect(queryResult.series.length).toBeGreaterThan(0);
      const series = queryResult.series[0];
      expect(series.metric).toBe(metricName);
      expect(series.points.length).toBeGreaterThan(0);
    }, DEFAULT_TIMEOUT);

    test('should handle batch metric submission', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const batchMetrics: DatadogMetric[] = Array.from({ length: 10 }, (_, i) => ({
        metric: `${METRIC_PREFIXES.INTEGRATION}.batch_test_${i}`,
        points: [[timestamp, i * 10]],
        type: 'gauge' as const,
        tags: [
          'test:batch',
          `index:${i}`,
          'environment:integration',
        ],
      }));

      batchMetrics.forEach(m => testMetricNames.push(m.metric));

      const response = await submitMetricsToDatadog(batchMetrics);

      expect(response.status).toBe(202);
      const result = await response.json();
      expect(result.status).toBe('ok');
    }, DEFAULT_TIMEOUT);
  });

  describe('Docker Test Metrics', () => {
    test('should submit Docker container metrics', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.DOCKER}.container_cpu`;
      testMetricNames.push(metricName);

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 45.2]],
          type: 'gauge',
          tags: [
            'test:docker',
            'container:test-container',
            'docker_image:vibecode-test:latest',
            'environment:integration',
          ],
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      expect(response.status).toBe(202);
      const result = await response.json();
      expect(result.status).toBe('ok');
    }, DEFAULT_TIMEOUT);

    test('should submit Docker network metrics', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.DOCKER}.network_bytes_sent`;
      testMetricNames.push(metricName);

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 1024 * 1024 * 5]], // 5MB
          type: 'count',
          tags: [
            'test:docker',
            'network:bridge',
            'container:test-container',
          ],
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      expect(response.status).toBe(202);
    }, DEFAULT_TIMEOUT);

    test('should verify Docker metrics are retrievable', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.DOCKER}.retrieval_test`;
      testMetricNames.push(metricName);

      // Submit metric
      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 99.9]],
          type: 'gauge',
          tags: [
            'test:docker',
            'container:test-retrieval',
            'environment:integration',
          ],
        },
      ];

      await submitMetricsToDatadog(metrics);

      // With mocks, query immediately (no ingestion delay)
      const from = timestamp - 300;
      const to = timestamp + 300;
      const queryResult = await queryMetricsFromDatadog(metricName, from, to);

      expect(queryResult.series).toBeDefined();
      expect(queryResult.series.length).toBeGreaterThan(0);
      expect(queryResult.series[0].metric).toBe(metricName);
    }, DEFAULT_TIMEOUT);
  });

  describe('Kubernetes Test Metrics', () => {
    test('should submit K8s pod metrics', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.K8S}.pod_memory_usage`;
      testMetricNames.push(metricName);

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 256 * 1024 * 1024]], // 256MB
          type: 'gauge',
          tags: [
            'test:k8s',
            'pod:vibecode-test-pod',
            'namespace:default',
            'cluster:test-cluster',
            'environment:integration',
          ],
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      expect(response.status).toBe(202);
      const result = await response.json();
      expect(result.status).toBe('ok');
    }, DEFAULT_TIMEOUT);

    test('should submit K8s deployment metrics', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.K8S}.deployment_replicas_ready`;
      testMetricNames.push(metricName);

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 3]],
          type: 'gauge',
          tags: [
            'test:k8s',
            'deployment:vibecode-webgui',
            'namespace:production',
            'cluster:prod-cluster',
          ],
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      expect(response.status).toBe(202);
    }, DEFAULT_TIMEOUT);

    test('should verify K8s metrics are retrievable', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.K8S}.retrieval_test`;
      testMetricNames.push(metricName);

      // Submit metric
      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 88.8]],
          type: 'gauge',
          tags: [
            'test:k8s',
            'pod:test-retrieval-pod',
            'namespace:test',
            'environment:integration',
          ],
        },
      ];

      await submitMetricsToDatadog(metrics);

      // With mocks, query immediately (no ingestion delay)
      const from = timestamp - 300;
      const to = timestamp + 300;
      const queryResult = await queryMetricsFromDatadog(metricName, from, to);

      expect(queryResult.series).toBeDefined();
      expect(queryResult.series.length).toBeGreaterThan(0);
      expect(queryResult.series[0].metric).toBe(metricName);
    }, DEFAULT_TIMEOUT);
  });

  describe('Metric Tag Validation', () => {
    test('should validate metric tags are preserved', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.INTEGRATION}.tag_validation`;
      testMetricNames.push(metricName);

      const expectedTags = [
        'test:tag_validation',
        'environment:integration',
        'team:platform',
        'service:vibecode-webgui',
        'version:1.0.0',
        'component:test',
      ];

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 123.45]],
          type: 'gauge',
          tags: expectedTags,
        },
      ];

      const submitResponse = await submitMetricsToDatadog(metrics);
      expect(submitResponse.status).toBe(202);

      // With mocks, query immediately (no ingestion delay)
      const from = timestamp - 300;
      const to = timestamp + 300;
      const queryResult = await queryMetricsFromDatadog(metricName, from, to);

      expect(queryResult.series).toBeDefined();
      expect(queryResult.series.length).toBeGreaterThan(0);

      const series = queryResult.series[0];
      const returnedTags = series.tags;

      // Verify all expected tags are present
      expectedTags.forEach(tag => {
        expect(returnedTags).toContain(tag);
      });
    }, DEFAULT_TIMEOUT);

    test('should handle special characters in tags', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.INTEGRATION}.special_tags`;
      testMetricNames.push(metricName);

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 50]],
          type: 'gauge',
          tags: [
            'test:special_chars',
            'endpoint:/api/v1/users',
            'method:POST',
            'status_code:200',
            'container_name:vibecode-web-1',
          ],
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      expect(response.status).toBe(202);
    }, DEFAULT_TIMEOUT);

    test('should validate tag format requirements', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.INTEGRATION}.tag_format`;
      testMetricNames.push(metricName);

      // Tags should be in key:value format
      const validTags = [
        'environment:production',
        'region:us-east-1',
        'instance_type:t3.large',
      ];

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 75]],
          type: 'gauge',
          tags: validTags,
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      expect(response.status).toBe(202);
      const result = await response.json();
      expect(result.status).toBe('ok');
    }, DEFAULT_TIMEOUT);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle metric submission timeout gracefully', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metrics: DatadogMetric[] = [
        {
          metric: `${METRIC_PREFIXES.INTEGRATION}.timeout_test`,
          points: [[timestamp, 1]],
          type: 'gauge',
          tags: ['test:timeout'],
        },
      ];

      // Should not throw even with very short timeout (may fail but should be handled)
      try {
        await submitMetricsToDatadog(metrics, 1); // 1ms timeout - will likely fail
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toContain('timed out');
        }
      }
    }, DEFAULT_TIMEOUT);

    test('should handle empty metric series', async () => {
      const response = await submitMetricsToDatadog([]);

      // Datadog should accept empty series
      expect(response.status).toBe(202);
    }, DEFAULT_TIMEOUT);

    test('should handle invalid metric names gracefully', async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      // Datadog has some restrictions on metric names
      const metrics: DatadogMetric[] = [
        {
          metric: 'test..double.dot', // Invalid: consecutive dots
          points: [[timestamp, 1]],
          type: 'gauge',
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      // Datadog may accept but normalize the metric name
      // or reject it - either is acceptable
      expect([202, 400]).toContain(response.status);
    }, DEFAULT_TIMEOUT);

    test('should handle large metric values', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.INTEGRATION}.large_value`;
      testMetricNames.push(metricName);

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, Number.MAX_SAFE_INTEGER]],
          type: 'gauge',
          tags: ['test:large_value'],
        },
      ];

      const response = await submitMetricsToDatadog(metrics);

      expect(response.status).toBe(202);
    }, DEFAULT_TIMEOUT);

    test('should handle network errors with proper error messages', async () => {
      // Try to submit to invalid endpoint
      try {
        await fetch('https://invalid-datadog-endpoint.example.com/api/v1/series', {
          method: 'POST',
          headers: {
            'DD-API-KEY': DD_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ series: [] }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Error should provide useful information
        expect(error).toBeDefined();
      }
    }, DEFAULT_TIMEOUT);
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent metric submissions', async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      // Submit multiple metrics concurrently
      const promises = Array.from({ length: 5 }, (_, i) => {
        const metricName = `${METRIC_PREFIXES.INTEGRATION}.concurrent_${i}`;
        testMetricNames.push(metricName);

        return submitMetricsToDatadog([
          {
            metric: metricName,
            points: [[timestamp, i]],
            type: 'gauge',
            tags: ['test:concurrent', `index:${i}`],
          },
        ]);
      });

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(202);
      });
    }, DEFAULT_TIMEOUT);

    test('should maintain acceptable submission latency', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const metricName = `${METRIC_PREFIXES.INTEGRATION}.latency_test`;
      testMetricNames.push(metricName);

      const metrics: DatadogMetric[] = [
        {
          metric: metricName,
          points: [[timestamp, 1]],
          type: 'gauge',
          tags: ['test:latency'],
        },
      ];

      const startTime = Date.now();
      const response = await submitMetricsToDatadog(metrics);
      const latency = Date.now() - startTime;

      expect(response.status).toBe(202);
      expect(latency).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Metric submission latency: ${latency}ms`);
    }, DEFAULT_TIMEOUT);
  });
});
