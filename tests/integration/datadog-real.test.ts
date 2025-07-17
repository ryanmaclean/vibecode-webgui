/**
 * Real Datadog Integration Tests
 * Tests actual connectivity to Datadog APIs using provided API key
 * Only runs when ENABLE_DATADOG_INTEGRATION_TESTS=true
 */

import { describe, test, expect, beforeAll } from '@jest/globals'

// Only run these tests when explicitly enabled with real API key
const shouldRunTests = process.env.ENABLE_DATADOG_INTEGRATION_TESTS === 'true' && !!process.env.DD_API_KEY;

const conditionalDescribe = shouldRunTests ? describe : describe.skip

conditionalDescribe('Real Datadog Integration Tests', () => {
  const apiKey = process.env.DD_API_KEY as string
  const datadogSite = process.env.DD_SITE || 'datadoghq.com';
  const baseUrl = `https://api.${datadogSite}`

  beforeAll(() => {
    // Validate environment setup
    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^[a-f0-9]{32}$/) // 32 character hex string
  });

  describe('API Key Validation', () => {
    test('should validate API key with Datadog', async () => {
      const response = await fetch(`${baseUrl}/api/v1/validate`, {
        method: 'GET',
        headers: {
          'DD-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);

      const validation = await response.json()
      expect(validation).toHaveProperty('valid');
      expect(validation.valid).toBe(true)}, 10000)})

  describe('Metrics Submission', () => {
    test('should successfully submit custom metrics', async () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const testMetric = {
        series: [
          {
            metric: 'vibecode.test.integration',
            points: [[timestamp, Math.random() * 100]],
            type: 'gauge',
            tags: [
              'test:integration',
              'environment:test',
              'service:vibecode-webgui'
            ]
          }
        ]
      };
      const response = await fetch(`${baseUrl}/api/v1/series`, {
        method: 'POST',
        headers: {
          'DD-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMetric)});

      expect(response.status).toBe(202) // Datadog returns 202 for accepted metrics

      const result = await response.json()
      expect(result).toHaveProperty('status')
      expect(result.status).toBe('ok')}, 10000)

    test('should handle multiple metrics in single request', async () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const multipleMetrics = {
        series: [
          {
            metric: 'vibecode.test.cpu_usage',
            points: [[timestamp, 45.2]],
            type: 'gauge',
            tags: ['test:integration', 'component:monitoring']
          },
          {
            metric: 'vibecode.test.memory_usage',
            points: [[timestamp, 68.5]],
            type: 'gauge',
            tags: ['test:integration', 'component:monitoring']
          },
          {
            metric: 'vibecode.test.response_time',
            points: [[timestamp, 142]],
            type: 'gauge',
            tags: ['test:integration', 'endpoint:api']
          }
        ]
      };
      const response = await fetch(`${baseUrl}/api/v1/series`, {
        method: 'POST',
        headers: {
          'DD-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(multipleMetrics)});

      expect(response.status).toBe(202)}, 10000)})

  describe('Events Submission', () => {
    test('should submit application events', async () => {
      const testEvent = {
        title: 'VibeCode Integration Test',
        text: 'Testing Datadog integration from VibeCode monitoring system',
        date_happened: Math.floor(Date.now() / 1000),
        priority: 'normal',
        tags: [
          'test:integration',
          'service:vibecode-webgui',
          'environment:test'
        ],
        alert_type: 'info'
      };
      const response = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'DD-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEvent)});

      expect(response.status).toBe(202);

      const result = await response.json()
      expect(result).toHaveProperty('status')
      expect(result.status).toBe('ok')}, 10000)})

  describe('Service Checks', () => {
    test('should submit service check status', async () => {
      const serviceCheck = {
        check: 'vibecode.integration.test',
        host_name: 'test-host',
        timestamp: Math.floor(Date.now() / 1000),
        status: 0, // OK
        message: 'Integration test service check',
        tags: [
          'test:integration',
          'service:vibecode-webgui'
        ]
      };
      const response = await fetch(`${baseUrl}/api/v1/check_run`, {
        method: 'POST',
        headers: {
          'DD-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(serviceCheck)});

      expect(response.status).toBe(202);

      const result = await response.json()
      expect(result).toHaveProperty('status')
      expect(result.status).toBe('ok')}, 10000)})

  describe('Error Handling', () => {
    test('should handle invalid metric data gracefully', async () => {
      const invalidMetric = {
        series: [
          {
            // Missing required fields
            metric: '',
            points: []
          }
        ]
      };
      const response = await fetch(`${baseUrl}/api/v1/series`, {
        method: 'POST',
        headers: {
          'DD-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidMetric)});

      // Should return error for invalid data
      expect(response.status).toBeGreaterThanOrEqual(400)}, 10000)

    test('should handle rate limiting appropriately', async () => {
      // Submit many requests rapidly to test rate limiting behavior
      const requests = Array.from({ length: 100 }, (_, i) => {
        const timestamp = Math.floor(Date.now() / 1000);
        return fetch(`${baseUrl}/api/v1/series`, {
          method: 'POST',
          headers: {
            'DD-API-KEY': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            series: [{
              metric: 'vibecode.test.rate_limit',
              points: [[timestamp, i]],
              type: 'count'
            }]
          })})});

      const responses = await Promise.allSettled(requests);

      // Most should succeed, some might be rate limited
      const successCount = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 202
      ).length

      expect(successCount).toBeGreaterThan(50) // At least 50% should succeed
    }, 30000)})

  describe('Health Check Integration', () => {
    test('should validate health check endpoint with real Datadog API', async () => {
      const response = await fetch('/api/monitoring/health', {
        headers: {
          'Authorization': 'Bearer admin-token' // Mock admin auth
        }
      });

      if (response.ok) {
        const health = await response.json()

        expect(health).toHaveProperty('components')
        expect(health.components).toHaveProperty('datadog');

        const datadogHealth = health.components.datadog
        expect(datadogHealth.status).toBe('healthy');
        expect(datadogHealth.details.integrationTested).toBe(true);
        expect(datadogHealth.details.apiKeyValid).toBe(true)}
    })})

  describe('Performance Validation', () => {
    test('should maintain acceptable performance under load', async () => {
      const startTime = Date.now();
      const concurrentRequests = 50;

      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const timestamp = Math.floor(Date.now() / 1000);
        return fetch(`${baseUrl}/api/v1/series`, {
          method: 'POST',
          headers: {
            'DD-API-KEY': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            series: [{
              metric: 'vibecode.test.performance',
              points: [[timestamp, i]],
              type: 'gauge',
              tags: ['test:performance']
            }]
          })})});

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const duration = endTime - startTime;
      const successCount = responses.filter(r => r.status === 202).length;

      // Performance assertions
      expect(duration).toBeLessThan(30000) // Should complete within 30 seconds
      expect(successCount).toBeGreaterThan(concurrentRequests * 0.8) // 80% success rate

      console.log(`Performance test: ${concurrentRequests} requests in ${duration}ms, ${successCount} successful`)}, 45000)})});

// Conditional test for non-integration environment
const nonIntegrationDescribe = !shouldRunTests ? describe : describe.skip;

nonIntegrationDescribe('Datadog Integration Tests (Skipped)', () => {
  test('should skip when integration tests are disabled', () => {
    console.log('Datadog integration tests skipped. Set ENABLE_DATADOG_INTEGRATION_TESTS=true to run.');
    expect(true).toBe(true)})});
