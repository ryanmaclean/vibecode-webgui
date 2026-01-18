/**
 * Datadog Integration Tests
 *
 * Tests validate Datadog connectivity and functionality with mocked API
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { setupDatadogMocks } = require('../__mocks__/datadog-mock');

describe('Datadog Integration Tests', () => {
  let restoreMocks;
  const datadogSite = process.env.DD_SITE || 'datadoghq.com';
  const baseUrl = `https://api.${datadogSite}`;

  beforeEach(() => {
    const mocks = setupDatadogMocks();
    restoreMocks = mocks.restore;
  })

  afterEach(() => {
    if (restoreMocks) {
      restoreMocks();
    }
  })

  test('should validate API key with Datadog endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate`, {
      method: 'GET',
      headers: {
        'DD-API-KEY': process.env.DD_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok).toBe(true);

    const data = await response.json()
    expect(data).toHaveProperty('valid');
    expect(data.valid).toBe(true);
  }, 10000);

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
        'DD-API-KEY': process.env.DD_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(response.status).toBe(202); // Accepted
  }, 10000);
});

// Test to verify our tests are properly configured
describe('Test Quality Validation', () => {
  test('should be properly configured for integration testing', () => {
    // Verify that this test file follows integration testing principles
    expect(process.env.DD_API_KEY).toBeDefined();
  });
});