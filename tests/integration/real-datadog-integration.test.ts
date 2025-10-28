/**
 * CRITICAL: Real Datadog Integration Tests
 *
 * These tests actually validate Datadog connectivity and functionality
 * NO MOCKING - Real API calls to verify integration works
 *
 * Staff Engineer Implementation - Fixing AI-generated false positives
 */

const { describe, test, expect, beforeAll } = require('@jest/globals');

// Skip these tests if not in CI/staging environment
const shouldRunRealTests = process.env.ENABLE_REAL_DATADOG_TESTS === 'true' && process.env.DD_API_KEY;

const conditionalDescribe = shouldRunRealTests ? describe : describe.skip

conditionalDescribe('Real Datadog Integration Tests (NO MOCKING)', () => {
  const apiKey = process.env.DD_API_KEY;
  const datadogSite = process.env.DD_SITE || 'datadoghq.com';
  const baseUrl = `https://api.${datadogSite}`;

  beforeAll(() => {
    if (!apiKey) {
      throw new Error('DD_API_KEY must be set for real integration tests');
    }
    if (apiKey.includes('test') || apiKey.includes('fake') || apiKey.includes('mock')) {
      throw new Error('DD_API_KEY appears to be a test/fake key - use real API key');
    }
  });

  test('should validate API key with real Datadog endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate`, {
      method: 'GET',
      headers: {
        'DD-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });;

    expect(response.ok).toBe(true);

    const data = await response.json()
    expect(data).toHaveProperty('valid');
    expect(data.valid).toBe(true);
  }, 10000);;

  test('should successfully send metrics to Datadog', async () => {
    const now = Math.floor(Date.now() / 1000)
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.test.integration',
          points: [[now, 1]],
          tags: ['test:integration', 'service:vibecode-webgui', 'environment:test']
        }
      ]
    };
    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(response.status).toBe(202); // Accepted
  }, 10000);

  test('should connect to Redis/Valkey instance for session/cache', async () => {
    const { createClient } = require('redis');
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', err => console.error('Redis Client Error', err));

    try {
      await client.connect();

      const pong = await client.ping()
      expect(pong).toBe('PONG')

      // Test basic operations
      await client.set('test:integration', 'success')
      const value = await client.get('test:integration')
      expect(value).toBe('success')
      await client.del('test:integration')
    } finally {
      await client.quit()
    }
  }, 10000);
});

// Test to verify our tests are properly configured for real integration testing
describe('Test Quality Validation', () => {
  test('should be properly configured for real integration testing', () => {
    // Verify that this test file follows real integration testing principles:
    // 1. Conditional execution based on environment variables
    // 2. Real API calls to external services when enabled
    // 3. Proper skipping when environment is not configured

    // Check that conditional execution is set up
    expect(typeof shouldRunRealTests).toBe('boolean');

    // Should skip when environment variables are not set (which is expected in most test environments)
    if (!process.env.ENABLE_REAL_DATADOG_TESTS || !process.env.DD_API_KEY) {
      expect(shouldRunRealTests).toBe(false);
    } else {
      expect(shouldRunRealTests).toBe(true);
    }
  });

  test('should use real environment variables, not hardcoded values', () => {
    // Verify we're not using fake/hardcoded values that make tests pass falsely
    const dangerousValues = [
      'test-app-id',
      'test-client-token',
      'fake-api-key',
      'mock-endpoint',
      'localhost:fake'
    ]

    dangerousValues.forEach(dangerousValue => {
      if (process.env.DD_API_KEY?.includes(dangerousValue)) {
        throw new Error(`Environment variable contains test/fake value: ${dangerousValue}`)
      }
    });
  });
});